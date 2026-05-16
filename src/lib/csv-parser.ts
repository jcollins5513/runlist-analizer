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
      let mmrStr = row[columnMap.mmr] ?? ''
      // Handle case where comma in unquoted field splits the value
      // If the value starts with $ and doesn't contain full number, look for overflow
      if (mmrStr.startsWith('$') && !mmrStr.includes(',')) {
        // Try to find a following numeric field that might be the rest
        const keys = Object.keys(row)
        const mmrIndex = keys.indexOf(columnMap.mmr)
        if (mmrIndex >= 0 && mmrIndex < keys.length - 1) {
          const nextVal = row[keys[mmrIndex + 1]]
          if (nextVal && /^\d+$/.test(nextVal)) {
            mmrStr = mmrStr + nextVal
          }
        }
      }
      const mmr = parseFloat(mmrStr.replace(/[$,]/g, '') ?? '')
      if (!isNaN(mmr)) vehicle.mmr = Math.round(mmr)
    }

    vehicles.push(vehicle)
  }

  return vehicles
}
