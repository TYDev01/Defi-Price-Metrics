'use client'

import { useEffect } from 'react'
import { usePairRegistry } from '@/lib/pair-registry'

export function PairRegistryInitializer() {
  const hydrate = usePairRegistry((state) => state.hydrate)
  const initialized = usePairRegistry((state) => state.initialized)

  useEffect(() => {
    if (!initialized) {
      hydrate()
    }
  }, [hydrate, initialized])

  return null
}
