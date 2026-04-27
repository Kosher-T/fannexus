/**
 * Firebase Coordination Module
 * 
 * Handles fandom-level locking, heartbeats, scraper status,
 * and alerts via Firebase Realtime Database.
 * 
 * Uses firebase-admin SDK for server-side authentication (service account).
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { FandomLock, ScraperAlert, FandomTarget } from '../../../types/scraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STALE_LOCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;         // 5 minutes

// ============================================================
// Initialization
// ============================================================

let db: admin.database.Database;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize Firebase Admin SDK.
 * Tries: 1) FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string)
 *         2) serviceAccountKey.json file in project root
 *         3) Application Default Credentials (GCP)
 */
export function initFirebase(): admin.database.Database {
  if (db) return db;

  try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccountFile = path.resolve(__dirname, '../../../../serviceAccountKey.json');

    let credential: admin.credential.Credential;

    if (serviceAccountEnv) {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      credential = admin.credential.cert(serviceAccount);
      console.log('[Firebase] ✅ Initialized with FIREBASE_SERVICE_ACCOUNT_KEY env var.');
    } else if (fs.existsSync(serviceAccountFile)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, 'utf-8'));
      credential = admin.credential.cert(serviceAccount);
      console.log('[Firebase] ✅ Initialized with serviceAccountKey.json.');
    } else {
      credential = admin.credential.applicationDefault();
      console.log('[Firebase] ✅ Initialized with Application Default Credentials.');
    }

    if (!admin.apps.length) {
      const databaseURL = process.env.FIREBASE_RTDB_URL 
        || `https://gen-lang-client-0491033860-default-rtdb.firebaseio.com`;
      
      admin.initializeApp({
        credential,
        databaseURL,
      });
      console.log(`[Firebase] 🗄️ Realtime DB: ${databaseURL}`);
    }

    db = admin.database();
    return db;
  } catch (error) {
    console.error('[Firebase] ❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// ============================================================
// Fandom Locking
// ============================================================

/**
 * Attempt to acquire a lock on a fandom for scraping.
 * Returns true if lock acquired, false if another active scraper holds it.
 */
export async function acquireFandomLock(
  fandomUrl: string,
  fandomName: string,
  runnerId: string
): Promise<boolean> {
  const db = initFirebase();
  const lockKey = sanitizeFirebaseKey(fandomUrl);
  const lockRef = db.ref(`scraping/fandom_locks/${lockKey}`);

  const snapshot = await lockRef.get();
  const existingLock = snapshot.val() as FandomLock | null;

  if (existingLock) {
    const lastHeartbeat = new Date(existingLock.lastHeartbeat).getTime();
    const now = Date.now();

    // Another runner owns it and it's still fresh
    if (existingLock.lockedBy !== runnerId && (now - lastHeartbeat) < STALE_LOCK_THRESHOLD_MS) {
      console.log(`   🔒 Fandom "${fandomName}" is locked by ${existingLock.lockedBy} (heartbeat ${Math.round((now - lastHeartbeat) / 60000)}min ago). Skipping.`);
      return false;
    }

    // Stale lock — we can steal it
    if (existingLock.lockedBy !== runnerId) {
      console.log(`   🔓 Stealing stale lock on "${fandomName}" from ${existingLock.lockedBy} (${Math.round((now - lastHeartbeat) / 60000)}min stale).`);
    }
  }

  // Write our lock
  const lock: FandomLock = {
    lockedBy: runnerId,
    lockedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    fandomName,
    fandomUrl,
    currentPage: 0,
  };

  await lockRef.set(lock);
  console.log(`   🔐 Lock acquired on "${fandomName}" by ${runnerId}.`);
  return true;
}

/**
 * Release a fandom lock after completion.
 */
export async function releaseFandomLock(fandomUrl: string): Promise<void> {
  const db = initFirebase();
  const lockKey = sanitizeFirebaseKey(fandomUrl);
  await db.ref(`scraping/fandom_locks/${lockKey}`).remove();
}

/**
 * Update the heartbeat and current page for an active lock.
 */
export async function updateLockHeartbeat(
  fandomUrl: string,
  currentPage: number
): Promise<void> {
  const db = initFirebase();
  const lockKey = sanitizeFirebaseKey(fandomUrl);
  await db.ref(`scraping/fandom_locks/${lockKey}`).update({
    lastHeartbeat: new Date().toISOString(),
    currentPage,
  });
}

/**
 * Start a background heartbeat timer that updates every 5 minutes.
 */
export function startHeartbeat(fandomUrl: string, getPage: () => number): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    try {
      await updateLockHeartbeat(fandomUrl, getPage());
    } catch (e) {
      console.warn('[Firebase] ⚠️ Heartbeat update failed:', e);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ============================================================
// Fandom Completion Tracking
// ============================================================

/**
 * Mark a fandom as completed in Firebase.
 */
export async function markFandomCompleted(
  fandomUrl: string,
  fandomName: string,
  runnerId: string,
  storiesScraped: number
): Promise<void> {
  const db = initFirebase();
  const key = sanitizeFirebaseKey(fandomUrl);
  await db.ref(`scraping/completed_fandoms/${key}`).set({
    fandomName,
    fandomUrl,
    completedBy: runnerId,
    completedAt: new Date().toISOString(),
    storiesScraped,
  });
}

/**
 * Check if a fandom is already completed.
 */
export async function isFandomCompleted(fandomUrl: string): Promise<boolean> {
  const db = initFirebase();
  const key = sanitizeFirebaseKey(fandomUrl);
  const snapshot = await db.ref(`scraping/completed_fandoms/${key}`).get();
  return snapshot.exists();
}

/**
 * Get all completed fandom URLs.
 */
export async function getCompletedFandomUrls(): Promise<Set<string>> {
  const db = initFirebase();
  const snapshot = await db.ref('scraping/completed_fandoms').get();
  const completed = new Set<string>();

  if (snapshot.exists()) {
    const data = snapshot.val();
    for (const key of Object.keys(data)) {
      completed.add(data[key].fandomUrl);
    }
  }

  return completed;
}

// ============================================================
// Scraper Status
// ============================================================

/**
 * Report current scraper status to Firebase.
 */
export async function updateScraperStatus(
  runnerId: string,
  status: 'running' | 'idle' | 'paused' | 'errored',
  details?: Record<string, unknown>
): Promise<void> {
  const db = initFirebase();
  await db.ref(`scraping/scrapers/${runnerId}`).set({
    status,
    lastUpdated: new Date().toISOString(),
    ...details,
  });
}

// ============================================================
// Alerts
// ============================================================

/**
 * Push an alert to Firebase for monitoring.
 */
export async function pushAlert(alert: ScraperAlert): Promise<void> {
  const db = initFirebase();
  await db.ref('scraping/alerts').push(alert);
  console.log(`[Firebase] 📢 Alert pushed: ${alert.type} — ${alert.message}`);
}

/**
 * Creates an AlertCallback function bound to a specific runner ID.
 */
export function createAlertCallback(runnerId: string) {
  return async (alert: ScraperAlert) => {
    alert.runnerId = runnerId;
    await pushAlert(alert);
  };
}

// ============================================================
// Fandom Assignment Strategy
// ============================================================

/**
 * Get the next available fandom to scrape.
 * 
 * Strategy:
 * - GitHub Actions starts from the top (index 0 → N)
 * - Local starts from the bottom (index N → 0)
 * - Skips completed and locked fandoms
 */
export async function getNextAvailableFandom(
  allFandoms: FandomTarget[],
  runnerId: string
): Promise<FandomTarget | null> {
  const completedUrls = await getCompletedFandomUrls();

  // Determine iteration order
  const orderedFandoms = runnerId === 'local'
    ? [...allFandoms].reverse()
    : allFandoms;

  for (const fandom of orderedFandoms) {
    // Skip already completed
    if (completedUrls.has(fandom.url)) {
      continue;
    }

    // Try to acquire lock
    const locked = await acquireFandomLock(fandom.url, fandom.name, runnerId);
    if (locked) {
      return fandom;
    }
  }

  return null; // All fandoms either completed or locked
}

// ============================================================
// Helpers
// ============================================================

/**
 * Firebase Realtime DB keys cannot contain: . $ # [ ] /
 * We encode the URL to a safe key.
 */
function sanitizeFirebaseKey(input: string): string {
  return Buffer.from(input).toString('base64url');
}
