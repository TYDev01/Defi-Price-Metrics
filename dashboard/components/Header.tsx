'use client'

import Link from 'next/link'
import { Activity, BellRing } from 'lucide-react'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { useWalletStore, useIsPublisher } from '@/lib/wallet-store'

export function Header() {
  const address = useWalletStore((state) => state.address)
  const isPublisher = useIsPublisher()

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
          <Link
            href="/watch"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            My Watch
          </Link>
          {address && isPublisher && (
            <Link
              href="/admin"
              className="text-sm font-medium text-primary"
            >
              Admin
            </Link>
          )}
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-up animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
          <Link
            href="https://t.me/defi_market_metrics"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <BellRing className="h-4 w-4" />
            Be Notified
          </Link>
          <ConnectWalletButton />
        </nav>
      </div>
    </header>
  )
}
