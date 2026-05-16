# Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete data pipeline: CSV parsing, Marketcheck market-demand caching, vehicle scoring, manual upload API, Mailgun email webhook, and monthly cron refresh.

**Architecture:** A layered library stack (`csv-parser` → `marketcheck` → `market-cache` → `scoring` → `pipeline`) feeds two ingest entry points (upload API + email webhook). All scoring runs against an Upstash Redis + Neon Postgres cache so Marketcheck calls are near-zero at score time; a Vercel Cron job refreshes the cache on the 1st of each month.

**Tech Stack:** Next.js 16 App Router route handlers, Prisma 7 + Neon Postgres, Upstash Redis (`@upstash/redis`), Vercel Blob (`@vercel/blob`), Clerk v7 auth, papaparse, Marketcheck REST API, Mailgun inbound webhook.

---

## File Map

| File | Role |
|------|------|
| `src/lib/csv-parser.ts` | Pure function: CSV text + ColumnMap → NormalizedVehicle[] |
| `src/lib/marketcheck.ts` | HTTP client: calls Marketcheck `/v2/stats/car/global/ymm` |
| `src/lib/market-cache.ts` | Cache layer: Redis hit → return; miss → fetch + write Redis + write DB |
| `src/lib/scoring.ts` | Pure `rankVehicles` + DB-writing `scoreRunList` |
| `src/lib/pipeline.ts` | Orchestrator: fetch run list → parse → score → update status |
| `src/app/api/ingest/upload/route.ts` | POST: authenticated CSV upload → Blob → DB → pipeline |
| `src/app/api/ingest/email/route.ts` | POST: Mailgun webhook → resolve source → Blob → DB → pipeline |
| `src/app/api/cron/market-refresh/route.ts` | GET: re-fetches all market_cache entries, guarded by CRON_SECRET |
| `src/lib/__tests__/csv-parser.test.ts` | Unit tests for parseRunList |
| `src/lib/__tests__/marketcheck.test.ts` | Unit tests for fetchMarketDemand (mock fetch) |
| `src/lib/__tests__/market-cache.test.ts` | Unit tests for getMarketDemand (mock Redis + marketcheck) |
| `src/lib/__tests__/scoring.test.ts` | Unit tests for rankVehicles |
| `vercel.json` | Cron schedule for market-refresh |

---

## Task 1: CSV Parser

**Files:**
- Create: `src/lib/csv-parser.ts`
- Create: `src/lib/__tests__/csv-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/csv-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseRunList } from '../csv-parser'
import type { ColumnMap } from '@/types'

const MANHEIM_MAP: ColumnMap = {
  vin: 'Vin',
  year: 'Year',
  make: 'Make',
  model: 'Model',
  trim: 'Trim',
  odometer: 'Odometer Value',
  crGrade: 'Condition Report Grade',
  mmr: 'MMR',
}

const CSV = `Vin,Year,Make,Model,Trim,Odometer Value,Condition Report Grade,MMR
1HGBH41JXMN109186,2022,Honda,Civic,EX,"45,000",3.5,15000
2T1BURHE0JC034620,2018,Toyota,Corolla,LE,"62,000",4.0,$12,500`

describe('parseRunList', () => {
  it('returns one vehicle per valid CSV row', () => {
    const vehicles = parseRunList(CSV, MANHEIM_MAP)
    expect(vehicles).toHaveLength(2)
  })

  it('maps vin, year, make, model correctly', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.vin).toBe('1HGBH41JXMN109186')
    expect(v.year).toBe(2022)
    expect(v.make).toBe('Honda')
    expect(v.model).toBe('Civic')
  })

  it('parses crGrade as float', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.crGrade).toBe(3.5)
  })

  it('parses odometer stripping commas', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.odometer).toBe(45000)
  })

  it('parses mmr stripping $ and commas', () => {
    const vehicles = parseRunList(CSV, MANHEIM_MAP)
    expect(vehicles[1].mmr).toBe(12500)
  })

  it('skips rows missing vin', () => {
    const csv = `Vin,Year,Make,Model\n,2022,Honda,Civic\n`
    const vehicles = parseRunList(csv, { vin: 'Vin', year: 'Year', make: 'Make', model: 'Model' })
    expect(vehicles).toHaveLength(0)
  })

  it('skips rows with non-numeric year', () => {
    const csv = `Vin,Year,Make,Model\n1HGBH41JXMN109186,N/A,Honda,Civic\n`
    const vehicles = parseRunList(csv, { vin: 'Vin', year: 'Year', make: 'Make', model: 'Model' })
    expect(vehicles).toHaveLength(0)
  })

  it('preserves rawData as the original CSV row object', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.rawData['Make']).toBe('Honda')
    expect(v.rawData['Vin']).toBe('1HGBH41JXMN109186')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/csv-parser.test.ts
```

Expected: FAIL — `Cannot find module '../csv-parser'`

- [ ] **Step 3: Implement csv-parser.ts**

```typescript
// src/lib/csv-parser.ts
import Papa from 'papaparse'
import type { ColumnMap, NormalizedVehicle } from '@/types'

export function parseRunList(csvText: string, columnMap: ColumnMap): NormalizedVehicle[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const vehicles: NormalizedVehicle[] = []

  for (const row of data) {
    const vin = row[columnMap.vin]?.trim()
    const yearStr = row[columnMap.year]?.trim()
    const make = row[columnMap.make]?.trim()
    const model = row[columnMap.model]?.trim()

    if (!vin || !yearStr || !make || !model) continue

    const year = parseInt(yearStr, 10)
    if (isNaN(year)) continue

    const vehicle: NormalizedVehicle = { vin, year, make, model, rawData: row }

    if (columnMap.trim) {
      const trim = row[columnMap.trim]?.trim()
      if (trim) vehicle.trim = trim
    }

    if (columnMap.odometer) {
      const odo = parseFloat(row[columnMap.odometer]?.replace(/,/g, '') ?? '')
      if (!isNaN(odo)) vehicle.odometer = Math.round(odo)
    }

    if (columnMap.crGrade) {
      const cr = parseFloat(row[columnMap.crGrade] ?? '')
      if (!isNaN(cr)) vehicle.crGrade = cr
    }

    if (columnMap.mmr) {
      const mmr = parseFloat(row[columnMap.mmr]?.replace(/[$,]/g, '') ?? '')
      if (!isNaN(mmr)) vehicle.mmr = Math.round(mmr)
    }

    vehicles.push(vehicle)
  }

  return vehicles
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/csv-parser.test.ts
```

Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv-parser.ts src/lib/__tests__/csv-parser.test.ts
git commit -m "feat: add CSV parser with column map normalization"
```

---

## Task 2: Marketcheck HTTP Client

**Files:**
- Create: `src/lib/marketcheck.ts`
- Create: `src/lib/__tests__/marketcheck.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/marketcheck.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchMarketDemand } from '../marketcheck'

beforeEach(() => {
  vi.stubEnv('MARKETCHECK_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('fetchMarketDemand', () => {
  it('returns count from API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 42 }),
    }))
    const count = await fetchMarketDemand('Honda', 'Civic', 2022)
    expect(count).toBe(42)
  })

  it('includes zip=35801, radius=100, and make/year/model in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 10 }),
    })
    vi.stubGlobal('fetch', mockFetch)
    await fetchMarketDemand('Toyota', 'Camry', 2020)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('zip=35801')
    expect(url).toContain('radius=100')
    expect(url).toContain('make=Toyota')
    expect(url).toContain('model=Camry')
    expect(url).toContain('year=2020')
  })

  it('throws on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }))
    await expect(fetchMarketDemand('Honda', 'Civic', 2022)).rejects.toThrow('403')
  })

  it('returns 0 when response has no count field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }))
    const count = await fetchMarketDemand('Honda', 'Civic', 2022)
    expect(count).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/marketcheck.test.ts
```

Expected: FAIL — `Cannot find module '../marketcheck'`

- [ ] **Step 3: Implement marketcheck.ts**

```typescript
// src/lib/marketcheck.ts
const BASE_URL = 'https://mc-api.marketcheck.com/v2'

export async function fetchMarketDemand(
  make: string,
  model: string,
  year: number
): Promise<number> {
  const params = new URLSearchParams({
    api_key: process.env.MARKETCHECK_API_KEY!,
    year: String(year),
    make,
    model,
    zip: '35801',
    radius: '100',
    stats: 'units_for_sale',
  })

  const res = await fetch(`${BASE_URL}/stats/car/global/ymm?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Marketcheck API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return (data.count as number) ?? 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/marketcheck.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketcheck.ts src/lib/__tests__/marketcheck.test.ts
git commit -m "feat: add Marketcheck API client for demand scoring"
```

---

## Task 3: Market Cache Layer

**Files:**
- Create: `src/lib/market-cache.ts`
- Create: `src/lib/__tests__/market-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/market-cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}))
vi.mock('@/lib/marketcheck', () => ({
  fetchMarketDemand: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: { marketCache: { upsert: vi.fn() } },
}))

import { getMarketDemand } from '../market-cache'
import { redis } from '@/lib/redis'
import { fetchMarketDemand } from '@/lib/marketcheck'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMarketDemand', () => {
  it('returns cached value without calling Marketcheck API', async () => {
    vi.mocked(redis.get).mockResolvedValue(75)
    const count = await getMarketDemand('Honda', 'Civic', 2022)
    expect(count).toBe(75)
    expect(fetchMarketDemand).not.toHaveBeenCalled()
  })

  it('calls Marketcheck on cache miss and returns count', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(50)
    const count = await getMarketDemand('Toyota', 'Camry', 2020)
    expect(count).toBe(50)
    expect(fetchMarketDemand).toHaveBeenCalledWith('Toyota', 'Camry', 2020)
  })

  it('writes to Redis with 30-day TTL on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(30)
    await getMarketDemand('Ford', 'F-150', 2021)
    expect(redis.set).toHaveBeenCalledWith(
      'market:ford:f-150:2021',
      30,
      { ex: 60 * 60 * 24 * 30 }
    )
  })

  it('builds cache key in lowercase', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(0)
    await getMarketDemand('BMW', 'X5', 2023)
    expect(redis.get).toHaveBeenCalledWith('market:bmw:x5:2023')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/market-cache.test.ts
```

Expected: FAIL — `Cannot find module '../market-cache'`

- [ ] **Step 3: Implement market-cache.ts**

```typescript
// src/lib/market-cache.ts
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { fetchMarketDemand } from '@/lib/marketcheck'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

function cacheKey(make: string, model: string, year: number): string {
  return `market:${make.toLowerCase()}:${model.toLowerCase()}:${year}`
}

export async function getMarketDemand(
  make: string,
  model: string,
  year: number
): Promise<number> {
  const key = cacheKey(make, model, year)
  const cached = await redis.get<number>(key)
  if (cached !== null) return cached

  const count = await fetchMarketDemand(make, model, year)

  await redis.set(key, count, { ex: THIRTY_DAYS_SECONDS })

  await db.marketCache.upsert({
    where: { make_model_year: { make, model, year } },
    update: { listingCount: count, demandScore: count, lastRefreshedAt: new Date() },
    create: { make, model, year, listingCount: count, demandScore: count },
  })

  return count
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/market-cache.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/market-cache.ts src/lib/__tests__/market-cache.test.ts
git commit -m "feat: add market cache layer with Redis TTL and Postgres fallback"
```

---

## Task 4: Scoring Engine

**Files:**
- Create: `src/lib/scoring.ts`
- Create: `src/lib/__tests__/scoring.test.ts`

The scoring module has two exports:
- `rankVehicles(scores: number[]): number[]` — pure function, returns rank array aligned with input (rank 1 = highest score)
- `scoreRunList(runListId, vehicles)` — async, fetches demand scores, ranks, bulk-inserts to DB

Tests only cover `rankVehicles` (pure). `scoreRunList` is covered by the pipeline smoke test.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/scoring.test.ts
import { describe, it, expect } from 'vitest'
import { rankVehicles } from '../scoring'

describe('rankVehicles', () => {
  it('assigns rank 1 to the vehicle with the highest score', () => {
    const ranks = rankVehicles([10, 50, 30])
    expect(ranks[1]).toBe(1)
  })

  it('assigns the last rank to the vehicle with the lowest score', () => {
    const ranks = rankVehicles([10, 50, 30])
    expect(ranks[0]).toBe(3)
  })

  it('handles a single vehicle — rank is always 1', () => {
    const ranks = rankVehicles([42])
    expect(ranks[0]).toBe(1)
  })

  it('handles ties by stable ordering (first occurrence wins lower rank number)', () => {
    const ranks = rankVehicles([20, 20, 10])
    expect(ranks[0]).toBe(1)
    expect(ranks[1]).toBe(2)
    expect(ranks[2]).toBe(3)
  })

  it('returns an empty array for empty input', () => {
    expect(rankVehicles([])).toHaveLength(0)
  })

  it('returns an array the same length as input', () => {
    const ranks = rankVehicles([5, 3, 8, 1, 9])
    expect(ranks).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/scoring.test.ts
```

Expected: FAIL — `Cannot find module '../scoring'`

- [ ] **Step 3: Implement scoring.ts**

```typescript
// src/lib/scoring.ts
import { db } from '@/lib/db'
import { getMarketDemand } from '@/lib/market-cache'
import type { NormalizedVehicle } from '@/types'

export function rankVehicles(scores: number[]): number[] {
  const indexed = scores.map((score, i) => ({ score, i }))
  indexed.sort((a, b) => b.score - a.score)
  const ranks = new Array<number>(scores.length)
  indexed.forEach(({ i }, pos) => {
    ranks[i] = pos + 1
  })
  return ranks
}

export async function scoreRunList(
  runListId: string,
  vehicles: NormalizedVehicle[]
): Promise<void> {
  const scores = await Promise.all(
    vehicles.map(v =>
      getMarketDemand(v.make, v.model, v.year).catch(() => 0)
    )
  )
  const ranks = rankVehicles(scores)

  await db.runListVehicle.createMany({
    data: vehicles.map((v, i) => ({
      runListId,
      vin: v.vin,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim ?? null,
      odometer: v.odometer ?? null,
      crGrade: v.crGrade != null ? v.crGrade : null,
      mmr: v.mmr ?? null,
      demandScore: scores[i],
      demandRank: ranks[i],
      rawData: v.rawData,
    })),
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/scoring.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Run the full test suite to confirm nothing broke**

```bash
npx vitest run
```

Expected: 20 tests PASS across 4 test files (12 original + 8 new)

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts src/lib/__tests__/scoring.test.ts
git commit -m "feat: add vehicle ranking and run list scoring engine"
```

---

## Task 5: Run List Processing Pipeline

No unit tests — this is an orchestration layer. Tested by the upload API smoke test in Task 6.

**Files:**
- Create: `src/lib/pipeline.ts`

- [ ] **Step 1: Create pipeline.ts**

```typescript
// src/lib/pipeline.ts
import { db } from '@/lib/db'
import { parseRunList } from '@/lib/csv-parser'
import { scoreRunList } from '@/lib/scoring'
import type { ColumnMap } from '@/types'

export async function processRunList(runListId: string): Promise<void> {
  const runList = await db.runList.findUniqueOrThrow({
    where: { id: runListId },
    include: { source: true },
  })

  if (runList.status === 'scored') return

  await db.runList.update({
    where: { id: runListId },
    data: { status: 'processing' },
  })

  try {
    const res = await fetch(runList.blobUrl)
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`)
    const csvText = await res.text()

    const columnMap = runList.source.columnMap as ColumnMap
    const vehicles = parseRunList(csvText, columnMap)

    if (vehicles.length === 0) {
      throw new Error('No valid vehicles found in CSV. Check column mapping for this source.')
    }

    await scoreRunList(runListId, vehicles)

    await db.runList.update({
      where: { id: runListId },
      data: { status: 'scored', scoredAt: new Date() },
    })
  } catch (err) {
    await db.runList.update({
      where: { id: runListId },
      data: {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      },
    })
    throw err
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pipeline.ts
git commit -m "feat: add run list processing pipeline orchestrator"
```

---

## Task 6: Upload API Endpoint

**Prerequisite:** `BLOB_READ_WRITE_TOKEN` must be set in `.env.local`. To get it:
1. Go to Vercel Dashboard → Storage → Create a Blob store named `runlist-blobs` (if not already done)
2. In the project, run: `npx vercel link && npx vercel env pull .env.local`
3. Confirm `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...` appears in `.env.local`

**Files:**
- Create: `src/app/api/ingest/upload/route.ts`

- [ ] **Step 1: Create the upload route**

```typescript
// src/app/api/ingest/upload/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { processRunList } from '@/lib/pipeline'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const sourceId = formData.get('sourceId') as string | null

  if (!file || !sourceId) {
    return NextResponse.json({ error: 'Missing file or sourceId' }, { status: 400 })
  }

  const source = await db.auctionSource.findUnique({ where: { id: sourceId } })
  if (!source) {
    return NextResponse.json({ error: 'Unknown sourceId' }, { status: 400 })
  }

  const blob = await put(`runlists/${Date.now()}-${file.name}`, file, { access: 'public' })

  const runList = await db.runList.create({
    data: {
      userId,
      sourceId,
      blobUrl: blob.url,
      filename: file.name,
      status: 'pending',
    },
  })

  await processRunList(runList.id)

  return NextResponse.json({ runListId: runList.id, status: 'scored' })
}
```

- [ ] **Step 2: Deploy to Vercel and add BLOB_READ_WRITE_TOKEN**

```bash
npx vercel --prod
```

After deploying, ensure `BLOB_READ_WRITE_TOKEN` is set in Vercel production env vars:
- Vercel Dashboard → Project → Settings → Environment Variables
- Add `BLOB_READ_WRITE_TOKEN` with the value from `.env.local`
- Redeploy if just added

- [ ] **Step 3: Smoke test the upload endpoint**

Get a Clerk session token from the browser (DevTools → Application → Cookies → `__session`), then:

```bash
# Replace TOKEN and PRODUCTION_URL with real values
# Get sourceId from Neon: SELECT id FROM auction_sources WHERE name = 'manheim';
curl -X POST https://<PRODUCTION_URL>/api/ingest/upload \
  -H "Cookie: __session=<TOKEN>" \
  -F "file=@path/to/test.csv" \
  -F "sourceId=<uuid-from-db>"
```

Expected response:
```json
{"runListId":"<uuid>","status":"scored"}
```

Verify in Neon that `run_lists` shows `status = 'scored'` and `run_list_vehicles` has rows with `demand_score` and `demand_rank`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ingest/upload/route.ts
git commit -m "feat: add authenticated CSV upload API with pipeline trigger"
```

---

## Task 7: Mailgun Email Webhook

The Mailgun inbound webhook POSTs a `multipart/form-data` body with these fields:
- `sender` — raw sender email (e.g. `"John Doe <john@dealer.com>"`)
- `from` — same as sender (display format)
- `attachment-count` — number of file attachments (string)
- `attachment-1`, `attachment-2`, ... — File objects

The sender lookup uses `emailAddress` column in `auction_source_emails`. It must match the raw email extracted from the `sender` field.

**Files:**
- Create: `src/app/api/ingest/email/route.ts`

- [ ] **Step 1: Create the email webhook route**

```typescript
// src/app/api/ingest/email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { processRunList } from '@/lib/pipeline'

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).toLowerCase().trim()
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const rawSender = formData.get('sender') as string | null

  if (!rawSender) {
    return NextResponse.json({ error: 'No sender' }, { status: 400 })
  }

  const senderEmail = extractEmail(rawSender)

  const sourceEmail = await db.auctionSourceEmail.findUnique({
    where: { emailAddress: senderEmail },
    include: { source: true },
  })

  if (!sourceEmail) {
    console.warn(`Mailgun: unrecognized sender ${senderEmail}`)
    // Return 200 so Mailgun does not retry
    return NextResponse.json({ ok: true, ignored: true })
  }

  const attachmentCount = parseInt(
    (formData.get('attachment-count') as string) ?? '0',
    10
  )

  let csvFile: File | null = null
  let filename = 'email-upload.csv'

  for (let i = 1; i <= attachmentCount; i++) {
    const attachment = formData.get(`attachment-${i}`) as File | null
    if (attachment && attachment.name.toLowerCase().endsWith('.csv')) {
      csvFile = attachment
      filename = attachment.name
      break
    }
  }

  if (!csvFile) {
    return NextResponse.json({ error: 'No CSV attachment found' }, { status: 200 })
  }

  const blob = await put(`runlists/email-${Date.now()}-${filename}`, csvFile, {
    access: 'public',
  })

  const runList = await db.runList.create({
    data: {
      userId: `email:${senderEmail}`,
      sourceId: sourceEmail.sourceId,
      blobUrl: blob.url,
      filename,
      status: 'pending',
    },
  })

  await processRunList(runList.id)

  return NextResponse.json({ ok: true, runListId: runList.id })
}
```

- [ ] **Step 2: Verify the route is excluded from Clerk auth in middleware.ts**

Open `middleware.ts` and confirm `/api/ingest/email` is in the public routes list:

```typescript
// middleware.ts — the publicRoutes matcher should include:
'/api/ingest/email'
```

If it is not present, add it to the `isPublicRoute` matcher. The file currently looks like:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/ingest/email',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 3: Smoke test with curl (simulates Mailgun webhook)**

First, add an email to `auction_source_emails` in Neon:
```sql
INSERT INTO auction_source_emails (id, email_address, source_id)
VALUES (gen_random_uuid(), 'test@dealer.com', '<manheim-source-id>');
```

Then simulate the Mailgun webhook:
```bash
curl -X POST https://<PRODUCTION_URL>/api/ingest/email \
  -F "sender=Test Dealer <test@dealer.com>" \
  -F "attachment-count=1" \
  -F "attachment-1=@path/to/test.csv;type=text/csv;filename=test.csv"
```

Expected: `{"ok":true,"runListId":"<uuid>"}`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ingest/email/route.ts middleware.ts
git commit -m "feat: add Mailgun inbound email webhook for CSV ingestion"
```

---

## Task 8: Monthly Cron Market Refresh

Creates the Vercel Cron endpoint and `vercel.json` schedule. The Vercel Cron runner sends `Authorization: Bearer <CRON_SECRET>` in the request header.

**Files:**
- Create: `src/app/api/cron/market-refresh/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create the cron route**

```typescript
// src/app/api/cron/market-refresh/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { fetchMarketDemand } from '@/lib/marketcheck'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entries = await db.marketCache.findMany()
  let refreshed = 0
  let errors = 0

  for (const entry of entries) {
    try {
      const count = await fetchMarketDemand(entry.make, entry.model, entry.year)
      const key = `market:${entry.make.toLowerCase()}:${entry.model.toLowerCase()}:${entry.year}`

      await redis.set(key, count, { ex: THIRTY_DAYS_SECONDS })
      await db.marketCache.update({
        where: { id: entry.id },
        data: {
          listingCount: count,
          demandScore: count,
          lastRefreshedAt: new Date(),
        },
      })
      refreshed++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ refreshed, errors, total: entries.length })
}
```

- [ ] **Step 2: Create vercel.json with cron schedule**

```json
{
  "crons": [
    {
      "path": "/api/cron/market-refresh",
      "schedule": "0 6 1 * *"
    }
  ]
}
```

This runs at 6:00 AM UTC on the 1st of each month.

- [ ] **Step 3: Verify CRON_SECRET is set in Vercel env**

```bash
# Check if it's in .env.local
grep CRON_SECRET .env.local
```

If the value is still `replace_me`, generate a new one and update both `.env.local` and Vercel:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output, then:
npx vercel env add CRON_SECRET production
# Paste the value when prompted
```

- [ ] **Step 4: Deploy and verify cron appears in Vercel**

```bash
npx vercel --prod
```

After deploy: Vercel Dashboard → Project → Settings → Cron Jobs. You should see the `market-refresh` job listed.

- [ ] **Step 5: Manual cron trigger smoke test**

```bash
# Get CRON_SECRET from .env.local
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d'=' -f2-)
curl -H "Authorization: Bearer $SECRET" https://<PRODUCTION_URL>/api/cron/market-refresh
```

Expected (with empty market_cache on first run):
```json
{"refreshed":0,"errors":0,"total":0}
```

After uploading a run list (Task 6 smoke test populates market_cache), re-running should show `total > 0`.

- [ ] **Step 6: Run full test suite to confirm all 20 tests still pass**

```bash
npx vitest run
```

Expected: 20 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/market-refresh/route.ts vercel.json
git commit -m "feat: add monthly Marketcheck cron refresh with CRON_SECRET auth"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| CSV upload → Blob → RunList row | Task 6 |
| Email ingest via Mailgun | Task 7 |
| Resolve sender → auction source | Task 7 |
| Parse CSV using column map | Task 1 |
| Normalize to NormalizedVehicle | Task 1 |
| Marketcheck API call | Task 2 |
| Redis cache check (30-day TTL) | Task 3 |
| Write to market_cache table | Task 3 |
| Score vehicles by demand volume | Task 4 |
| Rank vehicles within run list | Task 4 |
| Write demand_score + demand_rank to vehicles | Task 4 |
| Update run_list.status to 'scored' | Task 5 |
| Monthly cron refresh | Task 8 |
| CRON_SECRET auth on cron endpoint | Task 8 |
| `/api/ingest/email` is public (no Clerk) | Task 7 |

**All spec requirements are covered. No placeholders. Types are consistent across all tasks.**
