import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types/database.types';
import ProprietaireDashboardPage from './(proprietaire)/dashboard/page';
import AgencyDashboardPage from './(agence)/dashboard/page';
import TenantDashboardPage from './(locataire)/dashboard/page';
import AdminDashboardPage from './(admin)/dashboard/page';
import { DocumentVerificationView } from '@/components/verification/DocumentVerificationView';
import { RegisterModal } from '@/components/auth/RegisterModal';

export default function App() {
  // Active role state default to 'proprietaire', can switch to 'agence', 'locataire', 'admin'
  const [currentRole, setCurrentRole] = useState<UserRole>('proprietaire');

  // Global Register Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Route d'authentification publique par QR Code : /verification/contrat/[token] ou /verification/recu/[token]
  const [verificationRoute, setVerificationRoute] = useState<{
    type: 'contrat' | 'recu';
    token: string;
  } | null>(null);

  useEffect(() => {
    const handleUrlCheck = () => {
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;
      const matchContrat = pathname.match(/\/(?:verification|verify)\/contrat\/([a-zA-Z0-9_-]+)/);
      const matchRecu = pathname.match(/\/(?:verification|verify)\/recu\/([a-zA-Z0-9_-]+)/);
      const matchGeneralVerify = pathname.match(/^\/verify\/([a-zA-Z0-9_-]+)$/);

      if (matchContrat && matchContrat[1]) {
        setVerificationRoute({ type: 'contrat', token: matchContrat[1] });
      } else if (matchRecu && matchRecu[1]) {
        setVerificationRoute({ type: 'recu', token: matchRecu[1] });
      } else if (matchGeneralVerify && matchGeneralVerify[1]) {
        const t = matchGeneralVerify[1];
        const isRecu = t.toLowerCase().includes('recu') || t.toLowerCase().includes('rcp') || t.toLowerCase().includes('caut');
        setVerificationRoute({ type: isRecu ? 'recu' : 'contrat', token: t });
      } else {
        setVerificationRoute(null);
      }
    };

    handleUrlCheck();
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

  // Listen to global open register event
  useEffect(() => {
    const handleOpenRegister = () => {
      setIsRegisterModalOpen(true);
    };
    window.addEventListener('locatrust_open_register', handleOpenRegister);
    return () => window.removeEventListener('locatrust_open_register', handleOpenRegister);
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
  };

  const handleNavigateVerificationDocument = (type: 'contrat' | 'recu', token: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/verification/${type}/${token}`);
    }
    setVerificationRoute({ type, token });
  };

  const handleExitVerification = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    setVerificationRoute(null);
  };

  // Si on est sur une page de vérification scannée par QR Code
  if (verificationRoute) {
    return (
      <DocumentVerificationView
        type={verificationRoute.type}
        token={verificationRoute.token}
        onNavigateBack={handleExitVerification}
        onNavigateToDocument={handleNavigateVerificationDocument}
      />
    );
  }

  return (
    <>
      {currentRole === 'proprietaire' && (
        <ProprietaireDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        />
      )}
      {currentRole === 'agence' && (
        <AgencyDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        />
      )}
      {currentRole === 'locataire' && (
        <TenantDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        />
      )}
      {currentRole === 'admin' && (
        <AdminDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        />
      )}

      {/* Global Register Modal requested by user */}
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccessRegister={(registeredRole) => {
          setCurrentRole(registeredRole);
        }}
      />
    </>
  );
}
