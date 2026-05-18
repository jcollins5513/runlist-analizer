'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Source {
  id: string
  displayName: string
}

export function UploadDialog({ sources }: { sources: Source[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(null)
      setSourceId('')
      setError(null)
    }
  }

  async function handleSubmit() {
    if (!file || !sourceId) return
    setLoading(true)
    setError(null)

    const body = new FormData()
    body.append('file', file)
    body.append('sourceId', sourceId)

    try {
      const res = await fetch('/api/ingest/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok || data.status === 'error') {
        setError(data.error ?? 'Upload failed')
        return
      }
      setOpen(false)
      router.push(`/run-lists/${data.runListId}`)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Upload Run List</Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Run List</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Auction Source</label>
            <Select value={sourceId} onValueChange={(val) => { if (val !== null) setSourceId(val) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a source…" />
              </SelectTrigger>
              <SelectContent>
                {sources.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">CSV File</label>
            <div
              className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="flex-1 text-sm text-muted-foreground">
                {file ? file.name : 'Choose CSV file…'}
              </span>
              <span className="text-xs text-muted-foreground">CSV</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              aria-label="CSV file"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            disabled={!file || !sourceId || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Processing…' : 'Upload & Score'}
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}
