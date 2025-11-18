'use client'

import { create } from 'zustand'

const publisherAddress = (process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS || '').toLowerCase()

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

interface WalletState {
  address: string | null
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  setAddress: (address: string | null) => void
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnecting: false,
  error: null,

  connect: async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      set({ error: 'No EVM wallet detected' })
      return
    }

    set({ isConnecting: true, error: null })

    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
      const account = accounts?.[0] ? accounts[0].toLowerCase() : null
      set({ address: account, isConnecting: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet'
      set({ error: message, isConnecting: false })
    }
  },

  disconnect: () => set({ address: null }),

  setAddress: (address: string | null) => set({ address }),
}))

export function useIsPublisher(): boolean {
  const address = useWalletStore((state) => state.address)
  if (!address) return false
  return address.toLowerCase() === publisherAddress
}
