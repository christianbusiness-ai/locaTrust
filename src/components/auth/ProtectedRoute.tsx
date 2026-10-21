import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { DashboardPageSkeleton } from '@/components/common/SkeletonLoader';
import { isSessionExpired, clearSecuritySession, recordUserActivity } from '@/src/lib/sessionSecurity';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      if (isSessionExpired()) {
        clearSecuritySession();
        signOut().catch(() => {});
      } else {
        recordUserActivity();
      }
    }
  }, [user, location.pathname, signOut]);

  if (loading) {
    return <DashboardPageSkeleton />;
  }

  if (!user || isSessionExpired()) {
    return <Navigate to="/login?reason=session_expired" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
