import fs from 'fs'
import path from 'path'
import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let envLoaded = false

function ensureFirebaseEnv() {
  if (envLoaded) {
    return
  }
  envLoaded = true

  const hasFirebaseVars = () =>
    Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)

  if (hasFirebaseVars()) {
    return
  }

  try {
    // Attempt to hydrate from the repo root .env so API routes have the same secrets as the bot
    const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')
    loadEnvConfig(path.resolve(process.cwd(), '..'), process.env.NODE_ENV !== 'production')
  } catch (error) {
    console.warn('Failed to load Firebase env via @next/env', error)
  }

  if (hasFirebaseVars()) {
    return
  }

  const rootEnvPath = path.resolve(process.cwd(), '..', '.env')
  if (fs.existsSync(rootEnvPath)) {
    try {
      const { config } = require('dotenv') as typeof import('dotenv')
      config({ path: rootEnvPath })
    } catch (error) {
      console.warn('Failed to load Firebase env via dotenv', error)
    }
  }
}

ensureFirebaseEnv()

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

let firestoreInstance: ReturnType<typeof getFirestore> | null = null

if (projectId && clientEmail && privateKey) {
  const apps = getApps()
  const app = apps.length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })

  firestoreInstance = getFirestore(app)
} else {
  console.warn('Firebase Admin not fully configured; admin pairs persistence disabled')
}

export function getAdminFirestore() {
  if (!firestoreInstance) {
    throw new Error('Firebase Admin is not initialized')
  }
  return firestoreInstance
}
