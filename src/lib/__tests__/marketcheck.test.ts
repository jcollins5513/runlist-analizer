import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSalesStats } from '../marketcheck'

beforeEach(() => {
  vi.stubEnv('MARKETCHECK_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('fetchSalesStats', () => {
  it('computes velocity score from count and dom avg', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 150, dom: { avg: 30 } }),
    }))
    const result = await fetchSalesStats('Honda', 'Civic', 2022)
    expect(result.salesCount).toBe(150)
    expect(result.domAvg).toBe(30)
    expect(result.score).toBe(5000) // (150/30)*1000
  })

  it('falls back to count when no DOM data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 42 }),
    }))
    const result = await fetchSalesStats('Honda', 'Civic', 2022)
    expect(result.score).toBe(42)
  })

  it('uses ymm parameter in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 10, dom: { avg: 20 } }),
    })
    vi.stubGlobal('fetch', mockFetch)
    await fetchSalesStats('Toyota', 'Camry', 2020)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('ymm=2020%7CToyota%7CCamry')
  })

  it('throws on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }))
    await expect(fetchSalesStats('Honda', 'Civic', 2022)).rejects.toThrow('403')
  })

  it('returns zero score when response is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }))
    const result = await fetchSalesStats('Honda', 'Civic', 2022)
    expect(result.salesCount).toBe(0)
    expect(result.score).toBe(0)
  })

  it('handles flat dom_mean field as fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total_count: 100, dom_mean: 50 }),
    }))
    const result = await fetchSalesStats('Ford', 'F-150', 2021)
    expect(result.salesCount).toBe(100)
    expect(result.score).toBe(2000) // (100/50)*1000
  })
})
