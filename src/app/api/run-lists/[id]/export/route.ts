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

function parseNum(s: string | null): number | null {
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
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
  const gradeMin = parseNum(sp.get('gradeMin'))
  const odomMax = parseNum(sp.get('odomMax'))
  const mmrMin = parseNum(sp.get('mmrMin'))
  const mmrMax = parseNum(sp.get('mmrMax'))
  const accMax = parseNum(sp.get('accMax'))
  const ownMax = parseNum(sp.get('ownMax'))
  const ownerType = sp.get('ownerType')
  const rankMax = parseNum(sp.get('rankMax'))
  const yearMin = parseNum(sp.get('yearMin'))
  const yearMax = parseNum(sp.get('yearMax'))
  const makesRaw = sp.get('makes')
  const makes = makesRaw ? makesRaw.split(',').map(m => m.trim()).filter(Boolean) : []

  const all = await db.runListVehicle.findMany({
    where: { runListId: id },
    orderBy: [{ demandRank: 'asc' }, { id: 'asc' }],
  })

  const filtered = all.filter(v => {
    if (!showExcluded && v.isExcluded) return false
    if (gradeMin != null && (v.crGrade == null || Number(v.crGrade) < gradeMin)) return false
    if (odomMax != null && v.odometer != null && v.odometer > odomMax) return false
    if (mmrMin != null && v.mmr != null && v.mmr < mmrMin) return false
    if (mmrMax != null && v.mmr != null && v.mmr > mmrMax) return false
    if (accMax != null && v.accidents != null && v.accidents > accMax) return false
    if (ownMax != null && v.owners != null && v.owners > ownMax) return false
    if (ownerType && v.ownershipType && v.ownershipType.toLowerCase() !== ownerType.toLowerCase()) return false
    if (rankMax != null && v.demandRank != null && v.demandRank > rankMax) return false
    if (yearMin != null && v.year < yearMin) return false
    if (yearMax != null && v.year > yearMax) return false
    if (makes.length > 0 && !makes.some(m => m.toLowerCase() === v.make.toLowerCase())) return false
    return true
  })

  const csv = [HEADER, ...filtered.map(row)].join('\n')
  const rawFilename = runList.filename.replace(/\.csv$/i, '') + '-curated.csv'
  const filename = rawFilename.replace(/["\r\n]/g, '_')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
