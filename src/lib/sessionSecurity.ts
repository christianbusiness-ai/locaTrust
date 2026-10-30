/**
 * LocaTrust Session Security & Expiration Management
 * Règle demandée :
 * 1. Déconnexion automatique après 30 MINUTES d'écran en veille ou d'inactivité
 *    (Si l'écran est en veille moins de 30 min, l'utilisateur reste connecté sans interruption).
 * 2. Déconnexion automatique immédiate si l'utilisateur quitte ou ferme totalement son navigateur
 *    (Géré par sessionStorage qui est automatiquement purgé à la fermeture du navigateur).
 */

// Durée maximale autorisée en mode veille / inactivité : 30 minutes (1 800 000 ms)
export const MAX_VEILLE_INACTIVITY_MS = 30 * 60 * 1000;

export const SESSION_KEYS = {
  BROWSER_SESSION: 'locatrust_browser_session_active',
  SESSION_START: 'locatrust_session_start_time',
  LAST_ACTIVITY: 'locatrust_last_activity_time',
  DEVICE_REMEMBER: 'locatrust_remember_device',
};

let lastThrottledRecord = 0;
let loggingOutFlag = false;

/**
 * Indique si une déconnexion volontaire est en cours d'exécution.
 * Empêche toute requête protégée, écriture de cache ou erreur transitoire pendant la transition.
 */
export function setLoggingOutFlag(active: boolean): void {
  loggingOutFlag = active;
  if (typeof window !== 'undefined') {
    (window as any).__LOCATRUST_LOGGING_OUT__ = active;
  }
}

export function isLoggingOutInProgress(): boolean {
  if (loggingOutFlag) return true;
  if (typeof window !== 'undefined' && (window as any).__LOCATRUST_LOGGING_OUT__) {
    return true;
  }
  return false;
}

/**
 * Enregistre / active la session de navigation en cours (sessionStorage).
 * Throttlé à 5 secondes pour les événements fréquents (scroll, clic, touch).
 */
export function recordUserActivity(force = false): void {
  if (typeof window === 'undefined' || isLoggingOutInProgress()) return;
  const now = Date.now();
  if (!force && now - lastThrottledRecord < 5000) return;
  lastThrottledRecord = now;

  try {
    sessionStorage.setItem(SESSION_KEYS.BROWSER_SESSION, 'true');
    sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, now.toString());
    if (!sessionStorage.getItem(SESSION_KEYS.SESSION_START)) {
      sessionStorage.setItem(SESSION_KEYS.SESSION_START, now.toString());
    }
  } catch {}
}

/**
 * Marque explicitement la session comme active lors d'une connexion réussie
 */
export function markSessionActive(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEYS.BROWSER_SESSION, 'true');
    sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
  } catch {}
}

/**
 * Vérifie si la session est expirée :
 * - Expire si l'utilisateur a fermé son navigateur (sessionStorage purgé)
 * - Expire si l'écran est resté en mode veille / inactif pendant PLUS DE 30 MINUTES
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // 1. Si le navigateur a été fermé, sessionStorage n'a plus le flag actif
    const browserSession = sessionStorage.getItem(SESSION_KEYS.BROWSER_SESSION);
    if (browserSession !== 'true') {
      return true;
    }

    // 2. Vérification de la durée en veille / inactivité (seuil de 30 minutes)
    const lastActivityStr = sessionStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);
    if (lastActivityStr) {
      const lastActivity = Number(lastActivityStr);
      if (!isNaN(lastActivity)) {
        const elapsed = Date.now() - lastActivity;
        if (elapsed > MAX_VEILLE_INACTIVITY_MS) {
          return true; // Plus de 30 minutes en veille -> déconnexion
        }
      }
    }

    // En veille depuis moins de 30 minutes avec navigateur ouvert -> Session valide
    return false;
  } catch {
    return false;
  }
}

/**
 * Nettoie toutes les données de session sécurisée lors de la déconnexion volontaire
 */
export function clearSecuritySession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEYS.BROWSER_SESSION);
    sessionStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
    sessionStorage.removeItem(SESSION_KEYS.SESSION_START);
    localStorage.removeItem('locatrust_active_user');
    localStorage.removeItem('locatrust_active_role');
  } catch {}
}
