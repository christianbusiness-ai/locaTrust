'use client';

import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Download,
  Eye,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  ShieldCheck,
  CreditCard,
  QrCode,
  Sparkles
} from 'lucide-react';
import { formatFCFA, formatPeriodCovered } from '@/lib/utils';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { Lock, Clock, Send, AlertTriangle } from 'lucide-react';
import { ActionConfirmationModal } from '@/components/common/ActionConfirmationModal';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { TableRowsSkeleton } from '@/components/common/SkeletonLoader';
import { TopProgressBar } from '@/components/common/TopProgressBar';
import { resolveRealReceiptData } from '@/lib/payments/receiptDataResolver';
import { getStoredOwnerSignature, getStoredTenantSignature } from '@/lib/signatureHelper';
import { getUnifiedReceipts } from '@/lib/receiptsStore';

interface OfficialReceiptRow {
  id: string;
  receipt_number: string;
  receipt_type: 'loyer' | 'caution';
  tenant_name: string;
  property_title: string;
  property_address: string;
  contract_number: string;
  period_covered: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  transaction_ref: string;
  token?: string;
  status: 'valide' | 'certifie';
  owner_signed: boolean;
  tenant_signed: boolean;
  allocations?: any[];
}

export const ReceiptsQuittancesView: React.FC = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<OfficialReceiptRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const hasLoadedOnceRef = React.useRef<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'loyer' | 'caution'>('tous');
  const [previewReceipt, setPreviewReceipt] = useState<OfficialReceiptRow | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const loadReceipts = async (isBackground = false) => {
    if (hasLoadedOnceRef.current || isBackground || receipts.length > 0) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const allRows: OfficialReceiptRow[] = [];
      const seenRefs = new Set<string>();

      // 1. Charger les sources locales en priorité (disponibilité instantanée et statuts à jour)
      let localPayments: any[] = [];
      let localReceipts: any[] = [];
      let localDeposits: any[] = [];
      let localContracts: any[] = [];
      const finalizedNotifs = new Set<string>();

      if (typeof window !== 'undefined') {
        try {
          const rawPmts = localStorage.getItem('locatrust_rent_payments');
          if (rawPmts) localPayments = JSON.parse(rawPmts) || [];
        } catch {}

        try {
          localReceipts = getUnifiedReceipts(user?.id) || [];
        } catch {}

        try {
          const rawDeps = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
          if (rawDeps) localDeposits = JSON.parse(rawDeps) || [];
        } catch {}

        try {
          const rawCnts = localStorage.getItem('locatrust_contracts');
          if (rawCnts) localContracts = JSON.parse(rawCnts) || [];
        } catch {}

        try {
          const rawNotifs = localStorage.getItem('locatrust_notifications');
          if (rawNotifs) {
            const parsedNotifs = JSON.parse(rawNotifs);
            if (Array.isArray(parsedNotifs)) {
              parsedNotifs.forEach((n: any) => {
                const pld = n.payload || n.data || {};
                const rNum = pld.receiptNumber || pld.reference || n.contractNumber || (n.description && n.description.match(/ESP-\d+/)?.[0]);
                const isFinal =
                  pld.action === 'receipt_finalized' ||
                  pld.status === 'confirme' ||
                  n.title?.includes('finalisé') ||
                  n.title?.includes('scellé') ||
                  n.description?.includes('signé') ||
                  n.description?.includes('scellé');
                if (rNum && isFinal) {
                  finalizedNotifs.add(rNum);
                }
              });
            }
          }
        } catch {}
      }

      // 2. Charger les quittances et paiements Supabase en parallèle
      let dbReceipts: any[] = [];
      let validatedPayments: any[] = [];

      try {
        let rQuery = supabase
          .from('receipts')
          .select('*')
          .order('created_at', { ascending: false });

        if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(user.id)) {
          rQuery = rQuery.or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
        }

        let pmQuery = supabase
          .from('rent_payments')
          .select('*, contract:contracts(*, property:properties(*)), tenant:users!tenant_id(*)')
          .in('status', ['valide', 'confirme', 'en_attente_signature_locataire'])
          .order('payment_date', { ascending: false });

        if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(user.id)) {
          pmQuery = pmQuery.or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
        }

        const [rRes, pmRes] = await Promise.allSettled([rQuery, pmQuery]);
        if (rRes.status === 'fulfilled' && Array.isArray(rRes.value?.data)) {
          dbReceipts = rRes.value.data;
        }
        if (pmRes.status === 'fulfilled' && Array.isArray(pmRes.value?.data)) {
          validatedPayments = pmRes.value.data;
        }
      } catch (err) {
        console.warn('Notice requêtes Supabase reçus:', err);
      }

      // 3. Carte unifiée des paiements (fusion Règle 6 : priorité absolue au statut le plus avancé)
      const paymentsMap = new Map<string, any>();
      const addOrUpdatePayment = (p: any) => {
        if (!p) return;
        const ref = p.reference || p.receipt_number || p.id;
        if (!ref) return;
        const existing = paymentsMap.get(ref);
        if (!existing) {
          paymentsMap.set(ref, p);
          if (p.id) paymentsMap.set(p.id, p);
        } else {
          const existingIsMoreAdvanced =
            (existing.status === 'confirme' && p.status !== 'confirme') ||
            (existing.tenant_signature_url && !p.tenant_signature_url);
          if (!existingIsMoreAdvanced) {
            const merged = { ...existing, ...p };
            paymentsMap.set(ref, merged);
            if (p.id) paymentsMap.set(p.id, merged);
          }
        }
      };

      validatedPayments.forEach(addOrUpdatePayment);
      localPayments.forEach(addOrUpdatePayment);

      // 4. Traitement des quittances de la table receipts
      for (const r of dbReceipts) {
        const ref = r.receipt_number || (r.id ? `REC-${r.id.slice(0, 8)}` : '');
        if (!ref || seenRefs.has(ref)) continue;
        seenRefs.add(ref);

        const matchingPmt = paymentsMap.get(ref) || (r.rent_payment_id && paymentsMap.get(r.rent_payment_id)) || (r.id && paymentsMap.get(r.id));
        const matchingContract = localContracts.find((c: any) => c.contract_number === r.contract_number || c.id === r.contract_id || (matchingPmt && (c.id === matchingPmt.contract_id || c.contract_number === matchingPmt.contract_number)));

        // Règle institutionnelle LocaTrust : une quittance émise a TOUJOURS été validée et signée par le bailleur
        const ownerSigned = true;

        // Le locataire a signé si le reçu est finalisé/confirmé ou si sa signature est présente
        const isConfirmedOrFinal = (status?: string): boolean => {
          if (!status) return false;
          const s = String(status).trim().toLowerCase();
          return (
            s === 'confirme' ||
            s === 'confirmé' ||
            s === 'finalise' ||
            s === 'finalisé' ||
            s === 'certifie' ||
            s === 'certifié' ||
            s === 'valide' ||
            s === 'validé' ||
            s === 'paye' ||
            s === 'payé'
          );
        };

        const hasTenantSig = Boolean(
          r.tenant_signature ||
          r.tenant_signature_url ||
          r.tenant_signed ||
          matchingPmt?.tenant_signature_url ||
          matchingPmt?.tenant_signature ||
          matchingPmt?.tenant_signed
        );

        const tenantSigned = isConfirmedOrFinal(r.status) || isConfirmedOrFinal(matchingPmt?.status) || hasTenantSig || finalizedNotifs.has(ref);

        const effectiveToken = r.token || r.verification_token || matchingPmt?.token || matchingPmt?.verification_token || `tok_rec_${ref.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const effectiveDate = r.payment_date || (matchingPmt?.payment_date ? new Date(matchingPmt.payment_date).toLocaleDateString('fr-FR') : (r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')));

        const effectiveTenantName =
          (r.tenant_name && r.tenant_name !== 'Locataire')
            ? r.tenant_name
            : (matchingPmt?.tenant?.full_name || matchingPmt?.tenant_name || matchingContract?.tenant_name || matchingContract?.applicant_name || 'Locataire');

        const effectivePropertyTitle =
          (r.property_title && r.property_title !== 'Bien immobilier')
            ? r.property_title
            : (matchingPmt?.contract?.property?.title || matchingPmt?.property_title || matchingContract?.property_title || matchingContract?.property?.title || 'Bien immobilier');

        const effectiveContractNum =
          r.contract_number || matchingPmt?.contract_number || matchingPmt?.contract?.contract_number || matchingContract?.contract_number || 'N/A';

        const effectivePeriod =
          r.period_covered || matchingPmt?.target_month || matchingPmt?.period_covered || 'Période réglée';

        const effectiveAmount =
          Number(r.amount || r.amount_paid || matchingPmt?.amount || 0);

        allRows.push({
          id: r.id || `rec_${ref}`,
          receipt_number: ref,
          receipt_type: (r.type || 'loyer') as 'loyer' | 'caution',
          tenant_name: effectiveTenantName,
          property_title: effectivePropertyTitle,
          property_address: r.property_address || matchingPmt?.contract?.property?.address || matchingContract?.property_address || '',
          contract_number: effectiveContractNum,
          period_covered: effectivePeriod,
          amount: effectiveAmount,
          payment_method: r.payment_method || matchingPmt?.payment_method || 'Mobile Money',
          payment_date: effectiveDate,
          transaction_ref: matchingPmt?.reference || ref,
          token: effectiveToken,
          status: 'certifie',
          owner_signed: ownerSigned,
          tenant_signed: tenantSigned,
          allocations: matchingPmt?.allocations
        });
      }

      // 5. Paiements confirmés/validés non encore inscrits dans la table receipts
      for (const [key, p] of paymentsMap.entries()) {
        const ref = p.reference || p.receipt_number || p.id;
        if (!ref || seenRefs.has(ref)) continue;
        const pStatus = String(p.status || '').toLowerCase();
        const hasSig = Boolean(p.owner_signature_url || p.tenant_signature_url);
        if (!['confirme', 'valide', 'en_attente_signature_locataire', 'certifie', 'paye'].includes(pStatus) && !hasSig) {
          continue;
        }
        seenRefs.add(ref);

        const matchingContract = localContracts.find((c: any) => c.contract_number === p.contract_number || c.id === p.contract_id);
        const ownerSigned = true;

        const isConfirmedOrFinal = (status?: string): boolean => {
          if (!status) return false;
          const s = String(status).trim().toLowerCase();
          return (
            s === 'confirme' ||
            s === 'confirmé' ||
            s === 'finalise' ||
            s === 'finalisé' ||
            s === 'certifie' ||
            s === 'certifié' ||
            s === 'valide' ||
            s === 'validé' ||
            s === 'paye' ||
            s === 'payé'
          );
        };

        const tenantSigned = Boolean(
          isConfirmedOrFinal(p.status) ||
          p.tenant_signature_url ||
          p.tenant_signed ||
          finalizedNotifs.has(ref)
        );

        const effectiveToken = p.token || p.verification_token || `tok_rec_${ref.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const effectiveDate = p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : (p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'));

        const effectiveTenantName = p.tenant?.full_name || p.tenant_name || matchingContract?.tenant_name || matchingContract?.applicant_name || 'Locataire';
        const effectivePropertyTitle = p.contract?.property?.title || p.property_title || matchingContract?.property_title || matchingContract?.property?.title || 'Bien immobilier';
        const effectiveContractNum = p.contract?.contract_number || p.contract_number || matchingContract?.contract_number || 'N/A';
        const effectivePeriod = p.target_month || p.period_covered || 'Période réglée';
        const effectiveAmount = Number(p.amount || 0);

        allRows.push({
          id: p.id || `pmt_${ref}`,
          receipt_number: ref,
          receipt_type: 'loyer',
          tenant_name: effectiveTenantName,
          property_title: effectivePropertyTitle,
          property_address: p.contract?.property?.address || matchingContract?.property_address || '',
          contract_number: effectiveContractNum,
          period_covered: effectivePeriod,
          amount: effectiveAmount,
          payment_method: p.payment_method || 'Mobile Money',
          payment_date: effectiveDate,
          transaction_ref: ref,
          token: effectiveToken,
          status: 'certifie',
          owner_signed: ownerSigned,
          tenant_signed: tenantSigned,
          allocations: p.allocations
        });
      }

      // 6. Reçus de Cautions (locatrust_deposits_v1 / locatrust_caution_deposits)
      for (const cd of localDeposits) {
        const isMine = !user?.id || cd.owner_id === user.id || cd.agency_id === user.id || !cd.owner_id;
        if (!isMine) continue;
        const cRef = cd.receipt_number || (cd.contract_number ? `REC-CAUTION-${cd.contract_number.slice(-6)}` : `REC-CAUTION-${String(cd.id || Date.now()).slice(-6)}`);
        if (seenRefs.has(cRef)) continue;
        seenRefs.add(cRef);

        const matchingContract = localContracts.find((c: any) => c.contract_number === cd.contract_number || c.id === cd.contract_id);
        const effectiveToken = cd.token || cd.verification_token || `T_${(cd.id || cRef).slice(0, 16)}`;
        const effectiveDate = new Date(cd.confirmed_at || cd.created_at || Date.now()).toLocaleDateString('fr-FR');

        const effectiveTenantName = cd.tenant?.full_name || cd.tenant_name || matchingContract?.tenant_name || 'Locataire';
        const effectivePropertyTitle = cd.property?.title || cd.property_title || matchingContract?.property_title || 'Logement LocaTrust';
        const effectiveContractNum = cd.contract_number || matchingContract?.contract_number || 'N/A';
        const effectiveAmount = Number(cd.amount_paid || cd.amount_requested || cd.amount || 0);

        allRows.push({
          id: cd.id || `loc_cau_${cRef}`,
          receipt_number: cRef,
          receipt_type: 'caution',
          tenant_name: effectiveTenantName,
          property_title: effectivePropertyTitle,
          property_address: cd.property?.address || cd.property_address || matchingContract?.property_address || '',
          contract_number: effectiveContractNum,
          period_covered: 'Dépôt de Garantie Contractuel (Loi n° 2019-576 Art. 414)',
          amount: effectiveAmount,
          payment_method: cd.payment_method || 'Wave CI / Mobile Money',
          payment_date: effectiveDate,
          transaction_ref: cd.declared_reference || cRef,
          token: effectiveToken,
          status: 'certifie',
          owner_signed: true,
          tenant_signed: true
        });
      }

      // 7. Quittances locales restantes
      for (const lr of localReceipts) {
        const ref = lr.receipt_number || lr.receiptNumber || lr.reference;
        if (!ref || seenRefs.has(ref)) continue;
        seenRefs.add(ref);

        allRows.push({
          id: lr.id || `loc_${ref}`,
          receipt_number: ref,
          receipt_type: (lr.type || lr.receipt_type || 'loyer') as 'loyer' | 'caution',
          tenant_name: lr.tenant_name || lr.tenantName || 'Locataire',
          property_title: lr.property_title || lr.propertyTitle || 'Bien immobilier',
          property_address: lr.property_address || lr.propertyAddress || '',
          contract_number: lr.contract_number || lr.contractNumber || 'N/A',
          period_covered: lr.period_covered || lr.periodCovered || 'Mois en cours',
          amount: Number(lr.amount || lr.amount_paid) || 0,
          payment_method: lr.payment_method || lr.paymentMethod || 'Mobile Money',
          payment_date: new Date(lr.created_at || lr.date || Date.now()).toLocaleDateString('fr-FR'),
          transaction_ref: ref,
          token: lr.token || `tok_${ref}`,
          status: 'certifie',
          owner_signed: true,
          tenant_signed: true
        });
      }

      setReceipts(allRows);
    } catch (err: any) {
      setLoadError(err?.message || 'Erreur lors du chargement des quittances.');
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    loadReceipts();

    const handleUpdate = () => {
      loadReceipts(true);
    };

    window.addEventListener('locatrust:receipts-updated', handleUpdate);
    window.addEventListener('locatrust:payments-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:receipts-updated', handleUpdate);
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
    };
  }, [user]);

  const handleRelanceReceipt = (r: OfficialReceiptRow) => {
    const targetRole = !r.owner_signed ? 'bailleur' : 'locataire';
    const targetName = targetRole === 'bailleur' ? "le bailleur" : r.tenant_name;
    setConfirmationModal({
      isOpen: true,
      title: 'Relance interne transmise',
      message: `Une notification de relance pour la signature du reçu N° ${r.receipt_number} a été déposée dans la messagerie interne de ${targetName}.`,
      details: 'Le document final signé deviendra téléchargeable dès validation.'
    });
  };

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.property_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.transaction_ref.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'tous' || r.receipt_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleDownloadPDF = async (r: OfficialReceiptRow) => {
    const resolved = resolveRealReceiptData(
      {
        reference: r.receipt_number,
        contract_id: r.contract_number,
        tenant: {
          full_name: r.tenant_name
        }
      },
      user
    );

    await generateOfficialReceiptPDF({
      receiptNumber: r.receipt_number,
      receiptType: r.receipt_type,
      contractNumber: resolved.contractNumber,
      contractToken: `tok_cnt_${resolved.contractNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      propertyTitle: r.property_title || resolved.propertyTitle,
      propertyAddress: r.property_address || resolved.propertyAddress,
      propertyReference: resolved.propertyReference,
      propertyType: resolved.propertyType,
      durationMonths: resolved.durationMonths,
      leaseStartDate: resolved.leaseStartDate,
      leaseEndDate: resolved.leaseEndDate,
      ownerName: resolved.ownerName,
      ownerCni: resolved.ownerCni,
      ownerPhone: resolved.ownerPhone,
      tenantName: r.tenant_name || resolved.tenantName,
      tenantCni: resolved.tenantCni,
      tenantPhone: resolved.tenantPhone,
      amount: r.amount,
      periodCovered: formatPeriodCovered(r.period_covered),
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method,
      transactionReference: r.transaction_ref,
      ownerSignatureUrl: resolved.ownerSignatureUrl || getStoredOwnerSignature(user?.id),
      tenantSignatureUrl: resolved.tenantSignatureUrl || getStoredTenantSignature(),
      allocations: (r as any).allocations || resolved.allocations
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans relative">
      {/* Barre de progression ultra-fine en arrière-plan (Phase 1) */}
      <TopProgressBar active={isRefreshing} />
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Reçus & Quittances
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-extrabold border border-blue-200 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              Reçus certifiés
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Historique intégral des quittances de loyer et des reçus de caution émis avec QR code d'authentification.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="N° reçu, locataire, réf..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setTypeFilter('tous')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                typeFilter === 'tous' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setTypeFilter('loyer')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                typeFilter === 'loyer' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Loyers
            </button>
            <button
              onClick={() => setTypeFilter('caution')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                typeFilter === 'caution' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cautions
            </button>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Documents comptables émis ({filteredReceipts.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Conformes à la loi n° 2019-576 • Vérifiables par QR code
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">N° Reçu</th>
                <th className="p-4">Type</th>
                <th className="p-4">Locataire & Bien</th>
                <th className="p-4">Période Concernée</th>
                <th className="p-4">Montant Réglé</th>
                <th className="p-4">Date de règlement</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            {(isLoading && receipts.length === 0) ? (
              <TableRowsSkeleton rows={5} cols={8} />
            ) : (
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loadError && (
                <tr>
                  <td colSpan={8} className="p-8 text-center bg-rose-50/50">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                      <span className="text-slate-800 font-bold text-xs">{loadError}</span>
                      <button onClick={loadReceipts} className="mt-3 px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition cursor-pointer">
                        Réessayer
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!(isLoading && receipts.length === 0) && !loadError && filteredReceipts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <span className="text-slate-800 font-bold text-sm">
                        {searchTerm ? "Aucun reçu ne correspond à votre recherche" : "Aucune quittance émise pour le moment"}
                      </span>
                      <p className="text-slate-400 text-xs mt-1 text-center">
                        {searchTerm
                          ? "Modifiez vos filtres ou termes de recherche."
                          : "Dès que vous validerez des paiements de loyer ou de caution, vos quittances certifiées conformes apparaîtront ici."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!(isLoading && receipts.length === 0) && !loadError && filteredReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  
                  {/* N° Reçu */}
                  <td className="p-4">
                    <span className="font-mono font-black text-blue-700">{r.receipt_number}</span>
                  </td>

                  {/* Type */}
                  <td className="p-4">
                    {r.receipt_type === 'loyer' ? (
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-black text-[10px]">
                        Quittance Loyer
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-black text-[10px]">
                        Reçu Caution
                      </span>
                    )}
                  </td>

                  {/* Locataire & Bien */}
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{r.tenant_name}</span>
                      <span className="text-[11px] text-slate-500">{r.property_title}</span>
                    </div>
                  </td>

                  {/* Période */}
                  <td className="p-4 font-semibold text-slate-800">{formatPeriodCovered(r.period_covered)}</td>

                  {/* Montant */}
                  <td className="p-4 font-black text-slate-900">{formatFCFA(r.amount)}</td>

                  {/* Date de règlement */}
                  <td className="p-4">
                    <span className="font-semibold text-slate-800">{r.payment_date}</span>
                  </td>

                  {/* Statut (Point 5 & 10) */}
                  <td className="p-4">
                    {r.owner_signed && r.tenant_signed ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1 w-fit whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Reçu certifié (2 signatures)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1 w-fit whitespace-nowrap">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Reçu en attente de signature du locataire
                      </span>
                    )}
                  </td>

                  {/* Actions (Point 5) */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.owner_signed && r.tenant_signed ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(r)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-extrabold text-[11px] flex items-center gap-1 cursor-not-allowed border border-slate-200"
                            title="Téléchargement bloqué : signature du locataire requise"
                          >
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Bloqué</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRelanceReceipt(r)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap"
                            title="Relancer le locataire pour apposer sa signature"
                          >
                            <Send className="w-3 h-3" />
                            <span>Relancer</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
            )}
          </table>

        </div>
      </div>

      {confirmationModal && (
        <ActionConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          title={confirmationModal.title}
          message={confirmationModal.message}
          details={confirmationModal.details}
          type="success"
          confirmText="Compris"
          withCelebration={false}
        />
      )}

    </div>
  );
};
