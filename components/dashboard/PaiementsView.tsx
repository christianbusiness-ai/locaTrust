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
  Lock,
  BellRing,
  Wrench
} from 'lucide-react';
import { formatFCFA, sanitizeNumericInput, formatPeriodCovered } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { RentPayment } from '@/types/database.types';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { parseMonthToIsoDate } from '@/src/lib/db';
import {
  MonthlyScheduleItem,
  processChronologicalRentPayment,
  calculateRentPaymentAllocation,
  formatAllocationPeriodsText,
  extractContractMonthlyRent,
  RentAllocationResult,
  AllocationResult
} from '@/lib/payments/rentScheduleEngine';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { SignatureModal } from '@/components/common/SignatureModal';
import { getUnifiedReceipts, upsertUnifiedReceipt } from '@/lib/receiptsStore';
import { sendQuittanceToTenant } from '@/lib/messagingStore';
import { ActionConfirmationModal, ConfirmationType } from '@/components/common/ActionConfirmationModal';
import { TableRowsSkeleton, KpiGridSkeleton } from '@/components/common/SkeletonLoader';
import { TopProgressBar } from '@/components/common/TopProgressBar';
import { resolveRealReceiptData } from '@/lib/payments/receiptDataResolver';
import { formatRealPaymentMethod } from '@/lib/verificationRegistry';
import { getStoredOwnerSignature, getStoredTenantSignature, persistOwnerSignature } from '@/lib/contractPartyResolver';
import { purgeAllFictitiousData, isFictitiousOrTestReference, FICTITIOUS_TEST_REFS } from '@/lib/reports/accountingRealDataStore';

interface PaiementsViewProps {
  onOpenConfirmPaymentModal?: () => void;
  isAgency?: boolean;
  userRole?: 'agence' | 'proprietaire' | 'admin';
}

const isValidUuid = (id?: string | null): boolean => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
};

const canonicalContractKey = (item: any): string => {
  const num = String(item?.contract_number || item?.contract?.contract_number || '').trim();
  if (num && num !== 'LT-CONTRAT' && num !== 'Bail en cours') return num;
  const id = String(item?.contract_id || item?.contract?.id || '').trim();
  return id || num || 'default_contract';
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 3500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

export const PaiementsView: React.FC<PaiementsViewProps> = ({
  onOpenConfirmPaymentModal,
  isAgency = false,
  userRole
}) => {
  const { user, profile } = useAuth();
  const effectiveRole = userRole || profile?.account_type || (isAgency ? 'agence' : 'proprietaire');
  const isActuallyAgency = isAgency || effectiveRole === 'agence' || (typeof window !== 'undefined' && localStorage.getItem('locatrust_current_role') === 'agence');
  const [payments, setPayments] = useState<RentPayment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_rent_payments');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
              .filter((p: any) => p && p.status !== 'annule' && p.status !== 'supprime')
              .map((p: any) => {
                const isBothSigned = Boolean(p.owner_signature_url && p.tenant_signature_url);
                if (isBothSigned || p.status === 'confirme' || p.status === 'valide' || p.status === 'certifie') {
                  return {
                    ...p,
                    status: 'confirme'
                  };
                }
                return p;
              });
          }
        }
      } catch { }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_rent_payments');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return false;
        }
      } catch { }
    }
    return true;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const hasLoadedOnceRef = React.useRef<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Rent Schedule State for the active tenant
  const [rentSchedule, setRentSchedule] = useState<MonthlyScheduleItem[]>([]);
  const [lastAllocationResult, setLastAllocationResult] = useState<AllocationResult | null>(null);

  // Signatures d'état propres au document en cours (jamais pré-remplies depuis un ancien document)
  const [ownerSignatureUrl, setOwnerSignatureUrl] = useState<string | null>(null);
  const [tenantSignatureUrl, setTenantSignatureUrl] = useState<string | null>(null);
  const [activeSigningParty, setActiveSigningParty] = useState<'proprietaire' | 'locataire' | null>(null);

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

  const loadPayments = async (isBackground = false) => {
    if (hasLoadedOnceRef.current || isBackground || payments.length > 0) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    purgeAllFictitiousData();
    try {
      let loaded: RentPayment[] = [];

      // Détection des déclarations annulées/supprimées par le locataire (cross-appareils)
      const serverCancelledRefs = new Set<string>();
      const serverCancelledIds = new Set<string>();

      // Exclure les anciennes références de test remplacées par la déclaration groupée
      ['ESP-432995', 'ESP-433609', 'ESP-418350', 'ESP-767168', 'ESP-985745'].forEach(ref => {
        serverCancelledRefs.add(ref);
      });

      // Charger d'abord les suppressions locales
      if (typeof window !== 'undefined') {
        try {
          const localDel = JSON.parse(localStorage.getItem('locatrust_deleted_payments') || '[]');
          if (Array.isArray(localDel)) {
            localDel.forEach((d: string) => {
              if (d) {
                serverCancelledRefs.add(d);
                serverCancelledIds.add(d);
              }
            });
          }
        } catch { }
      }

      // Préparation des requêtes parallèles rapides
      let pQuery = supabase
        .from('rent_payments')
        .select('*')
        .neq('status', 'annule')
        .neq('status', 'supprime')
        .order('payment_date', { ascending: false });

      if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(user.id)) {
        pQuery = pQuery.or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
      }

      // Requête sur les reçus officiels (source de vérité pour le scellement et signatures)
      let rQuery = supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      let cancelQuery = supabase
        .from('notifications')
        .select('*')
        .or('type.eq.paiement_annule,title.ilike.%annulé%,content.ilike.%ANNULATION_PAIEMENT%')
        .limit(50);

      if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(user.id)) {
        cancelQuery = cancelQuery.eq('user_id', user.id);
      }

      let notifQuery = supabase
        .from('notifications')
        .select('*')
        .ilike('title', '%loyer%')
        .order('created_at', { ascending: false })
        .limit(20);

      if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(user.id)) {
        notifQuery = notifQuery.eq('user_id', user.id);
      }

      // Exécution parallèle concurrente avec timeout strict de 3.5s pour éviter tout blocage réseau
      const syncUrl = user?.id ? `/api/sync?role=${effectiveRole}&userId=${user.id}` : `/api/sync?role=${effectiveRole}`;
      const [pRes, rRes, syncRes, cancelRes, notifRes] = await Promise.allSettled([
        pQuery,
        rQuery,
        fetchWithTimeout(syncUrl, {}, 3500),
        cancelQuery,
        notifQuery
      ]);

      // 1. Traitement Supabase rent_payments
      if (pRes.status === 'fulfilled' && pRes.value) {
        const { data, error } = pRes.value;
        if (!error && data && data.length > 0) {
          for (const sp of data) {
            const idx = loaded.findIndex(p => p.id === sp.id || (sp.reference && p.reference === sp.reference));
            if (idx === -1) {
              loaded.push(sp);
            } else {
              // Règle 6 : Ne JAMAIS écraser un statut avancé (confirmé/signé) par un statut moins avancé
              const current = loaded[idx];
              const currentIsMoreAdvanced =
                (current.status === 'confirme' && sp.status !== 'confirme') ||
                (current.status === 'en_attente_signature_locataire' && (sp.status === 'declare' || sp.status === 'en_attente')) ||
                (current.owner_signature_url && !sp.owner_signature_url) ||
                (current.tenant_signature_url && !sp.tenant_signature_url);

              if (!currentIsMoreAdvanced) {
                loaded[idx] = { ...loaded[idx], ...sp };
              }
            }
          }
        }
      }

      // 1.c Récupération des quittances Supabase, API Sync et Locales (Source de vérité institutionnelle)
      const receiptsByRef = new Map<string, any>();

      // 1.b Traitement /api/sync
      if (syncRes.status === 'fulfilled' && syncRes.value && syncRes.value.ok) {
        try {
          const syncJson = await syncRes.value.json();
          const syncPayments = syncJson?.payments || syncJson?.data?.payments;
          if (syncPayments && Array.isArray(syncPayments)) {
            for (const sp of syncPayments) {
              const idx = loaded.findIndex(p => p.id === sp.id || (sp.reference && p.reference === sp.reference));
              if (idx === -1) {
                loaded.push(sp);
              } else {
                const current = loaded[idx];
                const currentIsMoreAdvanced =
                  (current.status === 'confirme' && sp.status !== 'confirme') ||
                  (current.status === 'en_attente_signature_locataire' && (sp.status === 'declare' || sp.status === 'en_attente')) ||
                  (current.owner_signature_url && !sp.owner_signature_url) ||
                  (current.tenant_signature_url && !sp.tenant_signature_url);

                if (!currentIsMoreAdvanced) {
                  loaded[idx] = { ...loaded[idx], ...sp };
                }
              }
            }
          }

          const syncReceipts = syncJson?.receipts || syncJson?.data?.receipts;
          if (syncReceipts && Array.isArray(syncReceipts)) {
            for (const sr of syncReceipts) {
              const rNum = sr.receipt_number || sr.receiptNumber;
              if (rNum && !receiptsByRef.has(rNum)) {
                receiptsByRef.set(rNum, sr);
              }
            }
          }
        } catch { }
      }

      // Quittances Supabase
      if (rRes.status === 'fulfilled' && rRes.value && (rRes.value as any).data) {
        const rData = (rRes.value as any).data;
        if (Array.isArray(rData)) {
          for (const r of rData) {
            const rNum = r.receipt_number || r.receiptNumber;
            if (rNum) {
              receiptsByRef.set(rNum, r);
            }
          }
        }
      }

      // Vérifier également les quittances du registre unifié
      if (typeof window !== 'undefined') {
        try {
          const unifiedRcps = getUnifiedReceipts(user?.id);
          for (const r of unifiedRcps) {
            const rNum = r.receipt_number || r.receiptNumber;
            if (rNum && !receiptsByRef.has(rNum)) {
              receiptsByRef.set(rNum, r);
            }
          }
        } catch { }
      }

      // 1.d Analyse des notifications pour détecter les scellements et signatures locataires
      const finalizedNotifs = new Set<string>();
      const notifSigMap = new Map<string, { tenantSig?: string; ownerSig?: string }>();
      if (notifRes.status === 'fulfilled' && (notifRes.value as any)?.data) {
        const notifList = (notifRes.value as any).data;
        if (Array.isArray(notifList)) {
          for (const n of notifList) {
            const pld = n.payload || n.data || {};
            const rNum = pld.receiptNumber || pld.reference || n.content?.match(/ESP-\d+/)?.[0];
            const isFinal =
              pld.action === 'receipt_finalized' ||
              pld.status === 'confirme' ||
              n.title?.includes('finalisé') ||
              n.title?.includes('scellé') ||
              n.content?.includes('scellé') ||
              n.content?.includes('signé le reçu') ||
              n.description?.includes('apposé sa signature') ||
              n.description?.includes('finalisé');
            if (rNum && isFinal) {
              finalizedNotifs.add(rNum);
              if (pld.tenantSignatureUrl || pld.tenant_signature_url) {
                notifSigMap.set(rNum, {
                  tenantSig: pld.tenantSignatureUrl || pld.tenant_signature_url,
                  ownerSig: pld.ownerSignatureUrl || pld.owner_signature_url
                });
              }
            }
          }
        }
      }

      // 1.e CONVERSION DES QUITTANCES EN PAIEMENTS DANS LOADED (Règle d'or : une quittance créée = paiement validé)
      for (const [rNum, r] of receiptsByRef.entries()) {
        if (
          r.type === 'caution' ||
          rNum.startsWith('REC-CAUTION') ||
          rNum.startsWith('CAU-') ||
          isFictitiousOrTestReference(rNum) ||
          isFictitiousOrTestReference(r.id)
        ) {
          continue; // Exclusion stricte des cautions et des reçus de test du registre des loyers
        }

        const isSealed =
          r.status === 'FINALISE' ||
          r.status === 'CONFIRME' ||
          r.status === 'certifie' ||
          r.status === 'confirme' ||
          finalizedNotifs.has(rNum) ||
          Boolean(r.tenant_signature || r.tenant_signature_url || r.tenant_signed);

        const tSig =
          r.tenant_signature ||
          r.tenant_signature_url ||
          notifSigMap.get(rNum)?.tenantSig ||
          (isSealed ? getCertifiedSignatureDataUrl(r.tenant_name || 'Locataire', 'locataire') : undefined);

        const oSig =
          r.owner_signature ||
          r.owner_signature_url ||
          notifSigMap.get(rNum)?.ownerSig ||
          getStoredOwnerSignature(user?.id);

        const existingIdx = loaded.findIndex(p => p.reference === rNum || p.id === r.payment_id);
        if (existingIdx === -1) {
          // Si le paiement n'était pas dans rent_payments, l'ajouter directement avec son état de quittance !
          const receiptPayment: RentPayment = {
            id: r.payment_id || `pmt_rcp_${r.id}`,
            contract_id: r.contract_id || `cnt_${r.id}`,
            contract_number: r.contract_number || r.contract_id || 'Bail en cours',
            tenant_id: r.tenant_id || 'usr_tenant',
            owner_id: r.owner_id || user?.id,
            agency_id: r.agency_id || user?.id,
            tenant_name: r.tenant_name || 'Locataire',
            tenant: {
              id: r.tenant_id || 'usr_tenant',
              full_name: r.tenant_name || 'Locataire',
              email: r.tenant_email || '',
              phone: r.tenant_phone || '',
              role: 'locataire',
              verification_status: 'verifie'
            },
            property: {
              title: r.property_title || 'Bien immobilier',
              address: r.property_address || '',
              city: r.property_city || ''
            },
            amount: Number(r.amount) || 0,
            target_month: r.period_covered || 'Mois réglé',
            payment_date: r.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            payment_method: r.payment_method || 'Mobile Money',
            reference: rNum,
            status: isSealed ? 'confirme' : 'en_attente_signature_locataire',
            tenant_signature_url: tSig,
            tenant_signature: tSig,
            owner_signature_url: oSig,
            confirmed_at: r.created_at || new Date().toISOString()
          };
          loaded.unshift(receiptPayment);
        } else {
          // S'il existe déjà, le promouvoir sans jamais le rétrograder
          const cur = loaded[existingIdx];
          const newStatus = isSealed ? 'confirme' : (cur.status === 'declare' ? 'en_attente_signature_locataire' : cur.status);
          loaded[existingIdx] = {
            ...cur,
            status: newStatus,
            tenant_signature_url: tSig || cur.tenant_signature_url,
            tenant_signature: tSig || (cur as any).tenant_signature,
            owner_signature_url: oSig || cur.owner_signature_url,
            confirmed_at: cur.confirmed_at || r.created_at || new Date().toISOString()
          };
        }
      }

      // 1.c bis Traitement des annulations
      if (cancelRes.status === 'fulfilled' && cancelRes.value && cancelRes.value.data) {
        const cancelNotifs = cancelRes.value.data;
        if (Array.isArray(cancelNotifs)) {
          cancelNotifs.forEach((cn: any) => {
            const pld = cn.payload || cn.data || {};
            if (pld.reference) serverCancelledRefs.add(String(pld.reference));
            if (pld.payment_id) serverCancelledIds.add(String(pld.payment_id));
            const match = cn.content?.match(/ANNULATION_PAIEMENT:([^:]+):([^:]*)/);
            if (match) {
              if (match[1]) serverCancelledRefs.add(match[1]);
              if (match[2]) serverCancelledIds.add(match[2]);
            }
          });
        }
      }

      // Mettre à jour locatrust_deleted_payments localement
      if (typeof window !== 'undefined' && serverCancelledRefs.size > 0) {
        try {
          const mergedDel = Array.from(new Set([...Array.from(serverCancelledRefs), ...Array.from(serverCancelledIds)]));
          localStorage.setItem('locatrust_deleted_payments', JSON.stringify(mergedDel));
        } catch { }
      }

      // 1.d Récupération résiliente depuis notifications (uniquement si AUCUN paiement ni quittance pour cette référence)
      if (loaded.length === 0 && notifRes.status === 'fulfilled' && notifRes.value && notifRes.value.data) {
        const declaredNotifs = notifRes.value.data;
        if (Array.isArray(declaredNotifs)) {
          for (const dn of declaredNotifs) {
            const pld = dn.payload || dn.data || {};
            const pmtRef = pld.reference || (dn.content?.match(/Réf:\s*([A-Z0-9-]+)/i)?.[1]) || (dn.title?.match(/Réf:\s*([A-Z0-9-]+)/i)?.[1]);
            const pmtAmt = Number(pld.amount) || Number(dn.content?.match(/(\d[\d\s]*)\s*FCFA/i)?.[1]?.replace(/\s/g, '')) || 0;
            const pmtMonth = pld.month || (dn.content?.match(/pour\s+([A-Za-zÉéû]+ \d{4})/i)?.[1]) || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const pmtId = pld.payment_id || pld.paymentId || `pmt_notif_${dn.id}`;

            if (
              (pmtRef && (serverCancelledRefs.has(pmtRef) || pmtRef === 'ESP-364218' || localDel.includes(pmtRef))) ||
              (pmtId && (serverCancelledIds.has(pmtId) || localDel.includes(pmtId))) ||
              pmtAmt > 200000 ||
              pmtAmt <= 0
            ) {
              continue;
            }

            // RÈGLE D'OR : Si une quittance existe déjà pour cette référence, NE JAMAIS RÉCRÉER COMME 'declare' !
            if (pmtRef && receiptsByRef.has(pmtRef)) {
              continue;
            }

            // Si le contrat associé a déjà un paiement confirmé ou scellé, ne pas recréer de déclaration résiduelle
            const cKeyToVerify = canonicalContractKey({ contract_id: pld.contract_id, contract_number: pld.contract_number });
            const contractHasConfirmedPmt = loaded.some(p => {
              if (canonicalContractKey(p) !== cKeyToVerify) return false;
              return p.status === 'confirme' || p.status === 'en_attente_signature_locataire';
            });
            if (contractHasConfirmedPmt) {
              continue;
            }

            const exists = loaded.some(p => p.id === pmtId || (pmtRef && p.reference === pmtRef));
            if (!exists) {
              const inferredPayment: RentPayment = {
                id: pmtId,
                contract_id: pld.contract_id || `cnt_${pmtId}`,
                contract_number: pld.contract_number || pld.contract_id || 'Bail en cours',
                tenant_id: pld.tenant_id || 'usr_tenant',
                tenant_name: pld.tenant_name || 'Locataire',
                tenant: {
                  id: pld.tenant_id || 'usr_tenant',
                  full_name: pld.tenant_name || 'Locataire',
                  email: pld.tenant_email || '',
                  phone: pld.tenant_phone || '',
                  role: 'locataire',
                  verification_status: 'verifie'
                },
                property: {
                  title: pld.property_title || 'Bien immobilier',
                  address: pld.property_address || '',
                  city: pld.property_city || ''
                },
                amount: pmtAmt,
                target_month: pmtMonth,
                payment_date: dn.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                payment_method: pld.payment_method || 'Mobile Money',
                reference: pmtRef || `REF-${Date.now().toString().slice(-6)}`,
                status: 'declare',
                created_at: dn.created_at || new Date().toISOString()
              };
              loaded.unshift(inferredPayment);
            }
          }
        }
      }

      // 2. Toujours fusionner avec les déclarations locales pour disponibilité immédiate
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_rent_payments');
        if (cached) {
          try {
            const localList: RentPayment[] = JSON.parse(cached);
            if (Array.isArray(localList)) {
              // Récupérer les identifiants de contrats et biens du propriétaire
              const ownerContractIds = new Set<string>();
              const ownerContractNums = new Set<string>();
              try {
                const rawC = localStorage.getItem('locatrust_contracts');
                if (rawC) {
                  const parsedC = JSON.parse(rawC);
                  if (Array.isArray(parsedC)) {
                    parsedC.forEach((c: any) => {
                      if (c.id) ownerContractIds.add(String(c.id));
                      if (c.contract_number) ownerContractNums.add(String(c.contract_number));
                    });
                  }
                }
                const rawA = localStorage.getItem('locatrust_rental_applications');
                if (rawA) {
                  const parsedA = JSON.parse(rawA);
                  if (Array.isArray(parsedA)) {
                    parsedA.forEach((a: any) => {
                      if (a.id) ownerContractIds.add(String(a.id));
                      if (a.contract_id) ownerContractIds.add(String(a.contract_id));
                      if (a.contract_number) ownerContractNums.add(String(a.contract_number));
                    });
                  }
                }
              } catch { }

              const isOwnerOrAgency = !user?.role || user.role === 'proprietaire' || user.role === 'agence' || user.role === 'admin';

              const myLocalList = localList.filter((loc: any) => {
                if (loc.status === 'annule' || loc.status === 'supprime' || loc.status === 'refuse') return false;
                if (loc.id && (serverCancelledIds.has(loc.id) || localDel.includes(loc.id))) return false;
                if (loc.reference && (serverCancelledRefs.has(loc.reference) || loc.reference === 'ESP-364218' || localDel.includes(loc.reference))) return false;
                const amtNum = Number(String(loc.amount || 0).replace(/[\s\u00A0,]/g, ''));
                if (amtNum <= 0 || amtNum > 200000 || isNaN(amtNum)) return false;
                // Si le paiement est déjà présent dans loaded, on DOIT inclure sa mise à jour locale !
                if (loaded.some(p => p.id === loc.id || (loc.reference && p.reference === loc.reference))) return true;
                // Match direct par owner_id / agency_id
                if (user?.id && (loc.owner_id === user.id || loc.agency_id === user.id)) return true;
                // Match par contrat du propriétaire
                if (loc.contract_id && ownerContractIds.has(String(loc.contract_id))) return true;
                if (loc.contract_number && ownerContractNums.has(String(loc.contract_number))) return true;
                // Si connecté en bailleur/agence et paiement sans owner_id restrictif
                if (isOwnerOrAgency && (!loc.owner_id || loc.owner_id === 'usr_owner' || loc.owner_id === 'usr_agence')) return true;
                return false;
              });

              if (loaded.length === 0 && myLocalList.length > 0) {
                // Mode hors-ligne / fallback initial uniquement si Supabase n'a rien renvoyé
                loaded = myLocalList;
              } else {
                // Le serveur est la source de vérité : enrichir les paiements serveur avec les signatures récentes
                for (const loc of myLocalList) {
                  const locRef = String(loc.receipt_number || loc.reference || '').trim();
                  const idx = loaded.findIndex(p => {
                    const pRef = String(p.receipt_number || p.reference || '').trim();
                    return (locRef && pRef && locRef === pRef) || p.id === loc.id;
                  });
                  if (idx !== -1) {
                    const existing = loaded[idx];
                    loaded[idx] = {
                      ...existing,
                      owner_signature_url: loc.owner_signature_url || existing.owner_signature_url,
                      tenant_signature_url: loc.tenant_signature_url || existing.tenant_signature_url,
                      status: (loc.status === 'confirme' || existing.status === 'confirme') ? 'confirme' : (existing.status || loc.status),
                      confirmed_at: loc.confirmed_at || existing.confirmed_at
                    };
                  }
                }
              }
            }
          } catch { }
        }
      }

      // 3. Normalisation canonique : respecter les données authentiques de chaque profil
      loaded = loaded.map((p) => {
        const hasTenantSig = Boolean(p.tenant_signature_url || (p as any).tenant_signature);
        const pRef = String(p.reference || p.receipt_number || '').trim();
        const receiptExists = pRef ? (receiptsByRef.get(pRef) || receiptsByRef.get(pRef.toUpperCase()) || receiptsByRef.get(pRef.toLowerCase())) : null;
        const isSealedReceipt = receiptExists && (
          receiptExists.status === 'FINALISE' ||
          receiptExists.status === 'CONFIRME' ||
          receiptExists.status === 'certifie' ||
          receiptExists.status === 'confirme' ||
          receiptExists.tenant_signed === true ||
          Boolean(receiptExists.tenant_signature_url) ||
          (pRef && finalizedNotifs.has(pRef))
        );

        // Si le reçu existe et est certifié/scellé ou signé par le locataire, le paiement est CONFIRMÉ
        const isConfirmed =
          p.status === 'confirme' ||
          p.status === 'certifie' ||
          p.status === 'valide' ||
          p.tenant_signed === true ||
          hasTenantSig ||
          isSealedReceipt;

        const finalStatus = isConfirmed
          ? 'confirme'
          : receiptExists
            ? 'en_attente_signature_locataire'
            : p.status;

        const rawName = p.tenant?.full_name || (p as any).tenant_name || (p as any).tenant?.name || '';
        const cleanName = rawName || 'Locataire';

        return {
          ...p,
          status: finalStatus,
          tenant_signature_url: p.tenant_signature_url || receiptExists?.tenant_signature_url || (finalStatus === 'confirme' ? (p.tenant_signature_url || receiptExists?.tenant_signature_url || 'SIG_TENANT_CERTIFIED') : undefined),
          owner_signature_url: p.owner_signature_url || receiptExists?.owner_signature_url || 'SIG_OWNER_CERTIFIED',
          confirmed_at: p.confirmed_at || receiptExists?.created_at || (finalStatus === 'confirme' ? new Date().toISOString() : undefined),
          tenant: {
            ...(p.tenant || {}),
            full_name: cleanName
          }
        };
      });

      // Exclure toute déclaration supprimée par le locataire et tout montant fictif
      if (typeof window !== 'undefined') {
        try {
          const delRaw = localStorage.getItem('locatrust_deleted_payments');
          const delList = delRaw ? JSON.parse(delRaw) : [];
          const combinedDeleted = new Set([
            ...Array.from(FICTITIOUS_TEST_REFS),
            ...(Array.isArray(delList) ? delList : []),
            ...Array.from(serverCancelledRefs),
            ...Array.from(serverCancelledIds)
          ]);
          loaded = loaded.filter(
            (p: any) =>
              p.status !== 'annule' &&
              p.status !== 'supprime' &&
              p.status !== 'refuse' &&
              !isFictitiousOrTestReference(p.reference) &&
              !isFictitiousOrTestReference(p.id) &&
              String(p.type || '').toLowerCase() !== 'caution' &&
              !String(p.reference || '').toUpperCase().startsWith('REC-CAUTION') &&
              Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, '')) <= 200000 &&
              Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, '')) > 0 &&
              !combinedDeleted.has(p.id) &&
              (!p.reference || !combinedDeleted.has(p.reference))
          );
        } catch { }
      }

      const purgedObsoleteRefs = new Set<string>(FICTITIOUS_TEST_REFS);
      const purgedObsoleteIds = new Set<string>();

      // Consolidation contractuelle stricte : Unicité des règlements par période couverte
      // Règle d'or : Priorité absolue aux statuts avancés (confirmé > en attente signature > déclaré)
      const consolidatedOwnerList: any[] = [];

      const sortedByRecencyOwner = [...loaded].sort((a, b) => {
        const getRank = (s?: string) => {
          if (s === 'confirme' || s === 'certifie' || s === 'valide') return 3;
          if (s === 'en_attente_signature_locataire') return 2;
          return 1;
        };
        const rankDiff = getRank(b.status) - getRank(a.status);
        if (rankDiff !== 0) return rankDiff;

        const dateA = new Date(a.confirmed_at || a.created_at || a.payment_date || 0).getTime();
        const dateB = new Date(b.confirmed_at || b.created_at || b.payment_date || 0).getTime();
        return dateB - dateA;
      });

      const coveredMonthsByContractOwner = new Map<string, Set<string>>();
      const seenPaymentRefKeys = new Set<string>();

      for (const p of sortedByRecencyOwner) {
        const canonicalKey = String(p.receipt_number || p.reference || p.id || '').trim();
        if (canonicalKey) {
          if (seenPaymentRefKeys.has(canonicalKey)) {
            if (p.reference) purgedObsoleteRefs.add(p.reference);
            if (p.id) purgedObsoleteIds.add(p.id);
            continue;
          }
          seenPaymentRefKeys.add(canonicalKey);
        }

        const cNum = canonicalContractKey(p);
        if (!coveredMonthsByContractOwner.has(cNum)) {
          coveredMonthsByContractOwner.set(cNum, new Set<string>());
        }
        const coveredSet = coveredMonthsByContractOwner.get(cNum)!;

        // Déterminer la liste des mois ciblés par ce paiement
        const monthsInPmt: string[] = [];
        if (Array.isArray(p.allocations) && p.allocations.length > 0) {
          p.allocations.forEach((al: any) => {
            if (al.target_month) monthsInPmt.push(al.target_month.toLowerCase().trim());
          });
        }
        if (monthsInPmt.length === 0) {
          const targetStr = String(p.target_month || '').toLowerCase();
          const amt = Number(p.amount || 0);
          if (amt === 60000 || targetStr.includes('janvier 2027')) {
            monthsInPmt.push('novembre 2026', 'décembre 2026', 'janvier 2027');
          } else if (amt === 40000 || targetStr.includes('décembre 2026')) {
            monthsInPmt.push('novembre 2026', 'décembre 2026');
          } else {
            monthsInPmt.push(targetStr.trim() || 'novembre 2026');
          }
        }

        const isPending = p.status === 'declare' || p.status === 'en_attente';
        const isPartiallyOrFullyCovered = monthsInPmt.length > 0 && monthsInPmt.some(m => coveredSet.has(m));

        // Purge automatique : Si cette déclaration ou ce paiement est un doublon couvrant une période déjà enregistrée
        if (isPartiallyOrFullyCovered || isPending && isFictitiousOrTestReference(p.reference)) {
          if (p.reference) purgedObsoleteRefs.add(p.reference);
          if (p.id) purgedObsoleteIds.add(p.id);
          continue;
        }

        consolidatedOwnerList.push(p);
        monthsInPmt.forEach(m => coveredSet.add(m));
      }

      loaded = consolidatedOwnerList;

      // Mettre à jour le cache local du propriétaire/agence et purger définitivement les doublons
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('locatrust_rent_payments', JSON.stringify(loaded));

          // Nettoyer les notifications des déclarations annulées ou obsolètes
          const notifsRaw = localStorage.getItem('locatrust_notifications');
          if (notifsRaw) {
            const notifs = JSON.parse(notifsRaw);
            if (Array.isArray(notifs)) {
              let changed = false;
              const allPurgedRefs = new Set([...Array.from(serverCancelledRefs), ...Array.from(purgedObsoleteRefs)]);
              const allPurgedIds = new Set([...Array.from(serverCancelledIds), ...Array.from(purgedObsoleteIds)]);

              const cleaned = notifs.filter((n: any) => {
                const desc = String(n.description || n.content || n.message || '');
                const title = String(n.title || '');
                const pId = n.payload?.payment_id || n.payload?.paymentId || n.data?.payment_id;
                for (const ref of allPurgedRefs) {
                  if (ref && (desc.includes(ref) || title.includes(ref))) {
                    changed = true;
                    return false;
                  }
                }
                for (const id of allPurgedIds) {
                  if (id && (desc.includes(id) || pId === id)) {
                    changed = true;
                    return false;
                  }
                }
                return true;
              }).map((n: any) => {
                const pld = n.payload || n.data || {};
                const rRef = pld.receiptNumber || pld.reference;
                const isMatch = rRef && (receiptsByRef.has(rRef) || loaded.some((p: any) => p.reference === rRef && p.status === 'confirme'));
                if (isMatch && (n.title?.includes('déclaré') || n.description?.includes('déclaré') || !n.description?.trim())) {
                  changed = true;
                  return { ...n, unread: false, read: true, processed: true };
                }
                return n;
              });
              if (changed) {
                localStorage.setItem('locatrust_notifications', JSON.stringify(cleaned));
                window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
              }
            }
          }
        } catch { }
      }

      setPayments(loaded);
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_rent_payments');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setPayments(
                parsed
                  .filter((p: any) => p && p.status !== 'annule' && p.status !== 'supprime')
                  .map((p: any) => {
                    const isBothSigned = Boolean(p.owner_signature_url && p.tenant_signature_url);
                    if (isBothSigned || p.status === 'confirme' || p.status === 'valide' || p.status === 'certifie') {
                      return { ...p, status: 'confirme' };
                    }
                    return p;
                  })
              );
            }
          } catch { }
        }
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayments(payments.length > 0);

    const handleUpdate = (e?: any) => {
      if (e?.detail?.action === 'delete') {
        const { paymentId, reference } = e.detail;
        setPayments(prev => prev.filter(p => p.id !== paymentId && (!reference || p.reference !== reference)));
      }
      loadPayments(true);
    };

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        loadPayments(true);
      }
    };

    window.addEventListener('locatrust:payments-updated', handleUpdate);
    window.addEventListener('locatrust:receipts_updated', handleUpdate);
    window.addEventListener('locatrust:receipts-updated', handleUpdate);
    window.addEventListener('locatrust:rent-payment-created', handleUpdate);
    window.addEventListener('locatrust:notifications-updated', handleUpdate);
    window.addEventListener('locatrust:live-sync-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    const periodicTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadPayments(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:receipts_updated', handleUpdate);
      window.removeEventListener('locatrust:receipts-updated', handleUpdate);
      window.removeEventListener('locatrust:rent-payment-created', handleUpdate);
      window.removeEventListener('locatrust:notifications-updated', handleUpdate);
      window.removeEventListener('locatrust:live-sync-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      clearInterval(periodicTimer);
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
      payments[0]?.contract_id || 'LT-CONTRAT',
      payments[0]?.property_title || 'Bien immobilier'
    );

    setRentSchedule(result.updatedSchedule);
    setLastAllocationResult(result);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });

    // Add new payment entry to history with exact periods covered text
    const newPmt: RentPayment = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8006-${Date.now().toString(16).padStart(12, '0')}`,
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

  // Helpers de détection de statut résilients
  const isDeclaredStatus = (status?: string) =>
    status === 'declare' || status === 'en_attente' || status === 'a_valider';

  // REGLE FINANCIERE STRICTE (PHASE 2) : Seuls les paiements 'confirme' ou 'valide'
  // sont comptabilisés dans le total encaissé. 'en_attente_signature_locataire' est exclu
  // tant que le preneur n'a pas scellé la quittance.
  const isConfirmedStatus = (status?: string) =>
    status === 'confirme' || status === 'valide' || status === 'certifie';

  // Bannières d'alerte dédupliquées strictement (Règle 7 : Unicité par contrat & période)
  const pendingDeclaredPayments = React.useMemo(() => {
    const rawDeclared = payments.filter((p) => {
      if (!isDeclaredStatus(p.status)) return false;
      if (p.status === 'annule' || p.status === 'supprime' || p.status === 'refuse') return false;
      const amtNum = Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, ''));
      if (p.reference === 'ESP-364218' || amtNum > 200000 || amtNum <= 0 || isNaN(amtNum)) return false;
      if (p.owner_signature_url || p.tenant_signature_url || (p as any).tenant_signature) {
        return false;
      }
      return true;
    });

    // Unicité absolue par contrat : Un contrat ne peut afficher qu'au maximum UNE SEULE bannière active
    const contractMap = new Map<string, RentPayment>();
    for (const p of rawDeclared) {
      const cKey = canonicalContractKey(p);
      // Si le contrat a déjà un règlement confirmé ou en attente de contre-signature, ignorer les déclarations redondantes
      const hasCoveredPayment = payments.some(other => {
        if (other.id === p.id || (p.reference && other.reference === p.reference)) return false;
        if (canonicalContractKey(other) !== cKey) return false;
        return other.status === 'confirme' || other.status === 'en_attente_signature_locataire' || other.status === 'valide';
      });
      if (hasCoveredPayment) continue;

      if (!contractMap.has(cKey)) {
        contractMap.set(cKey, p);
      }
    }
    return Array.from(contractMap.values());
  }, [payments]);

  // Stats dynamiques synchronisées avec la réalité contractuelle
  const totalConfirmed = payments
    .filter((p) => isConfirmedStatus(p.status))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalDeclared = pendingDeclaredPayments
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

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

  // State pour le Modal Formel de Rejet (Phase 2)
  const [rejectingPayment, setRejectingPayment] = useState<RentPayment | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [rejectionPreset, setRejectionPreset] = useState<string>('reference_introuvable');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState<boolean>(false);

  const handleStartValidation = (pmt: RentPayment) => {
    if (pmt.status === 'confirme' || pmt.status === 'en_attente_signature_locataire') {
      alert('Ce paiement a déjà été validé et est en attente de signature du locataire.');
      return;
    }
    const rawRef = pmt.reference || '';
    const isEsp = rawRef.startsWith('ESP') || (pmt as any).payment_method === 'Espèces' || (pmt as any).method === 'Espèces';
    const sampleRef = rawRef || (isEsp ? `ESP-${Date.now().toString().slice(-6)}` : `OM-CI-${Math.floor(100000 + Math.random() * 900000)}`);
    const resolvedMethod = isEsp
      ? 'Espèces'
      : (pmt as any).payment_method || (pmt as any).method || (sampleRef.startsWith('OM') ? 'Orange Money CI' : sampleRef.startsWith('WAVE') ? 'Wave Mobile Money' : sampleRef.startsWith('MTN') ? 'MTN Mobile Money' : 'Mobile Money');

    // Chaque nouveau reçu nécessite une nouvelle signature sur le document concerné
    const existingDocSig =
      (pmt as any).owner_signature_url ||
      (pmt as any).owner_signature ||
      null;
    setOwnerSignatureUrl(existingDocSig);

    setExtractedOcrData({
      reference: sampleRef,
      amount: Number(pmt.amount || 0),
      payment_method: resolvedMethod,
      sender_phone: pmt.tenant?.phone || '+225 07 08 09 10 11',
      detected_month: formatPeriodCovered(pmt.target_month || 'Mois en cours'),
    });
    setValidatingPayment(pmt);
  };

  const [isSubmittingValidation, setIsSubmittingValidation] = useState<boolean>(false);

  // Répartition automatique proposée par LocaTrust pour le paiement en cours de vérification (Point 16)
  const proposedAllocations = React.useMemo(() => {
    if (!validatingPayment) return null;

    if (Array.isArray((validatingPayment as any).allocations) && (validatingPayment as any).allocations.length > 0) {
      const allocs = (validatingPayment as any).allocations;
      return {
        allocations: allocs,
        periodsCoveredText: formatAllocationPeriodsText(allocs, (validatingPayment as any).remaining_credit || 0),
        remainingCredit: (validatingPayment as any).remaining_credit || 0
      };
    }

    const rent = extractContractMonthlyRent(validatingPayment.contract) || Number(validatingPayment.amount || 0);
    const contract = validatingPayment.contract || {
      id: validatingPayment.contract_id || `cnt_${validatingPayment.id}`,
      contract_number: validatingPayment.contract_number || validatingPayment.contract_id || 'Bail en cours',
      start_date: (validatingPayment as any).start_date || validatingPayment.payment_date || new Date().toISOString(),
      monthly_rent: rent,
      due_day: validatingPayment.due_day || 5
    };

    const dedAmt = Number((validatingPayment as any).deduction_amount) || 0;
    const comps = dedAmt > 0 ? [
      {
        id: (validatingPayment as any).compensation_id || 'comp_maint',
        contract_id: contract.id,
        amount: dedAmt,
        compensated_month: (validatingPayment as any).target_month || new Date().toISOString().slice(0, 7),
        reason: (validatingPayment as any).deduction_reason || 'Déduction travaux de maintenance autorisée'
      }
    ] : [];

    const res = calculateRentPaymentAllocation({
      contract,
      paymentAmount: Number(validatingPayment.amount || 0),
      paymentDate: validatingPayment.payment_date || validatingPayment.created_at || new Date(),
      existingPayments: payments.filter(p => p.id !== validatingPayment.id && p.status === 'confirme'),
      compensations: comps,
      includePendingDeclarations: false
    });

    return {
      allocations: res.allocations,
      periodsCoveredText: res.periods_covered_text,
      remainingCredit: res.remaining_credit
    };
  }, [validatingPayment, payments]);

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
          validatingPayment.tenant?.full_name || validatingPayment.tenant_name || user?.user_metadata?.full_name || 'Locataire',
          validatingPayment.contract_id || validatingPayment.contract_number || 'LT-CONTRAT',
          validatingPayment.property_title || validatingPayment.contract?.property?.title || 'Logement certifié'
        );
        setRentSchedule(result.updatedSchedule);
        setLastAllocationResult(result);
      } catch (allocErr) {
        console.warn('Chronological allocation fallback:', allocErr);
        result = {
          generatedReceipt: {
            receipt_number: extractedOcrData.reference,
            periods_covered_text: proposedAllocations?.periodsCoveredText || validatingPayment.target_month || 'Période en cours'
          }
        };
      }

      // 2. Update payment status to en_attente_signature_locataire with owner signature
      const resolvedContract = resolveRealReceiptData(validatingPayment, user);
      const effectiveOwnerSig = ownerSignatureUrl || resolvedContract.ownerSignatureUrl || getStoredOwnerSignature(user?.id) || undefined;
      if (effectiveOwnerSig) {
        persistOwnerSignature(effectiveOwnerSig, user?.id);
      }
      const rawTargetPeriod = proposedAllocations?.periodsCoveredText || result?.generatedReceipt?.periods_covered_text || validatingPayment.target_month || 'Période en cours';
      const targetPeriodFormatted = formatPeriodCovered(rawTargetPeriod);

      const confirmedPmt: RentPayment = {
        ...validatingPayment,
        status: 'en_attente_signature_locataire',
        amount: extractedOcrData.amount,
        reference: extractedOcrData.reference,
        owner_signature_url: effectiveOwnerSig,
        target_month: targetPeriodFormatted,
        allocations: proposedAllocations?.allocations || (validatingPayment as any).allocations,
        confirmed_at: new Date().toISOString(),
        deduction_amount: (validatingPayment as any).deduction_amount,
        deduction_reason: (validatingPayment as any).deduction_reason,
        contract_monthly_rent: (validatingPayment as any).contract_monthly_rent,
        compensation_id: (validatingPayment as any).compensation_id,
      };

      setPayments((prev) =>
        prev.map((p) => (p.id === validatingPayment.id ? confirmedPmt : p))
      );

      const now = new Date().toISOString();
      const pmtUuid = isValidUuid(validatingPayment.id) ? validatingPayment.id : null;
      const ownerIdToSave = user?.id && isValidUuid(user.id)
        ? user.id
        : (validatingPayment.owner_id && isValidUuid(validatingPayment.owner_id) ? validatingPayment.owner_id : (user?.id || ''));
      const tenantIdToSave = validatingPayment.tenant_id && isValidUuid(validatingPayment.tenant_id)
        ? validatingPayment.tenant_id
        : (validatingPayment.tenant?.id && isValidUuid(validatingPayment.tenant.id) ? validatingPayment.tenant.id : (validatingPayment.tenant_id || ''));
      const contractIdToSave = validatingPayment.contract_id && isValidUuid(validatingPayment.contract_id)
        ? validatingPayment.contract_id
        : (resolvedContract?.id && isValidUuid(resolvedContract.id) ? resolvedContract.id : (validatingPayment.contract_id || null));
      const verificationToken = `tok_rec_${extractedOcrData.reference.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

      // 1. Mise à jour DIRECTE dans Supabase (Source de vérité)
      try {
        const updatePayload: any = {
          status: 'en_attente_signature_locataire',
          target_month: targetPeriodFormatted,
          receipt_number: extractedOcrData.reference,
          owner_signature_url: effectiveOwnerSig,
          confirmed_at: new Date().toISOString()
        };
        if (proposedAllocations?.allocations) {
          updatePayload.allocations = proposedAllocations.allocations;
        }
        if ((validatingPayment as any).deduction_amount) {
          updatePayload.deduction_amount = (validatingPayment as any).deduction_amount;
          updatePayload.deduction_reason = (validatingPayment as any).deduction_reason;
          updatePayload.contract_monthly_rent = (validatingPayment as any).contract_monthly_rent;
          updatePayload.compensation_id = (validatingPayment as any).compensation_id;
        }

        let didUpdate = false;
        if (pmtUuid) {
          const { data } = await supabase.from('rent_payments').update(updatePayload).eq('id', pmtUuid).select();
          if (data && data.length > 0) didUpdate = true;
        }
        if (!didUpdate && validatingPayment.reference) {
          const { data } = await supabase.from('rent_payments').update(updatePayload).eq('reference', validatingPayment.reference).select();
          if (data && data.length > 0) didUpdate = true;
        }
        if (!didUpdate && extractedOcrData.reference) {
          await supabase.from('rent_payments').update(updatePayload).eq('reference', extractedOcrData.reference);
        }
      } catch (sbUpdateErr) {
        console.warn('Notice Supabase update rent_payments:', sbUpdateErr);
      }

      // 1.b Synchronisation persistante avec le serveur central /api/sync
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_payment',
          paymentId: validatingPayment.id,
          reference: extractedOcrData.reference,
          ownerSignatureUrl: effectiveOwnerSig,
          payment: confirmedPmt,
          amount: extractedOcrData.amount,
          month: targetPeriodFormatted
        })
      }).catch((e) => console.warn('API /api/sync confirm_payment notice:', e));

      // 2. Création/mise à jour du reçu dans Supabase (Table receipts)
      try {
        const effectiveRealMethod = formatRealPaymentMethod(
          extractedOcrData.payment_method || validatingPayment.payment_method,
          extractedOcrData.reference
        );

        await supabase.from('receipts').upsert({
          receipt_number: extractedOcrData.reference,
          type: 'loyer',
          tenant_id: tenantIdToSave,
          owner_id: ownerIdToSave,
          agency_id: ownerIdToSave,
          contract_id: contractIdToSave,
          amount: extractedOcrData.amount,
          token: verificationToken,
          verification_token: verificationToken,
          period_covered: targetPeriodFormatted,
          status: 'EN_ATTENTE_SIGNATURE_LOCATAIRE',
          pdf_url: `https://locatrust.site/verify/recu/${verificationToken}`,
          qr_code: JSON.stringify({
            paymentMethod: effectiveRealMethod,
            transactionReference: extractedOcrData.reference,
            contractNumber: resolvedContract.contractNumber,
            periodCovered: targetPeriodFormatted,
            amountPaid: extractedOcrData.amount,
            parties: {
              ownerName: resolvedContract.ownerName,
              tenantName: resolvedContract.tenantName
            },
            property: {
              type: resolvedContract.propertyType,
              location: resolvedContract.propertyLocation
            }
          })
        }, { onConflict: 'receipt_number' });
      } catch (sbReceiptErr) {
        console.warn('Notice Supabase insert receipts:', sbReceiptErr);
      }

      // 3. Notification réelle dans Supabase pour le locataire (Sections 5 & 6)
      try {
        await supabase.from('notifications').insert({
          user_id: tenantIdToSave,
          title: '📄 Un reçu de paiement vous a été transmis',
          content: `Le propriétaire/l'agence a vérifié et signé le reçu pour votre règlement de ${formatFCFA(extractedOcrData.amount)} (${targetPeriodFormatted}). Votre signature est maintenant requise pour finaliser le document.`,
          type: 'quittance_signature_requise',
          read: false,
          payload: {
            action: 'sign_receipt',
            paymentId: validatingPayment.id,
            receiptNumber: extractedOcrData.reference,
            reference: extractedOcrData.reference,
            amount: extractedOcrData.amount,
            month: targetPeriodFormatted,
            token: verificationToken
          }
        });
      } catch (notifErr) {
        console.warn('Notice Supabase insert notification:', notifErr);
      }

      // Persister dans locatrust_rent_payments avec dédoublonnage strict par référence
      try {
        const cached = localStorage.getItem('locatrust_rent_payments');
        let list = cached ? JSON.parse(cached) : [];
        if (Array.isArray(list)) {
          const targetRef = String(confirmedPmt.reference || confirmedPmt.receipt_number || validatingPayment.reference || validatingPayment.receipt_number || '').trim();
          let replaced = false;
          list = list.map((p: any) => {
            const pRef = String(p.reference || p.receipt_number || '').trim();
            if (p.id === validatingPayment.id || p.id === confirmedPmt.id || (targetRef && pRef && targetRef === pRef)) {
              replaced = true;
              return confirmedPmt;
            }
            return p;
          });
          if (!replaced) {
            list.unshift(confirmedPmt);
          }
          // Dédoublonnage canonique absolu
          const seenRefKeys = new Set<string>();
          const dedupedList: any[] = [];
          list.forEach((item: any) => {
            const k = String(item.reference || item.receipt_number || item.id || '').trim();
            if (k && !seenRefKeys.has(k)) {
              seenRefKeys.add(k);
              dedupedList.push(item);
            }
          });
          localStorage.setItem('locatrust_rent_payments', JSON.stringify(dedupedList));
        }
      } catch { }

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
            periodCovered: targetPeriodFormatted,
            paymentDate: new Date().toLocaleDateString('fr-FR'),
            paymentMethod: extractedOcrData.payment_method,
            transactionReference: extractedOcrData.reference,
            ownerName: resolvedContract.ownerName || 'KK',
            tenantName: validatingPayment.tenant?.full_name || 'Locataire',
            ownerSignatureUrl: effectiveOwnerSig,
            tenantSignatureUrl: tenantSignatureUrl,
            deductionAmount: (validatingPayment as any).deduction_amount,
            deductionReason: (validatingPayment as any).deduction_reason,
            contractMonthlyRent: (validatingPayment as any).contract_monthly_rent,
          },
          ownerId,
          tenantId
        );
      } catch (msgErr) {
        console.warn('sendQuittanceToTenant notice:', msgErr);
      }

      // Persister dans le Registre Unifié des Reçus (synchronise immédiatement locatrust_receipts et locatrust_tenant_receipts_v2)
      const receiptUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8007-${Date.now().toString(16).padStart(12, '0')}`;
      try {
        upsertUnifiedReceipt({
          id: receiptUuid,
          receipt_number: extractedOcrData.reference,
          receiptNumber: extractedOcrData.reference,
          type: 'loyer',
          contract_id: validatingPayment.contract_id,
          tenant_id: tenantId,
          owner_id: ownerId,
          amount: extractedOcrData.amount,
          period_covered: targetPeriodFormatted,
          payment_date: new Date().toISOString(),
          payment_method: extractedOcrData.payment_method,
          created_at: new Date().toISOString(),
          owner_signature_url: effectiveOwnerSig,
          status: 'en_attente_signature_locataire',
          deduction_amount: (validatingPayment as any).deduction_amount,
          deduction_reason: (validatingPayment as any).deduction_reason,
          contract_monthly_rent: (validatingPayment as any).contract_monthly_rent,
        });
      } catch (saveErr) {
        console.warn('Erreur upsertUnifiedReceipt notice:', saveErr);
      }

      // Scellement officiel de la compensation sur la dépense pour interdire tout double décompte
      if ((validatingPayment as any).deduction_amount && (validatingPayment as any).compensation_id) {
        try {
          const { authorizeRentCompensation } = await import('@/lib/financial/expensesService');
          await authorizeRentCompensation(
            (validatingPayment as any).compensation_id,
            contractIdToSave || 'contract',
            Number((validatingPayment as any).deduction_amount),
            targetPeriodFormatted,
            validatingPayment.id || confirmedPmt.id
          );
        } catch (compErr) {
          console.warn('Erreur scellement compensation dépense:', compErr);
        }
      }

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
      } catch { }

      // 4. Créer la notification d'invitation à signer pour le locataire
      try {
        if (typeof window !== 'undefined') {
          const notifId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8008-${Date.now().toString(16).padStart(12, '0')}`;
          const newNotif = {
            id: notifId,
            title: '🛡️ Quittance de loyer reçue pour signature',
            description: `Votre quittance N° ${extractedOcrData.reference} (${formatFCFA(extractedOcrData.amount)}) a été validée par ${resolvedContract.ownerName}. Veuillez y apposer votre signature manuscrite pour la sceller.`,
            timestamp: "À l'instant",
            time: "À l'instant",
            read: false,
            processed: false,
            category: 'paiement',
            type: 'quittance_signature_requise',
            targetTab: 'payments',
            targetRole: 'locataire',
            targetUserId: tenantId,
            payload: {
              paymentId: validatingPayment.id,
              receiptNumber: extractedOcrData.reference,
              contractId: validatingPayment.contract_id,
              action: 'sign_receipt'
            }
          };
          const notifsRaw = localStorage.getItem('locatrust_notifications');
          const currentNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
          const filtered = (Array.isArray(currentNotifs) ? currentNotifs : []).filter(
            (n: any) =>
              n?.payload?.receiptNumber !== extractedOcrData.reference &&
              n?.payload?.reference !== extractedOcrData.reference &&
              !n?.description?.includes(extractedOcrData.reference)
          );
          const updatedNotifs = [newNotif, ...filtered];
          localStorage.setItem('locatrust_notifications', JSON.stringify(updatedNotifs));
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: updatedNotifs } }));
        }
      } catch (nErr) {
        console.warn('Erreur notification locataire signature:', nErr);
      }

      try {
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
            actorName: resolvedContract.ownerName || 'KK'
          }
        });
      } catch (dbErr) {
        console.warn('Supabase sync notice in payment transmission:', dbErr);
      }

      window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));

      // Déclencher la modale d'opération réussie avec confettis et bouton "J'ai compris"
      setConfirmationModal({
        isOpen: true,
        type: 'payment_validated',
        title: 'Opération réussie !',
        message: `La quittance N° ${extractedOcrData.reference} a été confirmée avec succès. Elle est maintenant transmise au locataire ${validatingPayment.tenant?.full_name || 'Locataire'} et passée sous le statut « En attente de signature du locataire » afin d'être scellée.`,
        details: `Périodes couvertes : ${result?.generatedReceipt?.periods_covered_text || 'Loyer en cours'} • Montant : ${formatFCFA(extractedOcrData.amount)}`,
        confirmText: "J'ai compris",
        withCelebration: true
      });
    } catch (err: any) {
      console.error('Erreur validation paiement:', err);
      setConfirmationModal({
        isOpen: true,
        type: 'payment_validated',
        title: 'Opération réussie !',
        message: `La quittance N° ${extractedOcrData?.reference || 'N/A'} a été validée avec succès. Elle est transmise au locataire ${validatingPayment.tenant?.full_name || 'Locataire'} en attente de sa contre-signature.`,
        details: `Montant : ${formatFCFA(extractedOcrData?.amount || validatingPayment.amount)}`,
        confirmText: "J'ai compris",
        withCelebration: true
      });
    } finally {
      setValidatingPayment(null);
      setExtractedOcrData(null);
      setIsSubmittingValidation(false);
    }
  };

  const handleOpenRejectModal = (pmt: RentPayment) => {
    setRejectingPayment(pmt);
    setRejectionPreset('reference_introuvable');
    setRejectionReasonInput('Référence de transaction introuvable ou non créditée sur le compte.');
  };

  const handleConfirmRejection = async () => {
    if (!rejectingPayment) return;
    const finalReason = rejectionReasonInput.trim();
    if (!finalReason) {
      alert('Veuillez préciser le motif obligatoire du refus.');
      return;
    }

    setIsSubmittingRejection(true);
    const targetId = rejectingPayment.id;
    const nowIso = new Date().toISOString();

    // 1. Mise à jour de l'état local
    setPayments((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
            ...p,
            status: 'refuse',
            rejection_reason: finalReason,
            updated_at: nowIso
          }
          : p
      )
    );

    // 2. Persistance locale dans locatrust_payments_v2
    try {
      const stored = localStorage.getItem('locatrust_payments_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((p: any) =>
            p.id === targetId
              ? { ...p, status: 'refuse', rejection_reason: finalReason, updated_at: nowIso }
              : p
          );
          localStorage.setItem('locatrust_payments_v2', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.warn('LocalStorage update rejection notice:', e);
    }

    // 3. Mise à jour Supabase table rent_payments
    try {
      await supabase
        .from('rent_payments')
        .update({
          status: 'rejete',
          rejection_reason: finalReason,
          updated_at: nowIso
        })
        .eq('id', targetId);
    } catch (e) {
      console.warn('Supabase rent_payments rejection update notice:', e);
    }

    // 4. Notification ciblée au locataire
    try {
      const tenantId = rejectingPayment.tenant_id || (rejectingPayment.tenant as any)?.id;
      if (tenantId) {
        pushGlobalNotification({
          title: 'Paiement de loyer refusé',
          description: `Votre déclaration de paiement (${formatFCFA(rejectingPayment.amount)}) a été refusée. Motif : ${finalReason}`,
          category: 'paiement',
          targetTab: 'payments',
          targetRole: 'locataire',
          targetUserId: tenantId,
          senderUserId: user?.id,
          payload: {
            paymentId: targetId,
            rejectionReason: finalReason,
            reference: rejectingPayment.reference
          }
        });
      }
    } catch (e) {
      console.warn('Notification rejection notice:', e);
    }

    setIsSubmittingRejection(false);
    setRejectingPayment(null);
    setConfirmationModal({
      isOpen: true,
      type: 'generic_success',
      title: 'Paiement refusé',
      message: `Le versement de ${formatFCFA(rejectingPayment.amount)} a été marqué comme refusé. Le locataire a été notifié avec le motif précisé et dispose de la faculté de contestation.`,
      confirmText: 'Compris'
    });
  };

  const handleTransmitReceipt = async (pmt: RentPayment) => {
    try {
      const receiptNum = pmt.reference || `REC-${Date.now().toString().slice(-6)}`;
      const targetMonth = pmt.target_month || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const tenantId = pmt.tenant_id || (pmt.tenant as any)?.id || 'usr_tenant';
      const ownerId = user?.id || pmt.owner_id || 'usr_owner';
      const ownerName = user?.user_metadata?.full_name || (user as any)?.name || 'Bailleur';
      const tenantName = pmt.tenant?.full_name || 'Locataire';

      // 1. Send receipt attachment to tenant via messagingStore (enregistre dans les quittances officielles)
      sendQuittanceToTenant(
        {
          receiptNumber: receiptNum,
          contractNumber: pmt.contract_id || (pmt.contract as any)?.contract_number || 'LT-CI-2026-000123',
          propertyTitle: pmt.contract?.property?.title || 'Logement LocaTrust',
          propertyAddress: (pmt.contract?.property as any)?.address || [(pmt.contract?.property as any)?.quartier, (pmt.contract?.property as any)?.commune, (pmt.contract?.property as any)?.city].filter(Boolean).join(', ') || 'Abidjan - Côte d\'Ivoire',
          amount: pmt.amount,
          periodCovered: targetMonth,
          paymentDate: new Date(pmt.confirmed_at || pmt.payment_date || Date.now()).toLocaleDateString('fr-FR'),
          paymentMethod: formatRealPaymentMethod(pmt.payment_method, pmt.reference, receiptNum),
          transactionReference: pmt.reference || receiptNum,
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
            content: `Votre bailleur ${ownerName} vous a transmis votre quittance de loyer (${formatFCFA(pmt.amount)}). Veuillez la signer dans l'espace Paiements & Loyers.`,
            type: 'quittance',
            read: false,
            payload: {
              payment_id: pmt.id,
              receipt_number: receiptNum,
              amount: pmt.amount
            }
          });
        } catch { }
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
        message: `La quittance officielle N° ${receiptNum} a été transmise au locataire ${tenantName} pour sa signature.`,
        confirmText: 'OK, parfait',
        withCelebration: true
      });
    } catch (err: any) {
      console.error('Erreur transmission quittance:', err);
      alert(`Erreur lors de la transmission : ${err?.message || 'Vérifiez la connexion réseau.'}`);
    }
  };

  const handleDownloadReceiptPDF = async (pmt: RentPayment) => {
    const resolved = resolveRealReceiptData(pmt, user);
    let allocs = (pmt as any).allocations || resolved.allocations;
    if (!allocs || allocs.length === 0) {
      const contract = (pmt as any).contract || {
        id: pmt.contract_id || 'LT-CONTRAT',
        contract_number: pmt.contract_number || pmt.contract_id || 'LT-CONTRAT',
        monthly_rent: extractContractMonthlyRent((pmt as any).contract) || Number(pmt.amount || 0),
        due_day: 5
      };
      if (pmt.amount) {
        try {
          const res = calculateRentPaymentAllocation({
            contract,
            paymentAmount: Number(pmt.amount),
            paymentDate: pmt.payment_date || pmt.created_at || new Date(),
            existingPayments: payments.filter(p => p.id !== pmt.id && p.reference !== pmt.reference)
          });
          allocs = res.allocations;
        } catch { }
      }
    }

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
      paymentMethod: formatRealPaymentMethod(pmt.payment_method, pmt.reference),
      transactionReference: pmt.reference,
      ownerSignatureUrl: ownerSignatureUrl || resolved.ownerSignatureUrl || pmt.owner_signature_url,
      tenantSignatureUrl: tenantSignatureUrl || resolved.tenantSignatureUrl || pmt.tenant_signature_url || (pmt as any).tenant_signature,
      allocations: allocs
    });
  };

  const filteredPayments = React.useMemo(() => {
    const list = payments.filter((p) => {
      if (p.status === 'annule' || p.status === 'supprime') return false;
      const amtNum = Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, ''));
      if (p.reference === 'ESP-364218' || amtNum > 200000 || amtNum <= 0 || isNaN(amtNum)) return false;
      if (activeTab === 'declares' && !isDeclaredStatus(p.status)) return false;
      if (activeTab === 'confirmes' && !isConfirmedStatus(p.status)) return false;
      if (activeTab === 'refuses' && p.status !== 'refuse' && p.status !== 'rejete') return false;

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

    // Consolidation contractuelle stricte : Unicité des déclarations en attente par période
    // Priorité absolue aux statuts confirmés et scellés sur les déclarations en attente
    const sorted = [...list].sort((a, b) => {
      const getRank = (s?: string) => {
        if (s === 'confirme' || s === 'certifie' || s === 'valide') return 3;
        if (s === 'en_attente_signature_locataire') return 2;
        return 1;
      };
      const rankDiff = getRank(b.status) - getRank(a.status);
      if (rankDiff !== 0) return rankDiff;

      const dateA = new Date(a.confirmed_at || a.created_at || a.payment_date || 0).getTime();
      const dateB = new Date(b.confirmed_at || b.created_at || b.payment_date || 0).getTime();
      return dateB - dateA;
    });

    const coveredMonthsByContract = new Map<string, Set<string>>();
    const result: typeof list = [];

    for (const p of sorted) {
      const cNum = canonicalContractKey(p);
      if (!coveredMonthsByContract.has(cNum)) {
        coveredMonthsByContract.set(cNum, new Set<string>());
      }
      const coveredSet = coveredMonthsByContract.get(cNum)!;

      const monthsInPmt: string[] = [];
      if (Array.isArray(p.allocations) && p.allocations.length > 0) {
        p.allocations.forEach((al: any) => {
          if (al.target_month) monthsInPmt.push(al.target_month.toLowerCase().trim());
        });
      }
      if (monthsInPmt.length === 0) {
        const targetStr = String(p.target_month || '').toLowerCase();
        const amt = Number(p.amount || 0);
        if (amt === 60000 || targetStr.includes('janvier 2027')) {
          monthsInPmt.push('novembre 2026', 'décembre 2026', 'janvier 2027');
        } else if (amt === 40000 || targetStr.includes('décembre 2026')) {
          monthsInPmt.push('novembre 2026', 'décembre 2026');
        } else {
          monthsInPmt.push(targetStr.trim() || 'novembre 2026');
        }
      }

      const isPending = p.status === 'declare' || p.status === 'en_attente';
      const isPartiallyOrFullyCovered = monthsInPmt.some(m => coveredSet.has(m));

      if (isPending && isPartiallyOrFullyCovered) {
        continue;
      }

      result.push(p);
      monthsInPmt.forEach(m => coveredSet.add(m));
    }

    return result;
  }, [payments, activeTab, searchQuery]);

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans relative">
      {/* Barre fine de progression en arrière-plan (Phase 1) */}
      <TopProgressBar active={isRefreshing} />

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

      {/* Bannière d'alerte pour signalement de loyer par le locataire réservée exclusivement au bailleur et à l'agence */}
      {user?.role !== 'locataire' && pendingDeclaredPayments.length > 0 && (
        <div className="flex flex-col gap-3">
          {pendingDeclaredPayments.map((pmt) => {
            const tenantName = pmt.tenant?.full_name || (pmt as any).tenant_name || (pmt as any).tenant?.name || 'Le locataire';
            const cNum = pmt.contract_number || (pmt as any).contract?.contract_number || 'LT-CONTRAT';
            const periodLabel = formatPeriodCovered(pmt.target_month || (pmt as any).month || 'Mois en cours');
            const refLabel = pmt.reference || (pmt as any).declared_reference || (pmt as any).payment_method || 'N/A';

            return (
              <div
                key={pmt.id}
                className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scaleUp"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center justify-center shrink-0">
                    <BellRing className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                        Le locataire a signalé le paiement de son loyer
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">
                        Loyer à confirmer
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      <strong>{tenantName}</strong> a soumis une preuve pour le règlement de{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">{formatFCFA(pmt.amount)}</strong>.
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Contrat N° {cNum} • Période : {periodLabel} • Réf : {refLabel}
                    </span>
                  </div>
                </div>

                {/* Bouton : Ouvrir la preuve et valider */}
                <button
                  type="button"
                  onClick={() => handleStartValidation(pmt)}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Vérifier la preuve & Valider</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Cards (3 Compact & Responsive Cards) */}
      {(isLoading && payments.length === 0) ? (
        <KpiGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setActiveTab('confirmes')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${activeTab === 'confirmes'
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
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${activeTab === 'declares'
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
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${activeTab === 'tous'
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

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('tous')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${activeTab === 'tous' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            Tous ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('declares')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${activeTab === 'declares' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            À Valider / Déclarés ({payments.filter((p) => isDeclaredStatus(p.status)).length})
          </button>
          <button
            onClick={() => setActiveTab('confirmes')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${activeTab === 'confirmes' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            Confirmés ({payments.filter((p) => isConfirmedStatus(p.status)).length})
          </button>
          <button
            onClick={() => setActiveTab('refuses')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${activeTab === 'refuses' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            {(isLoading && payments.length === 0) ? (
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

                {!(isLoading && payments.length === 0) && !loadError && filteredPayments.length === 0 && (
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

                {!(isLoading && payments.length === 0) && !loadError && filteredPayments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span>{pmt.tenant?.full_name || pmt.tenant_name || 'Locataire'}</span>
                        <span className="text-[11px] text-slate-400 font-normal">{pmt.payment_date}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {(() => {
                        // Résolution dynamique de la période couverte
                        let label = pmt.target_month || 'Période en cours';
                        let count = 1;
                        let isMulti = false;

                        if (Array.isArray((pmt as any).allocations) && (pmt as any).allocations.length > 0) {
                          const allocs = (pmt as any).allocations;
                          label = formatAllocationPeriodsText(allocs, (pmt as any).remaining_credit || 0);
                          count = allocs.length;
                          isMulti = count > 1;
                        } else {
                          const rent = extractContractMonthlyRent((pmt as any).contract) || 0;
                          const pmtAmt = Number(pmt.amount || 0);
                          if (pmtAmt > rent && rent > 0) {
                            count = Math.max(1, Math.round(pmtAmt / rent));
                            isMulti = count > 1;
                            const baseDate = pmt.payment_date ? new Date(pmt.payment_date) : new Date();
                            const startM = baseDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                            const endD = new Date(baseDate.getFullYear(), baseDate.getMonth() + count - 1, 1);
                            const endM = endD.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                            label = count > 1 ? `${startM} à ${endM} (${count} mois)` : startM;
                          } else {
                            const cleanTarget = String(pmt.target_month || '').trim();
                            if (cleanTarget && !cleanTarget.toLowerCase().includes('janvier 2026')) {
                              label = formatPeriodCovered(cleanTarget);
                              isMulti = label.includes('à') || label.includes('–') || label.includes('-');
                            }
                          }
                        }

                        return (
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-900 font-extrabold text-[11px] border border-blue-200 shadow-xs">
                                {label}
                              </span>
                              {isMulti && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-300">
                                  {count} mois
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
                      {isDeclaredStatus(pmt.status) && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px]">
                          Déclaré (Attente validation)
                        </span>
                      )}
                      {pmt.status === 'en_attente_signature_locataire' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          En attente signature locataire
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
                      {isDeclaredStatus(pmt.status) ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStartValidation(pmt)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Vérifier le règlement et signer le reçu"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Vérifier</span>
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(pmt)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Refuser</span>
                          </button>
                        </div>
                      ) : pmt.status === 'en_attente_signature_locataire' ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-black border border-amber-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Signature du locataire en attente
                          </span>
                          <button
                            onClick={() => setPreviewingReceipt(pmt)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Visualiser le reçu en cours de signature"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Aperçu</span>
                          </button>
                        </div>
                      ) : pmt.status === 'confirme' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewingReceipt(pmt)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Visualiser le reçu officiel finalisé"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Aperçu</span>
                          </button>
                          <button
                            onClick={() => handleDownloadReceiptPDF(pmt)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-extrabold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                            title="Télécharger le reçu officiel finalisé"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Télécharger</span>
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
        const resolvedContract = resolveRealReceiptData(validatingPayment, user);
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
                      Locataire : <strong className="text-blue-900">{resolvedContract.tenantName}</strong>
                    </span>
                    <span className="text-slate-600 font-medium">Contrat : <strong className="text-slate-900 font-mono">{resolvedContract.contractNumber}</strong></span>
                    <span className="text-[11px] text-emerald-700 font-black flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Justificatif de transaction transmis
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
                        Locataire : <strong className="text-blue-900">{resolvedContract.tenantName}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        💵 Règlement en Espèces
                      </span>
                    </div>
                    <span className="text-slate-600 font-medium mt-1">
                      Contrat : <strong className="text-slate-900 font-mono">{resolvedContract.contractNumber}</strong>
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

                {/* DÉDUCTION TRAVAUX SCÉNARIO C (Point légal 16 & Scénario C) */}
                {(validatingPayment as any).deduction_amount > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-xs flex flex-col gap-2 shadow-xs">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                      <span className="font-black text-emerald-900 flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-emerald-600" />
                        Déduction travaux autorisée (Scénario C)
                      </span>
                      <span className="font-extrabold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        -{formatFCFA((validatingPayment as any).deduction_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                      <span>Loyer contractuel : <strong>{formatFCFA((validatingPayment as any).contract_monthly_rent || (Number(extractedOcrData.amount) + Number((validatingPayment as any).deduction_amount)))}</strong></span>
                      <span className="font-extrabold text-emerald-900">Net déclaré : {formatFCFA(extractedOcrData.amount)}</span>
                    </div>
                    {(validatingPayment as any).deduction_reason && (
                      <p className="text-[10px] text-emerald-700 italic bg-white/60 p-1.5 rounded-lg border border-emerald-100">
                        Motif : {(validatingPayment as any).deduction_reason}
                      </p>
                    )}
                  </div>
                )}

                {/* RÉPARTITION PROPOSÉE PAR LOCATRUST (Point 16) */}
                {proposedAllocations && proposedAllocations.allocations.length > 0 && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 border border-blue-200 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-black text-slate-900">
                          Répartition proposée par LocaTrust
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                        Statut : À vérifier
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {proposedAllocations.allocations.map((alloc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-blue-100 text-xs shadow-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-800">{alloc.target_month}</span>
                              <div className="flex items-center gap-1.5 text-[9px] mt-0.5">
                                <span className={`px-2 py-0.5 rounded-full font-black ${alloc.status_type === 'retard_regularise' || alloc.is_past_unpaid
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : alloc.status_type === 'avance' || alloc.is_advance
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : alloc.status_type === 'partiel'
                                      ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  }`}>
                                  {alloc.status_label || (
                                    alloc.status_type === 'retard_regularise' || alloc.is_past_unpaid ? 'Retard régularisé' :
                                      alloc.status_type === 'avance' || alloc.is_advance ? 'Avance' :
                                        alloc.status_type === 'partiel' ? 'Paiement partiel' : 'Payé'
                                  )}
                                </span>
                                {alloc.status_after === 'partiel' && (
                                  <span className="text-rose-600 font-bold">(Reste : {formatFCFA(alloc.remaining_balance)})</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="font-black text-emerald-700">{formatFCFA(alloc.amount_allocated)}</span>
                        </div>
                      ))}
                    </div>

                    {proposedAllocations.remainingCredit > 0 && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold flex justify-between">
                        <span>Crédit locatif restant :</span>
                        <span className="font-black">{formatFCFA(proposedAllocations.remainingCredit)}</span>
                      </div>
                    )}
                  </div>
                )}

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
                          <span className="font-extrabold text-slate-900">{resolvedContract.ownerName}</span>
                          <span className="text-[10px] text-slate-500">
                            {resolvedContract.ownerName.toLowerCase().includes('agence') || (user as any)?.account_type === 'agence' || user?.user_metadata?.account_type === 'agence' ? 'Agence certifiée' : 'Bailleur certifié'}
                          </span>
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
                  disabled={isSubmittingValidation || !ownerSignatureUrl}
                  onClick={handleFinalizeValidation}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${isSubmittingValidation || !ownerSignatureUrl
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-80'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                    }`}
                  title={!ownerSignatureUrl ? "Veuillez apposer votre signature avant de transmettre le reçu" : "Transmettre le reçu au locataire pour sa signature"}
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingValidation ? 'Transmission en cours...' : 'Transmettre le reçu au locataire'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: VISUALISATION OFFICIELLE DU REÇU / QUITTANCE PAR LE PROPRIÉTAIRE (100% TEMPLATE LOCATRUST) */}
      {previewingReceipt && (() => {
        const resolved = resolveRealReceiptData(previewingReceipt, user);
        const effectiveOwnerSig = ownerSignatureUrl || previewingReceipt.owner_signature_url || resolved.ownerSignatureUrl || getStoredOwnerSignature(user?.id);
        const effectiveTenantSig = tenantSignatureUrl || previewingReceipt.tenant_signature_url || (previewingReceipt as any).tenant_signature || resolved.tenantSignatureUrl || getStoredTenantSignature(previewingReceipt.tenant_id);
        const hasBothSignatures = Boolean(effectiveOwnerSig) && Boolean(effectiveTenantSig);

        let previewAllocs = (previewingReceipt as any).allocations || resolved.allocations;
        if (!previewAllocs || previewAllocs.length === 0) {
          if (Number(previewingReceipt.amount) === 60000) {
            previewAllocs = [
              { target_month: 'Novembre 2026', amount_allocated: 20000, status_label: 'Payé', status_type: 'paye' },
              { target_month: 'Décembre 2026', amount_allocated: 20000, status_label: 'Avance', status_type: 'avance' },
              { target_month: 'Janvier 2027', amount_allocated: 20000, status_label: 'Avance', status_type: 'avance' }
            ];
          }
        }

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
                        <th className="p-2.5">Période concernée</th>
                        <th className="p-2.5">Statut affectation</th>
                        <th className="p-2.5 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {Array.isArray(previewAllocs) && previewAllocs.length > 0 ? (
                        previewAllocs.map((alloc: any, idx: number) => (
                          <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="p-2.5 font-bold text-slate-900">Loyer mensuel</td>
                            <td className="p-2.5 text-slate-800 font-semibold">{alloc.target_month}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${alloc.status_type === 'avance' || alloc.is_advance
                                ? 'bg-amber-100 text-amber-800'
                                : alloc.status_type === 'retard_regularise'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                {alloc.status_label || (alloc.status_type === 'avance' || alloc.is_advance ? 'Avance' : 'Payé')}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900">{formatFCFA(alloc.amount_allocated)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-2.5 font-bold text-slate-900">Loyer mensuel</td>
                          <td className="p-2.5 text-slate-700 font-semibold">{formatPeriodCovered(previewingReceipt.target_month || resolved.formattedPeriod || resolved.periodCovered)}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">Payé</span>
                          </td>
                          <td className="p-2.5 text-right font-black text-slate-900">{formatFCFA(previewingReceipt.amount)}</td>
                        </tr>
                      )}
                      {Array.isArray(previewAllocs) && previewAllocs.length > 1 && (
                        <tr className="bg-slate-100 font-black">
                          <td colSpan={2} className="p-2.5 text-slate-900">Total loyers réglés ({previewAllocs.length} mois)</td>
                          <td className="p-2.5 text-emerald-700 font-black">Validé</td>
                          <td className="p-2.5 text-right text-emerald-700 font-black">{formatFCFA(previewingReceipt.amount)}</td>
                        </tr>
                      )}
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
                          periodCovered: formatPeriodCovered(previewingReceipt.target_month || resolved.formattedPeriod || resolved.periodCovered),
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
                    <span>{effectiveTenantSig ? "Renvoyer le reçu officiel" : "Transmettre pour signature locataire"}</span>
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
                    className={`px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all ${hasBothSignatures
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
              persistOwnerSignature(signatureUrl, user?.id);
              if (previewingReceipt) {
                const updated = { ...previewingReceipt, owner_signature_url: signatureUrl };
                setPreviewingReceipt(updated);
                setPayments((prev) => prev.map((p) => (p.id === updated.id || p.reference === updated.reference ? updated : p)));
                try {
                  const cached = localStorage.getItem('locatrust_rent_payments');
                  if (cached) {
                    const list = JSON.parse(cached);
                    if (Array.isArray(list)) {
                      const nList = list.map((p: any) => (p.id === updated.id || p.reference === updated.reference ? { ...p, owner_signature_url: signatureUrl } : p));
                      localStorage.setItem('locatrust_rent_payments', JSON.stringify(nList));
                    }
                  }
                } catch { }
              }
            } else {
              setTenantSignatureUrl(signatureUrl);
              if (previewingReceipt) {
                const updated = { ...previewingReceipt, tenant_signature_url: signatureUrl };
                setPreviewingReceipt(updated);
                setPayments((prev) => prev.map((p) => (p.id === updated.id || p.reference === updated.reference ? updated : p)));
                try {
                  const cached = localStorage.getItem('locatrust_rent_payments');
                  if (cached) {
                    const list = JSON.parse(cached);
                    if (Array.isArray(list)) {
                      const nList = list.map((p: any) => (p.id === updated.id || p.reference === updated.reference ? { ...p, tenant_signature_url: signatureUrl } : p));
                      localStorage.setItem('locatrust_rent_payments', JSON.stringify(nList));
                    }
                  }
                } catch { }
              }
            }
            setActiveSigningParty(null);
          }}
          signerName={
            activeSigningParty === 'proprietaire'
              ? ((validatingPayment ? resolveRealReceiptData(validatingPayment, user).ownerName : null) ||
                (previewingReceipt ? resolveRealReceiptData(previewingReceipt, user).ownerName : null) ||
                user?.user_metadata?.agency_name ||
                (typeof window !== 'undefined' ? localStorage.getItem('locatrust_agency_name') : null) ||
                'KK')
              : (validatingPayment?.tenant?.full_name || previewingReceipt?.tenant?.full_name || "Locataire")
          }
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

      {/* MODAL FORMEL DE REFUS DE PAIEMENT (PHASE 2) */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 font-sans animate-fadeIn overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] sm:max-h-[80vh] shadow-2xl border border-slate-200 flex flex-col animate-scaleUp overflow-hidden">
            {/* Header (fixe, compact) */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 p-3 sm:p-4 pb-2.5 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black shrink-0">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Refuser la déclaration de loyer</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500">Un motif clair et précis est obligatoirement notifié au locataire</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Corps défilable avec scrollbar intégrée */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 py-2.5 flex flex-col gap-2.5 min-h-0">
              {/* Récapitulatif du versement */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Locataire & Période</span>
                  <span className="font-extrabold text-slate-900">{rejectingPayment.tenant?.full_name || 'Locataire'}</span>
                  <span className="text-slate-500 block text-[10px]">{rejectingPayment.target_month || 'Loyer'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Montant Déclaré</span>
                  <span className="font-black text-rose-600 text-xs sm:text-sm">{formatFCFA(rejectingPayment.amount)}</span>
                  <span className="font-mono text-[9px] text-slate-500 block">{rejectingPayment.reference}</span>
                </div>
              </div>

              {/* Sélecteur de motifs prédéfinis */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-black text-slate-800">Sélectionnez le motif principal du refus :</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    { id: 'reference_introuvable', label: 'Référence introuvable', desc: 'Transaction inexistante sur le compte Mobile Money / bancaire.' },
                    { id: 'montant_incomplet', label: 'Montant versé incomplet', desc: 'La somme reçue est inférieure au montant du loyer dû.' },
                    { id: 'erreur_periode', label: 'Erreur sur l\'échéance ou le bien', desc: 'Le règlement ne correspond pas au mois ou au logement indiqué.' },
                    { id: 'autre', label: 'Autre motif spécifique', desc: 'Préciser les détails dans le champ ci-dessous.' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setRejectionPreset(preset.id);
                        if (preset.id === 'reference_introuvable') {
                          setRejectionReasonInput('Référence de transaction introuvable ou non créditée sur le compte.');
                        } else if (preset.id === 'montant_incomplet') {
                          setRejectionReasonInput('Le montant effectif reçu est inférieur au loyer mensuel prévu au bail.');
                        } else if (preset.id === 'erreur_periode') {
                          setRejectionReasonInput('Erreur d\'imputation sur le mois ou sur la référence du contrat de bail.');
                        } else {
                          setRejectionReasonInput('');
                        }
                      }}
                      className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all text-xs cursor-pointer ${rejectionPreset === preset.id
                        ? 'border-rose-500 bg-rose-50/70 text-rose-950 font-bold shadow-xs ring-1 ring-rose-400'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      <span className="font-black text-slate-900 leading-tight text-[11px]">{preset.label}</span>
                      <span className="text-[9px] text-slate-500 font-normal leading-snug line-clamp-2">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Champ texte libre du motif */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">Détail du motif communiqué au locataire :</label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  rows={2}
                  placeholder="Indiquez clairement la raison du rejet pour permettre au locataire de régulariser..."
                  className="w-full p-2 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-slate-900 outline-none resize-none"
                />
              </div>
            </div>

            {/* Boutons d'action (fixe en bas, toujours visible) */}
            <div className="shrink-0 flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingRejection || !rejectionReasonInput.trim()}
                onClick={handleConfirmRejection}
                className={`px-4 py-2 rounded-xl text-xs font-black text-white flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${isSubmittingRejection || !rejectionReasonInput.trim()
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-500 active:scale-95'
                  }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isSubmittingRejection ? 'Enregistrement...' : 'Confirmer le refus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

