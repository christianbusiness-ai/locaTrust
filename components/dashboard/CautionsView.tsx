'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Building2,
  Calendar,
  Sparkles,
  Download,
  RotateCcw,
  Check,
  X,
  BellRing,
  Send,
  Eye,
  PenTool,
  Upload,
  AlertCircle,
  Camera,
  Trash2,
  ZoomIn,
  UploadCloud,
  Image as ImageIcon
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { Deposit } from '@/types/database.types';
import confetti from 'canvas-confetti';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import {
  getStoredDeposits,
  saveStoredDeposits,
  confirmCautionReceipt,
  rejectCautionPayment,
  signCautionReceipt,
  sendCautionReceiptToTenant,
  signRestitutionReceipt,
  sendRestitutionReceiptToTenant,
  restituteCaution,
  declareCautionPayment,
  recordCautionAudit,
  getCautionAuditTrail
} from '@/lib/cautionsStore';
import { generateRestitutionReceiptPDF } from '@/lib/payments/restitutionReceiptPdfGenerator';
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge';
import { SignatureModal } from '@/components/common/SignatureModal';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { KpiGridSkeleton, TenantCardSkeleton } from '@/components/common/SkeletonLoader';

interface CautionsViewProps {
  isAgency?: boolean;
  userRole?: 'locataire' | 'proprietaire' | 'agence' | 'admin';
}

export const CautionsView: React.FC<CautionsViewProps> = ({ isAgency = false, userRole = 'proprietaire' }) => {
  const { user, profile } = useAuth();
  const [deposits, setDeposits] = useState<Deposit[]>(() => getStoredDeposits());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Determine active actor (Propriétaire ou Agence)
  const isActuallyAgency = isAgency || userRole === 'agence' || (typeof window !== 'undefined' && localStorage.getItem('locatrust_current_role') === 'agence');
  const isTenant = userRole === 'locataire';
  const actorName = isActuallyAgency 
    ? "Immobilière du Golf (Agence Agréée)" 
    : profile?.full_name || user?.user_metadata?.full_name 
    ? `${profile?.full_name || user?.user_metadata?.full_name} (Bailleur)` 
    : "Bailleur Propriétaire";

  // Restitution Modal State (3 modes demandés par l'utilisateur dans l'audio)
  const [depositToRestitute, setDepositToRestitute] = useState<Deposit | null>(null);
  const [restitutionMode, setRestitutionMode] = useState<'integrale' | 'partielle' | 'imputation_loyers'>('integrale');
  const [restitutionAmount, setRestitutionAmount] = useState<number>(0);
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>('');
  const [noticeMonthsCovered, setNoticeMonthsCovered] = useState<string>('2 mois de préavis (Octobre & Novembre 2026)');
  const [restitutionDate, setRestitutionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [restitutionMethod, setRestitutionMethod] = useState<string>('Wave CI');
  const [restitutionError, setRestitutionError] = useState<string | null>(null);

  // Étape 1 : Modal signalement locataire "J'ai payé ma caution"
  const [isDeclareCautionOpen, setIsDeclareCautionOpen] = useState(false);
  const [declareAmount, setDeclareAmount] = useState<number>(900000);
  const [declareMethod, setDeclareMethod] = useState<string>('Wave CI');
  const [declareReference, setDeclareReference] = useState<string>('WAVE-CI-98213904');
  const [declareComment, setDeclareComment] = useState<string>('Paiement de la caution effectué ce jour via Wave.');
  const [declareProofUrl, setDeclareProofUrl] = useState<string | null>(null);
  const [declareProofFileName, setDeclareProofFileName] = useState<string | null>(null);
  const [declareProofFileSize, setDeclareProofFileSize] = useState<string | null>(null);
  const [previewProofModalUrl, setPreviewProofModalUrl] = useState<string | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);

  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeclareProofFileName(file.name);
    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`;
    setDeclareProofFileSize(sizeStr);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setDeclareProofUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Étape 2 : Modal vérification preuve par le propriétaire
  const [proofToVerifyDeposit, setProofToVerifyDeposit] = useState<Deposit | null>(null);
  const [refusalReasonInput, setRefusalReasonInput] = useState<string>('');
  const [isRefusing, setIsRefusing] = useState(false);

  // Étape 4 & 5 : Modale avertissement signature obligatoire pour téléchargement
  const [signatureAlertDoc, setSignatureAlertDoc] = useState<{
    deposit: Deposit;
    type: 'caution' | 'restitution';
  } | null>(null);

  // Handwritten Signature Modal
  const [signatureModalConfig, setSignatureModalConfig] = useState<{
    isOpen: boolean;
    deposit: Deposit | null;
    type: 'caution' | 'restitution';
    role: 'proprietaire' | 'locataire';
  }>({
    isOpen: false,
    deposit: null,
    type: 'caution',
    role: 'proprietaire'
  });

  // Success Feedback
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const reloadDeposits = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('cautions')
        .select('*, property:properties(*), tenant:users!tenant_id(*)')
        .order('created_at', { ascending: false });

      if (user?.id) {
        query = query.eq('owner_id', user.id);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        setDeposits(data as any);
      } else {
        // Si base vide, purger tout ancien cache fictif et afficher 0 dossier
        const local = getStoredDeposits();
        setDeposits(local || []);
      }
    } catch (e) {
      console.warn('Sync cautions error:', e);
      setDeposits([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadDeposits();
    const handleCautionsUpdated = () => reloadDeposits();
    window.addEventListener('locatrust:cautions_updated', handleCautionsUpdated);
    return () => window.removeEventListener('locatrust:cautions_updated', handleCautionsUpdated);
  }, [user]);

  // Metrics
  const totalRequested = deposits.reduce((sum, d) => sum + d.amount_requested, 0);
  const totalCollected = deposits
    .filter((d) => d.status === 'paye_complet' || d.amount_paid > 0)
    .reduce((sum, d) => sum + d.amount_paid, 0);
  const totalPending = Math.max(0, totalRequested - totalCollected);

  // Pending verification notices
  const pendingConfirmationDeposits = deposits.filter((d) => d.status === 'caution_a_confirmer');

  // Handle Confirmation / Validation of Caution Reception (Étape 2)
  const handleConfirmCaution = (deposit: Deposit) => {
    // Automatically set owner signature if not already present
    const updated = confirmCautionReceipt(deposit.id, actorName);
    if (updated) {
      if (!updated.owner_signature) {
        signCautionReceipt(deposit.id, 'owner', 'SIG_OFFICIAL_OWNER_CERTIFIED');
      }
      reloadDeposits();
      setProofToVerifyDeposit(null);
      setSuccessFeedback(
        `✅ Caution de ${formatFCFA(deposit.amount_paid)} validée avec succès pour ${deposit.tenant?.full_name} ! Le Reçu Officiel N° REC-CAUT-${deposit.id.toUpperCase()} a été généré automatiquement avec QR Code.`
      );
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 }
      });
    }
  };

  // Handle Rejection of Caution (Étape 2)
  const handleRejectCaution = (deposit: Deposit) => {
    if (!refusalReasonInput.trim()) {
      alert('Veuillez préciser le motif du refus.');
      return;
    }
    rejectCautionPayment(deposit.id, refusalReasonInput);
    reloadDeposits();
    setProofToVerifyDeposit(null);
    setIsRefusing(false);
    setRefusalReasonInput('');
    setSuccessFeedback(
      `❌ Signalement de caution refusé pour ${deposit.tenant?.full_name}. Le locataire a été notifié du motif.`
    );
  };

  // Handle Send Receipt to Tenant Chat (Étape 5)
  const handleSendCautionReceipt = (deposit: Deposit) => {
    sendCautionReceiptToTenant(deposit.id);
    reloadDeposits();
    setSuccessFeedback(
      `📨 Reçu de caution envoyé avec succès dans la messagerie de ${deposit.tenant?.full_name} avec notification pour signature !`
    );
  };

  // Handle Send Restitution Receipt to Tenant Chat (Point 2 Étape 4)
  const handleSendRestitutionReceipt = (deposit: Deposit) => {
    sendRestitutionReceiptToTenant(deposit.id);
    reloadDeposits();
    setSuccessFeedback(
      `📨 Reçu de restitution envoyé avec succès dans la messagerie de ${deposit.tenant?.full_name} avec notification pour signature !`
    );
  };

  // Étape 1 : Soumission du signalement "J'ai payé ma caution" par le locataire
  const handleDeclareCautionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Si paiement en espèces, pas de référence obligatoire
    const isEspeces = declareMethod === 'Espèces';
    if (!isEspeces && !declareReference.trim()) {
      alert('Veuillez renseigner la référence de transaction Mobile Money ou bancaire.');
      return;
    }
    const targetContract = deposits[0]?.contract_id || 'LT-2026-CI-000492';
    const targetTenant = deposits[0]?.tenant?.id || 'usr_tenant_1';
    const targetName = deposits[0]?.tenant?.full_name || "Locataire";
    const autoRef = isEspeces ? `ESP-${Date.now()}` : declareReference;

    declareCautionPayment({
      contractId: targetContract,
      tenantId: targetTenant,
      tenantName: targetName,
      amount: Number(declareAmount),
      reference: autoRef,
      method: isEspeces ? 'Espèces' : declareMethod,
      proofUrl: isEspeces ? '' : (declareProofUrl || ''),
      comment: declareComment
    });

    reloadDeposits();
    setIsDeclareCautionOpen(false);
    setDeclareProofUrl(null);
    setDeclareProofFileName(null);
    setDeclareProofFileSize(null);
    setSuccessFeedback(
      "Le locataire a signalé le paiement de sa caution avec la preuve jointe. Une notification a été envoyée immédiatement au propriétaire."
    );
  };

  // Open Restitution Modal with the 3 choices (Point 2 Étape 2)
  const handleOpenRestitutionModal = (dep: Deposit) => {
    setDepositToRestitute(dep);
    if (dep.restitution_status === 'impute_loyers') {
      setRestitutionMode('imputation_loyers');
      setRestitutionAmount(0);
      setDeductionAmount(dep.amount_paid);
      setNoticeMonthsCovered(dep.deduction_reason || '2 mois de préavis');
    } else if (dep.restitution_status === 'restitue_partiel') {
      setRestitutionMode('partielle');
      const restituted = dep.amount_restituted ?? (dep.amount_paid - (dep.deduction_amount ?? 0));
      setRestitutionAmount(restituted);
      setDeductionAmount(dep.deduction_amount ?? (dep.amount_paid - restituted));
      setDeductionReason(dep.deduction_reason || '');
    } else {
      setRestitutionMode('integrale');
      setRestitutionAmount(dep.amount_paid);
      setDeductionAmount(0);
      setDeductionReason('');
    }
    setRestitutionDate(new Date().toISOString().split('T')[0]);
    setRestitutionMethod(dep.restitution_status === 'impute_loyers' ? 'Compensation sur loyers' : 'Wave CI');
    setRestitutionError(null);
  };

  // Confirm Restitution (Point 2 Étape 2: Bouton "Confirmer l'imputation" / restitution)
  const handleConfirmRestitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositToRestitute) return;

    if (restitutionMode === 'imputation_loyers') {
      if (!noticeMonthsCovered.trim()) {
        setRestitutionError('Veuillez préciser la période ou les mois de préavis compensés par la caution.');
        return;
      }
    } else if (restitutionMode === 'partielle') {
      if (deductionAmount <= 0) {
        setRestitutionError('Veuillez indiquer le montant de la retenue pour couper la caution.');
        return;
      }
      if (!deductionReason.trim()) {
        setRestitutionError('Veuillez préciser le motif obligatoire de la retenue sur caution.');
        return;
      }
      if (restitutionAmount + deductionAmount !== depositToRestitute.amount_paid) {
        setRestitutionError(
          `La somme du montant restitué (${formatFCFA(restitutionAmount)}) et de la retenue (${formatFCFA(
            deductionAmount
          )}) doit être égale à la caution encaissée (${formatFCFA(depositToRestitute.amount_paid)}).`
        );
        return;
      }
    }

    const finalAmountRestituted = restitutionMode === 'imputation_loyers' ? 0 : restitutionAmount;
    const finalDeductionAmount = restitutionMode === 'imputation_loyers' ? depositToRestitute.amount_paid : deductionAmount;
    const finalReason = restitutionMode === 'imputation_loyers'
      ? `Compensation intégrale des loyers de préavis : ${noticeMonthsCovered}. Aucun loyer à décaisser par le locataire.`
      : deductionReason;
    const finalMethod = restitutionMode === 'imputation_loyers' ? 'Compensation sur loyers' : restitutionMethod;

    const res = restituteCaution({
      depositId: depositToRestitute.id,
      restitutionMode: restitutionMode,
      amountRestituted: finalAmountRestituted,
      deductionAmount: finalDeductionAmount,
      deductionReason: finalReason,
      monthsCovered: noticeMonthsCovered,
      restitutionDate: restitutionDate,
      paymentMethod: finalMethod,
      confirmedBy: actorName
    });

    if (res) {
      // Auto-set owner signature for restitution
      signRestitutionReceipt(depositToRestitute.id, 'owner', 'SIG_RESTITUTION_OWNER_CERTIFIED');
      reloadDeposits();

      const tenantName = depositToRestitute.tenant?.full_name || 'Locataire';
      setDepositToRestitute(null);

      let msg = '';
      if (restitutionMode === 'imputation_loyers') {
        msg = `✅ Imputation confirmée pour ${tenantName} (${noticeMonthsCovered}) ! Le locataire est dispensé de paiement. Cliquez sur "Envoyer le reçu de restitution" pour lui transmettre l'attestation.`;
      } else if (restitutionMode === 'partielle') {
        msg = `✅ Restitution partielle confirmée pour ${tenantName} (Retenue: ${formatFCFA(deductionAmount)}). Cliquez sur "Envoyer le reçu de restitution" pour notifier le locataire.`;
      } else {
        msg = `✅ Restitution intégrale (100 %) validée pour ${tenantName} ! Cliquez sur "Envoyer le reçu de restitution" pour notifier le locataire.`;
      }

      setSuccessFeedback(msg);

      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 }
      });
    }
  };

  // Étape 4 & 5 : Téléchargement du reçu de caution avec DOUBLE SIGNATURE OBLIGATOIRE
  const handleDownloadCautionReceipt = async (dep: Deposit) => {
    // Vérification stricte des deux signatures
    const ownerSigned = Boolean(dep.owner_signature || dep.confirmed_by);
    const tenantSigned = Boolean(dep.tenant_signature);

    if (!ownerSigned || !tenantSigned) {
      setSignatureAlertDoc({ deposit: dep, type: 'caution' });
      return;
    }

    await generateOfficialReceiptPDF({
      receiptNumber: `CAUT-${dep.id.toUpperCase()}`,
      contractNumber: dep.contract_id,
      contractToken: `tok_cnt_${dep.id}`,
      propertyTitle: dep.property?.title || 'Bien immobilier',
      propertyAddress: 'Cocody Riviera, Abidjan - Côte d\'Ivoire',
      propertyReference: 'BIEN-000456',
      propertyType: dep.property?.type || 'appartement',
      durationMonths: 12,
      leaseStartDate: '01/01/2026',
      leaseEndDate: '31/12/2026',
      ownerName: actorName,
      ownerCni: 'CI987654321',
      ownerPhone: '+225 07 08 09 10 11',
      tenantName: dep.tenant?.full_name || 'Locataire',
      tenantCni: 'CI123456789',
      tenantPhone: dep.tenant?.phone || '+225 05 00 00 00 00',
      amount: dep.amount_paid,
      periodCovered: 'Dépôt de Garantie Contractuel (Loi 2019-576)',
      paymentDate: new Date(dep.created_at).toLocaleDateString('fr-FR'),
      paymentMethod: 'Virement / Mobile Money',
      transactionReference: `TR-CAUT-${dep.id.toUpperCase()}`,
      ownerSignatureUrl: dep.owner_signature || 'SIG_OWNER',
      tenantSignatureUrl: dep.tenant_signature || 'SIG_TENANT'
    });
  };

  // Point 2 Étape 5 : Téléchargement du reçu de restitution avec DOUBLE SIGNATURE OBLIGATOIRE
  const handleDownloadRestitutionReceipt = async (dep: Deposit) => {
    const ownerSigned = Boolean(dep.restitution_owner_signature || dep.confirmed_by);
    const tenantSigned = Boolean(dep.restitution_tenant_signature);

    if (!ownerSigned || !tenantSigned) {
      setSignatureAlertDoc({ deposit: dep, type: 'restitution' });
      return;
    }

    const isImp = dep.restitution_status === 'impute_loyers';
    const receiptNum = isImp ? `IMP-2026-${Math.floor(100000 + Math.random() * 900000)}` : `RRC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    await generateRestitutionReceiptPDF({
      receiptNumber: receiptNum,
      contractNumber: dep.contract_id,
      propertyTitle: dep.property?.title || 'Logement LocaTrust',
      propertyAddress: dep.property?.description || 'Cocody Riviera, Abidjan',
      ownerName: actorName,
      ownerPhone: '+225 07 48 92 11 00',
      tenantName: dep.tenant?.full_name || 'Locataire',
      tenantPhone: dep.tenant?.phone || '+225 07 08 09 10 11',
      initialCautionAmount: dep.amount_paid,
      amountRestituted: isImp ? 0 : (dep.amount_restituted ?? dep.amount_paid),
      deductionAmount: isImp ? dep.amount_paid : (dep.deduction_amount ?? 0),
      deductionReason: dep.deduction_reason || '',
      restitutionDate: dep.restituted_at ? new Date(dep.restituted_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
      paymentMethod: isImp ? 'Compensation sur loyers' : 'Wave CI',
      transactionReference: `TXN-${receiptNum}`,
      ownerSignatureUrl: dep.restitution_owner_signature || 'SIG_OWNER',
      tenantSignatureUrl: dep.restitution_tenant_signature || 'SIG_TENANT'
    });
  };

  // Callback de confirmation de signature depuis SignatureModal
  const handleSignatureModalConfirm = (signatureData: string) => {
    if (!signatureModalConfig.deposit) return;
    const dep = signatureModalConfig.deposit;

    if (signatureModalConfig.type === 'caution') {
      signCautionReceipt(dep.id, signatureModalConfig.role === 'proprietaire' ? 'owner' : 'tenant', signatureData);
    } else {
      signRestitutionReceipt(dep.id, signatureModalConfig.role === 'proprietaire' ? 'owner' : 'tenant', signatureData);
    }

    reloadDeposits();
    setSignatureModalConfig(prev => ({ ...prev, isOpen: false }));
    setSignatureAlertDoc(null);
    setSuccessFeedback("Signature apposée et enregistrée avec succès sur le document certifié !");
  };

  const filteredDeposits = deposits.filter((d) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const matchTenant = (d.tenant?.full_name || '').toLowerCase().includes(q);
    const matchProperty = (d.property?.title || '').toLowerCase().includes(q);
    const matchContract = (d.contract_id || '').toLowerCase().includes(q);
    const matchRef = (d.declared_reference || '').toLowerCase().includes(q);
    const matchAmount = String(d.amount_requested || d.amount_paid || '').includes(q);
    return matchTenant || matchProperty || matchContract || matchRef || matchAmount;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Header Banner - LocaTrust Colors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Gestion des Cautions & Dépôts de Garantie
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-extrabold border border-blue-200 dark:border-blue-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Garanties certifiées
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Signalement locataire, vérification des preuves, signature obligatoire et restitution sécurisée.
          </p>
        </div>

        {/* Bouton Locataire : J'ai payé ma caution (exclusivement Espace Locataire) & Recherche */}
        <div className="flex items-center gap-3">
          {isTenant && (
            <button
              type="button"
              onClick={() => setIsDeclareCautionOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 whitespace-nowrap active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>J'ai payé ma caution</span>
            </button>
          )}

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher locataire, bien..."
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Point 1 Étape 1 & 2 : Bannière d'alerte pour signalement locataire avec bouton Ouvrir la preuve */}
      {pendingConfirmationDeposits.length > 0 && (
        <div className="flex flex-col gap-3">
          {pendingConfirmationDeposits.map((dep) => (
            <div
              key={dep.id}
              className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scaleUp"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center justify-center shrink-0">
                  <BellRing className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                      Le locataire a signalé le paiement de sa caution
                    </span>
                    <PaymentStatusBadge status="caution_a_confirmer" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    <strong>{dep.tenant?.full_name}</strong> a soumis une preuve pour le versement de{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">{formatFCFA(dep.amount_paid)}</strong>.
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Contrat N° {dep.contract_id} • Réf : {dep.declared_reference || 'Mobile Money'}
                  </span>
                </div>
              </div>

              {/* Bouton Étape 2 : Ouvrir la preuve envoyée et vérifier */}
              <button
                type="button"
                onClick={() => setProofToVerifyDeposit(dep)}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap active:scale-95"
              >
                <Eye className="w-4 h-4" />
                <span>Vérifier la preuve & Valider</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <KpiGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Exigé */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Montant total exigé</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-2">{formatFCFA(totalRequested)}</span>
            <span className="text-[11px] text-slate-400 mt-1">Totalité des contrats actifs</span>
          </div>

          {/* Cautions Encaissées */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Cautions encaissées</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-emerald-600 mt-2">{formatFCFA(totalCollected)}</span>
            <span className="text-[11px] text-slate-400 mt-1">Fonds conservés en garantie</span>
          </div>

          {/* Solde en attente */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Solde de caution en attente</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-amber-600 mt-2">{formatFCFA(totalPending)}</span>
            <span className="text-[11px] text-slate-400 mt-1">Versements à confirmer / restants</span>
          </div>
        </div>
      )}

      {/* LISTE DES DOSSIERS DE CAUTION (Cartes épurées, modernes et réactives) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Dossiers de caution actifs
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
              {filteredDeposits.length} dossier{filteredDeposits.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <TenantCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-2">
            <ShieldCheck className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Aucun dossier de caution trouvé</p>
            <span className="text-xs text-slate-400">Modifiez vos critères de recherche</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredDeposits.map((dep) => {
              const isRestituted = Boolean(
                dep.restituted_at ||
                dep.restitution_status === 'restitue_total' ||
                dep.restitution_status === 'restitue_partiel' ||
                dep.restitution_status === 'impute_loyers'
              );
              const isImputed = dep.restitution_status === 'impute_loyers';
              const isPartialRestitution = dep.restitution_status === 'restitue_partiel';
              const isFullRestitution = dep.restitution_status === 'restitue_total';
              const isAwaitingVerification = dep.status === 'caution_a_confirmer';
              const ownerSigned = Boolean(dep.owner_signature || dep.confirmed_by);
              const tenantSigned = Boolean(isRestituted ? dep.restitution_tenant_signature : dep.tenant_signature);

              return (
                <div
                  key={dep.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* LIGNE PRINCIPALE HORIZONTALE */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-0">

                    {/* COL 1 : LOCATAIRE + BIEN + STATUT */}
                    <div className="flex items-center gap-3 p-4 lg:w-[280px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                          {dep.tenant?.full_name || 'Locataire'}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {dep.property?.title || 'Bien immobilier'}
                        </span>
                        <span className="text-[10px] text-blue-500 font-mono truncate">Contrat : {dep.contract_id}</span>
                      </div>
                    </div>

                    {/* COL 2 : MONTANTS */}
                    <div className="flex items-center gap-4 px-4 py-3 lg:w-[200px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Exigée</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{formatFCFA(dep.amount_requested)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Payée</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{formatFCFA(dep.amount_paid)}</span>
                      </div>
                      {isRestituted && (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{isImputed ? 'Imputée' : 'Restituée'}</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400 text-xs">
                            {isImputed ? formatFCFA(dep.amount_paid) : formatFCFA(dep.amount_restituted || dep.amount_paid)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* COL 3 : STATUT + SIGNATURES */}
                    <div className="flex flex-col gap-1.5 px-4 py-3 flex-1 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                      {/* Badge statut */}
                      <div>
                        {isAwaitingVerification ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-700 animate-pulse" />
                            Preuve à vérifier
                          </span>
                        ) : isImputed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 text-[10px] font-black border border-purple-300">
                            <ShieldCheck className="w-3 h-3 text-purple-700" />
                            Imputée préavis
                          </span>
                        ) : isPartialRestitution ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                            <RotateCcw className="w-3 h-3 text-amber-700" />
                            Restitution partielle
                          </span>
                        ) : isFullRestitution ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-black border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Restituée 100%
                          </span>
                        ) : dep.amount_paid >= dep.amount_requested ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-black border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Caution encaissée
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-black border border-slate-300">
                            <Clock className="w-3 h-3 text-slate-500" />
                            En attente
                          </span>
                        )}
                      </div>
                      {/* Signatures inline */}
                      <div className="flex items-center gap-3 text-[10px] font-semibold">
                        <span className={ownerSigned ? 'text-emerald-600' : 'text-amber-600'}>
                          {ownerSigned ? '✅' : '⏳'} Bailleur
                        </span>
                        <span className={tenantSigned ? 'text-emerald-600' : 'text-amber-600'}>
                          {tenantSigned ? '✅' : '⏳'} Locataire
                        </span>
                        {!ownerSigned || !tenantSigned ? (
                          <span className="text-amber-600 italic">— téléchargement bloqué</span>
                        ) : (
                          <span className="text-emerald-600 italic">— téléchargement autorisé</span>
                        )}
                      </div>
                    </div>

                    {/* COL 4 : ACTIONS (en ligne, même hauteur, alignées) */}
                    <div className="flex flex-row flex-wrap items-center gap-2 px-4 py-3 lg:w-auto lg:shrink-0">
                      {/* Vérifier & Valider */}
                      {isAwaitingVerification && (
                        <button
                          type="button"
                          onClick={() => setProofToVerifyDeposit(dep)}
                          className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-sm flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Vérifier & Valider</span>
                        </button>
                      )}

                      {/* Restituer la caution — désactivé si déjà restitué */}
                      {!isRestituted && dep.amount_paid > 0 && !isAwaitingVerification ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDepositToRestitute(dep);
                            setRestitutionMode('integrale');
                            setRestitutionAmount(dep.amount_paid);
                            setDeductionAmount(0);
                            setDeductionReason('');
                            setNoticeMonthsCovered('2 mois de préavis (Octobre & Novembre 2026)');
                            setRestitutionError(null);
                          }}
                          className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-extrabold text-[11px] shadow-sm flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Restituer</span>
                        </button>
                      ) : isRestituted ? (
                        <span className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-bold text-[11px] flex items-center gap-1.5 cursor-not-allowed border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Restitution terminée</span>
                        </span>
                      ) : null}

                      {/* Télécharger le reçu */}
                      {isRestituted ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadRestitutionReceipt(dep)}
                          className="h-8 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-extrabold text-[11px] border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Reçu Restitution</span>
                        </button>
                      ) : dep.amount_paid > 0 && !isAwaitingVerification ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadCautionReceipt(dep)}
                          className="h-8 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-extrabold text-[11px] border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Reçu Caution</span>
                        </button>
                      ) : null}

                      {/* Envoyer le reçu */}
                      {dep.amount_paid > 0 && !isAwaitingVerification && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isRestituted) {
                              handleSendRestitutionReceipt(dep);
                            } else {
                              handleSendCautionReceipt(dep);
                            }
                          }}
                          className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-[11px] flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                          title="Transmettre le reçu certifié dans la messagerie du locataire"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Envoyer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ÉTAPE 2 : MODAL VÉRIFICATION DE LA PREUVE DE CAUTION PAR LE PROPRIÉTAIRE */}
      {proofToVerifyDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-5 animate-scaleUp max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Vérification du versement de caution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Contrôle des informations et de la preuve avant validation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProofToVerifyDeposit(null);
                  setIsRefusing(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Détails du versement */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Locataire :</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{proofToVerifyDeposit.tenant?.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Bien loué :</span>
                <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{proofToVerifyDeposit.property?.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Montant déclaré :</span>
                <span className="text-base font-black text-emerald-600">{formatFCFA(proofToVerifyDeposit.amount_paid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Référence transaction :</span>
                <span className="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  {proofToVerifyDeposit.declared_reference || 'WAVE-CI-98213904'}
                </span>
              </div>
              {proofToVerifyDeposit.comment && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-1">
                  <span className="text-slate-500 font-semibold">Commentaire du locataire :</span>
                  <p className="italic text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    "{proofToVerifyDeposit.comment}"
                  </p>
                </div>
              )}
            </div>

            {/* Aperçu de la preuve envoyée (photo / capture d'écran) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Preuve fournie par le locataire (Capture d'écran / Reçu Mobile Money) :</span>
              </span>
              <div
                onClick={() => setPreviewProofModalUrl(proofToVerifyDeposit.proof_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80')}
                className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 max-h-56 relative group cursor-pointer"
                title="Cliquer pour agrandir la preuve"
              >
                <img
                  src={proofToVerifyDeposit.proof_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80'}
                  alt="Preuve de caution"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <ZoomIn className="w-6 h-6 drop-shadow" />
                </div>
                <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Document joint (Cliquer pour zoom)</span>
                </div>
              </div>
            </div>

            {/* Zone de refus avec motif si isRefusing est actif */}
            {isRefusing ? (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex flex-col gap-2.5 animate-fadeIn">
                <label className="text-xs font-extrabold text-rose-900 dark:text-rose-200 block">
                  Précisez le motif du refus (obligatoire) :
                </label>
                <textarea
                  value={refusalReasonInput}
                  onChange={(e) => setRefusalReasonInput(e.target.value)}
                  placeholder="Ex : Référence introuvable sur le relevé Wave, montant incomplet, capture illisible..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-rose-300 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 bg-white"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRefusing(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectCaution(proofToVerifyDeposit)}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Confirmer le refus</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Boutons Étape 2 : Valider la caution OU Refuser */
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRefusing(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>❌ Refuser</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmCaution(proofToVerifyDeposit)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✅ Valider la caution</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÉTAPE 1 : MODAL SIGNALEMENT LOCATAIRE "J'AI PAYÉ MA CAUTION" */}
      {isDeclareCautionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    J'ai payé ma caution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Signaler votre versement au propriétaire
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeclareCautionOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclareCautionSubmit} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Montant versé (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={declareAmount}
                    onChange={(e) => setDeclareAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Moyen de paiement *
                  </label>
                  <select
                    value={declareMethod}
                    onChange={(e) => { setDeclareMethod(e.target.value); if (e.target.value === 'Espèces') setDeclareReference(''); }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                  >
                    <option value="Wave CI">Wave CI</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN Mobile Money">MTN MoMo</option>
                    <option value="Moov Money">Moov Money</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">💵 Espèces (cash)</option>
                  </select>
                </div>
              </div>

              {/* Référence — masquée si Espèces */}
              {declareMethod !== 'Espèces' ? (
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Référence transaction *
                  </label>
                  <input
                    type="text"
                    value={declareReference}
                    onChange={(e) => setDeclareReference(e.target.value)}
                    placeholder="Ex : WAVE-CI-98213904, OM-CI-81923..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                    required={declareMethod !== 'Espèces'}
                  />
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
                  💵 Paiement en espèces — aucune référence de transaction requise.
                </div>
              )}

              {/* Preuve — masquée si Espèces */}
              {declareMethod !== 'Espèces' && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Capture d'écran / Photo du reçu Mobile Money *
                  </label>

                  <input
                    type="file"
                    ref={proofFileInputRef}
                    accept="image/*,application/pdf"
                    onChange={handleProofFileSelect}
                    className="hidden"
                  />

                  {declareProofUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <div
                        onClick={() => setPreviewProofModalUrl(declareProofUrl)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 cursor-pointer group shrink-0"
                        title="Cliquer pour agrandir la preuve"
                      >
                        <img
                          src={declareProofUrl}
                          alt="Aperçu du reçu"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {declareProofFileName || 'Reçu_caution_mobile.jpg'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {declareProofFileSize ? `${declareProofFileSize} • ` : ''}Fichier prêt à l'envoi
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Preuve enregistrée
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition"
                        >
                          Changer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeclareProofUrl(null);
                            setDeclareProofFileName(null);
                            setDeclareProofFileSize(null);
                            if (proofFileInputRef.current) proofFileInputRef.current.value = '';
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition flex items-center justify-center"
                          title="Supprimer la preuve"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => proofFileInputRef.current?.click()}
                      className="border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 rounded-2xl p-5 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-blue-900 dark:text-blue-300 text-xs">
                          Cliquez pour téléverser votre capture d'écran / reçu
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Prend en charge JPG, PNG, PDF ou capture caméra mobile
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mt-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1.5 pointer-events-none"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Sélectionner une photo / fichier</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Commentaire à l'attention du bailleur (facultatif)
                </label>
                <textarea
                  value={declareComment}
                  onChange={(e) => setDeclareComment(e.target.value)}
                  placeholder="Ex : Bonjour, versement effectué ce matin par Orange Money. Merci de valider."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsDeclareCautionOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer le signalement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÉTAPE 4 : MODAL AVERTISSEMENT DOUBLE SIGNATURE OBLIGATOIRE POUR TÉLÉCHARGEMENT */}
      {signatureAlertDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Signature bilatérale obligatoire
                </h3>
                <p className="text-xs text-amber-700 font-bold">
                  {signatureAlertDoc.type === 'caution'
                    ? "Le reçu ne peut être téléchargé qu'après signature des deux parties."
                    : "Le reçu de restitution ne peut être téléchargé qu'après signature des deux parties."}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">Signature Propriétaire / Bailleur :</span>
                {signatureAlertDoc.deposit.owner_signature || signatureAlertDoc.deposit.confirmed_by ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>✅ Signé</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSignatureModalConfig({
                        isOpen: true,
                        deposit: signatureAlertDoc.deposit,
                        type: signatureAlertDoc.type,
                        role: 'proprietaire'
                      });
                    }}
                    className="px-3 py-1 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs"
                  >
                    <PenTool className="w-3 h-3" />
                    <span>Signer</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">Signature Locataire ({signatureAlertDoc.deposit.tenant?.full_name}) :</span>
                {signatureAlertDoc.type === 'caution' ? (
                  signatureAlertDoc.deposit.tenant_signature ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>✅ Signé</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 dark:text-amber-400 font-extrabold text-[11px] bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200">
                        ⏳ En attente de signature
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleSendCautionReceipt(signatureAlertDoc.deposit);
                          setSignatureAlertDoc(null);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>Relancer</span>
                      </button>
                    </div>
                  )
                ) : (
                  signatureAlertDoc.deposit.restitution_tenant_signature ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>✅ Signé</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 dark:text-amber-400 font-extrabold text-[11px] bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200">
                        ⏳ En attente de signature
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleSendRestitutionReceipt(signatureAlertDoc.deposit);
                          setSignatureAlertDoc(null);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>Relancer</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setSignatureAlertDoc(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SIGNATURE MANUSCRITE NUMÉRIQUE */}
      {signatureModalConfig.isOpen && signatureModalConfig.deposit && (
        <SignatureModal
          isOpen={true}
          onClose={() => setSignatureModalConfig(prev => ({ ...prev, isOpen: false }))}
          onConfirmSignature={handleSignatureModalConfirm}
          signerName={signatureModalConfig.role === 'proprietaire' ? actorName : (signatureModalConfig.deposit.tenant?.full_name || 'Locataire')}
          signerRole={signatureModalConfig.role}
          documentTitle={signatureModalConfig.type === 'caution' ? "Reçu Officiel de Caution" : "Reçu de Restitution de Caution"}
          documentNumber={signatureModalConfig.deposit.contract_id}
        />
      )}

      {/* MODALE OFFICIELLE DE RESTITUTION DE CAUTION (Point 1 & 2 du prompt) */}
      {depositToRestitute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-5 animate-scaleUp max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Restituer la caution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Clôture et remboursement du dépôt de garantie
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDepositToRestitute(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informations du dossier */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block font-semibold uppercase">Locataire</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {depositToRestitute.tenant?.full_name}
                </span>
                <span className="text-[11px] text-slate-500 block">{depositToRestitute.tenant?.phone}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-semibold uppercase">Bien concerné</span>
                <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                  {depositToRestitute.property?.title}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Contrat : {depositToRestitute.contract_id}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Caution actuellement détenue :
                </span>
                <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                  {formatFCFA(depositToRestitute.amount_paid)}
                </span>
              </div>
            </div>

            {/* Formulaire de restitution */}
            <form onSubmit={handleConfirmRestitution} className="flex flex-col gap-4 text-xs">
              {restitutionError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold">
                  {restitutionError}
                </div>
              )}

              {/* CHOIX DU TYPE D'OPÉRATION (3 MODES DEMANDÉS DANS L'AUDIO) */}
              <div className="flex flex-col gap-2">
                <label className="font-extrabold text-slate-800 dark:text-slate-200 block text-xs">
                  Option de traitement de la caution *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Mode 1: Restitution intégrale */}
                  <button
                    type="button"
                    onClick={() => {
                      setRestitutionMode('integrale');
                      setRestitutionAmount(depositToRestitute.amount_paid);
                      setDeductionAmount(0);
                      setDeductionReason('');
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer ${
                      restitutionMode === 'integrale'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 dark:text-white">100 % Intégrale</span>
                      <CheckCircle2 className={`w-4 h-4 ${restitutionMode === 'integrale' ? 'text-emerald-600' : 'text-slate-300'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Remboursement total (état des lieux conforme, 0 retenue).
                    </p>
                  </button>

                  {/* Mode 2: Couper la caution (Restitution partielle) */}
                  <button
                    type="button"
                    onClick={() => {
                      setRestitutionMode('partielle');
                      if (deductionAmount === 0) {
                        const defaultCut = Math.round(depositToRestitute.amount_paid * 0.2);
                        setDeductionAmount(defaultCut);
                        setRestitutionAmount(depositToRestitute.amount_paid - defaultCut);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer ${
                      restitutionMode === 'partielle'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 dark:text-white">Couper la caution</span>
                      <CheckCircle2 className={`w-4 h-4 ${restitutionMode === 'partielle' ? 'text-amber-600' : 'text-slate-300'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Retenue avec motif (dégradations, peintures, impayés).
                    </p>
                  </button>

                  {/* Mode 3: Imputation sur les loyers de préavis */}
                  <button
                    type="button"
                    onClick={() => {
                      setRestitutionMode('imputation_loyers');
                      setRestitutionAmount(0);
                      setDeductionAmount(depositToRestitute.amount_paid);
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer ${
                      restitutionMode === 'imputation_loyers'
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 dark:text-white">Loyers de préavis</span>
                      <CheckCircle2 className={`w-4 h-4 ${restitutionMode === 'imputation_loyers' ? 'text-purple-600' : 'text-slate-300'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Caution conservée, locataire dispensé de loyers en fin de bail.
                    </p>
                  </button>
                </div>
              </div>

              {/* DÉTAILS SPÉCIFIQUES AU MODE SÉLECTIONNÉ */}
              {restitutionMode === 'integrale' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-900 dark:text-emerald-300 text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Restitution intégrale sans déduction</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                    Le locataire recevra la totalité de sa caution soit <strong>{formatFCFA(depositToRestitute.amount_paid)}</strong>. Aucune retenue n'est appliquée.
                  </p>
                </div>
              )}

              {restitutionMode === 'partielle' && (
                <div className="flex flex-col gap-3 animate-fadeIn p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                        Montant retenu / coupé (FCFA) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={depositToRestitute.amount_paid}
                        value={deductionAmount}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(depositToRestitute.amount_paid, Number(e.target.value)));
                          setDeductionAmount(val);
                          setRestitutionAmount(depositToRestitute.amount_paid - val);
                        }}
                        className="w-full p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                        Montant net restitué (FCFA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={depositToRestitute.amount_paid}
                        value={restitutionAmount}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(depositToRestitute.amount_paid, Number(e.target.value)));
                          setRestitutionAmount(val);
                          setDeductionAmount(depositToRestitute.amount_paid - val);
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Motif obligatoire de coupure / retenue */}
                  <div>
                    <label className="font-bold text-amber-900 dark:text-amber-300 block mb-1">
                      Motif obligatoire pour couper la caution *
                    </label>
                    <textarea
                      value={deductionReason}
                      onChange={(e) => setDeductionReason(e.target.value)}
                      placeholder="Ex: Réfection peinture salon (80 000 F), remplacement serrure (30 000 F) et régularisation facture SODECI (40 000 F)..."
                      rows={2}
                      className="w-full p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>
              )}

              {restitutionMode === 'imputation_loyers' && (
                <div className="flex flex-col gap-3 animate-fadeIn p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 text-purple-950 dark:text-purple-200">
                  <div className="flex items-center gap-2 font-black text-xs text-purple-900 dark:text-purple-300">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Compensation des loyers durant le préavis</span>
                  </div>
                  <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                    Le locataire reste dans le logement jusqu'à la fin de son bail et est <strong>dispensé de payer les loyers</strong>. La caution de <strong>{formatFCFA(depositToRestitute.amount_paid)}</strong> est conservée pour solder directement ces échéances.
                  </p>

                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Mois de loyer couverts par la caution *
                    </label>
                    <input
                      type="text"
                      value={noticeMonthsCovered}
                      onChange={(e) => setNoticeMonthsCovered(e.target.value)}
                      placeholder="Ex: 2 mois de préavis (Octobre & Novembre 2026)"
                      className="w-full p-2.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Date & Moyen de règlement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Date de l'opération *
                  </label>
                  <input
                    type="date"
                    value={restitutionDate}
                    onChange={(e) => setRestitutionDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    {restitutionMode === 'imputation_loyers' ? 'Mode d\'imputation' : 'Canal de remboursement'}
                  </label>
                  {restitutionMode === 'imputation_loyers' ? (
                    <input
                      type="text"
                      disabled
                      value="Compensation sur loyers de préavis"
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-700 font-bold text-xs"
                    />
                  ) : (
                    <select
                      value={restitutionMethod}
                      onChange={(e) => setRestitutionMethod(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs"
                    >
                      <option value="Wave CI">Wave CI</option>
                      <option value="Orange Money">Orange Money</option>
                      <option value="MTN MoMo">MTN MoMo</option>
                      <option value="Moov Money">Moov Money</option>
                      <option value="Virement Bancaire">Virement Bancaire</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Espèces contre reçu">Espèces contre décharge</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Résumé net */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white block text-xs">
                    {restitutionMode === 'imputation_loyers'
                      ? 'Loyer restant à payer par le locataire pendant le préavis'
                      : 'Montant net reversé au locataire'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {restitutionMode === 'imputation_loyers'
                      ? 'Exonération totale des paiements pendant les mois spécifiés'
                      : `Attestation N° RRC-2026-XXXX générée avec QR code`}
                  </span>
                </div>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {restitutionMode === 'imputation_loyers' ? '0 FCFA (Dispensé)' : formatFCFA(restitutionAmount)}
                </span>
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDepositToRestitute(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {restitutionMode === 'imputation_loyers'
                      ? 'Confirmer l\'imputation sur loyers'
                      : 'Confirmer la restitution'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZOOM / LIGHTBOX PREUVE DE PAIEMENT */}
      {previewProofModalUrl && (
        <div
          onClick={() => setPreviewProofModalUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-4 border border-slate-700 shadow-2xl flex flex-col gap-3 animate-scaleUp"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Aperçu de la preuve de paiement</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewProofModalUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-2">
              <img
                src={previewProofModalUrl}
                alt="Preuve agrandie"
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL (Point 33) */}
      {successFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl flex flex-col items-center text-center gap-3 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Opération réussie</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{successFeedback}</p>
            <button
              type="button"
              onClick={() => setSuccessFeedback(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
