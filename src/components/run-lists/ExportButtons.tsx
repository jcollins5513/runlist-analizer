'use client'

import { Button } from '@/components/ui/button'

type SP = { [key: string]: string | string[] | undefined }

function buildExportUrl(runListId: string, searchParams: SP): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (v != null) params.set(k, Array.isArray(v) ? v[0] : v)
  }
  return `/api/run-lists/${runListId}/export?${params.toString()}`
}

export function ExportButtons({ runListId, searchParams }: { runListId: string; searchParams: SP }) {
  const exportUrl = buildExportUrl(runListId, searchParams)

  async function handleShare() {
    try {
      const res = await fetch(exportUrl)
      const blob = await res.blob()
      const file = new File([blob], 'run-list.csv', { type: 'text/csv' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Run List', text: 'Curated auction run list' })
        return
      }
    } catch {
      // fall through to mailto fallback
    }

    // Fallback: trigger download, then open mailto
    const a = document.createElement('a')
    a.href = exportUrl
    a.download = 'run-list.csv'
    a.click()

    const subject = encodeURIComponent('Auction Run List')
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent('See attached run list CSV.')}`
  }

  return (
    <div className="flex items-center gap-2">
      <a href={exportUrl} download>
        <Button variant="outline" size="sm">Download CSV</Button>
      </a>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={handleShare}>
        Share
      </Button>
    </div>
  )
}
