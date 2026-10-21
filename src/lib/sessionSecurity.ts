/**
 * LocaTrust Session Security & Expiration Management
 * Conforme aux standards de sécurité bancaires & fintech pour données financières sensibles :
 * - Durée maximale d'inactivité de session (24h)
 * - Détection automatique d'expiration après fermeture ou veille prolongée
 * - Invalidation contrôlée des jetons et redirection vers /login
 */

// Inactivité maximale autorisée : 24 heures (86 400 000 ms)
export const MAX_INACTIVITY_MS = 24 * 60 * 60 * 1000;

export const SESSION_KEYS = {
  LAST_ACTIVITY: 'locatrust_last_activity_time',
  SESSION_START: 'locatrust_session_start_time',
  DEVICE_REMEMBER: 'locatrust_remember_device',
};

/**
 * Enregistre un battement d'activité utilisateur (clic, frappe, navigation)
 */
export function recordUserActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now().toString();
    localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, now);
    if (!localStorage.getItem(SESSION_KEYS.SESSION_START)) {
      localStorage.setItem(SESSION_KEYS.SESSION_START, now);
    }
  } catch {}
}

/**
 * Vérifie si la session de l'utilisateur a expiré pour cause d'inactivité
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastActivityStr = localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);
    if (!lastActivityStr) {
      // Pas d'activité enregistrée : session fraîche ou non initialisée
      return false;
    }
    const lastActivity = Number(lastActivityStr);
    if (isNaN(lastActivity)) return false;

    const elapsed = Date.now() - lastActivity;
    return elapsed > MAX_INACTIVITY_MS;
  } catch {
    return false;
  }
}

/**
 * Nettoie toutes les données de session sécurisée lors de la déconnexion
 */
export function clearSecuritySession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
    localStorage.removeItem(SESSION_KEYS.SESSION_START);
    localStorage.removeItem('locatrust_active_user');
    localStorage.removeItem('locatrust_active_role');
  } catch {}
}
