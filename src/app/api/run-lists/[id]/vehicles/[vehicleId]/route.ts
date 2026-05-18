import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vehicleId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, vehicleId } = await params
  const body = await req.json() as { isExcluded: boolean }

  const runList = await db.runList.findUnique({ where: { id } })
  if (!runList) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (runList.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const vehicle = await db.runListVehicle.update({
    where: { id: vehicleId },
    data: { isExcluded: body.isExcluded },
    select: { id: true, isExcluded: true },
  })

  return NextResponse.json(vehicle)
}
