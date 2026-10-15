import React, { Suspense, lazy } from 'react';
import { useAuth } from '@/src/context/AuthContext';

function lazyDashboardWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  roleKey: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const key = `locatrust_dash_retry_${roleKey}`;
    try {
      const res = await factory();
      sessionStorage.removeItem(key);
      return res;
    } catch (err) {
      console.warn(`[LocaTrust] Erreur chargement dashboard ${roleKey}:`, err);
      const hasRetried = sessionStorage.getItem(key);
      if (!hasRetried && typeof window !== 'undefined') {
        sessionStorage.setItem(key, '1');
        if ('caches' in window) {
          try {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
          } catch {}
        }
        window.location.reload();
      }
      throw err;
    }
  });
}

// Lazy loading ciblé par rôle pour diviser par 4 le poids du dashboard
const TenantDashboardPage = lazyDashboardWithRetry(() => import('@/app/(locataire)/dashboard/page'), 'tenant');
const ProprietaireDashboardPage = lazyDashboardWithRetry(() => import('@/app/(proprietaire)/dashboard/page'), 'proprietaire');
const AgencyDashboardPage = lazyDashboardWithRetry(() => import('@/app/(agence)/dashboard/page'), 'agence');
const AdminDashboardPage = lazyDashboardWithRetry(() => import('@/app/(admin)/dashboard/page'), 'admin');

import { DashboardPageSkeleton } from '@/components/common/SkeletonLoader';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export const DashboardPage: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();

  const handleExitToLanding = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('locatrust_active_user');
      localStorage.removeItem('locatrust_registered_role');
      localStorage.removeItem('locatrust_user_avatar');
      localStorage.removeItem('locatrust_tenant_active_tab');
      window.location.href = '/';
    }
  };

  // Si le profil est encore en cours de chargement depuis Supabase, afficher le skeleton
  if (loading || (!profile && user)) {
    return <DashboardPageSkeleton />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardPageSkeleton />}>
        {profile?.role === 'admin' ? (
          <AdminDashboardPage currentRole="admin" onExitToLanding={handleExitToLanding} />
        ) : profile?.account_type === 'proprietaire' ? (
          <ProprietaireDashboardPage currentRole="proprietaire" isDemo={false} onExitToLanding={handleExitToLanding} />
        ) : profile?.account_type === 'agence' ? (
          <AgencyDashboardPage currentRole="agence" isDemo={false} onExitToLanding={handleExitToLanding} />
        ) : (
          <TenantDashboardPage currentRole="locataire" isDemo={false} onExitToLanding={handleExitToLanding} />
        )}
      </Suspense>
    </ErrorBoundary>
  );
};
