import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Scale,
  Sparkles,
  Download,
  X,
  QrCode,
  Send,
  Building2,
  Check,
  AlertCircle,
  HelpCircle,
  Eye,
  Lock,
  UserCheck,
  Trash2,
  PenTool,
  MapPin,
  Mic,
  MicOff,
  Bell,
  ExternalLink
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { getLocaTrustVerificationQR } from '@/lib/qrCode';
import { LOCATRUST_QR_CODE_DATA_URL, LOCATRUST_QR_CODE_URL } from '@/lib/qrCodeData';
import { Logo } from '@/components/common/Logo';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import {
  runLegalAnalysisEngine,
  IVORIAN_CITIES,
  AnalyzedClauseItem,
  cleanClauseLine,
  LeaseType
} from '@/lib/legalAnalysisEngine';
import {
  notifyWaitingListCandidatesOnLeaseFinalized,
  WaitingListCandidateNotification
} from '@/lib/waitingListNotifications';

interface LegalContractGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAgency?: boolean;
  initialData?: {
    tenantName?: string;
    tenantPhone?: string;
    tenantCni?: string;
    propertyTitle?: string;
    propertyAddress?: string;
    rentAmount?: number;
    cautionAmount?: number;
    propertyCity?: string;
    propertyCommune?: string;
    durationMonths?: number;
    startDate?: string;
  };
  onContractFinalized?: (contractData: {
    contractNumber: string;
    tenantName: string;
    propertyTitle: string;
  }) => void;
}

export interface AnalyzedClause {
  id: string;
  source: 'proprietaire' | 'locataire' | 'logement';
  originalText: string;
  status: 'compatible' | 'clarification' | 'incompatible';
  legalReference?: string;
  explanation: string;
}

export const LegalContractGeneratorModal: React.FC<LegalContractGeneratorModalProps> = ({
  isOpen,
  onClose,
  isAgency = false,
  initialData,
  onContractFinalized
}) => {
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen]);

  // Parties & Property
  const [tenantName, setTenantName] = useState<string>(initialData?.tenantName || "Koffi N'Guessan");
  const [tenantPhone, setTenantPhone] = useState<string>(initialData?.tenantPhone || '+225 07 08 09 10 11');
  const [tenantCni, setTenantCni] = useState<string>(initialData?.tenantCni || 'CI-0029481920');
  const [ownerName, setOwnerName] = useState<string>(
    isAgency ? 'Immobilière du Golf Abidjan' : 'Kouassi Amadou'
  );
  const [ownerPhone, setOwnerPhone] = useState<string>('+225 01 22 33 44 55');

  const [propertyTitle, setPropertyTitle] = useState<string>(initialData?.propertyTitle || 'Appartement 3 pièces');

  // Ville et Commune (Côte d'Ivoire - Section 15 du cahier des charges)
  const [propertyCity, setPropertyCity] = useState<string>(initialData?.propertyCity || 'Abidjan');
  const [propertyCommune, setPropertyCommune] = useState<string>(initialData?.propertyCommune || 'Cocody');
  const [propertyStreet, setPropertyStreet] = useState<string>('Riviera 3');

  // Adresse complète calculée dynamiquement
  const computedAddress = useMemo(() => {
    const parts: string[] = [];
    if (propertyStreet.trim()) parts.push(propertyStreet.trim());
    if (propertyCommune.trim()) parts.push(propertyCommune.trim());
    if (propertyCity.trim()) parts.push(propertyCity.trim());
    if (parts.length === 0) return 'Côte d\'Ivoire';
    return parts.join(', ') + ' - Côte d\'Ivoire';
  }, [propertyStreet, propertyCommune, propertyCity]);

  const [propertyAddress, setPropertyAddress] = useState<string>(
    initialData?.propertyAddress || computedAddress
  );

  useEffect(() => {
    setPropertyAddress(computedAddress);
  }, [computedAddress]);

  const [propertyDestination, setPropertyDestination] = useState<string>('Habitation Principale');

  // Financials
  const [rent, setRent] = useState<number>(initialData?.rentAmount || 150000);
  const [advanceMonths, setAdvanceMonths] = useState<number>(2);
  const [cautionMonths, setCautionMonths] = useState<number>(2);
  const [chargesAmount, setChargesAmount] = useState<number>(10000);
  const [dueDay, setDueDay] = useState<number>(5);
  const [cautionPaidAmount, setCautionPaidAmount] = useState<number>(initialData?.cautionAmount || 300000);
  const [cautionReceiptNumber, setCautionReceiptNumber] = useState<string>('DEP-2026-CI-00984');
  const [contractNumber] = useState<string>('LT-2026-CI-000492');
  const [leaseType, setLeaseType] = useState<LeaseType>('habitation');
  const [fiscalStatus, setFiscalStatus] = useState<'non_enregistre' | 'en_cours' | 'enregistre'>('en_cours');
  const [startDate, setStartDate] = useState<string>(initialData?.startDate || '2026-10-01');
  const [durationMonths, setDurationMonths] = useState<number>(initialData?.durationMonths || 12);

  // Notifications des candidats en liste d'attente
  const [notifiedCandidates, setNotifiedCandidates] = useState<WaitingListCandidateNotification[]>([]);
  // Zoom QR Code modal
  const [showQrZoomModal, setShowQrZoomModal] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep('form');
      if (initialData) {
        if (initialData.tenantName) setTenantName(initialData.tenantName);
        if (initialData.tenantPhone) setTenantPhone(initialData.tenantPhone);
        if (initialData.tenantCni) setTenantCni(initialData.tenantCni);
        if (initialData.propertyTitle) setPropertyTitle(initialData.propertyTitle);
        if (initialData.propertyCity) setPropertyCity(initialData.propertyCity);
        if (initialData.propertyCommune) setPropertyCommune(initialData.propertyCommune);
        if (initialData.propertyAddress) setPropertyAddress(initialData.propertyAddress);
        if (typeof initialData.rentAmount === 'number') setRent(initialData.rentAmount);
        if (typeof initialData.cautionAmount === 'number') setCautionPaidAmount(initialData.cautionAmount);
        if (typeof initialData.durationMonths === 'number') setDurationMonths(initialData.durationMonths);
        if (initialData.startDate) setStartDate(initialData.startDate);
      }
    }
  }, [
    isOpen,
    initialData?.tenantName,
    initialData?.tenantPhone,
    initialData?.tenantCni,
    initialData?.propertyTitle,
    initialData?.propertyAddress,
    initialData?.propertyCity,
    initialData?.propertyCommune,
    initialData?.rentAmount,
    initialData?.cautionAmount,
    initialData?.durationMonths,
    initialData?.startDate
  ]);

  // Conditions Particulières Saisies (Sections 1, 3, 4 du Cahier des Charges)
  const [ownerCustomConditions, setOwnerCustomConditions] = useState<string>(
    "1. Respect strict du calme et du voisinage après 22h.\n2. Interdiction d'élevage d'animaux dangereux.\n3. Entretien régulier des climatiseurs et appareils de cuisine.\n4. Stationnement autorisé uniquement sur la place réservée N° 14."
  );
  const [tenantCustomRequests, setTenantCustomRequests] = useState<string>(
    "1. Demande d'installation d'une serrure haute sécurité à la charge du locataire.\n2. Option de règlement par Wave ou Orange Money le 05 du mois."
  );
  const [propertySpecificRules, setPropertySpecificRules] = useState<string>(
    "1. Interdiction de percer les carreaux de faïence de la salle de bain.\n2. Utilisation conforme des espaces communs et tris des ordures dans le local poubelle."
  );

  // Workflow steps: 'form' -> 'verification' -> 'preview' -> 'success'
  const [currentStep, setCurrentStep] = useState<'form' | 'verification' | 'preview' | 'success'>('form');

  // Real Handwritten Signature States (LocaTrust Legal Digital Signatures)
  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(null);
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(null);
  const [activeSigningParty, setActiveSigningParty] = useState<'proprietaire' | 'locataire' | null>(null);

  // Inline Clause Editing State
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Voice Input (Saisie Vocale / Microphone Continue et Réactive)
  const [listeningField, setListeningField] = useState<'owner' | 'tenant' | 'property' | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const recognitionRef = React.useRef<any>(null);

  const stopActiveVoiceInput = React.useCallback(() => {
    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort();
        } else if (typeof recognitionRef.current.stop === 'function') {
          recognitionRef.current.stop();
        }
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setListeningField(null);
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      stopActiveVoiceInput();
    };
  }, [stopActiveVoiceInput]);

  const handleToggleVoiceInput = (field: 'owner' | 'tenant' | 'property') => {
    if (typeof window === 'undefined') return;

    // Si on clique sur le même champ déjà en écoute : arrêt propre
    if (listeningField === field) {
      stopActiveVoiceInput();
      return;
    }

    // Arrêt de toute reconnaissance active préalable
    stopActiveVoiceInput();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "La saisie vocale n'est pas supportée nativement par ce navigateur. Veuillez utiliser Google Chrome, Microsoft Edge ou Safari pour dicter vos conditions oralement."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListeningField(field);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (finalChunk && finalChunk.trim()) {
          const spokenText = finalChunk.trim();
          setInterimTranscript('');
          if (field === 'owner') {
            setOwnerCustomConditions((prev) => (prev ? `${prev}\n${spokenText}` : spokenText));
          } else if (field === 'tenant') {
            setTenantCustomRequests((prev) => (prev ? `${prev}\n${spokenText}` : spokenText));
          } else if (field === 'property') {
            setPropertySpecificRules((prev) => (prev ? `${prev}\n${spokenText}` : spokenText));
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return;
        }
        console.warn('Speech recognition status:', event.error);
        stopActiveVoiceInput();
      };

      recognition.onend = () => {
        // Fin normale de la session
        setListeningField(null);
        setInterimTranscript('');
        recognitionRef.current = null;
      };

      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      stopActiveVoiceInput();
    }
  };

  if (!isOpen) return null;

  const totalCautionRequired = rent * cautionMonths;
  const isCautionFullyPaid = cautionPaidAmount >= totalCautionRequired;

  // --------------------------------------------------------------------------
  // LOCATRUST CERTIFIED COMPLIANCE ENGINE (Section 1 à 14 du Cahier des Charges)
  // RÈGLE ABSOLUE : N'analyse QUE les clauses réellement présentes.
  // --------------------------------------------------------------------------
  const analysisReport = useMemo(() => {
    return runLegalAnalysisEngine({
      leaseType,
      ownerConditionsText: ownerCustomConditions,
      tenantRequestsText: tenantCustomRequests,
      propertyRulesText: propertySpecificRules,
      advanceMonths,
      cautionMonths,
      rent,
      city: propertyCity,
      commune: propertyCommune
    });
  }, [
    leaseType,
    ownerCustomConditions,
    tenantCustomRequests,
    propertySpecificRules,
    advanceMonths,
    cautionMonths,
    rent,
    propertyCity,
    propertyCommune
  ]);

  const blockingClauses = useMemo(() => {
    return analysisReport.clauses.filter((c) => c.status === 'non_conforme');
  }, [analysisReport]);

  const toVerifyClauses = useMemo(() => {
    return analysisReport.clauses.filter((c) => c.status === 'a_verifier');
  }, [analysisReport]);

  const compliantClauses = useMemo(() => {
    return analysisReport.clauses.filter((c) => c.status === 'conforme');
  }, [analysisReport]);

  // Communes disponibles pour la ville sélectionnée
  const availableCommunes = useMemo(() => {
    const cityFound = IVORIAN_CITIES.find(
      (c) => c.name.toLowerCase() === propertyCity.toLowerCase()
    );
    return cityFound?.communes || [];
  }, [propertyCity]);

  // Actions : Supprimer la clause problématique (Option 2 - Section 6)
  const handleDeleteClause = (clause: AnalyzedClauseItem) => {
    if (clause.fieldSource === 'ownerCustomConditions') {
      setOwnerCustomConditions((prev) => {
        const lines = prev.split('\n');
        if (typeof clause.lineIndex === 'number' && lines[clause.lineIndex] !== undefined) {
          lines.splice(clause.lineIndex, 1);
          return lines.join('\n');
        }
        return lines.filter((l) => cleanClauseLine(l) !== clause.rawText).join('\n');
      });
    } else if (clause.fieldSource === 'tenantCustomRequests') {
      setTenantCustomRequests((prev) => {
        const lines = prev.split('\n');
        if (typeof clause.lineIndex === 'number' && lines[clause.lineIndex] !== undefined) {
          lines.splice(clause.lineIndex, 1);
          return lines.join('\n');
        }
        return lines.filter((l) => cleanClauseLine(l) !== clause.rawText).join('\n');
      });
    } else if (clause.fieldSource === 'propertySpecificRules') {
      setPropertySpecificRules((prev) => {
        const lines = prev.split('\n');
        if (typeof clause.lineIndex === 'number' && lines[clause.lineIndex] !== undefined) {
          lines.splice(clause.lineIndex, 1);
          return lines.join('\n');
        }
        return lines.filter((l) => cleanClauseLine(l) !== clause.rawText).join('\n');
      });
    } else if (clause.fieldSource === 'advanceMonths') {
      setAdvanceMonths(2);
    } else if (clause.fieldSource === 'cautionMonths') {
      setCautionMonths(2);
    }
    if (editingClauseId === clause.id) {
      setEditingClauseId(null);
    }
  };

  // Actions : Corriger directement la clause problématique (Option 1 - Section 6)
  const handleSaveClauseEdit = (clause: AnalyzedClauseItem, newText: string) => {
    if (clause.fieldSource === 'ownerCustomConditions') {
      setOwnerCustomConditions((prev) => {
        const lines = prev.split('\n');
        if (typeof clause.lineIndex === 'number' && lines[clause.lineIndex] !== undefined) {
          lines[clause.lineIndex] = newText;
          return lines.join('\n');
        }
        return lines.map((l) => (cleanClauseLine(l) === clause.rawText ? newText : l)).join('\n');
      });
    } else if (clause.fieldSource === 'tenantCustomRequests') {
      setTenantCustomRequests((prev) => {
        const lines = prev.split('\n');
        if (typeof clause.lineIndex === 'number' && lines[clause.lineIndex] !== undefined) {
          lines[clause.lineIndex] = newText;
          return lines.join('\n');
        }
        return lines.map((l) => (cleanClauseLine(l) === clause.rawText ? newText : l)).join('\n');
      });
    } else if (clause.fieldSource === 'propertySpecificRules') {
      setPropertySpecificRules((prev) => {
        const lines = prev.split('\n');
        if (typeof clause.lineIndex === 'number' && lines[clause.lineIndex] !== undefined) {
          lines[clause.lineIndex] = newText;
          return lines.join('\n');
        }
        return lines.map((l) => (cleanClauseLine(l) === clause.rawText ? newText : l)).join('\n');
      });
    }
    setEditingClauseId(null);
  };

  // Vérification de compatibilité globale pour la continuation
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysisReport.isGlobalCompliant) {
      alert(
        `⛔ ALERTE LOCATRUST CONFORMITÉ : ${analysisReport.blockingCount} clause(s) sont incompatibles avec les dispositions impératives du droit applicable. Veuillez les corriger ou les supprimer avant de poursuivre.`
      );
      return;
    }
    setCurrentStep('verification');
  };


  const handleProceedToPreview = () => {
    setCurrentStep('preview');
  };

  const [activeVerificationToken, setActiveVerificationToken] = useState<string>('tok_cnt_ci2026_000492');

  const handleFinalSignAndTransmit = async () => {
    // 1. Enregistrement automatique et dynamique dans le registre de vérification officiel LocaTrust
    try {
      const { registerContractInVerificationRegistry } = await import('@/lib/verificationRegistry');
      const reg = registerContractInVerificationRegistry({
        contractNumber,
        ownerName,
        tenantName,
        propertyTitle,
        propertyAddress,
        rentAmount: rent,
        cautionAmount: rent * cautionMonths
      });
      setActiveVerificationToken(reg.token);
    } catch (err) {
      console.warn('Contract registry error:', err);
    }

    // 2. Notification automatique aux demandeurs en liste d'attente pour ce logement
    try {
      const notified = notifyWaitingListCandidatesOnLeaseFinalized({
        propertyTitle,
        propertyAddress,
        chosenTenantName: tenantName,
        contractNumber
      });
      setNotifiedCandidates(notified);
    } catch (notifErr) {
      console.warn('Waiting list notification error:', notifErr);
    }

    // Callback parent optionnel (ex: DemandesView)
    if (onContractFinalized) {
      try {
        onContractFinalized({
          contractNumber,
          tenantName,
          propertyTitle
        });
      } catch (e) {
        console.warn('onContractFinalized error:', e);
      }
    }

    // 3. Animation festive et vivante de célébration (pluie de pétales/confettis de joie)
    try {
      const confettiModule = await import('canvas-confetti');
      const fn = (confettiModule as any)?.default || confettiModule;
      if (typeof fn === 'function') {
        // Premier tir festif
        fn({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#0038FF', '#10B981', '#F59E0B', '#EC4899'] });
        // Deuxième salve de pétales
        setTimeout(() => {
          fn({ particleCount: 60, spread: 90, origin: { y: 0.4 }, colors: ['#34D399', '#60A5FA', '#FBBF24'] });
        }, 300);
      }
    } catch (e) {
      console.warn('Confetti error:', e);
    }

    // 4. Bascule vers l'écran de confirmation compact et professionnel
    setCurrentStep('success');
  };

  const handleExportPDF = async () => {
    await generateOfficialContractPdf({
      contractNumber,
      isAgency,
      ownerName,
      ownerPhone,
      tenantName,
      tenantPhone,
      tenantCni,
      propertyTitle,
      propertyAddress,
      durationMonths,
      startDate,
      rent,
      cautionMonths,
      chargesAmount,
      dueDay,
      ownerSignatureUrl,
      tenantSignatureUrl,
    });
  };

  const modalContent = (
    <div
      id="legal-contract-modal-overlay"
      className="fixed inset-0 z-[99999] pointer-events-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 text-slate-800 transition-all ${
          currentStep === 'preview' ? 'max-w-4xl' : currentStep === 'success' ? 'max-w-lg' : 'max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black shadow-sm">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {currentStep === 'form' && 'Formulaire de Préparation du Bail Certifié Ivoirien'}
                {currentStep === 'verification' && 'Écran de Vérification & Compliance du Bail'}
                {currentStep === 'preview' && 'Contrat de Bail Final Certifié (41 Points Légaux)'}
                {currentStep === 'success' && 'Contrat Certifié & Transmis avec Succès !'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Conforme aux dispositions impératives du Code de la Construction et de l'Habitat (Loi n°2019-576)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: PREPARATION FORM WITH ALL CLAUSE INPUTS */}
        {currentStep === 'form' && (
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-6 text-xs">
            
            {/* Parties & Property Details */}
            {/* 1. Identification des Parties & du Bien Immobilier */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3 sm:gap-4">
              <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                1. Identification des Parties & Régime Juridique
              </span>

              {/* Sélection du Type de Bail & Régime Juridique (Sections 10 & 11) */}
              <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-blue-600" />
                    Régime Juridique du Contrat :
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {leaseType === 'habitation'
                      ? 'Bail d\'habitation : Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)'
                      : 'Bail commercial / professionnel : Acte Uniforme OHADA (AUDCG)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLeaseType('habitation')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      leaseType === 'habitation'
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                        : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Bail d'Habitation (Loi CI 2019-576)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaseType('professionnel')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      leaseType === 'professionnel'
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                        : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Bail Professionnel (OHADA)
                  </button>
                </div>
              </div>

              {/* Ligne 1 : Bailleur / Agence et Preneur */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px] sm:text-xs">
                    {isAgency ? 'Nom de la Société Immobilière' : 'Nom du Bailleur (Propriétaire) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    placeholder={isAgency ? "Ex: Immobilière du Golf Abidjan" : "Ex: Kouassi Amadou"}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px] sm:text-xs">
                    Nom du Preneur (Locataire) *
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    placeholder="Ex: Kouadio Jean"
                  />
                </div>
              </div>

              {/* Ligne 2 : Titre & Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px] sm:text-xs">
                    Désignation & Titre du Bien *
                  </label>
                  <input
                    type="text"
                    required
                    value={propertyTitle}
                    onChange={(e) => setPropertyTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    placeholder="Ex: Villa 4 pièces ou Appartement 3 pièces"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px] sm:text-xs">
                    Usage & Destination des Lieux
                  </label>
                  <input
                    type="text"
                    required
                    value={propertyDestination}
                    onChange={(e) => setPropertyDestination(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    placeholder="Ex: Habitation Principale ou Usage Commercial"
                  />
                </div>
              </div>

              {/* Ligne 3 : Localisation - Ville, Commune & Quartier (Section 15 du Cahier des Charges) */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
                <span className="font-bold text-slate-800 text-[11px] sm:text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Localisation en Côte d'Ivoire (Saisie libre ou sélection — Bouaké, Yamoussoukro, Abidjan, etc.)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                      Ville *
                    </label>
                    <input
                      type="text"
                      required
                      list="ivorian-cities-datalist"
                      value={propertyCity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPropertyCity(val);
                        const cityMatch = IVORIAN_CITIES.find(
                          (c) => c.name.toLowerCase() === val.toLowerCase()
                        );
                        if (cityMatch && !cityMatch.communes.includes(propertyCommune)) {
                          setPropertyCommune('');
                        }
                      }}
                      placeholder="Saisir ou sélectionner la ville"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <datalist id="ivorian-cities-datalist">
                      {IVORIAN_CITIES.map((c) => (
                        <option key={c.name} value={c.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                      Commune *
                    </label>
                    <input
                      type="text"
                      required
                      list="ivorian-communes-datalist"
                      value={propertyCommune}
                      onChange={(e) => setPropertyCommune(e.target.value)}
                      placeholder="Saisir ou sélectionner la commune"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <datalist id="ivorian-communes-datalist">
                      {availableCommunes.map((comm) => (
                        <option key={comm} value={comm} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                      Quartier / Rue / Précisions
                    </label>
                    <input
                      type="text"
                      value={propertyStreet}
                      onChange={(e) => setPropertyStreet(e.target.value)}
                      placeholder="Ex: Riviera 3, Rue des Jardins"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>Adresse enregistrée : <strong className="text-slate-800">{propertyAddress}</strong></span>
                  <span className="text-[10px] text-blue-600 font-bold">100% Modifiable</span>
                </div>
              </div>
            </div>

            {/* 2. Conditions Financières, Durée du Bail & Plafonds Légaux (Art. 415 & 416) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-black text-amber-950 text-xs uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  2. Conditions Financières & Durée du Bail (Loi n° 2019-576)
                </span>
                <span className="text-[11px] font-bold text-amber-800">Plafonnés à 2 Mois Max (Art. 415/416)</span>
              </div>

              {/* Ligne 1 : Durée du contrat & Date de début du bail (Saisie Bailleur) */}
              <div className="p-3.5 rounded-xl bg-white/90 border border-amber-300/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-amber-950 text-xs flex items-center gap-1.5">
                    <span>Durée du Contrat de Bail & Prise d'Effet</span>
                  </label>
                  <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {durationMonths} mois ({Math.floor(durationMonths / 12) > 0 ? `${Math.floor(durationMonths / 12)} an${Math.floor(durationMonths / 12) > 1 ? 's' : ''}` : ''}{durationMonths % 12 > 0 ? ` ${durationMonths % 12} mois` : ''})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  {/* Durée du bail avec presets et saisie libre */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-semibold mr-1">Raccourcis :</span>
                      {[6, 12, 24, 36].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDurationMonths(m)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                            durationMonths === m
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-100/70 text-amber-950 hover:bg-amber-200/70 border border-amber-300'
                          }`}
                        >
                          {m === 12 ? '12 mois (1 an)' : m === 24 ? '24 mois (2 ans)' : m === 36 ? '36 mois (3 ans)' : `${m} mois`}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          required
                          value={durationMonths}
                          onChange={(e) => setDurationMonths(Math.max(1, Number(e.target.value) || 1))}
                          placeholder="Ex: 12"
                          className="w-full h-10 px-3 pr-14 rounded-xl border border-amber-300 font-extrabold text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-900 pointer-events-none">
                          mois
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Reconductible</span>
                    </div>
                  </div>

                  {/* Date de prise d'effet */}
                  <div className="flex flex-col">
                    <label className="font-bold text-amber-950 block mb-1 text-[11px]">
                      Date de prise d'effet (Entrée en vigueur)
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-amber-300 font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Grille financière 4 colonnes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 items-end">
                <div className="flex flex-col">
                  <label className="font-bold text-amber-950 block mb-1 text-[11px] sm:text-xs truncate" title="Loyer Mensuel (FCFA)">
                    Loyer Mensuel (FCFA)
                  </label>
                  <input
                    type="number"
                    required
                    value={rent}
                    onChange={(e) => setRent(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-amber-300 font-extrabold text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="font-bold text-amber-950 block mb-1 text-[11px] sm:text-xs truncate" title="Mois d'Avance (Max 2)">
                    Mois d'Avance (Max 2)
                  </label>
                  <input
                    type="number"
                    required
                    value={advanceMonths}
                    onChange={(e) => setAdvanceMonths(Number(e.target.value))}
                    className={`w-full h-10 px-3 rounded-xl border font-bold text-xs bg-white outline-none ${
                      leaseType === 'habitation' && advanceMonths > 2
                        ? 'border-rose-500 text-rose-900 bg-rose-50'
                        : 'border-amber-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="font-bold text-amber-950 block mb-1 text-[11px] sm:text-xs truncate" title="Mois de Caution (Max 2)">
                    Mois de Caution (Max 2)
                  </label>
                  <input
                    type="number"
                    required
                    value={cautionMonths}
                    onChange={(e) => setCautionMonths(Number(e.target.value))}
                    className={`w-full h-10 px-3 rounded-xl border font-bold text-xs bg-white outline-none ${
                      leaseType === 'habitation' && cautionMonths > 2
                        ? 'border-rose-500 text-rose-900 bg-rose-50'
                        : 'border-amber-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="font-bold text-amber-950 block mb-1 text-[11px] sm:text-xs truncate" title="Jour d'échéance">
                    Jour d'échéance
                  </label>
                  <select
                    value={dueDay}
                    onChange={(e) => setDueDay(Number(e.target.value))}
                    className="w-full h-10 px-2.5 rounded-xl border border-amber-300 text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  >
                    <option value={5}>Le 05 du mois</option>
                    <option value={10}>Le 10 du mois</option>
                    <option value={1}>Le 01 du mois</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Clauses Réellement Saisies par les Parties (Sections 1, 3, 4) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  3. Conditions & Clauses Particulières Réellement Saisies
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Saisie libre au clavier ou dictée vocale par microphone
                </span>
              </div>

              {/* Owner Conditions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800 text-xs">
                    Conditions Particulières du Propriétaire (obligations, règles maison, stationnement, travaux, etc.)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleVoiceInput('owner')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                      listeningField === 'owner'
                        ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/30'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title="Parler au micro pour dicter vos conditions (retranscription automatique)"
                  >
                    {listeningField === 'owner' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Dictée en cours... (Cliquez pour arrêter)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dictée Vocale / Micro</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={ownerCustomConditions}
                  onChange={(e) => setOwnerCustomConditions(e.target.value)}
                  className="w-full p-3 rounded-xl border text-xs leading-relaxed bg-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Saisissez ou dictez les règles proposées par le propriétaire..."
                />
                {/* Visualiseur de dictée en cours pour le propriétaire */}
                {listeningField === 'owner' && (
                  <div className="mt-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                      <span className="text-[11px] text-rose-900 font-semibold truncate">
                        {interimTranscript ? (
                          <>Retranscription : <span className="font-bold italic">« {interimTranscript} »</span></>
                        ) : (
                          "🎙️ Microphone actif — Parlez naturellement, le texte s'ajoute en continu..."
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={stopActiveVoiceInput}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shrink-0 transition-colors shadow-xs"
                    >
                      Terminer la dictée
                    </button>
                  </div>
                )}
              </div>

              {/* Tenant Requests */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800 text-xs">
                    Demandes Particulières du Locataire (aménagements, paiements, etc.)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleVoiceInput('tenant')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                      listeningField === 'tenant'
                        ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/30'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title="Parler au micro pour dicter les demandes du locataire"
                  >
                    {listeningField === 'tenant' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Dictée en cours... (Cliquez pour arrêter)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dictée Vocale / Micro</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={tenantCustomRequests}
                  onChange={(e) => setTenantCustomRequests(e.target.value)}
                  className="w-full p-3 rounded-xl border text-xs leading-relaxed bg-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Saisissez ou dictez les demandes du locataire..."
                />
                {/* Visualiseur de dictée en cours pour le locataire */}
                {listeningField === 'tenant' && (
                  <div className="mt-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                      <span className="text-[11px] text-rose-900 font-semibold truncate">
                        {interimTranscript ? (
                          <>Retranscription : <span className="font-bold italic">« {interimTranscript} »</span></>
                        ) : (
                          "🎙️ Microphone actif — Parlez naturellement, le texte s'ajoute en continu..."
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={stopActiveVoiceInput}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shrink-0 transition-colors shadow-xs"
                    >
                      Terminer la dictée
                    </button>
                  </div>
                )}
              </div>

              {/* Property Specific Rules */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800 text-xs">
                    Règles Particulières du Logement & Copropriété (faïence, poubelles, équipements)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleVoiceInput('property')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                      listeningField === 'property'
                        ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/30'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title="Parler au micro pour dicter les règles spécifiques au bien"
                  >
                    {listeningField === 'property' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Dictée en cours... (Cliquez pour arrêter)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dictée Vocale / Micro</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={propertySpecificRules}
                  onChange={(e) => setPropertySpecificRules(e.target.value)}
                  className="w-full p-3 rounded-xl border text-xs leading-relaxed bg-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Saisissez ou dictez les règles spécifiques au bien..."
                />
                {/* Visualiseur de dictée en cours pour le logement */}
                {listeningField === 'property' && (
                  <div className="mt-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                      <span className="text-[11px] text-rose-900 font-semibold truncate">
                        {interimTranscript ? (
                          <>Retranscription : <span className="font-bold italic">« {interimTranscript} »</span></>
                        ) : (
                          "🎙️ Microphone actif — Parlez naturellement, le texte s'ajoute en continu..."
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={stopActiveVoiceInput}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shrink-0 transition-colors shadow-xs"
                    >
                      Terminer la dictée
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 4. MODULE D'ANALYSE JURIDIQUE LOCATRUST (Sections 5 à 14) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-4">
              
              {/* En-tête de l'analyse avec régime et sources */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                      <Scale className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                        Analyse Juridique des Clauses Réellement Saisies
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        Régime : <strong className="text-blue-700">{analysisReport.legalRegimeLabel}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {compliantClauses.length} Conforme(s)
                  </span>
                  {toVerifyClauses.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-black flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      {toVerifyClauses.length} À vérifier
                    </span>
                  )}
                  {blockingClauses.length > 0 ? (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                      {blockingClauses.length} Bloquante(s)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black">
                      0 Bloquante
                    </span>
                  )}
                </div>
              </div>


              {/* SECTION 5 DU CAHIER DES CHARGES : INTERFACE DES ANOMALIES JURIDIQUES DÉTECTÉES */}
              {blockingClauses.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="font-black text-rose-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Anomalies Juridiques Réellement Détectées ({blockingClauses.length})
                  </span>

                  {blockingClauses.map((clause) => (
                    <div
                      key={clause.id}
                      className="p-4 sm:p-5 rounded-2xl border-2 border-rose-400 bg-rose-50/90 flex flex-col gap-3.5 text-xs shadow-sm transition-all"
                    >
                      {/* Header carte anomalie */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                              ⚠️ ANOMALIE JURIDIQUE DÉTECTÉE
                            </span>
                            <h4 className="text-sm font-black text-rose-950 mt-1">{clause.title}</h4>
                            <span className="text-[11px] font-extrabold text-rose-700">
                              Partie concernée : {clause.sourceParty === 'proprietaire' ? 'Propriétaire (Bailleur)' : clause.sourceParty === 'locataire' ? 'Locataire (Preneur)' : clause.sourceParty === 'financier' ? 'Conditions Financières (Bailleur)' : 'Règlement du Logement'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-rose-200 text-rose-900 shrink-0">
                          🔴 Bloquant
                        </span>
                      </div>

                      {/* Clause exacte détectée */}
                      <div className="p-3 bg-white rounded-xl border border-rose-200 flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase">Clause réellement écrite par le propriétaire :</span>
                        <p className="font-bold text-slate-900 text-xs italic">« {clause.rawText} »</p>
                      </div>

                      {/* Interprétation comprise */}
                      {clause.understoodMeaning && (
                        <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-col gap-1">
                          <span className="text-[10px] font-extrabold text-blue-900 uppercase flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-600" /> Interprétation comprise par le système :
                          </span>
                          <p className="font-bold text-blue-950 text-xs">{clause.understoodMeaning}</p>
                        </div>
                      )}

                      {/* Règle juridique concernée */}
                      <div className="p-3 rounded-xl bg-rose-100/70 border border-rose-200 text-[11px] flex flex-col gap-1">
                        <span className="font-black text-rose-900 uppercase text-[10px] flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-rose-700" /> Règle juridique concernée :
                        </span>
                        <span className="font-bold text-slate-900">{clause.legalBasis.law}</span>
                        <span className="text-slate-700 font-semibold">{clause.legalBasis.article} • {clause.legalBasis.sourceHierarchy}</span>
                      </div>

                      {/* Explication du problème */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold text-slate-600 uppercase">Explication du problème détecté :</span>
                        <p className="text-xs text-rose-950 font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-rose-200">
                          {clause.explanation}
                        </p>
                      </div>

                      {/* Correction proposée */}
                      {clause.proposedCorrection && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] flex flex-col gap-1">
                          <span className="font-black text-emerald-900 uppercase text-[10px] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Correction proposée :
                          </span>
                          <span className="font-bold text-emerald-950">« {clause.proposedCorrection} »</span>
                        </div>
                      )}

                      {/* Actions : Corriger ou Supprimer */}
                      {editingClauseId === clause.id ? (
                        <div className="p-3.5 bg-white rounded-xl border border-rose-300 flex flex-col gap-2.5 animate-fadeIn">
                          <span className="font-black text-slate-900 text-xs">Modifier directement le texte de la clause :</span>
                          <textarea
                            rows={3}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          {clause.proposedCorrection && (
                            <button
                              type="button"
                              onClick={() => setEditingText(clause.proposedCorrection || '')}
                              className="text-[11px] text-blue-700 hover:text-blue-900 font-bold text-left underline flex items-center gap-1"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              Utiliser la correction légale proposée : "{clause.proposedCorrection}"
                            </button>
                          )}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t">
                            <button
                              type="button"
                              onClick={() => setEditingClauseId(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveClauseEdit(clause, editingText)}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Enregistrer et Réanalyser
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-rose-200">
                          <button
                            type="button"
                            onClick={() => handleDeleteClause(clause)}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-black text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>SUPPRIMER</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingClauseId(clause.id);
                              setEditingText(clause.proposedCorrection || clause.rawText);
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-sm flex items-center gap-1.5"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>CORRIGER</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Clauses à vérifier */}
              {toVerifyClauses.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Points d'Attention Juridique ({toVerifyClauses.length})
                  </span>
                  {toVerifyClauses.map((clause) => (
                    <div
                      key={clause.id}
                      className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 text-xs flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-black text-slate-900">{clause.title}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                          À vérifier
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium">{clause.explanation}</p>
                      <span className="text-[10px] text-slate-500 font-bold">Réf : {clause.legalBasis.law} ({clause.legalBasis.article})</span>
                    </div>
                  ))}
                </div>
              )}


              {/* SECTION 13 DU CAHIER DES CHARGES : ÉTAT GLOBAL DE L'ANALYSE */}
              {analysisReport.isGlobalCompliant ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 flex flex-col gap-3 animate-fadeIn shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-black text-sm uppercase tracking-wide block text-emerald-950">
                          ✓ ANALYSE TERMINÉE — AUCUNE ANOMALIE DÉTECTÉE
                        </span>
                        <span className="text-xs font-semibold text-emerald-800">
                          Le propriétaire peut continuer la génération du bail en toute sécurité.
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black self-start sm:self-auto shadow-sm">
                      100% Conforme
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200 text-xs font-bold text-emerald-900">
                    <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-emerald-200">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>✓ Clause conforme</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-emerald-200">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>✓ Règle conforme</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-emerald-200">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>✓ Conditions conformes</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 flex flex-col gap-2.5 animate-fadeIn shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span className="font-black text-sm uppercase tracking-wide">
                        ⚠️ ANOMALIE DÉTECTÉE ({analysisReport.blockingCount})
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black">
                      Action requise
                    </span>
                  </div>
                  <p className="text-xs font-bold text-rose-900 leading-relaxed">
                    Veuillez corriger ou supprimer la ou les clauses incompatibles avec le droit locatif applicable ci-dessus. L'analyse se relancera automatiquement après chaque modification.
                  </p>
                </div>
              )}
            </div>

            {/* BOUTON « VALIDER ET CONTINUER » (Section 8) */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-center transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!analysisReport.isGlobalCompliant}
                className={`px-6 py-3 rounded-xl text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all ${
                  !analysisReport.isGlobalCompliant
                    ? 'bg-slate-400 cursor-not-allowed opacity-75'
                    : 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-blue-500/25'
                }`}
              >
                {analysisReport.isGlobalCompliant ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>VALIDER ET CONTINUER</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>VALIDER ET CONTINUER (Bloqué - {analysisReport.blockingCount} anomalie{analysisReport.blockingCount > 1 ? 's' : ''})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}


        {/* STEP 2: PRE-GENERATION VERIFICATION SCREEN (Prompt 6) */}
        {currentStep === 'verification' && (
          <div className="flex flex-col gap-6 text-xs">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex flex-col">
                  <span className="text-base font-black text-slate-900">Rapport de Conformité LocaTrust</span>
                  <span className="text-xs text-slate-500">Vérification intégrale des règles légales et des clauses saisies</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Bail Prêt à la Génération
                </span>
              </div>

              {/* Summary Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">PARTIES & LOCALISATION</span>
                  <span className="font-black text-slate-900">{ownerName} & {tenantName}</span>
                  <span className="text-[11px] text-slate-600 font-semibold">{propertyTitle}</span>
                  <span className="text-[10px] text-blue-700 font-bold">{propertyAddress}</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">LOYER & CAUTION</span>
                  <span className="font-black text-blue-700">{formatFCFA(rent)} / mois</span>
                  <span className="text-[11px] text-slate-500">Caution : {formatFCFA(rent * cautionMonths)} ({cautionMonths} mois)</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Avance : {advanceMonths} mois (Conforme Art. 415)</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">ANALYSE JURIDIQUE</span>
                  <span className="font-black text-emerald-700">✓ 100% Conforme ({compliantClauses.length} clause{compliantClauses.length > 1 ? 's' : ''})</span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {leaseType === 'habitation'
                      ? 'Code de la Construction (Loi n°2019-576)'
                      : 'Bail Professionnel (OHADA AUDCG)'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">0 anomalie bloquante</span>
                </div>
              </div>

              {/* Status Verification Bullet Checklist */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-2 text-emerald-950 font-bold">
                <span className="flex items-center gap-2 text-sm font-black">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ✓ Informations complètes du bailleur, locataire et localisation ({propertyCity}{propertyCommune ? `, ${propertyCommune}` : ''})
                </span>
                <span className="flex items-center gap-2 text-sm font-black">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ✓ {analysisReport.categories.length} catégories juridiques analysées et validées
                </span>
                <span className="flex items-center gap-2 text-sm font-black">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ✓ Respect strict des dispositions impératives ({leaseType === 'habitation' ? 'Loi n° 2019-576' : 'OHADA AUDCG'})
                </span>
              </div>

            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setCurrentStep('form')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-slate-700 text-center"
              >
                &laquo; Modifier le Formulaire
              </button>

              <button
                type="button"
                onClick={handleProceedToPreview}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Générer le Contrat de Bail Final 41-Points</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 41-POINT FULL CONTRACT RENDER WITH ALL SECTIONS & ARTICLES (Prompts 4 & 5) */}
        {currentStep === 'preview' && (
          <div className="flex flex-col gap-6 text-xs">
            {/* The Document Sheet */}
            <div className="p-6 sm:p-10 rounded-3xl border border-slate-200 bg-white font-sans text-slate-800 shadow-xl flex flex-col gap-6 relative">
              
              {/* Header Banner inside Document */}
              <div className="flex items-start justify-between border-b pb-6">
                <div>
                  {isAgency ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xl font-black text-slate-900 tracking-tight">{ownerName}</span>
                        <span className="text-xs text-blue-600 font-extrabold uppercase tracking-wider">Agence Immobilière Agréée</span>
                      </div>
                    </div>
                  ) : (
                    <Logo size="md" variant="light" showSubtitle={true} />
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3.5">
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-lg sm:text-xl font-black text-blue-900 tracking-tight">CONTRAT DE BAIL</span>
                    <span className="px-3 py-1 rounded-md bg-amber-500 text-slate-950 text-xs font-black shadow-sm">
                      N° {contractNumber}
                    </span>
                    <span className="text-[11px] text-slate-600 font-bold">
                      Durée : <strong>{durationMonths} mois</strong> • Début : <strong>{startDate}</strong>
                    </span>
                  </div>

                  {/* QR Code officiel LocaTrust - Grand format HD & scannable */}
                  <div
                    onClick={() => setShowQrZoomModal(true)}
                    className="p-2 bg-white border-2 border-blue-400/50 hover:border-blue-600 rounded-2xl shadow-sm hover:shadow-md flex flex-col items-center gap-1 cursor-pointer transition-all group shrink-0"
                    title="Cliquer pour agrandir le QR Code ou tester le scan"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-1 rounded-xl flex items-center justify-center">
                      <img
                        src={getLocaTrustVerificationQR(`/verify/contrat/${contractNumber}`, 320)}
                        alt={`Authentification QR Code Officiel LocaTrust ${contractNumber}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <span className="text-[10px] font-black text-blue-900 uppercase tracking-tight flex items-center gap-1 group-hover:text-blue-700">
                        <QrCode className="w-3 h-3 text-blue-600" />
                        Scanner Authenticité
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold">
                        Caméra Mobile (ISO 18004)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Entre les soussignés */}
              <div className="flex flex-col gap-4">
                <span className="text-xs font-bold text-slate-500 italic">Entre les soussignés :</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bailleur / Agence */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-wide">
                      {isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE (MANDATAIRE) :' : 'LE PROPRIÉTAIRE (BAILLEUR) :'}
                    </span>
                    <span className="text-slate-700"><strong>Nom :</strong> {ownerName}</span>
                    <span className="text-slate-700"><strong>Téléphone :</strong> {ownerPhone}</span>
                    <span className="text-slate-700"><strong>Email :</strong> contact@{ownerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bailleur'}.ci</span>
                    <span className="text-slate-700"><strong>Adresse :</strong> Cocody, Abidjan - Côte d'Ivoire</span>
                    <span className="text-slate-700"><strong>Pièce d'identité :</strong> CNI N° CI123456789</span>
                  </div>

                  {/* Locataire */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-wide">
                      LE LOCATAIRE (PRENEUR) :
                    </span>
                    <span className="text-slate-700"><strong>Nom :</strong> {tenantName}</span>
                    <span className="text-slate-700"><strong>Téléphone :</strong> {tenantPhone}</span>
                    <span className="text-slate-700"><strong>Email :</strong> {tenantName.toLowerCase().replace(/[^a-z0-9]/g, '')}@email.com</span>
                    <span className="text-slate-700"><strong>Adresse :</strong> Riviera 3, Cocody - Abidjan</span>
                    <span className="text-slate-700"><strong>Pièce d'identité :</strong> CNI N° {tenantCni}</span>
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-500 italic">Il a été convenu et arrêté ce qui suit :</span>
              </div>

              {/* ARTICLE 1 : DÉSIGNATION DU BIEN AVEC PHOTO */}
              <div className="flex flex-col gap-3">
                <span className="font-black text-blue-900 text-xs uppercase tracking-wide">
                  ARTICLE 1 : DÉSIGNATION DU BIEN
                </span>
                <p className="text-xs text-slate-600">
                  Le bailleur donne en location au preneur qui accepte, le bien immobilier suivant :
                </p>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80"
                    alt="Bien immobilier"
                    className="w-full sm:w-44 h-32 rounded-xl object-cover border shrink-0"
                  />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700">
                    <div><strong>Type :</strong> {propertyTitle}</div>
                    <div><strong>Localisation :</strong> {propertyAddress}</div>
                    <div><strong>Surface :</strong> 120 m²</div>
                    <div><strong>Composition :</strong> 3 pièces, 2 chambres, 1 salon, 2 salles de bain, cuisine, balcon</div>
                    <div className="sm:col-span-2"><strong>Équipements :</strong> Climatisation, chauffe-eau, groupe électrogène, parking</div>
                    <div className="sm:col-span-2"><strong>Usage :</strong> {propertyDestination}</div>
                  </div>
                </div>
              </div>

              {/* ARTICLE 2 : DURÉE */}
              <div className="flex flex-col gap-1 text-xs text-slate-700">
                <span className="font-black text-blue-900 uppercase tracking-wide">
                  ARTICLE 2 : DURÉE
                </span>
                <p className="leading-relaxed">
                  Le présent contrat est conclu pour une durée déterminée de <strong>{durationMonths} mois</strong>, commençant le <strong>{startDate}</strong>. Il se renouvelle tacitement par période de même durée sauf dénonciation par l'une des parties dans les conditions prévues à l'article 8.
                </p>
              </div>

              {/* ARTICLES 3, 4, 5 : CONDITIONS FINANCIÈRES (AVEC PILLS ORANGE EXACTES) */}
              <div className="flex flex-col gap-3">
                
                {/* Article 3 : Loyer */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-slate-900 text-xs">ARTICLE 3 : LOYER</span>
                    <span className="text-xs text-slate-600">Le locataire s'engage à payer au bailleur, un loyer mensuel payable d'avance le <strong>{dueDay < 10 ? '0' + dueDay : dueDay} de chaque mois</strong>.</span>
                    <span className="text-[11px] text-slate-500">Mode de paiement accepté : Mobile Money (Orange Money, MTN Money, Wave) ou virement bancaire.</span>
                  </div>
                  <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm shrink-0">
                    {formatFCFA(rent)}
                  </span>
                </div>

                {/* Article 4 : Caution */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-slate-900 text-xs">ARTICLE 4 : CAUTION (DÉPÔT DE GARANTIE)</span>
                    <span className="text-xs text-slate-600">À la signature du présent contrat, le locataire verse au bailleur une caution (plafonné à 2 mois max, Art. 416).</span>
                    <span className="text-[11px] text-slate-500">Cette caution sera restituée dans un délai maximal d'un (01) mois après la fin du bail, déduction faite des réparations locatives. Reçu N° {cautionReceiptNumber}.</span>
                  </div>
                  <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm shrink-0">
                    {formatFCFA(rent * cautionMonths)}
                  </span>
                </div>

                {/* Article 5 : Charges */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-slate-900 text-xs">ARTICLE 5 : CHARGES</span>
                    <span className="text-xs text-slate-600">Le locataire paiera en plus du loyer, une provision sur charges (eau, électricité parties communes, ordures).</span>
                    <span className="text-[11px] text-slate-500">Un décompte annuel sera effectué et la régularisation se fera si nécessaire.</span>
                  </div>
                  <span className="text-base font-black text-amber-700 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm shrink-0">
                    {formatFCFA(chargesAmount)} / mois
                  </span>
                </div>

              </div>

              {/* ARTICLE 6 & 7 : OBLIGATIONS DES PARTIES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col gap-1.5 text-xs">
                  <span className="font-black text-blue-900 uppercase tracking-wide">
                    ARTICLE 6 : OBLIGATIONS DU LOCATAIRE
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                    <li>Payer le loyer et les charges aux dates convenues.</li>
                    <li>User paisiblement des lieux en bon père de famille.</li>
                    <li>Entretenir le logement et effectuer les petites réparations.</li>
                    <li>Ne pas transformer les lieux sans l'accord écrit du bailleur.</li>
                    <li>Informer le bailleur de tout sinistre ou dommage.</li>
                    <li>Respecter le règlement intérieur et le voisinage.</li>
                    <li>Restituer les lieux en bon état à la fin du contrat.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col gap-1.5 text-xs">
                  <span className="font-black text-blue-900 uppercase tracking-wide">
                    ARTICLE 7 : OBLIGATIONS DU PROPRIÉTAIRE
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                    <li>Remettre au locataire un logement en bon état et décent.</li>
                    <li>Assurer la jouissance paisible des lieux.</li>
                    <li>Effectuer les grosses réparations nécessaires (structure, toiture).</li>
                    <li>Maintenir le logement en état d'habitabilité conforme.</li>
                    <li>Respecter la vie privée du locataire.</li>
                    <li>Fournir les quittances de paiement après chaque encaissement.</li>
                  </ul>
                </div>
              </div>

              {/* ARTICLE 8 : CONDITIONS PARTICULIÈRES RÉELLEMENT CONVENUES ET REFORMULÉES */}
              {compliantClauses.filter(c => c.fieldSource !== 'advanceMonths' && c.fieldSource !== 'cautionMonths').length > 0 && (
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-blue-900 uppercase tracking-wide block">
                      ARTICLE 8 : CONDITIONS PARTICULIÈRES CONVENUES ENTRE LES PARTIES
                    </span>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Validées et reformulées en droit
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Dans le cadre de la liberté contractuelle et en conformité stricte avec les dispositions d'ordre public de la {leaseType === 'habitation' ? 'Loi n° 2019-576' : 'réglementation OHADA AUDCG'}, les parties ont convenu des conditions particulières suivantes, rédigées en termes juridiques :
                  </p>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-800 text-[11px] font-medium mt-1">
                    {compliantClauses
                      .filter((c) => c.fieldSource !== 'advanceMonths' && c.fieldSource !== 'cautionMonths')
                      .map((c) => (
                        <li key={c.id}>
                          <strong>{c.reformulatedText || c.rawText}</strong>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* ARTICLE 9 & 10 : RÉSILIATION ET LITIGES */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col gap-2 text-xs">
                <div>
                  <span className="font-black text-blue-900 uppercase tracking-wide block">
                    ARTICLE 9 : RÉSILIATION
                  </span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    En cas de manquement grave par l'une des parties à ses obligations, l'autre partie pourra résilier le présent contrat après mise en demeure restée sans effet pendant un délai de 30 jours (Art. 450 de la Loi n°2019-576).
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="font-black text-blue-900 uppercase tracking-wide block">
                    ARTICLE 10 : LITIGES
                  </span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Tout litige relatif à l'interprétation ou à l'exécution du présent contrat sera soumis à l'amiable. À défaut d'accord, il sera porté devant les juridictions compétentes du Tribunal de Première Instance d'Abidjan.
                  </p>
                </div>
              </div>

              {/* SIGNATURES SECTION WITH EXACT GOLDEN SEAL & SIGNATURES */}
              <div className="pt-6 border-t border-slate-200 flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                  
                  {/* Bailleur / Agence Signature */}
                  <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      {isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE' : 'LE PROPRIÉTAIRE (BAILLEUR)'}
                    </span>
                    <span className="font-black text-slate-900 text-xs">{ownerName}</span>

                    <div className="min-h-[70px] flex items-center justify-center my-2 p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                      {ownerSignatureUrl ? (
                        <img
                          src={ownerSignatureUrl}
                          alt="Signature manuscrite du propriétaire"
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
                        <CheckCircle2 className="w-3.5 h-3.5" /> Signature manuscrite certifiée
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-bold">
                        En attente de signature
                      </span>
                    )}
                  </div>

                  {/* Locataire Signature */}
                  <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      LE LOCATAIRE (PRENEUR)
                    </span>
                    <span className="font-black text-slate-900 text-xs">{tenantName}</span>

                    <div className="min-h-[70px] flex items-center justify-center my-2 p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                      {tenantSignatureUrl ? (
                        <img
                          src={tenantSignatureUrl}
                          alt="Signature manuscrite du locataire"
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
                        <CheckCircle2 className="w-3.5 h-3.5" /> Signature manuscrite certifiée
                      </span>
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

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setCurrentStep('verification')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-slate-700 text-center"
              >
                &laquo; Retour à la Vérification
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {tenantSignatureUrl ? (
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le contrat final signé</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => alert("Téléchargement bloqué : Le contrat officiel final ne peut pas être téléchargé tant que le locataire n'a pas apposé sa signature.")}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-300 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                    title="Téléchargement bloqué : En attente de signature du locataire"
                  >
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Téléchargement bloqué (En attente du locataire)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFinalSignAndTransmit}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Signer & Transmettre au Locataire</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION SCREEN (Design épuré, compact et élégant) */}
        {currentStep === 'success' && (
          <div className="flex flex-col items-center text-center gap-4 sm:gap-5 py-4 sm:py-6 animate-fadeIn">
            {/* Animated Celebration Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="flex flex-col gap-1.5 max-w-md">
              <span className="px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider w-fit mx-auto">
                Bail Officiellement Certifié & Transmis
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Contrat N° {contractNumber}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Le document <strong>41-points légaux</strong> intégrant le QR Code d'authenticité et les signatures électroniques a été transmis avec succès dans l'espace du preneur (<strong>{tenantName}</strong>).
              </p>
            </div>

            {/* Notification automatique des candidats en liste d'attente */}
            {notifiedCandidates.length > 0 && (
              <div className="w-full p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-left animate-fadeIn">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex flex-col gap-1 text-xs flex-1">
                  <span className="font-extrabold text-blue-950">
                    📢 Notification automatique envoyée aux demandeurs en liste d'attente
                  </span>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Les candidats en liste d'attente (<strong>{notifiedCandidates.map((c) => c.candidateName).join(', ')}</strong>) ont été automatiquement notifiés par message et dans leur espace que le logement « <strong>{propertyTitle}</strong> » n'est plus disponible car le bail a été finalisé avec {tenantName}.
                  </p>
                </div>
              </div>
            )}

            {/* Security & Authenticity Card */}
            <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-xs">
                  <span className="font-extrabold text-slate-900">Horodatage & Preuve Cryptographique</span>
                  <span className="text-[11px] text-slate-500">Conforme à la Loi n°2019-576 sur le bail d'habitation</span>
                  <span className="text-[10px] text-emerald-700 font-bold mt-0.5">✓ Enregistré au registre officiel de vérification</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  onClick={() => setShowQrZoomModal(true)}
                  className="w-20 h-20 sm:w-24 sm:h-24 bg-white border-2 border-blue-400/50 hover:border-blue-600 rounded-xl p-1.5 flex items-center justify-center shadow-sm cursor-pointer transition-all"
                  title="Cliquer pour agrandir le QR Code"
                >
                  <img
                    src={LOCATRUST_QR_CODE_DATA_URL}
                    alt="QR Code Officiel LocaTrust"
                    className="w-full h-full object-contain"
                  />
                </div>
                <a
                  href={`/verification/contrat/${activeVerificationToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 font-black hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Tester la vérification
                </a>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full pt-3 border-t">
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger Contrat PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Terminer & Retourner</span>
              </button>
            </div>
          </div>
        )}

      </div>

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
          signerName={activeSigningParty === 'proprietaire' ? ownerName : tenantName}
          signerRole={activeSigningParty}
          documentTitle="Contrat de Bail d'Habitation 41-Points"
          documentNumber={contractNumber}
        />
      )}

      {/* Modal QR Code Agrandissement & Scan Smartphone Direct */}
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
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-56 h-56 sm:w-64 sm:h-64 bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center">
              <img
                src={getLocaTrustVerificationQR(`/verify/contrat/${contractNumber}`, 400)}
                alt={`QR Code officiel agrandi ${contractNumber}`}
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
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ouvrir la page de vérification</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};


