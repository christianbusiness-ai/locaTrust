import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { DashboardPageSkeleton } from '@/components/common/SkeletonLoader';
import { isSessionExpired, clearSecuritySession, recordUserActivity } from '@/src/lib/sessionSecurity';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const checkExpiry = () => {
      if (user && isSessionExpired()) {
        clearSecuritySession();
        signOut().catch(() => {});
      } else if (user) {
        recordUserActivity();
      }
    };

    checkExpiry();

    // Vérification automatique au retour dans le navigateur après mise en veille ou arrière-plan
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkExpiry();
      }
    };

    const handleUserInteraction = () => {
      if (user) {
        recordUserActivity();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkExpiry);
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkExpiry);
      window.removeEventListener('pointerdown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [user, location.pathname, signOut]);

  if (loading) {
    return <DashboardPageSkeleton />;
  }

  if (!user || isSessionExpired()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
