import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchMarketDemand } from '../marketcheck'

beforeEach(() => {
  vi.stubEnv('MARKETCHECK_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('fetchMarketDemand', () => {
  it('returns count from API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 42 }),
    }))
    const count = await fetchMarketDemand('Honda', 'Civic', 2022)
    expect(count).toBe(42)
  })

  it('includes zip=35801, radius=100, and make/year/model in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 10 }),
    })
    vi.stubGlobal('fetch', mockFetch)
    await fetchMarketDemand('Toyota', 'Camry', 2020)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('zip=35801')
    expect(url).toContain('radius=100')
    expect(url).toContain('make=Toyota')
    expect(url).toContain('model=Camry')
    expect(url).toContain('year=2020')
  })

  it('throws on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }))
    await expect(fetchMarketDemand('Honda', 'Civic', 2022)).rejects.toThrow('403')
  })

  it('returns 0 when response has no count field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }))
    const count = await fetchMarketDemand('Honda', 'Civic', 2022)
    expect(count).toBe(0)
  })
})
