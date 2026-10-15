import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import { initAccentTheme } from '../lib/themeHelper';

// Initialisation immédiate du thème de couleur d'ambiance sauvegardé
initAccentTheme();

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

