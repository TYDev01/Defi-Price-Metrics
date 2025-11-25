import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

export interface ManagedPair {
  chain: string;
  address: string;
  label?: string;
}

/**
 * Firebase sync service for dynamically loading admin pairs
 */
export class FirebaseSync {
  private app: App | null = null;
  private db: Firestore | null = null;
  private enabled = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initialize(): void {
    try {
      // Check if Firebase is already initialized
      if (getApps().length > 0) {
        this.app = getApps()[0];
        this.db = getFirestore(this.app);
        this.enabled = true;
        logger.info('Firebase Admin SDK already initialized');
        return;
      }

      // Try to load service account from various locations
      const possiblePaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        path.resolve(__dirname, '../../../firebase-service-account.json'),
        path.resolve(__dirname, '../../firebase-service-account.json'),
        path.resolve(process.cwd(), 'firebase-service-account.json'),
      ].filter(Boolean) as string[];

      let serviceAccount: any = null;

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          try {
            serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            logger.info(`Loaded Firebase service account from: ${filePath}`);
            break;
          } catch (error) {
            logger.warn(`Failed to parse Firebase service account at ${filePath}`);
          }
        }
      }

      if (!serviceAccount) {
        logger.warn('Firebase service account not found - admin pair sync disabled');
        logger.info('To enable: Set FIREBASE_SERVICE_ACCOUNT_PATH or place firebase-service-account.json in project root');
        return;
      }

      // Initialize Firebase Admin
      this.app = initializeApp({
        credential: cert(serviceAccount),
      });

      this.db = getFirestore(this.app);
      this.enabled = true;
      logger.info('Firebase Admin SDK initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase Admin SDK:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if Firebase sync is available
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Fetch admin pairs from Firebase
   */
  public async fetchAdminPairs(): Promise<ManagedPair[]> {
    if (!this.enabled || !this.db) {
      return [];
    }

    try {
      const pairsRef = this.db.collection('adminPairs');
      const snapshot = await pairsRef.get();

      if (snapshot.empty) {
        logger.debug('No admin pairs found in Firebase');
        return [];
      }

      const pairs: ManagedPair[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.chain && data.address) {
          pairs.push({
            chain: data.chain.toLowerCase(),
            address: data.address.toLowerCase(),
            label: data.label,
          });
        }
      });

      logger.info(`Fetched ${pairs.length} admin pairs from Firebase`);
      return pairs;
    } catch (error) {
      logger.error('Failed to fetch admin pairs from Firebase:', error);
      return [];
    }
  }

  /**
   * Convert ManagedPair to PairConfig format
   */
  public toPairConfig(pair: ManagedPair): { chain: string; pairAddress: string; symbol: string } {
    return {
      chain: pair.chain,
      pairAddress: pair.address,
      symbol: pair.label || `${pair.chain}:${pair.address.slice(0, 8)}`,
    };
  }
}
