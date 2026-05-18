import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { fetchSalesStats } from '@/lib/marketcheck'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

function cacheKey(make: string, model: string, year: number): string {
  return `market:sales:${make.toLowerCase()}:${model.toLowerCase()}:${year}`
}

export async function getMarketDemand(
  make: string,
  model: string,
  year: number
): Promise<number> {
  const key = cacheKey(make, model, year)
  const cached = await redis.get<number>(key)
  if (cached !== null) return cached

  const { salesCount, score } = await fetchSalesStats(make, model, year)

  try {
    await redis.set(key, score, { ex: THIRTY_DAYS_SECONDS })
    await db.marketCache.upsert({
      where: { make_model_year: { make, model, year } },
      update: { listingCount: salesCount, demandScore: score, lastRefreshedAt: new Date() },
      create: { make, model, year, listingCount: salesCount, demandScore: score },
    })
  } catch (err) {
    console.error('market-cache: write-back failed', err)
  }

  return score
}
