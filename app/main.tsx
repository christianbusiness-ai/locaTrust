import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import { initAccentTheme } from '../lib/themeHelper';

// Initialisation immédiate du thème de couleur d'ambiance sauvegardé
initAccentTheme();

// Enregistrement du Service Worker PWA pour installation mobile et bureau (sans navigateur)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[LocaTrust PWA] Service Worker actif :', reg.scope);
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

