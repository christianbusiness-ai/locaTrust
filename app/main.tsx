import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import { initAccentTheme } from '../lib/themeHelper';

// Initialisation immédiate du thème de couleur d'ambiance sauvegardé
initAccentTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

