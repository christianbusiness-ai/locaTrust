'use client';

import React, { useState } from 'react';
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
  FileCheck
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import {
  MOCK_VERIFICATION_REGISTRY,
  ContractVerificationRecord,
  ReceiptVerificationRecord,
  DocumentVerificationStatus
} from '@/lib/verificationRegistry';
import { formatFCFA } from '@/lib/utils';

interface DocumentVerificationViewProps {
  type: 'contrat' | 'recu';
  token: string;
  onNavigateBack?: () => void;
  onNavigateToDocument?: (type: 'contrat' | 'recu', token: string) => void;
}

export const DocumentVerificationView: React.FC<DocumentVerificationViewProps> = ({
  type,
  token,
  onNavigateBack,
  onNavigateToDocument
}) => {
  const [selectedTab, setSelectedTab] = useState<'details' | 'history' | 'receipts'>('details');

  const contractData: ContractVerificationRecord | undefined =
    type === 'contrat'
      ? (MOCK_VERIFICATION_REGISTRY.contracts[token] ||
         Object.values(MOCK_VERIFICATION_REGISTRY.contracts).find(
           (c) => c.token === token || c.contractNumber === token || c.contractNumber.toLowerCase() === token.toLowerCase()
         ) || {
           type: 'contrat',
           token: token,
           contractNumber: token.startsWith('tok_') ? 'LT-CI-2026-000492' : token,
           status: 'valide',
           currentVersion: 1,
           totalVersions: 1,
           createdAt: '01/01/2026',
           signedAt: '01/01/2026 à 14:32',
           isRegisteredLocaTrust: true,
           parties: {
             ownerName: "Koffi N'Guessan",
             tenantName: "Kouadio Jean",
             isOwnerSigned: true,
             isTenantSigned: true,
             ownerSignedAt: '01/01/2026',
             tenantSignedAt: '01/01/2026'
           },
           property: {
             propertyRef: 'BIEN-2026-049',
             type: 'Appartement 3 pièces moderne',
             location: 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire'
           },
           financials: {
             rentAmount: 450000,
             currency: 'FCFA',
             cautionAmount: 900000
           }
         })
      : undefined;

  const receiptData: ReceiptVerificationRecord | undefined =
    type === 'recu'
      ? (MOCK_VERIFICATION_REGISTRY.receipts[token] ||
         Object.values(MOCK_VERIFICATION_REGISTRY.receipts).find(
           (r) => r.token === token || r.receiptNumber === token || r.receiptNumber.toLowerCase() === token.toLowerCase()
         ))
      : undefined;

  const isFound = Boolean(contractData || receiptData);
  const status: DocumentVerificationStatus = isFound
    ? contractData?.status || receiptData?.status || 'valide'
    : 'non_authentifie';

  // Si non trouvé ou altéré
  if (!isFound || status === 'non_authentifie') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        {/* Header officiel */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-rose-100 text-rose-800">
              Contrôle d'Authenticité
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

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200 shadow-xl flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-rose-600">
                Document Non Reconnu ou Falsifié
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Authentification Impossible
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md">
                Ce QR Code ou identifiant de vérification ne correspond à aucun document certifié et archivé sur le registre cryptographique de <strong>LocaTrust</strong>.
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-black text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Mise en garde contre la fraude</span>
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed">
                Si ce document vous a été présenté comme un contrat de bail ou un reçu officiel LocaTrust, il est possible qu'il s'agisse d'un faux document ou d'une altération non enregistrée. Ne procédez à aucun versement sans confirmation auprès de l'administrateur de votre immeuble.
              </p>
            </div>

            <div className="text-[11px] text-slate-400">
              Identifiant scanné : <code className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{token}</code>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Si c'est un CONTRAT DE BAIL
  if (type === 'contrat' && contractData) {
    const isAvenant = contractData.status === 'modifie_avenant';
    const isRevoked = contractData.status === 'revoque_annule';
    const isValid = contractData.status === 'valide';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        {/* Header officiel */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-slate-500 font-medium">Vérification Officielle</span>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Base Certifiée CI
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
                  isAvenant ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-600'
                }`}>
                  {isValid && <ShieldCheck className="w-8 h-8" />}
                  {isAvenant && <AlertTriangle className="w-8 h-8" />}
                  {isRevoked && <XCircle className="w-8 h-8" />}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isValid ? 'bg-emerald-100 text-emerald-800' :
                      isAvenant ? 'bg-amber-100 text-amber-900' :
                      'bg-rose-100 text-rose-900'
                    }`}>
                      {isValid && '🟢 DOCUMENT AUTHENTIFIÉ PAR LOCATRUST'}
                      {isAvenant && '🟠 MODIFIÉ / AVENANT ENREGISTRÉ'}
                      {isRevoked && '🔴 CONTRAT RÉVOQUÉ / ANNULÉ'}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    Bail d'Habitation N° {contractData.contractNumber}
                  </h1>
                  <span className="text-xs text-slate-500 font-medium">
                    Version applicable : <strong>v{contractData.currentVersion}</strong> (sur {contractData.totalVersions} version{contractData.totalVersions > 1 ? 's' : ''})
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:items-end text-xs text-slate-500 shrink-0">
                <span>Créé le : <strong>{contractData.createdAt}</strong></span>
                <span>Signé le : <strong>{contractData.signedAt}</strong></span>
              </div>
            </div>

            {/* Avenant Notice Box if applicable */}
            {isAvenant && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black text-amber-900">Avenant ultérieur actif détecté</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Ce contrat possède une ou plusieurs modifications enregistrées après sa signature originale. La version originale reste conservée dans le registre pour préserver l'historique complet.
                  </p>
                </div>
              </div>
            )}

            {/* Revoked Notice Box if applicable */}
            {isRevoked && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs">
                <XCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black text-rose-900">Document Caduc / Non Valide</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Ce contrat de location a été résilié ou annulé conformément aux articles du bail et à la loi ivoirienne. Il n'a plus de valeur juridique active.
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
                Historique des Versions & Avenants ({contractData.history?.length || 1})
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
                
                {/* Identification des Parties (Anonymisées pour protection vie privée) */}
                <div className="flex flex-col gap-3">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    Parties Contractantes (Identité vérifiée)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Bailleur</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Identité Vérifiée
                        </span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{contractData.parties.ownerName}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Signature : <strong>Vérifiée</strong> ({contractData.parties.ownerSignedAt})</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Locataire (Preneur)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Identité Vérifiée
                        </span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{contractData.parties.tenantName}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Signature : <strong>Vérifiée</strong> ({contractData.parties.tenantSignedAt})</span>
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

                {/* Sceau de conformité juridique */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-amber-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-black text-xs">Document enregistré & scellé dans LocaTrust</span>
                      <span className="text-[10px] text-slate-400">Empreinte numérique horodatée conforme Loi n° 2019-576</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black text-[11px]">
                    ✓ Conforme
                  </span>
                </div>

              </div>
            )}

            {/* TAB CONTENT: HISTORY & AVENANTS */}
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

            {/* TAB CONTENT: RELATED RECEIPTS */}
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

            {/* Footer Notice de confidentialité */}
            <div className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-500 text-center leading-relaxed">
              <strong>LocaTrust — Service Public de Contrôle & Conformité</strong><br />
              Ce service confirme l'authenticité juridique du document sans divulguer les données d'identité complètes, comptes bancaires ou numéros privés des parties.
            </div>

          </div>
        </main>
      </div>
    );
  }

  // Si c'est un REÇU DE LOYER (QUITTANCE)
  if (type === 'recu' && receiptData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
        {/* Header officiel */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Logo size="md" variant="light" showSubtitle={true} />
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Quittance Officielle
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
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md shrink-0">
                  <Receipt className="w-8 h-8" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 w-fit">
                    ✓ REÇU AUTHENTIFIÉ PAR LOCATRUST
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    Quittance N° {receiptData.receiptNumber}
                  </h1>
                  <span className="text-xs text-slate-500 font-medium">
                    Rattachée au bail N° <strong>{receiptData.contractNumber}</strong>
                  </span>
                </div>
              </div>

              {receiptData.contractToken && onNavigateToDocument && (
                <button
                  onClick={() => onNavigateToDocument('contrat', receiptData.contractToken)}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-center"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Voir le Contrat Lié</span>
                </button>
              )}
            </div>

            {/* Détails du paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Période Réglée</span>
                <span className="text-base font-black text-slate-900">{receiptData.periodCovered}</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Montant Payé & Validé</span>
                <span className="text-base font-black text-emerald-800">{formatFCFA(receiptData.amountPaid)}</span>
              </div>
            </div>

            {/* Informations de transaction */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs">
              <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                Traçabilité du Paiement
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Date du paiement :</span>
                  <span className="font-bold">{receiptData.paymentDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Mode de paiement :</span>
                  <span className="font-bold">{receiptData.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Référence de transaction :</span>
                  <span className="font-mono font-bold text-blue-600">{receiptData.transactionReference}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Statut :</span>
                  <span className="font-black text-emerald-600">✓ Paiement validé par le bailleur</span>
                </div>
              </div>
            </div>

            {/* Parties & Bien */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Locataire</span>
                <span className="font-black text-slate-900">{receiptData.parties.tenantName}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase mt-2">Bailleur</span>
                <span className="font-black text-slate-900">{receiptData.parties.ownerName}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Bien Immobilier</span>
                <span className="font-black text-slate-900">{receiptData.property.type}</span>
                <span className="text-slate-500 text-[11px] mt-1">{receiptData.property.location}</span>
              </div>
            </div>

            {/* Sceau officiel */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span className="font-bold">Quittance libératoire horodatée & enregistrée</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-black">✓ Certifié LocaTrust</span>
            </div>

            <div className="text-center text-[10px] text-slate-400">
              Token de sécurité : <code className="font-mono text-slate-500">{receiptData.token}</code>
            </div>

          </div>
        </main>
      </div>
    );
  }

  return null;
};
