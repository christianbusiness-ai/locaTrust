import React, { Suspense, lazy } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { isLoggingOutInProgress } from '@/src/lib/sessionSecurity';

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
      if (isLoggingOutInProgress()) {
        return { default: (() => null) as unknown as T };
      }
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
  const navigate = useNavigate();

  const handleExitToLanding = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    navigate('/login', { replace: true });
  };

  // Si l'utilisateur est en cours de déconnexion ou n'est plus authentifié, rediriger proprement sans jamais tenter de charger un autre dashboard
  if (isLoggingOutInProgress() || (!loading && !user)) {
    return <Navigate to="/login" replace />;
  }

  // Si le profil est encore en cours de chargement depuis Supabase, afficher le skeleton
  if (loading || !profile) {
    return <DashboardPageSkeleton />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardPageSkeleton />}>
        {profile.role === 'admin' ? (
          <AdminDashboardPage currentRole="admin" onExitToLanding={handleExitToLanding} />
        ) : profile.account_type === 'proprietaire' ? (
          <ProprietaireDashboardPage currentRole="proprietaire" isDemo={false} onExitToLanding={handleExitToLanding} />
        ) : profile.account_type === 'agence' ? (
          <AgencyDashboardPage currentRole="agence" isDemo={false} onExitToLanding={handleExitToLanding} />
        ) : (
          <TenantDashboardPage currentRole="locataire" isDemo={false} onExitToLanding={handleExitToLanding} />
        )}
      </Suspense>
    </ErrorBoundary>
  );
};
