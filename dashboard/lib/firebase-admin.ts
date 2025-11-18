import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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
