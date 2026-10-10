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

// Code Splitting / Lazy Loading pour vitesse de chargement mobile maximale
const LoginPage = lazy(() => import('@/src/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/src/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('@/src/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('@/src/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/src/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const ProfilePage = lazy(() => import('@/src/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const DashboardPage = lazy(() => import('@/src/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DocumentVerificationView = lazy(() => import('@/components/verification/DocumentVerificationView').then(m => ({ default: m.DocumentVerificationView })));
const RegisterModal = lazy(() => import('@/components/auth/RegisterModal').then(m => ({ default: m.RegisterModal })));
const LoginModal = lazy(() => import('@/components/auth/LoginModal').then(m => ({ default: m.LoginModal })));

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

export default function App() {
  return (
    <BrowserRouter>
      <TopProgressBar />
      <AuthProvider>
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
    </BrowserRouter>
  );
}
