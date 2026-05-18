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
