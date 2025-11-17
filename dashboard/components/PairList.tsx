'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { usePriceStore } from '@/lib/store'
import { useSomniaStreams } from '@/hooks/useSomniaStreams'
import { formatPrice, formatPercentage, getChangeColor, getChainInfo } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function PairList() {
  useSomniaStreams()
  
  const pairs = usePriceStore((state) => Array.from(state.pairs.values()))

  const sortedPairs = useMemo(() => {
    return [...pairs].sort((a, b) => {
      const aChange = a.data?.priceChange24h || 0
      const bChange = b.data?.priceChange24h || 0
      return bChange - aChange
    })
  }, [pairs])

  if (pairs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting to live markets...</p>
        </div>
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
  if (!pair.data) return null

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
