import React from 'react';
import { useAuth } from '@/src/context/AuthContext';
import TenantDashboardPage from '@/app/(locataire)/dashboard/page';
import ProprietaireDashboardPage from '@/app/(proprietaire)/dashboard/page';
import AgencyDashboardPage from '@/app/(agence)/dashboard/page';
import AdminDashboardPage from '@/app/(admin)/dashboard/page';

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

  // Si l'utilisateur est admin
  if (profile?.role === 'admin') {
    return <AdminDashboardPage currentRole="admin" isDemo={false} onExitToLanding={handleExitToLanding} />;
  }

  // Selon le type de compte réel
  if (profile?.account_type === 'proprietaire') {
    return <ProprietaireDashboardPage currentRole="proprietaire" isDemo={false} onExitToLanding={handleExitToLanding} />;
  }

  if (profile?.account_type === 'agence') {
    return <AgencyDashboardPage currentRole="agence" isDemo={false} onExitToLanding={handleExitToLanding} />;
  }

  // Par défaut : locataire
  return <TenantDashboardPage currentRole="locataire" isDemo={false} onExitToLanding={handleExitToLanding} />;
};
