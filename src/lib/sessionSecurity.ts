/**
 * LocaTrust Session Security & Expiration Management
 * Règle demandée :
 * 1. PAS de déconnexion automatique en mode veille (l'utilisateur peut laisser son écran
 *    en veille pendant des heures sans être déconnecté).
 * 2. Déconnexion automatique UNIQUEMENT lorsque l'utilisateur ferme / quitte totalement son navigateur.
 *    (Géré par sessionStorage qui persiste indéfiniment en veille mais est purgé à la fermeture du navigateur).
 */

export const SESSION_KEYS = {
  BROWSER_SESSION: 'locatrust_browser_session_active',
  SESSION_START: 'locatrust_session_start_time',
  LAST_ACTIVITY: 'locatrust_last_activity_time',
  DEVICE_REMEMBER: 'locatrust_remember_device',
};

/**
 * Enregistre / active la session de navigation en cours (sessionStorage).
 */
export function recordUserActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEYS.BROWSER_SESSION, 'true');
    const now = Date.now().toString();
    sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, now);
    if (!sessionStorage.getItem(SESSION_KEYS.SESSION_START)) {
      sessionStorage.setItem(SESSION_KEYS.SESSION_START, now);
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
 * Vérifie si la session est expirée.
 * La session n'expire JAMAIS lors d'une mise en veille ou d'une inactivité (même après plusieurs heures).
 * Elle n'expire que si l'utilisateur a fermé ou quitté son navigateur (sessionStorage purgé).
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Si la session du navigateur est active dans sessionStorage, l'utilisateur reste connecté
    // (même après des heures de veille de l'écran du téléphone ou de l'ordinateur)
    const browserSession = sessionStorage.getItem(SESSION_KEYS.BROWSER_SESSION);
    if (browserSession === 'true') {
      return false;
    }
    // Si sessionStorage ne contient pas le marqueur, le navigateur a été fermé
    return true;
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
