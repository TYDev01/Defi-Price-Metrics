'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { useWalletStore, useIsPublisher } from '@/lib/wallet-store'
import { getChainInfo } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface WatchPair {
  chain: string
  address: string
  label: string
}

interface WatchPrice {
  priceUsd: number
  change24h: number
  liquidity: number
  volume24h: number
  symbol: string
  timestamp: number
}

const STORAGE_PREFIX = 'defiprice.watchlist.'

const chainOptions = [
  'ethereum',
  'solana',
  'base',
  'arbitrum',
  'polygon',
  'bsc',
  'avalanche',
  'optimism',
  'fantom',
  'blast',
  'linea',
  'scroll',
]

export default function WatchPage() {
  const address = useWalletStore((state) => state.address)
  const connect = useWalletStore((state) => state.connect)
  const isPublisher = useIsPublisher()

  const [chain, setChain] = useState('ethereum')
  const [pairAddress, setPairAddress] = useState('')
  const [label, setLabel] = useState('')
  const [watchlist, setWatchlist] = useState<WatchPair[]>([])
  const [prices, setPrices] = useState<Record<string, WatchPrice | null>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const storageKey = useMemo(() => (address ? `${STORAGE_PREFIX}${address}` : null), [address])

  useEffect(() => {
    if (!storageKey) {
      setWatchlist([])
      return
    }

    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        setWatchlist(JSON.parse(stored))
      } else {
        setWatchlist([])
      }
    } catch (error) {
      console.warn('Failed to load watchlist', error)
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) {
      return
    }
    window.localStorage.setItem(storageKey, JSON.stringify(watchlist))
  }, [watchlist, storageKey])

  useEffect(() => {
    if (!watchlist.length) {
      setPrices({})
      return
    }

    let cancelled = false

    const fetchPrices = async () => {
      const entries = await Promise.all(
        watchlist.map(async (pair) => {
          try {
            const data = await fetchDexscreener(pair.chain, pair.address)
            return [pairKey(pair), data] as const
          } catch (error) {
            console.warn('Watchlist fetch failed', error)
            return [pairKey(pair), null] as const
          }
        })
      )

      if (!cancelled) {
        setPrices(Object.fromEntries(entries))
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [watchlist])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!pairAddress.trim()) {
      setFormError('Pair address is required')
      return
    }

    if (!address) {
      setFormError('Connect wallet to save your watchlist')
      return
    }

    const entry: WatchPair = {
      chain,
      address: pairAddress.trim(),
      label: label.trim() || `${chain.toUpperCase()} Pair`,
    }

    const key = pairKey(entry)
    const exists = watchlist.some((pair) => pairKey(pair) === key)
    if (exists) {
      setFormError('Pair already in your watchlist')
      return
    }

    setWatchlist((prev) => [...prev, entry])
    setPairAddress('')
    setLabel('')
  }

  const removePair = (key: string) => {
    setWatchlist((prev) => prev.filter((pair) => pairKey(pair) !== key))
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold mb-4">My Watch</h1>
          <p className="mb-6 text-muted-foreground">
            Connect any wallet to build a private watchlist that lives in your browser.
          </p>
          <button onClick={connect} className="rounded-full bg-primary px-6 py-3 text-primary-foreground">
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  if (isPublisher) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold mb-4">Watchlist Disabled</h1>
          <p className="text-muted-foreground">
            The publisher wallet manages the global dashboard. Switch to a personal wallet or head over to the{' '}
            <Link href="/admin" className="text-primary underline">admin console</Link> instead.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-10">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Watch</h1>
          <p className="text-muted-foreground max-w-2xl">
            Track personal pairs with real-time DexScreener data. Everything stays local to your wallet/browser.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Chain</label>
              <select
                value={chain}
                onChange={(event) => setChain(event.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {chainOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Pair Address</label>
              <input
                value={pairAddress}
                onChange={(event) => setPairAddress(event.target.value)}
                placeholder="0x..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Label</label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="WETH/USDC"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-4 flex flex-wrap items-center gap-4">
              <button type="submit" className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">
                Add to Watchlist
              </button>
              {formError && <span className="text-sm text-red-500">{formError}</span>}
            </div>
          </form>
        </Card>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Tracked Pairs</h2>
          {watchlist.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pairs yet. Add one above to get started.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {watchlist.map((pair) => {
                const key = pairKey(pair)
                const snapshot = prices[key]
                const info = getChainInfo(pair.chain)
                const change = snapshot?.change24h ?? 0
                const trendPositive = change >= 0

                return (
                  <Card key={key} className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold flex items-center gap-2">
                          <span>{info.icon}</span>
                          {pair.label}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">{pair.chain}</p>
                      </div>
                      <button
                        onClick={() => removePair(key)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    {snapshot ? (
                      <>
                        <p className="text-2xl font-bold">${snapshot.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                        <div className="flex items-center text-sm gap-2">
                          {trendPositive ? (
                            <TrendingUp className="h-4 w-4 text-up" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-down" />
                          )}
                          <span className={trendPositive ? 'text-up' : 'text-down'}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </span>
                          <span className="text-muted-foreground">
                            • Liquidity ${formatCompact(snapshot.liquidity)} • 24h Vol ${formatCompact(snapshot.volume24h)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Last updated {new Date(snapshot.timestamp * 1000).toLocaleTimeString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Waiting for DexScreener data…</p>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function pairKey(pair: WatchPair): string {
  return `${pair.chain.toLowerCase()}:${pair.address.toLowerCase()}`
}

async function fetchDexscreener(chain: string, address: string): Promise<WatchPrice> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${address}`)
  if (!response.ok) {
    throw new Error(`DexScreener HTTP ${response.status}`)
  }

  const payload = await response.json()
  const pair = payload?.pairs?.[0]
  if (!pair || !pair.priceUsd) {
    throw new Error('Pair not found')
  }

  return {
    priceUsd: parseFloat(pair.priceUsd),
    change24h: pair.priceChange?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    symbol: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    timestamp: Math.floor(Date.now() / 1000),
  }
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(2)
}
