/**
 * src/lib/displayCache.ts
 *
 * SANCTIONED DISPLAY CACHE & FORM DRAFT WRAPPER (IndexedDB)
 *
 * Part of the "SERVER IS THE SOURCE OF TRUTH" architecture.
 * This is the ONLY module allowed to access IndexedDB.
 *
 * RULES:
 * 1. Read-only summary display cache for instant UI rendering while server data loads.
 * 2. Maximum TTL: 24 hours. Expired entries are automatically evicted.
 * 3. Keyed strictly by userId. Wiped completely on logout / account switch.
 * 4. NEVER used for business writes, financial calculations, contract state, or permissions.
 * 5. ALWAYS unconditionally overwritten by fresh server data (Supabase).
 * 6. Short-lived form drafts are deleted upon submission, logout, or after 24 hours.
 */

export const ALLOWED_DISPLAY_CACHE_KEYS = [
  'dashboard_summary',
  'properties_summary',
  'contracts_summary',
  'notifications_count',
  'form_draft'
] as const;

export type AllowedDisplayCacheKey = typeof ALLOWED_DISPLAY_CACHE_KEYS[number];

interface CacheEnvelope<T> {
  userId: string;
  key: AllowedDisplayCacheKey;
  data: T;
  cachedAt: number;
  expiresAt: number;
}

const DB_NAME = 'locatrust_display_cache_db';
const STORE_NAME = 'display_cache';
const DB_VERSION = 1;
const MAX_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours strictly

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'compositeKey' });
            store.createIndex('userId', 'userId', { unique: false });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function makeCompositeKey(userId: string, key: AllowedDisplayCacheKey, subKey?: string): string {
  return `${userId}::${key}${subKey ? `::${subKey}` : ''}`;
}

export async function setDisplayCache<T>(
  userId: string,
  key: AllowedDisplayCacheKey,
  data: T,
  subKey?: string,
  ttlMs = MAX_TTL_MS
): Promise<void> {
  if (!userId || !ALLOWED_DISPLAY_CACHE_KEYS.includes(key)) return;
  const db = await getDB();
  if (!db) return;

  const validTtl = Math.min(ttlMs, MAX_TTL_MS);
  const now = Date.now();
  const entry: CacheEnvelope<T> & { compositeKey: string } = {
    compositeKey: makeCompositeKey(userId, key, subKey),
    userId,
    key,
    data,
    cachedAt: now,
    expiresAt: now + validTtl
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getDisplayCache<T>(
  userId: string,
  key: AllowedDisplayCacheKey,
  subKey?: string
): Promise<T | null> {
  if (!userId || !ALLOWED_DISPLAY_CACHE_KEYS.includes(key)) return null;
  const db = await getDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(makeCompositeKey(userId, key, subKey));
      req.onsuccess = () => {
        const val = req.result as (CacheEnvelope<T> & { compositeKey: string }) | undefined;
        if (!val) {
          resolve(null);
          return;
        }
        if (Date.now() > val.expiresAt) {
          // Asynchronously evict expired record
          deleteDisplayCache(userId, key, subKey).catch(() => {});
          resolve(null);
          return;
        }
        resolve(val.data);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteDisplayCache(
  userId: string,
  key: AllowedDisplayCacheKey,
  subKey?: string
): Promise<void> {
  if (!userId) return;
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(makeCompositeKey(userId, key, subKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Obligatory wipe on logout or account switch.
 */
export async function clearDisplayCacheForUser(userId: string): Promise<void> {
  if (!userId) return;
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach(k => store.delete(k));
        resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Form draft convenience helpers: automatically evict on submit or after 24h.
 */
export async function saveFormDraft<T>(userId: string, formId: string, draftData: T): Promise<void> {
  return setDisplayCache(userId, 'form_draft', draftData, formId, MAX_TTL_MS);
}

export async function loadFormDraft<T>(userId: string, formId: string): Promise<T | null> {
  return getDisplayCache<T>(userId, 'form_draft', formId);
}

export async function clearFormDraft(userId: string, formId: string): Promise<void> {
  return deleteDisplayCache(userId, 'form_draft', formId);
}
