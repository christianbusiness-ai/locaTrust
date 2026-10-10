import React, { Suspense, lazy } from 'react';
import { useAuth } from '@/src/context/AuthContext';

// Lazy loading ciblé par rôle pour diviser par 4 le poids du dashboard
const TenantDashboardPage = lazy(() => import('@/app/(locataire)/dashboard/page'));
const ProprietaireDashboardPage = lazy(() => import('@/app/(proprietaire)/dashboard/page'));
const AgencyDashboardPage = lazy(() => import('@/app/(agence)/dashboard/page'));
const AdminDashboardPage = lazy(() => import('@/app/(admin)/dashboard/page'));

import { DashboardPageSkeleton } from '@/components/common/SkeletonLoader';

export const DashboardPage: React.FC = () => {
  const { profile, signOut } = useAuth();

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

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      {profile?.role === 'admin' ? (
        <AdminDashboardPage currentRole="admin" isDemo={false} onExitToLanding={handleExitToLanding} />
      ) : profile?.account_type === 'proprietaire' ? (
        <ProprietaireDashboardPage currentRole="proprietaire" isDemo={false} onExitToLanding={handleExitToLanding} />
      ) : profile?.account_type === 'agence' ? (
        <AgencyDashboardPage currentRole="agence" isDemo={false} onExitToLanding={handleExitToLanding} />
      ) : (
        <TenantDashboardPage currentRole="locataire" isDemo={false} onExitToLanding={handleExitToLanding} />
      )}
    </Suspense>
  );
};
