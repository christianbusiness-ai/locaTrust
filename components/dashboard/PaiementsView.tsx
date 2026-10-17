'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Download,
  AlertCircle,
  AlertTriangle,
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
  PenTool,
  Banknote,
  Lock
} from 'lucide-react';
import { formatFCFA, sanitizeNumericInput } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { RentPayment } from '@/types/database.types';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import {
  MonthlyScheduleItem,
  processChronologicalRentPayment,
  AllocationResult
} from '@/lib/payments/rentScheduleEngine';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import { sendQuittanceToTenant } from '@/lib/messagingStore';
import { ActionConfirmationModal, ConfirmationType } from '@/components/common/ActionConfirmationModal';
import { TableRowsSkeleton, KpiGridSkeleton } from '@/components/common/SkeletonLoader';
import { RentScheduleCalendar } from '@/components/common/RentScheduleCalendar';
import { resolveRealReceiptData } from '@/lib/payments/receiptDataResolver';

interface PaiementsViewProps {
  onOpenConfirmPaymentModal?: () => void;
}

export const PaiementsView: React.FC<PaiementsViewProps> = ({
  onOpenConfirmPaymentModal,
}) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Rent Schedule State for the active tenant
  const [rentSchedule, setRentSchedule] = useState<MonthlyScheduleItem[]>([]);
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

  const loadPayments = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('rent_payments')
        .select('*, contract:contracts(*, property:properties(*)), tenant:users!tenant_id(*)')
        .order('payment_date', { ascending: false });

      let loaded: RentPayment[] = [];
      if (!error && data && data.length > 0) {
        loaded = data;
      } else {
        const { data: simpleData } = await supabase
          .from('rent_payments')
          .select('*')
          .order('payment_date', { ascending: false });

        if (simpleData && simpleData.length > 0) {
          loaded = simpleData;
        }
      }

      // Toujours fusionner avec les déclarations locales pour disponibilité immédiate
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_rent_payments');
        if (cached) {
          try {
            const localList: RentPayment[] = JSON.parse(cached);
            if (Array.isArray(localList)) {
              for (const loc of localList) {
                if (!loaded.some(p => p.id === loc.id || (loc.reference && p.reference === loc.reference))) {
                  loaded.unshift(loc);
                }
              }
            }
          } catch {}
        }
      }

      setPayments(loaded);
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_rent_payments');
        if (cached) {
          try { setPayments(JSON.parse(cached)); } catch {}
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();

    const handleUpdate = () => {
      loadPayments();
    };

    window.addEventListener('locatrust:payments-updated', handleUpdate);
    window.addEventListener('locatrust:notifications-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:notifications-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user]);

  const [activeTab, setActiveTab] = useState<'tous' | 'declares' | 'confirmes' | 'refuses'>('tous');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  // Handle Chronological Payment Simulation (Prompts 8, 9, 10, 13, 14, 15)
  const handleSimulateChronologicalPayment = (amountToPay: number) => {
    const result = processChronologicalRentPayment(
      rentSchedule,
      amountToPay,
      customSimMethod,
      `OM-CI-${Math.floor(100000 + Math.random() * 900000)}`,
      user?.user_metadata?.full_name || 'Bailleur',
      'LT-2026-CI-000492',
      'Appartement 3 pièces Cocody Riviera 3'
    );

    setRentSchedule(result.updatedSchedule);
    setLastAllocationResult(result);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });

    // Add new payment entry to history with exact periods covered text
    const newPmt: RentPayment = {
      id: `pmt_${Date.now()}`,
      contract_id: payments[0]?.contract_id || 'LT-CONTRAT-01',
      tenant_id: payments[0]?.tenant_id || 'usr_tenant',
      owner_id: user?.id || 'usr_owner',
      target_month: result.generatedReceipt.periods_covered_text,
      amount: amountToPay,
      payment_date: new Date().toISOString().split('T')[0],
      reference: result.generatedReceipt.reference,
      status: 'confirme',
      created_at: new Date().toISOString(),
      tenant: {
        id: payments[0]?.tenant_id || 'usr_tenant',
        role: 'locataire',
        full_name: payments[0]?.tenant?.full_name || 'Locataire',
        email: payments[0]?.tenant?.email || 'locataire@locatrust.ci',
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
    setRentSchedule([]);
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
    if (pmt.status === 'confirme') {
      alert('Ce paiement a déjà été vérifié et validé.');
      return;
    }
    const rawRef = pmt.reference || '';
    const isEsp = rawRef.startsWith('ESP') || (pmt as any).payment_method === 'Espèces' || (pmt as any).method === 'Espèces';
    const sampleRef = rawRef || (isEsp ? `ESP-${Date.now().toString().slice(-6)}` : `OM-CI-${Math.floor(100000 + Math.random() * 900000)}`);
    const resolvedMethod = isEsp
      ? 'Espèces'
      : (pmt as any).payment_method || (pmt as any).method || (sampleRef.startsWith('OM') ? 'Orange Money CI' : sampleRef.startsWith('WAVE') ? 'Wave Mobile Money' : sampleRef.startsWith('MTN') ? 'MTN Mobile Money' : 'Mobile Money');

    setExtractedOcrData({
      reference: sampleRef,
      amount: Number(pmt.amount || 0),
      payment_method: resolvedMethod,
      sender_phone: pmt.tenant?.phone || '+225 07 08 09 10 11',
      detected_month: pmt.target_month || 'Mois en cours',
    });
    setValidatingPayment(pmt);
  };

  const [isSubmittingValidation, setIsSubmittingValidation] = useState<boolean>(false);

  const handleFinalizeValidation = async () => {
    if (!validatingPayment || !extractedOcrData) return;
    if (validatingPayment.status === 'confirme') {
      alert('Ce paiement a déjà été vérifié et validé.');
      setValidatingPayment(null);
      setExtractedOcrData(null);
      return;
    }

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

    setIsSubmittingValidation(true);

    try {
      // 1. Process chronological allocation in background
      let result: any = null;
      try {
        result = processChronologicalRentPayment(
          rentSchedule,
          extractedOcrData.amount,
          extractedOcrData.payment_method,
          extractedOcrData.reference,
          validatingPayment.tenant?.full_name || user?.user_metadata?.full_name || 'Bailleur',
          validatingPayment.contract_id || 'LT-2026-CI-000492',
          validatingPayment.contract?.property?.title || 'Logement certifié'
        );
        setRentSchedule(result.updatedSchedule);
        setLastAllocationResult(result);
      } catch (allocErr) {
        console.warn('Chronological allocation fallback:', allocErr);
        result = {
          generatedReceipt: {
            receipt_number: extractedOcrData.reference,
            periods_covered_text: validatingPayment.target_month || 'Période en cours'
          }
        };
      }

      // 2. Update payment status to confirmed with exact receipt reference
      const confirmedPmt: RentPayment = {
        ...validatingPayment,
        status: 'confirme',
        amount: extractedOcrData.amount,
        reference: extractedOcrData.reference,
        target_month: result?.generatedReceipt?.periods_covered_text || validatingPayment.target_month || 'Période en cours',
        confirmed_at: new Date().toISOString(),
      };

      setPayments((prev) =>
        prev.map((p) => (p.id === validatingPayment.id ? confirmedPmt : p))
      );

      // Persister dans locatrust_rent_payments
      try {
        const cached = localStorage.getItem('locatrust_rent_payments');
        let list = cached ? JSON.parse(cached) : [];
        if (Array.isArray(list)) {
          list = list.map((p: any) => (p.id === validatingPayment.id || p.reference === validatingPayment.reference ? confirmedPmt : p));
          if (!list.some((p: any) => p.id === confirmedPmt.id)) {
            list.unshift(confirmedPmt);
          }
          localStorage.setItem('locatrust_rent_payments', JSON.stringify(list));
        }
      } catch {}

      const ownerId = user?.id || 'usr_owner';
      const tenantId = validatingPayment.tenant_id || (validatingPayment.tenant as any)?.id || 'usr_tenant';

      // 3. Dispatch official receipt to Tenant Messaging Inbox
      try {
        sendQuittanceToTenant(
          {
            receiptNumber: extractedOcrData.reference,
            contractNumber: validatingPayment.contract_id || 'LT-CI-2026-000123',
            propertyTitle: validatingPayment.contract?.property?.title || 'Logement LocaTrust',
            propertyAddress: (validatingPayment.contract?.property as any)?.address || [validatingPayment.contract?.property?.quartier, validatingPayment.contract?.property?.commune, validatingPayment.contract?.property?.city].filter(Boolean).join(', ') || 'Abidjan - Côte d\'Ivoire',
            amount: extractedOcrData.amount,
            periodCovered: result?.generatedReceipt?.periods_covered_text || validatingPayment.target_month || 'Période en cours',
            paymentDate: new Date().toLocaleDateString('fr-FR'),
            paymentMethod: extractedOcrData.payment_method,
            transactionReference: extractedOcrData.reference,
            ownerName: user?.user_metadata?.full_name || 'Bailleur',
            tenantName: validatingPayment.tenant?.full_name || 'Locataire',
            ownerSignatureUrl: ownerSignatureUrl,
            tenantSignatureUrl: tenantSignatureUrl,
          },
          ownerId,
          tenantId
        );
      } catch (msgErr) {
        console.warn('sendQuittanceToTenant notice:', msgErr);
      }

      // Persister également dans locatrust_tenant_receipts_v2 pour visibilité immédiate côté locataire
      try {
        const rawV2 = localStorage.getItem('locatrust_tenant_receipts_v2');
        let receiptsV2 = rawV2 ? JSON.parse(rawV2) : [];
        if (Array.isArray(receiptsV2)) {
          receiptsV2 = receiptsV2.filter((r: any) => (r.receipt_number !== extractedOcrData.reference && r.receiptNumber !== extractedOcrData.reference));
          receiptsV2.unshift({
            id: `rec_${Date.now()}`,
            receipt_number: extractedOcrData.reference,
            receiptNumber: extractedOcrData.reference,
            type: 'loyer',
            contract_id: validatingPayment.contract_id,
            tenant_id: tenantId,
            owner_id: ownerId,
            amount: extractedOcrData.amount,
            period_covered: result?.generatedReceipt?.periods_covered_text || validatingPayment.target_month,
            payment_date: new Date().toISOString(),
            payment_method: extractedOcrData.payment_method,
            created_at: new Date().toISOString(),
            owner_signature_url: ownerSignatureUrl,
            status: 'confirme'
          });
          localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify(receiptsV2));
          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
        }
      } catch {}

      // Marquer la notification initiale de déclaration comme traitée
      try {
        if (typeof window !== 'undefined') {
          const notifsRaw = localStorage.getItem('locatrust_notifications');
          if (notifsRaw) {
            const parsed = JSON.parse(notifsRaw);
            const updated = parsed.map((n: any) => {
              if (n.payload?.payment_id === validatingPayment.id || n.id?.includes(validatingPayment.id)) {
                return { ...n, unread: false, read: true, processed: true };
              }
              return n;
            });
            localStorage.setItem('locatrust_notifications', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
          }
        }
      } catch {}

      // Synchroniser avec Supabase & notifier le locataire
      try {
        if (isValidUuid(validatingPayment.id)) {
          await supabase.from('rent_payments').update({
            status: 'confirme',
            confirmed_at: new Date().toISOString()
          }).eq('id', validatingPayment.id);
        }

        const receiptPayload: any = {
          receipt_number: extractedOcrData.reference,
          type: 'loyer',
          amount: extractedOcrData.amount,
          token: `tok_rec_${Date.now()}`
        };
        if (isValidUuid(validatingPayment.contract_id)) receiptPayload.contract_id = validatingPayment.contract_id;
        if (isValidUuid(validatingPayment.id)) receiptPayload.rent_payment_id = validatingPayment.id;
        if (isValidUuid(tenantId)) receiptPayload.tenant_id = tenantId;
        if (isValidUuid(ownerId)) receiptPayload.owner_id = ownerId;

        await supabase.from('receipts').insert(receiptPayload);

        // Notifier le locataire en base
        if (isValidUuid(validatingPayment.tenant_id)) {
          try {
            await supabase.from('notifications').insert({
              user_id: validatingPayment.tenant_id,
              title: 'Paiement de loyer validé !',
              content: `Votre règlement de ${formatFCFA(extractedOcrData.amount)} pour ${result?.generatedReceipt?.periods_covered_text || 'votre loyer'} a été validé. Votre quittance officielle est disponible.`,
              type: 'paiement_valide',
              read: false,
              payload: {
                payment_id: validatingPayment.id,
                receipt_number: extractedOcrData.reference,
                amount: extractedOcrData.amount
              }
            });
          } catch (nErr) {
            console.warn('Erreur notification Supabase:', nErr);
          }
        }

        // Diffuser l'événement en temps réel sur tous les appareils
        await broadcastLiveEvent('PAYMENT_CONFIRMED', {
          paymentId: validatingPayment.id,
          targetUserId: validatingPayment.tenant_id,
          contractId: validatingPayment.contract_id,
          actorId: user?.id,
          data: {
            amount: extractedOcrData.amount,
            receipt_number: extractedOcrData.reference,
            receipt: result?.generatedReceipt,
            payment: confirmedPmt,
            actorName: user?.user_metadata?.full_name || 'Bailleur'
          }
        });
      } catch (dbErr) {
        console.warn('Supabase sync notice in payment confirmation:', dbErr);
      }

      window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));

      // Déclencher la modale de confirmation et la prévisualisation du reçu
      setConfirmationModal({
        isOpen: true,
        type: 'payment_validated',
        title: 'Paiement validé avec succès !',
        message: `La quittance N° ${extractedOcrData.reference} a été certifiée conforme et transmise directement dans la boîte de messagerie du locataire ${validatingPayment.tenant?.full_name || 'Locataire'}.`,
        details: `Périodes couvertes : ${result?.generatedReceipt?.periods_covered_text || 'Loyer en cours'} • Montant : ${formatFCFA(extractedOcrData.amount)}`,
        confirmText: 'Consulter la quittance',
        withCelebration: true
      });

      setPreviewingReceipt(confirmedPmt);
    } catch (err: any) {
      console.error('Erreur validation paiement:', err);
      alert('La quittance a été validée localement.');
    } finally {
      setValidatingPayment(null);
      setExtractedOcrData(null);
      setIsSubmittingValidation(false);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Motif du refus du paiement :');
    if (reason !== null) {
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'refuse' } : p))
      );
      try {
        await supabase.from('rent_payments').update({ status: 'refuse' }).eq('id', id);
      } catch (e) {
        console.warn('Sync payment rejection error:', e);
      }
      alert('Paiement refusé et notifié au locataire.');
    }
  };

  const handleTransmitReceipt = async (pmt: RentPayment) => {
    try {
      const receiptNum = pmt.reference || `REC-${Date.now().toString().slice(-6)}`;
      const targetMonth = pmt.target_month || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const tenantId = pmt.tenant_id || (pmt.tenant as any)?.id || 'usr_tenant';
      const ownerId = user?.id || pmt.owner_id || 'usr_owner';
      const ownerName = user?.user_metadata?.full_name || (user as any)?.name || 'Bailleur';
      const tenantName = pmt.tenant?.full_name || 'Locataire';

      // 1. Send receipt attachment to tenant via messagingStore
      sendQuittanceToTenant(
        {
          receiptNumber: receiptNum,
          contractNumber: pmt.contract_id || (pmt.contract as any)?.contract_number || 'LT-CI-2026-000123',
          propertyTitle: pmt.contract?.property?.title || 'Logement LocaTrust',
          propertyAddress: (pmt.contract?.property as any)?.address || [(pmt.contract?.property as any)?.quartier, (pmt.contract?.property as any)?.commune, (pmt.contract?.property as any)?.city].filter(Boolean).join(', ') || 'Abidjan - Côte d\'Ivoire',
          amount: pmt.amount,
          periodCovered: targetMonth,
          paymentDate: new Date(pmt.confirmed_at || pmt.payment_date || Date.now()).toLocaleDateString('fr-FR'),
          paymentMethod: pmt.reference?.startsWith('OM') ? 'Orange Money' : 'Mobile Money',
          transactionReference: receiptNum,
          ownerName: ownerName,
          tenantName: tenantName,
          ownerSignatureUrl: ownerSignatureUrl || 'SIG_CERTIFIED_BAILLEUR',
          tenantSignatureUrl: tenantSignatureUrl || undefined,
        },
        ownerId,
        tenantId
      );

      // 2. Persist in Supabase receipts table
      if (isValidUuid(tenantId) && isValidUuid(ownerId)) {
        try {
          await supabase.from('receipts').insert({
            receipt_number: receiptNum,
            type: 'loyer',
            contract_id: isValidUuid(pmt.contract_id) ? pmt.contract_id : undefined,
            rent_payment_id: isValidUuid(pmt.id) ? pmt.id : undefined,
            tenant_id: tenantId,
            owner_id: ownerId,
            amount: pmt.amount,
            token: `tok_${receiptNum}_${Date.now()}`
          });
        } catch (dbErr) {
          console.warn('Supabase receipts insert notice:', dbErr);
        }

        try {
          await supabase.from('notifications').insert({
            user_id: tenantId,
            title: '📄 Quittance de loyer transmise',
            content: `Votre bailleur ${ownerName} vous a transmis votre quittance de loyer (${formatFCFA(pmt.amount)}). Veuillez la signer dans votre messagerie.`,
            type: 'quittance',
            read: false,
            payload: {
              payment_id: pmt.id,
              receipt_number: receiptNum,
              amount: pmt.amount
            }
          });
        } catch {}
      }

      // 3. Diffuser l'événement en temps réel
      await broadcastLiveEvent('PAYMENT_CONFIRMED', {
        actorId: ownerId,
        targetUserId: tenantId,
        paymentId: pmt.id,
        contractId: pmt.contract_id,
        data: {
          paymentId: pmt.id,
          receiptNumber: receiptNum,
          amount: pmt.amount,
          receipt: {
            receiptNumber: receiptNum,
            type: 'loyer',
            amount: pmt.amount,
            propertyTitle: pmt.property?.title,
            ownerName: ownerName,
            tenantName: tenantName,
            ownerSignatureUrl: ownerSignatureUrl || 'SIG_CERTIFIED_BAILLEUR',
            tenantSignatureUrl: tenantSignatureUrl || undefined,
            periodsCovered: pmt.period_text || 'Mois en cours',
            date: new Date().toISOString()
          },
          payment: pmt,
          actorName: ownerName
        }
      });

      // 4. Modal de confirmation
      setConfirmationModal({
        isOpen: true,
        type: 'sent',
        title: 'Quittance transmise avec succès !',
        message: `La quittance officielle N° ${receiptNum} a été transmise directement dans la boîte de messagerie du locataire ${tenantName}.`,
        confirmText: 'OK, parfait',
        withCelebration: true
      });
    } catch (err: any) {
      console.error('Erreur transmission quittance:', err);
      alert(`Erreur lors de la transmission : ${err?.message || 'Vérifiez la connexion réseau.'}`);
    }
  };

  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(null);
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(null);
  const [activeSigningParty, setActiveSigningParty] = useState<'proprietaire' | 'locataire' | null>(null);

  const handleDownloadReceiptPDF = async (pmt: RentPayment) => {
    const resolved = resolveRealReceiptData(pmt, user);
    await generateOfficialReceiptPDF({
      receiptNumber: pmt.reference,
      contractNumber: resolved.contractNumber,
      contractToken: `tok_cnt_${resolved.contractNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      propertyTitle: resolved.propertyTitle,
      propertyAddress: resolved.propertyAddress,
      propertyReference: resolved.propertyReference,
      propertyType: resolved.propertyType,
      durationMonths: resolved.durationMonths,
      leaseStartDate: resolved.leaseStartDate,
      leaseEndDate: resolved.leaseEndDate,
      ownerName: resolved.ownerName,
      ownerCni: resolved.ownerCni,
      ownerPhone: resolved.ownerPhone,
      tenantName: resolved.tenantName,
      tenantCni: resolved.tenantCni,
      tenantPhone: resolved.tenantPhone,
      amount: pmt.amount,
      periodCovered: pmt.target_month,
      paymentDate: new Date(pmt.confirmed_at || pmt.created_at).toLocaleDateString('fr-FR'),
      paymentMethod: pmt.reference.startsWith('OM') ? 'Orange Money' : pmt.reference.startsWith('WAVE') ? 'Wave Mobile Money' : 'Mobile Money',
      transactionReference: pmt.reference,
      ownerSignatureUrl: ownerSignatureUrl || resolved.ownerSignatureUrl,
      tenantSignatureUrl: tenantSignatureUrl || resolved.tenantSignatureUrl,
    });
  };

  const filteredPayments = payments.filter((p) => {
    if (activeTab === 'declares' && p.status !== 'declare') return false;
    if (activeTab === 'confirmes' && p.status !== 'confirme') return false;
    if (activeTab === 'refuses' && p.status !== 'refuse') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = (p.reference || '').toLowerCase().includes(q);
      const matchTenant = (p.tenant?.full_name || '').toLowerCase().includes(q);
      const matchMonth = (p.target_month || '').toLowerCase().includes(q);
      const matchAmount = String(p.amount || '').includes(q);
      return matchRef || matchTenant || matchMonth || matchAmount;
    }

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

      {/* KPI Cards (3 Compact & Responsive Cards) */}
      {isLoading ? (
        <KpiGridSkeleton count={3} />
      ) : (
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
      )}

      {/* Calendrier Réel & Échéancier Dynamique J-3 (Synchronisé Horloge Appareil) */}
      <RentScheduleCalendar userRole="proprietaire" />

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('tous')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
              activeTab === 'tous' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('declares')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'declares' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            À Valider / Déclarés ({payments.filter((p) => p.status === 'declare').length})
          </button>
          <button
            onClick={() => setActiveTab('confirmes')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'confirmes' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Confirmés ({payments.filter((p) => p.status === 'confirme').length})
          </button>
          <button
            onClick={() => setActiveTab('refuses')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'refuses' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Refusés ({payments.filter((p) => p.status === 'refuse').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher réf, locataire, mois..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
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
            {isLoading ? (
              <TableRowsSkeleton rows={5} cols={6} />
            ) : (
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loadError && (
                <tr>
                  <td colSpan={6} className="p-8 text-center bg-rose-50/50">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                      <span className="text-slate-800 font-bold text-xs">{loadError}</span>
                      <button onClick={loadPayments} className="mt-3 px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition cursor-pointer">
                        Réessayer
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <span className="text-slate-800 font-bold text-sm">
                        Aucun paiement dans cette catégorie
                      </span>
                      <p className="text-slate-400 text-xs mt-1 text-center">
                        Dès qu'un locataire déclare un paiement de loyer par Mobile Money ou virement, il apparaîtra ici pour vérification et émission de quittance.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && filteredPayments.map((pmt) => (
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
                          onClick={() => setSelectedProofUrl(pmt.proof_url || null)}
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
                          onClick={() => handleTransmitReceipt(pmt)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-extrabold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
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
            )}
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

      {/* MODAL 1: VALIDATION DU PAIEMENT DÉCLARÉ & QUITTANCE */}
      {validatingPayment && extractedOcrData && (() => {
        const isCash = extractedOcrData.payment_method === 'Espèces' || validatingPayment.reference?.startsWith('ESP');
        const hasRealProof = Boolean(validatingPayment.proof_url && validatingPayment.proof_url.trim().length > 0 && !isCash);

        return (
          <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl ${isCash ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-black shrink-0`}>
                    {isCash ? <Banknote className="w-5 h-5 text-emerald-600" /> : <Sparkles className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {isCash ? 'Validation du Règlement en Espèces' : 'Validation du Paiement Déclaré'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isCash ? 'Paiement direct en mains propres déclaré par le locataire' : hasRealProof ? 'Vérification du justificatif et émission de quittance' : 'Déclaration de règlement transmise par le locataire'}
                    </p>
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

              {/* Justificatif ou bandeau Espèces */}
              {hasRealProof ? (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
                  <div 
                    onClick={() => setSelectedProofUrl(validatingPayment.proof_url!)}
                    className="w-full sm:w-24 h-32 sm:h-24 rounded-xl overflow-hidden border border-slate-300 shrink-0 bg-slate-900 cursor-pointer relative group"
                  >
                    <img
                      src={validatingPayment.proof_url!}
                      alt="Capture de paiement"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex flex-col text-xs gap-1 flex-1">
                    <span className="font-extrabold text-slate-800">
                      Locataire : <strong className="text-blue-900">{validatingPayment.tenant?.full_name || user?.user_metadata?.full_name || 'Locataire'}</strong>
                    </span>
                    <span className="text-slate-500">Contrat : {validatingPayment.contract_id || 'LT-2026-CI-000492'}</span>
                    <span className="text-[11px] text-emerald-700 font-black flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Justificatif transmis par le locataire
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Banknote className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex flex-col text-xs gap-1 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-extrabold text-slate-800">
                        Locataire : <strong className="text-blue-900">{validatingPayment.tenant?.full_name || user?.user_metadata?.full_name || 'Locataire'}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        💵 Règlement en Espèces
                      </span>
                    </div>
                    <span className="text-slate-500">Contrat : {validatingPayment.contract_id || 'LT-2026-CI-000492'}</span>
                    <span className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Remise directe sans capture mobile money requise
                    </span>
                  </div>
                </div>
              )}

              {/* DÉTAILS DE LA DÉCLARATION — EN LECTURE SEULE (NON MODIFIABLE PAR LE BAILLEUR) */}
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Numéro de référence de la transaction
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Déclaré par le locataire
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold bg-slate-50 text-slate-800 flex items-center justify-between">
                    <span>{extractedOcrData.reference}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-600 text-[10px] font-sans font-semibold">
                      Fixé
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">Montant Déclaré</label>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Fixé
                      </span>
                    </div>
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 text-sm font-extrabold text-emerald-700 bg-emerald-50/50 flex items-center justify-between">
                      <span>{formatFCFA(extractedOcrData.amount)}</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">FCFA</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">Moyen de Règlement</label>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Fixé
                      </span>
                    </div>
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 flex items-center justify-between">
                      <span>{extractedOcrData.payment_method}</span>
                      <span className="text-slate-400 text-xs">{isCash ? '💵' : '📱'}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION SIGNATURE MANUELLE DU BAILLEUR (OBLIGATOIRE POUR ÉMETTRE LA QUITTANCE) */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
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

                  {/* Zone d'affichage et déclencheur de signature (100% responsive mobile) */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {ownerSignatureUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-28 bg-slate-50 rounded-lg border border-slate-200 p-1 flex items-center justify-center shrink-0">
                          <img src={ownerSignatureUrl} alt="Signature bailleur" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="flex flex-col text-xs">
                          <span className="font-extrabold text-slate-900">{user?.user_metadata?.full_name || 'Bailleur Propriétaire'}</span>
                          <span className="text-[10px] text-slate-500">Bailleur certifié</span>
                          <span className="text-[9px] text-emerald-600 font-bold">Horodatée et liée à la quittance</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <span>Aucune signature apposée pour le moment.</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveSigningParty('proprietaire')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{ownerSignatureUrl ? 'Modifier ma signature' : 'Dessiner ma signature'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BOUTONS D'ACTION (RESPONSIVE MOBILE) */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setValidatingPayment(null);
                    setExtractedOcrData(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 text-center"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmittingValidation}
                  onClick={handleFinalizeValidation}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all ${
                    isSubmittingValidation
                      ? 'bg-emerald-400 cursor-not-allowed opacity-80'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingValidation ? 'Émission en cours...' : 'Confirmer & Émettre la Quittance'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: VISUALISATION OFFICIELLE DU REÇU / QUITTANCE PAR LE PROPRIÉTAIRE (100% TEMPLATE LOCATRUST) */}
      {previewingReceipt && (() => {
        const resolved = resolveRealReceiptData(previewingReceipt, user);
        const effectiveOwnerSig = ownerSignatureUrl || resolved.ownerSignatureUrl;
        const effectiveTenantSig = tenantSignatureUrl || resolved.tenantSignatureUrl;
        const hasBothSignatures = Boolean(effectiveOwnerSig) && Boolean(effectiveTenantSig);

        return (
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
                      <strong className="text-slate-900">{resolved.tenantName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CNI :</span>
                      <span className="font-mono text-slate-700">{resolved.tenantCni}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Téléphone :</span>
                      <span className="text-slate-700">{resolved.tenantPhone}</span>
                    </div>
                  </div>

                  {/* Owner Card */}
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                    <span className="font-extrabold text-blue-700 uppercase text-[10px]">Informations du propriétaire</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nom et prénom :</span>
                      <strong className="text-slate-900">{resolved.ownerName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CNI :</span>
                      <span className="font-mono text-slate-700">{resolved.ownerCni}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Téléphone :</span>
                      <span className="text-slate-700">{resolved.ownerPhone}</span>
                    </div>
                  </div>

                  {/* Property Card */}
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                    <span className="font-extrabold text-blue-700 uppercase text-[10px]">Bien immobilier</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Type :</span>
                      <strong className="text-slate-900">{resolved.propertyType}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Adresse :</span>
                      <span className="text-slate-700">{resolved.propertyAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Réf bien :</span>
                      <span className="font-mono text-slate-700">{resolved.propertyReference}</span>
                    </div>
                  </div>

                  {/* Contract Card */}
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-1">
                    <span className="font-extrabold text-blue-700 uppercase text-[10px]">Contrat de bail</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">N° contrat :</span>
                      <strong className="text-slate-900">{resolved.contractNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Durée du bail :</span>
                      <span className="text-slate-700">{resolved.durationMonths} mois</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Période :</span>
                      <span className="text-slate-700">{resolved.periodText}</span>
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
                    <span className="text-[10px] text-slate-400 font-medium">(Paiement certifié conforme)</span>
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

                {/* SIGNATURES & DYNAMIC SCANNABLE QR CODE CONTAINER */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 items-center">
                  
                  {/* Propriétaire Signature */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Signature du propriétaire</span>
                    <div className="h-14 w-full flex items-center justify-center my-1">
                      {effectiveOwnerSig ? (
                        <img src={effectiveOwnerSig} alt="Signature propriétaire" className="max-h-12 max-w-full object-contain" />
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
                    <span className="font-bold text-slate-800 text-[10px]">{resolved.ownerName}</span>
                  </div>

                  {/* Locataire Signature */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Signature du locataire</span>
                    <div className="h-14 w-full flex items-center justify-center my-1">
                      {effectiveTenantSig ? (
                        <img src={effectiveTenantSig} alt="Signature locataire" className="max-h-12 max-w-full object-contain" />
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
                    <span className="font-bold text-slate-800 text-[10px]">{resolved.tenantName}</span>
                  </div>

                  {/* Scannable Official QR Code */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg p-0.5 shrink-0 flex items-center justify-center shadow-sm">
                      <img
                        src={resolved.qrDataUrl || LOCATRUST_QR_CODE_DATA_URL}
                        alt="QR Code officiel"
                        className="w-full h-full object-contain"
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
                  <span>Ce reçu fait partie intégrante du contrat de bail n° {resolved.contractNumber}.</span>
                  <span className="font-semibold text-slate-600">Merci pour votre confiance ! LocaTrust</span>
                </div>

              </div>

              {/* Modal Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPreviewingReceipt(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-slate-700 text-xs hover:bg-slate-200 transition-colors"
                >
                  Fermer
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sendQuittanceToTenant(
                        {
                          receiptNumber: previewingReceipt.reference,
                          contractNumber: resolved.contractNumber,
                          propertyTitle: resolved.propertyTitle,
                          propertyAddress: resolved.propertyAddress,
                          amount: previewingReceipt.amount,
                          periodCovered: previewingReceipt.target_month,
                          paymentDate: new Date(previewingReceipt.confirmed_at || previewingReceipt.created_at).toLocaleDateString('fr-FR'),
                          paymentMethod: previewingReceipt.reference.startsWith('OM') ? 'Orange Money' : 'Mobile Money',
                          transactionReference: previewingReceipt.reference,
                          ownerName: resolved.ownerName,
                          tenantName: resolved.tenantName,
                          ownerSignatureUrl: effectiveOwnerSig,
                          tenantSignatureUrl: effectiveTenantSig,
                          durationMonths: resolved.durationMonths,
                          leaseStartDate: resolved.leaseStartDate,
                          leaseEndDate: resolved.leaseEndDate,
                          propertyReference: resolved.propertyReference,
                          propertyType: resolved.propertyType,
                          ownerCni: resolved.ownerCni,
                          ownerPhone: resolved.ownerPhone,
                          tenantCni: resolved.tenantCni,
                          tenantPhone: resolved.tenantPhone,
                        },
                        user?.id,
                        previewingReceipt.tenant_id
                      );
                      setConfirmationModal({
                        isOpen: true,
                        type: 'sent',
                        title: 'Reçu officiel expédié !',
                        message: `Le reçu officiel avec QR code scannable a été transmis directement au locataire ${resolved.tenantName} pour contre-signature.`,
                        confirmText: 'OK, parfait',
                        withCelebration: true
                      });
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{effectiveTenantSig ? "Renvoyer dans la Messagerie" : "Transmettre pour signature locataire"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!hasBothSignatures) {
                        alert("Le téléchargement officiel nécessite la signature des deux parties (bailleur et locataire). Veuillez apposer votre signature puis transmettre le reçu au locataire.");
                        return;
                      }
                      handleDownloadReceiptPDF(previewingReceipt);
                    }}
                    disabled={!hasBothSignatures}
                    title={hasBothSignatures ? "Télécharger le reçu officiel au format PDF" : "Le reçu doit être signé par le propriétaire et le locataire avant téléchargement"}
                    className={`px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all ${
                      hasBothSignatures
                        ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-75'
                    }`}
                  >
                    {hasBothSignatures ? <Download className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{hasBothSignatures ? "Télécharger PDF (Officiel)" : "Télécharger PDF (Signatures requises)"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          signerName={activeSigningParty === 'proprietaire' ? user?.user_metadata?.full_name || 'Bailleur' : (validatingPayment?.tenant?.full_name || previewingReceipt?.tenant?.full_name || "Locataire")}
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

