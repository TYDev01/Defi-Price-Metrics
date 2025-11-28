'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { useSomniaPriceHistory } from '@/hooks/useSomniaPriceHistory'
import { Card } from '@/components/ui/card'

interface TradingChartProps {
  pairKey: string
}

export function TradingChart({ pairKey }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  
  // Parse chain and pairAddress from pairKey (format: "chain:address")
  const [chain, pairAddress] = pairKey.split(':')
  
  // Load historical data from Somnia Data Streams
  const { history, isLoading, error, lastUpdate } = useSomniaPriceHistory(chain, pairAddress, {
    refreshInterval: 90000, // Refresh every 90 seconds
    maxEntries: 1000,
    autoRefresh: true,
    mode: 'recent',
  })

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: window.innerWidth < 768 ? 300 : 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    })

    const series = chart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  const chartHistory = useMemo(
    () => history.map((point) => ({ 
      time: Math.floor(point.timestamp) as UTCTimestamp, 
      value: point.priceUsd 
    })),
    [history]
  )

  useEffect(() => {
    if (seriesRef.current && chartHistory.length > 0) {
      seriesRef.current.setData(chartHistory)
    }
  }, [chartHistory])

  return (
    <Card className="p-4 md:p-6">
      <div className="mb-3 md:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base md:text-lg font-semibold">Price Chart</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isLoading ? 'Loading historical data from Somnia...' : 
             error ? `Error: ${error}` :
             `${history.length} data points from Somnia Data Streams`}
          </p>
        </div>
        {lastUpdate && (
          <div className="text-xs text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="chart-container" />
    </Card>
  )
}
