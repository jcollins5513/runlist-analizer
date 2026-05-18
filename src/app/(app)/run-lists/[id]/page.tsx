import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'

export default async function RunListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const runList = await db.runList.findUnique({
    where: { id },
    include: { source: true },
  })

  if (!runList) notFound()

  const vehicles = await db.runListVehicle.findMany({
    where: { runListId: id },
    orderBy: [{ demandRank: 'asc' }, { id: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{runList.filename}</h1>
          <p className="text-sm text-muted-foreground">
            {runList.source.displayName} &mdash; {new Date(runList.uploadedAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={runList.status} />
      </div>

      <div className="rounded-lg border">
        {vehicles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No vehicles found in this run list.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-3 text-left font-medium">Rank</th>
                <th className="px-3 py-3 text-left font-medium">Vehicle</th>
                <th className="px-3 py-3 text-left font-medium">VIN</th>
                <th className="px-3 py-3 text-right font-medium">Miles</th>
                <th className="px-3 py-3 text-right font-medium">Grade</th>
                <th className="px-3 py-3 text-right font-medium">MMR</th>
                <th className="px-3 py-3 text-right font-medium">Demand</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {v.demandRank ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">
                      {v.year} {v.make} {v.model}
                    </div>
                    {v.trim && <div className="text-xs text-muted-foreground">{v.trim}</div>}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{v.vin}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">
                    {v.odometer != null ? v.odometer.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">
                    {v.crGrade != null ? Number(v.crGrade).toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">
                    {v.mmr != null ? `$${v.mmr.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {v.demandScore != null ? (
                      <span className="font-medium">{v.demandScore.toLocaleString()}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'scored' ? 'default'
    : status === 'error' ? 'destructive'
    : status === 'processing' ? 'secondary'
    : 'outline'
  return <Badge variant={variant as 'default' | 'destructive' | 'secondary' | 'outline'}>{status}</Badge>
}
