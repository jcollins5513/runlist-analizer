export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">API keys, cache TTL, email ingestion</p>
      </div>
      <div className="rounded-lg border divide-y">
        {['Marketcheck API Key', 'Market Cache TTL (days)', 'Inbound Email Address'].map((label) => (
          <div key={label} className="p-4 flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
