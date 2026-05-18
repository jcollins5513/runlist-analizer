import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RunListVehicle } from '@prisma/client'

function row(v: RunListVehicle): string {
  const fields = [
    v.demandRank ?? '',
    v.vin,
    v.year,
    v.make,
    v.model,
    v.trim ?? '',
    v.odometer ?? '',
    v.crGrade != null ? Number(v.crGrade).toFixed(1) : '',
    v.mmr ?? '',
    v.accidents ?? '',
    v.owners ?? '',
    v.ownershipType ?? '',
    v.carfaxValue ?? '',
    v.demandScore ?? '',
  ]
  return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')
}

const HEADER = '"Rank","VIN","Year","Make","Model","Trim","Odometer","Grade","MMR","Accidents","Owners","Ownership Type","Carfax Value","Demand Score"'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const runList = await db.runList.findUnique({ where: { id } })
  if (!runList) return new NextResponse('Not found', { status: 404 })
  if (runList.userId !== userId) return new NextResponse('Forbidden', { status: 403 })

  const sp = req.nextUrl.searchParams
  const showExcluded = sp.get('showExcluded') === 'true'
  const gradeMin = sp.get('gradeMin')
  const odomMax = sp.get('odomMax')
  const mmrMin = sp.get('mmrMin')
  const mmrMax = sp.get('mmrMax')
  const accMax = sp.get('accMax')
  const ownMax = sp.get('ownMax')
  const ownerType = sp.get('ownerType')
  const rankMax = sp.get('rankMax')
  const yearMin = sp.get('yearMin')
  const yearMax = sp.get('yearMax')
  const makesRaw = sp.get('makes')
  const makes = makesRaw ? makesRaw.split(',').map(m => m.trim()).filter(Boolean) : []

  const all = await db.runListVehicle.findMany({
    where: { runListId: id },
    orderBy: [{ demandRank: 'asc' }, { id: 'asc' }],
  })

  const filtered = all.filter(v => {
    if (!showExcluded && v.isExcluded) return false
    if (gradeMin && (v.crGrade == null || Number(v.crGrade) < parseFloat(gradeMin))) return false
    if (odomMax && v.odometer != null && v.odometer > parseInt(odomMax)) return false
    if (mmrMin && v.mmr != null && v.mmr < parseInt(mmrMin)) return false
    if (mmrMax && v.mmr != null && v.mmr > parseInt(mmrMax)) return false
    if (accMax && v.accidents != null && v.accidents > parseInt(accMax)) return false
    if (ownMax && v.owners != null && v.owners > parseInt(ownMax)) return false
    if (ownerType && v.ownershipType && v.ownershipType.toLowerCase() !== ownerType.toLowerCase()) return false
    if (rankMax && v.demandRank != null && v.demandRank > parseInt(rankMax)) return false
    if (yearMin && v.year < parseInt(yearMin)) return false
    if (yearMax && v.year > parseInt(yearMax)) return false
    if (makes.length > 0 && !makes.some(m => m.toLowerCase() === v.make.toLowerCase())) return false
    return true
  })

  const csv = [HEADER, ...filtered.map(row)].join('\n')
  const filename = runList.filename.replace(/\.csv$/i, '') + '-curated.csv'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
