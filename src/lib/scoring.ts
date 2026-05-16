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
