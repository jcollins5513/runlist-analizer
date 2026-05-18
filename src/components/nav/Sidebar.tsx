'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { LayoutDashboard, List, Database, Settings, BarChart2 } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import {
  Sidebar as AcetSidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from '@/components/ui/sidebar'

const links = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
  },
  {
    href: '/run-lists',
    label: 'Run Lists',
    icon: <List className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
  },
  {
    href: '/sources',
    label: 'Sources',
    icon: <Database className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
  },
]

function Logo() {
  const { open, animate } = useSidebar()
  return (
    <Link href="/dashboard" className="flex items-center gap-2 py-1 mb-6">
      <BarChart2 className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre"
      >
        Run List Analyzer
      </motion.span>
    </Link>
  )
}

export function Sidebar() {
  return (
    <AcetSidebar animate={true}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <Logo />
          <div className="flex flex-col gap-2">
            {links.map(link => (
              <SidebarLink key={link.href} link={link} />
            ))}
          </div>
        </div>
        <div>
          <UserButton />
        </div>
      </SidebarBody>
    </AcetSidebar>
  )
}
