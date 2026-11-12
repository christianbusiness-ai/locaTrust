/**
 * src/lib/uiPreferences.ts
 *
 * SANCTIONED UI PREFERENCES WRAPPER
 * 
 * Part of the "SERVER IS THE SOURCE OF TRUTH" architecture.
 * This is the ONLY module allowed to access localStorage directly.
 * It strictly enforces a whitelist of NON-BUSINESS UI preferences:
 * - theme ('light' | 'dark' | 'system')
 * - language ('fr' | 'en')
 * - sidebar_state ('expanded' | 'collapsed')
 * - last_opened_tab / active_tab
 *
 * BUSINESS DATA (contracts, payments, deposits, properties, applications, etc.)
 * MUST NEVER BE STORED HERE.
 */

export const ALLOWED_UI_PREFERENCE_KEYS = [
  'theme',
  'language',
  'sidebar_state',
  'last_opened_tab',
  'active_tab'
] as const;

export type AllowedUIPreferenceKey = typeof ALLOWED_UI_PREFERENCE_KEYS[number];

const STORAGE_PREFIX = 'lt_ui_';

function isAllowedKey(key: string): key is AllowedUIPreferenceKey {
  return (ALLOWED_UI_PREFERENCE_KEYS as readonly string[]).includes(key);
}

export function getUIPreference<T = string>(key: AllowedUIPreferenceKey, fallback: T): T {
  if (typeof window === 'undefined' || !isAllowedKey(key)) return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setUIPreference<T = string>(key: AllowedUIPreferenceKey, value: T): void {
  if (typeof window === 'undefined' || !isAllowedKey(key)) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded or privacy mode
  }
}

export function removeUIPreference(key: AllowedUIPreferenceKey): void {
  if (typeof window === 'undefined' || !isAllowedKey(key)) return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {}
}

export function clearAllUIPreferences(): void {
  if (typeof window === 'undefined') return;
  try {
    ALLOWED_UI_PREFERENCE_KEYS.forEach(key => {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    });
  } catch {}
}

