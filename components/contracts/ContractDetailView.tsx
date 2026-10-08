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
  Check
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import { getLocaTrustVerificationQR } from '@/lib/qrCode';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import { ActionConfirmationModal, ConfirmationType } from '@/components/common/ActionConfirmationModal';
import { formatFCFA } from '@/lib/utils';
import { sendContractReminderToTenant, sendContractToTenant } from '@/lib/messagingStore';
import { LegalContractAnalyzerModal } from '@/components/contracts/LegalContractAnalyzerModal';
import { PenTool, Lock, Scale } from 'lucide-react';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { triggerCelebration } from '@/lib/celebration';

interface ContractDetailViewProps {
  onBack?: () => void;
  contractNumber?: string;
  isAgency?: boolean;
}

export const ContractDetailView: React.FC<ContractDetailViewProps> = ({
  onBack,
  contractNumber = 'CT-2026-00058',
  isAgency = false,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'document'>('details');

  const isPendingSignature = contractNumber === 'CT-2026-00059';

  const tenantData = contractNumber === 'CT-2026-00059'
    ? {
        name: 'Kouamé Yves',
        phone: '+225 07 45 89 12 00',
        email: 'kouame.yves@email.com',
        cni: 'CI004789123',
        address: 'Angré 8ème Tranche, Cocody - Abidjan',
        propertyTitle: 'Villa Duplex 4 pièces - Cocody Angré 8ème Tranche',
        propertyAddress: 'Cocody Angré 8ème Tranche, Abidjan - Côte d\'Ivoire',
        rent: 250000,
        caution: 500000,
        charges: 15000,
        startDate: '01/10/2026',
        duration: 12,
        dateSignature: '24 septembre 2026',
        periode: '01/10/2026 au 30/09/2027',
        avatar: '',
      }
    : contractNumber === 'CT-2026-00060'
    ? {
        name: 'Touré Moussa',
        phone: '+225 07 12 34 56 78',
        email: 'toure.moussa@email.com',
        cni: 'CI008912345',
        address: 'Riviera Palmeraie, Cocody - Abidjan',
        propertyTitle: 'Appartement 3 pièces Standing - Riviera Palmeraie',
        propertyAddress: 'Riviera Palmeraie, Cocody, Abidjan - Côte d\'Ivoire',
        rent: 180000,
        caution: 360000,
        charges: 10000,
        startDate: '15/10/2026',
        duration: 12,
        dateSignature: '28 septembre 2026',
        periode: '15/10/2026 au 14/10/2027',
        avatar: '',
      }
    : contractNumber === 'CT-2026-00061'
    ? {
        name: 'Bamba Fatou',
        phone: '+225 05 98 76 54 32',
        email: 'bamba.fatou@email.com',
        cni: 'CI003456789',
        address: 'Zone 4, Marcory - Abidjan',
        propertyTitle: 'Studio meublé moderne - Marcory Zone 4',
        propertyAddress: 'Marcory Zone 4, Abidjan - Côte d\'Ivoire',
        rent: 120000,
        caution: 240000,
        charges: 8000,
        startDate: '01/11/2026',
        duration: 12,
        dateSignature: '30 septembre 2026',
        periode: '01/11/2026 au 31/10/2027',
        avatar: '',
      }
    : {
        name: 'Locataire',
        phone: '+225 05 67 89 45 12',
        email: 'contact@locatrust.ci',
        cni: 'CI002894129',
        address: 'Riviera 3, Cocody - Abidjan',
        propertyTitle: 'Appartement 3 pièces - Cocody Riviera 3',
        propertyAddress: 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
        rent: 75000,
        caution: 150000,
        charges: 5000,
        startDate: '01/07/2026',
        duration: 12,
        dateSignature: '01 juillet 2026',
        periode: '01/07/2026 au 30/06/2027',
        avatar: '',
      };

  const [showQrZoomModal, setShowQrZoomModal] = useState(false);

  // Real Handwritten Signature States
  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(() => {
    const ownerName = isAgency ? "Société Immobilière de l'Éléphant" : contract?.owner?.full_name || "Bailleur";
    return getCertifiedSignatureDataUrl(ownerName, isAgency ? 'agence' : 'bailleur');
  });
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(() => {
    return isPendingSignature ? null : getCertifiedSignatureDataUrl(tenantData.name, 'locataire');
  });
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
    type: 'Modification du loyer',
    effectiveDate: '01/11/2026',
    newRent: tenantData.rent,
    clauses: 'Avenant n°1 : Révision concertée des conditions locatives sans annulation du contrat de bail initial.'
  });
  const [terminationData, setTerminationData] = useState({
    effectiveDate: '31/12/2026',
    reason: 'Congé donné par le locataire',
    noticeMonths: 3,
    remainingRent: 0,
    cautionRestituted: tenantData.caution,
    deductions: 0,
    exitInspectionDate: '30/12/2026'
  });

  // Point 8 & 12: Analyse juridique et gestion de fin de contrat
  const [isAnalyzerModalOpen, setIsAnalyzerModalOpen] = useState(false);
  const [endOfContractMode, setEndOfContractMode] = useState<'renouvellement' | 'fin_contrat'>('fin_contrat');
  const [makePropertyAvailableAfterTermination, setMakePropertyAvailableAfterTermination] = useState(true);

  const isBothSigned = Boolean(ownerSignatureUrl && tenantSignatureUrl);
  const isAwaitingTenant = Boolean(ownerSignatureUrl && !tenantSignatureUrl);

  const handleRelanceInternal = (canal: 'Messagerie' | 'WhatsApp' | 'SMS' = 'Messagerie') => {
    // Liaison réelle avec la messagerie interne LocaTrust du locataire
    sendContractReminderToTenant('usr_tenant_1', contractNumber, tenantData.name, tenantData.propertyTitle);
    
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

  // PDF Generator with mandatory 2-party signature rule (Point 10)
  const handleDownloadPDF = async () => {
    if (!isBothSigned) {
      setIsDownloadBlockedModalOpen(true);
      return;
    }

    const leaseType = (contract?.usage_destination || (contract?.property as any)?.usage_destination || 'habitation') as 'habitation' | 'professionnel';
    await generateOfficialContractPdf({
      contractNumber,
      isAgency,
      ownerName: isAgency ? "Société Immobilière de l'Éléphant" : contract?.owner?.full_name || "Bailleur",
      ownerPhone: "+225 07 89 45 12 34",
      tenantName: tenantData.name,
      tenantPhone: tenantData.phone,
      tenantCni: tenantData.cni,
      propertyTitle: tenantData.propertyTitle,
      propertyAddress: tenantData.propertyAddress,
      durationMonths: tenantData.duration,
      startDate: tenantData.startDate,
      rent: tenantData.rent,
      cautionMonths: 2,
      chargesAmount: tenantData.charges,
      dueDay: 5,
      ownerSignatureUrl,
      tenantSignatureUrl,
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
    sendContractToTenant('usr_tenant_1', {
      contractNumber,
      propertyTitle: tenantData.propertyTitle,
      propertyAddress: tenantData.propertyAddress,
      rentAmount: tenantData.rent,
      cautionAmount: tenantData.caution,
      durationMonths: tenantData.duration,
      startDate: tenantData.startDate,
      ownerName: isAgency ? "Société Immobilière de l'Éléphant" : contract?.owner?.full_name || "Bailleur",
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

  const handleSaveAvenant = () => {
    setIsAvenantFormOpen(false);
    setConfirmationModal({
      isOpen: true,
      type: 'avenant_initiated',
      title: 'Avenant au contrat créé avec succès',
      message: `L'avenant lié au contrat original N° ${contractNumber} a été enregistré et transmis dans la messagerie du locataire.`,
      details: `Le contrat initial reste rigoureusement conservé sans être écrasé. Prise d'effet : ${avenantData.effectiveDate}.`,
      withCelebration: true
    });
  };

  const handleConfirmTermination = () => {
    setIsTerminationFormOpen(false);
    
    if (endOfContractMode === 'renouvellement') {
      setConfirmationModal({
        isOpen: true,
        type: 'avenant_initiated',
        title: 'Renouvellement du bail confirmé',
        message: `Le bail N° ${contractNumber} pour ${tenantData.name} a été renouvelé pour une période additionnelle de 12 mois.`,
        details: `Bien : ${tenantData.propertyTitle} • Nouvel avenant transmis au locataire.`,
        withCelebration: true
      });
      return;
    }

    const restitutionAmount = Math.max(0, tenantData.caution - terminationData.deductions);
    const availabilityMessage = makePropertyAvailableAfterTermination
      ? " Le logement a été automatiquement remis disponible dans le fil d'annonces de location."
      : " Le logement reste en maintenance avant relocation.";

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

        <div className="flex items-center gap-3">
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
              <button
                type="button"
                onClick={() => setIsDownloadBlockedModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 transition-all"
                title="Téléchargement bloqué : les signatures obligatoires des deux parties sont requises"
              >
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Téléchargement bloqué (Signatures incomplètes)</span>
              </button>
              {isAwaitingTenant && (
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

          <button
            onClick={() => setIsAnalyzerModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 transition-all"
          >
            <Scale className="w-4 h-4 text-amber-700" />
            <span>🔍 Analyser le contrat</span>
          </button>

          <button
            onClick={() => setIsAvenantInitiatedOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold border border-slate-200 transition-all"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Avenant</span>
          </button>

          <button
            onClick={() => setIsTerminationFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all"
          >
            <Clock className="w-4 h-4 text-rose-600" />
            <span>Fin du contrat</span>
          </button>
        </div>
      </div>

      {/* BANNIÈRE D'ALERTE : En attente signature du locataire */}
      {isAwaitingTenant && (
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
          
          {/* Metadata Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400">N° DU CONTRAT</span>
                <h3 className="text-lg font-black text-slate-900">{contractNumber}</h3>
              </div>
              {isAwaitingTenant ? (
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

          {/* PARTIES AU CONTRAT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-4">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Parties au contrat</h4>
            
            {/* Propriétaire */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center border-2 border-amber-600 shrink-0">
                {contract?.owner?.full_name ? contract.owner.full_name.slice(0, 2).toUpperCase() : 'BA'}
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-extrabold text-slate-900">PROPRIÉTAIRE (BAILLEUR)</span>
                <span className="font-bold text-slate-800">{contract?.owner?.full_name || 'Bailleur Propriétaire'}</span>
                <span className="text-slate-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {contract?.owner?.phone || '+225 07 00 00 00 00'}
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {contract?.owner?.email || 'contact@locatrust.ci'}
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Cocody, Abidjan - Côte d'Ivoire
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
                <span className="text-base font-black text-blue-900">05 de chaque mois</span>
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
              "Avenant n°1 (si applicable)",
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
          </div>

          {/* ACTIONS RAPIDES */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-2.5">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Actions Rapides</h4>
            <button
              onClick={handleSendContractToTenantInbox}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-black text-center transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Envoyer le contrat au locataire</span>
            </button>
            <button
              onClick={() => setIsAnalyzerModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-black text-center transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Scale className="w-3.5 h-3.5 text-amber-700" />
              <span>🔍 Analyser le contrat (CI & OHADA)</span>
            </button>
            <button
              onClick={() => setIsAvenantInitiatedOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-bold text-center transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Créer un avenant</span>
            </button>
            <button
              onClick={() => setIsTerminationFormOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-300 text-rose-700 bg-rose-50/50 hover:bg-rose-100/70 text-xs font-bold text-center transition-all flex items-center justify-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              <span>Fin du contrat & Restitution</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black text-center shadow-sm transition-all flex items-center justify-center gap-2 ${
                isBothSigned
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBothSigned ? 'Télécharger le contrat final (Signé)' : 'Télécharger (Signature requise)'}</span>
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
                    <span className="text-xl font-black text-slate-900 tracking-tight">Société Immobilière de l'Éléphant</span>
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
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80"
              alt="Bien immobilier"
              className="w-full md:w-36 h-28 rounded-xl object-cover border"
            />
            <div className="flex-1 flex flex-col gap-1 text-xs">
              <span className="font-extrabold text-slate-900 text-sm">{tenantData.propertyTitle}</span>
              <span className="text-slate-500">Localisation: {tenantData.propertyAddress}</span>
              <span className="text-slate-500">Surface: 120 m² | Composition: 3 pièces, 2 chambres, 1 salon, 2 salles de bain</span>
              <span className="text-slate-500">Équipements: Climatisation, chauffe-eau, groupe électrogène, parking</span>
            </div>
          </div>

          {/* Legal Articles Text */}
          <div className="flex flex-col gap-5 text-xs text-slate-700 leading-relaxed font-sans">
            
            {/* ARTICLE 1 & 2 */}
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 flex flex-col gap-2">
              <h5 className="font-extrabold text-blue-950 uppercase tracking-wide">ARTICLE 1 : DÉSIGNATION DU BIEN</h5>
              <p>Le bailleur donne en location au preneur qui accepte, le bien immobilier décrit ci-dessus à usage d'habitation.</p>
              
              <h5 className="font-extrabold text-blue-950 uppercase tracking-wide mt-2">ARTICLE 2 : DURÉE DU CONTRAT</h5>
              <p>Le présent contrat est conclu pour une durée déterminée de <strong>{tenantData.duration} mois</strong>, commençant le <strong>{tenantData.startDate}</strong> et prenant fin le <strong>{tenantData.periode.split(' au ')[1] || 'terme convenu'}</strong>. Il se renouvelle tacitement par période de même durée sauf dénonciation.</p>
            </div>

            {/* ARTICLE 3, 4, 5 FINANCIAL HIGHLIGHTS (Matching Orange Pill Boxes in Image 3) */}
            <div className="flex flex-col gap-3">
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-slate-900">ARTICLE 3 : LOYER MENSUEL</h5>
                  <p className="text-[11px] text-slate-600">Payable d'avance au plus tard le 05 de chaque mois.</p>
                </div>
                <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm">
                  {formatFCFA(tenantData.rent)}
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-slate-900">ARTICLE 4 : CAUTION (DÉPÔT DE GARANTIE)</h5>
                  <p className="text-[11px] text-slate-600">Restituée dans un délai maximal d'un (01) mois après la fin du bail.</p>
                </div>
                <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm">
                  {formatFCFA(tenantData.caution)}
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-slate-900">ARTICLE 5 : PROVISION SUR CHARGES</h5>
                  <p className="text-[11px] text-slate-600">Eau, électricité, entretien des parties communes et ordures ménagères.</p>
                </div>
                <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm">
                  {formatFCFA(tenantData.charges)} / mois
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

          {/* SIGNATURES SECTION (Matching Image 1 & Image 3 100%) */}
          <div className="pt-6 border-t border-slate-200 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Propriétaire Signature */}
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase">
                  {isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE' : 'LE PROPRIÉTAIRE (BAILLEUR)'}
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  {isAgency ? "Société Immobilière de l'Éléphant" : contract?.owner?.full_name || "Bailleur"}
                </span>

                <div className="min-h-[70px] flex items-center justify-center my-2 p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                  {ownerSignatureUrl ? (
                    <img
                      src={ownerSignatureUrl}
                      alt="Signature du propriétaire"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveSigningParty('proprietaire')}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Signer le contrat (Bailleur)</span>
                    </button>
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

              {/* Locataire Signature */}
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
                    <button
                      type="button"
                      onClick={() => setActiveSigningParty('locataire')}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Signer le contrat (Locataire)</span>
                    </button>
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
          onConfirmSignature={(signatureUrl) => {
            if (activeSigningParty === 'proprietaire') {
              setOwnerSignatureUrl(signatureUrl);
            } else {
              setTenantSignatureUrl(signatureUrl);
            }
            setActiveSigningParty(null);
          }}
          signerName={activeSigningParty === 'proprietaire' ? (isAgency ? "Société Immobilière de l'Éléphant" : contract?.owner?.full_name || "Bailleur") : contract?.tenant?.full_name || "Locataire"}
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
                    defaultValue="2026-11-01"
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
                <span className="font-bold text-slate-900">{isAgency ? "Société Immobilière de l'Éléphant" : contract?.owner?.full_name || "Bailleur"}</span>
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
        clausesText={`1. Le preneur s'engage à payer le loyer mensuel de ${formatFCFA(tenantData.rent)} au plus tard le 05 du mois.\n2. Le dépôt de garantie versé s'élève à la somme de ${formatFCFA(tenantData.caution)} correspondant à deux mois de loyer.\n3. Entretien courant et menues réparations locatives à la charge du locataire.\n4. Respect strict de la quiétude du voisinage et des règles de copropriété.`}
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
