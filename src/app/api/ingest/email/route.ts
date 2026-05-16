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
    console.warn(`Mailgun: no CSV attachment from ${senderEmail}`)
    return NextResponse.json({ ok: true, noCsv: true })
  }

  let blob: Awaited<ReturnType<typeof put>>
  try {
    blob = await put(`runlists/email-${Date.now()}-${filename}`, csvFile, {
      access: 'public',
    })
  } catch (err) {
    console.error(`Mailgun: blob upload failed for ${senderEmail}`, err)
    // Return 200 so Mailgun does not retry — we can't fix a storage error by retrying
    return NextResponse.json({ ok: true, error: 'Upload failed' })
  }

  const runList = await db.runList.create({
    data: {
      userId: `email:${senderEmail}`,
      sourceId: sourceEmail.sourceId,
      blobUrl: blob.url,
      filename,
      status: 'pending',
    },
  })

  try {
    await processRunList(runList.id)
    console.log(`Mailgun: run list ${runList.id} processed successfully for ${senderEmail}`)
  } catch (err) {
    // Pipeline already sets status to 'error' in DB and re-throws — catch here to return 200
    console.error(`Mailgun: pipeline failed for run list ${runList.id}`, err)
    return NextResponse.json({ ok: true, runListId: runList.id, status: 'error' })
  }

  return NextResponse.json({ ok: true, runListId: runList.id })
}
