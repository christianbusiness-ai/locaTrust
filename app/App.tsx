import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { LandingPageView } from '@/components/landing/LandingPageView';
import { UserRole } from '@/types/database.types';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Helper de chargement dynamique avec purge de cache automatique lors des déploiements
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const sessionKey = `locatrust_retry_${chunkName}`;
    try {
      const res = await factory();
      sessionStorage.removeItem(sessionKey);
      return res;
    } catch (err: any) {
      console.warn(`[LocaTrust] Erreur chargement bundle ${chunkName}:`, err);
      const hasRetried = sessionStorage.getItem(sessionKey);
      if (!hasRetried && typeof window !== 'undefined') {
        sessionStorage.setItem(sessionKey, '1');
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

// Code Splitting / Lazy Loading résistant aux rechargements sur mobile
const LoginPage = lazyWithRetry(() => import('@/src/pages/LoginPage').then(m => ({ default: m.LoginPage })), 'login');
const RegisterPage = lazyWithRetry(() => import('@/src/pages/RegisterPage').then(m => ({ default: m.RegisterPage })), 'register');
const VerifyEmailPage = lazyWithRetry(() => import('@/src/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })), 'verifyEmail');
const ForgotPasswordPage = lazyWithRetry(() => import('@/src/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })), 'forgotPw');
const ResetPasswordPage = lazyWithRetry(() => import('@/src/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })), 'resetPw');
const ProfilePage = lazyWithRetry(() => import('@/src/pages/ProfilePage').then(m => ({ default: m.ProfilePage })), 'profile');
const DashboardPage = lazyWithRetry(() => import('@/src/pages/DashboardPage').then(m => ({ default: m.DashboardPage })), 'dashboard');
const DocumentVerificationView = lazyWithRetry(() => import('@/components/verification/DocumentVerificationView').then(m => ({ default: m.DocumentVerificationView })), 'docVerify');
const RegisterModal = lazyWithRetry(() => import('@/components/auth/RegisterModal').then(m => ({ default: m.RegisterModal })), 'regModal');
const LoginModal = lazyWithRetry(() => import('@/components/auth/LoginModal').then(m => ({ default: m.LoginModal })), 'loginModal');

import { TopProgressBar } from '@/components/common/TopProgressBar';
import { DashboardPageSkeleton } from '@/components/common/SkeletonLoader';
import { PwaInstallPrompt } from '@/components/common/PwaInstallPrompt';

// Composant de vérification publique QR Code
const QrVerificationWrapper: React.FC<{ forcedType?: 'contrat' | 'recu' }> = ({ forcedType }) => {
  const navigate = useNavigate();
  const params = useParams();
  const token = params.token || '';
  const typeParam = (params.type || forcedType || 'contrat') as 'contrat' | 'recu';

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DocumentVerificationView
        type={typeParam}
        token={token}
        onNavigateBack={() => navigate('/')}
        onNavigateToDocument={(t, tok) => navigate(`/verification/${t}/${tok}`)}
      />
    </Suspense>
  );
};

// Page d'accueil / Vitrine publique avec support des modales
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      <LandingPageView
        onOpenRegister={() => navigate('/register')}
        onOpenLogin={() => navigate('/login')}
        onEnterSaaS={() => {
          if (user) {
            navigate('/dashboard');
          } else {
            navigate('/login');
          }
        }}
      />

      {isLoginOpen && (
        <Suspense fallback={null}>
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
            onOpenRegister={() => {
              setIsLoginOpen(false);
              navigate('/register');
            }}
            onSuccessLogin={() => {
              setIsLoginOpen(false);
              navigate('/dashboard');
            }}
          />
        </Suspense>
      )}

      {isRegisterOpen && (
        <Suspense fallback={null}>
          <RegisterModal
            isOpen={isRegisterOpen}
            onClose={() => setIsRegisterOpen(false)}
            onSuccessRegister={() => {
              setIsRegisterOpen(false);
              navigate('/dashboard');
            }}
          />
        </Suspense>
      )}
    </>
  );
};

import { subscribeToLiveSync } from '@/lib/supabaseRealtime';

// Gestionnaire global de synchronisation Realtime multi-appareils (Desktop ↔ Mobile)
const LiveSyncManager: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToLiveSync(user?.id);

    const triggerGlobalSync = () => {
      subscribeToLiveSync(user?.id);
      window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
      window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerGlobalSync();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', triggerGlobalSync);

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', triggerGlobalSync);
    };
  }, [user?.id]);

  return null;
};

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <TopProgressBar />
        <AuthProvider>
          <LiveSyncManager />
          <Suspense fallback={<DashboardPageSkeleton />}>
            <Routes>
              {/* Routes Publiques d'Authentification */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Routes Privées Sécurisées */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Routes Publiques de Scan QR Code */}
              <Route path="/verify/:token" element={<QrVerificationWrapper />} />
              <Route path="/verify/contrat/:token" element={<QrVerificationWrapper forcedType="contrat" />} />
              <Route path="/verify/recu/:token" element={<QrVerificationWrapper forcedType="recu" />} />
              <Route path="/verification/:type/:token" element={<QrVerificationWrapper />} />

              {/* Page d'accueil / Vitrine */}
              <Route path="/" element={<HomePage />} />

              {/* Redirection par défaut */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          {/* Bannière et Modal d'installation PWA (Accessible sur tout le site) */}
          <PwaInstallPrompt />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
