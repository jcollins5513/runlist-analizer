export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Auction Sources</h1>
          <p className="text-sm text-muted-foreground">Column mappings for each auction platform</p>
        </div>
        <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md">
          Add New Source
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {['Manheim', 'ADESA', 'OVE'].map((name) => (
          <div key={name} className="rounded-lg border p-4">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted-foreground mt-1">Built-in preset</p>
          </div>
        ))}
      </div>
    </div>
  )
}
