import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}))
vi.mock('@/lib/marketcheck', () => ({
  fetchSalesStats: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: { marketCache: { upsert: vi.fn() } },
}))

import { getMarketDemand } from '../market-cache'
import { redis } from '@/lib/redis'
import { fetchSalesStats } from '@/lib/marketcheck'
import { db } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMarketDemand', () => {
  it('returns cached score without calling MarketCheck API', async () => {
    vi.mocked(redis.get).mockResolvedValue(5000)
    const score = await getMarketDemand('Honda', 'Civic', 2022)
    expect(score).toBe(5000)
    expect(fetchSalesStats).not.toHaveBeenCalled()
  })

  it('calls MarketCheck on cache miss and returns velocity score', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchSalesStats).mockResolvedValue({ salesCount: 150, domAvg: 30, score: 5000 })
    const score = await getMarketDemand('Toyota', 'Camry', 2020)
    expect(score).toBe(5000)
    expect(fetchSalesStats).toHaveBeenCalledWith('Toyota', 'Camry', 2020)
  })

  it('writes score to Redis with 30-day TTL on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchSalesStats).mockResolvedValue({ salesCount: 30, domAvg: 15, score: 2000 })
    await getMarketDemand('Ford', 'F-150', 2021)
    expect(redis.set).toHaveBeenCalledWith(
      'market:sales:ford:f-150:2021',
      2000,
      { ex: 60 * 60 * 24 * 30 }
    )
  })

  it('builds cache key in lowercase with sales prefix', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchSalesStats).mockResolvedValue({ salesCount: 0, domAvg: 0, score: 0 })
    await getMarketDemand('BMW', 'X5', 2023)
    expect(redis.get).toHaveBeenCalledWith('market:sales:bmw:x5:2023')
  })

  it('upserts to Postgres with salesCount as listingCount and score as demandScore', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchSalesStats).mockResolvedValue({ salesCount: 42, domAvg: 21, score: 2000 })
    await getMarketDemand('Honda', 'Civic', 2022)
    expect(vi.mocked(db.marketCache.upsert)).toHaveBeenCalledWith({
      where: { make_model_year: { make: 'Honda', model: 'Civic', year: 2022 } },
      update: expect.objectContaining({ listingCount: 42, demandScore: 2000 }),
      create: expect.objectContaining({ make: 'Honda', model: 'Civic', year: 2022, listingCount: 42, demandScore: 2000 }),
    })
  })
})
