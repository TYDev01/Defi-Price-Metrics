'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  loadPriceHistory,
  loadRecentHistory,
  generatePairKey,
  historyCache,
  type HistoricalPricePoint,
} from '@/lib/somnia-history'

export interface UsePriceHistoryOptions {
  /**
   * Auto-refresh interval in milliseconds
   * Default: 90000 (90 seconds)
   */
  refreshInterval?: number
  
  /**
   * Maximum number of recent entries to load
   * Default: 1000
   */
  maxEntries?: number
  
  /**
   * Enable/disable auto-refresh
   * Default: true
   */
  autoRefresh?: boolean
  
  /**
   * Load all history or just recent
   * Default: 'recent'
   */
  mode?: 'all' | 'recent'
}

export interface UsePriceHistoryResult {
  history: HistoricalPricePoint[]
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  refresh: () => Promise<void>
}

/**
 * React hook to load and manage historical price data from Somnia Data Streams
 * 
 * Features:
 * - Automatic caching to reduce RPC calls
 * - Auto-refresh every 60-120 seconds
 * - Pagination support for large datasets
 * - Non-blocking UI updates
 * 
 * @param chain - Chain identifier (e.g., 'ethereum', 'solana')
 * @param pairAddress - Pair contract address
 * @param options - Configuration options
 */
export function useSomniaPriceHistory(
  chain: string,
  pairAddress: string,
  options: UsePriceHistoryOptions = {}
): UsePriceHistoryResult {
  const {
    refreshInterval = 90000, // 90 seconds default
    maxEntries = 1000,
    autoRefresh = true,
    mode = 'recent',
  } = options

  const [history, setHistory] = useState<HistoricalPricePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  
  const pairKey = generatePairKey(chain, pairAddress)
  const cacheKey = `${chain}:${pairAddress}`
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLoadingRef = useRef(false)

  /**
   * Load historical data from Somnia
   */
  const loadHistory = useCallback(async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.log('Already loading history, skipping...')
      return
    }

    isLoadingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      // Check cache first
      const cached = historyCache.get(cacheKey)
      if (cached && cached.length > 0) {
        console.log(`Using cached history for ${cacheKey} (${cached.length} entries)`)
        setHistory(cached)
        setLastUpdate(new Date())
        setIsLoading(false)
        isLoadingRef.current = false
        return
      }

      console.log(`Loading ${mode} history for ${cacheKey}...`)
      
      // Load from Somnia Data Streams
      const data = mode === 'all'
        ? await loadPriceHistory(pairKey)
        : await loadRecentHistory(pairKey, maxEntries)

      if (data.length === 0) {
        console.warn(`No historical data found for ${cacheKey}`)
        setError('No historical data available yet')
      } else {
        console.log(`Loaded ${data.length} historical entries for ${cacheKey}`)
        
        // Update cache
        historyCache.set(cacheKey, data)
        
        setHistory(data)
        setLastUpdate(new Date())
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history'
      console.error(`Error loading history for ${cacheKey}:`, err)
      setError(message)
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [chain, pairAddress, pairKey, cacheKey, mode, maxEntries])

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    // Clear cache to force fresh load
    historyCache.clear()
    await loadHistory()
  }, [loadHistory])

  /**
   * Initial load on mount
   */
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  /**
   * Set up auto-refresh timer
   */
  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    console.log(`Setting up auto-refresh for ${cacheKey} every ${refreshInterval}ms`)

    refreshTimerRef.current = setInterval(() => {
      console.log(`Auto-refreshing history for ${cacheKey}`)
      
      // Clear cache before refresh to get fresh data
      historyCache.clear()
      
      loadHistory()
    }, refreshInterval)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [autoRefresh, refreshInterval, cacheKey, loadHistory])

  return {
    history,
    isLoading,
    error,
    lastUpdate,
    refresh,
  }
}

/**
 * Hook to load history for multiple pairs
 * Useful for overview pages
 */
export function useMultiplePriceHistories(
  pairs: Array<{ chain: string; pairAddress: string }>,
  options: UsePriceHistoryOptions = {}
): Record<string, UsePriceHistoryResult> {
  const [results, setResults] = useState<Record<string, UsePriceHistoryResult>>({})

  useEffect(() => {
    const loadMultiple = async () => {
      const newResults: Record<string, UsePriceHistoryResult> = {}

      for (const pair of pairs) {
        const key = `${pair.chain}:${pair.pairAddress}`
        const pairKey = generatePairKey(pair.chain, pair.pairAddress)

        try {
          const cached = historyCache.get(key)
          
          if (cached) {
            newResults[key] = {
              history: cached,
              isLoading: false,
              error: null,
              lastUpdate: new Date(),
              refresh: async () => {},
            }
            continue
          }

          const history = await loadRecentHistory(pairKey, options.maxEntries || 1000)
          historyCache.set(key, history)

          newResults[key] = {
            history,
            isLoading: false,
            error: null,
            lastUpdate: new Date(),
            refresh: async () => {},
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load'
          newResults[key] = {
            history: [],
            isLoading: false,
            error: message,
            lastUpdate: null,
            refresh: async () => {},
          }
        }
      }

      setResults(newResults)
    }

    loadMultiple()
  }, [pairs, options.maxEntries])

  return results
}
