'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LocaTrust Uncaught Error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
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
