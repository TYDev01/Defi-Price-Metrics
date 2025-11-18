'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useWalletStore, useIsPublisher } from '@/lib/wallet-store'
import { usePairRegistry, pairKey, type ManagedPair } from '@/lib/pair-registry'
import { Card } from '@/components/ui/card'
import { getChainInfo } from '@/lib/utils'

const CHAIN_OPTIONS = [
  'ethereum',
  'solana',
  'base',
  'arbitrum',
  'polygon',
  'bsc',
  'avalanche',
  'optimism',
  'fantom',
  'blast',
  'linea',
  'scroll',
]

export default function AdminPage() {
  const address = useWalletStore((state) => state.address)
  const connect = useWalletStore((state) => state.connect)
  const isPublisher = useIsPublisher()
  const addAdminPair = usePairRegistry((state) => state.addAdminPair)
  const removeAdminPair = usePairRegistry((state) => state.removeAdminPair)
  const adminPairs = usePairRegistry((state) => state.adminPairs)
  const basePairs = usePairRegistry((state) => state.basePairs)
  const isRegistryLoading = usePairRegistry((state) => state.isLoading)
  const registryError = usePairRegistry((state) => state.error)

  const [chain, setChain] = useState('ethereum')
  const [addressInput, setAddressInput] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const knownPairs = useMemo(() => basePairs.map((pair) => pairKey(pair)), [basePairs])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!addressInput.trim()) {
      setError('Pair address is required')
      return
    }

    const formatted: ManagedPair = {
      chain,
      address: addressInput.trim(),
      label: label.trim() || undefined,
    }

    const key = pairKey(formatted)
    if (knownPairs.includes(key)) {
      setError('Pair already exists in base configuration')
      return
    }

    if (!address) {
      setError('Connect with the publisher wallet to add pairs')
      return
    }

    try {
      await addAdminPair(formatted, address)
      setSuccess('Pair added to dashboard list')
      setAddressInput('')
      setLabel('')
    } catch (addError) {
      setError((addError as Error).message)
    }
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold mb-4">Admin Access</h1>
          <p className="mb-6 text-muted-foreground">
            Connect with the publisher wallet to manage globally visible trading pairs.
          </p>
          <button onClick={connect} className="rounded-full bg-primary px-6 py-3 text-primary-foreground">
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  if (!isPublisher) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground">
            This page is reserved for the publisher wallet defined in the environment variables. Switch to your
            personal wallet to manage <Link href="/watch" className="text-primary underline">My Watch</Link> instead.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-10">
        <div>
          <h1 className="text-4xl font-bold mb-2">Admin – Global Pairs</h1>
          <p className="text-muted-foreground max-w-2xl">
            Add or remove trading pairs that should appear on the public dashboard. Remember to keep the bot configuration in sync so the new pairs receive Somnia updates.
          </p>
        </div>

        <Card className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Chain</label>
              <select
                value={chain}
                onChange={(event) => setChain(event.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CHAIN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Pair Address</label>
              <input
                value={addressInput}
                onChange={(event) => setAddressInput(event.target.value)}
                placeholder="0x..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Label (optional)</label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="WETH/USDC"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-3 flex flex-wrap items-center gap-4">
              <button type="submit" className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">
                Add Pair
              </button>
              {error && <span className="text-sm text-red-500">{error}</span>}
              {success && <span className="text-sm text-up">{success}</span>}
            </div>
          </form>
        </Card>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Custom Pairs</h2>
          {adminPairs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No custom pairs added yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {adminPairs.map((pair) => {
                const info = getChainInfo(pair.chain)
                const key = pairKey(pair)
                return (
                  <Card key={key} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        <span>{info.icon}</span>
                        {pair.label || pair.address}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">{pair.chain}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!address) {
                          setError('Connect with the publisher wallet to remove pairs')
                          return
                        }
                        try {
                          await removeAdminPair(key, address)
                          setSuccess('Pair removed')
                        } catch (removeError) {
                          setError((removeError as Error).message)
                        }
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </Card>
                )
              })}
            </div>
          )}
          {registryError && (
            <p className="text-sm text-red-500 mt-4">{registryError}</p>
          )}
          {isRegistryLoading && (
            <p className="text-xs text-muted-foreground mt-2">Loading admin pairs...</p>
          )}
        </section>
      </div>
    </div>
  )
}
