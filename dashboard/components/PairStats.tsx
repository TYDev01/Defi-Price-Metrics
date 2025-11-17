'use client'

import { Card } from '@/components/ui/card'
import { usePriceStore } from '@/lib/store'
import { formatLargeNumber, formatPercentage, getChangeColor } from '@/lib/utils'
import { TrendingUp, DollarSign, Activity, BarChart3 } from 'lucide-react'

interface PairStatsProps {
  pairKey: string
}

export function PairStats({ pairKey }: PairStatsProps) {
  const pair = usePriceStore((state) => state.getPair(pairKey))

  if (!pair?.data) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    )
  }

  const stats = [
    {
      label: '24h Volume',
      value: formatLargeNumber(pair.data.volume24h),
      icon: BarChart3,
      color: 'text-blue-400',
    },
    {
      label: 'Liquidity',
      value: formatLargeNumber(pair.data.liquidity),
      icon: DollarSign,
      color: 'text-green-400',
    },
    {
      label: '1h Change',
      value: formatPercentage(pair.data.priceChange1h),
      icon: TrendingUp,
      color: getChangeColor(pair.data.priceChange1h),
    },
    {
      label: '24h Change',
      value: formatPercentage(pair.data.priceChange24h),
      icon: Activity,
      color: getChangeColor(pair.data.priceChange24h),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Market Stats</h2>
        <div className="space-y-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <span className={`font-semibold ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Pair Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pair</span>
            <span className="font-medium">{pair.data.pair}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Chain</span>
            <span className="font-medium capitalize">{pair.data.chain}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Update</span>
            <span className="font-medium">
              {new Date(pair.lastUpdate).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
