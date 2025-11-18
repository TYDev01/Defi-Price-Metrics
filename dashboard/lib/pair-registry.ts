'use client'

import { create } from 'zustand'

export interface ManagedPair {
  chain: string
  address: string
  label?: string
}

const ADMIN_STORAGE_KEY = 'defiprice.adminPairs'

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
  hydrate: () => void
  addAdminPair: (pair: ManagedPair) => void
  removeAdminPair: (key: string) => void
}

export const usePairRegistry = create<PairRegistryState>((set, get) => ({
  basePairs,
  adminPairs: [],
  combinedPairs: basePairs,
  initialized: false,

  hydrate: () => {
    if (get().initialized) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = window.localStorage.getItem(ADMIN_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ManagedPair[]
        set({
          adminPairs: parsed,
          combinedPairs: dedupePairs([...basePairs, ...parsed]),
          initialized: true,
        })
        return
      }
    } catch (error) {
      console.warn('Failed to parse stored admin pairs', error)
    }

    set({ initialized: true })
  },

  addAdminPair: (pair: ManagedPair) => {
    const normalized: ManagedPair = {
      chain: pair.chain.toLowerCase(),
      address: pair.address.toLowerCase(),
      label: pair.label?.trim() || undefined,
    }

    const key = pairKey(normalized)
    const existsInBase = basePairs.some((base) => pairKey(base) === key)
    const existsInAdmin = get().adminPairs.some((existing) => pairKey(existing) === key)

    if (existsInBase || existsInAdmin) {
      return
    }

    const updated = [...get().adminPairs, normalized]
    set({
      adminPairs: updated,
      combinedPairs: dedupePairs([...get().basePairs, ...updated]),
    })

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated))
    }
  },

  removeAdminPair: (key: string) => {
    const filtered = get().adminPairs.filter((pair) => pairKey(pair) !== key.toLowerCase())
    set({
      adminPairs: filtered,
      combinedPairs: dedupePairs([...get().basePairs, ...filtered]),
    })

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(filtered))
    }
  },
}))
