import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.MARKETCHECK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'MARKETCHECK_API_KEY not set' }, { status: 500 })

  const sp = req.nextUrl.searchParams
  const make = sp.get('make') ?? 'Honda'
  const model = sp.get('model') ?? 'Civic'
  const year = sp.get('year') ?? '2020'

  const params = new URLSearchParams({
    api_key: apiKey,
    year,
    make,
    model,
    rows: '0',
  })

  const url = `https://api.marketcheck.com/v2/search/car/active?${params}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const raw = await res.json()

  return NextResponse.json({ status: res.status, raw })
}
