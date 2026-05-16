export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Recent activity and market cache status</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Run Lists This Month', 'Vehicles Analyzed', 'Market Cache Age'].map((label) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold mt-1">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
