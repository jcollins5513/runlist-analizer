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
