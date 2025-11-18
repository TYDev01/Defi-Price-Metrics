'use client'

import { useEffect } from 'react'
import { useWalletStore } from '@/lib/wallet-store'

export function WalletProvider() {
  const setAddress = useWalletStore((state) => state.setAddress)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return
    }

    const handleAccountsChanged = (accounts: string[]) => {
      const account = accounts?.[0] ? accounts[0].toLowerCase() : null
      setAddress(account)
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [setAddress])

  return null
}
