'use client'

import { useEffect } from 'react'
import { useWalletStore } from '@/lib/wallet-store'

export function WalletProvider() {
  const setAddress = useWalletStore((state) => state.setAddress)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : []
      const first = typeof list[0] === 'string' ? list[0] : null
      const account = first ? first.toLowerCase() : null
      setAddress(account)
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [setAddress])

  return null
}
