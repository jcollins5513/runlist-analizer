export default async function RunListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Run List</h1>
        <p className="text-sm text-muted-foreground font-mono">{id}</p>
      </div>
      <div className="flex gap-6">
        <aside className="w-56 shrink-0 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</p>
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">Filter panel coming soon</div>
        </aside>
        <div className="flex-1 rounded-lg border">
          <div className="p-8 text-center text-sm text-muted-foreground">Scored vehicles will appear here</div>
        </div>
      </div>
    </div>
  )
}
