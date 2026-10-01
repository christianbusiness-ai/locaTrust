'use client';

import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Download,
  Eye,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  ShieldCheck,
  CreditCard,
  QrCode,
  Sparkles
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { Lock, Clock, Send } from 'lucide-react';
import { ActionConfirmationModal } from '@/components/common/ActionConfirmationModal';

interface OfficialReceiptRow {
  id: string;
  receipt_number: string;
  receipt_type: 'loyer' | 'caution';
  tenant_name: string;
  property_title: string;
  property_address: string;
  contract_number: string;
  period_covered: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  transaction_ref: string;
  status: 'valide' | 'certifie';
  owner_signed: boolean;
  tenant_signed: boolean;
}

const MOCK_RECEIPTS_DATA: OfficialReceiptRow[] = [
  {
    id: 'rcp_1',
    receipt_number: 'REC-2026-000987',
    receipt_type: 'loyer',
    tenant_name: 'Kouadio Jean',
    property_title: 'Appartement 3 pièces Cocody Riviera 3',
    property_address: 'Cocody Riviera 3, Abidjan',
    contract_number: 'LT-CI-2026-000123',
    period_covered: 'Août 2026',
    amount: 150000,
    payment_method: 'Mobile Money (Orange)',
    payment_date: '05/09/2026',
    transaction_ref: 'MM20260905123456',
    status: 'certifie',
    owner_signed: true,
    tenant_signed: true
  },
  {
    id: 'rcp_2',
    receipt_number: 'CAUT-2026-000109',
    receipt_type: 'caution',
    tenant_name: "Koffi N'Guessan",
    property_title: 'Appartement 3 pièces moderne',
    property_address: 'Cocody Riviera 3, Abidjan',
    contract_number: 'LT-2026-CI-000492',
    period_covered: 'Dépôt de garantie contractuelle',
    amount: 900000,
    payment_method: 'Virement bancaire',
    payment_date: '01/01/2026',
    transaction_ref: 'VIR-BNI-2026-9901',
    status: 'certifie',
    owner_signed: true,
    tenant_signed: false
  },
  {
    id: 'rcp_3',
    receipt_number: 'REC-2026-000980',
    receipt_type: 'loyer',
    tenant_name: "Koffi N'Guessan",
    property_title: 'Appartement 3 pièces moderne',
    property_address: 'Cocody Riviera 3, Abidjan',
    contract_number: 'LT-2026-CI-000492',
    period_covered: 'Juillet 2026',
    amount: 450000,
    payment_method: 'Wave CI',
    payment_date: '03/08/2026',
    transaction_ref: 'WAVE-CI-77382109',
    status: 'valide',
    owner_signed: true,
    tenant_signed: true
  },
  {
    id: 'rcp_4',
    receipt_number: 'CAUT-2026-000115',
    receipt_type: 'caution',
    tenant_name: 'Amina Diabaté',
    property_title: 'Villa 4 pièces Riviera M\'Badon',
    property_address: 'Riviera M\'Badon, Cocody',
    contract_number: 'LT-2026-CI-000508',
    period_covered: 'Dépôt de garantie initial',
    amount: 650000,
    payment_method: 'Wave CI',
    payment_date: '10/05/2026',
    transaction_ref: 'WAVE-CI-8899120',
    status: 'valide',
    owner_signed: false,
    tenant_signed: true
  }
];

export const ReceiptsQuittancesView: React.FC = () => {
  const [receipts] = useState<OfficialReceiptRow[]>(MOCK_RECEIPTS_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'loyer' | 'caution'>('tous');
  const [previewReceipt, setPreviewReceipt] = useState<OfficialReceiptRow | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const handleRelanceReceipt = (r: OfficialReceiptRow) => {
    const targetRole = !r.owner_signed ? 'bailleur' : 'locataire';
    const targetName = targetRole === 'bailleur' ? "le bailleur" : r.tenant_name;
    setConfirmationModal({
      isOpen: true,
      title: 'Relance interne transmise',
      message: `Une notification de relance pour la signature du reçu N° ${r.receipt_number} a été déposée dans la messagerie interne de ${targetName}.`,
      details: 'Le document final signé deviendra téléchargeable dès validation.'
    });
  };

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.property_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.transaction_ref.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'tous' || r.receipt_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleDownloadPDF = async (r: OfficialReceiptRow) => {
    await generateOfficialReceiptPDF({
      receiptNumber: r.receipt_number,
      receiptType: r.receipt_type,
      contractNumber: r.contract_number,
      contractToken: 'tok_cnt_ci2026_000123',
      propertyTitle: r.property_title,
      propertyAddress: r.property_address,
      propertyReference: 'BIEN-000456',
      propertyType: 'Appartement / Villa',
      durationMonths: 12,
      leaseStartDate: '01/01/2026',
      leaseEndDate: '31/12/2026',
      ownerName: "Koffi N'Guessan",
      ownerCni: 'CI987654321',
      ownerPhone: '+225 05 05 43 21 00',
      tenantName: r.tenant_name,
      tenantCni: 'CI123456789',
      tenantPhone: '+225 07 00 12 34 56',
      amount: r.amount,
      periodCovered: r.period_covered,
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method,
      transactionReference: r.transaction_ref
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Reçus & Quittances
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-extrabold border border-blue-200 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              Reçus certifiés
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Historique intégral des quittances de loyer et des reçus de caution émis avec QR code d'authentification.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="N° reçu, locataire, réf..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setTypeFilter('tous')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                typeFilter === 'tous' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setTypeFilter('loyer')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                typeFilter === 'loyer' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Loyers
            </button>
            <button
              onClick={() => setTypeFilter('caution')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                typeFilter === 'caution' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cautions
            </button>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Documents comptables émis ({filteredReceipts.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Conformes à la loi n° 2019-576 • Vérifiables par QR code
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">N° Reçu</th>
                <th className="p-4">Type</th>
                <th className="p-4">Locataire & Bien</th>
                <th className="p-4">Période Concernée</th>
                <th className="p-4">Montant Réglé</th>
                <th className="p-4">Date & Réf</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  
                  {/* N° Reçu */}
                  <td className="p-4">
                    <span className="font-mono font-black text-blue-700">{r.receipt_number}</span>
                  </td>

                  {/* Type */}
                  <td className="p-4">
                    {r.receipt_type === 'loyer' ? (
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-black text-[10px]">
                        Quittance Loyer
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-black text-[10px]">
                        Reçu Caution
                      </span>
                    )}
                  </td>

                  {/* Locataire & Bien */}
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{r.tenant_name}</span>
                      <span className="text-[11px] text-slate-500">{r.property_title}</span>
                    </div>
                  </td>

                  {/* Période */}
                  <td className="p-4 font-semibold text-slate-800">{r.period_covered}</td>

                  {/* Montant */}
                  <td className="p-4 font-black text-slate-900">{formatFCFA(r.amount)}</td>

                  {/* Date & Réf */}
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{r.payment_date}</span>
                      <span className="text-[10px] font-mono text-slate-400">{r.transaction_ref}</span>
                    </div>
                  </td>

                  {/* Statut (Point 5 & 10) */}
                  <td className="p-4">
                    {r.owner_signed && r.tenant_signed ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1 w-fit whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Reçu certifié (2 signatures)
                      </span>
                    ) : !r.owner_signed ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1 w-fit whitespace-nowrap">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Reçu en attente de signature du bailleur
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1 w-fit whitespace-nowrap">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Reçu en attente de signature du locataire
                      </span>
                    )}
                  </td>

                  {/* Actions (Point 5) */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.owner_signed && r.tenant_signed ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(r)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-extrabold text-[11px] flex items-center gap-1 cursor-not-allowed border border-slate-200"
                            title="Téléchargement bloqué : signatures obligatoires manquantes"
                          >
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Bloqué</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRelanceReceipt(r)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap"
                            title={!r.owner_signed ? "Relancer le bailleur" : "Relancer le locataire"}
                          >
                            <Send className="w-3 h-3" />
                            <span>Relancer</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmationModal && (
        <ActionConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          title={confirmationModal.title}
          message={confirmationModal.message}
          details={confirmationModal.details}
          type="success"
          confirmText="Compris"
          withCelebration={false}
        />
      )}

    </div>
  );
};
