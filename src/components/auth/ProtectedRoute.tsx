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

    // Vérification automatique au retour dans le navigateur après mise en arrière-plan
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkExpiry();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkExpiry);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkExpiry);
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
