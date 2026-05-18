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
