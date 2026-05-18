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
    let model = row[columnMap.model]?.trim()

    if (!vin || !yearStr || !make || !model) continue

    // Strip leading "{year} {make} " prefix when source stores full description in model column
    const descPrefix = `${yearStr} ${make} `
    if (model.toUpperCase().startsWith(descPrefix.toUpperCase())) {
      model = model.substring(descPrefix.length).trim()
    }

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

    if (columnMap.accidents) {
      const accStr = row[columnMap.accidents]?.trim() ?? ''
      const accNum = parseInt(accStr, 10)
      if (!isNaN(accNum)) {
        vehicle.accidents = accNum
      } else if (accStr.toLowerCase().includes('no accidents')) {
        vehicle.accidents = 0
      } else {
        // FAA text format: find "Accident[s] reported: DATE, DATE, ..." segments,
        // count MM/DD/YYYY dates in each. "Damage reported:" lines are excluded.
        const segments = accStr.match(/[Aa]ccidents? reported:[^.]+/g) ?? []
        vehicle.accidents = segments.reduce(
          (sum, seg) => sum + (seg.match(/\d{2}\/\d{2}\/\d{4}/g)?.length ?? 0),
          0
        )
      }
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

    vehicles.push(vehicle)
  }

  return vehicles
}
