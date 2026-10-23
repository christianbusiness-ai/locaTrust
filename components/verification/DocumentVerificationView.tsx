'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Calendar,
  User,
  Building2,
  Clock,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Receipt,
  FileCheck,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { supabase } from '@/src/lib/supabase';
import {
  MOCK_VERIFICATION_REGISTRY,
  ContractVerificationRecord,
  ReceiptVerificationRecord,
  ProofDossierVerificationRecord,
  DocumentVerificationStatus,
  UnifiedVerificationResult,
  verifyDocumentToken,
  maskPersonName
} from '@/lib/verificationRegistry';
import { formatFCFA } from '@/lib/utils';

interface DocumentVerificationViewProps {
  type?: 'contrat' | 'recu' | 'dossier';
  token: string;
  onNavigateBack?: () => void;
  onNavigateToDocument?: (type: 'contrat' | 'recu' | 'dossier', token: string) => void;
}

export const DocumentVerificationView: React.FC<DocumentVerificationViewProps> = ({
  type,
  token,
  onNavigateBack,
  onNavigateToDocument
}) => {
  const [selectedTab, setSelectedTab] = useState<'details' | 'history' | 'receipts'>('details');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contractData, setContractData] = useState<ContractVerificationRecord | undefined>(undefined);
  const [receiptData, setReceiptData] = useState<ReceiptVerificationRecord | undefined>(undefined);
  const [proofData, setProofData] = useState<ProofDossierVerificationRecord | undefined>(undefined);
  const [verificationResult, setVerificationResult] = useState<UnifiedVerificationResult | null>(null);

  const fetchDocument = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const detectedType = type || (
        token.startsWith('tok_prf_') || token.startsWith('PROOF-') ? 'dossier' :
        (token.startsWith('tok_rec_') || token.startsWith('ESP-') || token.startsWith('REC-') ? 'recu' : 'contrat')
      );
      const res = await verifyDocumentToken(token, detectedType);
      setVerificationResult(res);
      if (res.proofDossier) setProofData(res.proofDossier);
      if (res.contract) setContractData(res.contract);
      if (res.receipt) setReceiptData(res.receipt);
    } catch (err: any) {
      console.error('Erreur technique vérification:', err);
      setLoadError(err?.message || 'Erreur réseau lors de la consultation du registre');
    } finally {
      setIsLoading(false);
    }
  }, [type, token]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const isFound = Boolean(verificationResult?.isFound && (contractData || receiptData || proofData));
  const currentStatus: DocumentVerificationStatus = verificationResult?.status || (isFound ? (proofData?.status || contractData?.status || receiptData?.status || 'valide') : 'introuvable');
  const activeDocumentType = proofData ? 'dossier' : (contractData ? 'contrat' : 'recu');

  // 1. ÉTAT DE CHARGEMENT (LOADER)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-blue-100 text-blue-800">
              Vérification en cours
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-12 flex flex-col items-center gap-6 w-full">
          <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm space-y-6 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl animate-shimmer flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-blue-600 opacity-60" />
            </div>
            <div className="space-y-2 w-full flex flex-col items-center">
              <div className="h-5 w-64 animate-shimmer rounded-lg" />
              <div className="h-3.5 w-80 max-w-full animate-shimmer rounded" />
            </div>
            <div className="w-full space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="h-10 animate-shimmer rounded-xl w-full" />
              <div className="h-10 animate-shimmer rounded-xl w-full" />
              <div className="h-10 animate-shimmer rounded-xl w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. ÉTAT ERREUR RÉSEAU / REGISTRE
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-amber-100 text-amber-800">
              Erreur Registre
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-6 w-full animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-xl flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-black text-slate-900">Impossible de joindre le registre</h1>
              <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
            </div>
            <button
              onClick={() => fetchDocument()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer la vérification</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 3. ÉTAT INTROUVABLE / CODE NON RECONNU (Conforme spécifications : pas d'accusation prématurée de faux)
  if (!isFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-amber-100 text-amber-800">
              Contrôle de Vérification
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-6 w-full animate-fadeIn">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à LocaTrust</span>
            </button>
          )}

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700">
                Code de vérification non reconnu
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Document introuvable
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md">
                Ce QR Code ou identifiant de vérification ne correspond à aucun document certifié et archivé sur le registre cryptographique de <strong>LocaTrust</strong>.
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs flex flex-col gap-2">
              <span className="font-black text-slate-900 text-xs">Explication & Recommandation :</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Vérifiez que le QR code scanné n'est pas altéré et qu'il provient bien d'une session ou d'un document original émis par LocaTrust. Si ce document vient d'être généré, assurez-vous qu'il a été finalisé et archivé.
              </p>
            </div>

            {/* Diagnostics Techniques */}
            <div className="w-full p-3.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-left text-[11px] text-slate-500 font-mono space-y-1">
              <div>Identifiant scanné : <strong className="text-slate-800">{token}</strong></div>
              <div>Registre interrogé : <span className="text-slate-700">{verificationResult?.diagnostics?.tablesQueried?.join(', ') || 'document_verifications, receipts, contracts'}</span></div>
              <div>Résultat : <span className="text-amber-800 font-semibold">0 document correspondant</span></div>
              <div>Horodatage du contrôle : <span>{new Date().toLocaleString('fr-FR')}</span></div>
            </div>

            <button
              onClick={() => fetchDocument()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-colors shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer la vérification</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // CAS 1 : DOSSIER DE PREUVE OFFICIEL (CONTRAT TERMINÉ)
  if (proofData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                DOSSIER DE PREUVE CERTIFIÉ
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6 w-full animate-fadeIn">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à LocaTrust</span>
            </button>
          )}

          {/* Carte Principale du Dossier de Preuve */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl flex flex-col gap-6">
            
            {/* Header Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg shadow-inner">
                  <FileCheck className="w-7 h-7 text-purple-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-700">
                    Dossier de preuve LocaTrust
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                    {proofData.proofId}
                  </h1>
                  <span className="text-xs text-slate-500 font-semibold mt-0.5">
                    Contrat lié : <strong>{proofData.contractNumber}</strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-1">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 w-fit">
                  Contrat Terminé (Archive Scellée)
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Généré le {proofData.generatedAt}
                </span>
              </div>
            </div>

            {/* Note d'intégrité */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-extrabold text-slate-900">
                  Authenticité du dossier de location garantie par LocaTrust
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Ce document est une photographie documentaire officielle des données réelles enregistrées dans le registre de LocaTrust. L'ensemble des stipulations, quittances, cautions et états des lieux ont été définitivement clôturés sans possibilité de modification rétroactive.
                </p>
              </div>
            </div>

            {/* Section 1 : Parties au contrat (Protection de la vie privée conforme RGPD/Loi 2019-576) */}
            <div className="flex flex-col gap-3">
              <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                Parties Certifiées au Contrat
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Propriétaire / Bailleur</span>
                  <span className="text-sm font-black text-slate-900">{proofData.parties.ownerName}</span>
                  <span className="text-[10px] font-extrabold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Identité Vérifiée LocaTrust
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Preneur / Locataire</span>
                  <span className="text-sm font-black text-slate-900">{proofData.parties.tenantName}</span>
                  <span className="text-[10px] font-extrabold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Identité Vérifiée LocaTrust
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2 : Logement concerné */}
            <div className="flex flex-col gap-3">
              <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                Logement
              </span>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-black text-slate-900 text-sm">{proofData.property.type}</span>
                  <span className="text-slate-600">{proofData.property.location}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Réf. bien : {proofData.property.propertyRef}</span>
                </div>
              </div>
            </div>

            {/* Section 3 : Synthèse de clôture & Finances */}
            <div className="flex flex-col gap-3">
              <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                Synthèse de Fin de Bail
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-800">Total Loyers Réglés</span>
                  <span className="text-xs font-black text-emerald-900">
                    {formatFCFA(proofData.financials.totalPaid)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-800">Caution Restituée</span>
                  <span className="text-xs font-black text-emerald-900">
                    {formatFCFA(proofData.financials.cautionRestitutedAmount)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-600">Restitution des clés</span>
                  <span className="text-xs font-black text-emerald-700">
                    ✔ Confirmée
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-600">État des lieux</span>
                  <span className="text-xs font-black text-emerald-700">
                    ✔ Validé
                  </span>
                </div>
              </div>
            </div>

            {/* Sceau Cryptographique SHA-256 */}
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-300 font-mono text-[11px] flex flex-col gap-2">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <span>Empreinte d'intégrité SHA-256</span>
                <span className="text-emerald-400">Scellé & Inaltérable</span>
              </div>
              <div className="break-all font-bold text-white text-xs">
                {proofData.sha256Hash}
              </div>
              <span className="text-[10px] text-slate-500">
                Token sécurisé : {proofData.token}
              </span>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-500 text-center leading-relaxed">
              <strong>LocaTrust — Registre Public de Vérification Sécurisée</strong><br />
              Ce service confirme l'authenticité et l'intégrité du dossier de preuve sans exposer les données privées sensibles (numéros complets, emails, pièces d'identité ou coordonnées bancaires).
            </div>

          </div>
        </main>
      </div>
    );
  }

  // Si c'est un CONTRAT DE BAIL
  if (contractData && (type === 'contrat' || !receiptData)) {
    const isAvenant = currentStatus === 'modifie_avenant';
    const isRevoked = currentStatus === 'revoque_annule';
    const isPendingSignature = currentStatus === 'en_attente_signature';
    const isExpired = currentStatus === 'expire';
    const isValid = currentStatus === 'valide';

    const statusBadgeText = isPendingSignature
      ? 'DOCUMENT AUTHENTIQUE MAIS EN ATTENTE DE SIGNATURE'
      : isExpired
      ? 'DOCUMENT AUTHENTIQUE MAIS EXPIRÉ'
      : isRevoked
      ? 'DOCUMENT AUTHENTIQUE MAIS RÉVOQUÉ/REMPLACÉ'
      : isAvenant
      ? 'DOCUMENT AUTHENTIQUE — AVENANT ENREGISTRÉ'
      : 'DOCUMENT AUTHENTIQUE ET VALIDE';

    const statusBadgeColor = isPendingSignature
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : isExpired
      ? 'bg-slate-100 text-slate-800 border-slate-300'
      : isRevoked
      ? 'bg-rose-100 text-rose-900 border-rose-300'
      : isAvenant
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-emerald-100 text-emerald-900 border-emerald-300';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-slate-500 font-medium">Contrôle de Conformité Publique</span>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Registre Certifié CI
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6 w-full animate-fadeIn">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          )}

          {/* Statut Banner */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
                  isValid ? 'bg-emerald-100 text-emerald-600' :
                  isPendingSignature ? 'bg-amber-100 text-amber-700' :
                  isAvenant ? 'bg-amber-100 text-amber-700' :
                  isExpired ? 'bg-slate-100 text-slate-600' :
                  'bg-rose-100 text-rose-600'
                }`}>
                  {isValid && <ShieldCheck className="w-8 h-8" />}
                  {isPendingSignature && <Clock className="w-8 h-8" />}
                  {isAvenant && <AlertTriangle className="w-8 h-8" />}
                  {isExpired && <AlertTriangle className="w-8 h-8" />}
                  {isRevoked && <XCircle className="w-8 h-8" />}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                      ✓ DOCUMENT LOCATRUST AUTHENTIQUE
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusBadgeColor}`}>
                      {statusBadgeText}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                    Contrat de Bail N° {contractData.contractNumber}
                  </h1>
                  <span className="text-xs text-slate-500 font-medium">
                    Type : <strong>Contrat de Bail d'Habitation / Professionnel Certifié</strong> • Version : <strong>v{contractData.currentVersion}</strong> (sur {contractData.totalVersions})
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:items-end text-xs text-slate-500 shrink-0 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span>Date d'émission : <strong className="text-slate-800">{contractData.createdAt}</strong></span>
                <span>Horodatage signature : <strong className="text-slate-800">{contractData.signedAt}</strong></span>
                <span className="text-[10px] text-emerald-700 font-bold mt-1">✓ Vérifié le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Avenant Notice */}
            {isAvenant && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black text-amber-900">Avenant ultérieur actif détecté</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Ce contrat possède une ou plusieurs modifications enregistrées après sa signature originale.
                  </p>
                </div>
              </div>
            )}

            {/* Pending Signature Notice */}
            {isPendingSignature && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black text-amber-900">Document authentique en cours de recueil des signatures</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Ce contrat a été initié et validé par LocaTrust mais reste en attente de la signature manuscrite d'une des parties.
                  </p>
                </div>
              </div>
            )}

            {/* Revoked Notice */}
            {isRevoked && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs">
                <XCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black text-rose-900">Document Caduc / Révocation Enregistrée</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Ce contrat de location a été résilié ou annulé conformément aux articles du bail et au Code de la Construction.
                  </p>
                </div>
              </div>
            )}

            {/* Onglets de consultation */}
            <div className="flex items-center gap-2 border-b">
              <button
                onClick={() => setSelectedTab('details')}
                className={`pb-3 text-xs font-extrabold transition-all border-b-2 ${
                  selectedTab === 'details'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Informations Clés
              </button>
              <button
                onClick={() => setSelectedTab('history')}
                className={`pb-3 text-xs font-extrabold transition-all border-b-2 ${
                  selectedTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Historique des Versions ({contractData.history?.length || 1})
              </button>
              {(contractData.relatedReceipts?.length || 0) > 0 && (
                <button
                  onClick={() => setSelectedTab('receipts')}
                  className={`pb-3 text-xs font-extrabold transition-all border-b-2 ${
                    selectedTab === 'receipts'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Quittances Associées ({contractData.relatedReceipts?.length})
                </button>
              )}
            </div>

            {/* TAB CONTENT: DETAILS */}
            {selectedTab === 'details' && (
              <div className="flex flex-col gap-6 text-xs">
                {/* Identification des Parties (Noms protégés, aucune donnée privée exposée) */}
                <div className="flex flex-col gap-3">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    Parties Contractantes (Identité certifiée LocaTrust)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Bailleur (Émetteur)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Vérifié
                        </span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{contractData.parties.ownerName}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Signature bailleur : <strong>{contractData.parties.isOwnerSigned ? 'Apposée & Vérifiée' : 'En attente'}</strong></span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Locataire (Preneur)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Vérifié
                        </span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{contractData.parties.tenantName}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Signature locataire : <strong>{contractData.parties.isTenantSigned ? 'Apposée & Vérifiée' : 'En attente'}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bien immobilier */}
                <div className="flex flex-col gap-3">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    Bien Immobilier Objet du Bail
                  </span>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Type</span>
                      <span className="font-black text-slate-900">{contractData.property.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Localisation</span>
                      <span className="font-bold text-slate-800">{contractData.property.location}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Référence du bien</span>
                      <span className="font-bold text-blue-600 font-mono">{contractData.property.propertyRef}</span>
                    </div>
                  </div>
                </div>

                {/* Conditions financières certifiées */}
                <div className="flex flex-col gap-3">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    Conditions Financières Enregistrées
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-amber-900">Loyer Mensuel</span>
                      <span className="text-base font-black text-amber-800">
                        {formatFCFA(contractData.financials.rentAmount)}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-amber-900">Caution (Dépôt de garantie)</span>
                      <span className="text-base font-black text-amber-800">
                        {formatFCFA(contractData.financials.cautionAmount)}
                      </span>
                    </div>
                  </div>
                </div>


              </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {selectedTab === 'history' && (
              <div className="flex flex-col gap-4 text-xs">
                <span className="text-slate-500 text-[11px]">
                  Toutes les révisions et avenants sont horodatés et scellés sans altération du bail original.
                </span>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden">
                  {(contractData.history || []).map((h, idx) => (
                    <div key={idx} className="p-4 flex items-start gap-4">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                        v{h.version}
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900">{h.title}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{h.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{h.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: RECEIPTS */}
            {selectedTab === 'receipts' && (
              <div className="flex flex-col gap-4 text-xs">
                <span className="text-slate-500 text-[11px]">
                  Quittances de loyer émises et rattachées directement à ce bail :
                </span>

                <div className="flex flex-col gap-3">
                  {(contractData.relatedReceipts || []).map((rToken) => {
                    const r = MOCK_VERIFICATION_REGISTRY.receipts[rToken];
                    if (!r) return null;
                    return (
                      <div
                        key={rToken}
                        className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <Receipt className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">Quittance N° {r.receiptNumber}</span>
                            <span className="text-[11px] text-slate-500">
                              Loyer : <strong>{r.periodCovered}</strong> — Montant : {formatFCFA(r.amountPaid)}
                            </span>
                          </div>
                        </div>

                        {onNavigateToDocument && (
                          <button
                            onClick={() => onNavigateToDocument('recu', rToken)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <span>Vérifier reçu</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-500 text-center leading-relaxed">
              <strong>LocaTrust — Service Public de Contrôle & Conformité</strong><br />
              Ce service confirme l'authenticité juridique du document sans divulguer les données d'identité complètes, comptes bancaires ou coordonnées privées des parties.
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Si c'est un REÇU (QUITTANCE DE LOYER / REÇU DE CAUTION / RESTITUTION)
  if (receiptData && (type === 'recu' || !contractData)) {
    const isCaution = receiptData.subType === 'caution' || receiptData.receiptNumber?.startsWith('CAUT') || receiptData.periodCovered?.toLowerCase().includes('garantie') || receiptData.periodCovered?.toLowerCase().includes('caution');
    const isRestitution = receiptData.subType === 'restitution' || receiptData.receiptNumber?.startsWith('REST') || receiptData.periodCovered?.toLowerCase().includes('restitution');
    
    const docTitle = isCaution
      ? 'Reçu Officiel de Caution (Dépôt de Garantie)'
      : isRestitution
      ? 'Reçu Officiel de Restitution de Caution'
      : `Quittance Officielle N° ${receiptData.receiptNumber}`;

    const docTypeLabel = isCaution
      ? 'Reçu de Caution (Dépôt de Garantie)'
      : isRestitution
      ? 'Reçu de Restitution de Caution'
      : 'Quittance Libératoire de Loyer';

    const isValid = currentStatus === 'valide';
    const isPending = currentStatus === 'en_attente_signature';
    const isRevoked = currentStatus === 'revoque_annule';
    const isExpired = currentStatus === 'expire';

    const statusBadgeText = isPending
      ? 'DOCUMENT AUTHENTIQUE MAIS EN ATTENTE DE SIGNATURE'
      : isExpired
      ? 'DOCUMENT AUTHENTIQUE MAIS EXPIRÉ'
      : isRevoked
      ? 'DOCUMENT AUTHENTIQUE MAIS RÉVOQUÉ/REMPLACÉ'
      : 'DOCUMENT AUTHENTIQUE ET VALIDE';

    const statusBadgeColor = isPending
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : isExpired
      ? 'bg-slate-100 text-slate-800 border-slate-300'
      : isRevoked
      ? 'bg-rose-100 text-rose-900 border-rose-300'
      : 'bg-emerald-100 text-emerald-900 border-emerald-300';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              {docTypeLabel}
            </span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6 w-full animate-fadeIn">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          )}

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
                  isValid ? 'bg-emerald-100 text-emerald-600' :
                  isPending ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-600'
                }`}>
                  <Receipt className="w-8 h-8" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                      ✓ DOCUMENT LOCATRUST AUTHENTIQUE
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusBadgeColor}`}>
                      {statusBadgeText}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                    {docTitle}
                  </h1>
                  <span className="text-xs text-slate-500 font-medium">
                    Type : <strong>{docTypeLabel}</strong> • Rattaché au bail N° <strong>{receiptData.contractNumber}</strong>
                  </span>
                </div>
              </div>

              {receiptData.contractToken && onNavigateToDocument && (
                <button
                  onClick={() => onNavigateToDocument('contrat', receiptData.contractToken)}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-center shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Voir le Contrat Lié</span>
                </button>
              )}
            </div>

            {/* Détails du paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Période ou Nature</span>
                <span className="text-base font-black text-slate-900">{receiptData.periodCovered}</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Montant Encaissé & Certifié</span>
                <span className="text-base font-black text-emerald-800">{formatFCFA(receiptData.amountPaid)}</span>
              </div>
            </div>

            {/* Informations de transaction & horodatage */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs">
              <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                Traçabilité & Vérification Officielle
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Date d'émission :</span>
                  <span className="font-bold">{receiptData.paymentDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Mode de règlement :</span>
                  <span className="font-bold">{receiptData.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Référence de transaction :</span>
                  <span className="font-mono font-bold text-blue-600">{receiptData.transactionReference}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Horodatage vérification :</span>
                  <span className="font-bold text-slate-900">{new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            {/* Parties & Bien (Anonymisation des données privées) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">Parties Vérifiées</span>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Bailleur (Émetteur)</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-black text-slate-900">{receiptData.parties.ownerName}</span>
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Preneur (Locataire)</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-black text-slate-900">{receiptData.parties.tenantName}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">Bien Immobilier</span>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Désignation</span>
                  <div className="font-black text-slate-900">{receiptData.property.type}</div>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Localisation</span>
                  <div className="text-slate-600 font-medium">{receiptData.property.location}</div>
                </div>
              </div>
            </div>



            <div className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-500 text-center leading-relaxed">
              <strong>LocaTrust — Sécurisation Juridique & Traçabilité des Règlements</strong><br />
              Ce document est conforme à la Loi n° 2019-576. Toute falsification expose l'auteur à des poursuites pénales.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
};
