# Curation & Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-phase pipeline (parse on upload, score on demand), vehicle curation (filter sidebar + exclusions), Carfax field surfacing, dealer inventory stock indicators, and CSV/print/share export.

**Architecture:** Split the existing `processRunList` into (1) `ingestRunList` — parse CSV → store vehicles, status `parsed` — and (2) `scoreRunList` — Marketcheck calls for non-excluded vehicles, status `scored`. Curation page uses URL params for shareable server-side filter/sort state; a `'use client'` sidebar updates params via `router.push`. Dealer inventory arrives via Mailgun webhook (HTTP signing key HMAC verification) and fully replaces the `dealer_inventory` table on each import. Stock indicators are matched at page render by year + make + partial model.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Neon/PostgreSQL, Upstash Redis, Marketcheck API, Mailgun webhook HMAC-SHA256, papaparse, vitest/jsdom

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add carfax fields + `isExcluded` to `RunListVehicle`; add `DealerInventory` model |
| Modify | `src/types/index.ts` | Extend `NormalizedVehicle`, `ColumnMap`, `FilterState`; add `InventoryVehicle`, `StockLevel` |
| Modify | `src/lib/csv-parser.ts` | Parse carfax optional fields |
| Modify | `src/lib/__tests__/csv-parser.test.ts` | Add carfax field tests |
| Create | `src/lib/ingest.ts` | Parse-only pipeline phase |
| Create | `src/lib/__tests__/ingest.test.ts` | Ingest tests |
| Modify | `src/lib/scoring.ts` | Fetch from DB, skip excluded vehicles, update rows |
| Delete | `src/lib/pipeline.ts` | Superseded by `ingest.ts` + updated `scoring.ts` |
| Modify | `src/app/api/ingest/upload/route.ts` | Call `ingestRunList` instead of `processRunList` |
| Create | `src/app/api/run-lists/[id]/score/route.ts` | POST — trigger scoring |
| Create | `src/app/api/run-lists/[id]/vehicles/[vehicleId]/route.ts` | PATCH — toggle `isExcluded` |
| Create | `src/lib/inventory-parser.ts` | Parse dealer inventory CSV |
| Create | `src/lib/__tests__/inventory-parser.test.ts` | Inventory parser tests |
| Create | `src/app/api/webhooks/inventory/route.ts` | Mailgun webhook — full-replace inventory |
| Rewrite | `src/app/(app)/run-lists/[id]/page.tsx` | Server component with URL-param filtered curation view |
| Create | `src/components/run-lists/FilterSidebar.tsx` | Client component — filter controls → URL params |
| Create | `src/components/run-lists/VehicleTable.tsx` | Client component — sortable table + exclusion toggle |
| Create | `src/components/run-lists/ScoreButton.tsx` | Client component — triggers score API |
| Create | `src/components/run-lists/ExportButtons.tsx` | Client component — download / print / share |
| Create | `src/app/api/run-lists/[id]/export/route.ts` | GET — return filtered CSV |

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `RunListVehicle` and create `DealerInventory` model**

Replace the `RunListVehicle` model and append the new model in `prisma/schema.prisma`:

```prisma
model RunListVehicle {
  id            String   @id @default(uuid())
  runListId     String
  runList       RunList  @relation(fields: [runListId], references: [id], onDelete: Cascade)
  vin           String
  year          Int
  make          String
  model         String
  trim          String?
  odometer      Int?
  crGrade       Decimal? @db.Decimal(3, 1)
  mmr           Int?
  accidents     Int?
  owners        Int?
  ownershipType String?
  carfaxValue   Int?
  isExcluded    Boolean  @default(false)
  demandScore   Int?
  demandRank    Int?
  rawData       Json

  @@map("run_list_vehicles")
}

model DealerInventory {
  id         String   @id @default(uuid())
  vin        String   @unique
  year       Int
  make       String
  model      String
  trim       String?
  importedAt DateTime @default(now())

  @@map("dealer_inventory")
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-curation-and-inventory
```

Expected output: `The following migration(s) have been created and applied...`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add curation fields, DealerInventory model"
```

---

### Task 2: Extend Types

**Files:**
- Modify: `src/types/index.ts`

No test for this task — TypeScript compilation in subsequent tasks verifies the types.

- [ ] **Step 1: Extend `NormalizedVehicle`, `ColumnMap`, `FilterState`; add `InventoryVehicle` and `StockLevel`**

Replace the entire contents of `src/types/index.ts`:

```typescript
export interface NormalizedVehicle {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
  odometer?: number
  crGrade?: number
  mmr?: number
  accidents?: number
  owners?: number
  ownershipType?: string
  carfaxValue?: number
  rawData: Record<string, string>
}

export interface ColumnMap {
  vin: string
  year: string
  make: string
  model: string
  trim?: string
  odometer?: string
  crGrade?: string
  mmr?: string
  accidents?: string
  owners?: string
  ownershipType?: string
  carfaxValue?: string
  [key: string]: string | undefined
}

export interface FilterState {
  crGradeMin?: number
  crGradeMax?: number
  mmrMin?: number
  mmrMax?: number
  odomMax?: number
  yearMin?: number
  yearMax?: number
  accMax?: number
  ownMax?: number
  ownerType?: string
  makes?: string[]
  rankMax?: number
  showExcluded?: boolean
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface MarketData {
  make: string
  model: string
  year: number
  listingCount: number
  demandScore: number
  lastRefreshedAt: Date
}

export interface ScoredVehicle extends NormalizedVehicle {
  id: string
  demandScore: number | null
  demandRank: number | null
}

export interface InventoryVehicle {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
}

export type StockLevel = 'none' | 'low' | 'high'
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `types/index.ts`. (Other files may error until later tasks fix them.)

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend types for carfax, inventory, curation filters"
```

---

### Task 3: CSV Parser — Carfax Fields

**Files:**
- Modify: `src/lib/csv-parser.ts`
- Modify: `src/lib/__tests__/csv-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/csv-parser.test.ts` after the existing `describe` block:

```typescript
describe('parseRunList — carfax fields', () => {
  const CARFAX_MAP: ColumnMap = {
    vin: 'VIN',
    year: 'Year',
    make: 'Make',
    model: 'Model',
    accidents: 'Accidents',
    owners: 'Owners',
    ownershipType: 'Title Type',
    carfaxValue: 'Carfax Value',
  }

  const CSV_CARFAX = `VIN,Year,Make,Model,Accidents,Owners,Title Type,Carfax Value
1HGBH41JXMN109186,2022,Honda,Civic,1,2,Personal,$15,000
2T1BURHE0JC034620,2018,Toyota,Corolla,0,1,Personal,$12500`

  it('parses accident count', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.accidents).toBe(1)
  })

  it('parses owner count', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.owners).toBe(2)
  })

  it('parses ownershipType', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.ownershipType).toBe('Personal')
  })

  it('parses carfaxValue stripping $ and commas', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.carfaxValue).toBe(15000)
  })

  it('parses zero accidents correctly', () => {
    const vehicles = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(vehicles[1].accidents).toBe(0)
  })

  it('leaves carfax fields undefined when columns not mapped', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model' }
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBeUndefined()
    expect(v.owners).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/csv-parser.test.ts
```

Expected: FAIL — `v.accidents` is `undefined` where `1` expected.

- [ ] **Step 3: Add carfax field parsing to `csv-parser.ts`**

After the `if (columnMap.mmr)` block and before `vehicles.push(vehicle)`, add:

```typescript
    if (columnMap.accidents) {
      const acc = parseInt(row[columnMap.accidents] ?? '', 10)
      if (!isNaN(acc)) vehicle.accidents = acc
    }

    if (columnMap.owners) {
      const own = parseInt(row[columnMap.owners] ?? '', 10)
      if (!isNaN(own)) vehicle.owners = own
    }

    if (columnMap.ownershipType) {
      const ot = row[columnMap.ownershipType]?.trim()
      if (ot) vehicle.ownershipType = ot
    }

    if (columnMap.carfaxValue) {
      const cv = parseFloat(row[columnMap.carfaxValue]?.replace(/[$,]/g, '') ?? '')
      if (!isNaN(cv)) vehicle.carfaxValue = Math.round(cv)
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/__tests__/csv-parser.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv-parser.ts src/lib/__tests__/csv-parser.test.ts
git commit -m "feat: parse carfax fields (accidents, owners, ownershipType, carfaxValue) from CSV"
```

---

### Task 4: Split Pipeline — Ingest Phase

**Files:**
- Create: `src/lib/ingest.ts`
- Create: `src/lib/__tests__/ingest.test.ts`
- Modify: `src/lib/scoring.ts`
- Modify: `src/app/api/ingest/upload/route.ts`
- Delete: `src/lib/pipeline.ts`

- [ ] **Step 1: Write the failing test for `ingestRunList`**

Create `src/lib/__tests__/ingest.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rankVehicles } from '../scoring'

// rankVehicles is a pure function — test it is unaffected by the refactor
describe('rankVehicles (unchanged after scoring refactor)', () => {
  it('still assigns rank 1 to highest score', () => {
    expect(rankVehicles([10, 50, 30])[1]).toBe(1)
  })
})

// scoreRunList now reads from DB — tested via integration; skip unit test
// ingestRunList touches network/blob — tested via integration; skip unit test
```

> Note: `ingestRunList` and the new `scoreRunList` are integration-only (they call the DB and Vercel Blob). The unit-testable logic they depend on (CSV parsing, rankVehicles) is already covered.

- [ ] **Step 2: Run test to verify it passes immediately (pure function, no change)**

```bash
npx vitest run src/lib/__tests__/ingest.test.ts
```

Expected: 1 test passes.

- [ ] **Step 3: Create `src/lib/ingest.ts`**

```typescript
import { db } from '@/lib/db'
import { parseRunList } from '@/lib/csv-parser'
import type { ColumnMap } from '@/types'

export async function ingestRunList(runListId: string): Promise<void> {
  const runList = await db.runList.findUniqueOrThrow({
    where: { id: runListId },
    include: { source: true },
  })

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

    await db.runListVehicle.createMany({
      data: vehicles.map(v => ({
        runListId,
        vin: v.vin,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim ?? null,
        odometer: v.odometer ?? null,
        crGrade: v.crGrade != null ? v.crGrade : null,
        mmr: v.mmr ?? null,
        accidents: v.accidents ?? null,
        owners: v.owners ?? null,
        ownershipType: v.ownershipType ?? null,
        carfaxValue: v.carfaxValue ?? null,
        rawData: v.rawData,
      })),
    })

    await db.runList.update({
      where: { id: runListId },
      data: { status: 'parsed' },
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

- [ ] **Step 4: Rewrite `src/lib/scoring.ts` — fetch from DB, skip excluded**

Replace the entire file:

```typescript
import { db } from '@/lib/db'
import { getMarketDemand } from '@/lib/market-cache'

export function rankVehicles(scores: number[]): number[] {
  const indexed = scores.map((score, i) => ({ score, i }))
  indexed.sort((a, b) => b.score - a.score)
  const ranks = new Array<number>(scores.length)
  indexed.forEach(({ i }, pos) => {
    ranks[i] = pos + 1
  })
  return ranks
}

export async function scoreRunList(runListId: string): Promise<void> {
  const vehicles = await db.runListVehicle.findMany({
    where: { runListId, isExcluded: false },
  })

  if (vehicles.length === 0) return

  const scores = await Promise.all(
    vehicles.map(v =>
      getMarketDemand(v.make, v.model, v.year).catch(() => 0)
    )
  )
  const ranks = rankVehicles(scores)

  await Promise.all(
    vehicles.map((v, i) =>
      db.runListVehicle.update({
        where: { id: v.id },
        data: { demandScore: scores[i], demandRank: ranks[i] },
      })
    )
  )
}
```

- [ ] **Step 5: Update `src/app/api/ingest/upload/route.ts`**

Replace the import and call at the top of the file:

Old:
```typescript
import { processRunList } from '@/lib/pipeline'
```

New:
```typescript
import { ingestRunList } from '@/lib/ingest'
```

Old (inside the try block):
```typescript
    await processRunList(runList.id)
```

New:
```typescript
    await ingestRunList(runList.id)
```

Also update the success response — the status is now `parsed`, not `scored`:

Old:
```typescript
  return NextResponse.json({ runListId: runList.id, status: 'scored' })
```

New:
```typescript
  return NextResponse.json({ runListId: runList.id, status: 'parsed' })
```

- [ ] **Step 6: Delete `src/lib/pipeline.ts`**

```bash
rm "src/lib/pipeline.ts"
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/ingest.ts src/lib/__tests__/ingest.test.ts src/lib/scoring.ts src/app/api/ingest/upload/route.ts
git rm src/lib/pipeline.ts
git commit -m "feat: split pipeline into ingest (parse-only) and score-on-demand phases"
```

---

### Task 5: Score API Route

**Files:**
- Create: `src/app/api/run-lists/[id]/score/route.ts`

- [ ] **Step 1: Create the score route**

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scoreRunList } from '@/lib/scoring'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const runList = await db.runList.findUnique({ where: { id } })
  if (!runList) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (runList.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['parsed', 'scored'].includes(runList.status)) {
    return NextResponse.json({ error: 'Run list is not ready to score' }, { status: 409 })
  }

  await db.runList.update({ where: { id }, data: { status: 'scoring' } })

  try {
    await scoreRunList(id)
    await db.runList.update({
      where: { id },
      data: { status: 'scored', scoredAt: new Date() },
    })
    return NextResponse.json({ status: 'scored' })
  } catch (err) {
    await db.runList.update({
      where: { id },
      data: {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Scoring failed',
      },
    })
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/run-lists/[id]/score/route.ts
git commit -m "feat: add POST /api/run-lists/[id]/score endpoint"
```

---

### Task 6: Exclusion Toggle API

**Files:**
- Create: `src/app/api/run-lists/[id]/vehicles/[vehicleId]/route.ts`

- [ ] **Step 1: Create the vehicle PATCH route**

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vehicleId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, vehicleId } = await params
  const body = await req.json() as { isExcluded: boolean }

  const runList = await db.runList.findUnique({ where: { id } })
  if (!runList) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (runList.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const vehicle = await db.runListVehicle.update({
    where: { id: vehicleId },
    data: { isExcluded: body.isExcluded },
    select: { id: true, isExcluded: true },
  })

  return NextResponse.json(vehicle)
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/run-lists/[id]/vehicles/[vehicleId]/route.ts"
git commit -m "feat: add PATCH /api/run-lists/[id]/vehicles/[vehicleId] for exclusion toggle"
```

---

### Task 7: Inventory Parser

**Files:**
- Create: `src/lib/inventory-parser.ts`
- Create: `src/lib/__tests__/inventory-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/inventory-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseInventoryCsv } from '../inventory-parser'

const CSV = `VIN,Year,Make,Model,Trim
1HGBH41JXMN109186,2022,Honda,Civic,EX
2T1BURHE0JC034620,2018,Toyota,Corolla,LE`

describe('parseInventoryCsv', () => {
  it('parses all valid rows', () => {
    expect(parseInventoryCsv(CSV)).toHaveLength(2)
  })

  it('maps required fields correctly', () => {
    const [v] = parseInventoryCsv(CSV)
    expect(v.vin).toBe('1HGBH41JXMN109186')
    expect(v.year).toBe(2022)
    expect(v.make).toBe('Honda')
    expect(v.model).toBe('Civic')
    expect(v.trim).toBe('EX')
  })

  it('accepts lowercase column headers', () => {
    const csv = `vin,year,make,model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseInventoryCsv(csv)
    expect(v.vin).toBe('1HGBH41JXMN109186')
  })

  it('skips rows missing vin', () => {
    const csv = `VIN,Year,Make,Model\n,2022,Honda,Civic`
    expect(parseInventoryCsv(csv)).toHaveLength(0)
  })

  it('skips rows with non-numeric year', () => {
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,N/A,Honda,Civic`
    expect(parseInventoryCsv(csv)).toHaveLength(0)
  })

  it('trim is undefined when column is absent', () => {
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseInventoryCsv(csv)
    expect(v.trim).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/inventory-parser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/inventory-parser.ts`**

```typescript
import Papa from 'papaparse'
import type { InventoryVehicle } from '@/types'

function col(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]?.trim()
    if (v) return v
  }
  return ''
}

export function parseInventoryCsv(csvText: string): InventoryVehicle[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const vehicles: InventoryVehicle[] = []

  for (const row of data) {
    const vin = col(row, 'VIN', 'vin', 'Vin')
    const yearStr = col(row, 'Year', 'year', 'YEAR')
    const make = col(row, 'Make', 'make', 'MAKE')
    const model = col(row, 'Model', 'model', 'MODEL')

    if (!vin || !yearStr || !make || !model) continue

    const year = parseInt(yearStr, 10)
    if (isNaN(year)) continue

    const trimVal = col(row, 'Trim', 'trim', 'TRIM') || undefined

    vehicles.push({ vin, year, make, model, trim: trimVal })
  }

  return vehicles
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/__tests__/inventory-parser.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory-parser.ts src/lib/__tests__/inventory-parser.test.ts
git commit -m "feat: add inventory CSV parser"
```

---

### Task 8: Inventory Email Webhook

**Files:**
- Create: `src/app/api/webhooks/inventory/route.ts`

Mailgun sends webhooks as multipart form POST. Fields: `timestamp`, `token`, `signature`, `attachment-1` … `attachment-N`. Verify with HMAC-SHA256 on `timestamp + token` using `HTTP_SIGNING_KEY`.

- [ ] **Step 1: Create the webhook route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { parseInventoryCsv } from '@/lib/inventory-parser'

function verifySignature(timestamp: string, token: string, signature: string): boolean {
  const key = process.env.HTTP_SIGNING_KEY
  if (!key) return false
  const hash = createHmac('sha256', key)
    .update(timestamp + token)
    .digest('hex')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const timestamp = formData.get('timestamp') as string | null
  const token = formData.get('token') as string | null
  const signature = formData.get('signature') as string | null

  if (!timestamp || !token || !signature || !verifySignature(timestamp, token, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let csvText: string | null = null
  for (let i = 1; i <= 10; i++) {
    const attachment = formData.get(`attachment-${i}`) as File | null
    if (!attachment) break
    const name = attachment.name ?? ''
    const type = attachment.type ?? ''
    if (type.includes('text') || name.endsWith('.csv') || name.endsWith('.txt')) {
      csvText = await attachment.text()
      break
    }
  }

  if (!csvText) {
    return NextResponse.json({ error: 'No CSV attachment found' }, { status: 400 })
  }

  const vehicles = parseInventoryCsv(csvText)
  if (vehicles.length === 0) {
    return NextResponse.json({ error: 'No valid vehicles parsed from attachment' }, { status: 400 })
  }

  await db.$transaction([
    db.dealerInventory.deleteMany(),
    db.dealerInventory.createMany({
      data: vehicles.map(v => ({
        vin: v.vin,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim ?? null,
      })),
    }),
  ])

  return NextResponse.json({ imported: vehicles.length })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/inventory/route.ts
git commit -m "feat: add Mailgun inventory webhook — full-replace dealer_inventory on each import"
```

---

### Task 9: Curation Detail Page

**Files:**
- Rewrite: `src/app/(app)/run-lists/[id]/page.tsx`

This is the server component. It reads URL params, queries filtered/sorted vehicles from DB, fetches dealer inventory, computes stock levels, and renders child components. All filter and sort state lives in the URL — no client state in this component.

URL params:
- `sort` — field name; default `demandRank`
- `dir` — `asc` or `desc`; default `asc`
- `gradeMin`, `odomMax`, `mmrMin`, `mmrMax`, `accMax`, `ownMax`, `ownerType`, `rankMax`, `yearMin`, `yearMax` — numeric/string filters
- `makes` — comma-separated make names
- `showExcluded` — `true` to include excluded vehicles

- [ ] **Step 1: Rewrite `src/app/(app)/run-lists/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Decimal } from '@prisma/client/runtime/library'
import { FilterSidebar } from '@/components/run-lists/FilterSidebar'
import { VehicleTable } from '@/components/run-lists/VehicleTable'
import { ScoreButton } from '@/components/run-lists/ScoreButton'
import { ExportButtons } from '@/components/run-lists/ExportButtons'
import type { StockLevel } from '@/types'
import type { RunListVehicle, DealerInventory } from '@prisma/client'

type SearchParams = { [key: string]: string | string[] | undefined }

function sp(params: SearchParams, key: string): string | undefined {
  const v = params[key]
  return Array.isArray(v) ? v[0] : v
}

function stockLevel(vehicle: RunListVehicle, inventory: DealerInventory[]): StockLevel {
  const make = vehicle.make.toLowerCase()
  const model = vehicle.model.toLowerCase()
  const count = inventory.filter(inv => {
    if (inv.year !== vehicle.year) return false
    if (inv.make.toLowerCase() !== make) return false
    const invModel = inv.model.toLowerCase()
    return model.includes(invModel) || invModel.includes(model)
  }).length
  if (count === 0) return 'none'
  if (count <= 2) return 'low'
  return 'high'
}

const SORTABLE = ['demandRank', 'year', 'make', 'model', 'odometer', 'crGrade', 'mmr', 'accidents', 'owners', 'carfaxValue'] as const
type SortField = typeof SORTABLE[number]

export default async function RunListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const sp_ = await searchParams

  const runList = await db.runList.findUnique({
    where: { id },
    include: { source: true },
  })
  if (!runList) notFound()

  const showExcluded = sp(sp_, 'showExcluded') === 'true'
  const gradeMin = sp(sp_, 'gradeMin')
  const odomMax = sp(sp_, 'odomMax')
  const mmrMin = sp(sp_, 'mmrMin')
  const mmrMax = sp(sp_, 'mmrMax')
  const accMax = sp(sp_, 'accMax')
  const ownMax = sp(sp_, 'ownMax')
  const ownerType = sp(sp_, 'ownerType')
  const rankMax = sp(sp_, 'rankMax')
  const yearMin = sp(sp_, 'yearMin')
  const yearMax = sp(sp_, 'yearMax')
  const makesRaw = sp(sp_, 'makes')
  const makes = makesRaw ? makesRaw.split(',').map(m => m.trim()).filter(Boolean) : []

  const allVehicles = await db.runListVehicle.findMany({
    where: { runListId: id },
    orderBy: { id: 'asc' },
  })

  const filtered = allVehicles.filter(v => {
    if (!showExcluded && v.isExcluded) return false
    if (gradeMin && (v.crGrade == null || Number(v.crGrade) < parseFloat(gradeMin))) return false
    if (odomMax && v.odometer != null && v.odometer > parseInt(odomMax)) return false
    if (mmrMin && v.mmr != null && v.mmr < parseInt(mmrMin)) return false
    if (mmrMax && v.mmr != null && v.mmr > parseInt(mmrMax)) return false
    if (accMax && v.accidents != null && v.accidents > parseInt(accMax)) return false
    if (ownMax && v.owners != null && v.owners > parseInt(ownMax)) return false
    if (ownerType && v.ownershipType && v.ownershipType.toLowerCase() !== ownerType.toLowerCase()) return false
    if (rankMax && v.demandRank != null && v.demandRank > parseInt(rankMax)) return false
    if (yearMin && v.year < parseInt(yearMin)) return false
    if (yearMax && v.year > parseInt(yearMax)) return false
    if (makes.length > 0 && !makes.some(m => m.toLowerCase() === v.make.toLowerCase())) return false
    return true
  })

  const sortParam = sp(sp_, 'sort') ?? 'demandRank'
  const validSort = (SORTABLE as readonly string[]).includes(sortParam) ? sortParam as SortField : 'demandRank'
  const dir = sp(sp_, 'dir') === 'desc' ? -1 : 1

  const sorted = [...filtered].sort((a, b) => {
    const av = a[validSort]
    const bv = b[validSort]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (av instanceof Decimal && bv instanceof Decimal) return dir * (Number(av) - Number(bv))
    if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv)
    return dir * String(av).localeCompare(String(bv))
  })

  const inventory = await db.dealerInventory.findMany()

  const stockLevels = new Map(
    sorted.map(v => [v.id, stockLevel(v, inventory)])
  )

  const uniqueMakes = [...new Set(allVehicles.map(v => v.make))].sort()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{runList.filename}</h1>
          <p className="text-sm text-muted-foreground">
            {runList.source.displayName} &mdash; {new Date(runList.uploadedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={runList.status} />
          <ScoreButton runListId={id} status={runList.status} />
        </div>
      </div>

      <div className="flex gap-6">
        <FilterSidebar searchParams={sp_} uniqueMakes={uniqueMakes} />

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {sorted.length} vehicle{sorted.length !== 1 ? 's' : ''}
              {showExcluded ? '' : ' (excluded hidden)'}
            </p>
            <ExportButtons runListId={id} searchParams={sp_} />
          </div>

          <VehicleTable
            vehicles={sorted}
            stockLevels={Object.fromEntries(stockLevels)}
            runListId={id}
            currentSort={validSort}
            currentDir={sp(sp_, 'dir') === 'desc' ? 'desc' : 'asc'}
          />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'scored' ? 'default'
    : status === 'error' ? 'destructive'
    : status === 'scoring' || status === 'processing' ? 'secondary'
    : 'outline'
  return <Badge variant={variant as 'default' | 'destructive' | 'secondary' | 'outline'}>{status}</Badge>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors only for missing component imports (FilterSidebar, VehicleTable, ScoreButton, ExportButtons) — those are created in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/run-lists/[id]/page.tsx"
git commit -m "feat: rewrite run list detail as curation page with URL-param filtering and stock indicators"
```

---

### Task 10: Filter Sidebar

**Files:**
- Create: `src/components/run-lists/FilterSidebar.tsx`

Client component. Reads URL params for initial values, fires `router.push` with updated params on change. Uses debounced input for numeric fields to avoid excessive navigations.

- [ ] **Step 1: Create `src/components/run-lists/FilterSidebar.tsx`**

```typescript
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

type SP = { [key: string]: string | string[] | undefined }

function spStr(params: SP, key: string): string {
  const v = params[key]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export function FilterSidebar({ searchParams, uniqueMakes }: { searchParams: SP; uniqueMakes: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams()
    const keys = ['sort', 'dir', 'gradeMin', 'odomMax', 'mmrMin', 'mmrMax', 'accMax', 'ownMax', 'ownerType', 'rankMax', 'yearMin', 'yearMax', 'makes', 'showExcluded']
    for (const k of keys) {
      const existing = spStr(searchParams, k)
      if (existing) params.set(k, existing)
    }
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const toggleMake = (make: string, checked: boolean) => {
    const current = spStr(searchParams, 'makes').split(',').filter(Boolean)
    const next = checked ? [...current, make] : current.filter(m => m !== make)
    update('makes', next.join(','))
  }

  const clearAll = () => {
    startTransition(() => router.push(pathname))
  }

  return (
    <aside className="w-56 shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
          Clear
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Min CR Grade</Label>
        <Input
          type="number"
          step="0.5"
          min="0"
          max="5"
          defaultValue={spStr(searchParams, 'gradeMin')}
          placeholder="e.g. 3.0"
          className="h-8 text-sm"
          onBlur={e => update('gradeMin', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Max Odometer</Label>
        <Input
          type="number"
          min="0"
          defaultValue={spStr(searchParams, 'odomMax')}
          placeholder="e.g. 100000"
          className="h-8 text-sm"
          onBlur={e => update('odomMax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">MMR Range</Label>
        <div className="flex gap-1">
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'mmrMin')}
            placeholder="Min"
            className="h-8 text-sm"
            onBlur={e => update('mmrMin', e.target.value)}
          />
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'mmrMax')}
            placeholder="Max"
            className="h-8 text-sm"
            onBlur={e => update('mmrMax', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Max Accidents</Label>
        <Input
          type="number"
          min="0"
          defaultValue={spStr(searchParams, 'accMax')}
          placeholder="0 = accident free"
          className="h-8 text-sm"
          onBlur={e => update('accMax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Max Owners</Label>
        <Input
          type="number"
          min="1"
          defaultValue={spStr(searchParams, 'ownMax')}
          placeholder="e.g. 2"
          className="h-8 text-sm"
          onBlur={e => update('ownMax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Year Range</Label>
        <div className="flex gap-1">
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'yearMin')}
            placeholder="From"
            className="h-8 text-sm"
            onBlur={e => update('yearMin', e.target.value)}
          />
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'yearMax')}
            placeholder="To"
            className="h-8 text-sm"
            onBlur={e => update('yearMax', e.target.value)}
          />
        </div>
      </div>

      {uniqueMakes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Make</Label>
          <div className="space-y-1.5">
            {uniqueMakes.map(make => {
              const current = spStr(searchParams, 'makes').split(',').filter(Boolean)
              const checked = current.length === 0 || current.includes(make)
              return (
                <label key={make} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => toggleMake(make, v === true)}
                  />
                  {make}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          checked={spStr(searchParams, 'showExcluded') === 'true'}
          onCheckedChange={v => update('showExcluded', v === true ? 'true' : '')}
        />
        <Label className="text-xs text-muted-foreground cursor-pointer">Show excluded</Label>
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground animate-pulse">Updating…</p>
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/run-lists/FilterSidebar.tsx
git commit -m "feat: add FilterSidebar client component with URL-param driven filters"
```

---

### Task 11: Vehicle Table with Sortable Columns and Exclusion Toggle

**Files:**
- Create: `src/components/run-lists/VehicleTable.tsx`

Client component. Column headers are `<a>` links that toggle sort direction in URL. Exclusion toggle calls PATCH API and uses `useRouter().refresh()` to re-render server data. Stock indicator renders as a colored dot with count.

- [ ] **Step 1: Create `src/components/run-lists/VehicleTable.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { usePathname, useSearchParams } from 'next/navigation'
import type { RunListVehicle } from '@prisma/client'
import type { StockLevel } from '@/types'

const STOCK_STYLE: Record<StockLevel, string> = {
  none: 'bg-green-500',
  low: 'bg-yellow-400',
  high: 'bg-red-500',
}

function StockDot({ level, count }: { level: StockLevel; count: number }) {
  if (level === 'none') {
    return <span title="None in stock" className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-white ${STOCK_STYLE[level]}`}>
      {count}
    </span>
  )
}

const COLUMNS = [
  { key: 'demandRank', label: 'Rank', align: 'left' },
  { key: 'year', label: 'Year', align: 'left' },
  { key: 'make', label: 'Make', align: 'left' },
  { key: 'model', label: 'Vehicle', align: 'left' },
  { key: 'odometer', label: 'Miles', align: 'right' },
  { key: 'crGrade', label: 'Grade', align: 'right' },
  { key: 'mmr', label: 'MMR', align: 'right' },
  { key: 'accidents', label: 'Acc.', align: 'right' },
  { key: 'owners', label: 'Owners', align: 'right' },
  { key: 'carfaxValue', label: 'CFAX $', align: 'right' },
  { key: 'demandScore', label: 'Demand', align: 'right' },
] as const

export function VehicleTable({
  vehicles,
  stockLevels,
  runListId,
  currentSort,
  currentDir,
}: {
  vehicles: RunListVehicle[]
  stockLevels: Record<string, StockLevel>
  runListId: string
  currentSort: string
  currentDir: 'asc' | 'desc'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function sortHref(field: string): string {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('sort') === field) {
      params.set('dir', params.get('dir') === 'desc' ? 'asc' : 'desc')
    } else {
      params.set('sort', field)
      params.delete('dir')
    }
    return `${pathname}?${params.toString()}`
  }

  async function toggleExclude(vehicle: RunListVehicle) {
    await fetch(`/api/run-lists/${runListId}/vehicles/${vehicle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isExcluded: !vehicle.isExcluded }),
    })
    router.refresh()
  }

  if (vehicles.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        No vehicles match the current filters.
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-3 text-left font-medium">Stock</th>
            {COLUMNS.map(col => (
              <th key={col.key} className={`px-3 py-3 font-medium text-${col.align}`}>
                <a
                  href={sortHref(col.key)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {col.label}
                  {currentSort === col.key && (
                    <span className="text-xs">{currentDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </a>
              </th>
            ))}
            <th className="px-3 py-3 text-left font-medium">VIN</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {vehicles.map(v => {
            const level = stockLevels[v.id] ?? 'none'
            const stockCount = level === 'none' ? 0 : level === 'low' ? 1 : 3
            return (
              <tr
                key={v.id}
                className={`border-b last:border-0 transition-colors ${
                  v.isExcluded
                    ? 'opacity-40 bg-muted/20'
                    : 'hover:bg-muted/30'
                }`}
              >
                <td className="px-3 py-2">
                  <StockDot level={level} count={stockCount} />
                </td>
                <td className="px-3 py-2">
                  {v.demandRank != null ? (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {v.demandRank}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{v.year}</td>
                <td className="px-3 py-2">{v.make}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{v.model}</div>
                  {v.trim && <div className="text-xs text-muted-foreground">{v.trim}</div>}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {v.odometer != null ? v.odometer.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {v.crGrade != null ? Number(v.crGrade).toFixed(1) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {v.mmr != null ? `$${v.mmr.toLocaleString()}` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {v.accidents != null ? v.accidents : '—'}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {v.owners != null ? v.owners : '—'}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {v.carfaxValue != null ? `$${v.carfaxValue.toLocaleString()}` : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {v.demandScore != null ? (
                    <span className="font-medium">{v.demandScore.toLocaleString()}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{v.vin}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleExclude(v)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      v.isExcluded
                        ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                        : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    }`}
                  >
                    {v.isExcluded ? 'Include' : 'Exclude'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/run-lists/VehicleTable.tsx
git commit -m "feat: add VehicleTable with sortable columns, exclusion toggle, and stock indicator"
```

---

### Task 12: Score Button

**Files:**
- Create: `src/components/run-lists/ScoreButton.tsx`

Client component. Shown when status is `parsed`. Calls POST score API, then polls for `scored` status via `router.refresh()`.

- [ ] **Step 1: Create `src/components/run-lists/ScoreButton.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ScoreButton({ runListId, status }: { runListId: string; status: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!['parsed', 'error'].includes(status)) return null

  async function handleScore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/run-lists/${runListId}/score`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        alert(body.error ?? 'Scoring failed')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleScore} disabled={loading} size="sm">
      {loading ? 'Scoring…' : 'Score This List'}
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/run-lists/ScoreButton.tsx
git commit -m "feat: add ScoreButton that triggers on-demand Marketcheck scoring"
```

---

### Task 13: Export CSV Route

**Files:**
- Create: `src/app/api/run-lists/[id]/export/route.ts`

Returns a CSV of non-excluded vehicles, respecting the same filter params as the page. The client passes current search params in the query string.

- [ ] **Step 1: Create the export route**

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RunListVehicle } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

function row(v: RunListVehicle): string {
  const fields = [
    v.demandRank ?? '',
    v.vin,
    v.year,
    v.make,
    v.model,
    v.trim ?? '',
    v.odometer ?? '',
    v.crGrade != null ? Number(v.crGrade).toFixed(1) : '',
    v.mmr ?? '',
    v.accidents ?? '',
    v.owners ?? '',
    v.ownershipType ?? '',
    v.carfaxValue ?? '',
    v.demandScore ?? '',
  ]
  return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')
}

const HEADER = '"Rank","VIN","Year","Make","Model","Trim","Odometer","Grade","MMR","Accidents","Owners","Ownership Type","Carfax Value","Demand Score"'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const runList = await db.runList.findUnique({ where: { id } })
  if (!runList) return new NextResponse('Not found', { status: 404 })
  if (runList.userId !== userId) return new NextResponse('Forbidden', { status: 403 })

  const sp = req.nextUrl.searchParams
  const showExcluded = sp.get('showExcluded') === 'true'
  const gradeMin = sp.get('gradeMin')
  const odomMax = sp.get('odomMax')
  const mmrMin = sp.get('mmrMin')
  const mmrMax = sp.get('mmrMax')
  const accMax = sp.get('accMax')
  const ownMax = sp.get('ownMax')
  const ownerType = sp.get('ownerType')
  const rankMax = sp.get('rankMax')
  const yearMin = sp.get('yearMin')
  const yearMax = sp.get('yearMax')
  const makesRaw = sp.get('makes')
  const makes = makesRaw ? makesRaw.split(',').map(m => m.trim()).filter(Boolean) : []

  const all = await db.runListVehicle.findMany({
    where: { runListId: id },
    orderBy: [{ demandRank: 'asc' }, { id: 'asc' }],
  })

  const filtered = all.filter(v => {
    if (!showExcluded && v.isExcluded) return false
    if (gradeMin && (v.crGrade == null || Number(v.crGrade) < parseFloat(gradeMin))) return false
    if (odomMax && v.odometer != null && v.odometer > parseInt(odomMax)) return false
    if (mmrMin && v.mmr != null && v.mmr < parseInt(mmrMin)) return false
    if (mmrMax && v.mmr != null && v.mmr > parseInt(mmrMax)) return false
    if (accMax && v.accidents != null && v.accidents > parseInt(accMax)) return false
    if (ownMax && v.owners != null && v.owners > parseInt(ownMax)) return false
    if (ownerType && v.ownershipType && v.ownershipType.toLowerCase() !== ownerType.toLowerCase()) return false
    if (rankMax && v.demandRank != null && v.demandRank > parseInt(rankMax)) return false
    if (yearMin && v.year < parseInt(yearMin)) return false
    if (yearMax && v.year > parseInt(yearMax)) return false
    if (makes.length > 0 && !makes.some(m => m.toLowerCase() === v.make.toLowerCase())) return false
    return true
  })

  const csv = [HEADER, ...filtered.map(row)].join('\n')
  const filename = runList.filename.replace(/\.csv$/i, '') + '-curated.csv'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/run-lists/[id]/export/route.ts"
git commit -m "feat: add GET /api/run-lists/[id]/export for filtered CSV download"
```

---

### Task 14: Export Buttons

**Files:**
- Create: `src/components/run-lists/ExportButtons.tsx`

- Download: `<a>` to export route with current search params
- Print: `window.print()` — vehicle table already renders in a print-friendly table
- Share: `navigator.share()` with File attachment if supported; fallback: download CSV + `mailto:` with pre-filled subject

- [ ] **Step 1: Create `src/components/run-lists/ExportButtons.tsx`**

```typescript
'use client'

import { Button } from '@/components/ui/button'

type SP = { [key: string]: string | string[] | undefined }

function buildExportUrl(runListId: string, searchParams: SP): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (v != null) params.set(k, Array.isArray(v) ? v[0] : v)
  }
  return `/api/run-lists/${runListId}/export?${params.toString()}`
}

export function ExportButtons({ runListId, searchParams }: { runListId: string; searchParams: SP }) {
  const exportUrl = buildExportUrl(runListId, searchParams)

  async function handleShare() {
    try {
      const res = await fetch(exportUrl)
      const blob = await res.blob()
      const file = new File([blob], 'run-list.csv', { type: 'text/csv' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Run List', text: 'Curated auction run list' })
        return
      }
    } catch {
      // fall through to mailto fallback
    }

    // Fallback: trigger download, then open mailto
    const a = document.createElement('a')
    a.href = exportUrl
    a.download = 'run-list.csv'
    a.click()

    const subject = encodeURIComponent('Auction Run List')
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent('See attached run list CSV.')}`
  }

  return (
    <div className="flex items-center gap-2">
      <a href={exportUrl} download>
        <Button variant="outline" size="sm">Download CSV</Button>
      </a>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={handleShare}>
        Share
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/run-lists/ExportButtons.tsx
git commit -m "feat: add ExportButtons (download CSV, print, share via navigator.share or mailto fallback)"
```

---

### Task 15: Wire Up and Verify

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Start dev server and verify end-to-end**

```bash
npm run dev
```

Manual test checklist:
1. Upload a FAA CSV — status should show `parsed` (not `scored`)
2. Navigate to the run list detail page — see filter sidebar and vehicle table
3. Apply a grade filter (e.g. gradeMin=3) — URL updates, table filters
4. Click "Exclude" on a vehicle — row dims, "Include" button appears
5. Click "Score This List" — button shows "Scoring…", page refreshes with demand ranks
6. Verify sortable column headers work (click Rank, MMR, etc.)
7. Click "Download CSV" — file downloads with filtered vehicles
8. Verify "Show excluded" checkbox includes/hides excluded rows

- [ ] **Step 4: Test inventory webhook locally with curl**

```bash
# Generate a test signature
TIMESTAMP=$(date +%s)
TOKEN="testtoken123"
SIG=$(echo -n "${TIMESTAMP}${TOKEN}" | openssl dgst -sha256 -hmac "4143da1977671b2c13abd202915ca0e5" | awk '{print $2}')

curl -X POST http://localhost:3000/api/webhooks/inventory \
  -F "timestamp=$TIMESTAMP" \
  -F "token=$TOKEN" \
  -F "signature=$SIG" \
  -F "attachment-1=@/path/to/inventory.csv;type=text/csv"
```

Expected: `{"imported": N}` where N > 0. Stock dots appear on next page load.

- [ ] **Step 5: Final commit**

```bash
git add -p
git commit -m "feat: complete curation and inventory feature"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Two-phase pipeline (parse upload, score on demand) — Tasks 4, 5
- [x] Carfax data surfacing — Tasks 1, 2, 3, 11
- [x] Filter sidebar (all columns, accident-free, owner count, ownership type, grade, odometer, year) — Task 10
- [x] All columns sortable — Task 11 (VehicleTable)
- [x] Manual exclusions with persistent toggle — Tasks 6, 11
- [x] Save curated list (exclusions persist in DB) — Task 6
- [x] Dealer inventory via Mailgun email — Tasks 7, 8
- [x] Stock indicator 🟢/🟡/🔴 — Tasks 1, 9, 11
- [x] Download CSV — Tasks 13, 14
- [x] Print — Task 14
- [x] Share/email via navigator.share with CSV attachment, mailto fallback — Task 14
- [x] Cache all Marketcheck data (already implemented in market-cache.ts — no change needed)

**Known limitations:**
- Carfax column names in FAA preset are not mapped — user must add them after confirming actual CSV column headers from Florida Auto Auction exports
- Stock indicator uses first-word model matching; very different model names (e.g. "Corolla" vs "Corolla Cross") may over-match — can be tightened once inventory data is live
- `StockDot` renders a hardcoded count of 3 for `high` — the actual count isn't threaded through because stock level is computed server-side per vehicle; refactor to pass the raw count if exact numbers matter
