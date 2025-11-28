'use client'

import Link from 'next/link'
import { Activity, BellRing, Menu, X } from 'lucide-react'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { useWalletStore, useIsPublisher } from '@/lib/wallet-store'
import { useState } from 'react'

export function Header() {
  const address = useWalletStore((state) => state.address)
  const isPublisher = useIsPublisher()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          <span className="text-lg md:text-xl font-bold">DefiPrice Markets</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
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
            className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-3 xl:px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <BellRing className="h-4 w-4" />
            <span className="hidden xl:inline">Be Notified</span>
          </Link>
          <ConnectWalletButton />
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 lg:hidden">
          <ConnectWalletButton />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-muted-foreground hover:text-primary"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-background">
          <nav className="container px-4 py-4 flex flex-col space-y-4">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Markets
            </Link>
            <Link
              href="/heatmap"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Heatmap
            </Link>
            <Link
              href="/watch"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              My Watch
            </Link>
            {address && isPublisher && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
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
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 w-fit"
            >
              <BellRing className="h-4 w-4" />
              Be Notified
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
