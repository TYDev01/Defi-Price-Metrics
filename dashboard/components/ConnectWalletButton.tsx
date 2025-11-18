'use client'

import { useWalletStore, useIsPublisher } from '@/lib/wallet-store'
import { truncateAddress } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export function ConnectWalletButton() {
  const address = useWalletStore((state) => state.address)
  const isConnecting = useWalletStore((state) => state.isConnecting)
  const connect = useWalletStore((state) => state.connect)
  const disconnect = useWalletStore((state) => state.disconnect)
  const isPublisher = useIsPublisher()

  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>
    )
  }

  return (
    <button
      onClick={disconnect}
      className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
    >
      <span className="hidden sm:inline">{isPublisher ? 'Admin' : 'Wallet'}</span>
      <span>{truncateAddress(address)}</span>
    </button>
  )
}
