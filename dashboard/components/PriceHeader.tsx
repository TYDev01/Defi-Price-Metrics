'use client'

import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePriceStore } from '@/lib/store'
import { formatPrice, formatPercentage, getChangeColor, getChainInfo } from '@/lib/utils'

interface PriceHeaderProps {
  pairKey: string
}

export function PriceHeader({ pairKey }: PriceHeaderProps) {
  const pair = usePriceStore((state) => state.getPair(pairKey))

  if (!pair?.data) {
    return (
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Markets
        </Link>
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  const chainInfo = getChainInfo(pair.data.chain)
  const change24h = pair.data.priceChange24h
  const change1h = pair.data.priceChange1h

  return (
    <div className="mb-6">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Markets
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-3xl">{chainInfo.icon}</span>
            <div>
              <h1 className="text-4xl font-bold">{pair.data.pair}</h1>
              <p className="text-muted-foreground">{chainInfo.name}</p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <motion.div
            key={pair.data.priceUsd.toString()}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold mb-2"
          >
            {formatPrice(pair.data.priceUsd)}
          </motion.div>
          
          <div className="flex items-center space-x-4 justify-end">
            <div className={`text-sm ${getChangeColor(change1h)}`}>
              1h: {formatPercentage(change1h)}
            </div>
            <div className={`text-sm ${getChangeColor(change24h)}`}>
              24h: {formatPercentage(change24h)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
