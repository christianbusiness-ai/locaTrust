'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isLoggingOutInProgress } from '@/src/lib/sessionSecurity';

export function isChunkLoadError(error: any): boolean {
  if (!error) return false;
  const message = String(error?.message || error || '').toLowerCase();
  const stack = String(error?.stack || '').toLowerCase();
  return (
    message.includes('dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('chunkloaderror') ||
    message.includes('importing a module script failed') ||
    message.includes('failed to fetch dynamically imported module') ||
    (message.includes('failed to fetch') && (message.includes('.js') || stack.includes('assets/')))
  );
}

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    if (isLoggingOutInProgress()) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isLoggingOutInProgress()) {
      this.setState({ hasError: false, error: null });
      return;
    }

    // Gestion silencieuse et élégante des erreurs de chargement de chunks (mises à jour de bundle)
    if (isChunkLoadError(error)) {
      console.warn('[LocaTrust] Chunk obsolète détecté par ErrorBoundary, rechargement transparent...');
      if (typeof window !== 'undefined') {
        const RELOAD_KEY = 'locatrust_chunk_error_reload_ts';
        const lastReload = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
        const now = Date.now();
        if (now - lastReload > 12000) {
          sessionStorage.setItem(RELOAD_KEY, String(now));
          if ('caches' in window) {
            caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).catch(() => {});
          }
          window.location.reload();
          return;
        }
      }
    }

    console.error('LocaTrust Uncaught Error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError && !isLoggingOutInProgress()) {
      // Pour les erreurs de chunks / modules dynamiques, JAMAIS de boîte rouge alarmante :
      // On affiche un loader élégant pendant que le rechargement transparent se produit
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mb-4 shadow-sm border border-blue-100 dark:border-blue-900/50">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              Mise à jour de l'affichage en cours...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Chargement sécurisé des dernières fonctionnalités LocaTrust.
            </p>
          </div>
        );
      }

      return (
        <div className="p-8 my-6 max-w-xl mx-auto rounded-3xl bg-rose-50 border border-rose-200 text-slate-800 shadow-xl flex flex-col items-center text-center gap-4 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-black">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Une erreur inattendue est survenue</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              L'application a détecté un incident d'affichage et a sécurisé votre session.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-rose-700 bg-white p-2.5 rounded-xl border border-rose-200 mt-3 text-left break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recharger la page</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
