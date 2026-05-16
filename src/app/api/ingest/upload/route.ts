import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { processRunList } from '@/lib/pipeline'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const sourceId = formData.get('sourceId') as string | null

  if (!file || !sourceId) {
    return NextResponse.json({ error: 'Missing file or sourceId' }, { status: 400 })
  }

  const source = await db.auctionSource.findUnique({ where: { id: sourceId } })
  if (!source) {
    return NextResponse.json({ error: 'Unknown sourceId' }, { status: 400 })
  }

  const blob = await put(`runlists/${Date.now()}-${file.name}`, file, { access: 'public' })

  const runList = await db.runList.create({
    data: {
      userId,
      sourceId,
      blobUrl: blob.url,
      filename: file.name,
      status: 'pending',
    },
  })

  await processRunList(runList.id)

  return NextResponse.json({ runListId: runList.id, status: 'scored' })
}
