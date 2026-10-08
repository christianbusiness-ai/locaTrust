import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { LoginPage } from '@/src/pages/LoginPage';
import { RegisterPage } from '@/src/pages/RegisterPage';
import { VerifyEmailPage } from '@/src/pages/VerifyEmailPage';
import { ForgotPasswordPage } from '@/src/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/src/pages/ResetPasswordPage';
import { ProfilePage } from '@/src/pages/ProfilePage';
import { DashboardPage } from '@/src/pages/DashboardPage';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { DocumentVerificationView } from '@/components/verification/DocumentVerificationView';
import { LandingPageView } from '@/components/landing/LandingPageView';
import { RegisterModal } from '@/components/auth/RegisterModal';
import { LoginModal } from '@/components/auth/LoginModal';
import { UserRole } from '@/types/database.types';

// Composant de vérification publique QR Code
const QrVerificationWrapper: React.FC<{ forcedType?: 'contrat' | 'recu' }> = ({ forcedType }) => {
  const navigate = useNavigate();
  const params = useParams();
  const token = params.token || '';
  const typeParam = (params.type || forcedType || 'contrat') as 'contrat' | 'recu';

  return (
    <DocumentVerificationView
      type={typeParam}
      token={token}
      onNavigateBack={() => navigate('/')}
      onNavigateToDocument={(t, tok) => navigate(`/verification/${t}/${tok}`)}
    />
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

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccessRegister={() => {
          setIsRegisterOpen(false);
          navigate('/dashboard');
        }}
      />
    </>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}
