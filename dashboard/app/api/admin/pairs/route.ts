import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'

const COLLECTION = 'adminPairs'
const publisherAddress = (process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS || '').toLowerCase()

interface AdminPairPayload {
  chain: string
  address: string
  label?: string
  walletAddress?: string
}

function requireFirestore() {
  try {
    return getAdminFirestore()
  } catch (error) {
    throw new Error('Firestore not configured: ' + (error as Error).message)
  }
}

export async function GET() {
  try {
    const firestore = requireFirestore()
    const snapshot = await firestore.collection(COLLECTION).get()
    const pairs = snapshot.docs.map((doc) => doc.data())
    return NextResponse.json({ pairs })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const firestore = requireFirestore()
    const payload = (await request.json()) as AdminPairPayload

    validatePublisher(payload.walletAddress)
    const pair = normalizePair(payload)

    const docId = `${pair.chain}:${pair.address}`
    await firestore.collection(COLLECTION).doc(docId).set({ ...pair, createdAt: Date.now() })

    return NextResponse.json({ pair })
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const firestore = requireFirestore()
    const { searchParams } = new URL(request.url)
    const chain = searchParams.get('chain')
    const address = searchParams.get('address')
    const walletAddress = searchParams.get('walletAddress')

    validatePublisher(walletAddress || undefined)

    if (!chain || !address) {
      throw new Error('Missing chain or address')
    }

    const docId = `${chain.toLowerCase()}:${address.toLowerCase()}`
    await firestore.collection(COLLECTION).doc(docId).delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}

function normalizePair(payload: AdminPairPayload) {
  if (!payload.chain || !payload.address) {
    throw new Error('Chain and address are required')
  }

  const normalized: { chain: string; address: string; label?: string } = {
    chain: payload.chain.toLowerCase(),
    address: payload.address.toLowerCase(),
  }

  const trimmedLabel = payload.label?.trim()
  if (trimmedLabel) {
    normalized.label = trimmedLabel
  }

  return normalized
}

class UnauthorizedError extends Error {}

function validatePublisher(walletAddress?: string) {
  if (!walletAddress) {
    throw new UnauthorizedError('Missing wallet address')
  }

  if (!publisherAddress) {
    throw new UnauthorizedError('Publisher address not configured')
  }

  if (walletAddress.toLowerCase() !== publisherAddress) {
    throw new UnauthorizedError('Only the publisher wallet can modify admin pairs')
  }
}
