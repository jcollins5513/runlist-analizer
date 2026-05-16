import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { LayoutDashboard, List, Database, Settings } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/run-lists', label: 'Run Lists', icon: List },
  { href: '/sources', label: 'Sources', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen border-r bg-background flex flex-col shrink-0">
      <div className="p-4">
        <p className="text-sm font-semibold tracking-tight">Run List Analyzer</p>
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </aside>
  )
}
