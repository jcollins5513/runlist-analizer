'use client'

import { useRouter } from 'next/navigation'
import { usePathname, useSearchParams } from 'next/navigation'
import type { RunListVehicle } from '@prisma/client'
import type { StockLevel } from '@/types'

type VehicleRow = Omit<RunListVehicle, 'crGrade'> & { crGrade: number | null }

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
  vehicles: VehicleRow[]
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

  async function toggleExclude(vehicle: VehicleRow) {
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
