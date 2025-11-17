import { create } from 'zustand'

export interface PriceData {
  timestamp: bigint
  pair: string
  chain: string
  priceUsd: bigint
  liquidity: bigint
  volume24h: bigint
  priceChange1h: number
  priceChange24h: number
}

export interface PairState {
  key: string
  data: PriceData | null
  history: Array<{ time: number; value: number }>
  lastUpdate: number
}

interface PriceStore {
  pairs: Map<string, PairState>
  isConnected: boolean
  error: string | null
  
  updatePair: (key: string, data: PriceData) => void
  addHistoryPoint: (key: string, time: number, value: number) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
  getPair: (key: string) => PairState | undefined
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  pairs: new Map(),
  isConnected: false,
  error: null,

  updatePair: (key: string, data: PriceData) => {
    set((state) => {
      const pairs = new Map(state.pairs)
      const existing = pairs.get(key)
      
      const priceUsd = Number(data.priceUsd) / 1e18
      const now = Date.now() / 1000

      pairs.set(key, {
        key,
        data,
        history: existing?.history || [],
        lastUpdate: Date.now(),
      })

      return { pairs }
    })
  },

  addHistoryPoint: (key: string, time: number, value: number) => {
    set((state) => {
      const pairs = new Map(state.pairs)
      const existing = pairs.get(key)

      if (existing) {
        const history = [...existing.history, { time, value }]
        
        // Keep only last 1000 points
        if (history.length > 1000) {
          history.shift()
        }

        pairs.set(key, {
          ...existing,
          history,
        })
      }

      return { pairs }
    })
  },

  setConnected: (connected: boolean) => set({ isConnected: connected }),
  
  setError: (error: string | null) => set({ error }),
  
  getPair: (key: string) => {
    return get().pairs.get(key)
  },
}))
