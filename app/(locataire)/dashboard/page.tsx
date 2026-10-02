'use client';

import React, { useState } from 'react';
import { MOCK_USERS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { UserRole } from '@/types/database.types';

// Tenant components
import { LocataireFeedView } from '@/components/locataire/LocataireFeedView';
import { LocataireSearchView } from '@/components/locataire/LocataireSearchView';
import { LocataireContratsView } from '@/components/locataire/LocataireContratsView';
import { LocatairePaiementsView } from '@/components/locataire/LocatairePaiementsView';
import { LocataireMaintenanceView } from '@/components/locataire/LocataireMaintenanceView';
import { LocataireNotificationsView } from '@/components/locataire/LocataireNotificationsView';
import { LocataireProfileView } from '@/components/locataire/LocataireProfileView';
import { LocataireSettingsView } from '@/components/locataire/LocataireSettingsView';
import { LocataireSupportView } from '@/components/locataire/LocataireSupportView';

// Reused components
import { CautionsView } from '@/components/dashboard/CautionsView';
import { MessagerieView } from '@/components/dashboard/MessagerieView';
import { SupportModal } from '@/components/modals/InteractiveModals';

interface TenantDashboardPageProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenRegisterModal?: () => void;
  onExitToLanding?: () => void;
}

export default function TenantDashboardPage({
  currentRole = 'locataire',
  onRoleChange = () => {},
  onOpenRegisterModal = () => {},
  onExitToLanding,
}: TenantDashboardPageProps) {
  const currentUser = MOCK_USERS.locataire;
  // Default to 'feed' as requested in prompt & mockup image
  const [activeTab, setActiveTab] = useState<string>('feed');
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
        onSearch={(t) => console.log('Recherche Locataire:', t)}
        onOpenMessages={() => setActiveTab('messages')}
        onOpenNotifications={() => setActiveTab('notifications')}
        onNavigateTab={setActiveTab}
        onOpenRegisterModal={onOpenRegisterModal}
        onExitToLanding={onExitToLanding}
        showCreateAccountBtn={false}
      />

      {/* Main Tenant Layout with Dark Navy Sidebar */}
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        
        <Sidebar
          currentRole="locataire"
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSupport={() => setActiveTab('support')}
        />

        <main className="flex-1 flex flex-col min-w-0">
          
          {/* TAB 1: Fil d'actualité */}
          {(activeTab === 'feed' || activeTab === 'overview') && (
            <LocataireFeedView
              onOpenMessages={() => setActiveTab('messages')}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* TAB 2: Search & Marketplace Feed */}
          {(activeTab === 'search' || activeTab === 'properties' || activeTab === 'applications' || activeTab === 'visits' || activeTab === 'favorites') && (
            <LocataireSearchView />
          )}

          {/* TAB 3: Contracts, Receipts & Bailleur History */}
          {(activeTab === 'contracts' || activeTab === 'receipts' || activeTab === 'documents') && (
            <LocataireContratsView />
          )}

          {/* TAB 4: Payments Declarative */}
          {activeTab === 'payments' && (
            <LocatairePaiementsView />
          )}

          {/* TAB 5: Maintenance */}
          {activeTab === 'maintenance' && (
            <LocataireMaintenanceView />
          )}

          {/* TAB 6: Guarantees / Cautions */}
          {activeTab === 'guarantees' && (
            <CautionsView userRole="locataire" />
          )}

          {/* TAB 7: Messages */}
          {activeTab === 'messages' && (
            <MessagerieView userRole="locataire" />
          )}

          {/* TAB 8: Notifications Locataire */}
          {activeTab === 'notifications' && (
            <LocataireNotificationsView onNavigateTab={setActiveTab} />
          )}

          {/* TAB 9: Mon Compte / Mon Profil Locataire */}
          {(activeTab === 'profile' || activeTab === 'account') && (
            <LocataireProfileView />
          )}

          {/* TAB 10: Paramètres Locataire */}
          {activeTab === 'settings' && (
            <LocataireSettingsView />
          )}

          {/* TAB 11: Aide & Support Locataire (Direct messaging ticket) */}
          {activeTab === 'support' && (
            <LocataireSupportView />
          )}

        </main>
      </div>

      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
}
