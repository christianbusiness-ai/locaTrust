import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import { initAccentTheme } from '../lib/themeHelper';
import { isLoggingOutInProgress } from '../src/lib/sessionSecurity';

// Initialisation immédiate du thème de couleur d'ambiance sauvegardé
initAccentTheme();

// Gestion automatique des mises à jour de bundle et rechargement des chunks obsolètes
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    if (isLoggingOutInProgress()) return;
    console.warn('[LocaTrust] Rechargement automatique suite à mise à jour de version (chunk obsolète)...');
    window.location.reload();
  });
  window.addEventListener('error', (e) => {
    if (isLoggingOutInProgress()) return;
    if (e?.message && /Failed to fetch dynamically imported module/i.test(e.message)) {
      console.warn('[LocaTrust] Rechargement sur erreur module dynamique...');
      window.location.reload();
    }
  });
}

// Enregistrement et mise à jour dynamique du Service Worker PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Détection et activation instantanée des nouvelles versions déployées
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('[LocaTrust PWA] Erreur enregistrement Service Worker :', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

