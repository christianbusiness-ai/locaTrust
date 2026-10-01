'use client';

import React, { useState } from 'react';
import { MOCK_USERS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { ProprietaireDashboardView } from '@/components/dashboard/ProprietaireDashboardView';
import { BiensView } from '@/components/dashboard/BiensView';
import { CautionsView } from '@/components/dashboard/CautionsView';
import { PaiementsView } from '@/components/dashboard/PaiementsView';
import { MaintenanceView } from '@/components/dashboard/MaintenanceView';
import { AbonnementView } from '@/components/dashboard/AbonnementView';
import { MessagerieView } from '@/components/dashboard/MessagerieView';
import { VisitesView } from '@/components/dashboard/VisitesView';
import { DemandesView } from '@/components/dashboard/DemandesView';
import { DocumentsView } from '@/components/dashboard/DocumentsView';
import { ReceiptsQuittancesView } from '@/components/dashboard/ReceiptsQuittancesView';
import { TenantsListView } from '@/components/dashboard/TenantsListView';
import { HistoriqueView } from '@/components/dashboard/HistoriqueView';
import { PaymentAccountsView } from '@/components/dashboard/PaymentAccountsView';
import { ReportsStatsView } from '@/components/dashboard/ReportsStatsView';
import { AccountingExportView } from '@/components/dashboard/AccountingExportView';
import { SettingsView } from '@/components/dashboard/SettingsView';
import { ContractListView } from '@/components/contracts/ContractListView';
import { ContractDetailView } from '@/components/contracts/ContractDetailView';
import {
  AddPropertyModal,
  CreateContractModal,
  ConfirmPaymentModal,
  SendReminderModal,
  AddPaymentAccountModal,
  SupportModal
} from '@/components/modals/InteractiveModals';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { UserRole } from '@/types/database.types';

interface ProprietaireDashboardPageProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenRegisterModal?: () => void;
}

export default function ProprietaireDashboardPage({
  currentRole = 'proprietaire',
  onRoleChange = () => {},
  onOpenRegisterModal = () => {},
}: ProprietaireDashboardPageProps) {
  const currentUser = MOCK_USERS.proprietaire;

  // Active Navigation Tab State
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab')) return params.get('tab')!;
      if (params.get('contract')) return 'contracts';
    }
    return 'overview';
  });

  const [selectedContractId, setSelectedContractId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('contract')) return params.get('contract');
    }
    return null;
  });

  // Modal Visibility States
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isCreateContractOpen, setIsCreateContractOpen] = useState(false);
  const [selectedContractApp, setSelectedContractApp] = useState<any>(null);
  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);
  const [isSendReminderOpen, setIsSendReminderOpen] = useState(false);
  const [isAddPaymentAccountOpen, setIsAddPaymentAccountOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  const initialContractData = React.useMemo(() => {
    if (!selectedContractApp) return undefined;
    return {
      tenantName: selectedContractApp.tenant_name,
      tenantPhone: selectedContractApp.tenant_phone,
      tenantCni: selectedContractApp.tenant_cni,
      propertyTitle: selectedContractApp.property_title,
      propertyAddress: selectedContractApp.property_address,
      rentAmount: selectedContractApp.rent_amount,
      cautionAmount: selectedContractApp.caution_amount
    };
  }, [selectedContractApp]);

  // Handle Tab Change
  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedContractId(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab, selectedContractId]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070F1E] font-sans text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Top Role Switcher Header */}
      <RoleSwitcher currentRole={currentRole} onRoleChange={onRoleChange} onOpenRegister={onOpenRegisterModal} />

      {/* Main App Top Header */}
      <Header
        currentUser={currentUser}
        onSearch={(term) => console.log('Recherche:', term)}
        onOpenMessages={() => handleSelectTab('messages')}
        onOpenNotifications={() => handleSelectTab('messages')}
        onNavigateTab={handleSelectTab}
        onOpenRegisterModal={onOpenRegisterModal}
      />

      {/* Main Dashboard Layout with Left Navy Sidebar */}
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        
        {/* Left Dark Navy Sidebar */}
        <Sidebar
          currentRole="proprietaire"
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenSupport={() => setIsSupportOpen(true)}
        />

        {/* Main Content Render Area */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* TAB 1: Overview (Tableau de bord) */}
          {activeTab === 'overview' && !selectedContractId && (
            <ProprietaireDashboardView
              onNavigateTab={handleSelectTab}
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

          {/* TAB 2: Properties (Mes Biens) */}
          {activeTab === 'properties' && (
            <BiensView
              onOpenAddProperty={() => setIsAddPropertyOpen(true)}
            />
          )}

          {/* TAB 3: Contracts */}
          {activeTab === 'contracts' && (
            <>
              {selectedContractId ? (
                <ContractDetailView
                  contractNumber={selectedContractId}
                  onBack={() => setSelectedContractId(null)}
                />
              ) : (
                <ContractListView
                  onSelectContract={(contractId) => setSelectedContractId(contractId)}
                  onCreateContract={() => setIsCreateContractOpen(true)}
                />
              )}
            </>
          )}

          {/* TAB 4: Rental Applications (Demandes de Location - Strict candidature, pas de visite) */}
          {(activeTab === 'applications' || activeTab === 'demandes' || activeTab === 'requests') && (
            <ErrorBoundary>
              <DemandesView
                onOpenMessages={() => setActiveTab('messages')}
              />
            </ErrorBoundary>
          )}

          {/* TAB 5: Visit Requests (Demandes de Visite - Strict visites, aucun contrat généré) */}
          {activeTab === 'visits' && (
            <VisitesView
              onOpenMessages={() => setActiveTab('messages')}
            />
          )}

          {/* TAB 6: Guarantees (Cautions & Restitution 100%) */}
          {activeTab === 'guarantees' && (
            <CautionsView userRole="proprietaire" />
          )}

          {/* TAB 7: Payments (Paiements & Loyers) */}
          {activeTab === 'payments' && (
            <PaiementsView
              onOpenConfirmPaymentModal={() => setIsConfirmPaymentOpen(true)}
            />
          )}

          {/* TAB 8: Tenants (Locataires) */}
          {activeTab === 'tenants' && (
            <TenantsListView />
          )}

          {/* TAB 9: Documents (Baux, avenants, CNI, états des lieux) */}
          {activeTab === 'documents' && (
            <DocumentsView />
          )}

          {/* TAB 10: Receipts & Quittances (Quittances de loyer & Reçus de caution) */}
          {activeTab === 'receipts' && (
            <ReceiptsQuittancesView />
          )}

          {/* TAB 11: General History (Historique Général par personne) */}
          {activeTab === 'history' && (
            <ErrorBoundary>
              <HistoriqueView />
            </ErrorBoundary>
          )}

          {/* TAB 12: Maintenance */}
          {activeTab === 'maintenance' && (
            <MaintenanceView />
          )}

          {/* TAB 12: Payout Accounts (Comptes de paiement Mobile Money & Banque) */}
          {activeTab === 'bank_accounts' && (
            <PaymentAccountsView />
          )}

          {/* TAB 13: Reports & Statistics (Rapports & Statistiques) */}
          {activeTab === 'stats' && (
            <ReportsStatsView />
          )}

          {/* TAB 14: Accounting Exports (Exports comptables / Expert-comptable) */}
          {activeTab === 'exports' && (
            <AccountingExportView />
          )}

          {/* TAB 15: Subscription (Abonnement SaaS LocaTrust) */}
          {activeTab === 'subscription' && (
            <AbonnementView />
          )}

          {/* TAB 16: Settings (Paramètres) */}
          {activeTab === 'settings' && (
            <SettingsView
              userRole="proprietaire"
              currentUser={currentUser}
              onNavigateToPaymentAccounts={() => setActiveTab('bank_accounts')}
              onNavigateToSubscription={() => setActiveTab('subscription')}
            />
          )}

          {/* TAB 17: Messages (Messagerie) */}
          {activeTab === 'messages' && (
            <ErrorBoundary>
              <MessagerieView userRole="proprietaire" />
            </ErrorBoundary>
          )}

          {/* Ultimate Fallback (Safeguard) */}
          {!['overview', 'properties', 'contracts', 'guarantees', 'payments', 'tenants', 'receipts', 'history', 'documents', 'maintenance', 'subscription', 'messages', 'applications', 'requests', 'visits', 'demandes', 'bank_accounts', 'stats', 'exports', 'settings'].includes(activeTab) && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-black text-slate-900 capitalize">
                  Section : {activeTab.replace('_', ' ')}
                </h2>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  &laquo; Retour au tableau de bord
                </button>
              </div>

              <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col gap-3">
                <p className="text-sm font-medium text-slate-700">
                  Cette rubrique <strong>{activeTab}</strong> est active et enregistre vos données locatives en temps réel.
                </p>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* ALL INTERACTIVE MODALS */}
      <AddPropertyModal isOpen={isAddPropertyOpen} onClose={() => setIsAddPropertyOpen(false)} />
      <ErrorBoundary>
        <CreateContractModal
          isOpen={isCreateContractOpen}
          onClose={() => {
            setIsCreateContractOpen(false);
            setSelectedContractApp(null);
          }}
          initialData={initialContractData}
        />
      </ErrorBoundary>
      <ConfirmPaymentModal isOpen={isConfirmPaymentOpen} onClose={() => setIsConfirmPaymentOpen(false)} />
      <SendReminderModal isOpen={isSendReminderOpen} onClose={() => setIsSendReminderOpen(false)} />
      <AddPaymentAccountModal isOpen={isAddPaymentAccountOpen} onClose={() => setIsAddPaymentAccountOpen(false)} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />

    </div>
  );
}
