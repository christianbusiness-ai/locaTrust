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

// Reused components
import { CautionsView } from '@/components/dashboard/CautionsView';
import { MessagerieView } from '@/components/dashboard/MessagerieView';
import { SupportModal } from '@/components/modals/InteractiveModals';

interface TenantDashboardPageProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenRegisterModal?: () => void;
}

export default function TenantDashboardPage({
  currentRole = 'locataire',
  onRoleChange = () => {},
  onOpenRegisterModal = () => {},
}: TenantDashboardPageProps) {
  const currentUser = MOCK_USERS.locataire;
  // Default to 'feed' as requested in prompt & mockup image
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      
      {/* Top Role Switcher Header */}
      <RoleSwitcher currentRole={currentRole} onRoleChange={onRoleChange} onOpenRegister={onOpenRegisterModal} />

      {/* Main App Top Header */}
      <Header
        currentUser={currentUser}
        onSearch={(t) => console.log('Recherche Locataire:', t)}
        onOpenMessages={() => setActiveTab('messages')}
        onOpenNotifications={() => setActiveTab('messages')}
        onNavigateTab={setActiveTab}
        onOpenRegisterModal={onOpenRegisterModal}
      />

      {/* Main Tenant Layout with Dark Navy Sidebar */}
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        
        <Sidebar
          currentRole="locataire"
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSupport={() => setIsSupportOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0">
          
          {/* TAB 1: Fil d'actualité (Fidèle à l'image fournie) */}
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

          {/* TAB 8: Support / Profil / Paramètres fallback */}
          {!['feed', 'overview', 'search', 'properties', 'applications', 'visits', 'favorites', 'contracts', 'receipts', 'documents', 'payments', 'maintenance', 'guarantees', 'messages'].includes(activeTab) && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-black text-slate-900 capitalize">
                  Section Locataire : {activeTab.replace('_', ' ')}
                </h2>
                <button
                  onClick={() => setActiveTab('feed')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  &laquo; Retour au fil d'actualité
                </button>
              </div>

              <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col gap-3">
                <p className="text-sm font-medium text-slate-700">
                  Cette section <strong>{activeTab}</strong> est active et enregistre vos données locatives sécurisées.
                </p>
              </div>
            </div>
          )}

        </main>
      </div>

      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
}
