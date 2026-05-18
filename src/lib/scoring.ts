import { db } from '@/lib/db'
import { getMarketDemand } from '@/lib/market-cache'

export interface ScoreFilters {
  yearMin?: number
  yearMax?: number
  makes?: string[]
  gradeMin?: number
  odomMax?: number
  mmrMin?: number
  mmrMax?: number
  accMax?: number
  ownMax?: number
}

export function rankVehicles(scores: number[]): number[] {
  const indexed = scores.map((score, i) => ({ score, i }))
  indexed.sort((a, b) => b.score - a.score)
  const ranks = new Array<number>(scores.length)
  indexed.forEach(({ i }, pos) => {
    ranks[i] = pos + 1
  })
  return ranks
}

export async function scoreRunList(runListId: string, filters: ScoreFilters = {}): Promise<void> {
  const allVehicles = await db.runListVehicle.findMany({
    where: { runListId, isExcluded: false },
  })

  const { yearMin, yearMax, makes, gradeMin, odomMax, mmrMin, mmrMax, accMax, ownMax } = filters
  const vehicles = allVehicles.filter(v => {
    if (yearMin && v.year < yearMin) return false
    if (yearMax && v.year > yearMax) return false
    if (makes && makes.length > 0 && !makes.some(m => m.toLowerCase() === v.make.toLowerCase())) return false
    if (gradeMin && (v.crGrade == null || Number(v.crGrade) < gradeMin)) return false
    if (odomMax && v.odometer != null && v.odometer > odomMax) return false
    if (mmrMin && v.mmr != null && v.mmr < mmrMin) return false
    if (mmrMax && v.mmr != null && v.mmr > mmrMax) return false
    if (accMax != null && v.accidents != null && v.accidents > accMax) return false
    if (ownMax && v.owners != null && v.owners > ownMax) return false
    return true
  })

  if (vehicles.length > 0) {
    const scores = await Promise.all(
      vehicles.map(v =>
        v.demandScore != null && v.demandScore > 0
          ? Promise.resolve(v.demandScore)
          : getMarketDemand(v.make, v.model, v.year).catch(() => 0)
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

  await db.runList.update({
    where: { id: runListId },
    data: { status: 'scored', scoredAt: new Date() },
  })
}
