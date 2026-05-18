const BASE_URL = 'https://api.marketcheck.com/v2'

interface SalesStatsResponse {
  count?: number
  total_count?: number
  dom?: { avg?: number; mean?: number; median?: number }
  dom_mean?: number
  dom_avg?: number
  dom_median?: number
  price?: { avg?: number; mean?: number; median?: number }
  miles?: { avg?: number; mean?: number }
}

export interface SalesStats {
  salesCount: number
  domAvg: number
  /** sales velocity: higher = faster-selling, more desirable */
  score: number
}

export async function fetchSalesStats(
  make: string,
  model: string,
  year: number
): Promise<SalesStats> {
  const apiKey = process.env.MARKETCHECK_API_KEY
  if (!apiKey) throw new Error('Missing MARKETCHECK_API_KEY environment variable')

  const params = new URLSearchParams({
    api_key: apiKey,
    ymm: `${year}|${make}|${model}`,
  })

  const res = await fetch(`${BASE_URL}/sales/car?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`MarketCheck API error: ${res.status} ${res.statusText}`)

  const data: SalesStatsResponse = await res.json()

  const salesCount = data.count ?? data.total_count ?? 0
  const domAvg =
    data.dom?.avg ??
    data.dom?.mean ??
    data.dom?.median ??
    data.dom_mean ??
    data.dom_avg ??
    data.dom_median ??
    0

  // units sold per day of DOM * 1000 — higher score = sells faster = better to buy
  const score = domAvg > 0 ? Math.round((salesCount / domAvg) * 1000) : salesCount

  return { salesCount, domAvg, score }
}
