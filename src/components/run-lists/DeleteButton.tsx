'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteButton({ runListId }: { runListId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this run list? This cannot be undone.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/run-lists/${runListId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Delete failed')
        return
      }
      router.push('/run-lists')
      router.refresh()
    } catch {
      alert('Network error — could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded px-3 py-1.5 text-sm font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors disabled:opacity-50"
    >
      {loading ? 'Deleting…' : 'Delete'}
    </button>
  )
}
