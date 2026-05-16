import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}))
vi.mock('@/lib/marketcheck', () => ({
  fetchMarketDemand: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: { marketCache: { upsert: vi.fn() } },
}))

import { getMarketDemand } from '../market-cache'
import { redis } from '@/lib/redis'
import { fetchMarketDemand } from '@/lib/marketcheck'
import { db } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMarketDemand', () => {
  it('returns cached value without calling Marketcheck API', async () => {
    vi.mocked(redis.get).mockResolvedValue(75)
    const count = await getMarketDemand('Honda', 'Civic', 2022)
    expect(count).toBe(75)
    expect(fetchMarketDemand).not.toHaveBeenCalled()
  })

  it('calls Marketcheck on cache miss and returns count', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(50)
    const count = await getMarketDemand('Toyota', 'Camry', 2020)
    expect(count).toBe(50)
    expect(fetchMarketDemand).toHaveBeenCalledWith('Toyota', 'Camry', 2020)
  })

  it('writes to Redis with 30-day TTL on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(30)
    await getMarketDemand('Ford', 'F-150', 2021)
    expect(redis.set).toHaveBeenCalledWith(
      'market:ford:f-150:2021',
      30,
      { ex: 60 * 60 * 24 * 30 }
    )
  })

  it('builds cache key in lowercase', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(0)
    await getMarketDemand('BMW', 'X5', 2023)
    expect(redis.get).toHaveBeenCalledWith('market:bmw:x5:2023')
  })

  it('upserts to Postgres with correct args on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(fetchMarketDemand).mockResolvedValue(42)
    await getMarketDemand('Honda', 'Civic', 2022)
    expect(vi.mocked(db.marketCache.upsert)).toHaveBeenCalledWith({
      where: { make_model_year: { make: 'Honda', model: 'Civic', year: 2022 } },
      update: expect.objectContaining({ listingCount: 42, demandScore: 42 }),
      create: expect.objectContaining({ make: 'Honda', model: 'Civic', year: 2022, listingCount: 42, demandScore: 42 }),
    })
  })
})
