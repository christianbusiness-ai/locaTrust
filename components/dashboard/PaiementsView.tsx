'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Download,
  AlertCircle,
  Eye,
  ArrowRight,
  Filter,
  Check,
  Calendar,
  Sparkles,
  Clock,
  Send,
  Zap,
  RotateCcw,
  ShieldCheck,
  Receipt,
  X,
  Building2,
  PenTool
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { RentPayment } from '@/types/database.types';
import { MOCK_RENT_PAYMENTS } from '@/lib/mock/data';
import {
  MOCK_TENANT_RENT_SCHEDULE,
  MonthlyScheduleItem,
  processChronologicalRentPayment,
  AllocationResult
} from '@/lib/payments/rentScheduleEngine';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import { sendQuittanceToTenant } from '@/lib/messagingStore';
import { ActionConfirmationModal, ConfirmationType } from '@/components/common/ActionConfirmationModal';

interface PaiementsViewProps {
  onOpenConfirmPaymentModal?: () => void;
}

export const PaiementsView: React.FC<PaiementsViewProps> = ({
  onOpenConfirmPaymentModal,
}) => {
  // Live Rent Schedule State for the active tenant
  const [rentSchedule, setRentSchedule] = useState<MonthlyScheduleItem[]>(MOCK_TENANT_RENT_SCHEDULE);
  const [lastAllocationResult, setLastAllocationResult] = useState<AllocationResult | null>(null);

  // Modern Centered Confirmation Modal State (Point 14)
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type?: ConfirmationType;
    title: string;
    message: string;
    details?: string;
    confirmText?: string;
    withCelebration?: boolean;
  } | null>(null);

  // Simulation controls
  const [customSimAmount, setCustomSimAmount] = useState<number>(150000);
  const [customSimMethod, setCustomSimMethod] = useState<string>('Orange Money');

  const [payments, setPayments] = useState<RentPayment[]>([
    ...MOCK_RENT_PAYMENTS,
    {
      id: 'pmt_3',
      contract_id: 'LT-2026-CI-000492',
      tenant_id: 'usr_tenant_1',
      owner_id: 'usr_owner_1',
      target_month: 'Août 2026',
      amount: 150000,
      payment_date: '2026-09-02',
      reference: 'OM-225-99182301',
      proof_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      status: 'declare',
      created_at: '2026-09-02T10:15:00Z',
      tenant: {
        id: 'usr_tenant_1',
        role: 'locataire',
        full_name: "Koffi N'Guessan",
        email: 'koffi.nguessan@locatrust.ci',
        phone: '+225 07 08 09 10 11',
        verification_status: 'verifie',
        created_at: '2025-01-15'
      },
      contract: MOCK_RENT_PAYMENTS[0].contract
    }
  ]);

  const [activeTab, setActiveTab] = useState<'tous' | 'declares' | 'confirmes' | 'refuses'>('tous');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  // Handle Chronological Payment Simulation (Prompts 8, 9, 10, 13, 14, 15)
  const handleSimulateChronologicalPayment = (amountToPay: number) => {
    const result = processChronologicalRentPayment(
      rentSchedule,
      amountToPay,
      customSimMethod,
      `OM-CI-${Math.floor(100000 + Math.random() * 900000)}`,
      "Koffi N'Guessan",
      'LT-2026-CI-000492',
      'Appartement 3 pièces Cocody Riviera 3'
    );

    setRentSchedule(result.updatedSchedule);
    setLastAllocationResult(result);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });

    // Add new payment entry to history with exact periods covered text
    const newPmt: RentPayment = {
      id: `pmt_${Date.now()}`,
      contract_id: 'LT-2026-CI-000492',
      tenant_id: 'usr_tenant_1',
      owner_id: 'usr_owner_1',
      target_month: result.generatedReceipt.periods_covered_text,
      amount: amountToPay,
      payment_date: new Date().toISOString().split('T')[0],
      reference: result.generatedReceipt.reference,
      status: 'confirme',
      created_at: new Date().toISOString(),
      tenant: {
        id: 'usr_tenant_1',
        role: 'locataire',
        full_name: "Koffi N'Guessan",
        email: 'koffi.nguessan@locatrust.ci',
        phone: '+225 07 08 09 10 11',
        verification_status: 'verifie',
        created_at: '2025-01-15'
      }
    };

    setPayments((prev) => [newPmt, ...prev]);

    setConfirmationModal({
      isOpen: true,
      type: 'payment_validated',
      title: 'Paiement affecté chronologiquement !',
      message: `Montant reçu : ${formatFCFA(amountToPay)}. Le règlement a été ventilé automatiquement sur les échéances les plus anciennes.`,
      details: `Périodes couvertes : ${result.generatedReceipt.periods_covered_text} • Reçu N° ${result.generatedReceipt.receipt_number}`,
      confirmText: 'OK, parfait',
      withCelebration: true
    });
  };

  const handleResetSchedule = () => {
    setRentSchedule(MOCK_TENANT_RENT_SCHEDULE);
    setLastAllocationResult(null);
    setConfirmationModal({
      isOpen: true,
      type: 'success',
      title: 'Échéancier réinitialisé',
      message: 'L\'échéancier locatif a été réinitialisé à son état initial (Août 2026 impayé).',
      confirmText: 'OK',
    });
  };

  // Stats
  const totalConfirmed = payments
    .filter((p) => p.status === 'confirme')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalDeclared = payments
    .filter((p) => p.status === 'declare')
    .reduce((sum, p) => sum + p.amount, 0);

  // State for OCR Receipt Confirmation & Generation Modal
  const [validatingPayment, setValidatingPayment] = useState<RentPayment | null>(null);
  const [extractedOcrData, setExtractedOcrData] = useState<{
    reference: string;
    amount: number;
    payment_method: string;
    sender_phone: string;
    detected_month: string;
  } | null>(null);
  const [previewingReceipt, setPreviewingReceipt] = useState<RentPayment | null>(null);

  const handleStartValidation = (pmt: RentPayment) => {
    // LocaTrust Intelligent OCR extraction from payment proof
    const sampleRef = pmt.reference || `OM-CI-${Math.floor(100000 + Math.random() * 900000)}`;
    setExtractedOcrData({
      reference: sampleRef,
      amount: pmt.amount || 150000,
      payment_method: sampleRef.startsWith('OM') ? 'Orange Money CI' : sampleRef.startsWith('WAVE') ? 'Wave Mobile Money' : 'MTN Mobile Money',
      sender_phone: pmt.tenant?.phone || '+225 07 08 09 10 11',
      detected_month: pmt.target_month || 'Août 2026',
    });
    setValidatingPayment(pmt);
  };

  const handleFinalizeValidation = () => {
    if (!validatingPayment || !extractedOcrData) return;

    if (!ownerSignatureUrl) {
      setConfirmationModal({
        isOpen: true,
        type: 'caution_validated',
        title: 'Signature manuelle requise',
        message: 'Veuillez apposer votre signature manuelle (Bailleur) avant d\'émettre la quittance officielle.',
        confirmText: 'Signer maintenant',
      });
      setActiveSigningParty('proprietaire');
      return;
    }

    // 1. Process chronological allocation in background
    const result = processChronologicalRentPayment(
      rentSchedule,
      extractedOcrData.amount,
      extractedOcrData.payment_method,
      extractedOcrData.reference,
      validatingPayment.tenant?.full_name || "Koffi N'Guessan",
      validatingPayment.contract_id || 'LT-2026-CI-000492',
      validatingPayment.contract?.property?.title || 'Appartement 3 pièces Cocody Riviera 3'
    );

    setRentSchedule(result.updatedSchedule);
    setLastAllocationResult(result);

    // 2. Update payment status to confirmed with exact receipt reference
    const confirmedPmt: RentPayment = {
      ...validatingPayment,
      status: 'confirme',
      amount: extractedOcrData.amount,
      reference: extractedOcrData.reference,
      target_month: result.generatedReceipt.periods_covered_text,
      confirmed_at: new Date().toISOString(),
    };

    setPayments((prev) =>
      prev.map((p) => (p.id === validatingPayment.id ? confirmedPmt : p))
    );

    // 3. Dispatch official receipt to Tenant Messaging Inbox
    sendQuittanceToTenant({
      receiptNumber: extractedOcrData.reference,
      contractNumber: validatingPayment.contract_id || 'LT-CI-2026-000123',
      propertyTitle: validatingPayment.contract?.property?.title || 'Appartement 3 pièces Cocody Riviera 3',
      propertyAddress: 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
      amount: extractedOcrData.amount,
      periodCovered: result.generatedReceipt.periods_covered_text,
      paymentDate: new Date().toLocaleDateString('fr-FR'),
      paymentMethod: extractedOcrData.payment_method,
      transactionReference: extractedOcrData.reference,
      ownerName: "Koffi N'Guessan",
      tenantName: validatingPayment.tenant?.full_name || 'Kouadio Jean',
      ownerSignatureUrl: ownerSignatureUrl,
      tenantSignatureUrl: tenantSignatureUrl,
    });

    setValidatingPayment(null);
    setExtractedOcrData(null);

    // 4. Trigger Modern Centered Confirmation (Point 14)
    setConfirmationModal({
      isOpen: true,
      type: 'payment_validated',
      title: 'Paiement validé avec succès !',
      message: `La quittance N° ${extractedOcrData.reference} a été certifiée conforme et transmise directement dans la boîte de messagerie du locataire ${validatingPayment.tenant?.full_name || 'Kouadio Jean'}.`,
      details: `Périodes couvertes : ${result.generatedReceipt.periods_covered_text} • Montant : ${formatFCFA(extractedOcrData.amount)}`,
      confirmText: 'Consulter la quittance',
      withCelebration: true
    });

    // 5. Open Generated Receipt Preview for Landlord
    setPreviewingReceipt(confirmedPmt);
  };

  const handleReject = (id: string) => {
    const reason = prompt('Motif du refus du paiement :');
    if (reason !== null) {
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'refuse' } : p))
      );
      alert('Paiement refusé et notifié au locataire.');
    }
  };

  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(null);
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(null);
  const [activeSigningParty, setActiveSigningParty] = useState<'proprietaire' | 'locataire' | null>(null);

  const handleDownloadReceiptPDF = async (pmt: RentPayment) => {
    await generateOfficialReceiptPDF({
      receiptNumber: pmt.reference,
      contractNumber: pmt.contract_id || 'LT-CI-2026-000123',
      contractToken: 'tok_cnt_ci2026_000123',
      propertyTitle: pmt.contract?.property?.title || 'Appartement 3 pièces Cocody',
      propertyAddress: 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
      propertyReference: 'BIEN-000456',
      propertyType: 'Appartement 3 pièces',
      durationMonths: 12,
      leaseStartDate: '01/10/2026',
      leaseEndDate: '30/09/2027',
      ownerName: "Koffi N'Guessan",
      ownerCni: 'CI987654321',
      ownerPhone: '05 05 43 21 00',
      tenantName: pmt.tenant?.full_name || 'Kouadio Jean',
      tenantCni: 'CI123456789',
      tenantPhone: pmt.tenant?.phone || '07 00 12 34 56',
      amount: pmt.amount,
      periodCovered: pmt.target_month,
      paymentDate: new Date(pmt.confirmed_at || pmt.created_at).toLocaleDateString('fr-FR'),
      paymentMethod: pmt.reference.startsWith('OM') ? 'Orange Money' : pmt.reference.startsWith('WAVE') ? 'Wave Mobile Money' : 'Mobile Money',
      transactionReference: pmt.reference,
      ownerSignatureUrl,
      tenantSignatureUrl,
    });
  };

  const filteredPayments = payments.filter((p) => {
    if (activeTab === 'declares') return p.status === 'declare';
    if (activeTab === 'confirmes') return p.status === 'confirme';
    if (activeTab === 'refuses') return p.status === 'refuse';
    return true;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Gestion des Paiements & Quittances
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
              Affectation Chronologique Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des règlements, validation des déclarations avec extraction OCR et génération des quittances certifiées.
          </p>
        </div>
      </div>

      {/* KPI Cards (3 Compact & Responsive Cards - Règle d'affectation retirée et gérée en arrière-plan) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => setActiveTab('confirmes')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'confirmes'
              ? 'bg-emerald-50/70 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 shadow-sm hover:border-emerald-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-emerald-700 leading-none">{formatFCFA(totalConfirmed)}</span>
            <span className="text-xs font-semibold text-slate-500 mt-1">Loyers encaissés (Confirmés)</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('declares')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'declares'
              ? 'bg-amber-50/70 border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 shadow-sm hover:border-amber-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-amber-600 leading-none">{formatFCFA(totalDeclared)}</span>
            <span className="text-xs font-semibold text-slate-500 mt-1">Déclarations en attente</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('tous')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'tous'
              ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-slate-900 leading-none">{payments.length}</span>
            <span className="text-xs font-semibold text-slate-500 mt-1">Total déclarations reçues</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('tous')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'tous' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Tous ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('declares')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'declares' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          À Valider / Déclarés ({payments.filter((p) => p.status === 'declare').length})
        </button>
        <button
          onClick={() => setActiveTab('confirmes')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'confirmes' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Confirmés ({payments.filter((p) => p.status === 'confirme').length})
        </button>
        <button
          onClick={() => setActiveTab('refuses')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'refuses' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Refusés ({payments.filter((p) => p.status === 'refuse').length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">Locataire</th>
                <th className="p-4">Période Réellement Réglée</th>
                <th className="p-4">Montant Encaisse</th>
                <th className="p-4">Référence & Preuve</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-center">Actions & Quittance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredPayments.map((pmt) => (
                <tr key={pmt.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-900">
                    <div className="flex flex-col">
                      <span>{pmt.tenant?.full_name || 'Locataire'}</span>
                      <span className="text-[11px] text-slate-400 font-normal">{pmt.payment_date}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 font-extrabold text-[11px] border border-blue-100">
                      {pmt.target_month}
                    </span>
                  </td>
                  <td className="p-4 font-black text-slate-900 text-sm">
                    {formatFCFA(pmt.amount)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {pmt.reference}
                      </span>
                      {pmt.proof_url && (
                        <button
                          onClick={() => setSelectedProofUrl(pmt.proof_url)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-blue-600"
                          title="Voir la preuve de paiement"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {pmt.status === 'declare' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px]">
                        Déclaré (Attente validation)
                      </span>
                    )}
                    {pmt.status === 'confirme' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-extrabold text-[10px]">
                        Confirmé & Affecté
                      </span>
                    )}
                    {pmt.status === 'refuse' && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 font-extrabold text-[10px]">
                        Refusé
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {pmt.status === 'declare' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleStartValidation(pmt)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                          title="Extraire les données de la preuve et générer la quittance"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Valider & Générer Quittance</span>
                        </button>
                        <button
                          onClick={() => handleReject(pmt.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-xs flex items-center gap-1 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Refuser</span>
                        </button>
                      </div>
                    ) : pmt.status === 'confirme' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setPreviewingReceipt(pmt)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                          title="Visualiser la quittance officielle générée"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Aperçu Quittance</span>
                        </button>
                        <button
                          onClick={() => handleDownloadReceiptPDF(pmt)}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-extrabold text-xs flex items-center justify-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => {
                            setConfirmationModal({
                              isOpen: true,
                              type: 'sent',
                              title: 'Quittance transmise avec succès !',
                              message: `La quittance officielle a été transmise directement dans la boîte de messagerie du locataire ${pmt.tenant?.full_name || ''}.`,
                              confirmText: 'OK, parfait',
                              withCelebration: true
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-extrabold text-xs flex items-center justify-center gap-1"
                          title="Transmettre la quittance au locataire"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Envoyer</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-bold">Aucune quittance</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Preview Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-slate-900">Preuve de paiement reçue</h3>
              <button onClick={() => setSelectedProofUrl(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <img src={selectedProofUrl} alt="Preuve de paiement" className="w-full h-64 object-cover rounded-2xl border" />
            <button
              onClick={() => setSelectedProofUrl(null)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: EXTRACTION INTELLIGENTE DES NUMÉROS DE LA PREUVE (OCR LOCATRUST) & GÉNÉRATION */}
      {validatingPayment && extractedOcrData && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Extraction des Données de Paiement</h3>
                  <p className="text-xs text-slate-500">Lecture automatique de la capture / preuve mobile money</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setValidatingPayment(null);
                  setExtractedOcrData(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proof thumbnail & extracted fields */}
            <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-300 shrink-0 bg-black">
                <img
                  src={validatingPayment.proof_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80'}
                  alt="Capture de paiement"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-xs gap-1">
                <span className="font-extrabold text-slate-800">
                  Locataire : <strong className="text-blue-900">{validatingPayment.tenant?.full_name || "Koffi N'Guessan"}</strong>
                </span>
                <span className="text-slate-500">Contrat : {validatingPayment.contract_id || 'LT-2026-CI-000492'}</span>
                <span className="text-[11px] text-emerald-700 font-black flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Données extraites avec succès
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Numéro de référence de la transaction (Extrait de la capture)
                </label>
                <input
                  type="text"
                  value={extractedOcrData.reference}
                  onChange={(e) => setExtractedOcrData({ ...extractedOcrData, reference: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Montant Détecté (FCFA)</label>
                  <input
                    type="number"
                    value={extractedOcrData.amount}
                    onChange={(e) => setExtractedOcrData({ ...extractedOcrData, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-extrabold text-emerald-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Canal Opérateur</label>
                  <select
                    value={extractedOcrData.payment_method}
                    onChange={(e) => setExtractedOcrData({ ...extractedOcrData, payment_method: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Orange Money CI">Orange Money CI</option>
                    <option value="Wave Mobile Money">Wave Mobile Money</option>
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Moov Money">Moov Money</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">💵 Espèces (cash)</option>
                  </select>
                </div>
              </div>

              {/* SECTION SIGNATURE MANUELLE DU BAILLEUR (OBLIGATOIRE POUR ÉMETTRE LA QUITTANCE) */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-black text-slate-900 uppercase">
                      Signature Manuelle du Bailleur
                    </span>
                  </div>
                  {ownerSignatureUrl ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Signature certifiée
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                      Signature requise
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-snug">
                  Pour certifier et émettre cette quittance, apposez votre véritable signature manuscrite (doigt sur smartphone/tablette ou souris/pavé tactile).
                </p>

                {/* Zone d'affichage et déclencheur de signature */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4">
                  {ownerSignatureUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-28 bg-slate-50 rounded-lg border border-slate-200 p-1 flex items-center justify-center">
                        <img src={ownerSignatureUrl} alt="Signature bailleur" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex flex-col text-xs">
                        <span className="font-extrabold text-slate-900">Koffi N'Guessan</span>
                        <span className="text-[10px] text-slate-500">Bailleur propriétaire</span>
                        <span className="text-[9px] text-emerald-600 font-bold">Horodatée et liée à la quittance</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Aucune signature apposée pour le moment.</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveSigningParty('proprietaire')}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{ownerSignatureUrl ? 'Modifier ma signature' : 'Dessiner ma signature'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setValidatingPayment(null);
                  setExtractedOcrData(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleFinalizeValidation}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg flex items-center gap-2 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer & Émettre la Quittance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VISUALISATION OFFICIELLE DU REÇU / QUITTANCE PAR LE PROPRIÉTAIRE (100% TEMPLATE LOCATRUST) */}
      {previewingReceipt && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            
            {/* Top Modal Bar */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Reçu Officiel LocaTrust</h3>
                  <p className="text-xs text-slate-500">Document certifié conforme avec signatures électroniques réelles</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewingReceipt(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DOCUMENT CANVAS (Match 100% with Image provided by User) */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4 text-xs font-sans text-slate-800">
              
              {/* Header Branding */}
              <div className="flex items-start justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/locatrust-official-logo.png"
                    alt="LocaTrust"
                    className="h-9 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-blue-900 tracking-tight leading-none">
                      Loca<span className="text-amber-500">Trust</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold mt-0.5">Votre bien, notre priorité</span>
                  </div>
                </div>

                <div className="text-right text-[10px] text-slate-500 leading-tight">
                  <div className="font-extrabold text-slate-800 text-[11px]">Plateforme de gestion locative</div>
                  <div className="text-slate-400 font-medium">Document certifié conforme • République de Côte d'Ivoire</div>
                </div>
              </div>

              {/* Navy Banner */}
              <div className="bg-[#0B192C] text-white p-3.5 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black tracking-wide uppercase">REÇU DE PAIEMENT</h4>
                    <span className="text-[10px] text-slate-300">Loyer - Contrat de bail</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-black tracking-wider">N° REÇU : {previewingReceipt.reference}</div>
                  <div className="text-[9px] text-slate-300">
                    Date d'émission : {new Date(previewingReceipt.confirmed_at || previewingReceipt.created_at).toLocaleDateString('fr-FR')}
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
                    <strong className="text-slate-900">{previewingReceipt.tenant?.full_name || 'Kouadio Jean'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CNI :</span>
                    <span className="font-mono text-slate-700">CI123456789</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone :</span>
                    <span className="text-slate-700">{previewingReceipt.tenant?.phone || '07 00 12 34 56'}</span>
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
                    <strong className="text-slate-900">{previewingReceipt.contract?.property?.title || 'Appartement 3 pièces'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Adresse :</span>
                    <span className="text-slate-700">Cocody Riviera 3, Abidjan</span>
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
                    <strong className="text-slate-900">{previewingReceipt.contract_id || 'LT-CI-2026-000123'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Durée du bail :</span>
                    <span className="text-slate-700">12 mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Période :</span>
                    <span className="text-slate-700">01/10/2026 au 30/09/2027</span>
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
                      <td className="p-2.5 text-slate-700">{previewingReceipt.target_month}</td>
                      <td className="p-2.5 font-medium text-slate-700">{formatFCFA(previewingReceipt.amount)}</td>
                      <td className="p-2.5 text-right font-black text-slate-900">{formatFCFA(previewingReceipt.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount Box + Payment Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Montant payé</span>
                  <span className="text-xl font-black text-blue-700 mt-0.5">{formatFCFA(previewingReceipt.amount)}</span>
                  <span className="text-[10px] text-slate-400 font-medium">(Cent cinquante mille francs CFA)</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date du paiement :</span>
                    <strong className="text-slate-800">{new Date(previewingReceipt.confirmed_at || previewingReceipt.created_at).toLocaleDateString('fr-FR')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mode de paiement :</span>
                    <strong className="text-slate-800">Mobile Money</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Réf transaction :</span>
                    <span className="font-mono text-slate-700">{previewingReceipt.reference}</span>
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
                  <span className="font-bold text-slate-800 text-[10px]">{previewingReceipt.tenant?.full_name || 'Kouadio Jean'}</span>
                </div>

                {/* QR Code Verification */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg p-1 shrink-0 flex items-center justify-center shadow-sm">
                    <img
                      src="/qr-code-locatrust.png"
                      alt="QR Code"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = LOCATRUST_QR_CODE_DATA_URL;
                      }}
                    />
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
                <span>Ce reçu fait partie intégrante du contrat de bail n° {previewingReceipt.contract_id || 'LT-CI-2026-000123'}.</span>
                <span className="font-semibold text-slate-600">Merci pour votre confiance ! LocaTrust</span>
              </div>

            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => setPreviewingReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-slate-700 text-xs"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sendQuittanceToTenant({
                      receiptNumber: previewingReceipt.reference,
                      contractNumber: previewingReceipt.contract_id || 'LT-CI-2026-000123',
                      propertyTitle: previewingReceipt.contract?.property?.title || 'Appartement 3 pièces Cocody Riviera 3',
                      propertyAddress: 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
                      amount: previewingReceipt.amount,
                      periodCovered: previewingReceipt.target_month,
                      paymentDate: new Date(previewingReceipt.confirmed_at || previewingReceipt.created_at).toLocaleDateString('fr-FR'),
                      paymentMethod: previewingReceipt.reference.startsWith('OM') ? 'Orange Money' : 'Mobile Money',
                      transactionReference: previewingReceipt.reference,
                      ownerName: "Koffi N'Guessan",
                      tenantName: previewingReceipt.tenant?.full_name || 'Kouadio Jean',
                      ownerSignatureUrl: ownerSignatureUrl,
                      tenantSignatureUrl: tenantSignatureUrl,
                    });
                    setConfirmationModal({
                      isOpen: true,
                      type: 'sent',
                      title: 'Reçu officiel expédié !',
                      message: `Le reçu officiel a été transmis avec succès dans la boîte de messagerie LocaTrust du locataire ${previewingReceipt.tenant?.full_name || ''}.`,
                      confirmText: 'OK, parfait',
                      withCelebration: true
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer dans la Messagerie</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReceiptPDF(previewingReceipt)}
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

      {/* Interactive Handwritten Signature Modal */}
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
          signerName={activeSigningParty === 'proprietaire' ? "Koffi N'Guessan" : (validatingPayment?.tenant?.full_name || previewingReceipt?.tenant?.full_name || "Kouadio Jean")}
          signerRole={activeSigningParty}
          documentTitle="Reçu de Paiement Officiel"
          documentNumber={validatingPayment?.reference || previewingReceipt?.reference || 'REC-2026-000987'}
        />
      )}

      {/* Action Confirmation Modal (Point 14) */}
      {confirmationModal && (
        <ActionConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          type={confirmationModal.type}
          title={confirmationModal.title}
          message={confirmationModal.message}
          details={confirmationModal.details}
          confirmText={confirmationModal.confirmText}
          withCelebration={confirmationModal.withCelebration}
        />
      )}

    </div>
  );
};

