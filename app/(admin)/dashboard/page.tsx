'use client';

import React, { useState } from 'react';
import { MOCK_USERS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { AdminDashboardView } from '@/components/admin/AdminDashboardView';
import { SupportModal } from '@/components/modals/InteractiveModals';
import { UserRole } from '@/types/database.types';

interface AdminDashboardPageProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenRegisterModal?: () => void;
  onExitToLanding?: () => void;
}

export default function AdminDashboardPage({
  currentRole = 'admin',
  onRoleChange = () => {},
  onOpenRegisterModal = () => {},
  onExitToLanding,
}: AdminDashboardPageProps) {
  const currentUser = MOCK_USERS.admin;
  const [activeTab, setActiveTab] = useState<string>('supervision');
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      
      {/* Top Role Switcher Header */}
      <RoleSwitcher
        currentRole={currentRole}
        onRoleChange={onRoleChange}
        onOpenRegister={onOpenRegisterModal}
        onExitToLanding={onExitToLanding}
      />

      {/* Main App Top Header */}
      <Header
        currentUser={currentUser}
        onSearch={(t) => console.log('Recherche Admin:', t)}
        onOpenMessages={() => setActiveTab('messages')}
        onOpenNotifications={() => setActiveTab('messages')}
        onOpenRegisterModal={onOpenRegisterModal}
        onExitToLanding={onExitToLanding}
        showCreateAccountBtn={false}
      />

      {/* Main Admin Layout */}
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        
        <Sidebar
          currentRole="admin"
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSupport={() => setIsSupportOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0">
          <AdminDashboardView
            activeTab={activeTab === 'overview' ? 'supervision' : activeTab}
            onSelectTab={setActiveTab}
          />
        </main>
      </div>

      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
}
