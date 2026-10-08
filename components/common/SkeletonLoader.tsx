import React from 'react';

/**
 * Composants Skeleton Loaders modulaires et animés avec effet shimmer / pulse
 * pour garantir une expérience fluide sans écran blanc ni rechargement forcé.
 */

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800 rounded-xl ${className}`}
    />
  );
};

// 1. Skeleton pour les cartes KPI statistiques du dashboard
export const KpiCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
        <div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  );
};

// Grille de plusieurs KPIs skeletons
export const KpiGridSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
};

// 2. Skeleton pour les cartes de biens immobiliers (BiensView, Recherche, Feed)
export const PropertyCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col animate-pulse">
      {/* Image header */}
      <div className="relative h-48 bg-slate-200 dark:bg-slate-800 w-full flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700" />
      </div>

      {/* Body content */}
      <div className="p-5 flex flex-col gap-3 flex-1 justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-full" />
        </div>

        {/* Badges specifications */}
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800">
          <div className="h-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-24" />
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-28" />
        </div>
      </div>
    </div>
  );
};

// Grille de plusieurs cartes de biens
export const PropertyGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
};

// 3. Skeleton pour les lignes de tableau (Paiements, Quittances, Locataires, Cautions)
export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => {
  return (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 animate-pulse">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="bg-white dark:bg-slate-900">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-4">
              <div
                className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded"
                style={{ width: `${Math.max(45, 85 - (cIdx * 10))}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};

// 4. Skeleton pour les cartes de candidatures (DemandesView)
export const ApplicationCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-pulse">
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
        <div className="space-y-1.5 min-w-0">
          <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[220px] flex-1">
        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
};

// 5. Skeleton pour une notification prioritaire de dashboard
export const PriorityNotificationSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-300 dark:bg-slate-700 shrink-0" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-36 bg-slate-300 dark:bg-slate-700 rounded" />
          <div className="h-2.5 w-48 bg-slate-300 dark:bg-slate-700 rounded" />
        </div>
      </div>
      <div className="h-8 w-32 bg-slate-300 dark:bg-slate-700 rounded-xl" />
    </div>
  );
};

// 6. Skeleton pour les cartes de locataires (TenantsListView)
export const TenantCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4 animate-pulse">
      <div className="flex items-center gap-3.5 min-w-[260px] max-w-xs shrink-0">
        <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2.5 min-w-[220px] flex-1">
        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-2.5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
};

// 7. Skeleton pour les cartes de contrats (LocataireContratsView)
export const ContractCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-100 dark:border-slate-800">
        <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
};

