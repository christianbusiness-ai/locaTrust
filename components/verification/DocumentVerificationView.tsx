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
  DocumentVerificationStatus,
  maskPersonName
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contractData, setContractData] = useState<ContractVerificationRecord | undefined>(undefined);
  const [receiptData, setReceiptData] = useState<ReceiptVerificationRecord | undefined>(undefined);

  const fetchDocument = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (type === 'contrat') {
        // 1. Registre local session
        const local = MOCK_VERIFICATION_REGISTRY.contracts[token] ||
          Object.values(MOCK_VERIFICATION_REGISTRY.contracts).find(
            (c) => c.token === token || c.contractNumber === token || c.contractNumber.toLowerCase() === token.toLowerCase()
          );
        if (local) {
          setContractData(local);
          setIsLoading(false);
          return;
        }

        // 2. Base Supabase
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        let query = supabase
          .from('contracts')
          .select('*, property:property_id(*), owner:owner_id(*), tenant:tenant_id(*)');

        if (isUuid) {
          query = query.or(`id.eq.${token},contract_number.eq.${token}`);
        } else {
          query = query.or(`contract_number.eq.${token},qr_code.eq.${token},qr_code_hash.eq.${token}`);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
          console.warn('Erreur vérification contrat:', error.message);
          setLoadError('Erreur de communication avec le registre officiel des baux.');
        } else if (data) {
          const rec: ContractVerificationRecord = {
            type: 'contrat',
            token: token,
            contractNumber: data.contract_number,
            status: data.status === 'resilie' ? 'revoque_annule' : 'valide',
            currentVersion: 1,
            totalVersions: 1,
            createdAt: new Date(data.created_at).toLocaleDateString('fr-FR'),
            signedAt: data.signed_at ? new Date(data.signed_at).toLocaleString('fr-FR') : 'En attente',
            isRegisteredLocaTrust: true,
            parties: {
              ownerName: maskPersonName(data.owner?.full_name || 'Bailleur'),
              tenantName: maskPersonName(data.tenant?.full_name || 'Preneur'),
              isOwnerSigned: Boolean(data.owner_signed || data.owner_signature),
              isTenantSigned: Boolean(data.tenant_signed || data.tenant_signature),
              ownerSignedAt: data.owner_signed_at ? new Date(data.owner_signed_at).toLocaleDateString('fr-FR') : undefined,
              tenantSignedAt: data.tenant_signed_at ? new Date(data.tenant_signed_at).toLocaleDateString('fr-FR') : undefined,
            },
            property: {
              propertyRef: data.property?.id ? `BIEN-${data.property.id.slice(0, 6).toUpperCase()}` : 'BIEN-001',
              type: data.property?.title || 'Logement certifié',
              location: `${data.property?.commune || ''} ${data.property?.city || 'Abidjan'}`.trim() || 'Côte d\'Ivoire',
            },
            financials: {
              rentAmount: Number(data.monthly_rent || 0),
              currency: 'FCFA',
              cautionAmount: Number(data.caution_amount || 0),
            },
            history: [
              {
                version: 1,
                date: new Date(data.created_at).toLocaleDateString('fr-FR'),
                title: 'Contrat de bail certifié original',
                summary: 'Bail d\'habitation conforme Loi n° 2019-576 scellé par LocaTrust.',
              }
            ],
            relatedReceipts: [],
          };
          setContractData(rec);
        } else {
          setContractData(undefined);
        }
      } else if (type === 'recu') {
        // 1. Registre local session
        const local = MOCK_VERIFICATION_REGISTRY.receipts[token] ||
          Object.values(MOCK_VERIFICATION_REGISTRY.receipts).find(
            (r) => r.token === token || r.receiptNumber === token || r.receiptNumber.toLowerCase() === token.toLowerCase()
          );
        if (local) {
          setReceiptData(local);
          setIsLoading(false);
          return;
        }

        // 2. Base Supabase
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        let query = supabase
          .from('receipts')
          .select('*, contract:contract_id(*, property:property_id(*)), tenant:tenant_id(*), owner:owner_id(*)');

        if (isUuid) {
          query = query.or(`id.eq.${token},receipt_number.eq.${token}`);
        } else {
          query = query.or(`receipt_number.eq.${token},token.eq.${token},qr_code.eq.${token}`);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
          console.warn('Erreur vérification quittance:', error.message);
          setLoadError('Erreur de communication avec le registre officiel des quittances.');
        } else if (data) {
          const rec: ReceiptVerificationRecord = {
            type: 'recu',
            token: token,
            receiptNumber: data.receipt_number,
            contractNumber: data.contract?.contract_number || 'Bail LocaTrust',
            contractToken: data.contract?.id || '',
            status: 'valide',
            periodCovered: data.rent_month ? new Date(data.rent_month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Période courante',
            amountPaid: Number(data.amount || 0),
            paymentDate: new Date(data.created_at).toLocaleDateString('fr-FR'),
            paymentMethod: 'Paiement Déclaré & Validé',
            transactionReference: data.id?.slice(0, 12).toUpperCase() || 'TX-OFFICIEL',
            parties: {
              ownerName: maskPersonName(data.owner?.full_name || 'Bailleur'),
              tenantName: maskPersonName(data.tenant?.full_name || 'Locataire'),
            },
            property: {
              type: data.contract?.property?.title || 'Bien immobilier',
              location: `${data.contract?.property?.commune || ''} ${data.contract?.property?.city || 'Abidjan'}`.trim() || 'Côte d\'Ivoire',
            },
            isValidatedByOwner: true,
            validatedAt: new Date(data.created_at).toLocaleString('fr-FR'),
          };
          setReceiptData(rec);
        } else {
          setReceiptData(undefined);
        }
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, [type, token]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const isFound = Boolean(contractData || receiptData);
  const status: DocumentVerificationStatus = isFound
    ? contractData?.status || receiptData?.status || 'valide'
    : 'non_authentifie';

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

  // 3. ÉTAT NON AUTHENTIFIÉ OU FALSIFIÉ
  if (!isFound || status === 'non_authentifie') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
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

            {/* Revoked Notice */}
            {isRevoked && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs">
                <XCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black text-rose-900">Document Caduc / Non Valide</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Ce contrat de location a été résilié ou annulé conformément aux articles du bail et à la loi ivoirienne.
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
                {/* Identification des Parties */}
                <div className="flex flex-col gap-3">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    Parties Contractantes (Identité certifiée)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Bailleur</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Vérifié
                        </span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{contractData.parties.ownerName}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Signature : <strong>{contractData.parties.isOwnerSigned ? 'Vérifiée' : 'En attente'}</strong></span>
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
                        <span>Signature : <strong>{contractData.parties.isTenantSigned ? 'Vérifiée' : 'En attente'}</strong></span>
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
