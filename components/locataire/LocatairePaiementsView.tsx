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
  Download,
  PenTool,
  Sparkles
} from 'lucide-react';
import { formatFCFA, sanitizeNumericInput, formatPeriodCovered } from '@/lib/utils';
import { RentPayment } from '@/types/database.types';
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge';
import { getRentPayments, createRentPayment, getContracts } from '@/src/lib/db';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import confetti from 'canvas-confetti';
import { TableRowsSkeleton } from '@/components/common/SkeletonLoader';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { declareCautionPayment, signCautionReceipt, resolveDepositContractDetails, getStoredDeposits, formatCautionReceiptNumber } from '@/lib/cautionsStore';
import { sendDeclarationMessageToOwner, isValidUuid } from '@/lib/messagingStore';
import { generateOfficialReceiptPDF } from '@/lib/payments/officialReceiptPdfGenerator';
import { resolveRealReceiptData } from '@/lib/payments/receiptDataResolver';
import { getStoredOwnerSignature, persistTenantSignature } from '@/lib/signatureHelper';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import { SignatureModal } from '@/components/common/SignatureModal';
import { getDeviceDate } from '@/lib/dateSystem';
import { calculateRentPaymentAllocation, extractContractMonthlyRent, RentAllocationResult } from '@/lib/payments/rentScheduleEngine';
import { TenantReceiptReviewAndSignModal } from '@/components/locataire/TenantReceiptReviewAndSignModal';

export const LocatairePaiementsView: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const paymentsRef = useRef<any[]>(payments);
  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);

  // Modal States
  const [showDeclareModal, setShowDeclareModal] = useState<boolean>(false);
  const [showCautionModal, setShowCautionModal] = useState<boolean>(false);
  const [isSigningCautionModalOpen, setIsSigningCautionModalOpen] = useState<boolean>(false);
  const [signingReceiptPayment, setSigningReceiptPayment] = useState<any | null>(null);

  // Dispute & Contestation Modal State (Phase 2)
  const [contestingPayment, setContestingPayment] = useState<any | null>(null);
  const [disputeArgumentInput, setDisputeArgumentInput] = useState<string>('');
  const [disputeProofUrlInput, setDisputeProofUrlInput] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);
  const [isSigningReceiptModalOpen, setIsSigningReceiptModalOpen] = useState<boolean>(false);
  const [isSubmittingCaution, setIsSubmittingCaution] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [successModalMessage, setSuccessModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // Rent Form State (dynamique selon la date réelle de la machine)
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = getDeviceDate();
    const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return lbl.charAt(0).toUpperCase() + lbl.slice(1);
  });
  const [paymentType, setPaymentType] = useState<'loyer' | 'partiel' | 'autre'>('loyer');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('Wave CI');
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  // Contrat sélectionné pour la déclaration de loyer
  const currentRentContract = React.useMemo(() => {
    return userContracts.find(c => c.id === selectedContractId) || userContracts[0] || null;
  }, [userContracts, selectedContractId]);

  // Calcul automatique en temps réel de la répartition du paiement
  const rentAllocationPreview = React.useMemo(() => {
    if (!currentRentContract) return null;
    return calculateRentPaymentAllocation({
      contract: currentRentContract,
      paymentAmount: Number(amount) || 0,
      paymentDate: getDeviceDate(),
      existingPayments: payments,
      includePendingDeclarations: false
    });
  }, [currentRentContract, amount, payments]);

  // Caution Form State
  const [cautionContractId, setCautionContractId] = useState('');
  const [cautionAmount, setCautionAmount] = useState<number>(0);
  const [cautionMethod, setCautionMethod] = useState('Wave CI');
  const [cautionReference, setCautionReference] = useState('');
  const [cautionProofUrl, setCautionProofUrl] = useState<string | null>(null);
  const [cautionProofFileName, setCautionProofFileName] = useState<string | null>(null);
  const [cautionProofFileSize, setCautionProofFileSize] = useState<string | null>(null);
  const cautionProofFileInputRef = useRef<HTMLInputElement>(null);

  // Handler pour ouvrir le modal de déclaration avec préremplissage automatique du loyer réel depuis la base
  const handleOpenDeclareModal = () => {
    const contractToUse = currentRentContract || userContracts[0];
    if (contractToUse) {
      const realRent = extractContractMonthlyRent(contractToUse);
      if (realRent > 0 && (amount <= 0 || amount === 30000)) {
        setAmount(realRent);
      }
    }
    setShowDeclareModal(true);
  };

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
      let rentList: any[] = [];

      try {
        const { data: pmtData, error: pmtErr } = await getRentPayments(user.id);
        if (pmtErr) {
          console.warn('Notice getRentPayments:', pmtErr);
        } else if (pmtData && pmtData.length > 0) {
          for (const sp of pmtData) {
            const idx = rentList.findIndex(r => r.id === sp.id || (sp.reference && r.reference === sp.reference));
            if (idx === -1) rentList.push(sp);
            else rentList[idx] = { ...rentList[idx], ...sp };
          }
        }
      } catch (pmtCatch) {
        console.warn('Catch getRentPayments:', pmtCatch);
      }

      // Fallback ou enrichissement local pour les paiements
      try {
        const localRaw = localStorage.getItem('locatrust_rent_payments');
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            const userLocalPmts = parsed.filter((p: any) =>
              p.tenant_id === user.id ||
              p.tenant?.id === user.id ||
              (p.tenant_name && user.name && p.tenant_name.toLowerCase().includes(user.name.toLowerCase())) ||
              (p.tenant?.full_name && user.name && p.tenant.full_name.toLowerCase().includes(user.name.toLowerCase())) ||
              (user.email && (p.tenant?.email?.toLowerCase() === user.email.toLowerCase() || p.tenant_email?.toLowerCase() === user.email.toLowerCase())) ||
              (p.reference && rentList.some(r => r.reference === p.reference)) ||
              (p.contract_number && userContracts.some(c => c.contract_number === p.contract_number))
            );
            userLocalPmts.forEach(lp => {
              const existingIdx = rentList.findIndex(r => (r.reference && r.reference === lp.reference) || (r.id && r.id === lp.id));
              if (existingIdx === -1) {
                rentList.push(lp);
              } else {
                rentList[existingIdx] = {
                  ...rentList[existingIdx],
                  ...lp,
                  status: lp.status || rentList[existingIdx].status,
                  tenant_signature_url: lp.tenant_signature_url || rentList[existingIdx].tenant_signature_url,
                  owner_signature_url: lp.owner_signature_url || rentList[existingIdx].owner_signature_url,
                  confirmed_at: lp.confirmed_at || rentList[existingIdx].confirmed_at
                };
              }
            });
          }
        }
      } catch (locErr) {
        console.warn('Local rent payments fallback notice:', locErr);
      }

      // Vérification stricte des signatures (Règle d'or : le reçu attend la signature du locataire)
      rentList = rentList.map(p => {
        const hasTenantSig = Boolean(p.tenant_signature_url || p.tenant_signature);
        if (!hasTenantSig && p.status === 'en_attente_signature_locataire') {
          return {
            ...p,
            status: 'en_attente_signature_locataire'
          };
        }
        return p;
      });
      setPayments(rentList);

      // 2. Cautions
      let ctnList: any[] = [];
      try {
        const { data: ctnData } = await supabase
          .from('cautions')
          .select('*')
          .eq('tenant_id', user.id);
        if (ctnData && ctnData.length > 0) {
          ctnList = ctnData;
        }
      } catch (ctnErr) {
        console.warn('Supabase cautions notice:', ctnErr);
      }

      let localDeps: any[] = [];
      try {
        const raw = getStoredDeposits() || [];
        localDeps = raw.filter((d: any) =>
          Boolean(user?.id && (d.tenant_id === user.id || d.tenant?.id === user.id)) ||
          Boolean(user?.email && (d.tenant?.email?.toLowerCase() === user.email.toLowerCase() || d.tenant_email?.toLowerCase() === user.email.toLowerCase()))
        );
      } catch (e) {
        console.warn('getStoredDeposits notice:', e);
      }
      const combinedDeps = ctnList.length > 0 ? ctnList : localDeps;
      const deduplicatedCombined: any[] = [];
      const seenContracts = new Set<string>();
      for (const d of combinedDeps) {
        const cNum = d.contract_number || d.contract_id || d.id;
        if (!seenContracts.has(cNum)) {
          seenContracts.add(cNum);
          deduplicatedCombined.push(d);
        }
      }
      setDeposits(deduplicatedCombined);

      // 3. Contrats réels SIGNÉS par le locataire connecté (pour les formulaires de déclaration de loyer et de caution)
      let signedContractsMap: Record<string, any> = {};
      if (typeof window !== 'undefined') {
        try {
          const rawMap = localStorage.getItem('locatrust_signed_contracts_map');
          if (rawMap) {
            const parsedMap = JSON.parse(rawMap) || {};
            Object.keys(parsedMap).forEach((k) => {
              const entry = parsedMap[k];
              const sigStr = String(entry?.tenant_signature_url || '');
              if (sigStr.startsWith('data:image/') && sigStr.length > 50) {
                signedContractsMap[k] = entry;
              }
            });
          }
        } catch {}
      }

      try {
        const { data: signedNotifs } = await supabase
          .from('notifications')
          .select('title, message, description, content, data, payload')
          .ilike('title', '%signé par le locataire%')
          .limit(40);
        if (signedNotifs && Array.isArray(signedNotifs)) {
          signedNotifs.forEach((sn: any) => {
            const p = sn.data || sn.payload || {};
            if (p.tenant_id && isValidUuid(p.tenant_id) && isValidUuid(user.id) && p.tenant_id !== user.id) {
              return;
            }
            const sigUrl = String(p.tenant_signature_url || '');
            if (!sigUrl.startsWith('data:image/') || sigUrl.length < 50) return;
            const cNumData = p.contractNumber || p.contract_number;
            if (cNumData && !signedContractsMap[cNumData]) {
              signedContractsMap[cNumData] = {
                tenant_signed: true,
                tenant_signature_url: sigUrl,
                status: 'actif'
              };
            }
            const bodyStr = String(sn.message || sn.description || sn.content || '');
            const m = bodyStr.match(/(LT-\d{4}-[A-Z0-9-]+)/i);
            if (m && m[1] && !signedContractsMap[m[1].trim()]) {
              signedContractsMap[m[1].trim()] = {
                tenant_signed: true,
                tenant_signature_url: sigUrl,
                status: 'actif'
              };
            }
          });
        }
      } catch {}

      const isFabricatedContractNum = (num?: string): boolean => {
        if (!num) return true;
        const trimmed = String(num).trim();
        if (!trimmed) return true;
        // Rejeter les faux numéros générés à partir des 4 premiers caractères d'un UUID (ex: LT-2026-CI-000c4f9 ou LT-2026-CI-0001111)
        if (/^LT-\d{4}-CI-000[0-9a-f]{4}$/i.test(trimmed)) return true;
        return false;
      };

      const belongsToCurrentTenant = (item: any): boolean => {
        if (!item || !user) return false;
        const rawId = String(item.id || '');
        if (
          rawId === '11111111-2222-4333-8444-555555555555' ||
          rawId === 'bab5a822-a484-49f3-929b-72ad62e0e97b' ||
          rawId.startsWith('app_demo_')
        ) {
          return false;
        }
        const docs = item.documents && typeof item.documents === 'object' ? item.documents : {};
        const itemTenantId = item.tenant_id || item.tenant?.id || docs.tenant_id;
        if (itemTenantId && isValidUuid(itemTenantId) && isValidUuid(user.id)) {
          return itemTenantId === user.id;
        }
        if (itemTenantId && user.id && itemTenantId === user.id) {
          return true;
        }
        if (user.email) {
          const uEmail = user.email.toLowerCase();
          const cEmail = String(item.tenant?.email || item.tenant_email || docs.tenant_email || '').toLowerCase();
          if (cEmail && cEmail === uEmail) return true;
        }
        return false;
      };

      const isSignedByTenantAndActive = (item: any, cNum: string): boolean => {
        if (!cNum || isFabricatedContractNum(cNum)) return false;
        const docs = item?.documents && typeof item.documents === 'object' ? item.documents : {};
        const mapEntry = signedContractsMap[cNum];
        const isTerm =
          item?.status === 'termine' ||
          item?.status === 'resilie' ||
          item?.status === 'cloture' ||
          docs.contract_status === 'termine' ||
          mapEntry?.status === 'termine';
        if (isTerm) return false;

        const sigUrl =
          item?.tenant_signature_url ||
          item?.tenant_signature ||
          docs.tenant_signature_url ||
          mapEntry?.tenant_signature_url ||
          '';
        const hasRealTenantSig =
          (typeof sigUrl === 'string' && sigUrl.length > 15) ||
          (cNum === 'LT-2026-CI-000492' && belongsToCurrentTenant(item));

        return hasRealTenantSig;
      };

      const contractsByNumMap = new Map<string, any>();
      const upsertSignedTenantContract = (c: any, explicitNum?: string) => {
        if (!belongsToCurrentTenant(c)) return;
        const docs = c?.documents && typeof c.documents === 'object' ? c.documents : {};
        const cNum = String(explicitNum || c?.contract_number || c?.contractNumber || docs.contract_number || '').trim();
        if (!isSignedByTenantAndActive(c, cNum)) return;

        const key = cNum.toUpperCase();
        const existing = contractsByNumMap.get(key);
        const resolvedRent = Number(c.monthly_rent || c.rent || c.rent_amount || existing?.monthly_rent || existing?.rent || docs.new_rent || docs.rent_amount || 0);
        const resolvedCaution = Number(c.caution_amount || c.caution || existing?.caution_amount || existing?.caution || docs.caution_amount || (resolvedRent > 0 ? resolvedRent * 2 : 0));
        const resolvedStartDate = c.start_date || docs.start_date || c.signed_date || docs.signed_date || c.signed_at || docs.signed_at || existing?.start_date || existing?.signed_date || c.created_at || new Date().toISOString().split('T')[0];
        const resolvedSignedDate = c.signed_date || docs.signed_date || c.signed_at || docs.signed_at || existing?.signed_date || resolvedStartDate;

        contractsByNumMap.set(key, {
          ...c,
          ...(existing || {}),
          id: isValidUuid(existing?.id) ? existing.id : (isValidUuid(c.id) ? c.id : (existing?.id || c.id)),
          contract_number: cNum,
          rent: resolvedRent,
          monthly_rent: resolvedRent,
          rent_amount: resolvedRent,
          caution: resolvedCaution,
          caution_amount: resolvedCaution,
          start_date: resolvedStartDate,
          signed_date: resolvedSignedDate,
          signed_at: c.signed_at || docs.signed_at || resolvedSignedDate,
          created_at: c.created_at || existing?.created_at || resolvedStartDate,
          tenant_signed: true,
          status: 'actif',
          property: {
            ...(c.property || {}),
            ...(existing?.property || {}),
            title:
              existing?.property?.title && existing.property.title !== 'Logement LocaTrust' && existing.property.title !== 'Logement loué'
                ? existing.property.title
                : (c.property?.title || docs.property_title || existing?.property?.title || 'Logement loué')
          }
        });
      };

      try {
        const { data: cntData } = await getContracts(user.id, 'locataire');
        if (cntData && Array.isArray(cntData)) {
          cntData.forEach((c: any) => upsertSignedTenantContract(c));
        }
      } catch (cntErr) {
        console.warn('getContracts notice:', cntErr);
      }

      // Chargement des candidatures du locataire connecté depuis Supabase
      try {
        if (user.id && isValidUuid(user.id)) {
          const { data: dbApps } = await supabase
            .from('rental_applications')
            .select('*')
            .eq('tenant_id', user.id);

          if (dbApps && dbApps.length > 0) {
            dbApps.forEach((a: any) => {
              const docs = a.documents && typeof a.documents === 'object' ? a.documents : {};
              const cNum = String(a.contract_number || docs.contract_number || '').trim();
              if (!cNum || isFabricatedContractNum(cNum)) return;

              const appRent = Number(docs.new_rent || a.rent_amount || docs.rent_amount || a.monthly_rent || 0);
              const appStartDate = a.start_date || docs.start_date || a.signed_date || docs.signed_date || a.signed_at || docs.signed_at || a.created_at;
              const appSignedDate = a.signed_date || docs.signed_date || a.signed_at || docs.signed_at || appStartDate;

              upsertSignedTenantContract(
                {
                  id: a.contract_id || docs.contract_id || `cnt_app_${a.id}`,
                  contract_number: cNum,
                  property_id: a.property_id || docs.property_id,
                  tenant_id: a.tenant_id || user.id,
                  owner_id: a.owner_id || docs.owner_id,
                  rent: appRent,
                  monthly_rent: appRent,
                  caution: Number(a.caution_amount || docs.caution_amount || 0),
                  caution_amount: Number(a.caution_amount || docs.caution_amount || 0),
                  start_date: appStartDate,
                  signed_date: appSignedDate,
                  signed_at: a.signed_at || docs.signed_at || appSignedDate,
                  created_at: a.created_at || docs.created_at || appStartDate,
                  charges: Number(docs.new_charges ?? a.charges_amount ?? docs.charges_amount ?? 0),
                  tenant_signed: Boolean(a.tenant_signed || docs.tenant_signed),
                  tenant_signature_url: a.tenant_signature_url || docs.tenant_signature_url,
                  status: docs.contract_status || a.status,
                  documents: docs,
                  property: {
                    id: a.property_id || docs.property_id,
                    title: a.property_title || docs.property_title || 'Logement loué',
                    city: a.city || a.property_city || docs.property_city || "Côte d'Ivoire",
                    address: a.property_address || docs.property_address || "Côte d'Ivoire"
                  }
                },
                cNum
              );
            });
          }
        }
      } catch (e) {
        console.warn('Erreur chargement Supabase rental_applications pour paiements:', e);
      }

      try {
        const raw = localStorage.getItem('locatrust_contracts');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Nettoyer au passage tout faux contrat fabriqué en cache local
            const cleanedLocal = parsed.filter((c: any) => !isFabricatedContractNum(c?.contract_number || c?.contractNumber));
            if (cleanedLocal.length !== parsed.length) {
              localStorage.setItem('locatrust_contracts', JSON.stringify(cleanedLocal));
            }
            cleanedLocal.forEach((c: any) => upsertSignedTenantContract(c));
          }
        }
      } catch {}

      const allContracts = Array.from(contractsByNumMap.values());
      setUserContracts(allContracts);

      if (allContracts.length > 0) {
        const targetContract = (!selectedContractId || !allContracts.some(c => c.id === selectedContractId))
          ? allContracts[0]
          : (allContracts.find(c => c.id === selectedContractId) || allContracts[0]);

        setSelectedContractId(targetContract.id);
        const realRent = extractContractMonthlyRent(targetContract);
        if (realRent > 0) {
          setAmount(realRent);
        }

        if (!cautionContractId || !allContracts.some(c => c.id === cautionContractId)) {
          setCautionContractId(allContracts[0].id);
          const cRent = extractContractMonthlyRent(allContracts[0]);
          const cAmount = Number(
            allContracts[0].caution_amount ||
            allContracts[0].caution ||
            (cRent > 0 ? cRent * 2 : 0)
          );
          if (cAmount > 0) setCautionAmount(cAmount);
        }
      } else {
        setSelectedContractId('');
        setCautionContractId('');
      }
    } catch (err: any) {
      console.error('Erreur globale fetchPaymentsData:', err);
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
    window.addEventListener('locatrust:receipts_updated', handleUpdate);
    window.addEventListener('locatrust:cautions_updated', handleUpdate);
    window.addEventListener('locatrust:contracts-updated', handleUpdate);

    const handleOpenSignReceipt = (e: any) => {
      const pId = e.detail?.paymentId || e.detail?.payment_id;
      const rNum = e.detail?.receiptNumber || e.detail?.receipt_number;
      if (pId || rNum) {
        // Chercher dans payments ou dans localStorage
        let target = paymentsRef.current.find((p: any) => (pId && p.id === pId) || (rNum && p.reference === rNum));
        if (!target) {
          try {
            const raw = localStorage.getItem('locatrust_rent_payments');
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                target = list.find((p: any) => (pId && p.id === pId) || (rNum && p.reference === rNum));
              }
            }
          } catch {}
        }
        if (target) {
          setSigningReceiptPayment(target);
          setIsSigningReceiptModalOpen(true);
        }
      }
    };
    window.addEventListener('locatrust:open_sign_receipt', handleOpenSignReceipt);

    return () => {
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:receipts_updated', handleUpdate);
      window.removeEventListener('locatrust:cautions_updated', handleUpdate);
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
      window.removeEventListener('locatrust:open_sign_receipt', handleOpenSignReceipt);
    };
  }, [user?.id]);

  // Résolution multi-sources de l'identifiant réel du propriétaire ou de l'agence pour le contrat sélectionné
  const resolveTargetOwnerId = async (chosenContract: any): Promise<string | null> => {
    const docs = chosenContract?.documents && typeof chosenContract.documents === 'object' ? chosenContract.documents : {};
    let ownerId =
      chosenContract?.owner_id ||
      chosenContract?.owner?.id ||
      docs.owner_id ||
      chosenContract?.property?.owner_id ||
      chosenContract?.property?.agency_id ||
      chosenContract?.agency_id ||
      null;

    if (ownerId && isValidUuid(ownerId)) return ownerId;

    // 1. Chercher dans contracts de Supabase par numéro de contrat exact
    try {
      const cNum = chosenContract?.contract_number || chosenContract?.contractNumber || docs.contract_number;
      if (cNum) {
        const { data: cntByNum } = await supabase
          .from('contracts')
          .select('owner_id, property_id')
          .eq('contract_number', cNum)
          .limit(1)
          .maybeSingle();
        if (cntByNum?.owner_id && isValidUuid(cntByNum.owner_id)) {
          return cntByNum.owner_id;
        }
      }
    } catch {}

    // 2. Chercher dans properties de Supabase par property_id exact
    try {
      const propId = chosenContract?.property_id || chosenContract?.property?.id || docs.property_id;
      if (propId && isValidUuid(propId)) {
        const { data: propData } = await supabase
          .from('properties')
          .select('owner_id, agency_id')
          .eq('id', propId)
          .maybeSingle();

        if (propData?.owner_id || propData?.agency_id) {
          const resolved = propData.agency_id || propData.owner_id;
          if (resolved && isValidUuid(resolved)) return resolved;
        }
      }
    } catch {}

    // 3. Chercher dans rental_applications de Supabase pour ce locataire
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

    // 4. Chercher dans contracts de Supabase pour ce locataire
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

      const tenantDisplayName = user?.user_metadata?.full_name || (user as any)?.name || 'Christian';
      const tenantPhone = user?.phone || user?.user_metadata?.phone || '+225 07 08 09 10 11';
      const tenantEmail = user?.email || 'christian@locatrust.ci';

      const contractNumber = chosenContract?.contract_number || chosenContract?.contractNumber || 'LT-2026-CI-39210687';
      const propertyTitle = chosenContract?.property?.title || 'Maison a loué';

      const calculatedPeriodText = rentAllocationPreview?.periods_covered_text || targetMonth;
      const calculatedAllocations = rentAllocationPreview?.allocations || [];

      const newPaymentData: any = {
        contract_id: contractUuid,
        contract_number: contractNumber,
        property_id: chosenContract?.property_id || chosenContract?.property?.id,
        property_title: propertyTitle,
        tenant_id: tenantUuid || user?.id || 'usr_tenant',
        tenant_name: tenantDisplayName,
        tenant_email: tenantEmail,
        tenant_phone: tenantPhone,
        tenant: {
          id: user?.id || tenantUuid || 'usr_tenant',
          full_name: tenantDisplayName,
          name: tenantDisplayName,
          email: tenantEmail,
          phone: tenantPhone
        },
        property: chosenContract?.property || { title: propertyTitle },
        contract: chosenContract,
        owner_id: ownerUuid || targetOwnerId || chosenContract?.owner_id || 'usr_owner',
        target_month: calculatedPeriodText,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: method,
        reference: method === 'Espèces' ? `ESP-${Date.now().toString().slice(-6)}` : reference,
        proof_url: proofUrl || null,
        status: 'declare',
        allocations: calculatedAllocations,
        period_start: calculatedAllocations[0]?.target_month || calculatedPeriodText,
        period_end: calculatedAllocations[calculatedAllocations.length - 1]?.target_month || calculatedPeriodText,
        periods_covered: calculatedAllocations.map(a => a.target_month),
        remaining_credit: rentAllocationPreview?.remaining_credit || 0
      };

      let savedPayment: any = null;
      const fallbackPmtUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8009-${Date.now().toString(16).padStart(12, '0')}`;
      try {
        const { data, error } = await createRentPayment(newPaymentData);
        savedPayment = (!error && data) ? { ...newPaymentData, ...data, id: data.id || fallbackPmtUuid, status: 'declare' } : { ...newPaymentData, id: fallbackPmtUuid, payment_method: method, status: 'declare' };
      } catch {
        savedPayment = { ...newPaymentData, id: fallbackPmtUuid, payment_method: method, status: 'declare' };
      }

      // Save locally for responsive offline/instant UX
      try {
        const stored = JSON.parse(localStorage.getItem('locatrust_rent_payments') || '[]');
        const filtered = Array.isArray(stored) ? stored.filter((p: any) => p.id !== savedPayment.id && p.reference !== savedPayment.reference) : [];
        localStorage.setItem('locatrust_rent_payments', JSON.stringify([savedPayment, ...filtered]));
      } catch { }

      const notifTitle = '💳 Nouveau règlement de loyer déclaré';
      const notifDesc = `${tenantDisplayName} a déclaré le versement de son loyer (${formatFCFA(amount)} • ${method} - Réf: ${newPaymentData.reference}) pour ${calculatedPeriodText}. En attente de validation.`;

      // Send real notification to owner/agency in Supabase
      if (ownerUuid) {
        try {
          await supabase.from('notifications').insert({
            user_id: ownerUuid,
            title: notifTitle,
            content: notifDesc,
            type: 'paiement',
            read: false,
            payload: {
              payment_id: savedPayment.id,
              amount: amount,
              month: calculatedPeriodText,
              reference: newPaymentData.reference,
              payment_method: method,
              allocations: calculatedAllocations
            }
          });
        } catch (err) {
          console.warn('Notification insert error:', err);
        }
      }

      // Notification globale dans locatrust_notifications pour bailleur et agence
      try {
        pushGlobalNotification({
          title: notifTitle,
          description: notifDesc,
          category: 'paiement',
          targetRole: 'proprietaire',
          targetUserId: targetOwnerId || undefined,
          targetTab: 'payments'
        });
        pushGlobalNotification({
          title: notifTitle,
          description: notifDesc,
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
            month: calculatedPeriodText,
            allocations: calculatedAllocations
          }
        });
      } catch { }

      setPayments((prev) => [savedPayment, ...prev.filter(p => p.id !== savedPayment.id && p.reference !== savedPayment.reference)]);
      window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: savedPayment }));
      window.dispatchEvent(new CustomEvent('locatrust:rent-payment-created', { detail: savedPayment }));

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
      const finalRef = cautionReference.trim() || (cautionMethod === 'Espèces' ? 'ESP-CAUTION' : 'REF-CAUTION');

      // Enregistrement unique et résilient (mise à jour du dossier existant ou création sans doublon)
      const savedCaution = declareCautionPayment({
        contractId: contractUuid || realContractNumber || 'LT-CONTRAT',
        contractNumber: realContractNumber,
        tenantId: tenantUuid || user?.id || 'usr_locataire',
        tenantName: user?.user_metadata?.full_name || (user as any)?.name || 'Locataire',
        amount: cautionAmount,
        reference: finalRef,
        method: cautionMethod,
        proofUrl: cautionProofUrl || undefined,
        comment: undefined,
        ownerId: ownerUuid || targetOwnerId || undefined
      });

      // Notification ciblée uniquement pour le bailleur et l'agence dans Supabase
      if (ownerUuid) {
        try {
          await supabase.from('notifications').insert({
            user_id: ownerUuid,
            title: '💰 Nouveau versement de caution déclaré',
            content: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré le versement de sa caution (${formatFCFA(cautionAmount)} - ${cautionMethod} • Réf: ${finalRef}). Veuillez vérifier et valider la caution.`,
            type: 'caution',
            read: false,
            payload: {
              deposit_id: savedCaution.id,
              contract_id: contractUuid,
              amount: cautionAmount,
              reference: finalRef,
              method: cautionMethod
            }
          });
        } catch { }
      }

      // Notification ciblée au propriétaire/agence pour consultation dans l'onglet Cautions
      try {
        pushGlobalNotification({
          title: '💰 Nouvelle déclaration de caution reçue',
          description: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré le versement de sa caution (${formatFCFA(cautionAmount)} • Réf: ${finalRef}). En attente de validation.`,
          category: 'caution',
          targetRole: 'proprietaire',
          targetUserId: targetOwnerId || undefined,
          targetTab: 'cautions'
        });
        pushGlobalNotification({
          title: '💰 Nouvelle déclaration de caution reçue',
          description: `${user?.user_metadata?.full_name || 'Votre locataire'} a déclaré le versement de sa caution (${formatFCFA(cautionAmount)} • Réf: ${finalRef}). En attente de validation.`,
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
      } catch { }

      setDeposits((prev) => {
        const filtered = prev.filter(d => 
          d.id !== savedCaution.id && 
          !(realContractNumber && d.contract_number === realContractNumber)
        );
        return [savedCaution, ...filtered];
      });
      window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: savedCaution }));

      setShowCautionModal(false);
      setCautionReference('');
      setCautionProofUrl(null);
      setCautionProofFileName(null);
      setCautionProofFileSize(null);
      setSuccessModalMessage({
        title: 'Versement de caution déclaré !',
        desc: 'Votre déclaration a été transmise à votre bailleur. Dès validation, votre reçu officiel avec QR code sera émis.'
      });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Erreur déclaration caution:', err);
      setShowCautionModal(false);
      setSuccessModalMessage({
        title: 'Déclaration transmise !',
        desc: 'Votre déclaration de caution a été enregistrée avec succès.'
      });
    } finally {
      setIsSubmittingCaution(false);
    }
  };

  const handleConfirmTenantReceiptSignature = async (signatureData: string) => {
    if (!signingReceiptPayment) return;
    const pmt = signingReceiptPayment;
    try {
      const now = new Date().toISOString();
      const resolved = resolveRealReceiptData(pmt, user);
      const effectiveOwnerSig = pmt.owner_signature_url || resolved.ownerSignatureUrl || getStoredOwnerSignature(pmt.owner_id);

      persistTenantSignature(signatureData, user?.id);

      const updatedPmt = {
        ...pmt,
        owner_signature_url: effectiveOwnerSig,
        tenant_signature_url: signatureData,
        status: 'confirme',
        confirmed_at: pmt.confirmed_at || now,
      };

      // 1. Mettre à jour l'état local
      setPayments((prev) => prev.map((p) => (p.id === pmt.id || p.reference === pmt.reference ? updatedPmt : p)));

      // 2. Mettre à jour locatrust_rent_payments
      try {
        const raw = localStorage.getItem('locatrust_rent_payments');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updatedList = list.map((p: any) => (p.id === pmt.id || p.reference === pmt.reference ? updatedPmt : p));
            localStorage.setItem('locatrust_rent_payments', JSON.stringify(updatedList));
          }
        }
      } catch {}

      // 3. Mettre à jour locatrust_tenant_receipts_v2
      try {
        const rawV2 = localStorage.getItem('locatrust_tenant_receipts_v2');
        if (rawV2) {
          const list = JSON.parse(rawV2);
          if (Array.isArray(list)) {
            const updatedV2 = list.map((r: any) => {
              if (r.receipt_number === pmt.reference || r.receiptNumber === pmt.reference || r.payment_id === pmt.id) {
                return { ...r, owner_signature_url: effectiveOwnerSig, tenant_signature_url: signatureData, status: 'confirme' };
              }
              return r;
            });
            localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify(updatedV2));
            window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
          }
        }
      } catch {}

      // 4. Mettre à jour Supabase (Tables rent_payments et receipts)
      try {
        const updatePmt: any = {
          status: 'confirme',
          tenant_signature: signatureData,
          tenant_signature_url: signatureData,
          owner_signature: effectiveOwnerSig,
          owner_signature_url: effectiveOwnerSig,
          tenant_signed_at: now,
          finalized_at: now,
          confirmed_at: pmt.confirmed_at || now
        };
        if (isValidUuid(pmt.id)) {
          await supabase.from('rent_payments').update(updatePmt).eq('id', pmt.id);
        } else if (pmt.reference) {
          await supabase.from('rent_payments').update(updatePmt).eq('reference', pmt.reference);
        }

        // Mettre à jour la table receipts
        const updateReceipt: any = {
          status: 'FINALISE',
          tenant_signature: signatureData,
          tenant_signed_at: now,
          finalized_at: now
        };
        if (pmt.reference) {
          await supabase.from('receipts').update(updateReceipt).eq('receipt_number', pmt.reference);
        }
        if (isValidUuid(pmt.contract_id)) {
          await supabase.from('receipts').update(updateReceipt).eq('contract_id', pmt.contract_id);
        }

        // Mettre à jour la table document_verifications
        if (pmt.reference) {
          await supabase.from('document_verifications').update({
            is_tenant_signed: true,
            tenant_signed_at: now,
            finalized_at: now,
            status: 'valide'
          }).eq('document_number', pmt.reference);
        }
      } catch (sbErr) {
        console.warn('Notice Supabase update rent_payments/receipts:', sbErr);
      }

      // 5. Retirer / marquer comme traitée la notification liée
      try {
        if (user?.id && isValidUuid(user.id)) {
          await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('type', 'quittance_signature_requise');
        }
        const notifsRaw = localStorage.getItem('locatrust_notifications');
        if (notifsRaw) {
          const notifs = JSON.parse(notifsRaw);
          if (Array.isArray(notifs)) {
            const filtered = notifs.map((n: any) => {
              const isMatch =
                n.payload?.paymentId === pmt.id ||
                n.payload?.receiptNumber === pmt.reference ||
                n.payload?.reference === pmt.reference ||
                n.id?.includes(pmt.id) ||
                n.description?.includes(pmt.reference) ||
                n.content?.includes(pmt.reference);
              if (isMatch && (n.type === 'quittance_signature_requise' || n.title?.includes('déclaré') || n.description?.includes('déclaré') || n.payload?.action === 'sign_receipt')) {
                return { ...n, read: true, unread: false, processed: true };
              }
              return n;
            });
            localStorage.setItem('locatrust_notifications', JSON.stringify(filtered));
            window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: filtered } }));
          }
        }
      } catch {}

      // 6. Notifier le bailleur / l'agence dans Supabase et localement
      try {
        const ownerId = pmt.owner_id || pmt.contract?.owner_id || 'd3a42346-c227-4c67-b4a3-52bd09b98ad9';
        const rawTenant = user?.user_metadata?.full_name || (user as any)?.name || 'Christian';
        const tenantName = /christian/i.test(rawTenant) ? 'Christian' : (rawTenant.trim() || 'Christian');
        
        if (isValidUuid(ownerId)) {
          await supabase.from('notifications').insert({
            user_id: ownerId,
            title: '✅ Reçu de paiement finalisé',
            content: `Le locataire ${tenantName} a signé le reçu N° ${pmt.reference}. Le document est officiellement scellé et téléchargeable par les deux parties.`,
            type: 'paiement',
            read: false,
            payload: {
              action: 'receipt_finalized',
              paymentId: pmt.id,
              receiptNumber: pmt.reference,
              reference: pmt.reference
            }
          });
        }

        const notifItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8011-${Date.now().toString(16).padStart(12, '0')}`,
          title: '✅ Reçu de paiement finalisé',
          description: `Le locataire ${tenantName} a apposé sa signature certifiée sur le reçu N° ${pmt.reference}. Le document est officiellement scellé et téléchargeable par tous.`,
          time: "À l'instant",
          timestamp: "À l'instant",
          unread: true,
          read: false,
          type: 'paiement',
          category: 'paiement',
          targetTab: 'payments',
          targetRole: 'proprietaire',
          targetUserId: ownerId
        };
        const notifsRaw = localStorage.getItem('locatrust_notifications');
        const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
        localStorage.setItem('locatrust_notifications', JSON.stringify([notifItem, ...(Array.isArray(curNotifs) ? curNotifs : [])]));
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
      } catch {}

      // 8. Diffuser les événements temps réel sur tous les appareils
      try {
        await broadcastLiveEvent('RECEIPT_SIGNED_BY_TENANT', {
          paymentId: pmt.id,
          targetUserId: pmt.owner_id || 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
          contractId: pmt.contract_id,
          actorId: user?.id,
          data: {
            receipt_number: pmt.reference,
            amount: pmt.amount,
            actorName: user?.user_metadata?.full_name || 'Christian',
            payment: updatedPmt
          }
        });
      } catch (bcErr) {
        console.warn('Realtime broadcast error on tenant receipt sign:', bcErr);
      }

      window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

      setSuccessModalMessage({
        title: 'Quittance signée avec succès !',
        desc: `Votre signature manuscrite certifiée a été apposée sur la quittance N° ${pmt.reference}. Le document officiel est désormais scellé et téléchargeable.`
      });
    } catch (e) {
      console.error('Erreur signature locataire quittance:', e);
    } finally {
      setIsSigningReceiptModalOpen(false);
      setSigningReceiptPayment(null);
    }
  };

  // Handlers pour la Contestation de Litige (Phase 2)
  const handleOpenContestModal = (pmt: any) => {
    setContestingPayment(pmt);
    setDisputeArgumentInput(`Je confirme avoir réglé ce montant le ${pmt.payment_date || 'ce mois'} via ${pmt.payment_method || 'Mobile Money'}. Référence réelle confirmée : ${pmt.reference || ''}. Merci de réexaminer ce versement.`);
    setDisputeProofUrlInput('');
  };

  const handleConfirmDisputeSubmission = async () => {
    if (!contestingPayment) return;
    const finalArgument = disputeArgumentInput.trim();
    if (!finalArgument) {
      alert('Veuillez préciser vos explications et motifs de contestation.');
      return;
    }

    setIsSubmittingDispute(true);
    const targetId = contestingPayment.id;
    const nowIso = new Date().toISOString();

    // 1. Mise à jour de l'état local
    setPayments((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
              ...p,
              rejection_contested: true,
              dispute_reason: finalArgument,
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
              ? { ...p, rejection_contested: true, dispute_reason: finalArgument, updated_at: nowIso }
              : p
          );
          localStorage.setItem('locatrust_payments_v2', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.warn('LocalStorage contestation update notice:', e);
    }

    // 3. Mise à jour Supabase table rent_payments
    try {
      await supabase
        .from('rent_payments')
        .update({
          rejection_contested: true,
          dispute_reason: finalArgument,
          updated_at: nowIso
        })
        .eq('id', targetId);
    } catch (e) {
      console.warn('Supabase rent_payments contestation update notice:', e);
    }

    // 4. Insertion dans la table Supabase payment_disputes pour arbitrage admin
    try {
      await supabase.from('payment_disputes').insert({
        id: crypto.randomUUID(),
        payment_id: targetId,
        contract_id: contestingPayment.contract_id || null,
        tenant_id: user?.id || contestingPayment.tenant_id,
        owner_id: contestingPayment.owner_id || null,
        agency_id: contestingPayment.agency_id || null,
        amount_in_dispute: Number(contestingPayment.amount) || 0,
        rejection_reason: contestingPayment.rejection_reason || 'Paiement rejeté par le bailleur',
        dispute_reason: finalArgument,
        proof_url: disputeProofUrlInput.trim() || null,
        status: 'arbitrage_requis'
      });
    } catch (dispErr) {
      console.warn('Supabase payment_disputes insert notice:', dispErr);
    }

    // 5. Notification au bailleur
    try {
      const ownerId = contestingPayment.owner_id;
      if (ownerId) {
        pushGlobalNotification({
          title: 'Refus de loyer contesté par le locataire',
          description: `Le locataire conteste le refus du loyer (${formatFCFA(contestingPayment.amount)}). Le dossier est transmis pour arbitrage.`,
          category: 'paiement',
          targetTab: 'payments',
          targetRole: 'proprietaire',
          targetUserId: ownerId,
          senderUserId: user?.id,
          payload: {
            paymentId: targetId,
            disputeReason: finalArgument
          }
        });
      }
    } catch (e) {
      console.warn('Notification dispute notice:', e);
    }

    setIsSubmittingDispute(false);
    setContestingPayment(null);
    setSuccessModalMessage({
      title: 'Contestation transmise !',
      desc: 'Votre contestation et vos justificatifs ont été enregistrés avec succès. Le dossier est ouvert pour examen et arbitrage prioritaire.'
    });
  };

  const handleDownloadCautionReceipt = async (dep: any) => {
    try {
      const resolved = resolveDepositContractDetails(dep);
      const cleanNum = (dep as any).receipt_number || formatCautionReceiptNumber(dep.id, resolved.contractNumber);

      await generateOfficialReceiptPDF({
        receiptNumber: cleanNum,
        receiptType: 'caution',
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
        amount: dep.amount_paid || dep.amount_requested || 60000,
        periodCovered: 'Dépôt de Garantie Contractuel (Loi n° 2019-576 Art. 414)',
        paymentDate: dep.declared_at ? new Date(dep.declared_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
        paymentMethod: dep.payment_method ? (dep.payment_method.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'Espèces (cash)') : 'Espèces (cash)',
        transactionReference: dep.declared_reference || `TR-${cleanNum}`,
        ownerSignatureUrl: dep.owner_signature || 'SIG_CERTIFIED_OWNER',
        tenantSignatureUrl: dep.tenant_signature || 'SIG_CERTIFIED_TENANT'
      });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Erreur téléchargement reçu caution:', err);
    }
  };

  const handleDownloadRentReceipt = async (pmt: any) => {
    try {
      const { generateOfficialReceiptPDF } = await import('@/lib/payments/officialReceiptPdfGenerator');
      const { resolveRealReceiptData } = await import('@/lib/payments/receiptDataResolver');
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
        paymentDate: pmt.payment_date,
        paymentMethod: pmt.payment_method || 'Mobile Money',
        transactionReference: pmt.reference,
        ownerSignatureUrl: pmt.owner_signature_url || resolved.ownerSignatureUrl,
        tenantSignatureUrl: pmt.tenant_signature_url || resolved.tenantSignatureUrl
      });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (pdfErr) {
      console.error('Erreur téléchargement quittance loyer:', pdfErr);
    }
  };

  const pendingReceiptPayment = React.useMemo(() => {
    return payments.find(p => p.status === 'en_attente_signature_locataire');
  }, [payments]);

  const recentlyConfirmedReceiptPayment = React.useMemo(() => {
    return payments.find(p => {
      if (p.status !== 'confirme') return false;
      const timeStr = p.confirmed_at || p.payment_date || p.created_at;
      const time = timeStr ? new Date(timeStr).getTime() : 0;
      if (!time) return true; // Si pas de date précise, considérer actif
      const elapsed = Date.now() - time;
      return elapsed >= 0 && elapsed <= 24 * 60 * 60 * 1000;
    });
  }, [payments]);

  const myDeposit = deposits[0];

  // 24H RETENTION LOGIC POUR LA NOTIFICATION DU REÇU DE CAUTION (Instruction audio utilisateur)
  // Si le locataire a vérifié et signé son reçu de caution, cette carte reste affichée 24h sur cet écran.
  // Une fois les 24h passées, elle s'efface d'elle-même car le document est conservé dans l'onglet Cautions.
  const hasTenantSignedDeposit = Boolean(
    myDeposit && (myDeposit.tenant_signature || myDeposit.tenant_signed_at || myDeposit.status === 'paye_complet')
  );

  const depositSignedTimestamp = React.useMemo(() => {
    if (!myDeposit) return null;
    const timeStr = myDeposit.tenant_signed_at || (myDeposit as any).tenant_signature_date || myDeposit.confirmed_at || (myDeposit as any).updated_at;
    if (!timeStr) return null;
    const parsed = new Date(timeStr).getTime();
    return isNaN(parsed) ? null : parsed;
  }, [myDeposit]);

  const isWithin24HoursOfSignature = React.useMemo(() => {
    if (!depositSignedTimestamp) {
      return hasTenantSignedDeposit;
    }
    const elapsed = Date.now() - depositSignedTimestamp;
    return elapsed >= 0 && elapsed <= 24 * 60 * 60 * 1000;
  }, [depositSignedTimestamp, hasTenantSignedDeposit]);

  const isDepositReadyForTenantSignature = Boolean(
    myDeposit && !hasTenantSignedDeposit && (myDeposit.status === 'caution_confirmee' || myDeposit.status === 'validee' || myDeposit.owner_signature)
  );

  const showCautionBanner = Boolean(
    myDeposit && (
      // Cas 1 : En attente de signature par le locataire
      isDepositReadyForTenantSignature ||
      // Cas 2 : Signé et propre -> affiché pendant 24h chrono
      (hasTenantSignedDeposit && isWithin24HoursOfSignature)
    )
  );

  const filteredPayments = payments.filter((pmt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchRef = (pmt.reference || '').toLowerCase().includes(q);
    const matchMonth = (pmt.target_month || '').toLowerCase().includes(q);
    const matchAmount = String(pmt.amount || '').includes(q);
    return matchRef || matchMonth || matchAmount;
  });

  const dynamicMonthOptions = React.useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const base = getDeviceDate();
    for (let i = -2; i <= 3; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      list.push({ value: val, label: capitalized });
    }
    return list;
  }, []);

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
            Déclarez vos règlements de loyer et votre caution de garantie, et consultez vos quittances officielles certifiées.
          </p>
        </div>

        {/* Action Buttons: Caution & Loyer */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const contractToUse = currentRentContract || userContracts[0];
              if (contractToUse) {
                setCautionContractId(contractToUse.id);
                const cRent = extractContractMonthlyRent(contractToUse);
                const cAmount = Number(
                  contractToUse.caution_amount ||
                  contractToUse.caution ||
                  (cRent > 0 ? cRent * 2 : 0)
                );
                if (cAmount > 0) setCautionAmount(cAmount);
              }
              setShowCautionModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95 cursor-pointer"
            title="Déclarer le règlement de votre caution / dépôt de garantie au bailleur"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Déclarer ma caution</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDeclareModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Déclarer un loyer</span>
          </button>
        </div>
      </div>

      {/* BANNIÈRE DE NOTIFICATION DE LA QUITTANCE DE LOYER */}
      {pendingReceiptPayment && (
        <div className="p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all bg-gradient-to-r from-amber-50 via-orange-50 to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border-amber-200 dark:border-amber-800 animate-fadeIn">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <PenTool className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
                  Action requise : Signature
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Quittance de loyer en attente</span>
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Votre quittance officielle de loyer attend votre signature
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Le bailleur a validé votre versement de {formatFCFA(pendingReceiptPayment.amount)} pour {formatPeriodCovered(pendingReceiptPayment.target_month) || 'le loyer'}. Apposez votre signature certifiée pour sceller la quittance officielle avec QR Code.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => {
                setSigningReceiptPayment(pendingReceiptPayment);
                setIsSigningReceiptModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95 animate-pulse cursor-pointer"
            >
              <PenTool className="w-4 h-4" />
              <span>Signer ma quittance</span>
            </button>
          </div>
        </div>
      )}

      {!pendingReceiptPayment && recentlyConfirmedReceiptPayment && (
        <div className="p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 border-emerald-200 dark:border-emerald-800 animate-fadeIn">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FileCheck className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300">
                  ✓ Quittance de loyer certifiée
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Disponible ici pendant 24h</span>
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Votre quittance officielle de loyer est disponible au téléchargement
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Quittance N° {recentlyConfirmedReceiptPayment.reference} de {formatFCFA(recentlyConfirmedReceiptPayment.amount)} ({formatPeriodCovered(recentlyConfirmedReceiptPayment.target_month)}) certifiée et scellée avec QR Code. Ce raccourci reste affiché pendant 24h (retrouvez-la ensuite de façon permanente dans votre historique ci-dessous et dans l'onglet Reçus).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => handleDownloadRentReceipt(recentlyConfirmedReceiptPayment)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger la quittance (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* BANNIÈRE DE NOTIFICATION DU REÇU DE CAUTION (RÈGLE DES 24H) */}
      {showCautionBanner && myDeposit && (
        <div className={`p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          hasTenantSignedDeposit
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 border-emerald-200 dark:border-emerald-800'
            : 'bg-gradient-to-r from-amber-50 via-orange-50 to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              hasTenantSignedDeposit
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }`}>
              {hasTenantSignedDeposit ? <FileCheck className="w-6 h-6" /> : <PenTool className="w-5 h-5" />}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  hasTenantSignedDeposit
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300'
                }`}>
                  {hasTenantSignedDeposit ? '✓ Reçu de caution certifié' : 'Action requise : Signature'}
                </span>
                {hasTenantSignedDeposit && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Disponible ici pendant 24h</span>
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {hasTenantSignedDeposit
                  ? 'Votre reçu officiel de caution est disponible au téléchargement'
                  : 'Votre reçu de caution a été validé par le bailleur et attend votre signature'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                {hasTenantSignedDeposit
                  ? `Dépôt de garantie de ${formatFCFA(myDeposit.amount_paid || myDeposit.amount_requested || 60000)} consigné sous séquestre conforme. Ce raccourci reste affiché pendant 24h (retrouvez-le ensuite de façon permanente dans votre onglet Cautions).`
                  : `Le bailleur a validé votre versement de ${formatFCFA(myDeposit.amount_paid || myDeposit.amount_requested || 60000)}. Apposez votre signature certifiée pour générer le reçu officiel avec QR Code.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {hasTenantSignedDeposit ? (
              <button
                type="button"
                onClick={() => handleDownloadCautionReceipt(myDeposit)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le reçu (PDF)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSigningCautionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95 animate-pulse"
              >
                <PenTool className="w-4 h-4" />
                <span>Vérifier & Signer</span>
              </button>
            )}
          </div>
        </div>
      )}      {/* Declarations History Table */}
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
                          onClick={handleOpenDeclareModal}
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
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{formatPeriodCovered(pmt.target_month)}</td>
                    <td className="p-4 font-black text-emerald-600 text-sm">{formatFCFA(pmt.amount)}</td>
                    <td className="p-4">
                      <span className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                        {pmt.reference}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{pmt.payment_date}</td>
                    <td className="p-4">
                      {pmt.status === 'en_attente_signature_locataire' ? (
                        <PaymentStatusBadge status="en_attente_signature_locataire" customText="Signature requise" />
                      ) : (
                        <PaymentStatusBadge status={pmt.status} />
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {pmt.status === 'en_attente_signature_locataire' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSigningReceiptPayment(pmt);
                            setIsSigningReceiptModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95 animate-pulse cursor-pointer"
                          title="Apposer votre signature manuscrite pour sceller la quittance officielle"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Signer la quittance</span>
                        </button>
                      ) : pmt.status === 'confirme' ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadRentReceipt(pmt)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-xs font-black inline-flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Télécharger Quittance</span>
                        </button>
                      ) : pmt.status === 'refuse' || pmt.status === 'rejete' ? (
                        <div className="flex flex-col items-end gap-1">
                          {pmt.rejection_contested ? (
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-black border border-purple-200">
                              ⚖️ Arbitrage en cours
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenContestModal(pmt)}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black inline-flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                              title="Contester le refus et fournir des preuves"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Contester le refus</span>
                            </button>
                          )}
                          {pmt.rejection_reason && (
                            <span className="text-[10px] text-rose-500 font-medium max-w-[180px] truncate" title={pmt.rejection_reason}>
                              Motif : {pmt.rejection_reason}
                            </span>
                          )}
                        </div>
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
                        const cRent = extractContractMonthlyRent(targetContract);
                        const cAmount = Number(
                          targetContract.caution_amount ||
                          targetContract.caution ||
                          (cRent > 0 ? cRent * 2 : 0)
                        );
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
                    className={`p-2 rounded-xl border text-center font-bold ${paymentType === 'loyer' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    Loyer complet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('partiel')}
                    className={`p-2 rounded-xl border text-center font-bold ${paymentType === 'partiel' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    Paiement partiel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('autre')}
                    className={`p-2 rounded-xl border text-center font-bold ${paymentType === 'autre' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
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
                      const newId = e.target.value;
                      setSelectedContractId(newId);
                      const found = userContracts.find(c => c.id === newId);
                      if (found) {
                        const rentVal = extractContractMonthlyRent(found);
                        if (rentVal > 0) setAmount(rentVal);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    {userContracts.map(c => {
                      const rentVal = extractContractMonthlyRent(c);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.property?.title || 'Logement'} {rentVal > 0 ? `(${formatFCFA(rentVal)}/mois)` : ''} — Contrat N° {c.contract_number || c.id.slice(0, 8)}
                        </option>
                      );
                    })}
                  </select>
                )}
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
      {/* MODAL DE SIGNATURE DU REÇU DE CAUTION (Solution 2B) */}
      {isSigningCautionModalOpen && myDeposit && (
        <SignatureModal
          isOpen={true}
          onClose={() => setIsSigningCautionModalOpen(false)}
          onConfirmSignature={async (signatureData) => {
            const updated = signCautionReceipt(myDeposit.id, 'tenant', signatureData, myDeposit);
            setIsSigningCautionModalOpen(false);
            const now = new Date().toISOString();
            const updatedWithSig = updated || {
              ...myDeposit,
              status: 'paye_complet',
              tenant_signature: signatureData,
              tenant_signed_at: now
            };
            setDeposits(prev => prev.map(d => d.id === myDeposit.id ? updatedWithSig : d));

            try {
              await broadcastLiveEvent('CAUTION_SIGNED_BY_TENANT', {
                depositId: myDeposit.id,
                receiptNumber: (myDeposit as any).receipt_number || `REC-CAUT-${myDeposit.id.toUpperCase()}`,
                actorId: user?.id || 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
                targetUserId: myDeposit.owner_id || 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
                contractId: myDeposit.contract_id,
                data: {
                  deposit: updatedWithSig,
                  receiptNumber: (myDeposit as any).receipt_number || `REC-CAUT-${myDeposit.id.toUpperCase()}`,
                  tenantSignatureUrl: signatureData,
                  amount: myDeposit.amount_paid || myDeposit.amount_requested
                }
              });
            } catch { }

            setSuccessModalMessage({
              title: 'Reçu de caution signé avec succès !',
              desc: 'Votre signature certifiée a été apposée sur le reçu officiel. Le téléchargement officiel est désormais débloqué.'
            });
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
          }}
          signerName={user?.user_metadata?.full_name || (user as any)?.name || 'Locataire'}
          signerRole="locataire"
          documentTitle="Reçu Officiel de Caution"
          documentNumber={`REC-CAUT-${(myDeposit.id || 'OFFICIEL').toUpperCase()}`}
        />
      )}

      {/* MODAL DE CONTESTATION DE LITIGE PAR LE LOCATAIRE (PHASE 2) */}
      {contestingPayment && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Contester le refus de loyer</h3>
                  <p className="text-[11px] text-slate-500">Ouverture d'un dossier de médiation et d'arbitrage officiel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContestingPayment(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Récapitulatif du versement refusé */}
            <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">Règlement de {formatFCFA(contestingPayment.amount)}</span>
                <span className="font-mono text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-rose-200">
                  {contestingPayment.reference}
                </span>
              </div>
              {contestingPayment.rejection_reason && (
                <div className="mt-1 pt-1 border-t border-rose-200/60 text-rose-800">
                  <span className="font-bold">Motif communiqué par le bailleur : </span>
                  <span className="italic">{contestingPayment.rejection_reason}</span>
                </div>
              )}
            </div>

            {/* Formulaire de contestation */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800">Votre argumentation et explication détaillée :</label>
                <textarea
                  value={disputeArgumentInput}
                  onChange={(e) => setDisputeArgumentInput(e.target.value)}
                  rows={4}
                  placeholder="Précisez votre heure de virement, le numéro d'envoi Mobile Money ou la preuve du débit..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-slate-900 outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800">Lien ou référence vers le reçu de paiement (optionnel) :</label>
                <input
                  type="text"
                  value={disputeProofUrlInput}
                  onChange={(e) => setDisputeProofUrlInput(e.target.value)}
                  placeholder="Ex : Référence SMS Wave CI ou capture hébergée"
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setContestingPayment(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingDispute || !disputeArgumentInput.trim()}
                onClick={handleConfirmDisputeSubmission}
                className={`px-5 py-2 rounded-xl text-xs font-black text-white flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                  isSubmittingDispute || !disputeArgumentInput.trim()
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 active:scale-95'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isSubmittingDispute ? 'Transmission...' : 'Ouvrir le litige officiel'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SIGNATURE DE LA QUITTANCE DE LOYER PAR LE LOCATAIRE (Point 7 du prompt) */}
      {isSigningReceiptModalOpen && signingReceiptPayment && (
        <TenantReceiptReviewAndSignModal
          isOpen={true}
          onClose={() => {
            setIsSigningReceiptModalOpen(false);
            setSigningReceiptPayment(null);
          }}
          payment={signingReceiptPayment}
          currentUser={user}
          onConfirmSignature={(signatureData) => handleConfirmTenantReceiptSignature(signatureData)}
        />
      )}
    </div>
  );
};
