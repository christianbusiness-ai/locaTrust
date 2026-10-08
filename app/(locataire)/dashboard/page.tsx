'use client';

import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { getActiveUser } from '@/lib/authStore';
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

import { ShieldCheck, ArrowRight } from 'lucide-react';

interface TenantDashboardPageProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenRegisterModal?: () => void;
  onExitToLanding?: () => void;
  isDemo?: boolean;
}

export default function TenantDashboardPage({
  currentRole = 'locataire',
  onRoleChange = () => {},
  onOpenRegisterModal = () => {},
  onExitToLanding,
  isDemo,
}: TenantDashboardPageProps) {
  const { user, profile } = useAuth();
  const activeUser = getActiveUser();
  const currentUser = user ? {
    id: user.id,
    email: user.email || '',
    full_name: profile?.full_name || user.user_metadata?.full_name || 'Locataire',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || '',
    role: 'locataire' as const,
    phone: profile?.phone || '',
    verification_status: profile?.verification_status || 'non_verifie',
    is_verified: profile?.verification_status === 'verifie',
    created_at: profile?.created_at || user.created_at || new Date().toISOString()
  } : (activeUser || {
    id: 'guest',
    email: 'locataire@locatrust.ci',
    full_name: 'Locataire',
    avatar_url: '',
    role: 'locataire' as const,
    phone: '',
    verification_status: 'non_verifie',
    is_verified: false,
    created_at: new Date().toISOString()
  });

  const [activeTab, setActiveTab] = useState<string>('feed');
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      
      {/* Top Role Switcher Header (Uniquement en mode Démo, masqué une fois compte créé) */}
      <RoleSwitcher
        currentRole={currentRole}
        onRoleChange={onRoleChange}
        onOpenRegister={onOpenRegisterModal}
        onExitToLanding={onExitToLanding}
        isDemo={isDemo}
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
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-3 sm:px-4 lg:px-8 py-4 sm:py-6 flex-1">
        
        <Sidebar
          currentRole="locataire"
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSupport={() => setActiveTab('support')}
        />

        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Bannière KYC discrète et responsive si compte non encore certifié */}
          {profile?.verification_status !== 'verifie' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {profile?.verification_status === 'en_attente'
                      ? 'Dossier KYC en cours d’examen'
                      : 'Certification de profil requise (Dossier KYC)'}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {profile?.verification_status === 'en_attente'
                      ? 'Votre pièce d’identité est en cours de validation par nos équipes. Vos demandes de location seront certifiées dès validation.'
                      : 'Pour candidater aux logements et contacter les bailleurs, veuillez certifier votre profil avec votre pièce d’identité (CNI / Passeport).'}
                  </p>
                </div>
              </div>
              {profile?.verification_status !== 'en_attente' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('profile');
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  <span>Certifier mon compte (KYC)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

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
