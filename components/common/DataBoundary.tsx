import React from 'react';
import { TopProgressBar } from './TopProgressBar';

interface DataBoundaryProps {
  isLoading: boolean;
  hasData: boolean;
  isRefreshing?: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * DataBoundary (LocaTrust Universal Component)
 *
 * Applique la règle d'or pour tous les écrans de l'application :
 * - Le skeleton n'est affiché QUE si `isLoading && !hasData` (aucun contenu déjà chargé).
 * - Si des données existent déjà (`hasData === true`), le skeleton n'apparaît JAMAIS.
 * - En cas de refetch en tâche de fond, seule la fine barre lumineuse (`TopProgressBar`) s'active.
 * - Si le rafraîchissement échoue, les données actuelles restent visibles avec une notification non-bloquante.
 */
export const DataBoundary: React.FC<DataBoundaryProps> = ({
  isLoading,
  hasData,
  isRefreshing = false,
  skeleton,
  children,
  error,
  onRetry,
  className = '',
}) => {
  const showSkeleton = isLoading && !hasData;

  return (
    <div className={`relative ${className}`}>
      {/* Barre de rafraîchissement ultra-fine non-bloquante au sommet */}
      <TopProgressBar active={isRefreshing} />

      {/* Alerte non bloquante si échec de rafraîchissement en tâche de fond avec données existantes */}
      {error && hasData && (
        <div className="mb-4 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Mise à jour en arrière-plan momentanément indisponible. Données actuelles conservées.</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1 text-[11px] bg-amber-200/70 hover:bg-amber-300 dark:bg-amber-800/60 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-lg font-medium transition-colors"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {showSkeleton ? skeleton : children}
    </div>
  );
};

