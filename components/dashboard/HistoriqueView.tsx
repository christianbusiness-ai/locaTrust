'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  FileText,
  ShieldCheck,
  CreditCard,
  Receipt,
  Clock,
  CheckCircle2,
  Check,
  AlertCircle,
  Calendar,
  Building2,
  ChevronRight,
  Download,
  Send,
  Eye,
  X,
  QrCode,
  Sparkles,
  Phone,
  Mail
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { MOCK_USERS, MOCK_CONTRACTS, MOCK_RENT_PAYMENTS, MOCK_RECEIPTS } from '@/lib/mock/data';
import { ContractDetailView } from '@/components/contracts/ContractDetailView';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import { PenTool } from 'lucide-react';

interface TenantReceiptItem {
  id: string;
  receipt_number: string;
  target_month: string;
  amount: number;
  payment_method: string;
  reference: string;
  issued_date: string;
  status: 'valide' | 'envoye';
}

interface ComprehensiveTenant {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  verification_status: 'verifie' | 'en_attente';
  property_title: string;
  property_address: string;
  contract_number: string;
  contract_period: string;
  rent_amount: number;
  caution_requested: number;
  caution_paid: number;
  caution_receipt_number: string;
  caution_status: 'totalement_payee' | 'partiellement_payee' | 'restituee' | 'non_payee';
  is_active?: boolean;
  ended_reason?: string;
  restitution_date?: string;
  receipts: TenantReceiptItem[];
}

const ALL_TENANTS_HISTORY: ComprehensiveTenant[] = [
  // 1. M. Kouamé Patrice (Ancien locataire avec bail échu, caution restituée et historique complet des reçus)
  {
    id: 'usr_tenant_kouame',
    full_name: 'Kouamé Patrice',
    email: 'patrice.kouame@gmail.com',
    phone: '+225 07 12 34 56 78',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
    verification_status: 'verifie',
    property_title: 'Appartement 3 pièces Cocody Riviera',
    property_address: 'Cocody Riviera 2, Immeuble Les Palmes',
    contract_number: 'LT-2025-CI-000188',
    contract_period: '01/01/2025 au 31/12/2025',
    rent_amount: 400000,
    caution_requested: 800000,
    caution_paid: 800000,
    caution_receipt_number: 'DEP-2025-CI-00090',
    caution_status: 'restituee',
    is_active: false,
    ended_reason: 'Fin de contrat échue (non renouvelé)',
    restitution_date: '05/01/2026',
    receipts: [
      {
        id: 'rcp_k12',
        receipt_number: 'REC-2025-001201',
        target_month: 'Décembre 2025',
        amount: 400000,
        payment_method: 'Orange Money (+225 07 12 34 56 78)',
        reference: 'OM-CI-99881122',
        issued_date: '2025-12-03',
        status: 'valide'
      },
      {
        id: 'rcp_k11',
        receipt_number: 'REC-2025-001102',
        target_month: 'Novembre 2025',
        amount: 400000,
        payment_method: 'Wave CI',
        reference: 'WAVE-CI-88771122',
        issued_date: '2025-11-02',
        status: 'valide'
      },
      {
        id: 'rcp_k10',
        receipt_number: 'REC-2025-001003',
        target_month: 'Octobre 2025',
        amount: 400000,
        payment_method: 'Wave CI',
        reference: 'WAVE-CI-77665544',
        issued_date: '2025-10-01',
        status: 'valide'
      },
      {
        id: 'rcp_k09',
        receipt_number: 'REC-2025-000904',
        target_month: 'Septembre 2025',
        amount: 400000,
        payment_method: 'Orange Money',
        reference: 'OM-CI-66554433',
        issued_date: '2025-09-02',
        status: 'valide'
      }
    ]
  },
  {
    id: 'usr_tenant_1',
    full_name: "Koffi N'Guessan",
    email: 'koffi.nguessan@locatrust.ci',
    phone: '+225 07 08 09 10 11',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    verification_status: 'verifie',
    property_title: 'Appartement 3 pièces moderne',
    property_address: 'Cocody Riviera 3, Abidjan',
    contract_number: 'LT-2026-CI-000492',
    contract_period: '01/01/2026 au 31/12/2026',
    rent_amount: 450000,
    caution_requested: 900000,
    caution_paid: 900000,
    caution_receipt_number: 'DEP-2026-CI-00109',
    caution_status: 'totalement_payee',
    is_active: true,
    receipts: [
      {
        id: 'rcp_101',
        receipt_number: 'REC-2026-000981',
        target_month: 'Septembre 2026',
        amount: 450000,
        payment_method: 'Orange Money',
        reference: 'OM-225-88492019',
        issued_date: '2026-09-02',
        status: 'valide'
      },
      {
        id: 'rcp_102',
        receipt_number: 'REC-2026-000980',
        target_month: 'Août 2026',
        amount: 450000,
        payment_method: 'Wave CI',
        reference: 'WAVE-CI-77382109',
        issued_date: '2026-08-03',
        status: 'envoye'
      },
      {
        id: 'rcp_103',
        receipt_number: 'REC-2026-000979',
        target_month: 'Juillet 2026',
        amount: 450000,
        payment_method: 'MTN MoMo',
        reference: 'MTN-CI-6612091',
        issued_date: '2026-07-02',
        status: 'envoye'
      }
    ]
  },
  {
    id: 'usr_tenant_2',
    full_name: 'Amina Diabaté',
    email: 'amina.diabate@gmail.com',
    phone: '+225 05 55 66 77 88',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    verification_status: 'verifie',
    property_title: 'Villa 4 pièces Riviera M\'Badon',
    property_address: 'Riviera M\'Badon, Cocody',
    contract_number: 'LT-2026-CI-000781',
    contract_period: '01/05/2026 au 30/04/2027',
    rent_amount: 650000,
    caution_requested: 1300000,
    caution_paid: 650000,
    caution_receipt_number: 'DEP-2026-CI-00441',
    caution_status: 'partiellement_payee',
    receipts: [
      {
        id: 'rcp_201',
        receipt_number: 'REC-2026-000982',
        target_month: 'Septembre 2026',
        amount: 650000,
        payment_method: 'Wave CI',
        reference: 'WAVE-CI-99881122',
        issued_date: '2026-09-01',
        status: 'valide'
      },
      {
        id: 'rcp_202',
        receipt_number: 'REC-2026-000983',
        target_month: 'Août 2026',
        amount: 650000,
        payment_method: 'Orange Money',
        reference: 'OM-CI-33441199',
        issued_date: '2026-08-04',
        status: 'envoye'
      }
    ]
  },
  {
    id: 'usr_tenant_3',
    full_name: 'Bamba Moussa',
    email: 'bamba.moussa@yahoo.fr',
    phone: '+225 01 22 33 44 55',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    verification_status: 'verifie',
    property_title: 'Appartement 2 pièces Yopougon',
    property_address: 'Andokoi, Yopougon',
    contract_number: 'LT-2026-CI-000556',
    contract_period: '20/05/2026 au 19/05/2027',
    rent_amount: 180000,
    caution_requested: 360000,
    caution_paid: 360000,
    caution_receipt_number: 'DEP-2026-CI-00332',
    caution_status: 'totalement_payee',
    receipts: [
      {
        id: 'rcp_301',
        receipt_number: 'REC-2026-000950',
        target_month: 'Août 2026',
        amount: 180000,
        payment_method: 'Wave CI',
        reference: 'WAVE-CI-11223344',
        issued_date: '2026-08-02',
        status: 'envoye'
      }
    ]
  }
];

export const HistoriqueView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'locataires' | 'contrats'>('locataires');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selected Tenant for Receipt Modal
  const [selectedTenant, setSelectedTenant] = useState<ComprehensiveTenant | null>(null);

  // Selected Receipt for visual modal with QR Code
  const [previewReceipt, setPreviewReceipt] = useState<{ receipt: TenantReceiptItem; tenant: ComprehensiveTenant } | null>(null);

  // Selected Contract Number for Contract Detail View
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const filteredTenants = ALL_TENANTS_HISTORY.filter(
    (t) =>
      t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone.includes(searchQuery) ||
      t.contract_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContracts = MOCK_CONTRACTS.filter(
    (c) =>
      c.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.property?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tenant?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleResendReceipt = (receiptNumber: string, tenantName: string) => {
    alert(`Quittance N° ${receiptNumber} renvoyée automatiquement à ${tenantName} par Email, SMS & Application LocaTrust !`);
  };

  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(null);
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(null);
  const [activeSigningParty, setActiveSigningParty] = useState<'proprietaire' | 'locataire' | null>(null);

  const handleDownloadReceiptPDF = async (rcp: TenantReceiptItem, tenant: ComprehensiveTenant) => {
    await generateOfficialReceiptPDF({
      receiptNumber: rcp.receipt_number,
      contractNumber: tenant.contract_number,
      contractToken: 'tok_cnt_ci2026_000123',
      propertyTitle: tenant.property_title,
      propertyAddress: tenant.property_address,
      propertyReference: 'BIEN-000456',
      propertyType: tenant.property_title,
      durationMonths: 12,
      leaseStartDate: '01/01/2026',
      leaseEndDate: '31/12/2026',
      ownerName: "Koffi N'Guessan",
      ownerCni: 'CI987654321',
      ownerPhone: '05 05 43 21 00',
      tenantName: tenant.full_name,
      tenantCni: 'CI123456789',
      tenantPhone: tenant.phone,
      amount: rcp.amount,
      periodCovered: rcp.target_month,
      paymentDate: rcp.issued_date,
      paymentMethod: rcp.payment_method,
      transactionReference: rcp.reference,
      ownerSignatureUrl,
      tenantSignatureUrl,
    });
  };

  if (selectedContractId) {
    return (
      <ContractDetailView
        contractNumber={selectedContractId}
        onBack={() => setSelectedContractId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Historique Complet & Registre Officiel
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-extrabold">
              Mémoire Locative Persistante
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cliquez sur n'importe quel locataire pour ouvrir et consulter tous ses reçus, ou sur un contrat pour en afficher tous les détails légaux.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('locataires')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'locataires'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Historique des Locataires ({ALL_TENANTS_HISTORY.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('contrats')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'contrats'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Historique des Contrats de Bail ({MOCK_CONTRACTS.length})</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'locataires'
                ? 'Rechercher un locataire, téléphone, contrat...'
                : 'Rechercher un contrat de bail, bien...'
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:bg-white focus:border-blue-600"
          />
        </div>
      </div>

      {/* TAB 1: HISTORIQUE GÉNÉRAL PAR PERSONNE */}
      {activeTab === 'locataires' && (
        <div className="flex flex-col gap-3">
          {filteredTenants.map((t) => (
            <div
              key={t.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                t.is_active
                  ? 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
              }`}
            >
              {/* 1. Personne (Avatar, Nom, Téléphone, Badge statut) */}
              <div className="flex items-center gap-3.5 min-w-[250px] shrink-0">
                <div className="relative shrink-0">
                  <img
                    src={t.avatar_url}
                    alt={t.full_name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-amber-500 shadow-sm"
                  />
                  {t.is_active ? (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  ) : (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-900 rounded-full" />
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {t.full_name}
                    </h3>
                    {t.is_active ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] whitespace-nowrap">
                        Bail en cours
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold text-[10px] whitespace-nowrap">
                        Bail terminé
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {t.phone}
                  </span>
                </div>
              </div>

              {/* 2. Contrat de bail (N°, Bien, Bouton Consulter contrat) */}
              <div className="flex items-center gap-2.5 min-w-[260px] flex-1">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {t.property_title}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                      {t.contract_number}
                    </span>
                    <span>&bull; {t.contract_period}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedContractId(t.contract_number)}
                  className="ml-auto px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all shrink-0"
                  title="Consulter le contrat de bail et le télécharger en PDF"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Consulter contrat</span>
                </button>
              </div>

              {/* 3. Caution (Statut restituée / versée & Réf) */}
              <div className="flex items-center gap-2 min-w-[200px] shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Statut Caution
                  </span>
                  {t.caution_status === 'restituee' ? (
                    <span className="text-blue-700 dark:text-blue-400 font-extrabold text-xs flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                      Restituée ({formatFCFA(t.caution_paid)})
                    </span>
                  ) : t.caution_status === 'totalement_payee' ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Versée 100% ({formatFCFA(t.caution_paid)})
                    </span>
                  ) : (
                    <span className="text-amber-800 dark:text-amber-400 font-extrabold text-xs">
                      Partielle ({formatFCFA(t.caution_paid)})
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">
                    Réf: {t.caution_receipt_number}
                  </span>
                </div>
              </div>

              {/* 4. Reçus & Quittances */}
              <div className="shrink-0 self-end xl:self-center">
                <button
                  type="button"
                  onClick={() => setSelectedTenant(t)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title="Consulter tous les reçus payés par ce locataire pendant son bail"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Reçus payés ({t.receipts.length})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: HISTORIQUE DES CONTRATS DE BAIL */}
      {activeTab === 'contrats' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="p-4">N° Contrat & QR Code</th>
                  <th className="p-4">Locataire</th>
                  <th className="p-4">Bien Immobilier</th>
                  <th className="p-4">Loyer Mensuel</th>
                  <th className="p-4">Caution & Reçu</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredContracts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedContractId(c.contract_number)}
                    className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 group-hover:text-blue-600 text-sm">
                            {c.contract_number}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <QrCode className="w-3 h-3 text-emerald-600" /> Certifié LocaTrust
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{c.tenant?.full_name || 'Koffi N\'Guessan'}</span>
                        <span className="text-[11px] text-slate-400">{c.tenant?.phone || '+225 07 08 09 10 11'}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{c.property?.title}</span>
                        <span className="text-[11px] text-slate-400">{c.property?.city}, {c.property?.commune}</span>
                      </div>
                    </td>

                    <td className="p-4 font-black text-slate-900 text-sm">
                      {formatFCFA(c.rent)}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900">{formatFCFA(c.caution)}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold w-fit">
                          Reçu DEP-2026-CI-00109
                        </span>
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <button className="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white font-extrabold text-xs transition-all flex items-center gap-1 mx-auto">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ouvrir Contrat</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: DOSSIER LOCATAIRE AVEC TOUS LES REÇUS DE CE LOCATAIRE */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 flex flex-col gap-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedTenant.avatar_url}
                  alt={selectedTenant.full_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-blue-600 shadow"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{selectedTenant.full_name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Vérifié
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-blue-600" />{selectedTenant.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-blue-600" />{selectedTenant.email}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTenant(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lease & Deposit Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 font-black text-slate-900">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Contrat N° {selectedTenant.contract_number}</span>
                </div>
                <div className="flex flex-col text-slate-600 gap-1">
                  <span><strong>Bien :</strong> {selectedTenant.property_title}</span>
                  <span><strong>Adresse :</strong> {selectedTenant.property_address}</span>
                  <span><strong>Loyer Mensuel :</strong> <strong className="text-blue-600">{formatFCFA(selectedTenant.rent_amount)}</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 font-black text-amber-950">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Dépôt de Caution (N° {selectedTenant.caution_receipt_number})</span>
                </div>
                <div className="flex flex-col text-slate-700 gap-1">
                  <span><strong>Caution Exigée :</strong> {formatFCFA(selectedTenant.caution_requested)}</span>
                  <span><strong>Montant Versé :</strong> <strong className="text-emerald-700">{formatFCFA(selectedTenant.caution_paid)}</strong></span>
                  {selectedTenant.caution_paid < selectedTenant.caution_requested ? (
                    <span className="text-amber-800 font-extrabold text-[11px]">
                      ⚠️ Partiellement payée (Reste : {formatFCFA(selectedTenant.caution_requested - selectedTenant.caution_paid)})
                    </span>
                  ) : (
                    <span className="text-emerald-800 font-extrabold text-[11px]">
                      ✅ Caution totalement versée
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* ALL RECEIPTS SECTION FOR THIS TENANT */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Tous les reçus de paiement de {selectedTenant.full_name} ({selectedTenant.receipts.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-bold">Délivrés & Signés électroniquement</span>
              </div>

              <div className="flex flex-col gap-3">
                {selectedTenant.receipts.map((rcp) => (
                  <div
                    key={rcp.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-emerald-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                        REC
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{rcp.receipt_number}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                            {rcp.target_month}
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 mt-0.5">
                          Montant encaissé : <strong className="text-emerald-700 font-extrabold">{formatFCFA(rcp.amount)}</strong> via {rcp.payment_method}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Ref Txn : {rcp.reference} ({rcp.issued_date})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => setPreviewReceipt({ receipt: rcp, tenant: selectedTenant })}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1.5 transition-all"
                        title="Voir le reçu avec son QR Code"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Aperçu Reçu</span>
                      </button>
                      <button
                        onClick={() => handleResendReceipt(rcp.receipt_number, selectedTenant.full_name)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Renvoyer</span>
                      </button>
                      <button
                        onClick={() => handleDownloadReceiptPDF(rcp, selectedTenant)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow flex items-center gap-1.5 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t pt-4">
              <button
                onClick={() => setSelectedTenant(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs shadow"
              >
                Fermer le dossier
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL APERÇU REÇU / QUITTANCE AVEC LE VRAI QR CODE OFFICIEL ET SIGNATURES */}
      {previewReceipt && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Reçu Officiel Certifié LocaTrust</h3>
                  <p className="text-xs text-slate-500">Quittance authentifiée avec signatures électroniques réelles</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewReceipt(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Body (Matching exact User Screenshot) */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4 text-xs font-sans text-slate-800 shadow-sm">
              
              {/* Header Branding with Official LocaTrust Logo from User Image */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div className="flex flex-col">
                  <img
                    src="/locatrust-official-logo.png"
                    alt="Logo Officiel LocaTrust"
                    className="h-10 object-contain object-left"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Votre bien, notre priorité</span>
                </div>

                <div className="text-right text-[10px] text-slate-500 leading-tight">
                  <div className="font-extrabold text-slate-800 text-[11px]">Plateforme Sécurisée LocaTrust</div>
                  <div className="text-slate-400">République de Côte d'Ivoire • Loi n° 2019-576</div>
                  <div className="text-slate-400 font-mono">support@locatrust.ci • www.locatrust.ci</div>
                </div>
              </div>

              {/* Header Banner (Light Sky Blue with Gold/Orange Accents) */}
              <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white p-3.5 rounded-xl flex items-center justify-between shadow-sm border-b-2 border-amber-400">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black tracking-wide uppercase">QUITTANCE / REÇU DE PAIEMENT DE LOYER</h4>
                    <span className="text-[10px] text-sky-100 font-medium">Bail d'habitation certifié • LocaTrust</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-black tracking-wider text-amber-200">N° {previewReceipt.receipt.receipt_number}</div>
                  <div className="text-[9px] text-sky-100">
                    Date d'émission : {previewReceipt.receipt.issued_date}
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-[11px]">
                  <span className="font-black text-emerald-800">PAIEMENT VALIDÉ</span> — Ce reçu est authentique et enregistré sur LocaTrust.
                </div>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                {/* Tenant Card */}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                  <span className="font-extrabold text-blue-700 uppercase text-[10px]">Informations du locataire</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nom et prénom :</span>
                    <strong className="text-slate-900">{previewReceipt.tenant.full_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CNI :</span>
                    <span className="font-mono text-slate-700">CI123456789</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone :</span>
                    <span className="text-slate-700">{previewReceipt.tenant.phone}</span>
                  </div>
                </div>

                {/* Owner Card */}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                  <span className="font-extrabold text-blue-700 uppercase text-[10px]">Informations du propriétaire</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nom et prénom :</span>
                    <strong className="text-slate-900">Koffi N'Guessan</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CNI :</span>
                    <span className="font-mono text-slate-700">CI987654321</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone :</span>
                    <span className="text-slate-700">05 05 43 21 00</span>
                  </div>
                </div>

                {/* Property Card */}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                  <span className="font-extrabold text-blue-700 uppercase text-[10px]">Bien immobilier</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type :</span>
                    <strong className="text-slate-900">{previewReceipt.tenant.property_title}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Adresse :</span>
                    <span className="text-slate-700">{previewReceipt.tenant.property_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Réf bien :</span>
                    <span className="font-mono text-slate-700">BIEN-000456</span>
                  </div>
                </div>

                {/* Contract Card */}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                  <span className="font-extrabold text-blue-700 uppercase text-[10px]">Contrat de bail</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">N° contrat :</span>
                    <strong className="text-slate-900">{previewReceipt.tenant.contract_number}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Durée du bail :</span>
                    <span className="text-slate-700">12 mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Période :</span>
                    <span className="text-slate-700">{previewReceipt.tenant.contract_period}</span>
                  </div>
                </div>
              </div>

              {/* Table Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#0B192C] text-white font-extrabold">
                    <tr>
                      <th className="p-2.5">Détail du paiement</th>
                      <th className="p-2.5">Période(s) concernée(s)</th>
                      <th className="p-2.5">Montant unitaire</th>
                      <th className="p-2.5 text-right">Montant total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Loyer mensuel</td>
                      <td className="p-2.5 text-slate-700">{previewReceipt.receipt.target_month}</td>
                      <td className="p-2.5 font-medium text-slate-700">{formatFCFA(previewReceipt.receipt.amount)}</td>
                      <td className="p-2.5 text-right font-black text-slate-900">{formatFCFA(previewReceipt.receipt.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount Box + Payment Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Montant payé</span>
                  <span className="text-xl font-black text-blue-700 mt-0.5">{formatFCFA(previewReceipt.receipt.amount)}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({formatFCFA(previewReceipt.receipt.amount)} réglés)</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date du paiement :</span>
                    <strong className="text-slate-800">{previewReceipt.receipt.issued_date}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mode de paiement :</span>
                    <strong className="text-slate-800">{previewReceipt.receipt.payment_method}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Réf transaction :</span>
                    <span className="font-mono text-slate-700">{previewReceipt.receipt.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statut :</span>
                    <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Payé
                    </span>
                  </div>
                </div>
              </div>

              {/* SIGNATURES & QR CODE CONTAINER (Exact Match Template) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 items-center">
                
                {/* Propriétaire Signature */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Signature du propriétaire</span>
                  <div className="h-14 w-full flex items-center justify-center my-1">
                    {ownerSignatureUrl ? (
                      <img src={ownerSignatureUrl} alt="Signature propriétaire" className="max-h-12 max-w-full object-contain" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSigningParty('proprietaire')}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[10px] flex items-center gap-1"
                      >
                        <PenTool className="w-3 h-3" />
                        <span>Signer le reçu</span>
                      </button>
                    )}
                  </div>
                  <span className="font-bold text-slate-800 text-[10px]">Koffi N'Guessan</span>
                </div>

                {/* Locataire Signature */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Signature du locataire</span>
                  <div className="h-14 w-full flex items-center justify-center my-1">
                    {tenantSignatureUrl ? (
                      <img src={tenantSignatureUrl} alt="Signature locataire" className="max-h-12 max-w-full object-contain" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSigningParty('locataire')}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[10px] flex items-center gap-1"
                      >
                        <PenTool className="w-3 h-3" />
                        <span>Signer le reçu</span>
                      </button>
                    )}
                  </div>
                  <span className="font-bold text-slate-800 text-[10px]">{previewReceipt.tenant.full_name}</span>
                </div>

                {/* QR Code Verification */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg p-1 shrink-0 flex items-center justify-center shadow-sm">
                    <img src={LOCATRUST_QR_CODE_DATA_URL} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col text-[9px] leading-tight text-slate-500">
                    <strong className="text-slate-800 text-[10px]">Vérifier l'authenticité</strong>
                    <span>Scannez ce QR code pour vérifier ce reçu sur LocaTrust.</span>
                    <span className="text-blue-700 font-extrabold mt-1">LocaTrust • Sécurité</span>
                  </div>
                </div>

              </div>

              {/* Note de bas de page */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>Ce reçu fait partie intégrante du contrat de bail n° {previewReceipt.tenant.contract_number}.</span>
                <span className="font-semibold text-slate-600">Merci pour votre confiance ! LocaTrust</span>
              </div>

            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-slate-700 text-xs"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResendReceipt(previewReceipt.receipt.receipt_number, previewReceipt.tenant.full_name)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Renvoyer au Locataire</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReceiptPDF(previewReceipt.receipt, previewReceipt.tenant)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger PDF (Officiel)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Interactive Signature Modal for HistoriqueView */}
      {activeSigningParty && (
        <SignatureModal
          isOpen={!!activeSigningParty}
          onClose={() => setActiveSigningParty(null)}
          onConfirmSignature={(signatureUrl) => {
            if (activeSigningParty === 'proprietaire') {
              setOwnerSignatureUrl(signatureUrl);
            } else {
              setTenantSignatureUrl(signatureUrl);
            }
            setActiveSigningParty(null);
          }}
          signerName={activeSigningParty === 'proprietaire' ? "Koffi N'Guessan" : (previewReceipt?.tenant?.full_name || "Kouadio Jean")}
          signerRole={activeSigningParty}
          documentTitle="Reçu de Paiement Officiel"
          documentNumber={previewReceipt?.receipt.receipt_number || 'REC-2026-000981'}
        />
      )}

    </div>
  );
};

