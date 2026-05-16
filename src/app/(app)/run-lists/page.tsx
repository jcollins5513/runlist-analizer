import Link from 'next/link'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { UploadDialog } from '@/components/run-lists/UploadDialog'

export default async function RunListsPage() {
  const [sources, runLists] = await Promise.all([
    db.auctionSource.findMany({ orderBy: { displayName: 'asc' } }),
    db.runList.findMany({ include: { source: true }, orderBy: { uploadedAt: 'desc' } }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Run Lists</h1>
          <p className="text-sm text-muted-foreground">All uploaded auction run lists</p>
        </div>
        <UploadDialog sources={sources} />
      </div>

      <div className="rounded-lg border">
        {runLists.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No run lists yet. Upload a CSV to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">File</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {runLists.map(rl => (
                <tr key={rl.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/run-lists/${rl.id}`} className="font-medium hover:underline">
                      {rl.filename}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{rl.source.displayName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rl.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(rl.uploadedAt).toLocaleDateString()}
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
