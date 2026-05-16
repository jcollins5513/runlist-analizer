import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { processRunList } from '@/lib/pipeline'

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).toLowerCase().trim()
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const rawSender = formData.get('sender') as string | null

  if (!rawSender) {
    return NextResponse.json({ error: 'No sender' }, { status: 400 })
  }

  const senderEmail = extractEmail(rawSender)

  const sourceEmail = await db.auctionSourceEmail.findUnique({
    where: { emailAddress: senderEmail },
    include: { source: true },
  })

  if (!sourceEmail) {
    console.warn(`Mailgun: unrecognized sender ${senderEmail}`)
    // Return 200 so Mailgun does not retry
    return NextResponse.json({ ok: true, ignored: true })
  }

  const attachmentCount = parseInt(
    (formData.get('attachment-count') as string) ?? '0',
    10
  )

  let csvFile: File | null = null
  let filename = 'email-upload.csv'

  for (let i = 1; i <= attachmentCount; i++) {
    const attachment = formData.get(`attachment-${i}`) as File | null
    if (attachment && attachment.name.toLowerCase().endsWith('.csv')) {
      csvFile = attachment
      filename = attachment.name
      break
    }
  }

  if (!csvFile) {
    return NextResponse.json({ error: 'No CSV attachment found' }, { status: 200 })
  }

  const blob = await put(`runlists/email-${Date.now()}-${filename}`, csvFile, {
    access: 'public',
  })

  const runList = await db.runList.create({
    data: {
      userId: `email:${senderEmail}`,
      sourceId: sourceEmail.sourceId,
      blobUrl: blob.url,
      filename,
      status: 'pending',
    },
  })

  await processRunList(runList.id)

  return NextResponse.json({ ok: true, runListId: runList.id })
}
