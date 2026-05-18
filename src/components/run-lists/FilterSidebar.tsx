'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

type SP = { [key: string]: string | string[] | undefined }

function spStr(params: SP, key: string): string {
  const v = params[key]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export function FilterSidebar({ searchParams, uniqueMakes }: { searchParams: SP; uniqueMakes: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams()
    const keys = ['sort', 'dir', 'gradeMin', 'odomMax', 'mmrMin', 'mmrMax', 'accMax', 'ownMax', 'ownerType', 'rankMax', 'yearMin', 'yearMax', 'makes', 'showExcluded']
    for (const k of keys) {
      const existing = spStr(searchParams, k)
      if (existing) params.set(k, existing)
    }
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const toggleMake = (make: string, checked: boolean) => {
    const current = spStr(searchParams, 'makes').split(',').filter(Boolean)
    const next = checked ? [...current, make] : current.filter(m => m !== make)
    update('makes', next.join(','))
  }

  const clearAll = () => {
    startTransition(() => router.push(pathname))
  }

  return (
    <aside className="w-56 shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
          Clear
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Min CR Grade</Label>
        <Input
          type="number"
          step="0.5"
          min="0"
          max="5"
          defaultValue={spStr(searchParams, 'gradeMin')}
          placeholder="e.g. 3.0"
          className="h-8 text-sm"
          onBlur={e => update('gradeMin', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Max Odometer</Label>
        <Input
          type="number"
          min="0"
          defaultValue={spStr(searchParams, 'odomMax')}
          placeholder="e.g. 100000"
          className="h-8 text-sm"
          onBlur={e => update('odomMax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">MMR Range</Label>
        <div className="flex gap-1">
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'mmrMin')}
            placeholder="Min"
            className="h-8 text-sm"
            onBlur={e => update('mmrMin', e.target.value)}
          />
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'mmrMax')}
            placeholder="Max"
            className="h-8 text-sm"
            onBlur={e => update('mmrMax', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Max Accidents</Label>
        <Input
          type="number"
          min="0"
          defaultValue={spStr(searchParams, 'accMax')}
          placeholder="0 = accident free"
          className="h-8 text-sm"
          onBlur={e => update('accMax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Max Owners</Label>
        <Input
          type="number"
          min="1"
          defaultValue={spStr(searchParams, 'ownMax')}
          placeholder="e.g. 2"
          className="h-8 text-sm"
          onBlur={e => update('ownMax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Year Range</Label>
        <div className="flex gap-1">
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'yearMin')}
            placeholder="From"
            className="h-8 text-sm"
            onBlur={e => update('yearMin', e.target.value)}
          />
          <Input
            type="number"
            defaultValue={spStr(searchParams, 'yearMax')}
            placeholder="To"
            className="h-8 text-sm"
            onBlur={e => update('yearMax', e.target.value)}
          />
        </div>
      </div>

      {uniqueMakes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Make</Label>
          <div className="space-y-1.5">
            {uniqueMakes.map(make => {
              const current = spStr(searchParams, 'makes').split(',').filter(Boolean)
              const checked = current.length === 0 || current.includes(make)
              return (
                <label key={make} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => toggleMake(make, v === true)}
                  />
                  {make}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          checked={spStr(searchParams, 'showExcluded') === 'true'}
          onCheckedChange={v => update('showExcluded', v === true ? 'true' : '')}
        />
        <Label className="text-xs text-muted-foreground cursor-pointer">Show excluded</Label>
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground animate-pulse">Updating…</p>
      )}
    </aside>
  )
}
