import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { parseInventoryCsv } from '@/lib/inventory-parser'

function verifySignature(timestamp: string, token: string, signature: string): boolean {
  const key = process.env.HTTP_SIGNING_KEY
  if (!key) return false
  const hash = createHmac('sha256', key)
    .update(timestamp + token)
    .digest('hex')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const timestamp = formData.get('timestamp') as string | null
  const token = formData.get('token') as string | null
  const signature = formData.get('signature') as string | null

  if (!timestamp || !token || !signature || !verifySignature(timestamp, token, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let csvText: string | null = null
  for (let i = 1; i <= 10; i++) {
    const attachment = formData.get(`attachment-${i}`) as File | null
    if (!attachment) break
    const name = attachment.name ?? ''
    const type = attachment.type ?? ''
    if (type.includes('text') || name.endsWith('.csv') || name.endsWith('.txt')) {
      csvText = await attachment.text()
      break
    }
  }

  if (!csvText) {
    return NextResponse.json({ error: 'No CSV attachment found' }, { status: 400 })
  }

  const vehicles = parseInventoryCsv(csvText)
  if (vehicles.length === 0) {
    return NextResponse.json({ error: 'No valid vehicles parsed from attachment' }, { status: 400 })
  }

  await db.$transaction([
    db.dealerInventory.deleteMany(),
    db.dealerInventory.createMany({
      data: vehicles.map(v => ({
        vin: v.vin,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim ?? null,
      })),
    }),
  ])

  return NextResponse.json({ imported: vehicles.length })
}
