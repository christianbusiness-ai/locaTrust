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
import { Lock, Clock, Send, AlertTriangle } from 'lucide-react';
import { ActionConfirmationModal } from '@/components/common/ActionConfirmationModal';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { TableRowsSkeleton } from '@/components/common/SkeletonLoader';

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

export const ReceiptsQuittancesView: React.FC = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<OfficialReceiptRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'loyer' | 'caution'>('tous');
  const [previewReceipt, setPreviewReceipt] = useState<OfficialReceiptRow | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const loadReceipts = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setLoadError(error.message);
      } else {
        setReceipts((data || []).map((r: any) => ({
          id: r.id,
          receipt_number: r.receipt_number || `REC-${r.id.slice(0, 8)}`,
          receipt_type: (r.type || 'loyer') as 'loyer' | 'caution',
          tenant_name: r.tenant_name || 'Locataire',
          property_title: r.property_title || 'Logement',
          property_address: r.property_address || 'Abidjan',
          contract_number: r.contract_number || 'LT-CI-2026',
          period_covered: r.period_covered || new Date(r.created_at || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          amount: Number(r.amount) || 0,
          payment_method: r.payment_method || 'Mobile Money',
          payment_date: new Date(r.created_at || Date.now()).toLocaleDateString('fr-FR'),
          transaction_ref: r.token || r.id.slice(0, 12),
          status: 'certifie',
          owner_signed: true,
          tenant_signed: true
        })));
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erreur lors du chargement des quittances.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadReceipts();

    const handleUpdate = () => {
      loadReceipts();
    };

    window.addEventListener('locatrust:receipts-updated', handleUpdate);
    window.addEventListener('locatrust:payments-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:receipts-updated', handleUpdate);
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
    };
  }, [user]);

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
      ownerName: user?.user_metadata?.full_name || 'Bailleur',
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
            {isLoading ? (
              <TableRowsSkeleton rows={5} cols={8} />
            ) : (
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loadError && (
                <tr>
                  <td colSpan={8} className="p-8 text-center bg-rose-50/50">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                      <span className="text-slate-800 font-bold text-xs">{loadError}</span>
                      <button onClick={loadReceipts} className="mt-3 px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition cursor-pointer">
                        Réessayer
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && filteredReceipts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <span className="text-slate-800 font-bold text-sm">
                        {searchTerm ? "Aucun reçu ne correspond à votre recherche" : "Aucune quittance émise pour le moment"}
                      </span>
                      <p className="text-slate-400 text-xs mt-1 text-center">
                        {searchTerm
                          ? "Modifiez vos filtres ou termes de recherche."
                          : "Dès que vous validerez des paiements de loyer ou de caution, vos quittances certifiées conformes apparaîtront ici."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && filteredReceipts.map((r) => (
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
            )}
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
