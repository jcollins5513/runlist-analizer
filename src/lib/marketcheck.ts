const BASE_URL = 'https://mc-api.marketcheck.com/v2'

export async function fetchMarketDemand(
  make: string,
  model: string,
  year: number
): Promise<number> {
  const params = new URLSearchParams({
    api_key: process.env.MARKETCHECK_API_KEY!,
    year: String(year),
    make,
    model,
    zip: '35801',
    radius: '100',
    stats: 'units_for_sale',
  })

  const res = await fetch(`${BASE_URL}/stats/car/global/ymm?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Marketcheck API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return (data.count as number) ?? 0
}
