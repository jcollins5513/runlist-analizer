# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Run List Analyzer — a Next.js App Router app with Clerk auth, Neon Postgres (Prisma), Upstash Redis, Vercel Blob, auction source presets, and all page skeletons deployed to Vercel.

**Architecture:** Next.js App Router with a route group `(app)` for authenticated pages behind a shared sidebar layout. All infrastructure clients (db, redis, blob) are singletons in `src/lib/`. Prisma schema defines all six tables. Built-in auction source presets (Manheim, ADESA) are seeded on first deploy.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Clerk, Prisma, Neon Postgres, Upstash Redis, Vercel Blob, Vitest, Testing Library

---

## File Map

```
src/
  app/
    layout.tsx                          # Root layout — ClerkProvider + html shell
    page.tsx                            # Redirect to /dashboard or /sign-in
    sign-in/[[...sign-in]]/page.tsx     # Clerk SignIn component
    sign-up/[[...sign-up]]/page.tsx     # Clerk SignUp component
    (app)/
      layout.tsx                        # Authenticated layout — sidebar + main
      dashboard/page.tsx                # Dashboard skeleton
      run-lists/page.tsx                # Run lists skeleton
      run-lists/[id]/page.tsx           # Run list detail skeleton
      sources/page.tsx                  # Sources skeleton
      settings/page.tsx                 # Settings skeleton
  components/
    nav/
      Sidebar.tsx                       # Sidebar nav with UserButton
  lib/
    db.ts                               # Prisma singleton
    redis.ts                            # Upstash Redis singleton
    blob.ts                             # Vercel Blob re-export
    source-presets.ts                   # Built-in auction source column maps
    __tests__/
      source-presets.test.ts            # Vitest tests for presets
  types/
    index.ts                            # Shared TypeScript types
    __tests__/
      types.test.ts                     # Type shape tests
  test/
    setup.ts                            # Vitest + Testing Library setup
middleware.ts                           # Clerk route protection
prisma/
  schema.prisma                         # All six tables
  seed.ts                               # Seed built-in auction sources
vitest.config.ts                        # Vitest configuration
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/globals.css`

- [ ] **Step 1: Run create-next-app in the project directory**

```bash
cd "c:/Users/justi/runlist analizer"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected output ends with: `Success! Created your project`

- [ ] **Step 2: Install production dependencies**

```bash
npm install @clerk/nextjs @prisma/client @upstash/redis @vercel/blob papaparse lucide-react
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/papaparse
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted for style, choose Default. When prompted for base color, choose Slate.

- [ ] **Step 5: Add shadcn components**

```bash
npx shadcn@latest add button card table badge input slider select dialog sheet separator
```

- [ ] **Step 6: Initialize Prisma**

```bash
npx prisma init
```

- [ ] **Step 7: Commit scaffold**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with deps"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Write vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Write test setup file**

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to the `"scripts"` object:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 4: Run vitest to verify it starts**

```bash
npm test
```

Expected: Vitest starts in watch mode with "No test files found"

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json
git commit -m "feat: configure vitest with jsdom and testing-library"
```

---

## Task 3: Create Shared Types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/types/__tests__/types.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type { NormalizedVehicle, ColumnMap, FilterState, MarketData } from '../index'

describe('NormalizedVehicle', () => {
  it('has required fields vin, year, make, model, rawData', () => {
    const v: NormalizedVehicle = {
      vin: '1HGBH41JXMN109186',
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      rawData: { Vin: '1HGBH41JXMN109186' },
    }
    expectTypeOf(v.vin).toBeString()
    expectTypeOf(v.year).toBeNumber()
    expectTypeOf(v.rawData).toMatchTypeOf<Record<string, string>>()
  })

  it('has optional fields trim, odometer, crGrade, mmr', () => {
    const v: NormalizedVehicle = {
      vin: '1HGBH41JXMN109186',
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      rawData: {},
    }
    expectTypeOf(v.trim).toEqualTypeOf<string | undefined>()
    expectTypeOf(v.crGrade).toEqualTypeOf<number | undefined>()
  })
})

describe('ColumnMap', () => {
  it('requires vin, year, make, model as strings', () => {
    const map: ColumnMap = { vin: 'Vin', year: 'Year', make: 'Make', model: 'Model' }
    expectTypeOf(map.vin).toBeString()
  })
})

describe('FilterState', () => {
  it('has all filter fields', () => {
    const f: FilterState = {
      crGradeMin: 0,
      crGradeMax: 5,
      mmrMin: 0,
      mmrMax: 100000,
      demandRankMax: 25,
      makes: [],
      odometerMax: 150000,
    }
    expectTypeOf(f.makes).toEqualTypeOf<string[]>()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/types/__tests__/types.test.ts
```

Expected: FAIL — "Cannot find module '../index'"

- [ ] **Step 3: Write the types**

```typescript
// src/types/index.ts

export interface NormalizedVehicle {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
  odometer?: number
  crGrade?: number
  mmr?: number
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
  [key: string]: string | undefined
}

export interface FilterState {
  crGradeMin: number
  crGradeMax: number
  mmrMin: number
  mmrMax: number
  demandRankMax: number
  makes: string[]
  odometerMax: number
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/types/__tests__/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Create Source Presets

**Files:**
- Create: `src/lib/source-presets.ts`
- Create: `src/lib/__tests__/source-presets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/source-presets.test.ts
import { describe, it, expect } from 'vitest'
import { SOURCE_PRESETS, getPresetByName } from '../source-presets'

describe('SOURCE_PRESETS', () => {
  it('includes manheim', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')
    expect(manheim).toBeDefined()
  })

  it('manheim maps vin to "Vin"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.vin).toBe('Vin')
  })

  it('manheim maps crGrade to "Condition Report Grade"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.crGrade).toBe('Condition Report Grade')
  })

  it('manheim maps mmr to "MMR"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.mmr).toBe('MMR')
  })

  it('manheim maps odometer to "Odometer Value"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.odometer).toBe('Odometer Value')
  })

  it('all presets have name, displayName, and required column fields', () => {
    for (const preset of SOURCE_PRESETS) {
      expect(preset.name).toBeTruthy()
      expect(preset.displayName).toBeTruthy()
      expect(preset.columnMap.vin).toBeTruthy()
      expect(preset.columnMap.year).toBeTruthy()
      expect(preset.columnMap.make).toBeTruthy()
      expect(preset.columnMap.model).toBeTruthy()
    }
  })
})

describe('getPresetByName', () => {
  it('returns the preset for a known name', () => {
    const preset = getPresetByName('manheim')
    expect(preset).toBeDefined()
    expect(preset!.name).toBe('manheim')
  })

  it('returns undefined for an unknown name', () => {
    expect(getPresetByName('unknown-source-xyz')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/__tests__/source-presets.test.ts
```

Expected: FAIL — "Cannot find module '../source-presets'"

- [ ] **Step 3: Write the source presets**

```typescript
// src/lib/source-presets.ts
import type { ColumnMap } from '@/types'

export interface SourcePreset {
  name: string
  displayName: string
  columnMap: ColumnMap
}

export const SOURCE_PRESETS: SourcePreset[] = [
  {
    name: 'manheim',
    displayName: 'Manheim',
    columnMap: {
      vin: 'Vin',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      trim: 'Trim',
      odometer: 'Odometer Value',
      crGrade: 'Condition Report Grade',
      mmr: 'MMR',
    },
  },
  {
    name: 'adesa',
    displayName: 'ADESA',
    columnMap: {
      vin: 'VIN',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      trim: 'Series',
      odometer: 'Mileage',
      crGrade: 'CR Score',
      mmr: 'Book Value',
    },
  },
  {
    name: 'ove',
    displayName: 'OVE',
    columnMap: {
      vin: 'VIN',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      trim: 'Trim',
      odometer: 'Miles',
      crGrade: 'Condition',
      mmr: 'MMR',
    },
  },
]

export function getPresetByName(name: string): SourcePreset | undefined {
  return SOURCE_PRESETS.find(p => p.name === name)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/__tests__/source-presets.test.ts
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/source-presets.ts src/lib/__tests__/source-presets.test.ts
git commit -m "feat: add auction source presets for Manheim, ADESA, OVE"
```

---

## Task 5: Define Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace prisma/schema.prisma with the full schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model AuctionSource {
  id          String   @id @default(uuid())
  name        String   @unique
  displayName String
  columnMap   Json
  isPreset    Boolean  @default(false)
  createdAt   DateTime @default(now())

  runLists RunList[]
  emails   AuctionSourceEmail[]

  @@map("auction_sources")
}

model AuctionSourceEmail {
  id           String        @id @default(uuid())
  emailAddress String        @unique
  sourceId     String
  source       AuctionSource @relation(fields: [sourceId], references: [id])

  @@map("auction_source_emails")
}

model RunList {
  id           String    @id @default(uuid())
  userId       String
  sourceId     String
  source       AuctionSource @relation(fields: [sourceId], references: [id])
  blobUrl      String
  filename     String
  status       String    @default("pending")
  errorMessage String?
  uploadedAt   DateTime  @default(now())
  scoredAt     DateTime?

  vehicles RunListVehicle[]

  @@map("run_lists")
}

model RunListVehicle {
  id          String   @id @default(uuid())
  runListId   String
  runList     RunList  @relation(fields: [runListId], references: [id], onDelete: Cascade)
  vin         String
  year        Int
  make        String
  model       String
  trim        String?
  odometer    Int?
  crGrade     Decimal? @db.Decimal(3, 1)
  mmr         Int?
  demandScore Int?
  demandRank  Int?
  rawData     Json

  @@map("run_list_vehicles")
}

model MarketCache {
  id              String   @id @default(uuid())
  make            String
  model           String
  year            Int
  listingCount    Int
  demandScore     Int
  lastRefreshedAt DateTime @default(now())

  @@unique([make, model, year])
  @@map("market_cache")
}

model FilterPreset {
  id        String   @id @default(uuid())
  userId    String
  name      String
  filters   Json
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("filter_presets")
}
```

- [ ] **Step 2: Commit the schema**

```bash
git add prisma/schema.prisma
git commit -m "feat: define prisma schema — all six tables"
```

---

## Task 6: Set Up Infrastructure Clients

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/redis.ts`
- Create: `src/lib/blob.ts`
- Create: `.env.local` (local only, not committed)

- [ ] **Step 1: Create .env.local with placeholder keys**

Create the file `.env.local` in the project root:

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
CLERK_SECRET_KEY=sk_test_replace_me
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Neon Postgres
DATABASE_URL=postgresql://replace_me

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://replace_me.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace_me

# Marketcheck
MARKETCHECK_API_KEY=replace_me

# Vercel Cron secret (any random string, used to secure the cron endpoint)
CRON_SECRET=replace_me
```

Add `.env.local` to `.gitignore` — verify it is already listed (create-next-app adds it).

- [ ] **Step 2: Write Prisma client singleton**

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 3: Write Upstash Redis singleton**

```typescript
// src/lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
```

- [ ] **Step 4: Write Vercel Blob re-export**

```typescript
// src/lib/blob.ts
export { put, del, list } from '@vercel/blob'
```

- [ ] **Step 5: Commit clients**

```bash
git add src/lib/db.ts src/lib/redis.ts src/lib/blob.ts
git commit -m "feat: add db, redis, blob singleton clients"
```

---

## Task 7: Create Prisma Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the seed script**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { SOURCE_PRESETS } from '../src/lib/source-presets'

const prisma = new PrismaClient()

async function main() {
  for (const preset of SOURCE_PRESETS) {
    await prisma.auctionSource.upsert({
      where: { name: preset.name },
      update: {
        displayName: preset.displayName,
        columnMap: preset.columnMap,
      },
      create: {
        name: preset.name,
        displayName: preset.displayName,
        columnMap: preset.columnMap,
        isPreset: true,
      },
    })
    console.log(`Seeded: ${preset.displayName}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Add seed config to package.json**

Add inside the `package.json` root object (not inside `scripts`):

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Also add `ts-node` and `tsconfig-paths` as dev dependencies — `tsconfig-paths` is required so ts-node resolves the `@/*` alias used inside `source-presets.ts`:

```bash
npm install -D ts-node tsconfig-paths
```

- [ ] **Step 3: Commit seed**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat: add prisma seed for built-in auction sources"
```

---

## Task 8: Configure Clerk Auth

**Files:**
- Create: `middleware.ts`
- Create: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Write Clerk middleware**

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/ingest/email(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

Note: `/api/ingest/email` is public because Mailgun webhooks cannot send a Clerk session cookie.

- [ ] **Step 2: Write sign-in page**

```typescript
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn />
    </div>
  )
}
```

- [ ] **Step 3: Write sign-up page**

```typescript
// src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp />
    </div>
  )
}
```

- [ ] **Step 4: Commit auth setup**

```bash
git add middleware.ts src/app/sign-in/ src/app/sign-up/
git commit -m "feat: configure clerk auth with middleware and sign-in/up pages"
```

---

## Task 9: Create Root Layout and App Shell

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/nav/Sidebar.tsx`

- [ ] **Step 1: Update root layout with ClerkProvider**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Run List Analyzer',
  description: 'Auction run list scoring powered by market demand data',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 2: Update root page to redirect**

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function RootPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')
  redirect('/sign-in')
}
```

- [ ] **Step 3: Create Sidebar component**

```typescript
// src/components/nav/Sidebar.tsx
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { LayoutDashboard, List, Database, Settings } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/run-lists', label: 'Run Lists', icon: List },
  { href: '/sources', label: 'Sources', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen border-r bg-background flex flex-col shrink-0">
      <div className="p-4">
        <p className="text-sm font-semibold tracking-tight">Run List Analyzer</p>
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create authenticated app layout**

```typescript
// src/app/(app)/layout.tsx
import { Sidebar } from '@/components/nav/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Commit layout**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/"(app)"/layout.tsx src/components/nav/Sidebar.tsx
git commit -m "feat: add root layout, clerk provider, app shell with sidebar"
```

---

## Task 10: Create Page Skeletons

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/run-lists/page.tsx`
- Create: `src/app/(app)/run-lists/[id]/page.tsx`
- Create: `src/app/(app)/sources/page.tsx`
- Create: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Dashboard skeleton**

```typescript
// src/app/(app)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Recent activity and market cache status</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Run Lists This Month', 'Vehicles Analyzed', 'Market Cache Age'].map((label) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold mt-1">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run lists skeleton**

```typescript
// src/app/(app)/run-lists/page.tsx
export default function RunListsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Run Lists</h1>
          <p className="text-sm text-muted-foreground">All uploaded auction run lists</p>
        </div>
        <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md">
          Upload Run List
        </button>
      </div>
      <div className="rounded-lg border">
        <div className="p-8 text-center text-sm text-muted-foreground">
          No run lists yet. Upload a CSV to get started.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run list detail skeleton**

```typescript
// src/app/(app)/run-lists/[id]/page.tsx
export default function RunListDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Run List</h1>
        <p className="text-sm text-muted-foreground font-mono">{params.id}</p>
      </div>
      <div className="flex gap-6">
        <aside className="w-56 shrink-0 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</p>
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">Filter panel coming soon</div>
        </aside>
        <div className="flex-1 rounded-lg border">
          <div className="p-8 text-center text-sm text-muted-foreground">Scored vehicles will appear here</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Sources skeleton**

```typescript
// src/app/(app)/sources/page.tsx
export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Auction Sources</h1>
          <p className="text-sm text-muted-foreground">Column mappings for each auction platform</p>
        </div>
        <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md">
          Add New Source
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {['Manheim', 'ADESA', 'OVE'].map((name) => (
          <div key={name} className="rounded-lg border p-4">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted-foreground mt-1">Built-in preset</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Settings skeleton**

```typescript
// src/app/(app)/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">API keys, cache TTL, email ingestion</p>
      </div>
      <div className="rounded-lg border divide-y">
        {['Marketcheck API Key', 'Market Cache TTL (days)', 'Inbound Email Address'].map((label) => (
          <div key={label} className="p-4 flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit all skeletons**

```bash
git add src/app/"(app)"/
git commit -m "feat: add page skeletons for dashboard, run-lists, sources, settings"
```

---

## Task 11: Connect Neon DB and Deploy to Vercel

**Files:**
- No new files — environment setup

- [ ] **Step 1: Create Neon project**

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project named `runlist-analyzer`
3. Copy the connection string (it looks like `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`)
4. Paste it into `.env.local` as `DATABASE_URL`

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied. Tables created in Neon.

- [ ] **Step 3: Run seed**

```bash
npx prisma db seed
```

Expected:
```
Seeded: Manheim
Seeded: ADESA
Seeded: OVE
```

- [ ] **Step 4: Verify seed in Prisma Studio**

```bash
npx prisma studio
```

Open `http://localhost:5555`, click `auction_sources` — should show 3 rows.

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Create Vercel project and add environment variables**

```bash
npx vercel link
```

Then in the Vercel dashboard for this project, go to Settings → Environment Variables and add all variables from `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` = `/dashboard`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` = `/dashboard`
- `DATABASE_URL` (from Neon)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `MARKETCHECK_API_KEY`
- `CRON_SECRET`

- [ ] **Step 7: Configure Vercel Cron in vercel.json**

Create `vercel.json` in the project root:

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

This runs the market refresh at 6am UTC on the 1st of each month.

- [ ] **Step 8: Deploy**

```bash
git add vercel.json prisma/migrations/
git commit -m "feat: add vercel cron config and initial migration"
npx vercel --prod
```

- [ ] **Step 9: Smoke test deployed app**

Open the Vercel production URL. You should:
1. Be redirected to `/sign-in`
2. Create an account
3. Be redirected to `/dashboard`
4. See the sidebar with all four nav links
5. Navigate to each page and see the skeleton UI

---

## Task 12: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```

Expected output:
```
✓ src/types/__tests__/types.test.ts (4 tests)
✓ src/lib/__tests__/source-presets.test.ts (8 tests)

Test Files: 2 passed (2)
Tests:      12 passed (12)
```

- [ ] **Step 2: Final commit**

```bash
git add .
git commit -m "chore: plan 1 complete — foundation, auth, schema, presets, layout deployed"
```

---

## What's Next

**Plan 2: Data Pipeline** covers:
- CSV parser + normalization engine (with column map)
- Upload endpoint (`/api/ingest/upload`)
- Mailgun email webhook (`/api/ingest/email`)
- Add New Source column mapper (backend)
- Marketcheck API client
- Market cache read/write (Redis + Postgres)
- Scoring engine
- Score endpoint (`/api/analyze/score`)
- Cron endpoint (`/api/cron/market-refresh`)

**Plan 3: UI** covers all interactive frontend components.
