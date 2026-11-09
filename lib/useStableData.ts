import { useState, useCallback, useRef } from 'react';

/**
 * useStableData (LocaTrust Universal State Stabilizer)
 *
 * Implémente la règle stricte :
 * showSkeleton = isLoading && !hasData
 *
 * - `isLoading` est UNIQUEMENT à true lors du tout premier chargement où l'écran n'a encore aucune donnée.
 * - Tout rafraîchissement ultérieur (événements realtime, focus fenêtre, rafraîchissement d'arrière-plan)
 *   utilise `isRefreshing` et conserve STRICTEMENT les données déjà affichées à l'écran.
 * - Aucune valeur réelle n'est jamais écrasée par du vide, des zéros factices ou des skeletons.
 */
export interface UseStableDataOptions<T> {
  hasDataCheck?: (data: T) => boolean;
  onFetchError?: (error: any) => void;
}

export function useStableData<T>(
  initialData: T,
  options?: UseStableDataOptions<T>
) {
  const [data, setDataState] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const dataRef = useRef<T>(data);
  dataRef.current = data;

  const hasData = options?.hasDataCheck
    ? options.hasDataCheck(data)
    : Array.isArray(data)
    ? data.length > 0
    : data !== null && data !== undefined;

  const showSkeleton = isLoading && !hasData;

  const setData = useCallback((updater: T | ((prev: T) => T)) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      dataRef.current = next;
      return next;
    });
    setIsLoading(false);
    setIsRefreshing(false);
    setLastError(null);
  }, []);

  const startRefetch = useCallback(() => {
    // Si nous avons déjà des données, on ne remet JAMAIS isLoading à true
    if (hasData) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
  }, [hasData]);

  const endRefetch = useCallback((error?: any) => {
    setIsLoading(false);
    setIsRefreshing(false);
    if (error) {
      const msg = error?.message || 'Erreur lors du rafraîchissement des données';
      setLastError(msg);
      options?.onFetchError?.(error);
    } else {
      setLastError(null);
    }
  }, [options]);

  return {
    data,
    dataRef,
    setData,
    isLoading,
    setIsLoading,
    isRefreshing,
    setIsRefreshing,
    hasData,
    showSkeleton,
    lastError,
    setLastError,
    startRefetch,
    endRefetch,
  };
}

