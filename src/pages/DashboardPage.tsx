import React, { Suspense, lazy } from 'react';
import { useAuth } from '@/src/context/AuthContext';

// Lazy loading ciblé par rôle pour diviser par 4 le poids du dashboard
const TenantDashboardPage = lazy(() => import('@/app/(locataire)/dashboard/page'));
const ProprietaireDashboardPage = lazy(() => import('@/app/(proprietaire)/dashboard/page'));
const AgencyDashboardPage = lazy(() => import('@/app/(agence)/dashboard/page'));
const AdminDashboardPage = lazy(() => import('@/app/(admin)/dashboard/page'));

const DashboardSpinner: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
    <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-3"></div>
    <span className="text-xs font-bold text-slate-500">Chargement de votre espace de gestion...</span>
  </div>
);

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
    <Suspense fallback={<DashboardSpinner />}>
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
