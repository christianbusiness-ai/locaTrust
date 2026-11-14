'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileCheck,
  ChevronDown,
  Printer,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Building2,
  MessageCircle,
  Send,
  Copy,
  Check,
  Lock,
  Scale,
  RotateCcw,
  PenTool,
  RefreshCw,
  X
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import { getLocaTrustVerificationQR } from '@/lib/qrCode';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import { ActionConfirmationModal, ConfirmationType } from '@/components/common/ActionConfirmationModal';
import { formatFCFA } from '@/lib/utils';
import { sendContractReminderToTenant, sendContractToTenant, sendChatMessage, isValidUuid } from '@/lib/messagingStore';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { triggerCelebration } from '@/lib/celebration';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { LegalContractAnalyzerModal } from './LegalContractAnalyzerModal';
import {
  resolveContractParties,
  resolveBestPartyCni,
  getStoredOwnerSignature,
  getStoredTenantSignature,
  persistOwnerSignature,
  persistTenantSignature
} from '@/lib/contractPartyResolver';
import { collectProofDossierData, generateOfficialProofDossierPdf } from '@/lib/proofDossierPdfGenerator';
import { parseDateSafe, resolveContractDueDay } from '@/lib/payments/rentScheduleEngine';
import {
  getContractExpiryDetails,
  submitContractRenewalRequest,
  acceptContractRenewal,
  refuseContractRenewal
} from '@/lib/contractRenewalManager';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';

interface ContractDetailViewProps {
  onBack?: () => void;
  contractNumber?: string;
  initialContract?: any;
  isAgency?: boolean;
  viewerRole?: 'locataire' | 'proprietaire' | 'agence';
}

export const ContractDetailView: React.FC<ContractDetailViewProps> = ({
  onBack,
  contractNumber = 'CT-2026-00058',
  initialContract,
  isAgency = false,
  viewerRole,
}) => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'document'>('details');

  const [dbContract, setDbContract] = useState<any>(null);
  const [amendmentsList, setAmendmentsList] = useState<any[]>([]);

  // Load real contract from localStorage or props
  const localContract = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_contracts');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const found = parsed.find(
              (c: any) => c.contract_number === contractNumber || c.id === contractNumber
            );
            if (found) return found;
          }
        }
      } catch {}
    }
    return null;
  }, [contractNumber]);

  React.useEffect(() => {
    async function loadFromDb() {
      if (!contractNumber) return;
      try {
        const query = isValidUuid(contractNumber)
          ? supabase.from('contracts').select('*, property:properties(*)').or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`)
          : supabase.from('contracts').select('*, property:properties(*)').eq('contract_number', contractNumber);
        const { data, error } = await query.maybeSingle();

        let appDocs: any = {};
        try {
          const { data: apps } = await supabase
            .from('rental_applications')
            .select('id, property_id, status, documents')
            .order('created_at', { ascending: false })
            .limit(40);
          if (apps && Array.isArray(apps)) {
            const matchedApp = apps.find((a: any) => {
              const d = a.documents && typeof a.documents === 'object' ? a.documents : {};
              return d.contract_number === contractNumber || (data?.property_id && a.property_id === data.property_id && d.contract_number);
            });
            if (matchedApp?.documents && typeof matchedApp.documents === 'object') {
              appDocs = matchedApp.documents;
            }
          }
        } catch {}

        // Charger les avenants associés à ce contrat
        const loadedAmendments: any[] = [];
        const seenAmIds = new Set<string>();
        if (typeof window !== 'undefined') {
          try {
            const rawAm = localStorage.getItem('locatrust_contract_amendments');
            if (rawAm) {
              const parsedAm = JSON.parse(rawAm);
              if (Array.isArray(parsedAm)) {
                parsedAm.forEach((am: any) => {
                  if (am.contract_number === contractNumber || am.contract_id === contractNumber) {
                    const k = am.amendment_number || am.id;
                    if (k && !seenAmIds.has(k)) {
                      seenAmIds.add(k);
                      loadedAmendments.push(am);
                    }
                  }
                });
              }
            }
          } catch {}
        }
        if (Array.isArray(appDocs.amendments)) {
          appDocs.amendments.forEach((am: any) => {
            const k = am.amendment_number || am.id;
            if (k && !seenAmIds.has(k)) {
              seenAmIds.add(k);
              loadedAmendments.push(am);
            }
          });
        }
        setAmendmentsList(loadedAmendments);

        if (data && !error) {
          const ids = [data.owner_id, data.tenant_id, data.agency_id].filter(Boolean);
          let ownerProf: any = null;
          let tenantProf: any = null;
          if (ids.length > 0) {
            try {
              const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
              if (profs) {
                ownerProf = profs.find(p => p.id === data.owner_id || p.id === data.agency_id);
                tenantProf = profs.find(p => p.id === data.tenant_id);
              }
            } catch {}
          }
          const realTenantSig =
            data.tenant_signature ||
            data.tenant_signature_url ||
            appDocs.tenant_signature_url ||
            ((data.status === 'actif' || data.status === 'contrat_actif') ? getCertifiedSignatureDataUrl(tenantProf?.full_name || 'Locataire', 'locataire') : null);
          const isTrulySigned = Boolean(realTenantSig && String(realTenantSig).length > 15);
          const isTermine =
            data.status === 'termine' ||
            data.status === 'resilie' ||
            data.status === 'cloture' ||
            appDocs.contract_status === 'termine';

          setDbContract({
            ...data,
            status: isTermine ? 'termine' : (isTrulySigned ? 'actif' : 'en_attente'),
            tenant_signed: isTrulySigned,
            tenant_signature: realTenantSig,
            tenant_signature_url: realTenantSig,
            renewal_status: data.renewal_status || appDocs.renewal_status,
            renewal_duration_requested: data.renewal_duration_requested || appDocs.renewal_duration_requested,
            monthly_rent: appDocs.new_rent || data.monthly_rent,
            duration_months: appDocs.duration_months || data.duration_months,
            charges_amount: appDocs.new_charges ?? data.charges_amount,
            declared_equipments: data.declared_equipments ?? appDocs.declared_equipments,
            owner: ownerProf || data.owner,
            tenant: tenantProf || data.tenant
          });
        }
      } catch (e) {
        console.warn('Erreur chargement contrat Supabase:', e);
      }
    }
    loadFromDb();
  }, [contractNumber]);

  const realContract = dbContract || initialContract || localContract;
  const contract = realContract;
  const leaseType = (realContract?.usage_destination || (realContract?.property as any)?.usage_destination || 'habitation') as 'habitation' | 'professionnel';

  const isTenantView =
    viewerRole === 'locataire' ||
    profile?.account_type === 'locataire' ||
    (profile as any)?.role === 'locataire' ||
    user?.user_metadata?.account_type === 'locataire' ||
    user?.user_metadata?.role === 'locataire' ||
    (typeof window !== 'undefined' && localStorage.getItem('locatrust_current_role') === 'locataire') ||
    Boolean(user?.id && (realContract?.tenant_id === user.id || realContract?.tenant?.id === user.id));

  const ownerDisplayName =
    realContract?.owner?.full_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    (isAgency ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur');

  const ownerDisplayPhone =
    realContract?.owner?.phone ||
    profile?.phone ||
    user?.user_metadata?.phone ||
    '+225 07 00 00 00 00';

  const tenantData = React.useMemo(() => {
    if (realContract) {
      const rentVal = Number(dbContract?.monthly_rent || realContract.monthly_rent || realContract.rent || realContract.rent_amount || 0);
      const cautionVal = Number(dbContract?.caution_amount || realContract.caution_amount || realContract.caution || rentVal * 2);
      const chargesVal = Number(dbContract?.charges_amount ?? realContract.charges_amount ?? realContract.charges ?? 0);

      return {
        name: realContract.tenant?.full_name || realContract.tenant_name || user?.user_metadata?.full_name || 'Locataire',
        phone: realContract.tenant?.phone || realContract.tenant_phone || '+225 07 00 00 00 00',
        email: realContract.tenant?.email || realContract.tenant_email || 'locataire@locatrust.ci',
        cni: resolveBestPartyCni([realContract.tenant?.cni_number, realContract.tenant_cni], 'tenant'),
        address: realContract.property?.address || realContract.property_address || 'Abidjan, Côte d\'Ivoire',
        propertyTitle: realContract.property?.title || realContract.property_title || 'Logement loué',
        propertyAddress: realContract.property?.address || realContract.property_address || 'Côte d\'Ivoire',
        rent: rentVal,
        caution: cautionVal,
        charges: chargesVal,
        startDate: realContract.signed_date || realContract.start_date || (realContract.created_at ? new Date(realContract.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')),
        dueDay: resolveContractDueDay(realContract),
        firstDueDate: (() => {
          const dDay = resolveContractDueDay(realContract);
          const sObj = parseDateSafe(realContract.start_date || realContract.signed_date || realContract.created_at || new Date());
          const firstDue = new Date(sObj.getFullYear(), sObj.getMonth() + 1, 1);
          const maxDay = new Date(firstDue.getFullYear(), firstDue.getMonth() + 1, 0).getDate();
          firstDue.setDate(Math.min(dDay, maxDay));
          return firstDue.toLocaleDateString('fr-FR');
        })(),
        duration: Number(dbContract?.duration_months || realContract.duration_months || 12),
        dateSignature: realContract.signed_date || (realContract.created_at ? new Date(realContract.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')),
        periode: (() => {
          const dur = Number(dbContract?.duration_months || realContract.duration_months || 12);
          const sDateStr = realContract.signed_date || realContract.start_date || (realContract.created_at ? new Date(realContract.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'));
          try {
            const rawS = realContract.start_date || realContract.signed_date || new Date();
            let sObj = new Date(rawS);
            if (isNaN(sObj.getTime()) && typeof rawS === 'string' && rawS.includes('/')) {
              const p = rawS.split('/');
              sObj = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
            }
            if (!isNaN(sObj.getTime())) {
              const eObj = new Date(sObj);
              eObj.setMonth(eObj.getMonth() + dur);
              return `${sDateStr} au ${eObj.toLocaleDateString('fr-FR')} (${dur} mois)`;
            }
          } catch {}
          return `${sDateStr} (${dur} mois)`;
        })(),
        avatar: realContract.tenant?.avatar_url || ''
      };
    }
    return {
      name: 'Locataire Preneur',
      phone: '+225 07 00 00 00 00',
      email: 'locataire@locatrust.ci',
      cni: 'CI002894129',
      address: 'Abidjan, Côte d\'Ivoire',
      propertyTitle: 'Bien immobilier',
      propertyAddress: 'Abidjan - Côte d\'Ivoire',
      rent: 0,
      caution: 0,
      charges: 0,
      startDate: '07/11/2026',
      dueDay: 7,
      firstDueDate: '07/12/2026',
      duration: 12,
      dateSignature: '15 octobre 2026',
      periode: '01/10/2026 (12 mois)',
      avatar: ''
    };
  }, [realContract, dbContract]);

  const propertyDetails = React.useMemo(() => {
    const p = realContract?.property || {};
    const declaredEq =
      realContract?.declared_equipments ??
      p.declared_equipments ??
      (Array.isArray(realContract?.equipments)
        ? realContract.equipments.join(', ')
        : Array.isArray(p.equipments)
        ? p.equipments.join(', ')
        : realContract?.equipments || p.equipments || '');
    return {
      image: p.main_image || p.image_url || p.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80',
      surface: p.surface || realContract?.surface || 85,
      rooms: p.rooms || realContract?.rooms || 3,
      bedrooms: p.bedrooms || realContract?.bedrooms || 2,
      bathrooms: p.bathrooms || realContract?.bathrooms || 1,
      equipments: declaredEq,
      type: p.property_type || p.type || 'Logement loué'
    };
  }, [realContract]);

  // Calcul d'éligibilité au renouvellement : s'active exactement à 1 mois (<= 31 jours) de la fin du contrat
  const renewalInfo = React.useMemo(() => {
    const details = getContractExpiryDetails(realContract);
    return {
      diffDays: details.diffDays,
      monthsRemaining: details.monthsRemaining,
      endDateFormatted: details.endDateFormatted,
      isEligible: details.isAtOneMonthOrLess
    };
  }, [realContract]);

  const [hasRequestedRenewal, setHasRequestedRenewal] = useState(false);

  const handleRequestRenewal = async () => {
    if (!renewalInfo.isEligible) return;
    const tenantName = tenantData.name;
    const propertyTitle = tenantData.propertyTitle;

    try {
      await submitContractRenewalRequest({
        contract: realContract || { contract_number: contractNumber },
        tenantName,
        propertyTitle,
        durationMonths: Number(tenantData.duration || 12)
      });

      setHasRequestedRenewal(true);
      setDbContract((prev: any) => ({ ...(prev || realContract), renewal_status: 'demande' }));
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      setConfirmationModal({
        isOpen: true,
        type: 'download',
        title: 'Demande de renouvellement transmise !',
        message: `Votre demande officielle de renouvellement de bail a été transmise directement à votre bailleur. Vous recevrez une notification dès sa confirmation.`,
        confirmText: 'Compris',
        withCelebration: true
      });
    } catch (e) {
      console.warn('Erreur demande renouvellement:', e);
    }
  };

  const [showQrZoomModal, setShowQrZoomModal] = useState(false);

  // Real Handwritten Signature States from real contract
  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(() => {
    return realContract?.owner_signature_url || realContract?.owner_signature || realContract?.ownerSignatureUrl || realContract?.landlord_signature || getStoredOwnerSignature() || null;
  });
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(() => {
    let mapSig: string | null = null;
    if (typeof window !== 'undefined' && contractNumber) {
      try {
        const rawMap = localStorage.getItem('locatrust_signed_contracts_map');
        if (rawMap) {
          const parsedMap = JSON.parse(rawMap);
          const candidateSig = parsedMap?.[contractNumber]?.tenant_signature_url;
          if (candidateSig && typeof candidateSig === 'string' && candidateSig.startsWith('data:image/')) {
            mapSig = candidateSig;
          }
        }
      } catch {}
    }
    const directSig = realContract?.tenant_signature_url || realContract?.tenant_signature || realContract?.tenantSignatureUrl || realContract?.applicant_signature;
    if (directSig && typeof directSig === 'string' && directSig.length > 15) {
      return directSig;
    }
    if (mapSig) return mapSig;
    if (realContract?.status === 'actif' || realContract?.status === 'contrat_actif' || realContract?.tenant_signed) {
      return getCertifiedSignatureDataUrl(realContract?.tenant?.full_name || 'Locataire', 'locataire');
    }
    return null;
  });

  // Synchronisation dynamique dès chargement du contrat réel
  React.useEffect(() => {
    if (realContract) {
      let mapSig: string | null = null;
      if (typeof window !== 'undefined' && contractNumber) {
        try {
          const rawMap = localStorage.getItem('locatrust_signed_contracts_map');
          if (rawMap) {
            const parsedMap = JSON.parse(rawMap);
            const candidateSig = parsedMap?.[contractNumber]?.tenant_signature_url;
            if (candidateSig && typeof candidateSig === 'string' && candidateSig.startsWith('data:image/')) {
              mapSig = candidateSig;
            }
          }
        } catch {}
      }
      const sigOwner = realContract.owner_signature_url || realContract.owner_signature || realContract.ownerSignatureUrl || realContract.landlord_signature || getStoredOwnerSignature();
      const directSig = realContract.tenant_signature_url || realContract.tenant_signature || realContract.tenantSignatureUrl || realContract.applicant_signature;
      const sigTenant =
        (directSig && typeof directSig === 'string' && directSig.length > 15 ? directSig : null) ||
        mapSig ||
        ((realContract.status === 'actif' || realContract.status === 'contrat_actif' || realContract.tenant_signed) ? getCertifiedSignatureDataUrl(realContract?.tenant?.full_name || 'Locataire', 'locataire') : null);
      if (sigOwner) setOwnerSignatureUrl(sigOwner);
      setTenantSignatureUrl(sigTenant || null);
    }
  }, [realContract, contractNumber]);
  const [activeSigningParty, setActiveSigningParty] = useState<'proprietaire' | 'locataire' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [relanceSuccess, setRelanceSuccess] = useState<string | null>(null);

  // Workflow modals states
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    details?: string;
    withCelebration?: boolean;
    confirmText?: string;
  } | null>(null);

  const [isDownloadBlockedModalOpen, setIsDownloadBlockedModalOpen] = useState(false);
  const [isAvenantInitiatedOpen, setIsAvenantInitiatedOpen] = useState(false);
  const [isAvenantFormOpen, setIsAvenantFormOpen] = useState(false);
  const [isTerminationFormOpen, setIsTerminationFormOpen] = useState(false);
  const [avenantData, setAvenantData] = useState({
    type: 'Modification du montant du loyer',
    effectiveDate: new Date().toISOString().split('T')[0],
    newRent: tenantData.rent,
    additionalMonths: 0,
    newCharges: tenantData.charges,
    clauses: 'Avenant n°1 : Révision concertée des conditions locatives sans annulation du contrat de bail initial.'
  });
  const [terminationData, setTerminationData] = useState({
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: 'Congé régulier donné par le locataire',
    noticeMonths: 3,
    remainingRent: 0,
    cautionRestituted: tenantData.caution,
    deductions: 0,
    exitInspectionDate: new Date().toISOString().split('T')[0]
  });

  // Point 8 & 12: Analyse juridique et gestion de fin de contrat
  const [isAnalyzerModalOpen, setIsAnalyzerModalOpen] = useState(false);
  const [endOfContractMode, setEndOfContractMode] = useState<'renouvellement' | 'fin_contrat'>('fin_contrat');
  const [makePropertyAvailableAfterTermination, setMakePropertyAvailableAfterTermination] = useState(true);

  const isBothSigned = Boolean(ownerSignatureUrl && tenantSignatureUrl);
  const isAwaitingTenant = Boolean(ownerSignatureUrl && !tenantSignatureUrl);

  const handleDownloadAvenantPdf = async (am: any) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LOCATRUST — AVENANT OFFICIEL AU CONTRAT DE BAIL', 15, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Avenant N° ${am.amendment_number || 'AV-1'} • Lié au Contrat N° ${contractNumber}`, 15, 24);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. PARTIES SIGNATAIRES', 15, 45);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Bailleur / Gestionnaire : ${ownerDisplayName} (${ownerDisplayPhone})`, 15, 53);
      doc.text(`Locataire (Preneur) : ${tenantData.name} (${tenantData.phone})`, 15, 60);
      doc.text(`Bien immobilier : ${tenantData.propertyTitle} — ${tenantData.propertyAddress}`, 15, 67);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("2. OBJET DE L'AVENANT & DATE D'EFFET", 15, 80);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Type de modification : ${am.type || 'Modification contractuelle'}`, 15, 88);
      doc.text(`Date de prise d'effet : ${am.effective_date || am.effectiveDate || new Date().toLocaleDateString('fr-FR')}`, 15, 95);
      if (am.new_rent || am.newRent) {
        doc.text(`Loyer mensuel applicable : ${formatFCFA(Number(am.new_rent || am.newRent))}`, 15, 102);
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('3. CLAUSES ET STIPULATIONS CONVENUES', 15, 116);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitClauses = doc.splitTextToSize(
        String(am.clauses || 'Les autres dispositions du bail initial demeurent inchangées et conservent leur plein effet juridique.'),
        180
      );
      doc.text(splitClauses, 15, 124);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Document certifié conforme à la Loi n° 2019-576 du 26 juin 2019 • Généré le ${new Date().toLocaleDateString('fr-FR')}`,
        15,
        280
      );
      doc.save(`Avenant_${am.amendment_number || contractNumber}.pdf`);
    } catch (e) {
      console.warn('Erreur génération PDF Avenant:', e);
    }
  };

  const handleRelanceInternal = (canal: 'Messagerie' | 'WhatsApp' | 'SMS' = 'Messagerie') => {
    // Liaison réelle avec la messagerie interne LocaTrust du locataire
    const targetTenantId = (contract as any)?.tenant_id || (tenantData as any)?.id || 'usr_support';
    sendContractReminderToTenant(targetTenantId, contractNumber, tenantData.name, tenantData.propertyTitle);
    
    setRelanceSuccess(`Relance enregistrée dans la boîte LocaTrust de ${tenantData.name} (${tenantData.phone})`);
    setTimeout(() => setRelanceSuccess(null), 6000);

    setConfirmationModal({
      isOpen: true,
      type: 'reminder_sent',
      title: 'Relance transmise au locataire',
      message: `La notification de relance pour la signature du contrat N° ${contractNumber} a été envoyée directement dans la messagerie interne de ${tenantData.name}.`,
      details: `Bien concerné : ${tenantData.propertyTitle} • Un rappel de courtoisie ${canal} a également été généré.`,
      withCelebration: true,
      confirmText: 'Parfait'
    });
  };

  const handleAcceptRenewal = async () => {
    if (!window.confirm(`Accepter formellement la demande de renouvellement du contrat N° ${contractNumber} pour une durée additionnelle de 12 mois ?`)) {
      return;
    }
    try {
      await acceptContractRenewal({
        contract: realContract || { contract_number: contractNumber },
        durationMonths: 12
      });
      triggerCelebration();
      setConfirmationModal({
        isOpen: true,
        type: 'success',
        title: 'Bail renouvelé avec succès !',
        message: `La reconduction du contrat N° ${contractNumber} (+12 mois) a été validée. Le preneur a été immédiatement notifié.`,
        details: 'Le bail poursuit son cours légal jusqu\'au nouveau terme convenu sans interruption.',
        withCelebration: true
      });
    } catch (err: any) {
      alert('Erreur lors de l\'acceptation du renouvellement : ' + (err?.message || 'Erreur'));
    }
  };

  const handleRefuseRenewal = async () => {
    const reason = window.prompt(
      "Indiquez le motif de non-reconduction du contrat de bail :",
      "Terme normal convenu du bail sans reconduction."
    );
    if (!reason) return;
    try {
      await refuseContractRenewal({
        contract: realContract || { contract_number: contractNumber },
        reason
      });
      setConfirmationModal({
        isOpen: true,
        type: 'success',
        title: 'Non-reconduction enregistrée',
        message: `Le refus de renouvellement pour le contrat N° ${contractNumber} a été notifié au preneur.`,
        details: 'Le bail prendra fin à son terme convenu. Les démarches de clôture et de restitution s\'appliqueront à cette échéance.',
        confirmText: 'Compris'
      });
    } catch (err: any) {
      alert('Erreur lors du refus de renouvellement : ' + (err?.message || 'Erreur'));
    }
  };

  // PDF Generator with mandatory 2-party signature rule (Point 10)
  const handleDownloadPDF = async () => {
    if (!isBothSigned) {
      setIsDownloadBlockedModalOpen(true);
      return;
    }

    const leaseType = (contract?.usage_destination || (contract?.property as any)?.usage_destination || 'habitation') as 'habitation' | 'professionnel';
    
    let surface = (contract?.property as any)?.surface;
    let rooms = (contract?.property as any)?.rooms;
    let bedrooms = (contract?.property as any)?.bedrooms;
    let bathrooms = (contract?.property as any)?.bathrooms;
    let equipments =
      realContract?.declared_equipments !== undefined
        ? (realContract.declared_equipments ? [realContract.declared_equipments] : [])
        : (contract?.property as any)?.equipments;
    let propertyDescription = (contract?.property as any)?.description;

    try {
      const stored = localStorage.getItem('locatrust_properties');
      if (stored) {
        const parsedProps = JSON.parse(stored);
        const match = parsedProps.find((p: any) =>
          ((contract as any)?.property_id && (p.id === (contract as any)?.property_id || p._id === (contract as any)?.property_id)) ||
          (tenantData.propertyTitle && p.title && p.title.toLowerCase().includes(tenantData.propertyTitle.toLowerCase())) ||
          (tenantData.propertyAddress && p.location && tenantData.propertyAddress.toLowerCase().includes(p.location.toLowerCase()))
        );
        if (match) {
          surface = surface || match.surface;
          rooms = rooms || match.rooms;
          bedrooms = bedrooms || match.bedrooms;
          bathrooms = bathrooms || match.bathrooms;
          propertyDescription = propertyDescription || match.description;
        }
      }
    } catch (e) {
      console.warn('Property lookup error', e);
    }

    const resolvedParties = await resolveContractParties({
      ownerId: realContract?.owner_id || realContract?.owner?.id || user?.id,
      tenantId: realContract?.tenant_id || realContract?.tenant?.id,
      currentProfile: profile,
      currentUser: user,
      ownerFallback: {
        name: ownerDisplayName,
        phone: ownerDisplayPhone,
        email: realContract?.owner?.email || user?.email || (profile as any)?.email,
        address: realContract?.owner?.address || (profile as any)?.address || profile?.commune || profile?.city,
        cni: realContract?.owner?.cni_number || profile?.cni_number || (profile as any)?.rccm_number,
        signatureUrl: ownerSignatureUrl,
      },
      tenantFallback: {
        name: tenantData.name,
        phone: tenantData.phone,
        email: tenantData.email,
        address: tenantData.address,
        cni: tenantData.cni,
        signatureUrl: tenantSignatureUrl,
      }
    });

    await generateOfficialContractPdf({
      contractNumber,
      isAgency,
      ownerName: resolvedParties.owner.name,
      mandantName: isAgency ? ((realContract?.property as any)?.mandant_name || (realContract as any)?.mandant_name) : undefined,
      ownerPhone: resolvedParties.owner.phone,
      ownerEmail: resolvedParties.owner.email,
      ownerAddress: resolvedParties.owner.address,
      ownerCni: resolvedParties.owner.cni,
      tenantName: resolvedParties.tenant.name,
      tenantPhone: resolvedParties.tenant.phone,
      tenantEmail: resolvedParties.tenant.email,
      tenantAddress: resolvedParties.tenant.address,
      tenantCni: resolvedParties.tenant.cni,
      propertyTitle: tenantData.propertyTitle,
      propertyAddress: tenantData.propertyAddress,
      surface,
      rooms,
      bedrooms,
      bathrooms,
      equipments,
      amenities: equipments,
      propertyDescription,
      durationMonths: tenantData.duration,
      startDate: tenantData.startDate,
      rent: tenantData.rent,
      cautionAmount: tenantData.caution,
      cautionMonths: tenantData.rent > 0 ? Number((tenantData.caution / tenantData.rent).toFixed(2)) : (realContract?.caution_months || 2),
      chargesAmount: tenantData.charges,
      dueDay: tenantData.dueDay,
      ownerSignatureUrl: resolvedParties.owner.signatureUrl || ownerSignatureUrl,
      tenantSignatureUrl: resolvedParties.tenant.signatureUrl || tenantSignatureUrl,
      leaseType,
      usageDestination: leaseType,
      authorizedActivity: contract?.authorized_activity || (contract?.property as any)?.authorized_activity || ''
    });

    setConfirmationModal({
      isOpen: true,
      type: 'download',
      title: 'Contrat final certifié téléchargé',
      message: `Le contrat officiel N° ${contractNumber} comportant les deux signatures électroniques certifiées a été généré avec succès.`,
      withCelebration: true
    });
  };

  const handleSendContractToTenantInbox = () => {
    const targetTenantId = (contract as any)?.tenant_id || (tenantData as any)?.id || 'usr_support';
    sendContractToTenant(targetTenantId, {
      contractNumber,
      propertyTitle: tenantData.propertyTitle,
      propertyAddress: tenantData.propertyAddress,
      rentAmount: tenantData.rent,
      cautionAmount: tenantData.caution,
      durationMonths: tenantData.duration,
      startDate: tenantData.startDate,
      ownerName: ownerDisplayName,
      tenantName: tenantData.name,
      ownerSigned: Boolean(ownerSignatureUrl),
      tenantSigned: Boolean(tenantSignatureUrl)
    });

    triggerCelebration('send');

    setConfirmationModal({
      isOpen: true,
      type: 'contract_sent',
      title: 'Contrat envoyé au locataire',
      message: `Le contrat N° ${contractNumber} a été déposé dans la boîte de messagerie interne de ${tenantData.name}.`,
      details: 'Le locataire peut maintenant l\'ouvrir, le consulter en ligne et apposer sa signature électronique.',
      withCelebration: true
    });
  };

  const handleSaveAvenant = async () => {
    setIsAvenantFormOpen(false);
    const nowIso = new Date().toISOString();
    const amendmentId = crypto.randomUUID();
    const amendmentNumber = `AV-${contractNumber}-${Date.now().toString().slice(-4)}`;
    const newAmendmentObj = {
      id: amendmentId,
      contract_id: realContract?.id || contractNumber,
      contract_number: contractNumber,
      amendment_number: amendmentNumber,
      type: avenantData.type,
      effective_date: avenantData.effectiveDate,
      new_rent: avenantData.newRent > 0 ? avenantData.newRent : tenantData.rent,
      additional_months: avenantData.additionalMonths || 0,
      new_charges: avenantData.newCharges >= 0 ? avenantData.newCharges : tenantData.charges,
      clauses: avenantData.clauses,
      created_at: nowIso,
      status: 'actif'
    };

    setAmendmentsList((prev) => [newAmendmentObj, ...prev]);

    if (typeof window !== 'undefined') {
      try {
        const rawAms = localStorage.getItem('locatrust_contract_amendments');
        const parsedAms = rawAms ? JSON.parse(rawAms) : [];
        const nextAms = [newAmendmentObj, ...(Array.isArray(parsedAms) ? parsedAms : [])];
        localStorage.setItem('locatrust_contract_amendments', JSON.stringify(nextAms));
      } catch {}

      try {
        const rawContracts = localStorage.getItem('locatrust_contracts');
        if (rawContracts) {
          const parsedContracts = JSON.parse(rawContracts);
          if (Array.isArray(parsedContracts)) {
            const updatedContracts = parsedContracts.map((c: any) => {
              if (c.contract_number === contractNumber || c.id === contractNumber) {
                const nextRent = avenantData.newRent > 0 ? Number(avenantData.newRent) : (c.monthly_rent || c.rent_amount);
                const nextDur = (Number(c.duration_months) || 12) + (Number(avenantData.additionalMonths) || 0);
                return {
                  ...c,
                  monthly_rent: nextRent,
                  rent_amount: nextRent,
                  duration_months: nextDur,
                  charges_amount: avenantData.newCharges >= 0 ? Number(avenantData.newCharges) : c.charges_amount,
                  amendments: [newAmendmentObj, ...(Array.isArray(c.amendments) ? c.amendments : [])]
                };
              }
              return c;
            });
            localStorage.setItem('locatrust_contracts', JSON.stringify(updatedContracts));
            window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: { contracts: updatedContracts } }));
          }
        }
      } catch {}
    }

    setDbContract((prev: any) => {
      const base = prev || realContract || {};
      const nextRent = avenantData.newRent > 0 ? Number(avenantData.newRent) : (base.monthly_rent || base.rent_amount);
      const nextDur = (Number(base.duration_months) || 12) + (Number(avenantData.additionalMonths) || 0);
      return {
        ...base,
        monthly_rent: nextRent,
        rent_amount: nextRent,
        duration_months: nextDur,
        charges_amount: avenantData.newCharges >= 0 ? Number(avenantData.newCharges) : base.charges_amount,
        amendments: [newAmendmentObj, ...(Array.isArray(base.amendments) ? base.amendments : [])]
      };
    });

    // 1. Sauvegarde dans Supabase (contract_amendments + contracts + rental_applications)
    try {
      const realContractId = realContract?.id || contractNumber;
      await supabase.from('contract_amendments').insert({
        id: amendmentId,
        contract_id: realContractId,
        amendment_number: amendmentNumber,
        type: avenantData.type,
        effective_date: avenantData.effectiveDate,
        new_rent: avenantData.newRent > 0 ? avenantData.newRent : null,
        clauses: avenantData.clauses,
        owner_id: user?.id || realContract?.owner_id,
        tenant_id: realContract?.tenant_id,
        agency_id: realContract?.agency_id || null,
        status: 'actif',
        verification_token: `tok_av_${Date.now()}`
      });
    } catch {}

    try {
      const nextRent = avenantData.newRent > 0 ? Number(avenantData.newRent) : tenantData.rent;
      const nextDur = tenantData.duration + (Number(avenantData.additionalMonths) || 0);
      const contractPatch: any = {
        monthly_rent: nextRent,
        duration_months: nextDur,
        updated_at: nowIso
      };
      if (isValidUuid(contractNumber)) {
        await supabase.from('contracts').update(contractPatch).or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
      } else {
        await supabase.from('contracts').update(contractPatch).eq('contract_number', contractNumber);
      }

      const propId = realContract?.property_id || realContract?.property?.id;
      if (propId && isValidUuid(propId)) {
        const { data: apps } = await supabase.from('rental_applications').select('*').eq('property_id', propId);
        if (apps && Array.isArray(apps)) {
          for (const appRow of apps) {
            const docs = appRow.documents && typeof appRow.documents === 'object' ? appRow.documents : {};
            if (docs.contract_number === contractNumber || appRow.tenant_id === realContract?.tenant_id) {
              const prevAms = Array.isArray(docs.amendments) ? docs.amendments : [];
              await supabase
                .from('rental_applications')
                .update({
                  documents: {
                    ...docs,
                    new_rent: nextRent,
                    duration_months: nextDur,
                    new_charges: avenantData.newCharges,
                    amendments: [newAmendmentObj, ...prevAms]
                  }
                })
                .eq('id', appRow.id);
            }
          }
        }
      }
    } catch (sbErr) {
      console.warn('Notice Supabase contract update for avenant:', sbErr);
    }

    // 2. Notification à l'autre partie
    try {
      const targetUserId = isTenantView
        ? (realContract?.owner_id || realContract?.owner?.id)
        : (realContract?.tenant_id || realContract?.tenant?.id);
      const notifTitle = `Avenant N° ${amendmentNumber} enregistré sur le bail ${contractNumber}`;
      const notifMsg = `Un avenant (${avenantData.type}) prenant effet le ${avenantData.effectiveDate} a été rattaché au contrat N° ${contractNumber}.`;
      const notifPayload = {
        contractNumber,
        contract_number: contractNumber,
        amendmentNumber,
        amendment: newAmendmentObj,
        targetTab: 'contracts'
      };
      if (targetUserId && isValidUuid(targetUserId)) {
        await supabase.from('notifications').insert({
          id: crypto.randomUUID(),
          user_id: targetUserId,
          title: notifTitle,
          message: notifMsg,
          description: notifMsg,
          content: notifMsg,
          type: 'contrat',
          category: 'contrat',
          target_role: isTenantView ? 'proprietaire' : 'locataire',
          read: false,
          is_read: false,
          data: notifPayload,
          payload: notifPayload
        });
      }
      if (targetUserId) {
        pushGlobalNotification({
          title: notifTitle,
          description: notifMsg,
          category: 'contrat',
          targetTab: 'contracts',
          targetRole: isTenantView ? 'proprietaire' : 'locataire',
          targetUserId,
          senderUserId: user?.id,
          payload: notifPayload
        });
      }
    } catch (notifErr) {
      console.warn('Notice notification avenant:', notifErr);
    }

    triggerCelebration('approve');
    setConfirmationModal({
      isOpen: true,
      type: 'avenant_initiated',
      title: 'Avenant au contrat créé avec succès',
      message: `L'avenant N° ${amendmentNumber} lié au contrat original N° ${contractNumber} a été enregistré, appliqué et notifié.`,
      details: `Le contrat initial reste conservé et l'avenant est téléchargeable en PDF dans « Documents liés ». Prise d'effet : ${avenantData.effectiveDate}.`,
      withCelebration: true
    });
  };

  const isContractTerminated =
    realContract?.status === 'termine' ||
    realContract?.status === 'cloture' ||
    realContract?.status === 'resilie';

  const handleConfirmTermination = async () => {
    setIsTerminationFormOpen(false);
    const nowIso = new Date().toISOString();
    
    if (endOfContractMode === 'renouvellement') {
      try {
        const res = await acceptContractRenewal({
          contract: realContract || { contract_number: contractNumber },
          durationMonths: 12
        });
        setDbContract((prev: any) => ({
          ...(prev || realContract),
          status: 'actif',
          renewal_status: 'accepte',
          end_date: res.newEndDate,
          duration_months: (Number((prev || realContract)?.duration_months) || tenantData.duration || 12) + 12
        }));
      } catch (e) {
        console.warn('Erreur renouvellement via modal:', e);
      }
      triggerCelebration('approve');
      setConfirmationModal({
        isOpen: true,
        type: 'avenant_initiated',
        title: 'Renouvellement du bail confirmé (+12 mois)',
        message: `Le bail N° ${contractNumber} pour ${tenantData.name} a été officiellement reconduit pour une période additionnelle de 12 mois.`,
        details: `Bien : ${tenantData.propertyTitle} • La nouvelle échéance et la notification ont été transmises au locataire.`,
        withCelebration: true
      });
      return;
    }

    const restitutionAmount = Math.max(0, tenantData.caution - terminationData.deductions);
    const availabilityMessage = makePropertyAvailableAfterTermination
      ? " Le logement a été automatiquement remis disponible dans le fil d'annonces de location."
      : " Le logement reste en maintenance avant relocation.";

    setDbContract((prev: any) => ({
      ...(prev || realContract),
      status: 'termine',
      closed_at: nowIso,
      caution_restituted_amount: restitutionAmount,
      termination_effective_date: terminationData.effectiveDate,
      termination_reason: terminationData.reason,
      deductions_amount: terminationData.deductions
    }));

    // 1. Mettre à jour le statut du contrat à 'termine' dans localStorage et Supabase
    try {
      if (typeof window !== 'undefined') {
        try {
          const rawSignedMap = localStorage.getItem('locatrust_signed_contracts_map');
          const signedMap = rawSignedMap ? JSON.parse(rawSignedMap) : {};
          if (signedMap[contractNumber]) {
            signedMap[contractNumber] = {
              ...signedMap[contractNumber],
              status: 'termine',
              closed_at: nowIso
            };
            localStorage.setItem('locatrust_signed_contracts_map', JSON.stringify(signedMap));
          }
        } catch {}

        const stored = localStorage.getItem('locatrust_contracts');
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const updated = list.map((c: any) => {
              if (c.contract_number === contractNumber || c.id === contractNumber) {
                return {
                  ...c,
                  status: 'termine',
                  closed_at: nowIso,
                  caution_restituted_amount: restitutionAmount,
                  termination_effective_date: terminationData.effectiveDate,
                  termination_reason: terminationData.reason,
                  deductions_amount: terminationData.deductions
                };
              }
              return c;
            });
            localStorage.setItem('locatrust_contracts', JSON.stringify(updated));
          }
        }
      }

      if (isValidUuid(contractNumber)) {
        await supabase
          .from('contracts')
          .update({
            status: 'termine',
            updated_at: nowIso
          })
          .or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
      } else {
        await supabase
          .from('contracts')
          .update({
            status: 'termine',
            updated_at: nowIso
          })
          .eq('contract_number', contractNumber);
      }

      // 2. Mettre à jour rental_applications.documents pour persister la clôture & restitution de caution
      const propId = realContract?.property_id || (realContract?.property as any)?.id;
      const propTitle = tenantData.propertyTitle;

      try {
        if (propId && isValidUuid(propId)) {
          const { data: apps } = await supabase.from('rental_applications').select('*').eq('property_id', propId);
          if (apps && Array.isArray(apps)) {
            for (const appRow of apps) {
              const docs = appRow.documents && typeof appRow.documents === 'object' ? appRow.documents : {};
              if (docs.contract_number === contractNumber || appRow.tenant_id === realContract?.tenant_id) {
                await supabase
                  .from('rental_applications')
                  .update({
                    documents: {
                      ...docs,
                      contract_status: 'termine',
                      closed_at: nowIso,
                      caution_restituted_amount: restitutionAmount,
                      deductions_amount: terminationData.deductions,
                      termination_effective_date: terminationData.effectiveDate,
                      termination_reason: terminationData.reason,
                      exit_inspection_date: terminationData.exitInspectionDate
                    }
                  })
                  .eq('id', appRow.id);
              }
            }
          }
        }
      } catch {}

      // 3. Gestion du logement (Option A — Republier vs Option B — Conserver non publié)
      if (makePropertyAvailableAfterTermination) {
        if (propId && isValidUuid(propId)) {
          await supabase.from('properties').update({ status: 'disponible' }).eq('id', propId);
        }
        if (typeof window !== 'undefined') {
          const storedProps = localStorage.getItem('locatrust_properties');
          if (storedProps) {
            const parsed = JSON.parse(storedProps);
            if (Array.isArray(parsed)) {
              const updatedProps = parsed.map((p: any) => {
                if (
                  (propId && (p.id === propId || p._id === propId)) ||
                  (propTitle && p.title && p.title.toLowerCase().includes(propTitle.toLowerCase()))
                ) {
                  return { ...p, status: 'disponible', is_published: true };
                }
                return p;
              });
              localStorage.setItem('locatrust_properties', JSON.stringify(updatedProps));
            }
          }
          window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
        }
      }

      // 4. Notifier l'autre partie
      const targetUserId = isTenantView
        ? (realContract?.owner_id || realContract?.owner?.id)
        : (realContract?.tenant_id || realContract?.tenant?.id);
      const termTitle = `Fin du contrat N° ${contractNumber} & Restitution de caution`;
      const termMsg = `Le contrat N° ${contractNumber} (${tenantData.propertyTitle}) est clôturé au ${terminationData.effectiveDate}. Caution nette à restituer : ${formatFCFA(restitutionAmount)}.`;
      const termPayload = {
        contractNumber,
        contract_number: contractNumber,
        status: 'termine',
        caution_restituted_amount: restitutionAmount,
        deductions_amount: terminationData.deductions,
        termination_effective_date: terminationData.effectiveDate,
        targetTab: 'contracts'
      };
      if (targetUserId && isValidUuid(targetUserId)) {
        try {
          await supabase.from('notifications').insert({
            id: crypto.randomUUID(),
            user_id: targetUserId,
            title: termTitle,
            message: termMsg,
            description: termMsg,
            content: termMsg,
            type: 'contrat',
            category: 'contrat',
            target_role: isTenantView ? 'proprietaire' : 'locataire',
            read: false,
            is_read: false,
            data: termPayload,
            payload: termPayload
          });
        } catch {}
      }
      if (targetUserId) {
        pushGlobalNotification({
          title: termTitle,
          description: termMsg,
          category: 'contrat',
          targetUserId,
          targetRole: isTenantView ? 'proprietaire' : 'locataire',
          targetTab: 'contracts',
          data: termPayload
        });
      }

      window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
      window.dispatchEvent(new CustomEvent('locatrust:subscription_updated'));
    } catch (err) {
      console.warn('Error saving contract termination:', err);
    }

    setConfirmationModal({
      isOpen: true,
      type: 'termination_initiated',
      title: 'Clôture du contrat & Restitution validée',
      message: `La clôture définitive du contrat N° ${contractNumber} est enregistrée. Montant de caution à restituer : ${formatFCFA(restitutionAmount)}.${availabilityMessage}`,
      details: `Date effective : ${terminationData.effectiveDate} • État des lieux de sortie contradictoire fixé au ${terminationData.exitInspectionDate}.`,
      withCelebration: true
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* Top Navigation Control Bar (Matching Image 1 & 3) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Détails du contrat</span>
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          {/* BOUTON OBLIGATOIRE DU DOSSIER DE PREUVE SI CONTRAT TERMINÉ (Section 1 & 4) */}
          {isContractTerminated && (
            <button
              onClick={async () => {
                const data = await collectProofDossierData(realContract || contractNumber);
                await generateOfficialProofDossierPdf(data);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95"
              title="Obtenir le dossier de preuve officiel récapitulatif certifié avec QR Code"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>📄 Obtenir mon dossier de preuve</span>
            </button>
          )}

          {isBothSigned ? (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le contrat final signé</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {isAwaitingTenant && !isTenantView && (
                <button
                  type="button"
                  onClick={() => handleRelanceInternal('Messagerie')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all active:scale-95"
                  title="Envoyer une relance interne au locataire"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Relancer le locataire</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BANNIÈRE DE DEMANDE DE RENOUVELLEMENT DE BAIL */}
      {realContract?.renewal_status === 'demande' && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-indigo-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 bg-indigo-200/80 px-2.5 py-0.5 rounded-full">
                  🔄 Demande de renouvellement de bail
                </span>
                <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                  {tenantData.name} sollicite +{realContract?.renewal_duration_requested || 12} mois
                </span>
              </div>
              <h4 className="text-base font-extrabold text-slate-900 mt-1">
                {isTenantView
                  ? `Votre demande de renouvellement du bail N° ${contractNumber} a été transmise au bailleur`
                  : `Le preneur sollicite formellement la reconduction du bail N° ${contractNumber}`}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {isTenantView
                  ? "Le propriétaire ou l'agence examine actuellement votre demande de reconduction (+12 mois)."
                  : "Vous pouvez accepter cette reconduction (le bail sera prolongé de 12 mois) ou la refuser (le bail prendra fin à sa date d'échéance convenue)."}
              </p>
            </div>
          </div>

          {!isTenantView ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleAcceptRenewal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Accepter (+12 mois)</span>
              </button>
              <button
                onClick={handleRefuseRenewal}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold transition-all"
              >
                <X className="w-4 h-4" />
                <span>Refuser la reconduction</span>
              </button>
            </div>
          ) : (
            <span className="px-3.5 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-extrabold shrink-0">
              En attente de validation du bailleur
            </span>
          )}
        </div>
      )}

      {/* BANNIÈRE D'ALERTE : En attente signature du locataire (Uniquement visible pour le Propriétaire ou l'Agence - Image 3) */}
      {isAwaitingTenant && !isTenantView && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                  ⚠️ En attente de signature du locataire
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Bailleur a signé
                </span>
              </div>
              <h4 className="text-base font-extrabold text-slate-900 mt-1">
                Le contrat a été transmis à {tenantData.name} ({tenantData.phone})
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Vous avez validé et apposé votre signature. Le bail prendra effet légal dès que le locataire aura signé électroniquement.
              </p>
              {relanceSuccess && (
                <div className="mt-2 text-xs font-extrabold text-emerald-700 bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-300 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{relanceSuccess}</span>
                </div>
              )}
            </div>
          </div>

          {/* BOUTON PRINCIPAL DE RELANCE : Relancer le locataire (Liaison messagerie interne LocaTrust) */}
          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={() => handleRelanceInternal('Messagerie')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95"
              title="Créer une notification de relance directe dans la boîte interne LocaTrust du locataire"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Relancer le locataire</span>
            </button>
            <button
              onClick={() => handleRelanceInternal('WhatsApp')}
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={() => handleRelanceInternal('SMS')}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <span>SMS</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.origin + `/locataire/signer/${contractNumber}`);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 3000);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copié' : 'Lien'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout (Left Column Details + Right Column Legal Contract Document - Matching Image 1 & 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Metadata, Parties, Financials, Linked Documents, Quick Actions */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Metadata Card (Uniquement visible pour le Propriétaire ou l'Agence - Image 3) */}
          {!isTenantView && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400">N° DU CONTRAT</span>
                  <h3 className="text-lg font-black text-slate-900">{contractNumber}</h3>
                </div>
                {isContractTerminated ? (
                  <span className="px-3 py-1 bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold rounded-full">
                    Contrat terminé
                  </span>
                ) : isAwaitingTenant ? (
                  <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Attente sign. locataire
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-full">
                    Actif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Date de signature :</span>
                  <span className="font-bold text-slate-800">{tenantData.dateSignature}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Période :</span>
                  <span className="font-bold text-slate-800">{tenantData.periode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Durée :</span>
                  <span className="font-bold text-slate-800">{tenantData.duration} mois</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Bien immobilier :</span>
                  <span className="font-bold text-slate-800 truncate block">{tenantData.propertyTitle}</span>
                </div>
              </div>
            </div>
          )}

          {/* PARTIES AU CONTRAT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-4">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Parties au contrat</h4>
            
            {/* Propriétaire */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center border-2 border-amber-600 shrink-0">
                {ownerDisplayName ? ownerDisplayName.slice(0, 2).toUpperCase() : 'BA'}
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-extrabold text-slate-900">PROPRIÉTAIRE (BAILLEUR)</span>
                <span className="font-bold text-slate-800">{ownerDisplayName}</span>
                <span className="text-slate-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {ownerDisplayPhone}
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {contract?.owner?.email || 'contact@locatrust.ci'}
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {contract?.owner?.address || contract?.owner?.commune || (profile as any)?.address || profile?.commune || profile?.city || 'Côte d\'Ivoire'}
                </span>
              </div>
            </div>

            {/* Locataire */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center border-2 border-blue-700 shrink-0">
                {tenantData.name ? tenantData.name.slice(0, 2).toUpperCase() : 'LO'}
              </div>
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900">LOCATAIRE (PRENEUR)</span>
                  {isAwaitingTenant && (
                    <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      En attente signature
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-800">{tenantData.name}</span>
                <span className="text-slate-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {tenantData.phone}
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {tenantData.email}
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {tenantData.address}
                </span>
              </div>
            </div>
          </div>

          {/* RÉSUMÉ FINANCIER (Matching Image 1 & 3 KPI Boxes) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-4">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Résumé Financier</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Loyer mensuel</span>
                <span className="text-base font-black text-blue-900">{formatFCFA(tenantData.rent)}</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Caution exigée</span>
                <span className="text-base font-black text-blue-900">{formatFCFA(tenantData.caution)}</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Date de paiement</span>
                <span className="text-base font-black text-blue-900">Le {String(tenantData.dueDay).padStart(2, '0')} du mois</span>
                <span className="text-[10px] font-bold text-slate-500">1ère échéance : {tenantData.firstDueDate}</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Charges mensuelles</span>
                <span className="text-base font-black text-blue-900">{formatFCFA(tenantData.charges)}</span>
              </div>
            </div>
          </div>

          {/* DOCUMENTS LIÉS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-3">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Documents liés</h4>
            {[
              "Pièce d'identité propriétaire (CNI)",
              "Pièce d'identité locataire (CNI)",
              "État des lieux d'entrée contradictoire",
            ].map((docName, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="truncate max-w-[200px]">{docName}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                  PDF
                </span>
              </div>
            ))}
            {amendmentsList.length > 0 ? (
              amendmentsList.map((am, idx) => (
                <button
                  key={am.id || idx}
                  type="button"
                  onClick={() => handleDownloadAvenantPdf(am)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 text-xs font-bold text-blue-900">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate max-w-[190px]">
                      {am.amendment_number || `Avenant n°${idx + 1}`} — {am.type}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-black text-[10px] flex items-center gap-1">
                    <Download className="w-3 h-3" /> PDF
                  </span>
                </button>
              ))
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-500">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="truncate max-w-[200px]">Aucun avenant enregistré</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 font-bold text-[10px]">
                  —
                </span>
              </div>
            )}
          </div>

          {/* ACTIONS RAPIDES */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-2.5">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Actions Rapides</h4>
            
            {/* Bouton d'envoi uniquement pour bailleur/agence */}
            {!isTenantView && (
              <button
                onClick={handleSendContractToTenantInbox}
                className="w-full min-h-[40px] py-2.5 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-black text-center transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Envoyer le contrat au locataire</span>
              </button>
            )}

            {/* Bouton de Demande de Renouvellement (Actif uniquement à 1 mois de la fin du contrat) */}
            {isTenantView && (
              <button
                onClick={handleRequestRenewal}
                disabled={hasRequestedRenewal || realContract?.renewal_status === 'demande' || !renewalInfo.isEligible || !isBothSigned || isContractTerminated}
                title={
                  hasRequestedRenewal || realContract?.renewal_status === 'demande'
                    ? 'Votre demande est déjà en cours de traitement par le bailleur.'
                    : !isBothSigned
                    ? 'Le contrat doit être signé avant de pouvoir demander un renouvellement.'
                    : !renewalInfo.isEligible
                    ? `Le bouton de renouvellement s'active automatiquement à 1 mois de la fin du contrat (${renewalInfo.endDateFormatted}).`
                    : 'Cliquez pour formuler votre demande officielle de reconduction du bail.'
                }
                className={`w-full min-h-[40px] py-2.5 px-3 rounded-xl text-xs font-black text-center transition-all flex items-center justify-center gap-2 shadow-sm ${
                  hasRequestedRenewal || realContract?.renewal_status === 'demande'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default'
                    : !renewalInfo.isEligible || !isBothSigned || isContractTerminated
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95 cursor-pointer'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight">
                  {hasRequestedRenewal || realContract?.renewal_status === 'demande'
                    ? 'Demande de renouvellement transmise ✓'
                    : !renewalInfo.isEligible
                    ? 'Demander le renouvellement (actif à 1 mois de la fin)'
                    : 'Demander le renouvellement du bail'}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsAnalyzerModalOpen(true)}
              className="w-full min-h-[40px] py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-black text-center transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Scale className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="truncate">🔍 Analyser le contrat (CI & OHADA)</span>
            </button>

            <button
              onClick={() => setIsAvenantFormOpen(true)}
              disabled={isContractTerminated}
              className={`w-full min-h-[40px] py-2.5 px-3 rounded-xl border text-xs font-bold text-center transition-all flex items-center justify-center gap-2 ${
                isContractTerminated
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="truncate">Créer un avenant</span>
            </button>

            <button
              onClick={() => setIsTerminationFormOpen(true)}
              disabled={isContractTerminated}
              className={`w-full min-h-[40px] py-2.5 px-3 rounded-xl border text-xs font-bold text-center transition-all flex items-center justify-center gap-2 ${
                isContractTerminated
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'border-rose-300 text-rose-700 bg-rose-50/50 hover:bg-rose-100/70'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate">{isContractTerminated ? 'Contrat clôturé' : 'Fin du contrat & Restitution'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className={`w-full min-h-[40px] py-2.5 px-3 rounded-xl text-xs font-black text-center shadow-sm transition-all flex items-center justify-center gap-2 ${
                isBothSigned
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isBothSigned ? 'Télécharger le contrat final (Signé)' : 'Télécharger (Signature requise)'}</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Official Legal Contract Document (Matching Image 1 & Image 3 100%) */}
        <div className="lg:col-span-7 bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-xl flex flex-col gap-6 relative">
          
          {/* Header Banner inside Document */}
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              {isAgency ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 tracking-tight">{ownerDisplayName}</span>
                    <span className="text-xs text-blue-600 font-extrabold uppercase tracking-wider">Agence Immobilière Agréée</span>
                  </div>
                </div>
              ) : (
                <Logo size="md" variant="light" showSubtitle={true} />
              )}
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-lg font-black text-blue-900 tracking-tight">CONTRAT DE BAIL</span>
              {/* QR Code authentication officiel LocaTrust - Large & Scannable (Point 3) */}
              <div 
                onClick={() => setShowQrZoomModal(true)}
                className="flex items-center gap-2.5 bg-white p-2 rounded-2xl border-2 border-blue-400/50 hover:border-blue-600 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                title="Cliquer pour agrandir le QR Code et tester le scan mobile"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border border-slate-300 rounded-xl p-1 flex items-center justify-center shadow-inner shrink-0">
                  <img
                    src={getLocaTrustVerificationQR(`/verify/contrat/${contractNumber}`, 320)}
                    alt={`QR Code Vérification Contrat ${contractNumber}`}
                    className="w-full h-full object-contain rounded"
                  />
                </div>
                <div className="flex flex-col text-left">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black w-fit">
                    N° {contractNumber}
                  </span>
                  <span className="text-[10px] font-black text-slate-800 mt-1 flex items-center gap-1 group-hover:text-blue-700">
                    <QrCode className="w-3 h-3 text-blue-600" />
                    Vérification Officielle
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono leading-tight">
                    /verify/contrat/{contractNumber}
                  </span>
                  <a
                    href={`/verify/contrat/${contractNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[9.5px] text-blue-600 font-extrabold hover:underline mt-0.5 inline-flex items-center gap-0.5"
                  >
                    <span>Vérifier en ligne &rarr;</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Property Image & Details Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
            <img
              src={propertyDetails.image}
              alt={tenantData.propertyTitle || 'Bien immobilier'}
              className="w-full md:w-36 h-28 rounded-xl object-cover border"
            />
            <div className="flex-1 flex flex-col gap-1 text-xs">
              <span className="font-extrabold text-slate-900 text-sm">{tenantData.propertyTitle}</span>
              <span className="text-slate-500">Localisation: {tenantData.propertyAddress}</span>
              <span className="text-slate-500">
                Surface: {propertyDetails.surface} m² | Composition: {propertyDetails.rooms} pièces, {propertyDetails.bedrooms} chambre{propertyDetails.bedrooms > 1 ? 's' : ''}, {propertyDetails.bathrooms} salle{propertyDetails.bathrooms > 1 ? 's' : ''} de bain
              </span>
              <span className="text-slate-500">Équipements: {propertyDetails.equipments}</span>
            </div>
          </div>

          {/* Legal Articles Text */}
          <div className="flex flex-col gap-5 text-xs text-slate-700 leading-relaxed font-sans">
            
            {/* ARTICLE 1 & 2 */}
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 flex flex-col gap-2">
              <h5 className="font-extrabold text-blue-950 uppercase tracking-wide">ARTICLE 1 : DÉSIGNATION DU BIEN</h5>
              <p>
                M./Mme <strong>{ownerDisplayName}</strong>, ci-après dénommé(e) « le Bailleur », donne en location à M./Mme <strong>{tenantData.name}</strong>, ci-après dénommé(e) « le Preneur », qui accepte, le bien immobilier désigné ci-après :
              </p>
              
              <h5 className="font-extrabold text-blue-950 uppercase tracking-wide mt-2">ARTICLE 2 : DURÉE DU CONTRAT</h5>
              <p>Le présent contrat est conclu pour une durée déterminée de <strong>{tenantData.duration} mois</strong>, commençant le <strong>{tenantData.startDate}</strong> et prenant fin le <strong>{tenantData.periode.split(' au ')[1] || 'terme convenu'}</strong>. Il se renouvelle tacitement par période de même durée sauf dénonciation.</p>
            </div>

            {/* ARTICLE 3, 4, 5 FINANCIAL HIGHLIGHTS (Matching Orange Pill Boxes in Image 3) */}
            <div className="flex flex-col gap-3">
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-slate-900">ARTICLE 3 : LOYER MENSUEL</h5>
                  <p className="text-[11px] text-slate-600">
                    Payable le <strong>{String(tenantData.dueDay).padStart(2, '0')} de chaque mois</strong> (1ère échéance le <strong>{tenantData.firstDueDate}</strong>). Tout paiement avant cette date est comptabilisé en avance ; passé ce jour, le loyer est considéré en retard.
                  </p>
                </div>
                <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm">
                  {formatFCFA(tenantData.rent)}
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-slate-900">
                    {leaseType === 'professionnel' ? 'ARTICLE 4 : DÉPÔT DE GARANTIE COMMERCIAL' : 'ARTICLE 4 : CAUTION (DÉPÔT DE GARANTIE)'}
                  </h5>
                  <p className="text-[11px] text-slate-600">
                    {tenantData.rent > 0 ? `Montant correspondant à ${(tenantData.caution / tenantData.rent).toFixed(1)} mois de loyer. ` : ''}
                    Restituée selon les conditions contractuelles après l'état des lieux de sortie.
                  </p>
                </div>
                <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm">
                  {formatFCFA(tenantData.caution)}
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h5 className="font-extrabold text-slate-900">
                    {(tenantData.charges && tenantData.charges > 0)
                      ? 'ARTICLE 5 : PROVISION SUR CHARGES LOCATIVES'
                      : 'ARTICLE 5 : CHARGES (AUCUNE PROVISION EXIGÉE)'}
                  </h5>
                  <p className="text-[11px] text-slate-600">
                    {(tenantData.charges && tenantData.charges > 0)
                      ? 'Eau, électricité, entretien des parties communes et ordures ménagères.'
                      : 'Aucune provision sur charges (charges incluses ou compteurs individuels directs CIE/SODECI).'}
                  </p>
                </div>
                <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm shrink-0 self-end sm:self-center">
                  {(tenantData.charges && tenantData.charges > 0) ? `${formatFCFA(tenantData.charges)} / mois` : 'Aucune provision exigée'}
                </span>
              </div>
            </div>

            {/* ARTICLES 6 & 7 : OBLIGATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
                <h5 className="font-extrabold text-blue-900 mb-1">ARTICLE 6 : OBLIGATIONS DU LOCATAIRE</h5>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                  <li>Payer le loyer et les charges aux dates convenues.</li>
                  <li>User paisiblement des lieux en bon père de famille.</li>
                  <li>Entretenir le logement et effectuer les menues réparations.</li>
                  <li>Ne pas transformer les lieux sans accord écrit préalable.</li>
                  <li>Restituer les lieux en bon état d'habitabilité.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
                <h5 className="font-extrabold text-blue-900 mb-1">ARTICLE 7 : OBLIGATIONS DU PROPRIÉTAIRE</h5>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                  <li>Remettre au locataire un logement décent et en bon état.</li>
                  <li>Assurer la jouissance paisible des lieux loués.</li>
                  <li>Effectuer les grosses réparations de structure et toiture.</li>
                  <li>Respecter la vie privée du locataire.</li>
                  <li>Fournir les quittances de paiement après chaque encaissement.</li>
                </ul>
              </div>
            </div>

            {/* ARTICLES 8 & 9 : RÉSILIATION ET LITIGES */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col gap-2">
              <div>
                <span className="font-extrabold text-blue-900 uppercase tracking-wide block text-xs">
                  ARTICLE 8 : RÉSILIATION
                </span>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  En cas de manquement grave par l'une des parties à ses obligations contractuelles, l'autre partie pourra résilier le présent bail de plein droit après mise en demeure d'un délai de 30 jours restée infructueuse (Art. 450 Loi n° 2019-576).
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-extrabold text-blue-900 uppercase tracking-wide block text-xs">
                  ARTICLE 9 : LITIGES & JURIDICTION COMPÉTENTE
                </span>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Tout différend relatif à la validité, l'interprétation ou l'exécution du contrat fera l'objet d'une tentative de conciliation amiable. En cas d'échec, attribution de juridiction exclusive est accordée au Tribunal de Première Instance compétent d'Abidjan.
                </p>
              </div>
            </div>

          </div>

          {/* SIGNATURES SECTION (Image 2 & Image 4 : Aucune signature locataire ne peut être apposée ici ; uniquement en lecture seule) */}
          <div className="pt-6 border-t border-slate-200 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Propriétaire Signature */}
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase">
                  {isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE' : 'LE PROPRIÉTAIRE (BAILLEUR)'}
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  {ownerDisplayName}
                </span>

                <div className="min-h-[70px] flex items-center justify-center my-2 p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                  {ownerSignatureUrl ? (
                    <img
                      src={ownerSignatureUrl}
                      alt="Signature du propriétaire"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : !isTenantView ? (
                    <button
                      type="button"
                      onClick={() => setActiveSigningParty('proprietaire')}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Signer le contrat (Bailleur)</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-semibold italic">
                      En attente de la signature du bailleur
                    </span>
                  )}
                </div>

                {ownerSignatureUrl ? (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signature manuscrite certifiée
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold">
                    En attente de signature
                  </span>
                )}
              </div>

              {/* Locataire Signature (Lecture seule — La signature du locataire se fait exclusivement via le bouton « Signer » sur la carte Mes Contrats) */}
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase">LE LOCATAIRE (PRENEUR)</span>
                <span className="font-bold text-slate-900 text-xs">{tenantData.name}</span>

                <div className="min-h-[70px] flex items-center justify-center my-2 p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                  {tenantSignatureUrl ? (
                    <img
                      src={tenantSignatureUrl}
                      alt="Signature du locataire"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-center">
                      <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>En attente de la signature du locataire</span>
                      </span>
                      {isTenantView && (
                        <span className="text-[10px] text-slate-500">
                          Utilisez le bouton « Signer » sur la carte de votre contrat pour signer
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {tenantSignatureUrl ? (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signature manuscrite certifiée
                  </span>
                ) : isAwaitingTenant ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-amber-700 font-extrabold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      En attente de signature du locataire
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold">
                      (Bailleur a déjà signé)
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold">
                    En attente de signature
                  </span>
                )}
              </div>

            </div>

            {/* Central Round Official Stamp Seal (Tampon Rond de Certification LocaTrust - Point 2.1) */}
            <div className="mx-auto flex flex-col items-center justify-center my-4 select-none">
              <div className="w-32 h-32 rounded-full border-2 border-amber-600 border-dashed p-1 flex items-center justify-center text-center bg-gradient-to-b from-amber-50/80 via-white/70 to-amber-50/80 shadow-md relative group">
                <div className="w-full h-full rounded-full border-2 border-amber-600/90 flex flex-col items-center justify-between p-2.5 bg-white/70">
                  <span className="text-[7.2px] font-black text-amber-800 tracking-wider uppercase leading-tight text-center">
                    RÉPUBLIQUE DE CÔTE D'IVOIRE
                  </span>
                  <div className="flex items-center gap-1 text-[7px] text-amber-600 -my-0.5">
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                  </div>
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[10px] font-black text-slate-900 tracking-tight">
                      LOCATRUST
                    </span>
                    <span className="text-[6.5px] font-extrabold text-amber-700 uppercase mt-0.5">
                      BAIL CONFORME & CERTIFIÉ
                    </span>
                  </div>
                  <span className="text-[5.5px] font-bold text-slate-500 leading-none">
                    LOI N° 2019-576 DU 26 JUIN 2019
                  </span>
                  <span className="text-[6.2px] font-black text-amber-800 tracking-wider uppercase leading-none">
                    ABIDJAN • SÉCURITÉ JURIDIQUE
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-500 mt-1.5 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Sceau Officiel de Certification Numérique
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Signature Modal */}
      {activeSigningParty && (
        <SignatureModal
          isOpen={!!activeSigningParty}
          onClose={() => setActiveSigningParty(null)}
          onConfirmSignature={async (signatureUrl) => {
            const isOwner = activeSigningParty === 'proprietaire';
            const nowIso = new Date().toISOString();
            const signedDateFr = new Date().toLocaleDateString('fr-FR');
            const propId = realContract?.property_id || realContract?.property?.id;
            const targetOwnerId = realContract?.owner_id || realContract?.owner?.id;

            if (isOwner) {
              setOwnerSignatureUrl(signatureUrl);
              persistOwnerSignature(signatureUrl, user?.id);
            } else {
              setTenantSignatureUrl(signatureUrl);
              persistTenantSignature(signatureUrl, user?.id);
              if (typeof window !== 'undefined' && contractNumber) {
                try {
                  const rawSignedMap = localStorage.getItem('locatrust_signed_contracts_map');
                  const signedMap = rawSignedMap ? JSON.parse(rawSignedMap) : {};
                  signedMap[contractNumber] = {
                    tenant_signed: true,
                    tenant_signature_url: signatureUrl,
                    signed_at: nowIso,
                    status: 'actif'
                  };
                  localStorage.setItem('locatrust_signed_contracts_map', JSON.stringify(signedMap));
                } catch {}
              }
            }

            // Inscription directe et persistante dans Supabase PostgreSQL
            try {
              const updatePayload: any = {
                updated_at: nowIso
              };
              if (isOwner) {
                updatePayload.owner_signature = signatureUrl;
                updatePayload.owner_signed = true;
                updatePayload.owner_signed_at = nowIso;
              } else {
                updatePayload.tenant_signature = signatureUrl;
                updatePayload.tenant_signed = true;
                updatePayload.tenant_signed_at = nowIso;
              }

              if (isValidUuid(contractNumber)) {
                await supabase
                  .from('contracts')
                  .update(updatePayload)
                  .or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
              } else {
                await supabase
                  .from('contracts')
                  .update(updatePayload)
                  .eq('contract_number', contractNumber);
              }

              if (!isOwner) {
                try {
                  if (isValidUuid(contractNumber)) {
                    await supabase.from('contracts').update({ status: 'actif' }).or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
                  } else {
                    await supabase.from('contracts').update({ status: 'actif' }).eq('contract_number', contractNumber);
                  }
                } catch {}
              }

              // Si le locataire signe, mettre à jour la candidature correspondante via JSONB documents
              if (!isOwner) {
                try {
                  if (user?.id) {
                    const { data: myApps } = await supabase
                      .from('rental_applications')
                      .select('*')
                      .eq('tenant_id', user.id);
                    if (myApps && Array.isArray(myApps)) {
                      for (const appRow of myApps) {
                        const docs = appRow.documents && typeof appRow.documents === 'object' ? appRow.documents : {};
                        if (docs.contract_number === contractNumber || (propId && appRow.property_id === propId)) {
                          const updatedDocs = {
                            ...docs,
                            contract_number: contractNumber,
                            contract_transmitted: true,
                            contract_finalized: true,
                            tenant_signed: true,
                            tenant_signed_at: nowIso,
                            tenant_signature_url: signatureUrl,
                            contract_status: 'contrat_actif'
                          };
                          const { error: errWithStatus } = await supabase
                            .from('rental_applications')
                            .update({ status: 'contrat_actif', documents: updatedDocs })
                            .eq('id', appRow.id);
                          if (errWithStatus) {
                            await supabase
                              .from('rental_applications')
                              .update({ documents: updatedDocs })
                              .eq('id', appRow.id);
                          }
                        }
                      }
                    }
                  }

                  if (isValidUuid(propId)) {
                    await supabase.from('properties').update({ status: 'loue' }).eq('id', propId);
                  }
                } catch (appErr) {
                  console.warn('Erreur mise à jour application lors signature locataire:', appErr);
                }
              }
            } catch (dbErr) {
              console.warn('Notice persistance signature Supabase:', dbErr);
            }

            try {
              const stored = localStorage.getItem('locatrust_contracts');
              const parsed = stored ? JSON.parse(stored) : [];
              const arr = Array.isArray(parsed) ? parsed : [];
              let foundInLocal = false;
              const updated = arr.map((c: any) => {
                if (c.contract_number === contractNumber || c.id === contractNumber) {
                  foundInLocal = true;
                  return {
                    ...c,
                    status: isOwner ? c.status : 'actif',
                    owner_signature_url: isOwner ? signatureUrl : (c.owner_signature_url || c.ownerSignatureUrl),
                    tenant_signature_url: !isOwner ? signatureUrl : (c.tenant_signature_url || c.tenantSignatureUrl),
                    tenant_signature: !isOwner ? signatureUrl : c.tenant_signature,
                    owner_signed: isOwner ? true : c.owner_signed,
                    tenant_signed: !isOwner ? true : c.tenant_signed,
                    signed_date: signedDateFr,
                    start_date: c.start_date || signedDateFr
                  };
                }
                return c;
              });
              if (!foundInLocal && realContract) {
                updated.unshift({
                  ...realContract,
                  id: realContract.id || `cnt_${contractNumber}`,
                  contract_number: contractNumber,
                  status: isOwner ? realContract.status : 'actif',
                  owner_signature_url: isOwner ? signatureUrl : (realContract.owner_signature_url || ownerSignatureUrl),
                  tenant_signature_url: !isOwner ? signatureUrl : (realContract.tenant_signature_url || tenantSignatureUrl),
                  tenant_signature: !isOwner ? signatureUrl : realContract.tenant_signature,
                  owner_signed: true,
                  tenant_signed: !isOwner ? true : Boolean(realContract.tenant_signed),
                  signed_date: signedDateFr
                });
              }
              localStorage.setItem('locatrust_contracts', JSON.stringify(updated));
              window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: { contracts: updated } }));

              // Mettre à jour aussi locatrust_rental_applications et notifications en cache
              if (!isOwner) {
                const appsRaw = localStorage.getItem('locatrust_rental_applications');
                if (appsRaw) {
                  const parsedApps = JSON.parse(appsRaw);
                  if (Array.isArray(parsedApps)) {
                    const updatedApps = parsedApps.map((a: any) => {
                      if (
                        a.contract_number === contractNumber ||
                        a.documents?.contract_number === contractNumber ||
                        (propId && a.property_id === propId && (a.tenant_id === user?.id || !a.tenant_id))
                      ) {
                        return {
                          ...a,
                          status: 'contrat_actif',
                          contract_finalized: true,
                          tenant_signed: true,
                          tenant_signed_at: nowIso,
                          tenant_signature_url: signatureUrl
                        };
                      }
                      return a;
                    });
                    localStorage.setItem('locatrust_rental_applications', JSON.stringify(updatedApps));
                    window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } }));
                  }
                }

                // Notifier le propriétaire une seule fois (ID unique partagé)
                const sharedNotifId = crypto.randomUUID();
                const notifMsg = `${tenantData.name} a apposé sa signature certifiée sur le contrat N° ${contractNumber}. Le contrat est désormais actif et téléchargeable.`;
                const notifPayload = {
                  contractNumber,
                  contract_number: contractNumber,
                  property_id: propId,
                  property_title: tenantData.propertyTitle,
                  tenant_id: user?.id,
                  tenant_name: tenantData.name,
                  tenant_signed: true,
                  tenant_signature_url: signatureUrl,
                  status: 'contrat_actif',
                  targetTab: 'contracts'
                };

                if (targetOwnerId && isValidUuid(targetOwnerId)) {
                  try {
                    await supabase.from('notifications').insert({
                      id: sharedNotifId,
                      user_id: targetOwnerId,
                      title: 'Contrat signé par le locataire',
                      message: notifMsg,
                      description: notifMsg,
                      content: notifMsg,
                      type: 'contrat',
                      category: 'contrat',
                      target_role: 'proprietaire',
                      read: false,
                      is_read: false,
                      data: notifPayload,
                      payload: notifPayload
                    });
                  } catch {}
                }

                if (targetOwnerId) {
                  pushGlobalNotification({
                    id: sharedNotifId,
                    title: 'Contrat signé par le locataire',
                    description: notifMsg,
                    category: 'contrat',
                    targetUserId: targetOwnerId,
                    targetTab: 'contracts',
                    targetRole: 'proprietaire',
                    link: '/dashboard',
                    data: notifPayload
                  });
                }

                broadcastLiveEvent('TENANT_SIGNED', {
                  contractId: contractNumber,
                  actorId: user?.id,
                  targetUserId: targetOwnerId,
                  propertyId: propId,
                  data: notifPayload
                });
              }
            } catch (err) {
              console.warn('Error saving signature in locatrust_contracts:', err);
            }
            setActiveSigningParty(null);
          }}
          signerName={activeSigningParty === 'proprietaire' ? ownerDisplayName : tenantData.name}
          signerRole={activeSigningParty}
          documentTitle="Contrat de Bail d'Habitation"
          documentNumber={contractNumber}
        />
      )}

      {/* MODAL 1 : BLOCAGE DU TÉLÉCHARGEMENT SI SIGNATURES INCOMPLÈTES (Point 10) */}
      {isDownloadBlockedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-300 flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-0.5 rounded-full mx-auto">
                Conformité Légale LocaTrust
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                Téléchargement du contrat bloqué
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Un contrat de bail ne peut <strong>PAS</strong> être téléchargé comme contrat final tant que les deux parties n'ont pas signé électroniquement.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5 text-left text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Signature du Bailleur :</span>
                {ownerSignatureUrl ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Signé
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold">En attente</span>
                )}
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-slate-500 font-semibold">Signature du Locataire :</span>
                {tenantSignatureUrl ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Signé
                  </span>
                ) : (
                  <span className="text-amber-700 font-extrabold flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3 text-amber-600" /> En attente de la signature du locataire
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              {!tenantSignatureUrl && (
                <button
                  onClick={() => {
                    setIsDownloadBlockedModalOpen(false);
                    handleRelanceInternal('Messagerie');
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
                >
                  Relancer le locataire
                </button>
              )}
              <button
                onClick={() => setIsDownloadBlockedModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : OUVERTURE DE L'OUTIL DE CRÉATION D'AVENANT (Point 8 - Carte centrée petite, propre, bleue/blanche avec OK) */}
      {isAvenantInitiatedOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border-2 border-blue-200 flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
              <FileText className="w-6 h-6" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-black text-slate-900">
                Avenant au contrat
              </h3>
              <p className="text-xs text-blue-900 font-bold">
                Ouverture de l'outil de création d'avenant
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                L'avenant restera rigoureusement lié au contrat initial N° {contractNumber} sans l'écraser.
              </p>
            </div>

            <button
              onClick={() => {
                setIsAvenantInitiatedOpen(false);
                setIsAvenantFormOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/30 transition-all active:scale-95"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3 : OUTIL COMPLET DE CRÉATION D'AVENANT (Point 8) */}
      {isAvenantFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-black text-slate-900">Création d'un avenant au contrat</h3>
                  <span className="text-[10px] text-slate-500">Contrat original lié : {contractNumber}</span>
                </div>
              </div>
              <button onClick={() => setIsAvenantFormOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium">
              ℹ️ <strong>Règle juridique :</strong> Le contrat original signé est conservé et ne sera pas écrasé. Cet avenant y ajoute de nouvelles clauses validées d'un commun accord.
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Type d'avenant</label>
                <select
                  value={avenantData.type}
                  onChange={(e) => setAvenantData({ ...avenantData, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option>Modification du montant du loyer</option>
                  <option>Prolongation de la durée du bail</option>
                  <option>Révision des charges locatives</option>
                  <option>Changement d'équipements / travaux</option>
                  <option>Autre modification contractuelle</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date de prise d'effet</label>
                  <input
                    type="date"
                    value={avenantData.effectiveDate}
                    onChange={(e) => setAvenantData({ ...avenantData, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nouveau loyer si révisé (FCFA)</label>
                  <input
                    type="number"
                    value={avenantData.newRent}
                    onChange={(e) => setAvenantData({ ...avenantData, newRent: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mois ajoutés (si prolongation)</label>
                  <input
                    type="number"
                    min={0}
                    value={avenantData.additionalMonths}
                    onChange={(e) => setAvenantData({ ...avenantData, additionalMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Charges mensuelles (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={avenantData.newCharges}
                    onChange={(e) => setAvenantData({ ...avenantData, newCharges: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Clauses et stipulations modifiées</label>
                <textarea
                  rows={4}
                  value={avenantData.clauses}
                  onChange={(e) => setAvenantData({ ...avenantData, clauses: e.target.value })}
                  placeholder="Détaillez les modifications apportées au bail d'origine..."
                  className="w-full p-3 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsAvenantFormOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveAvenant}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/30"
              >
                Enregistrer et transmettre l'avenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4 : PROCÉDURE DE RÉSILIATION D'UN CONTRAT (Point 9) */}
      {isTerminationFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-rose-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-rose-600">Procédure de résiliation initiée</span>
                  <h3 className="text-sm font-black text-slate-900">Résiliation du contrat {contractNumber}</h3>
                </div>
              </div>
              <button onClick={() => setIsTerminationFormOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Liaisons strictes Propriétaire / Locataire / Bien */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Bailleur :</span>
                <span className="font-bold text-slate-900">{ownerDisplayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Locataire lié :</span>
                <span className="font-bold text-slate-900">{tenantData.name} ({tenantData.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Bien immobilier :</span>
                <span className="font-bold text-slate-900 truncate max-w-[250px]">{tenantData.propertyTitle}</span>
              </div>
            </div>

            {/* Point 12: Choix Renouvellement ou Fin de contrat */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Issue du contrat (Point 12 du SaaS) :
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEndOfContractMode('renouvellement')}
                  className={`p-3 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition-all ${
                    endOfContractMode === 'renouvellement'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>🔄 Renouvellement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEndOfContractMode('fin_contrat')}
                  className={`p-3 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition-all ${
                    endOfContractMode === 'fin_contrat'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>🛑 Fin du contrat</span>
                </button>
              </div>
            </div>

            {endOfContractMode === 'fin_contrat' ? (
              <div className="flex flex-col gap-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Date effective de clôture</label>
                    <input
                      type="date"
                      defaultValue="2026-12-31"
                      onChange={(e) => setTerminationData({ ...terminationData, effectiveDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Préavis légal</label>
                    <select
                      value={terminationData.noticeMonths}
                      onChange={(e) => setTerminationData({ ...terminationData, noticeMonths: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    >
                      <option value={3}>3 mois (Légal habitation)</option>
                      <option value={1}>1 mois (Cas dérogatoire)</option>
                      <option value={0}>Immédiat (Résiliation amiable)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Motif</label>
                  <select
                    value={terminationData.reason}
                    onChange={(e) => setTerminationData({ ...terminationData, reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option>Arrivée à terme du bail d'habitation</option>
                    <option>Congé régulier donné par le locataire</option>
                    <option>Reprise du bien pour habitation personnelle</option>
                    <option>Résiliation d'un commun accord amiable</option>
                  </select>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col gap-2">
                  <span className="font-bold text-blue-950">Restitution de la caution</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-600 block">Caution versée :</label>
                      <span className="font-black text-slate-900">{formatFCFA(tenantData.caution)}</span>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block">Retenues éventuelles :</label>
                      <input
                        type="number"
                        value={terminationData.deductions}
                        onChange={(e) => setTerminationData({ ...terminationData, deductions: Number(e.target.value) })}
                        placeholder="0 FCFA"
                        className="w-full px-2 py-1 bg-white rounded border border-slate-200 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-200 font-bold">
                    <span className="text-slate-700">Montant net restitué :</span>
                    <span className="text-emerald-700">{formatFCFA(Math.max(0, tenantData.caution - terminationData.deductions))}</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date état des lieux de sortie</label>
                  <input
                    type="date"
                    defaultValue="2026-12-30"
                    onChange={(e) => setTerminationData({ ...terminationData, exitInspectionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                {/* Point 12: Checkbox remise du logement disponible */}
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="makePropertyAvailable"
                    checked={makePropertyAvailableAfterTermination}
                    onChange={(e) => setMakePropertyAvailableAfterTermination(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="makePropertyAvailable" className="text-xs font-bold text-emerald-950 cursor-pointer">
                    ☑ Remettre le logement disponible
                    <span className="block text-[11px] font-medium text-emerald-800 mt-0.5">
                      Le logement réapparaîtra automatiquement dans les annonces de location dès validation de la clôture.
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 flex flex-col gap-2">
                <span className="font-bold">Renouvellement du contrat de bail</span>
                <p>
                  Le bail sera reconduit tacitement ou par avenant aux mêmes conditions financières ({formatFCFA(tenantData.rent)}/mois).
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsTerminationFormOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmTermination}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/30"
              >
                Valider la résiliation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5 : ACTION CONFIRMATION MODAL AVEC CELEBRATION (Point 4) */}
      {confirmationModal && (
        <ActionConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          type={confirmationModal.type}
          title={confirmationModal.title}
          message={confirmationModal.message}
          details={confirmationModal.details}
          withCelebration={confirmationModal.withCelebration}
          confirmText={confirmationModal.confirmText}
        />
      )}

      {/* MODAL 6 : ANALYSEUR JURIDIQUE DU CONTRAT (Point 8) */}
      <LegalContractAnalyzerModal
        isOpen={isAnalyzerModalOpen}
        onClose={() => setIsAnalyzerModalOpen(false)}
        contractNumber={contractNumber}
        clausesText={`1. Le preneur s'engage à payer le loyer mensuel de ${formatFCFA(tenantData.rent)} au plus tard le ${String(tenantData.dueDay).padStart(2, '0')} du mois (1ère échéance le ${tenantData.firstDueDate}).\n2. Le dépôt de garantie versé s'élève à la somme de ${formatFCFA(tenantData.caution)} correspondant à deux mois de loyer.\n3. Entretien courant et menues réparations locatives à la charge du locataire.\n4. Respect strict de la quiétude du voisinage et des règles de copropriété.`}
      />

      {/* Modal Zoom QR Code Agrandissement & Scan Mobile Direct */}
      {showQrZoomModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowQrZoomModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 flex flex-col items-center text-center gap-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Vérification Officielle LocaTrust
              </span>
              <button
                type="button"
                onClick={() => setShowQrZoomModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="w-56 h-56 sm:w-64 sm:h-64 bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center">
              <img
                src={getLocaTrustVerificationQR(`/verify/contrat/${contractNumber}`, 400)}
                alt={`QR Code Vérification Contrat ${contractNumber}`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="font-extrabold text-slate-900">
                Pointez la caméra de votre smartphone
              </span>
              <p className="text-[11px] text-slate-500">
                Ce QR Code haute définition certifie l'authenticité légale du contrat <strong>N° {contractNumber}</strong> selon la Loi n° 2019-576.
              </p>
              <span className="text-[11px] font-mono text-blue-700 bg-blue-50 py-1 px-2.5 rounded-lg border border-blue-200 mt-1">
                /verify/contrat/{contractNumber}
              </span>
            </div>

            <a
              href={`/verify/contrat/${contractNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Accéder à la page de vérification &rarr;</span>
            </a>
          </div>
        </div>
      )}

    </div>
  );
};
export default ContractDetailView;
