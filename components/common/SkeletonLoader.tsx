import React from 'react';
import { TopProgressBar } from './TopProgressBar';

/**
 * Composants Skeleton Loaders modulaires avec effet "Shimmer Wave" (vague de lumière)
 * Reproduit fidèlement la vague lumineuse ("lumière qui entre et qui sort") pour une expérience
 * fluide, professionnelle et sans aucun spinner bloquant au centre de l'écran.
 */

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-shimmer rounded-xl ${className}`}
    />
  );
};

// 1. Skeleton pour les cartes KPI statistiques du dashboard
export const KpiCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl animate-shimmer shrink-0" />
          <div className="h-4 w-28 animate-shimmer rounded-md" />
        </div>
        <div className="h-6 w-14 animate-shimmer rounded-md" />
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 animate-shimmer rounded" />
          <div className="h-3 w-16 animate-shimmer rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 animate-shimmer rounded" />
          <div className="h-3 w-12 animate-shimmer rounded" />
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
      {/* Image header avec vague de lumière */}
      <div className="relative h-48 w-full animate-shimmer flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/40 dark:bg-slate-700/40" />
      </div>

      {/* Body content */}
      <div className="p-5 flex flex-col gap-3 flex-1 justify-between">
        <div className="space-y-2.5">
          <div className="h-4 animate-shimmer rounded-md w-3/4" />
          <div className="h-3 animate-shimmer rounded-md w-1/2" />
          <div className="h-3 animate-shimmer rounded-md w-full" />
        </div>

        {/* Badges specifications */}
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800">
          <div className="h-7 animate-shimmer rounded-lg" />
          <div className="h-7 animate-shimmer rounded-lg" />
          <div className="h-7 animate-shimmer rounded-lg" />
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="h-6 animate-shimmer rounded w-24" />
          <div className="h-8 animate-shimmer rounded-xl w-28" />
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

// 3. Skeleton pour les lignes de tableau (Paiements, Quittances, Locataires, Cautions, Documents, Historique)
export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => {
  return (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="bg-white dark:bg-slate-900">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-4">
              <div
                className="h-3.5 animate-shimmer rounded"
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-10 h-10 rounded-full animate-shimmer shrink-0" />
        <div className="space-y-1.5 min-w-0">
          <div className="h-3.5 w-28 animate-shimmer rounded" />
          <div className="h-2.5 w-20 animate-shimmer rounded" />
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[220px] flex-1">
        <div className="w-7 h-7 rounded-lg animate-shimmer shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-3/4 animate-shimmer rounded" />
          <div className="h-2.5 w-1/2 animate-shimmer rounded" />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="h-8 w-24 animate-shimmer rounded-xl" />
        <div className="h-8 w-28 animate-shimmer rounded-xl" />
      </div>
    </div>
  );
};

// 5. Skeleton pour une notification prioritaire de dashboard
export const PriorityNotificationSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl animate-shimmer shrink-0" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-36 animate-shimmer rounded" />
          <div className="h-2.5 w-48 animate-shimmer rounded" />
        </div>
      </div>
      <div className="h-8 w-32 animate-shimmer rounded-xl" />
    </div>
  );
};

// 6. Skeleton pour les cartes de locataires (TenantsListView)
export const TenantCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-[260px] max-w-xs shrink-0">
        <div className="w-11 h-11 rounded-full animate-shimmer shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-3.5 w-28 animate-shimmer rounded" />
          <div className="h-2.5 w-20 animate-shimmer rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2.5 min-w-[220px] flex-1">
        <div className="w-8 h-8 rounded-xl animate-shimmer shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-1/2 animate-shimmer rounded" />
          <div className="h-2.5 w-1/3 animate-shimmer rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-8 w-24 animate-shimmer rounded-xl" />
        <div className="h-8 w-24 animate-shimmer rounded-xl" />
      </div>
    </div>
  );
};

// 7. Skeleton pour les cartes de contrats (LocataireContratsView)
export const ContractCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl animate-shimmer shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 animate-shimmer rounded" />
            <div className="h-3 w-24 animate-shimmer rounded" />
          </div>
        </div>
        <div className="h-6 w-20 animate-shimmer rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-100 dark:border-slate-800">
        <div className="h-8 animate-shimmer rounded-lg" />
        <div className="h-8 animate-shimmer rounded-lg" />
        <div className="h-8 animate-shimmer rounded-lg" />
        <div className="h-8 animate-shimmer rounded-lg" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <div className="h-9 w-28 animate-shimmer rounded-xl" />
        <div className="h-9 w-32 animate-shimmer rounded-xl" />
      </div>
    </div>
  );
};

// 8. Skeleton pour les tickets de maintenance et incidents (LocataireMaintenanceView)
export const TicketsListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5 flex-1">
            <div className="w-10 h-10 rounded-xl animate-shimmer shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 animate-shimmer rounded" />
              <div className="h-3 w-3/4 animate-shimmer rounded" />
              <div className="flex items-center gap-2 pt-1">
                <div className="h-3 w-24 animate-shimmer rounded" />
                <div className="h-3 w-20 animate-shimmer rounded" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-7 w-24 animate-shimmer rounded-full" />
            <div className="h-9 w-28 animate-shimmer rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

// 8b. Skeleton pour les quittances officielles (QuittancesPage)
export const QuittanceCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl animate-shimmer shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 animate-shimmer rounded" />
            <div className="h-3 w-20 animate-shimmer rounded" />
          </div>
        </div>
        <div className="h-6 w-16 animate-shimmer rounded-full" />
      </div>
      <div className="h-10 animate-shimmer rounded-xl w-full" />
      <div className="h-9 animate-shimmer rounded-xl w-full" />
    </div>
  );
};

export const QuittanceGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <QuittanceCardSkeleton key={i} />
      ))}
    </div>
  );
};

// 9. Skeleton pour la fiche détaillée d'un bien (Page /biens/[id])
export const PropertyDetailSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="h-6 w-32 animate-shimmer rounded-lg" />
      <div className="h-72 w-full animate-shimmer rounded-3xl" />
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 w-60 animate-shimmer rounded" />
          <div className="h-8 w-28 animate-shimmer rounded-xl" />
        </div>
        <div className="h-4 w-40 animate-shimmer rounded" />
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="h-12 animate-shimmer rounded-xl" />
          <div className="h-12 animate-shimmer rounded-xl" />
          <div className="h-12 animate-shimmer rounded-xl" />
        </div>
      </div>
    </div>
  );
};

// 10. Skeleton complet de page de tableau de bord (Remplace avantageusement tout spinner plein écran)
export const DashboardPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Barre de progression supérieure lumineuse */}
      <TopProgressBar active={true} />

      {/* Header simulé */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl animate-shimmer" />
          <div className="h-5 w-32 animate-shimmer rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full animate-shimmer" />
          <div className="h-4 w-24 animate-shimmer rounded-md hidden sm:block" />
        </div>
      </header>

      {/* Main Content avec vague de lumière */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Titre et sous-titre */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-48 sm:w-64 animate-shimmer rounded-lg" />
            <div className="h-3.5 w-36 sm:w-48 animate-shimmer rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 animate-shimmer rounded-xl" />
            <div className="h-10 w-32 animate-shimmer rounded-xl" />
          </div>
        </div>

        {/* Grille de statistiques KPI */}
        <KpiGridSkeleton count={3} />

        {/* Section de contenu : Onglets + cartes ou tableau */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex gap-2">
              <div className="h-8 w-24 animate-shimmer rounded-xl" />
              <div className="h-8 w-28 animate-shimmer rounded-xl" />
              <div className="h-8 w-24 animate-shimmer rounded-xl" />
            </div>
            <div className="h-8 w-36 animate-shimmer rounded-xl hidden md:block" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-shimmer rounded-2xl w-full"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
