'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">DefiPrice Markets</span>
        </Link>
        
        <nav className="flex items-center space-x-6">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Markets
          </Link>
          <Link
            href="/heatmap"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Heatmap
          </Link>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-up animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </nav>
      </div>
    </header>
  )
}
