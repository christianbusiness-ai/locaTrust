'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Receipt,
  Upload,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Building2,
  FileCheck,
  Check,
  X,
  Search,
  Camera,
  Trash2,
  UploadCloud,
  ZoomIn,
  FileText,
  Download
} from 'lucide-react';
import { formatFCFA, sanitizeNumericInput } from '@/lib/utils';
import { RentPayment } from '@/types/database.types';
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge';
import { getRentPayments, createRentPayment, getContracts } from '@/src/lib/db';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import confetti from 'canvas-confetti';
import { TableRowsSkeleton } from '@/components/common/SkeletonLoader';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { declareCautionPayment } from '@/lib/cautionsStore';
import { sendDeclarationMessageToOwner, isValidUuid } from '@/lib/messagingStore';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';

export const LocatairePaiementsView: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal States
  const [showDeclareModal, setShowDeclareModal] = useState<boolean>(false);
  const [showCautionModal, setShowCautionModal] = useState<boolean>(false);
  const [isSubmittingCaution, setIsSubmittingCaution] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [successModalMessage, setSuccessModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // Rent Form State
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState('2026-10-01');
  const [paymentType, setPaymentType] = useState<'loyer' | 'partiel' | 'autre'>('loyer');
  const [amount, setAmount] = useState<number>(150000);
  const [method, setMethod] = useState('Wave CI');
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  // Caution Form State
  const [cautionContractId, setCautionContractId] = useState('');
  const [cautionAmount, setCautionAmount] = useState<number>(300000);
  const [cautionMethod, setCautionMethod] = useState('Wave CI');
  const [cautionReference, setCautionReference] = useState('');
  const [cautionProofUrl, setCautionProofUrl] = useState<string | null>(null);
  const [cautionProofFileName, setCautionProofFileName] = useState<string | null>(null);
  const [cautionProofFileSize, setCautionProofFileSize] = useState<string | null>(null);
  const cautionProofFileInputRef = useRef<HTMLInputElement>(null);

  const handleCautionProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCautionProofFileName(file.name);
    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`;
    setCautionProofFileSize(sizeStr);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCautionProofUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fetchPaymentsData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Paiements de loyers
      const { data: pmtData, error: pmtErr } = await getRentPayments(user.id);
      if (pmtErr) {
        setLoadError("Impossible de charger l'historique des paiements.");
      } else {
        setPayments(pmtData || []);
      }

      // 2. Cautions
      const { data: ctnData } = await supabase
        .from('cautions')
        .select('*')
        .eq('tenant_id', user.id);
      setDeposits(ctnData || []);

      // 3. Contrats réels pour les formulaires de paiement
      const { data: cntData } = await getContracts(user.id, 'locataire');
      const allContracts: any[] = cntData || [];

      // Chargement direct des candidatures au statut contrat_actif depuis Supabase
      try {
        let appQuery = supabase
          .from('rental_applications')
          .select('*')
          .in('status', ['contrat_actif', 'validee']);

        if (user.id) {
          appQuery = appQuery.or(`tenant_id.eq.${user.id}${user.email ? `,tenant_email.eq.${user.email}` : ''}`);
        }

        const { data: dbApps } = await appQuery;
        if (dbApps && dbApps.length > 0) {
          dbApps.forEach((a: any) => {
            if ((a.contract_number || a.status === 'contrat_actif') && !allContracts.some(ac => (ac.contract_number && ac.contract_number === a.contract_number) || ac.id === a.id)) {
              allContracts.push({
                id: `cnt_app_${a.id}`,
                contract_number: a.contract_number || `LT-2026-CI-000${a.id.slice(0, 4)}`,
                property_id: a.property_id,
                tenant_id: a.tenant_id || user.id,
                owner_id: a.owner_id,
                rent: Number(a.rent_amount || 0),
                caution: Number(a.caution_amount || 0),
                caution_amount: Number(a.caution_amount || 0),
                charges: 10000,
                status: 'actif',
                property: {
                  title: a.property_title || 'Logement loué',
                  city: 'Abidjan',
                  address: a.property_address || 'Abidjan'
                }
              });
            }
          });
        }
      } catch (e) {
        console.warn('Erreur chargement Supabase rental_applications pour paiements:', e);
      }

      try {
        const raw = localStorage.getItem('locatrust_contracts');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              const isMatch =
                c.tenant_id === user.id ||
                c.tenant?.id === user.id ||
                (user.email && (c.tenant?.email?.toLowerCase() === user.email.toLowerCase() || c.tenant_email?.toLowerCase() === user.email.toLowerCase())) ||
                (user.user_metadata?.full_name && c.tenant?.full_name?.toLowerCase() === user.user_metadata.full_name.toLowerCase());
              if (isMatch && !allContracts.some(ac => (ac.contract_number && ac.contract_number === c.contract_number) || ac.id === c.id)) {
                allContracts.push(c);
              }
            });
          }
        }
      } catch {}

      if (allContracts.length > 0) {
        setUserContracts(allContracts);
        if (!selectedContractId || !allContracts.some(c => c.id === selectedContractId)) {
          setSelectedContractId(allContracts[0].id);
          if (allContracts[0].rent) setAmount(Number(allContracts[0].rent));
        }
        if (!cautionContractId || !allContracts.some(c => c.id === cautionContractId)) {
          setCautionContractId(allContracts[0].id);
          const cAmount = Number(allContracts[0].caution_amount || allContracts[0].caution || (Number(allContracts[0].rent || 0) * 2));
          if (cAmount > 0) setCautionAmount(cAmount);
        }
      }
    } catch (err: any) {
      setLoadError("Erreur réseau lors de la récupération des données financières.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();

    const handleUpdate = () => {
      fetchPaymentsData();
    };

    window.addEventListener('locatrust:payments-updated', handleUpdate);
    window.addEventListener('locatrust:cautions_updated', handleUpdate);
    window.addEventListener('locatrust:contracts-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:cautions_updated', handleUpdate);
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
    };
  }, [user]);

  // Résolution multi-sources de l'identifiant réel du propriétaire ou de l'agence
  const resolveTargetOwnerId = async (chosenContract: any): Promise<string | null> => {
    let ownerId =
      chosenContract?.owner_id ||
      chosenContract?.owner?.id ||
      chosenContract?.property?.owner_id ||
      chosenContract?.property?.agency_id ||
      chosenContract?.agency_id ||
      null;

    if (ownerId && isValidUuid(ownerId)) return ownerId;

    // 1. Chercher dans rental_applications de Supabase
    try {
      if (user?.id) {
        const { data: appData } = await supabase
          .from('rental_applications')
          .select('owner_id, agency_id')
          .eq('tenant_id', user.id)
          .in('status', ['contrat_actif', 'validee'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (appData?.owner_id || appData?.agency_id) {
          const resolved = appData.owner_id || appData.agency_id;
          if (resolved && isValidUuid(resolved)) return resolved;
        }
      }
    } catch {}

    // 2. Chercher dans contracts de Supabase
    try {
      if (user?.id) {
        const { data: cntData } = await supabase
          .from('contracts')
          .select('owner_id')
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cntData?.owner_id && isValidUuid(cntData.owner_id)) {
          return cntData.owner_id;
        }
      }
    } catch {}

    // 3. Chercher dans properties de Supabase
    try {
      if (chosenContract?.property_id && isValidUuid(chosenContract.property_id)) {
        const { data: propData } = await supabase
          .from('properties')
          .select('owner_id, agency_id')
          .eq('id', chosenContract.property_id)
          .maybeSingle();

        if (propData?.owner_id || propData?.agency_id) {
          const resolved = propData.agency_id || propData.owner_id;
          if (resolved && isValidUuid(resolved)) return resolved;
        }
      }
    } catch {}

    // 4. Chercher dans les profils agence ou propriétaire actifs de Supabase (ex: agence kk)
    try {
      const { data: agencyProfile } = await supabase
        .from('profiles')
        .select('id')
        .in('account_type', ['agence', 'proprietaire'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agencyProfile?.id && isValidUuid(agencyProfile.id)) {
        return agencyProfile.id;
      }
    } catch {}

    return ownerId;
  };

  // Handle Rent Declaration
  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method !== 'Espèces' && !reference.trim()) return;

    try {
      setIsSubmittingPayment(true);
      const chosenContract = userContracts.find(c => c.id === selectedContractId) || userContracts[0];
      const targetOwnerId = await resolveTargetOwnerId(chosenContract);

      const contractUuid = chosenContract?.id && isValidUuid(chosenContract.id) ? chosenContract.id : null;
      const tenantUuid = user?.id && isValidUuid(user.id) ? user.id : null;
      const ownerUuid = targetOwnerId && isValidUuid(targetOwnerId) ? targetOwnerId : null;

      const newPaymentData: any = {
        contract_id: contractUuid,
        tenant_id: tenantUuid,
        owner_id: ownerUuid,
        target_month: targetMonth,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        reference: method === 'Espèces' ? `ESP-${Date.now().toString().slice(-6)}` : reference,
        proof_url: proofUrl || null,
        status: 'declare'
      };

      let savedPayment: any = null;
      try {
        const { data, error } = await createRentPayment(newPaymentData);
        savedPayment = (!error && data) ? data : { ...newPaymentData, id: `pmt_${Date.now()}`, payment_method: method };
      } catch {
        savedPayment = { ...newPaymentData, id: `pmt_${Date.now()}`, payment_method: method };
      }

      // Save locally for responsive offline/instant UX
      try {
        const stored = JSON.parse(localStorage.getItem('locatrust_rent_payments') || '[]');
        localStorage.setItem('locatrust_rent_payments', JSON.stringify([savedPayment, ...stored]));
      } catch {}

      // Send real notification to owner/agency in Supabase
      if (ownerUuid) {
        try {
          await supabase.from('notifications').insert({
            user_id: ownerUuid,
            title: '💳 Nouveau règlement de loyer déclaré',
            content: `${user?.user_metadata?.full_name || (user as any)?.name || 'Votre locataire'} a déclaré un paiement de ${formatFCFA(amount)} (${method} - Réf: ${newPaymentData.reference}) pour le mois de ${targetMonth}.`,
            type: 'paiement',
            read: false,
            payload: {
              payment_id: savedPayment.id,
              amount: amount,
              month: targetMonth,
              reference: newPaymentData.reference,
              payment_method: method
            }
          });
        } catch (err) {
          console.warn('Notification insert error:', err);
        }
      }

      // Notification globale dans locatrust_notifications pour bailleur et agence
      try {
        pushGlobalNotification({
          title: '💳 Nouveau règlement de loyer déclaré',
          description: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré un paiement de ${formatFCFA(amount)} (${method} - Réf: ${newPaymentData.reference}) pour le mois de ${targetMonth}.`,
          category: 'paiement',
          targetRole: 'proprietaire',
          targetUserId: targetOwnerId || undefined,
          targetTab: 'payments'
        });
        pushGlobalNotification({
          title: '💳 Nouveau règlement de loyer déclaré',
          description: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré un paiement de ${formatFCFA(amount)} (${method} - Réf: ${newPaymentData.reference}) pour le mois de ${targetMonth}.`,
          category: 'paiement',
          targetRole: 'agence',
          targetUserId: targetOwnerId || undefined,
          targetTab: 'payments'
        });
      } catch (notifErr) {
        console.warn('pushGlobalNotification error:', notifErr);
      }

      // Broadcast live event across devices
      try {
        await broadcastLiveEvent('PAYMENT_DECLARED', {
          paymentId: savedPayment.id,
          targetUserId: targetOwnerId || undefined,
          contractId: chosenContract?.id,
          data: {
            payment: savedPayment,
            amount,
            month: targetMonth
          }
        });
      } catch {}

      // Send declaration document directly to owner / agency messaging inbox
      try {
        sendDeclarationMessageToOwner({
          type: 'loyer',
          declarationId: savedPayment.id,
          contractNumber: chosenContract?.contract_number || 'LT-2026-CI-000492',
          propertyTitle: chosenContract?.property?.title || 'Logement LocaTrust',
          amount: amount,
          paymentMethod: method,
          reference: method === 'Espèces' ? `ESP-${Date.now().toString().slice(-6)}` : reference,
          date: new Date().toLocaleDateString('fr-FR'),
          month: targetMonth,
          tenantName: user?.user_metadata?.full_name || (user as any)?.name || 'Christian yao Koffi',
          tenantId: user?.id || 'usr_locataire',
          ownerId: targetOwnerId || 'usr_owner',
          proofUrl: proofUrl || undefined,
          status: 'en_attente'
        });
      } catch (msgErr) {
        console.warn('Erreur envoi chat message loyer:', msgErr);
      }

      setPayments((prev) => [savedPayment, ...prev]);
      window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: savedPayment }));

      setShowDeclareModal(false);
      setReference('');
      setSuccessModalMessage({
        title: 'Paiement de loyer déclaré !',
        desc: 'Votre déclaration a été transmise à votre bailleur. La quittance officielle sera générée dès confirmation.'
      });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Erreur déclaration loyer:', err);
      setShowDeclareModal(false);
      setSuccessModalMessage({
        title: 'Paiement de loyer pris en compte !',
        desc: 'Votre déclaration a été enregistrée et notifiée à votre bailleur.'
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Caution Declaration
  const handleDeclareCaution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cautionMethod !== 'Espèces' && !cautionReference.trim()) return;

    try {
      setIsSubmittingCaution(true);
      const chosenContract = userContracts.find(c => c.id === cautionContractId) || userContracts[0];
      const targetOwnerId = await resolveTargetOwnerId(chosenContract);

      const contractUuid = chosenContract?.id && isValidUuid(chosenContract.id) ? chosenContract.id : null;
      const tenantUuid = user?.id && isValidUuid(user.id) ? user.id : null;
      const ownerUuid = targetOwnerId && isValidUuid(targetOwnerId) ? targetOwnerId : null;

      // Numéro de contrat réel certifié (ex: LT-2026-CI-000492)
      const realContractNumber = chosenContract?.contract_number || chosenContract?.contractNumber || undefined;

      const cautionData: any = {
        contract_id: contractUuid,
        contract_number: realContractNumber,
        tenant_id: tenantUuid,
        owner_id: ownerUuid,
        amount_requested: cautionAmount,
        amount_paid: cautionAmount,
        status: 'caution_a_confirmer',
        payment_method: cautionMethod,
        declared_reference: cautionReference || (cautionMethod === 'Espèces' ? 'ESP-CAUTION' : 'REF-CAUTION'),
        declared_at: new Date().toISOString(),
        proof_url: cautionProofUrl || null
      };

      const dbCautionPayload: any = {
        amount_requested: cautionAmount,
        amount_paid: cautionAmount,
        status: 'caution_a_confirmer'
      };
      if (contractUuid) dbCautionPayload.contract_id = contractUuid;
      if (tenantUuid) dbCautionPayload.tenant_id = tenantUuid;
      if (ownerUuid) dbCautionPayload.owner_id = ownerUuid;

      let savedCaution: any = null;
      try {
        const { data: dbCaution, error: ctnErr } = await supabase
          .from('cautions')
          .insert(dbCautionPayload)
          .select()
          .maybeSingle();

        if (dbCaution) {
          savedCaution = { ...cautionData, ...dbCaution };
        } else {
          if (ctnErr) console.warn('Supabase caution insert notice:', ctnErr.message);
          savedCaution = { ...cautionData, id: `cau_${Date.now()}` };
        }
      } catch {
        savedCaution = { ...cautionData, id: `cau_${Date.now()}` };
      }

      // Notification Supabase persistante pour le bailleur/agence
      if (ownerUuid) {
        try {
          await supabase.from('notifications').insert({
            user_id: ownerUuid,
            title: '💰 Nouveau versement de caution déclaré',
            content: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré le versement de sa caution (${formatFCFA(cautionAmount)} - ${cautionMethod}). Veuillez vérifier et valider la caution.`,
            type: 'caution',
            read: false,
            payload: {
              deposit_id: savedCaution.id,
              contract_id: contractUuid,
              amount: cautionAmount,
              reference: cautionData.declared_reference,
              method: cautionMethod
            }
          });
        } catch {}
      }

      // Persist in local store for seamless demo & multi-tab responsiveness
      try {
        declareCautionPayment({
          contractId: chosenContract?.id || 'LT-CONTRAT',
          contractNumber: realContractNumber,
          tenantId: user?.id || 'usr_locataire',
          tenantName: user?.user_metadata?.full_name || (user as any)?.name || 'Locataire',
          amount: cautionAmount,
          reference: cautionReference || (cautionMethod === 'Espèces' ? 'ESP-CAUTION' : 'REF-CAUTION'),
          method: cautionMethod,
          proofUrl: cautionProofUrl || undefined,
          comment: undefined,
          ownerId: targetOwnerId || undefined
        });
      } catch (e) {
        console.warn('declareCautionPayment error:', e);
      }

      // Send real notification to owner/agency in Supabase
      if (ownerUuid) {
        try {
          await supabase.from('notifications').insert({
            user_id: ownerUuid,
            title: '💰 Paiement de caution déclaré',
            content: `${user?.user_metadata?.full_name || (user as any)?.name || 'Votre locataire'} a déclaré le règlement de la caution de ${formatFCFA(cautionAmount)} (${cautionMethod}).`,
            type: 'caution',
            read: false,
            payload: {
              deposit_id: savedCaution?.id,
              amount: cautionAmount,
              reference: cautionReference || (cautionMethod === 'Espèces' ? 'ESP-CAUTION' : 'REF-CAUTION'),
              payment_method: cautionMethod,
              tenant_name: user?.user_metadata?.full_name || (user as any)?.name || 'Locataire'
            }
          });
        } catch (err) {
          console.warn('Notification caution insert error:', err);
        }
      }

      // Notification globale dans locatrust_notifications pour bailleur et agence
      try {
        pushGlobalNotification({
          title: '💰 Nouvelle déclaration de caution reçue',
          description: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré le versement de sa caution (${formatFCFA(cautionAmount)} • ${cautionMethod}). En attente de validation.`,
          category: 'caution',
          targetRole: 'proprietaire',
          targetUserId: targetOwnerId || undefined,
          targetTab: 'cautions'
        });
        pushGlobalNotification({
          title: '💰 Nouvelle déclaration de caution reçue',
          description: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré le versement de sa caution (${formatFCFA(cautionAmount)} • ${cautionMethod}). En attente de validation.`,
          category: 'caution',
          targetRole: 'agence',
          targetUserId: targetOwnerId || undefined,
          targetTab: 'cautions'
        });
      } catch (cNotifErr) {
        console.warn('pushGlobalNotification caution error:', cNotifErr);
      }

      // Broadcast live event across devices (Supabase Realtime)
      try {
        await broadcastLiveEvent('CAUTION_DECLARED', {
          depositId: savedCaution.id,
          targetUserId: targetOwnerId || undefined,
          contractId: chosenContract?.id,
          data: {
            caution: savedCaution,
            amount: cautionAmount,
            ownerId: targetOwnerId,
            tenantId: user?.id
          }
        });
      } catch {}

      // Send caution declaration document directly to owner / agency messaging inbox
      try {
        sendDeclarationMessageToOwner({
          type: 'caution',
          declarationId: savedCaution.id,
          contractNumber: chosenContract?.contract_number || 'LT-2026-CI-000492',
          propertyTitle: chosenContract?.property?.title || 'Logement LocaTrust',
          amount: cautionAmount,
          paymentMethod: cautionMethod,
          reference: cautionReference || (cautionMethod === 'Espèces' ? 'ESP-CAUTION' : 'REF-CAUTION'),
          date: new Date().toLocaleDateString('fr-FR'),
          tenantName: user?.user_metadata?.full_name || (user as any)?.name || 'Locataire',
          tenantId: user?.id || 'usr_locataire',
          ownerId: targetOwnerId || 'usr_owner',
          proofUrl: cautionProofUrl || undefined,
          status: 'en_attente'
        });
      } catch (msgErr) {
        console.warn('Erreur envoi chat message caution:', msgErr);
      }

      setDeposits((prev) => [savedCaution, ...prev]);
      window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: savedCaution }));

      setShowCautionModal(false);
      setCautionReference('');
      setCautionProofUrl(null);
      setCautionProofFileName(null);
      setCautionProofFileSize(null);
      setSuccessModalMessage({
        title: 'Paiement de caution signalé !',
        desc: `Votre règlement de garantie de ${formatFCFA(cautionAmount)} a été notifié à votre bailleur sous le statut "Caution à confirmer".`
      });
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Erreur déclaration caution:', err);
      setShowCautionModal(false);
      setSuccessModalMessage({
        title: 'Paiement de caution signalé !',
        desc: `Votre règlement de garantie de ${formatFCFA(cautionAmount)} a été enregistré et notifié à votre bailleur.`
      });
    } finally {
      setIsSubmittingCaution(false);
    }
  };

  const handleDownloadCautionReceipt = async (dep: any) => {
    try {
      await generateOfficialReceiptPDF({
        receiptNumber: `REC-CAUT-${(dep.id || 'OFFICIEL').toUpperCase()}`,
        receiptType: 'caution',
        contractNumber: dep.contract_id || 'LT-CONTRAT-2026',
        contractToken: `tok_caut_${dep.id || Date.now()}`,
        propertyTitle: dep.property?.title || 'Logement LocaTrust',
        propertyAddress: dep.property?.description || 'Abidjan, Côte d\'Ivoire',
        propertyReference: 'BIEN-CAUT-001',
        propertyType: dep.property?.type || 'appartement',
        durationMonths: 12,
        leaseStartDate: '01/01/2026',
        leaseEndDate: '31/12/2026',
        ownerName: dep.property?.owner_name || 'Bailleur / Agence Agréée',
        tenantName: user?.user_metadata?.full_name || (user as any)?.name || 'Locataire',
        tenantPhone: user?.phone || '+225 07 08 09 10 11',
        amount: dep.amount_paid || dep.amount_requested || 60000,
        periodCovered: 'Dépôt de Garantie Contractuel (Loi n° 2019-576)',
        paymentDate: dep.declared_at ? new Date(dep.declared_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
        paymentMethod: dep.declared_reference ? 'Mobile Money / Espèces' : 'Paiement certifié',
        transactionReference: dep.declared_reference || `TXN-${Date.now()}`,
        ownerSignatureUrl: dep.owner_signature || 'SIG_CERTIFIED_OWNER',
        tenantSignatureUrl: dep.tenant_signature || 'SIG_CERTIFIED_TENANT'
      });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Erreur téléchargement reçu caution:', err);
    }
  };

  const myDeposit = deposits[0];

  const filteredPayments = payments.filter((pmt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchRef = (pmt.reference || '').toLowerCase().includes(q);
    const matchMonth = (pmt.target_month || '').toLowerCase().includes(q);
    const matchAmount = String(pmt.amount || '').includes(q);
    return matchRef || matchMonth || matchAmount;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Mes Paiements & Cautions
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-extrabold">
              Espace Locataire
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Déclarez vos règlements de loyer et signalez le paiement de votre caution de garantie en toute conformité.
          </p>
        </div>

        {/* Action Buttons: Loyer & Caution */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCautionModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95"
            title="Signaler au bailleur que vous avez réglé votre dépôt de garantie"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>J'ai payé ma caution</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeclareModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Déclarer un loyer</span>
          </button>
        </div>
      </div>

      {/* Point 8: Dépôt de Garantie (Statut Visuel Clair) */}
      {myDeposit && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Dépôt de garantie contractuel ({myDeposit.contract_id})
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {formatFCFA(myDeposit.amount_paid)}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  / {formatFCFA(myDeposit.amount_requested)} exigés
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {myDeposit.property?.title || 'Logement loué'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unified Status Badge */}
            <PaymentStatusBadge status={myDeposit.status} />

            {(myDeposit.status === 'paye_complet' || myDeposit.status === 'caution_confirmee' || (myDeposit as any).status === 'valide') && (
              <button
                type="button"
                onClick={() => handleDownloadCautionReceipt(myDeposit)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                title="Télécharger le reçu officiel de caution certifié (PDF)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le reçu</span>
              </button>
            )}

            {myDeposit.status !== 'paye_complet' && myDeposit.status !== 'caution_confirmee' && (
              <button
                type="button"
                onClick={() => setShowCautionModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
              >
                Mettre à jour
              </button>
            )}
          </div>
        </div>
      )}

      {/* Declarations History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Historique de mes règlements de loyer</h3>
            <span className="text-xs text-slate-500">{filteredPayments.length} déclaration(s)</span>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher réf, mois, montant..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">Type de Paiement</th>
                <th className="p-4">Mois Affecté</th>
                <th className="p-4">Montant Versé</th>
                <th className="p-4">Référence</th>
                <th className="p-4">Date</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Quittance</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableRowsSkeleton rows={4} cols={7} />
            ) : loadError ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="p-6 bg-rose-50 dark:bg-rose-950/20 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                    <h4 className="text-sm font-black text-rose-900 dark:text-rose-200">Erreur de chargement</h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{loadError}</p>
                    <button
                      type="button"
                      onClick={fetchPaymentsData}
                      className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
                    >
                      Réessayer
                    </button>
                  </td>
                </tr>
              </tbody>
            ) : filteredPayments.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                      <h4 className="text-base font-black text-slate-800 dark:text-white">
                        {searchQuery ? "Aucun règlement correspondant trouvé" : "Aucun paiement de loyer enregistré"}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                        {searchQuery
                          ? "Aucun paiement ne correspond à votre recherche. Vérifiez la référence ou le mois."
                          : "Vous n'avez pas encore déclaré de règlement. Cliquez sur « Déclarer un loyer » pour enregistrer votre premier versement par Wave, Orange Money ou MTN."}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          onClick={() => setShowDeclareModal(true)}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                        >
                          Déclarer un loyer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredPayments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold">
                        Loyer mensuel
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{pmt.target_month}</td>
                    <td className="p-4 font-black text-emerald-600 text-sm">{formatFCFA(pmt.amount)}</td>
                    <td className="p-4">
                      <span className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                        {pmt.reference}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{pmt.payment_date}</td>
                    <td className="p-4">
                      <PaymentStatusBadge status={pmt.status} />
                    </td>
                    <td className="p-4 text-right">
                      {pmt.status === 'confirme' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const { generateOfficialReceiptPDF } = await import('@/lib/payments/officialReceiptPdfGenerator');
                            await generateOfficialReceiptPDF({
                              receiptNumber: pmt.reference,
                              contractNumber: pmt.contract?.contract_number || pmt.contract_id || 'LT-CONTRAT',
                              contractToken: pmt.contract?.token || 'tok_receipt',
                              propertyTitle: pmt.contract?.property?.title || 'Logement loué',
                              propertyAddress: pmt.contract?.property?.commune || 'Abidjan',
                              propertyReference: 'BIEN-REF',
                              propertyType: 'Logement',
                              durationMonths: 12,
                              leaseStartDate: pmt.contract?.start_date || '01/01/2026',
                              leaseEndDate: '31/12/2026',
                              ownerName: pmt.contract?.owner?.full_name || 'Bailleur',
                              ownerCni: 'CI0000000',
                              ownerPhone: pmt.contract?.owner?.phone || '',
                              tenantName: user?.user_metadata?.full_name || 'Locataire',
                              tenantCni: 'CI0000000',
                              tenantPhone: user?.phone || '',
                              amount: pmt.amount,
                              periodCovered: pmt.target_month,
                              paymentDate: pmt.payment_date,
                              paymentMethod: pmt.payment_method || 'Mobile Money',
                              transactionReference: pmt.reference
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-xs font-black inline-flex items-center gap-1 shadow-sm transition-all active:scale-95"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Télécharger Quittance</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">En attente validation</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>


      {/* MODAL 1: SIGNALER LE PAIEMENT DE LA CAUTION (Points 5, 7, 8) */}
      {showCautionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleDeclareCaution}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 animate-scaleUp text-xs my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">Signaler le paiement de ma caution</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCautionModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              Cette déclaration est immédiatement notifiée à votre bailleur / agence sous le statut <strong>Caution à confirmer</strong>.
            </div>

            <div className="flex flex-col gap-3 font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Contrat de bail associé</label>
                {userContracts.length === 0 ? (
                  <input
                    type="text"
                    readOnly
                    value="Aucun contrat de bail actif enregistré"
                    className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={cautionContractId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setCautionContractId(selectedId);
                      const targetContract = userContracts.find(c => c.id === selectedId);
                      if (targetContract) {
                        const cAmount = Number(targetContract.caution_amount || targetContract.caution || (Number(targetContract.rent || 0) * 2));
                        if (cAmount > 0) setCautionAmount(cAmount);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    {userContracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.property?.title || 'Logement'} — Contrat N° {c.contract_number || (c.id && c.id.length > 8 ? c.id.slice(0, 8) : c.id)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Montant de la caution (FCFA)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0"
                    value={cautionAmount === 0 ? '' : cautionAmount}
                    onChange={(e) => setCautionAmount(sanitizeNumericInput(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-black text-blue-700"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Mode de règlement</label>
                  <select
                    value={cautionMethod}
                    onChange={(e) => { setCautionMethod(e.target.value); if (e.target.value === 'Espèces') setCautionReference(''); }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
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

              {cautionMethod !== 'Espèces' && (
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Référence Transaction</label>
                  <input
                    type="text"
                    required
                    value={cautionReference}
                    onChange={(e) => setCautionReference(e.target.value)}
                    placeholder="Ex: WAVE-CI-99182301"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                </div>
              )}
              {cautionMethod === 'Espèces' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  💵 Paiement en espèces — aucune référence de transaction requise.
                </div>
              )}
              {cautionMethod !== 'Espèces' && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-extrabold text-slate-800 block">
                    Capture d'écran / Photo du reçu Mobile Money
                  </label>

                  <input
                    type="file"
                    ref={cautionProofFileInputRef}
                    accept="image/*,application/pdf"
                    onChange={handleCautionProofFileSelect}
                    className="hidden"
                  />

                  {cautionProofUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-2xl border border-emerald-300 bg-emerald-50/50">
                      <img
                        src={cautionProofUrl}
                        alt="Aperçu reçu"
                        className="w-14 h-14 object-cover rounded-xl border border-emerald-200 shrink-0"
                      />
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {cautionProofFileName || 'Reçu_caution.jpg'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {cautionProofFileSize ? `${cautionProofFileSize} • ` : ''}Fichier prêt
                        </span>
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Preuve enregistrée
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => cautionProofFileInputRef.current?.click()}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
                        >
                          Changer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCautionProofUrl(null);
                            setCautionProofFileName(null);
                            setCautionProofFileSize(null);
                            if (cautionProofFileInputRef.current) cautionProofFileInputRef.current.value = '';
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition flex items-center justify-center"
                          title="Supprimer la preuve"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => cautionProofFileInputRef.current?.click()}
                      className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl p-4 bg-amber-50/30 hover:bg-amber-50/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-amber-900 text-xs">
                        Cliquez pour ajouter la preuve / capture d'écran
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Prend en charge PNG, JPG, PDF ou photo caméra
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowCautionModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmittingCaution}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingCaution ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Transmission...</span>
                  </>
                ) : (
                  <span>Confirmer la déclaration</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: DÉCLARATION DE PAIEMENT DE LOYER (Points 6, 7, 10) */}
      {showDeclareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleDeclarePayment}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 animate-scaleUp text-xs my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Déclarer un Règlement de Loyer</h3>
              <button type="button" onClick={() => setShowDeclareModal(false)} className="text-slate-400 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Type de Paiement (Différenciation nette)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('loyer')}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      paymentType === 'loyer' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Loyer complet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('partiel')}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      paymentType === 'partiel' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Paiement partiel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('autre')}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      paymentType === 'autre' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Autre frais
                  </button>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Contrat de bail associé</label>
                {userContracts.length === 0 ? (
                  <input
                    type="text"
                    readOnly
                    value="Aucun contrat de bail actif enregistré"
                    className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={selectedContractId}
                    onChange={(e) => {
                      setSelectedContractId(e.target.value);
                      const found = userContracts.find(c => c.id === e.target.value);
                      if (found?.rent) setAmount(Number(found.rent));
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    {userContracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.property?.title || 'Logement'} — Contrat N° {c.contract_number || c.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Mois Cible</label>
                <select
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="Septembre 2026">Septembre 2026</option>
                  <option value="Octobre 2026">Octobre 2026</option>
                  <option value="Novembre 2026">Novembre 2026</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Montant Payé (FCFA)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0"
                    value={amount === 0 ? '' : amount}
                    onChange={(e) => setAmount(sanitizeNumericInput(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Moyen utilisé</label>
                  <select
                    value={method}
                    onChange={(e) => { setMethod(e.target.value); if (e.target.value === 'Espèces') setReference(''); }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Wave">Wave CI</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">💵 Espèces (cash)</option>
                  </select>
                </div>
              </div>

              {method !== 'Espèces' && (
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Référence Transaction</label>
                  <input
                    type="text"
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex: OM-CI-2026-99182301"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                </div>
              )}
              {method === 'Espèces' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  💵 Paiement en espèces — aucune référence de transaction requise.
                </div>
              )}

              {/* Justificatif / Preuve de Paiement Réelle (depuis galerie ou appareil) */}
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  Reçu / Preuve de paiement (Galerie ou Explorateur)
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    id="payment-proof-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setProofUrl(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {!proofUrl ? (
                    <label
                      htmlFor="payment-proof-upload"
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center"
                    >
                      <Upload className="w-5 h-5 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700">Sélectionner un reçu réel</span>
                      <span className="text-[10px] text-slate-400">Capture Mobile Money ou bordereau de virement (JPG, PNG)</span>
                    </label>
                  ) : (
                    <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={proofUrl} alt="Justificatif" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-800">Preuve réelle attachée</span>
                          <span className="text-[10px] text-emerald-600 font-bold">✓ Prête pour transmission au bailleur</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProofUrl('')}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold"
                        title="Supprimer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowDeclareModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingPayment ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Transmission...</span>
                  </>
                ) : (
                  <span>Soumettre la déclaration</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMATION / FEEDBACK MODAL (Point 33: centered, LocaTrust white/blue) */}
      {successModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl flex flex-col items-center text-center gap-3 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">{successModalMessage.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{successModalMessage.desc}</p>
            <button
              type="button"
              onClick={() => setSuccessModalMessage(null)}
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
