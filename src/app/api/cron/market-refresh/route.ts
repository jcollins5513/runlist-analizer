import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { fetchSalesStats } from '@/lib/marketcheck'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entries = await db.marketCache.findMany()
  let refreshed = 0
  let errors = 0

  for (const entry of entries) {
    try {
      const { salesCount, score } = await fetchSalesStats(entry.make, entry.model, entry.year)
      const key = `market:sales:${entry.make.toLowerCase()}:${entry.model.toLowerCase()}:${entry.year}`

      await redis.set(key, score, { ex: THIRTY_DAYS_SECONDS })
      await db.marketCache.update({
        where: { id: entry.id },
        data: {
          listingCount: salesCount,
          demandScore: score,
          lastRefreshedAt: new Date(),
        },
      })
      refreshed++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ refreshed, errors, total: entries.length })
}
