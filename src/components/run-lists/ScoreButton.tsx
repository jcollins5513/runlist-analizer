'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ScoreButton({ runListId, status }: { runListId: string; status: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  if (!['parsed', 'scored', 'error'].includes(status)) return null

  async function handleScore() {
    setLoading(true)
    const filterKeys = ['yearMin', 'yearMax', 'makes', 'gradeMin', 'odomMax', 'mmrMin', 'mmrMax', 'accMax', 'ownMax']
    const params = new URLSearchParams()
    for (const key of filterKeys) {
      const val = searchParams.get(key)
      if (val) params.set(key, val)
    }
    const qs = params.toString()
    try {
      const res = await fetch(`/api/run-lists/${runListId}/score${qs ? `?${qs}` : ''}`, { method: 'POST' })
      if (!res.ok) {
        let errorMsg = 'Scoring failed'
        try {
          const body = await res.json()
          errorMsg = body.error ?? errorMsg
        } catch { /* non-JSON body */ }
        alert(errorMsg)
        return
      }
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error — could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleScore} disabled={loading} size="sm">
      {loading ? 'Scoring…' : status === 'scored' ? 'Re-score' : 'Score This List'}
    </Button>
  )
}
