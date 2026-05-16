# Run List Analyzer — Design Spec

**Date:** 2026-05-16  
**Status:** Approved  

---

## Understanding Summary

- **What:** A multi-user web app that ingests auction run list CSVs from multiple sources and scores each vehicle based on local market demand in Huntsville, AL
- **Why:** Auction run lists contain hundreds of vehicles. Buyers need to quickly identify which ones actually move in their market without burning through hours of manual research
- **Who:** Single dealership, multiple staff users (Clerk email/password auth)
- **How data gets in:** Drag-and-drop CSV upload OR email attachment via Mailgun inbound webhook
- **Market data:** One Marketcheck batch pull per month (500 call/month quota), cached in Upstash Redis with 30-day TTL, all analysis runs against that cache
- **Scoring metric:** Demand volume — how many units of that make/model/year are actively listed within 100 miles of Huntsville AL (zip: 35801)
- **Deploy target:** Vercel (Next.js App Router)

---

## Explicit Non-Goals

- No multi-tenant / multi-dealership (single store for now — architecture stays modular for future)
- No owner count / accident history filters (handled upstream by auction platforms)
- No historical dealer sales data in scoring (avoided inventory bias)
- No real-time streaming of results
- No per-vehicle Marketcheck calls at analysis time (cache-only at score time)

---

## Assumptions

| ID | Assumption |
|----|------------|
| A1 | Neon Postgres via Vercel Marketplace for structured data |
| A2 | Upstash Redis via Vercel Marketplace for market cache |
| A3 | Vercel Blob for raw CSV file storage |
| A4 | Vercel Cron triggers monthly Marketcheck refresh on the 1st of each month |
| A5 | VIN is the universal key across all auction sources |
| A6 | Marketcheck query = `units_for_sale` by make/model/year within 100 miles of zip 35801 |
| A7 | Cache key format: `market:{make}:{model}:{year}` (trim excluded — data too sparse) |
| A8 | Sender email address maps to an auction source via `auction_source_emails` table |

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js App Router |
| Hosting | Vercel |
| Auth | Clerk (email/password) |
| Database | Neon Postgres (via Prisma ORM) |
| Cache | Upstash Redis |
| File Storage | Vercel Blob |
| Email Ingestion | Mailgun inbound webhook |
| Scheduling | Vercel Cron |
| Market Data API | Marketcheck |

---

## System Architecture

```
Browser / Email
      │
      ├─ Drag-and-drop upload ──────────────────────┐
      └─ Mailgun inbound → /api/ingest/email ────────┤
                                                      ▼
                                              Vercel Blob (raw CSV)
                                                      │
                                              /api/ingest/parse
                                                      │
                                         ┌────────────▼────────────┐
                                         │   Neon Postgres          │
                                         │   (vehicles, run lists,  │
                                         │    source maps, presets) │
                                         └────────────┬────────────┘
                                                      │
                                              /api/analyze/score
                                                      │
                                         ┌────────────▼────────────┐
                                         │   Upstash Redis          │
                                         │   (market cache)         │
                                         └────────────┬────────────┘
                                                      │ cache miss only
                                              Marketcheck API
                                                      │
                                         Vercel Cron (1st of month)
```

---

## Data Model

### `auction_sources`
```sql
id            uuid PK
name          text UNIQUE          -- e.g. "manheim"
display_name  text                 -- e.g. "Manheim"
column_map    jsonb                -- { "vin": "Vin", "year": "Year", ... }
is_preset     boolean DEFAULT false
created_at    timestamptz
```

### `auction_source_emails`
```sql
id            uuid PK
email_address text UNIQUE
source_id     uuid FK auction_sources
```

### `run_lists`
```sql
id            uuid PK
user_id       text                 -- Clerk user ID
source_id     uuid FK auction_sources
blob_url      text
filename      text
status        text                 -- pending | processing | scored | error
error_message text
uploaded_at   timestamptz
scored_at     timestamptz
```

### `run_list_vehicles`
```sql
id            uuid PK
run_list_id   uuid FK run_lists
vin           text
year          int
make          text
model         text
trim          text
odometer      int
cr_grade      decimal(3,1)
mmr           int
demand_score  int                  -- units_for_sale from Marketcheck
demand_rank   int                  -- rank within this run list (1 = highest demand)
raw_data      jsonb                -- original unmodified CSV row
```

### `market_cache`
```sql
id                uuid PK
make              text
model             text
year              int
listing_count     int              -- units_for_sale within 100mi of 35801
demand_score      int
last_refreshed_at timestamptz
UNIQUE(make, model, year)
```

### `filter_presets`
```sql
id          uuid PK
user_id     text
name        text
filters     jsonb                  -- { crGrade: [3.0, 5.0], mmrtMin: 0, demandRank: 25, ... }
is_default  boolean DEFAULT false
created_at  timestamptz
```

---

## Ingestion Pipeline

### Entry Point A — Manual Upload
1. User drags CSV onto upload page
2. User selects auction source (dropdown) or clicks "Add New Source"
3. POST to `/api/ingest/upload` → stored in Vercel Blob → `run_lists` row created (`status: pending`)
4. UI shows "Processing..." and polls status

### Entry Point B — Mailgun Email
1. Dealer emails CSV attachment to `runlist@yourdomain.com`
2. Mailgun POSTs multipart to `/api/ingest/email`
3. API extracts sender → looks up `auction_source_emails` → resolves source
4. Unknown sender → reply email: "Unrecognized sender. Log in to configure your email address."
5. CSV stored in Blob → `run_lists` row created

### Shared Processing Path
1. `/api/ingest/parse` triggered after blob write
2. Fetches `column_map` from `auction_sources`
3. Reads CSV from Blob → maps columns → normalizes to common vehicle schema
4. Writes rows to `run_list_vehicles` (including `raw_data` JSON)
5. Calls `/api/analyze/score`
6. Updates `run_lists.status` to `scored`

### Add New Source Flow
1. User uploads file, selects "Add New Source"
2. CSV headers extracted and displayed
3. User drags/maps headers to standard fields (VIN, Year, Make, Model, Trim, Odometer, CR Grade, MMR, etc.)
4. Saved to `auction_sources` → used immediately and for all future uploads from that source

---

## Scoring & Market Cache

### Score Time Logic (`/api/analyze/score`)
```
For each vehicle:
  key = "market:{make}:{model}:{year}"
  
  if Redis.get(key) exists:
    use cached listing_count as demand_score
  else:
    call Marketcheck /v2/stats/car/global/ymm
      ?year={year}&make={make}&model={model}
      &zip=35801&radius=100&stats=units_for_sale
    store in Redis (TTL: 30 days)
    write to market_cache table
    use listing_count as demand_score

Rank all vehicles in run list by demand_score descending
Write demand_score + demand_rank to run_list_vehicles
```

### Monthly Refresh (`/api/cron/market-refresh`)
- Runs 1st of each month via Vercel Cron
- Queries `market_cache` for all distinct make/model/year
- Re-calls Marketcheck for each entry (stays within 500 call/month budget)
- Updates Redis TTL + Postgres `last_refreshed_at`

### API Call Budget
| Scenario | Calls |
|----------|-------|
| Cache warm (normal use) | 0 per run list |
| First upload (cold cache) | ~50–70 (unique make/model/year combos in list) |
| New make/model/year | 1 per new combo |
| Monthly cron | ~300 (all cached combos) |

---

## UI Structure

| Route | Purpose |
|-------|---------|
| `/` | Landing / Clerk login |
| `/dashboard` | Recent run lists, cache status, last refresh date, quick upload |
| `/run-lists` | All run lists (table: filename, source, date, status) |
| `/run-lists/[id]` | Scored vehicle list with filter panel |
| `/sources` | Manage auction sources (presets read-only, custom editable) |
| `/settings` | Marketcheck API key, cache TTL, email ingestion config |

### `/run-lists/[id]` — Core View

**Filter Panel:**
- CR Grade range slider (0.0 – 5.0)
- MMR range (min / max)
- Demand rank cutoff (top 10 / top 25 / all)
- Make / Model multi-select
- Odometer max
- Save as preset / load preset

**Results Table (sortable):**
- Rank | Year Make Model Trim | CR Grade | MMR | Demand Score | Listing Count | Odometer | Seller | Status

**Row Expand:**
- Full raw CSV data
- Marketcheck data breakdown

**Export:**
- Filtered list as CSV

---

## Decision Log

| # | Decision | Alternatives Considered | Why |
|---|---|---|---|
| 1 | Next.js App Router on Vercel | Remix, SvelteKit | Vercel-native, best ecosystem for this stack |
| 2 | Clerk (email/password) | NextAuth, Supabase Auth | Fastest multi-user auth, Vercel integration |
| 3 | Neon Postgres via Prisma | Firebase, PlanetScale | Relational schema; Vercel Marketplace |
| 4 | Upstash Redis for market cache | Postgres-only, in-memory | Fast TTL lookups; Vercel Marketplace |
| 5 | Vercel Blob for CSV storage | S3, local disk | Vercel-native, zero config |
| 6 | Monthly cron refresh (30-day TTL) | Per-upload refresh, daily | 500 call/month Marketcheck quota |
| 7 | Persistent pipeline | Ephemeral, streaming | Multi-user, run list history |
| 8 | Preset maps + configurable mapper UI | Auto-detect headers | Reliable for known sources, flexible for new |
| 9 | Demand volume as scoring metric | Margin, days-to-sale | User's explicit preference |
| 10 | No historical dealer sales in scoring | Weight by past sales | Avoided Hyundai-heavy inventory bias |
| 11 | Mailgun inbound webhook | Manual only | User already has Mailgun, reduces friction |
| 12 | Trim excluded from cache key | Include trim | Marketcheck trim-level data is inconsistent |
