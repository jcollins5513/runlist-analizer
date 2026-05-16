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
