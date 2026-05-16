export default function RunListsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Run Lists</h1>
          <p className="text-sm text-muted-foreground">All uploaded auction run lists</p>
        </div>
        <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md">
          Upload Run List
        </button>
      </div>
      <div className="rounded-lg border">
        <div className="p-8 text-center text-sm text-muted-foreground">
          No run lists yet. Upload a CSV to get started.
        </div>
      </div>
    </div>
  )
}
