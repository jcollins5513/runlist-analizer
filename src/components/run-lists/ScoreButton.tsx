'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ScoreButton({ runListId, status }: { runListId: string; status: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!['parsed', 'error'].includes(status)) return null

  async function handleScore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/run-lists/${runListId}/score`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        alert(body.error ?? 'Scoring failed')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleScore} disabled={loading} size="sm">
      {loading ? 'Scoring…' : 'Score This List'}
    </Button>
  )
}
