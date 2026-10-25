'use client';

import React, { useState, Suspense, lazy } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { getActiveUser } from '@/lib/authStore';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { UserRole } from '@/types/database.types';
import { DashboardPageSkeleton } from '@/components/common/SkeletonLoader';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Agency & Proprietaire shared components
import { ProprietaireDashboardView } from '@/components/dashboard/ProprietaireDashboardView';
import { AgenceDashboardView } from '@/components/agence/AgenceDashboardView';

// Lazy loading ciblé des sous-vues pour booster la vitesse mobile
const MultiProprietairesView = lazy(() => import('@/components/agence/MultiProprietairesView').then(m => ({ default: m.MultiProprietairesView })));
const AgenceEquipeView = lazy(() => import('@/components/agence/AgenceEquipeView').then(m => ({ default: m.AgenceEquipeView })));
const BiensView = lazy(() => import('@/components/dashboard/BiensView').then(m => ({ default: m.BiensView })));
const CautionsView = lazy(() => import('@/components/dashboard/CautionsView').then(m => ({ default: m.CautionsView })));
const PaiementsView = lazy(() => import('@/components/dashboard/PaiementsView').then(m => ({ default: m.PaiementsView })));
const HistoriqueView = lazy(() => import('@/components/dashboard/HistoriqueView').then(m => ({ default: m.HistoriqueView })));
const MaintenanceView = lazy(() => import('@/components/dashboard/MaintenanceView').then(m => ({ default: m.MaintenanceView })));
const AbonnementView = lazy(() => import('@/components/dashboard/AbonnementView').then(m => ({ default: m.AbonnementView })));
const MessagerieView = lazy(() => import('@/components/dashboard/MessagerieView').then(m => ({ default: m.MessagerieView })));
const ContractListView = lazy(() => import('@/components/contracts/ContractListView').then(m => ({ default: m.ContractListView })));
const ContractDetailView = lazy(() => import('@/components/contracts/ContractDetailView').then(m => ({ default: m.ContractDetailView })));
const LocataireSupportView = lazy(() => import('@/components/locataire/LocataireSupportView').then(m => ({ default: m.LocataireSupportView })));
const DemandesView = lazy(() => import('@/components/dashboard/DemandesView').then(m => ({ default: m.DemandesView })));
const VisitesView = lazy(() => import('@/components/dashboard/VisitesView').then(m => ({ default: m.VisitesView })));
const ReportsStatsView = lazy(() => import('@/components/dashboard/ReportsStatsView').then(m => ({ default: m.ReportsStatsView })));
const AccountingExportView = lazy(() => import('@/components/dashboard/AccountingExportView').then(m => ({ default: m.AccountingExportView })));
const SettingsView = lazy(() => import('@/components/dashboard/SettingsView').then(m => ({ default: m.SettingsView })));
const PaymentAccountsView = lazy(() => import('@/components/dashboard/PaymentAccountsView').then(m => ({ default: m.PaymentAccountsView })));
const DocumentsView = lazy(() => import('@/components/dashboard/DocumentsView').then(m => ({ default: m.DocumentsView })));
const ReceiptsQuittancesView = lazy(() => import('@/components/dashboard/ReceiptsQuittancesView').then(m => ({ default: m.ReceiptsQuittancesView })));
const TenantsListView = lazy(() => import('@/components/dashboard/TenantsListView').then(m => ({ default: m.TenantsListView })));

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
import { ShieldAlert, ArrowRight } from 'lucide-react';

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
  isDemo = false,
}: AgencyDashboardPageProps) {
  const { user, profile } = useAuth();
  const activeUser = getActiveUser();
  const currentUser = user ? {
    id: user.id,
    email: user.email || '',
    full_name: profile?.full_name || user.user_metadata?.full_name || 'Agence Immobilière Agréée',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || (typeof window !== 'undefined' ? (localStorage.getItem(`locatrust_user_avatar_${user.id}`) || localStorage.getItem('locatrust_user_avatar') || '') : ''),
    role: 'agence' as const,
    phone: profile?.phone || '',
    verification_status: profile?.verification_status || 'non_verifie',
    is_verified: profile?.verification_status === 'verifie',
    created_at: profile?.created_at || user.created_at || new Date().toISOString()
  } : (activeUser || {
    id: 'guest',
    email: 'agence@locatrust.ci',
    full_name: 'Agence Immobilière Agréée',
    avatar_url: '',
    role: 'agence' as const,
    phone: '',
    verification_status: 'non_verifie',
    is_verified: false,
    created_at: new Date().toISOString()
  });

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
      <div className="max-w-[1600px] w-full mx-auto flex gap-6 px-3 sm:px-4 lg:px-8 py-4 sm:py-6 flex-1">
        
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
          
          {/* Bannière KYC discrète et responsive si compte non encore certifié */}
          {profile?.verification_status !== 'verifie' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {profile?.verification_status === 'en_attente'
                      ? 'Agrément Agence en cours d’examen'
                      : 'Certification RCCM / Agrément requis'}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {profile?.verification_status === 'en_attente'
                      ? 'Votre registre de commerce et agrément professionnel sont en cours de validation par l’administration LocaTrust.'
                      : 'Pour publier des annonces professionnelles et gérer des mandats de gestion, veuillez certifier votre agence avec votre RCCM.'}
                  </p>
                </div>
              </div>
              {profile?.verification_status !== 'en_attente' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  <span>Certifier l'agence (KYC)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* TAB 1: Dashboard Overview (Identique au Propriétaire pour fonctionnement 100% unifié) */}
          {activeTab === 'overview' && !selectedContractId && (
            <ProprietaireDashboardView
              userRole="agence"
              userName={currentUser?.full_name || profile?.full_name || 'Mon Agence'}
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

          {/* SOUS-VUES CHARGÉES DYNAMIQUEMENT EN LAZY LOADING (SUSPENSE) POUR RAPIDITÉ MOBILE */}
          <Suspense fallback={<DashboardPageSkeleton />}>
            {/* TAB 2: Multi-Bailleurs Mandants */}
            {activeTab === 'owners' && (
              <ErrorBoundary>
                <MultiProprietairesView />
              </ErrorBoundary>
            )}

            {/* TAB 3: Équipe Agence */}
            {activeTab === 'team' && (
              <ErrorBoundary>
                <AgenceEquipeView />
              </ErrorBoundary>
            )}

            {/* TAB 4: Properties (Reused BiensView) */}
            {activeTab === 'properties' && (
              <ErrorBoundary>
                <BiensView
                  onOpenAddProperty={() => setIsAddPropertyOpen(true)}
                />
              </ErrorBoundary>
            )}

            {/* TAB 5: Contracts (Reused Contract views) */}
            {activeTab === 'contracts' && (
              <ErrorBoundary>
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
              </ErrorBoundary>
            )}

            {/* TAB 6: Demandes de location (Strict candidature) */}
            {(activeTab === 'applications' || activeTab === 'requests' || activeTab === 'demandes') && (
              <ErrorBoundary>
                <DemandesView
                  onOpenMessages={(contactId?: string) => {
                    if (contactId && typeof window !== 'undefined') {
                      localStorage.setItem('locatrust_active_chat_contact', contactId);
                      window.dispatchEvent(new CustomEvent('locatrust:open_chat', { detail: { contactId } }));
                    }
                    setActiveTab('messages');
                  }}
                />
              </ErrorBoundary>
            )}

            {/* TAB 7: Demandes de Visite */}
            {activeTab === 'visits' && (
              <ErrorBoundary>
                <VisitesView
                  onOpenMessages={(contactId?: string) => {
                    if (contactId && typeof window !== 'undefined') {
                      localStorage.setItem('locatrust_active_chat_contact', contactId);
                      window.dispatchEvent(new CustomEvent('locatrust:open_chat', { detail: { contactId } }));
                    }
                    setActiveTab('messages');
                  }}
                />
              </ErrorBoundary>
            )}

            {/* TAB 8: Guarantees (Reused CautionsView with isAgency) */}
            {activeTab === 'guarantees' && (
              <ErrorBoundary>
                <CautionsView isAgency={true} userRole="agence" />
              </ErrorBoundary>
            )}

            {/* TAB 9: Payments (Reused PaiementsView) */}
            {activeTab === 'payments' && (
              <ErrorBoundary>
                <PaiementsView
                  onOpenConfirmPaymentModal={() => setIsConfirmPaymentOpen(true)}
                />
              </ErrorBoundary>
            )}

            {/* TAB 10: Tenants (Locataires du parc) */}
            {activeTab === 'tenants' && (
              <ErrorBoundary>
                <TenantsListView />
              </ErrorBoundary>
            )}

            {/* TAB 11: Documents */}
            {activeTab === 'documents' && (
              <ErrorBoundary>
                <DocumentsView />
              </ErrorBoundary>
            )}

            {/* TAB 12: Receipts & Quittances */}
            {activeTab === 'receipts' && (
              <ErrorBoundary>
                <ReceiptsQuittancesView />
              </ErrorBoundary>
            )}

            {/* TAB 13: History (Historique général) */}
            {activeTab === 'history' && (
              <ErrorBoundary>
                <HistoriqueView />
              </ErrorBoundary>
            )}

            {/* TAB 14: Maintenance (Reused MaintenanceView) */}
            {activeTab === 'maintenance' && (
              <ErrorBoundary>
                <MaintenanceView />
              </ErrorBoundary>
            )}

            {/* TAB 15: Payout Accounts */}
            {activeTab === 'bank_accounts' && (
              <ErrorBoundary>
                <PaymentAccountsView />
              </ErrorBoundary>
            )}

            {/* TAB 16: Reports & Statistics (Point 4) */}
            {activeTab === 'stats' && (
              <ErrorBoundary>
                <ReportsStatsView />
              </ErrorBoundary>
            )}

            {/* TAB 17: Accounting Exports (Point 4) */}
            {activeTab === 'exports' && (
              <ErrorBoundary>
                <AccountingExportView />
              </ErrorBoundary>
            )}

            {/* TAB 18: Subscription (Reused AbonnementView) */}
            {activeTab === 'subscription' && (
              <ErrorBoundary>
                <AbonnementView />
              </ErrorBoundary>
            )}

            {/* TAB 19: Settings (Point 4) */}
            {activeTab === 'settings' && (
              <ErrorBoundary>
                <SettingsView
                  userRole="agence"
                  currentUser={currentUser}
                  onNavigateToPaymentAccounts={() => setActiveTab('bank_accounts')}
                  onNavigateToSubscription={() => setActiveTab('subscription')}
                />
              </ErrorBoundary>
            )}

            {/* TAB 20: Messages (Reused MessagerieView) */}
            {activeTab === 'messages' && (
              <ErrorBoundary>
                <MessagerieView userRole="agence" />
              </ErrorBoundary>
            )}

            {/* TAB 21: Aide & Support Agence */}
            {activeTab === 'support' && (
              <ErrorBoundary>
                <LocataireSupportView userRole="agence" />
              </ErrorBoundary>
            )}
          </Suspense>

          {/* Fallback for other tabs */}
          {!['overview', 'owners', 'team', 'properties', 'contracts', 'guarantees', 'payments', 'tenants', 'receipts', 'documents', 'maintenance', 'subscription', 'messages', 'applications', 'requests', 'visits', 'demandes', 'stats', 'exports', 'settings', 'history', 'bank_accounts', 'support'].includes(activeTab) && (
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
