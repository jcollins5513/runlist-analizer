import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scoreRunList } from '@/lib/scoring'
import { refreshRunListVehicles } from '@/lib/ingest'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const runList = await db.runList.findUnique({ where: { id } })
  if (!runList) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (runList.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['parsed', 'scored'].includes(runList.status)) {
    return NextResponse.json({ error: 'Run list is not ready to score' }, { status: 409 })
  }

  await db.runList.update({ where: { id }, data: { status: 'scoring' } })

  const sp = req.nextUrl.searchParams
  const makesRaw = sp.get('makes')
  const filters = {
    yearMin: sp.get('yearMin') ? parseInt(sp.get('yearMin')!) : undefined,
    yearMax: sp.get('yearMax') ? parseInt(sp.get('yearMax')!) : undefined,
    makes: makesRaw ? makesRaw.split(',').map(m => m.trim()).filter(Boolean) : undefined,
    gradeMin: sp.get('gradeMin') ? parseFloat(sp.get('gradeMin')!) : undefined,
    odomMax: sp.get('odomMax') ? parseInt(sp.get('odomMax')!) : undefined,
    mmrMin: sp.get('mmrMin') ? parseInt(sp.get('mmrMin')!) : undefined,
    mmrMax: sp.get('mmrMax') ? parseInt(sp.get('mmrMax')!) : undefined,
    accMax: sp.get('accMax') ? parseInt(sp.get('accMax')!) : undefined,
    ownMax: sp.get('ownMax') ? parseInt(sp.get('ownMax')!) : undefined,
  }

  try {
    await refreshRunListVehicles(id)
    await scoreRunList(id, filters)
    return NextResponse.json({ status: 'scored' })
  } catch (err) {
    await db.runList.update({
      where: { id },
      data: {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Scoring failed',
      },
    })
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
