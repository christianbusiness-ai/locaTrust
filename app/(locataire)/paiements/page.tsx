'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { LocatairePaiementsView } from '@/components/locataire/LocatairePaiementsView';
import { useAuth } from '@/src/context/AuthContext';

export default function TenantPaiementsPage() {
  const { user, profile } = useAuth();

  const currentUser = {
    id: user?.id || 'guest',
    email: user?.email || 'locataire@locatrust.ci',
    full_name: profile?.full_name || 'Locataire',
    avatar_url: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    role: 'locataire' as const,
    phone: profile?.phone || '',
    is_verified: profile?.is_verified ?? false,
    created_at: new Date().toISOString()
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RoleSwitcher currentRole="locataire" onRoleChange={() => {}} />
      <Header currentUser={currentUser} />

      <div className="max-w-7xl w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        <Sidebar currentRole="locataire" />

        <main className="flex-1 flex flex-col gap-6">
          <LocatairePaiementsView />
        </main>
      </div>
    </div>
  );
}
