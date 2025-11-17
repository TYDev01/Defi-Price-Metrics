'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { usePriceStore } from '@/lib/store'
import { useSomniaStreams } from '@/hooks/useSomniaStreams'
import { formatPercentage, getChainInfo } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export function Heatmap() {
  useSomniaStreams()
  
  const pairs = usePriceStore((state) => Array.from(state.pairs.values()))

  const sortedPairs = useMemo(() => {
    return [...pairs]
      .filter((p) => p.data)
      .sort((a, b) => {
        const aChange = a.data?.priceChange24h || 0
        const bChange = b.data?.priceChange24h || 0
        return bChange - aChange
      })
  }, [pairs])

  const gainers = sortedPairs.filter((p) => (p.data?.priceChange24h || 0) > 0).slice(0, 5)
  const losers = sortedPairs.filter((p) => (p.data?.priceChange24h || 0) < 0).slice(-5).reverse()

  if (pairs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Market insights arrive soon</h2>
        <p className="text-sm text-muted-foreground">
          Once data starts streaming, top gainers, losers, and the overview heatmap will appear here automatically.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-up">Top Gainers (24h)</h2>
        <div className="space-y-3">
          {gainers.map((pair, index) => (
            <HeatmapItem key={pair.key} pair={pair} index={index} type="gainer" />
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-down">Top Losers (24h)</h2>
        <div className="space-y-3">
          {losers.map((pair, index) => (
            <HeatmapItem key={pair.key} pair={pair} index={index} type="loser" />
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:col-span-2">
        <h2 className="text-2xl font-bold mb-4">Market Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pairs.map((pair, index) => {
            if (!pair.data) return null
            const change = pair.data.priceChange24h
            const intensity = Math.min(Math.abs(change) / 1000, 1)
            const bgColor = change >= 0
              ? `rgba(34, 197, 94, ${intensity * 0.3})`
              : `rgba(239, 68, 68, ${intensity * 0.3})`

            return (
              <motion.div
                key={pair.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className="p-4 rounded-lg border"
                style={{ backgroundColor: bgColor }}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <span>{getChainInfo(pair.data.chain).icon}</span>
                  <span className="font-medium text-sm">{pair.data.pair}</span>
                </div>
                <div className={change >= 0 ? 'text-up' : 'text-down'}>
                  <span className="text-lg font-bold">
                    {formatPercentage(change)}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function HeatmapItem({
  pair,
  index,
  type,
}: {
  pair: any
  index: number
  type: 'gainer' | 'loser'
}) {
  if (!pair.data) return null

  const chainInfo = getChainInfo(pair.data.chain)
  const change = pair.data.priceChange24h
  const percentage = change / 100

  return (
    <motion.div
      initial={{ opacity: 0, x: type === 'gainer' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center justify-between p-4 rounded-lg border hover:border-primary transition-colors"
    >
      <div className="flex items-center space-x-3">
        <div className="text-2xl font-bold text-muted-foreground">
          #{index + 1}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-lg">{chainInfo.icon}</span>
          <div>
            <div className="font-semibold">{pair.data.pair}</div>
            <div className="text-xs text-muted-foreground">{chainInfo.name}</div>
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className={`text-2xl font-bold ${type === 'gainer' ? 'text-up' : 'text-down'}`}>
          {formatPercentage(change)}
        </div>
        <div className="text-xs text-muted-foreground">
          ${(Number(pair.data.volume24h) / 1e18).toLocaleString(undefined, {
            notation: 'compact',
            maximumFractionDigits: 1,
          })}{' '}
          vol
        </div>
      </div>
    </motion.div>
  )
}
