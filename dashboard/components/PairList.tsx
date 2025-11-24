'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { usePriceStore } from '@/lib/store'
import { useSomniaStreams } from '@/hooks/useSomniaStreams'
import { formatPrice, formatPercentage, getChangeColor, getChainInfo } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { usePairRegistry, pairKey as buildPairKey } from '@/lib/pair-registry'

export function PairList() {
  const combinedPairs = usePairRegistry((state) => state.combinedPairs)
  const pairKeys = useMemo(() => combinedPairs.map((pair) => buildPairKey(pair)), [combinedPairs])

  useSomniaStreams(pairKeys)
  
  const pairsFromStore = usePriceStore((state) => Array.from(state.pairs.values()))

  // Create a map of pairs with data
  const pairsMap = useMemo(() => {
    const map = new Map()
    pairsFromStore.forEach(pair => map.set(pair.key, pair))
    return map
  }, [pairsFromStore])

  // Merge configured pairs with data from store
  const allPairs = useMemo(() => {
    return pairKeys.map(key => ({
      key,
      data: pairsMap.get(key)?.data || null,
      hasData: pairsMap.has(key),
    }))
  }, [pairKeys, pairsMap])

  const sortedPairs = useMemo(() => {
    // Sort: pairs with data first (by change), then pairs without data
    return [...allPairs].sort((a, b) => {
      if (a.hasData && !b.hasData) return -1
      if (!a.hasData && b.hasData) return 1
      if (a.hasData && b.hasData) {
        const aChange = a.data?.priceChange24h || 0
        const bChange = b.data?.priceChange24h || 0
        return bChange - aChange
      }
      return 0
    })
  }, [allPairs])

  if (allPairs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/30 p-10 text-center">
        <p className="text-lg font-medium">No pairs configured</p>
        <p className="text-sm text-muted-foreground mt-2">
          Add pairs in the admin panel to start tracking prices.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedPairs.map((pair, index) => (
        <PairCard key={pair.key} pair={pair} index={index} />
      ))}
    </div>
  )
}

function PairCard({ pair, index }: { pair: any; index: number }) {
  const [chain, address] = pair.key.split(':')
  
  // Show skeleton/placeholder for pairs without data
  if (!pair.data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className="p-6 border-dashed opacity-60">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{getChainInfo(chain).icon}</span>
                <h3 className="text-lg font-semibold">{chain.toUpperCase()}</h3>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{address.slice(0, 8)}...{address.slice(-6)}</p>
            </div>
            <div className="flex items-center space-x-1 text-muted-foreground">
              <span className="text-sm">Waiting for data...</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-muted-foreground">
                —
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">24h Volume</p>
                <p className="font-medium text-muted-foreground">—</p>
              </div>
              <div>
                <p className="text-muted-foreground">Liquidity</p>
                <p className="font-medium text-muted-foreground">—</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    )
  }

  const chainInfo = getChainInfo(pair.data.chain)
  const change24h = pair.data.priceChange24h
  const isPositive = change24h >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/pair/${encodeURIComponent(pair.key)}`}>
        <Card className="p-6 hover:border-primary transition-all duration-200 cursor-pointer glow-border">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{chainInfo.icon}</span>
                <h3 className="text-lg font-semibold">{pair.data.pair}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{chainInfo.name}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getChangeColor(change24h)}`}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {formatPercentage(change24h)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <motion.div
                key={pair.data.priceUsd.toString()}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-bold"
              >
                {formatPrice(pair.data.priceUsd)}
              </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">24h Volume</p>
                <p className="font-medium">
                  ${(Number(pair.data.volume24h) / 1e18).toLocaleString(undefined, {
                    notation: 'compact',
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Liquidity</p>
                <p className="font-medium">
                  ${(Number(pair.data.liquidity) / 1e18).toLocaleString(undefined, {
                    notation: 'compact',
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
