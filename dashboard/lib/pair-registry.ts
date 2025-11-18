'use client'

import { create } from 'zustand'

export interface ManagedPair {
  chain: string
  address: string
  label?: string
}

const basePairs: ManagedPair[] = (process.env.NEXT_PUBLIC_PAIR_KEYS || '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
  .map((entry) => {
    const [chain, address] = entry.split(':')
    return { chain: chain?.toLowerCase() || '', address: address?.toLowerCase() || '' }
  })
  .filter((pair) => pair.chain && pair.address)

const dedupePairs = (pairs: ManagedPair[]): ManagedPair[] => {
  const seen = new Set<string>()
  const output: ManagedPair[] = []

  for (const pair of pairs) {
    const key = pairKey(pair)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(pair)
  }

  return output
}

export const pairKey = (pair: ManagedPair): string => `${pair.chain}:${pair.address}`.toLowerCase()

interface PairRegistryState {
  basePairs: ManagedPair[]
  adminPairs: ManagedPair[]
  combinedPairs: ManagedPair[]
  initialized: boolean
  isLoading: boolean
  error: string | null
  hydrate: () => Promise<void>
  refresh: () => Promise<void>
  addAdminPair: (pair: ManagedPair, walletAddress: string) => Promise<void>
  removeAdminPair: (key: string, walletAddress: string) => Promise<void>
}

export const usePairRegistry = create<PairRegistryState>((set, get) => ({
  basePairs,
  adminPairs: [],
  combinedPairs: basePairs,
  initialized: false,
  isLoading: false,
  error: null,

  hydrate: async () => {
    if (get().initialized || typeof window === 'undefined') {
      return
    }
    await get().refresh()
    set({ initialized: true })
  },

  refresh: async () => {
    if (typeof window === 'undefined') {
      return
    }

    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/admin/pairs', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to load admin pairs: ${response.status}`)
      }
      const data = await response.json()
      const adminPairs = Array.isArray(data.pairs) ? (data.pairs as ManagedPair[]) : []
      set({
        adminPairs,
        combinedPairs: dedupePairs([...get().basePairs, ...adminPairs]),
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.warn('Failed to load admin pairs', error)
      set({ isLoading: false, error: (error as Error).message })
    }
  },

  addAdminPair: async (pair: ManagedPair, walletAddress: string) => {
    if (!walletAddress) {
      throw new Error('Wallet address required to add admin pairs')
    }

    const normalized: ManagedPair = {
      chain: pair.chain.toLowerCase(),
      address: pair.address.toLowerCase(),
      label: pair.label?.trim() || undefined,
    }

    const key = pairKey(normalized)
    const existsInBase = basePairs.some((base) => pairKey(base) === key)
    const existsInAdmin = get().adminPairs.some((existing) => pairKey(existing) === key)

    if (existsInBase || existsInAdmin) {
      throw new Error('Pair already exists')
    }

    const response = await fetch('/api/admin/pairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...normalized, walletAddress }),
    })

    if (!response.ok) {
      const message = await response.json().catch(() => ({}))
      throw new Error(message.error || 'Failed to add pair')
    }

    const updated = [...get().adminPairs, normalized]
    set({
      adminPairs: updated,
      combinedPairs: dedupePairs([...get().basePairs, ...updated]),
    })
  },

  removeAdminPair: async (key: string, walletAddress: string) => {
    if (!walletAddress) {
      throw new Error('Wallet address required to remove admin pairs')
    }

    const [chain, address] = key.split(':')
    const params = new URLSearchParams({ chain, address, walletAddress })
    const response = await fetch(`/api/admin/pairs?${params.toString()}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const message = await response.json().catch(() => ({}))
      throw new Error(message.error || 'Failed to remove pair')
    }

    const filtered = get().adminPairs.filter((pair) => pairKey(pair) !== key.toLowerCase())
    set({
      adminPairs: filtered,
      combinedPairs: dedupePairs([...get().basePairs, ...filtered]),
    })
  },
}))
