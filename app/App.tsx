import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types/database.types';
import ProprietaireDashboardPage from './(proprietaire)/dashboard/page';
import AgencyDashboardPage from './(agence)/dashboard/page';
import TenantDashboardPage from './(locataire)/dashboard/page';
import AdminDashboardPage from './(admin)/dashboard/page';
import { DocumentVerificationView } from '@/components/verification/DocumentVerificationView';
import { RegisterModal } from '@/components/auth/RegisterModal';
import { LandingPageView } from '@/components/landing/LandingPageView';

export default function App() {
  // Navigation view: 'landing' (public showcase) or 'saas' (authenticated SaaS space)
  const [currentView, setCurrentView] = useState<'landing' | 'saas'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'saas') return 'saas';
      if (params.get('view') === 'landing') return 'landing';
      const saved = localStorage.getItem('locatrust_view');
      if (saved === 'saas') return 'saas';
    }
    return 'landing';
  });

  // Active role state default to 'proprietaire', can switch to 'agence', 'locataire', 'admin'
  const [currentRole, setCurrentRole] = useState<UserRole>('proprietaire');

  // Mode Démo vs Compte Réel :
  // "cette partie (RoleSwitcher) doit rester dans la partie démo seulement.
  // Une fois un compte est créé, le compte ne peut pas basculer dans n'importe quel sens,
  // il faut cacher cette partie une fois un compte est créé."
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isAccountCreated = localStorage.getItem('locatrust_account_created') === 'true';
      if (isAccountCreated) return false;
      const isDemo = localStorage.getItem('locatrust_is_demo');
      if (isDemo === 'false') return false;
    }
    return true; // Mode démo par défaut
  });

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

  // Listen to global open register and exit landing events
  useEffect(() => {
    const handleOpenRegister = () => {
      setIsRegisterModalOpen(true);
    };
    const handleExitLanding = () => {
      setCurrentView('landing');
      if (typeof window !== 'undefined') {
        localStorage.setItem('locatrust_view', 'landing');
      }
    };
    window.addEventListener('locatrust_open_register', handleOpenRegister);
    window.addEventListener('locatrust_exit_landing', handleExitLanding);
    return () => {
      window.removeEventListener('locatrust_open_register', handleOpenRegister);
      window.removeEventListener('locatrust_exit_landing', handleExitLanding);
    };
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    // Si un compte réel a été créé, l'utilisateur ne peut pas basculer de rôle
    if (!isDemoMode) return;
    setCurrentRole(newRole);
  };

  const handleExitToLanding = () => {
    setCurrentView('landing');
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_view', 'landing');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEnterSaaS = (role?: UserRole, asDemo = true) => {
    if (role) {
      setCurrentRole(role);
    }
    setIsDemoMode(asDemo);
    setCurrentView('saas');
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_view', 'saas');
      localStorage.setItem('locatrust_is_demo', asDemo ? 'true' : 'false');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

  // 1. Vue Landing Page : Showcase public avec le bouton "Créer un compte" prêt et visible
  if (currentView === 'landing') {
    return (
      <>
        <LandingPageView
          onOpenRegister={() => setIsRegisterModalOpen(true)}
          onEnterSaaS={handleEnterSaaS}
        />

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccessRegister={(registeredRole) => {
            setCurrentRole(registeredRole);
            setIsDemoMode(false);
            setCurrentView('saas');
            if (typeof window !== 'undefined') {
              localStorage.setItem('locatrust_view', 'saas');
              localStorage.setItem('locatrust_account_created', 'true');
              localStorage.setItem('locatrust_is_demo', 'false');
              localStorage.setItem('locatrust_registered_role', registeredRole);
            }
          }}
        />
      </>
    );
  }

  // 2. Vue SaaS Authentifiée : Une fois le compte créé ou connecté, le bouton "Créer un compte" et le RoleSwitcher NE S'AFFICHENT PLUS
  return (
    <>
      {currentRole === 'proprietaire' && (
        <ProprietaireDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          onExitToLanding={handleExitToLanding}
          isDemo={isDemoMode}
        />
      )}
      {currentRole === 'agence' && (
        <AgencyDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          onExitToLanding={handleExitToLanding}
          isDemo={isDemoMode}
        />
      )}
      {currentRole === 'locataire' && (
        <TenantDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          onExitToLanding={handleExitToLanding}
          isDemo={isDemoMode}
        />
      )}
      {currentRole === 'admin' && (
        <AdminDashboardPage
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          onExitToLanding={handleExitToLanding}
        />
      )}

      {/* Global Register Modal (utilisable si déclenché) */}
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccessRegister={(registeredRole) => {
          setCurrentRole(registeredRole);
          setIsDemoMode(false);
          setCurrentView('saas');
          if (typeof window !== 'undefined') {
            localStorage.setItem('locatrust_view', 'saas');
            localStorage.setItem('locatrust_account_created', 'true');
            localStorage.setItem('locatrust_is_demo', 'false');
            localStorage.setItem('locatrust_registered_role', registeredRole);
          }
        }}
      />
    </>
  );
}
