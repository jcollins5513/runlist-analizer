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
