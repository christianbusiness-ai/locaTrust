'use client';

import React, { useState } from 'react';
import { MOCK_USERS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { UserRole } from '@/types/database.types';

// Agency & Proprietaire shared components
import { ProprietaireDashboardView } from '@/components/dashboard/ProprietaireDashboardView';
import { AgenceDashboardView } from '@/components/agence/AgenceDashboardView';
import { MultiProprietairesView } from '@/components/agence/MultiProprietairesView';
import { AgenceEquipeView } from '@/components/agence/AgenceEquipeView';

// Reused components from components/dashboard & components/contracts
import { BiensView } from '@/components/dashboard/BiensView';
import { CautionsView } from '@/components/dashboard/CautionsView';
import { PaiementsView } from '@/components/dashboard/PaiementsView';
import { HistoriqueView } from '@/components/dashboard/HistoriqueView';
import { MaintenanceView } from '@/components/dashboard/MaintenanceView';
import { AbonnementView } from '@/components/dashboard/AbonnementView';
import { MessagerieView } from '@/components/dashboard/MessagerieView';
import { ContractListView } from '@/components/contracts/ContractListView';
import { ContractDetailView } from '@/components/contracts/ContractDetailView';
import { DemandesView } from '@/components/dashboard/DemandesView';
import { VisitesView } from '@/components/dashboard/VisitesView';
import { ReportsStatsView } from '@/components/dashboard/ReportsStatsView';
import { AccountingExportView } from '@/components/dashboard/AccountingExportView';
import { SettingsView } from '@/components/dashboard/SettingsView';
import { PaymentAccountsView } from '@/components/dashboard/PaymentAccountsView';
import { DocumentsView } from '@/components/dashboard/DocumentsView';
import { ReceiptsQuittancesView } from '@/components/dashboard/ReceiptsQuittancesView';
import { TenantsListView } from '@/components/dashboard/TenantsListView';

// Shared modals
import {
  AddPropertyModal,
  CreateContractModal,
  ConfirmPaymentModal,
  SendReminderModal,
  AddPaymentAccountModal,
  SupportModal
} from '@/components/modals/InteractiveModals';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface AgencyDashboardPageProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenRegisterModal?: () => void;
  onExitToLanding?: () => void;
  isDemo?: boolean;
}

export default function AgencyDashboardPage({
  currentRole = 'agence',
  onRoleChange = () => {},
  onOpenRegisterModal = () => {},
  onExitToLanding,
  isDemo,
}: AgencyDashboardPageProps) {
  const currentUser = MOCK_USERS.agence;

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // Modals
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isCreateContractOpen, setIsCreateContractOpen] = useState(false);
  const [selectedContractApp, setSelectedContractApp] = useState<any>(null);
  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);
  const [isSendReminderOpen, setIsSendReminderOpen] = useState(false);
  const [isAddPaymentAccountOpen, setIsAddPaymentAccountOpen] = useState(false);
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
        onSearch={(t) => console.log('Recherche Agence:', t)}
        onOpenMessages={() => setActiveTab('messages')}
        onOpenNotifications={() => setActiveTab('messages')}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setSelectedContractId(null);
        }}
        onOpenRegisterModal={onOpenRegisterModal}
        onExitToLanding={onExitToLanding}
        showCreateAccountBtn={false}
      />

      {/* Main Agency Layout with Dark Navy Sidebar */}
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        
        <Sidebar
          currentRole="agence"
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setSelectedContractId(null);
          }}
          onOpenSupport={() => setIsSupportOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0">
          
          {/* TAB 1: Dashboard Overview (Identique au Propriétaire pour fonctionnement 100% unifié) */}
          {activeTab === 'overview' && !selectedContractId && (
            <ProprietaireDashboardView
              userRole="agence"
              userName="Immobilière du Golf"
              onNavigateTab={setActiveTab}
              onOpenAddProperty={() => setIsAddPropertyOpen(true)}
              onOpenCreateContract={() => setIsCreateContractOpen(true)}
              onOpenConfirmPayment={() => setIsConfirmPaymentOpen(true)}
              onOpenSendReminder={() => setIsSendReminderOpen(true)}
              onOpenAddPaymentAccount={() => setIsAddPaymentAccountOpen(true)}
              onSelectContract={(id) => {
                setSelectedContractId(id);
                setActiveTab('contracts');
              }}
            />
          )}

          {/* TAB 2: Multi-Bailleurs Mandants */}
          {activeTab === 'owners' && (
            <MultiProprietairesView />
          )}

          {/* TAB 3: Équipe Agence */}
          {activeTab === 'team' && (
            <AgenceEquipeView />
          )}

          {/* TAB 4: Properties (Reused BiensView) */}
          {activeTab === 'properties' && (
            <BiensView
              onOpenAddProperty={() => setIsAddPropertyOpen(true)}
            />
          )}

          {/* TAB 5: Contracts (Reused Contract views) */}
          {activeTab === 'contracts' && (
            <>
              {selectedContractId ? (
                <ContractDetailView
                  contractNumber={selectedContractId}
                  isAgency={true}
                  onBack={() => setSelectedContractId(null)}
                />
              ) : (
                <ContractListView
                  onSelectContract={(id) => setSelectedContractId(id)}
                  onCreateContract={() => setIsCreateContractOpen(true)}
                />
              )}
            </>
          )}

          {/* TAB 6: Demandes de location (Strict candidature) */}
          {(activeTab === 'applications' || activeTab === 'requests' || activeTab === 'demandes') && (
            <ErrorBoundary>
              <DemandesView
                onOpenMessages={() => setActiveTab('messages')}
              />
            </ErrorBoundary>
          )}

          {/* TAB 7: Demandes de Visite */}
          {activeTab === 'visits' && (
            <VisitesView
              onOpenMessages={() => setActiveTab('messages')}
            />
          )}

          {/* TAB 8: Guarantees (Reused CautionsView with isAgency) */}
          {activeTab === 'guarantees' && (
            <CautionsView isAgency={true} userRole="agence" />
          )}

          {/* TAB 9: Payments (Reused PaiementsView) */}
          {activeTab === 'payments' && (
            <PaiementsView
              onOpenConfirmPaymentModal={() => setIsConfirmPaymentOpen(true)}
            />
          )}

          {/* TAB 10: Tenants (Locataires du parc) */}
          {activeTab === 'tenants' && (
            <TenantsListView />
          )}

          {/* TAB 11: Documents */}
          {activeTab === 'documents' && (
            <DocumentsView />
          )}

          {/* TAB 12: Receipts & Quittances */}
          {activeTab === 'receipts' && (
            <ReceiptsQuittancesView />
          )}

          {/* TAB 13: History (Historique général) */}
          {activeTab === 'history' && (
            <HistoriqueView />
          )}

          {/* TAB 14: Maintenance (Reused MaintenanceView) */}
          {activeTab === 'maintenance' && (
            <MaintenanceView />
          )}

          {/* TAB 15: Payout Accounts */}
          {activeTab === 'bank_accounts' && (
            <PaymentAccountsView />
          )}

          {/* TAB 16: Reports & Statistics (Point 4) */}
          {activeTab === 'stats' && (
            <ReportsStatsView />
          )}

          {/* TAB 17: Accounting Exports (Point 4) */}
          {activeTab === 'exports' && (
            <AccountingExportView />
          )}

          {/* TAB 18: Subscription (Reused AbonnementView) */}
          {activeTab === 'subscription' && (
            <AbonnementView />
          )}

          {/* TAB 19: Settings (Point 4) */}
          {activeTab === 'settings' && (
            <SettingsView
              userRole="agence"
              currentUser={currentUser}
              onNavigateToPaymentAccounts={() => setActiveTab('bank_accounts')}
              onNavigateToSubscription={() => setActiveTab('subscription')}
            />
          )}

          {/* TAB 20: Messages (Reused MessagerieView) */}
          {activeTab === 'messages' && (
            <MessagerieView userRole="agence" />
          )}

          {/* Fallback for other tabs */}
          {!['overview', 'owners', 'team', 'properties', 'contracts', 'guarantees', 'payments', 'tenants', 'receipts', 'documents', 'maintenance', 'subscription', 'messages', 'applications', 'requests', 'visits', 'demandes', 'stats', 'exports', 'settings', 'history', 'bank_accounts'].includes(activeTab) && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-black text-slate-900 capitalize">
                  Gestion Agence : {activeTab.replace('_', ' ')}
                </h2>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  &laquo; Retour au tableau de bord agence
                </button>
              </div>

              <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col gap-3">
                <p className="text-sm font-medium text-slate-700">
                  Cette section <strong>{activeTab}</strong> est active et enregistre les données de votre agence en temps réel.
                </p>

                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => setIsAddPropertyOpen(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
                    + Ajouter un bien au mandat
                  </button>
                  <button onClick={() => setIsCreateContractOpen(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                    Générer un contrat
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ALL SHARED MODALS */}
      <AddPropertyModal isOpen={isAddPropertyOpen} onClose={() => setIsAddPropertyOpen(false)} />
      <CreateContractModal
        isOpen={isCreateContractOpen}
        onClose={() => {
          setIsCreateContractOpen(false);
          setSelectedContractApp(null);
        }}
        initialData={selectedContractApp ? {
          tenantName: selectedContractApp.tenant_name,
          tenantPhone: selectedContractApp.tenant_phone,
          tenantCni: selectedContractApp.tenant_cni,
          propertyTitle: selectedContractApp.property_title,
          propertyAddress: selectedContractApp.property_address,
          rentAmount: selectedContractApp.rent_amount,
          cautionAmount: selectedContractApp.caution_amount
        } : undefined}
      />
      <ConfirmPaymentModal isOpen={isConfirmPaymentOpen} onClose={() => setIsConfirmPaymentOpen(false)} />
      <SendReminderModal isOpen={isSendReminderOpen} onClose={() => setIsSendReminderOpen(false)} />
      <AddPaymentAccountModal isOpen={isAddPaymentAccountOpen} onClose={() => setIsAddPaymentAccountOpen(false)} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
}
