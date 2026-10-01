'use client';

import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';

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

const INITIAL_TENANTS: TenantProfile[] = [
  // 1. Actif
  {
    id: 'usr_t_1',
    fullName: "Koffi N'Guessan",
    email: 'koffi.nguessan@locatrust.ci',
    phone: '+225 07 08 09 10 11',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    verificationStatus: 'verifie',
    propertyTitle: 'Appartement 3 pièces moderne',
    propertyAddress: 'Cocody Riviera 3, Abidjan',
    contractNumber: 'LT-2026-CI-000492',
    contractStartDate: '01/01/2026',
    contractEndDate: '31/12/2026',
    rentAmount: 450000,
    cautionRequested: 900000,
    cautionPaid: 900000,
    cautionReceiptNumber: 'CAU-2026-CI-00109',
    cautionStatus: 'totalement_payee',
    isActive: true,
    receipts: [
      {
        id: 'r_1',
        receiptNumber: 'REC-2026-000981',
        targetMonth: 'Septembre 2026',
        amount: 450000,
        paymentMethod: 'Orange Money (+225 07 48 92 11 00)',
        reference: 'OM-225-88492019',
        issuedDate: '02/09/2026',
        status: 'valide'
      },
      {
        id: 'r_2',
        receiptNumber: 'REC-2026-000980',
        targetMonth: 'Août 2026',
        amount: 450000,
        paymentMethod: 'Wave (+225 07 08 09 10 11)',
        reference: 'WAVE-CI-77382109',
        issuedDate: '03/08/2026',
        status: 'valide'
      },
      {
        id: 'r_3',
        receiptNumber: 'REC-2026-000979',
        targetMonth: 'Juillet 2026',
        amount: 450000,
        paymentMethod: 'MTN MoMo',
        reference: 'MTN-CI-6612091',
        issuedDate: '02/07/2026',
        status: 'valide'
      }
    ]
  },
  // 2. Actif
  {
    id: 'usr_t_2',
    fullName: 'Amina Diabaté',
    email: 'amina.diabate@gmail.com',
    phone: '+225 05 55 66 77 88',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    verificationStatus: 'verifie',
    propertyTitle: 'Villa 4 pièces Riviera M\'Badon',
    propertyAddress: 'Riviera M\'Badon, Cité Étoile',
    contractNumber: 'LT-2026-CI-000781',
    contractStartDate: '01/05/2026',
    contractEndDate: '30/04/2027',
    rentAmount: 650000,
    cautionRequested: 1300000,
    cautionPaid: 650000,
    cautionReceiptNumber: 'CAU-2026-CI-00441',
    cautionStatus: 'partiellement_payee',
    isActive: true,
    receipts: [
      {
        id: 'r_4',
        receiptNumber: 'REC-2026-000982',
        targetMonth: 'Septembre 2026',
        amount: 650000,
        paymentMethod: 'Wave CI',
        reference: 'WAVE-CI-99881122',
        issuedDate: '01/09/2026',
        status: 'valide'
      },
      {
        id: 'r_5',
        receiptNumber: 'REC-2026-000983',
        targetMonth: 'Août 2026',
        amount: 650000,
        paymentMethod: 'Orange Money',
        reference: 'OM-CI-33441199',
        issuedDate: '04/08/2026',
        status: 'valide'
      }
    ]
  },
  // 3. Actif
  {
    id: 'usr_t_3',
    fullName: 'Marc-Aurèle Koné',
    email: 'marc.kone@gmail.com',
    phone: '+225 01 02 03 04 05',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    verificationStatus: 'verifie',
    propertyTitle: 'Studio Meublé Cocody Danga',
    propertyAddress: 'Cocody Danga, Rue des Jardins',
    contractNumber: 'LT-2026-CI-000620',
    contractStartDate: '01/06/2026',
    contractEndDate: '31/05/2027',
    rentAmount: 200000,
    cautionRequested: 400000,
    cautionPaid: 400000,
    cautionReceiptNumber: 'CAU-2026-CI-00512',
    cautionStatus: 'totalement_payee',
    isActive: true,
    receipts: [
      {
        id: 'r_6',
        receiptNumber: 'REC-2026-000985',
        targetMonth: 'Août 2026',
        amount: 200000,
        paymentMethod: 'Wave CI',
        reference: 'WAVE-CI-55443322',
        issuedDate: '01/08/2026',
        status: 'valide'
      }
    ]
  },
  // 4. Actif
  {
    id: 'usr_t_4',
    fullName: 'Bamba Ali',
    email: 'bamba.ali@yahoo.fr',
    phone: '+225 07 11 22 33 44',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    verificationStatus: 'verifie',
    propertyTitle: 'Appartement 2P Marcory',
    propertyAddress: 'Marcory Résidentiel',
    contractNumber: 'LT-2026-CI-000556',
    contractStartDate: '20/05/2026',
    contractEndDate: '19/05/2027',
    rentAmount: 180000,
    cautionRequested: 360000,
    cautionPaid: 360000,
    cautionReceiptNumber: 'CAU-2026-CI-00332',
    cautionStatus: 'totalement_payee',
    isActive: true,
    receipts: [
      {
        id: 'r_7',
        receiptNumber: 'REC-2026-000950',
        targetMonth: 'Août 2026',
        amount: 180000,
        paymentMethod: 'Wave CI',
        reference: 'WAVE-CI-11223344',
        issuedDate: '02/08/2026',
        status: 'valide'
      }
    ]
  },
  // 5. ANCIEN LOCATAIRE (HISTORIQUE)
  {
    id: 'usr_t_5',
    fullName: 'Bakayoko Souleymane',
    email: 'souley.bakayoko@gmail.com',
    phone: '+225 07 99 88 77 66',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80',
    verificationStatus: 'verifie',
    propertyTitle: 'Appartement 3 pièces Cocody Riviera 2',
    propertyAddress: 'Riviera 2, Immeuble Les Palmes',
    contractNumber: 'LT-2025-CI-000188',
    contractStartDate: '01/01/2025',
    contractEndDate: '31/12/2025',
    rentAmount: 400000,
    cautionRequested: 800000,
    cautionPaid: 800000,
    cautionReceiptNumber: 'CAU-2025-CI-00090',
    cautionStatus: 'restituee',
    isActive: false,
    endedReason: 'Fin de bail échue (non renouvelé par le locataire)',
    restitutionDate: '05/01/2026',
    receipts: [
      {
        id: 'r_8',
        receiptNumber: 'REC-2025-000850',
        targetMonth: 'Décembre 2025',
        amount: 400000,
        paymentMethod: 'Orange Money',
        reference: 'OM-CI-88990011',
        issuedDate: '02/12/2025',
        status: 'valide'
      }
    ]
  },
  // 6. ANCIEN LOCATAIRE (HISTORIQUE)
  {
    id: 'usr_t_6',
    fullName: 'Yao Marie-Ange',
    email: 'marie.yao@hotmail.com',
    phone: '+225 05 12 34 56 78',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80',
    verificationStatus: 'verifie',
    propertyTitle: 'Studio Résidentiel Marcory',
    propertyAddress: 'Marcory Zone 4',
    contractNumber: 'LT-2024-CI-000095',
    contractStartDate: '01/06/2024',
    contractEndDate: '31/05/2025',
    rentAmount: 150000,
    cautionRequested: 300000,
    cautionPaid: 300000,
    cautionReceiptNumber: 'CAU-2024-CI-00045',
    cautionStatus: 'restituee',
    isActive: false,
    endedReason: 'Départ volontaire pour mutation professionnelle',
    restitutionDate: '02/06/2025',
    receipts: [
      {
        id: 'r_9',
        receiptNumber: 'REC-2025-000300',
        targetMonth: 'Mai 2025',
        amount: 150000,
        paymentMethod: 'Wave CI',
        reference: 'WAVE-CI-99001122',
        issuedDate: '01/05/2025',
        status: 'valide'
      }
    ]
  }
];

export const TenantsListView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'actifs' | 'historique'>('actifs');
  const [tenants, setTenants] = useState<TenantProfile[]>(INITIAL_TENANTS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTenantForReceipts, setSelectedTenantForReceipts] = useState<TenantProfile | null>(null);

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
    await generateOfficialReceiptPDF({
      receiptNumber: rcp.receiptNumber,
      contractNumber: t.contractNumber,
      contractToken: 'tok_cnt_ci2026_000123',
      propertyTitle: t.propertyTitle,
      propertyAddress: t.propertyAddress,
      propertyReference: 'BIEN-000456',
      propertyType: t.propertyTitle,
      durationMonths: 12,
      leaseStartDate: t.contractStartDate,
      leaseEndDate: t.contractEndDate,
      ownerName: "Koffi N'Guessan",
      ownerCni: 'CI987654321',
      ownerPhone: '05 05 43 21 00',
      tenantName: t.fullName,
      tenantCni: 'CI123456789',
      tenantPhone: t.phone,
      amount: rcp.amount,
      periodCovered: rcp.targetMonth,
      paymentDate: rcp.issuedDate,
      paymentMethod: rcp.paymentMethod,
      transactionReference: rcp.reference
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Gestion des Locataires
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-300 text-xs font-black">
              Espace Propriétaire
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consultez la liste verticale de vos locataires actuels et l'historique complet des anciens locataires dont le bail est arrivé à terme.
          </p>
        </div>

        {/* 2 Main Navigation Tabs: Locataires Actifs vs Anciens Locataires */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('actifs')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
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
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'historique'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique Anciens Locataires ({historyCount})</span>
          </button>
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
        {filteredTenants.map((t) => (
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
              <div className="relative shrink-0">
                <img
                  src={t.avatarUrl}
                  alt={t.fullName}
                  className="w-11 h-11 rounded-full object-cover border-2 border-amber-500 shadow-sm"
                />
                {t.isActive ? (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                ) : (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-900 rounded-full" />
                )}
              </div>

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
        ))}

        {filteredTenants.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 text-xs">
            Aucun locataire trouvé dans cette catégorie.
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
    </div>
  );
};
