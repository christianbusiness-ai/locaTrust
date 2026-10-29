'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import {
  Users,
  Search,
  Receipt,
  Download,
  Send,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  History,
  Archive,
  ArrowRight,
  Eye,
  X,
  Sparkles,
  Check,
  UserPlus
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { TenantCardSkeleton } from '@/components/common/SkeletonLoader';
import { resolveRealReceiptData } from '@/lib/payments/receiptDataResolver';

import { UserAvatar } from '@/components/common/UserAvatar';
import { AddExistingTenantModal, ExistingRentalData } from './AddExistingTenantModal';
import { LegalContractGeneratorModal } from '@/components/contracts/LegalContractGeneratorModal';

export interface TenantReceiptItem {
  id: string;
  receiptNumber: string;
  targetMonth: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  issuedDate: string;
  status: 'valide' | 'envoye';
}

export interface TenantProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  verificationStatus: 'verifie' | 'en_attente';
  propertyTitle: string;
  propertyAddress: string;
  contractNumber: string;
  contractStartDate: string;
  contractEndDate: string;
  rentAmount: number;
  cautionRequested: number;
  cautionPaid: number;
  cautionReceiptNumber: string;
  cautionStatus: 'totalement_payee' | 'partiellement_payee' | 'restituee';
  isActive: boolean;
  endedReason?: string;
  restitutionDate?: string;
  receipts: TenantReceiptItem[];
}

export const TenantsListView: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'actifs' | 'historique'>('actifs');
  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTenantForReceipts, setSelectedTenantForReceipts] = useState<TenantProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modale Ajouter un locataire existant (Sections 1 à 25)
  const [isAddExistingTenantOpen, setIsAddExistingTenantOpen] = useState<boolean>(false);

  // Workflow officiel de création de contrat (Section 10 & 11)
  const [isContractGeneratorOpen, setIsContractGeneratorOpen] = useState<boolean>(false);
  const [contractGeneratorInitialData, setContractGeneratorInitialData] = useState<any>(null);

  const handleContinueToContract = (rentalData: ExistingRentalData) => {
    const prefill = {
      tenantId: rentalData.tenant.id,
      tenantName: rentalData.tenant.fullName,
      tenantEmail: rentalData.tenant.email,
      tenantPhone: rentalData.tenant.phone,
      tenantCni: rentalData.tenant.cniNumber,
      propertyId: rentalData.propertyId,
      propertyTitle: rentalData.propertyTitle,
      propertyAddress: rentalData.propertyAddress,
      propertyCity: rentalData.propertyCity,
      propertyCommune: rentalData.propertyCommune,
      propertyType: rentalData.propertyType,
      propertyRooms: rentalData.propertyRooms,
      propertyBedrooms: rentalData.propertyBedrooms,
      propertyBathrooms: rentalData.propertyBathrooms,
      propertySurface: rentalData.propertySurface,
      rentAmount: rentalData.monthlyRent,
      cautionAmount: rentalData.cautionAmount,
      chargesAmount: rentalData.chargesAmount,
      startDate: rentalData.entryDate,
      durationMonths: rentalData.durationMonths,
      dueDay: rentalData.dueDay,
      paymentFrequency: rentalData.paymentFrequency,
      leaseType: rentalData.leaseType,
      usageDestination: rentalData.leaseType,
      startAtStep: 'form' as const
    };

    setContractGeneratorInitialData(prefill);
    setIsContractGeneratorOpen(true);
  };

  const loadTenantsFromDb = async () => {
    if (!user?.id) {
      setTenants([]);
      setIsLoading(false);
      return;
    }

      setIsLoading(true);
      try {
        // Récupération des profils pour disposer des vrais avatars à jour
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url');
        const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

        const { data: contractsData, error } = await supabase
          .from('contracts')
          .select('*, property:properties(*)')
          .or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
        
        if (!error && contractsData && contractsData.length > 0) {
          // Ne conserver que les contrats signés par le locataire ou arrivés à terme
          const eligibleContracts = contractsData.filter(
            (c: any) => c && (Boolean(c.tenant_signed) || c.status === 'resilie' || c.status === 'termine')
          );

          const dbTenants: TenantProfile[] = eligibleContracts.map((c: any, idx: number) => {
            const matchedProfile = profilesMap.get(c.tenant_id);
            return {
              id: c.tenant_id || c.id || `t_${idx}`,
              fullName: matchedProfile?.full_name || c.tenant?.full_name || 'Locataire',
              email: matchedProfile?.email || c.tenant?.email || '',
              phone: matchedProfile?.phone || c.tenant?.phone || '',
              avatarUrl: matchedProfile?.avatar_url || c.tenant?.avatar_url || '',
              verificationStatus: 'verifie' as const,
              propertyTitle: c.property?.title || 'Bien immobilier',
              propertyAddress: `${c.property?.commune || ''} ${c.property?.city || 'Abidjan'}`.trim() || 'Côte d\'Ivoire',
              contractNumber: c.contract_number || `LT-2026-${idx}`,
              contractStartDate: c.start_date || (c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '01/01/2026'),
              contractEndDate: '31/12/2026',
              rentAmount: Number(c.monthly_rent) || Number(c.rent_amount) || Number(c.rent) || Number(c.property?.rent) || 0,
              cautionRequested: Number(c.caution_amount) || Number(c.caution) || Number(c.property?.caution) || 0,
              cautionPaid: Number(c.caution_paid) || Number(c.caution_amount) || Number(c.caution) || 0,
              cautionReceiptNumber: `CAU-2026-${idx}`,
              cautionStatus: 'totalement_payee',
              isActive: (c.status === 'actif' || c.status === 'contrat_actif') && Boolean(c.tenant_signed),
              receipts: []
            };
          });
          setTenants(dbTenants);
          localStorage.setItem('locatrust_tenants', JSON.stringify(dbTenants));
        } else {
          setTenants([]);
        }
      } catch (err) {
        console.warn('Erreur chargement locataires depuis Supabase:', err);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    loadTenantsFromDb();

    const handleUpdate = () => {
      loadTenantsFromDb();
    };

    window.addEventListener('locatrust:contracts-updated', handleUpdate);
    window.addEventListener('locatrust:applications-updated', handleUpdate);
    window.addEventListener('locatrust:avatar_updated', handleUpdate);
    window.addEventListener('locatrust:profile_updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
      window.removeEventListener('locatrust:applications-updated', handleUpdate);
      window.removeEventListener('locatrust:avatar_updated', handleUpdate);
      window.removeEventListener('locatrust:profile_updated', handleUpdate);
    };
  }, [user?.id]);

  // Filter tenants based on active tab and search query
  const filteredTenants = tenants.filter((t) => {
    const matchesTab = activeTab === 'actifs' ? t.isActive : !t.isActive;
    const matchesSearch =
      t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone.includes(searchQuery) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.contractNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const activeCount = tenants.filter((t) => t.isActive).length;
  const historyCount = tenants.filter((t) => !t.isActive).length;

  // Move active tenant to history (Contract termination / non-renewal)
  const handleMoveToHistory = (tenantId: string) => {
    if (
      confirm(
        'Confirmez-vous que le contrat de ce locataire a pris fin sans renouvellement ? Il sera immédiatement déplacé dans l\'onglet Historique.'
      )
    ) {
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? {
                ...t,
                isActive: false,
                endedReason: 'Fin de contrat enregistrée (Non renouvelé)',
                restitutionDate: new Date().toLocaleDateString('fr-FR')
              }
            : t
        )
      );
      alert('Le locataire a bien été transféré dans l\'historique des anciens locataires.');
    }
  };

  // Download official PDF receipt
  const handleDownloadReceipt = async (rcp: TenantReceiptItem, t: TenantProfile) => {
    const resolved = resolveRealReceiptData(
      {
        reference: rcp.receiptNumber,
        contract_id: t.contractNumber,
        tenant_id: t.id,
        tenant: {
          full_name: t.fullName,
          phone: t.phone
        }
      },
      user
    );

    await generateOfficialReceiptPDF({
      receiptNumber: rcp.receiptNumber,
      contractNumber: resolved.contractNumber,
      contractToken: `tok_cnt_${resolved.contractNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      propertyTitle: t.propertyTitle || resolved.propertyTitle,
      propertyAddress: t.propertyAddress || resolved.propertyAddress,
      propertyReference: resolved.propertyReference,
      propertyType: resolved.propertyType,
      durationMonths: resolved.durationMonths,
      leaseStartDate: t.contractStartDate || resolved.leaseStartDate,
      leaseEndDate: t.contractEndDate || resolved.leaseEndDate,
      ownerName: resolved.ownerName,
      ownerCni: resolved.ownerCni,
      ownerPhone: resolved.ownerPhone,
      tenantName: t.fullName || resolved.tenantName,
      tenantCni: resolved.tenantCni,
      tenantPhone: t.phone || resolved.tenantPhone,
      amount: rcp.amount,
      periodCovered: rcp.targetMonth,
      paymentDate: rcp.issuedDate,
      paymentMethod: rcp.paymentMethod,
      transactionReference: rcp.reference,
      ownerSignatureUrl: resolved.ownerSignatureUrl,
      tenantSignatureUrl: resolved.tenantSignatureUrl
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Gestion des Locataires
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-300 text-xs font-black">
              {profile?.account_type === 'agence' ? 'Espace Agence' : 'Espace Propriétaire'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consultez la liste de vos locataires actuels, gérez l'historique et importez vos baux existants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Action Button: + Ajouter un locataire existant */}
          <button
            type="button"
            onClick={() => setIsAddExistingTenantOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-600/25 shrink-0"
            title="Importer un locataire qui occupe déjà un de vos logements"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Ajouter un locataire existant</span>
          </button>

          {/* 2 Main Navigation Tabs: Locataires Actifs vs Anciens Locataires */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('actifs')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'actifs'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Locataires Actifs ({activeCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('historique')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'historique'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historique ({historyCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'actifs'
                ? 'Rechercher un locataire actif, téléphone, bien...'
                : 'Rechercher dans l\'historique des anciens locataires...'
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
      </div>

      {/* FULL VERTICAL LIST: SLEEK, ULTRA-COMPACT SINGLE-LINE CARDS */}
      <div className="flex flex-col gap-2.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <TenantCardSkeleton key={i} />
          ))
        ) : filteredTenants.length > 0 ? (
          filteredTenants.map((t) => (
            <div
              key={t.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                t.isActive
                  ? 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 opacity-95'
              }`}
            >
              {/* Left: Tenant identity, Avatar, Phone */}
              <div className="flex items-center gap-3.5 min-w-[260px] max-w-xs shrink-0">
                <UserAvatar
                  src={t.avatarUrl}
                  name={t.fullName}
                  isOnline={t.isActive}
                  sizeClassName="w-11 h-11"
                  borderClassName={t.isActive ? "border-2 border-emerald-500" : "border-2 border-slate-400"}
                />

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {t.fullName}
                    </h3>
                    {t.isActive ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] whitespace-nowrap">
                        Actif
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold text-[10px] whitespace-nowrap">
                        Historique
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{t.phone}</span>
                  </div>
                </div>
              </div>

              {/* Middle 1: Bien Immobilier (Single line column) */}
              <div className="flex items-center gap-2.5 min-w-[220px] flex-1">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Bien Immobilier
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {t.propertyTitle}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {t.propertyAddress}
                  </span>
                </div>
              </div>

              {/* Middle 2: Loyer Mensuel (Single line column) */}
              <div className="flex items-center gap-2.5 min-w-[170px] shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Loyer Mensuel
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {formatFCFA(t.rentAmount)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    / mois (charges comprises)
                  </span>
                </div>
              </div>

              {/* Right: Actions (Voir quittances & Fin de bail) */}
              <div className="flex items-center gap-2 shrink-0 self-end xl:self-center flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedTenantForReceipts(t)}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-all"
                  title="Consulter les quittances"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Quittances ({t.receipts.length})</span>
                </button>

                {t.isActive ? (
                  <button
                    type="button"
                    onClick={() => handleMoveToHistory(t.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200 dark:border-slate-700"
                    title="Marquer le bail comme terminé sans renouvellement pour basculer dans l'historique"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fin de bail</span>
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                    <Archive className="w-3 h-3 text-slate-400" />
                    Bail clos {t.restitutionDate ? `(${t.restitutionDate})` : ''}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-800 dark:text-white">
              {activeTab === 'actifs' ? 'Aucun locataire actif pour le moment' : 'Aucun ancien locataire dans l\'historique'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {activeTab === 'actifs'
                ? 'Dès qu\'un bail est finalisé avec un candidat retenu, son dossier complet, son contrat et ses quittances apparaîtront ici.'
                : 'Les locataires dont le bail a pris fin ou a été résilié apparaîtront ici avec l\'historique de leurs quittances.'}
            </p>
          </div>
        )}
      </div>

      {/* MODAL: VIEW ALL RECEIPTS FOR SELECTED TENANT */}
      {selectedTenantForReceipts && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 text-xs animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Reçus & Quittances : {selectedTenantForReceipts.fullName}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Contrat N° {selectedTenantForReceipts.contractNumber} &bull; {selectedTenantForReceipts.propertyTitle}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTenantForReceipts(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Receipts */}
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedTenantForReceipts.receipts.map((rcp) => (
                <div
                  key={rcp.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                      REC
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-white text-xs">
                          {rcp.receiptNumber}
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {rcp.targetMonth}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Montant : <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatFCFA(rcp.amount)}</strong> &bull; {rcp.paymentMethod}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Réf: {rcp.reference} ({rcp.issuedDate})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(rcp, selectedTenantForReceipts)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTenantForReceipts(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'ajout d'un locataire existant */}
      <AddExistingTenantModal
        isOpen={isAddExistingTenantOpen}
        onClose={() => setIsAddExistingTenantOpen(false)}
        onContinueToContract={handleContinueToContract}
        isAgency={profile?.account_type === 'agence'}
      />

      {/* Workflow officiel de création de bail prérempli (Processus 41 points identique) */}
      <LegalContractGeneratorModal
        isOpen={isContractGeneratorOpen}
        onClose={() => {
          setIsContractGeneratorOpen(false);
          setContractGeneratorInitialData(null);
        }}
        initialData={contractGeneratorInitialData}
        isAgency={profile?.account_type === 'agence'}
        onContractFinalized={() => {
          setIsContractGeneratorOpen(false);
          setContractGeneratorInitialData(null);
          loadTenantsFromDb();
        }}
      />
    </div>
  );
};
