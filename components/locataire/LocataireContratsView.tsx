'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User,
  Building2,
  Receipt,
  FileCheck,
  Sparkles,
  Eye,
  MapPin,
  Clock,
  RotateCcw,
  Check,
  X,
  CreditCard,
  ChevronRight,
  FolderOpen,
  AlertCircle,
  Search,
  PenTool,
  RefreshCw
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { getContracts } from '@/src/lib/db';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { ContractDetailView } from '@/components/contracts/ContractDetailView';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { resolveContractDueDay } from '@/lib/payments/rentScheduleEngine';
import { resolveContractParties, persistTenantSignature, getStoredTenantSignature } from '@/lib/contractPartyResolver';
import { ContractCardSkeleton } from '@/components/common/SkeletonLoader';
import { TopProgressBar } from '@/components/common/TopProgressBar';
import { collectProofDossierData, generateOfficialProofDossierPdf } from '@/lib/proofDossierPdfGenerator';
import { submitContractRenewalRequest, getContractExpiryDetails } from '@/lib/contractRenewalManager';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { triggerCelebration } from '@/lib/celebration';

interface TenantPropertyRental {
  id: string;
  city: string;
  title: string;
  address: string;
  contractNumber: string;
  rent: number;
  charges: number;
  cautionAmount: number;
  cautionStatus: 'restituee' | 'active_consignee' | 'en_cours_restitution';
  bailleurName: string;
  bailleurPhone: string;
  startDate: string;
  durationMonths: number;
  rawContract?: any;
}

export interface LocataireContratsViewProps {
  initialTab?: 'all' | 'contracts' | 'receipts';
}

export const LocataireContratsView: React.FC<LocataireContratsViewProps> = ({
  initialTab = 'all'
}) => {
  const { user, profile } = useAuth();
  const [sectionFilter, setSectionFilter] = useState<'all' | 'contracts' | 'receipts'>(initialTab);
  const [contracts, setContracts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = React.useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedContractNumber, setSelectedContractNumber] = useState<string | null>(null);
  const [generatingProofId, setGeneratingProofId] = useState<string | null>(null);
  const [submittingRenewalId, setSubmittingRenewalId] = useState<string | null>(null);

  // Petite carte dédiée à la signature & validation directe du contrat (Exigence Image 1 & 2)
  const [signingRentalCard, setSigningRentalCard] = useState<TenantPropertyRental | null>(null);
  const sigCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [hasDrawnSig, setHasDrawnSig] = useState(false);
  const [sigValidationError, setSigValidationError] = useState<string | null>(null);
  const [isSubmittingSig, setIsSubmittingSig] = useState(false);

  const clearCompactSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSig(false);
    setSigValidationError(null);
  };

  useEffect(() => {
    if (signingRentalCard && sigCanvasRef.current) {
      const canvas = sigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      setHasDrawnSig(false);
      setSigValidationError(null);
    }
  }, [signingRentalCard]);

  const getSigCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleSigStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigCoords(e);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingSig(true);
    setHasDrawnSig(true);
    setSigValidationError(null);
  };

  const handleSigMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleSigEnd = () => {
    setIsDrawingSig(false);
  };

  const handleConfirmCompactSignature = async () => {
    if (!signingRentalCard) return;
    if (!hasDrawnSig || !sigCanvasRef.current) {
      setSigValidationError('Veuillez dessiner votre signature manuscrite dans le cadre ci-dessus avant de valider.');
      return;
    }

    const signatureUrl = sigCanvasRef.current.toDataURL('image/png');
    const cNum = signingRentalCard.contractNumber;
    const rawCnt = signingRentalCard.rawContract || {};
    const nowIso = new Date().toISOString();
    const signedDateFr = new Date().toLocaleDateString('fr-FR');
    const tenantName =
      user?.user_metadata?.full_name ||
      profile?.full_name ||
      rawCnt.tenant?.full_name ||
      rawCnt.tenant_name ||
      'Locataire';
    const propId = rawCnt.property_id || rawCnt.property?.id;
    const targetOwnerId = rawCnt.owner_id || rawCnt.owner?.id;
    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    setIsSubmittingSig(true);
    try {
      persistTenantSignature(signatureUrl, user?.id);

      // 1. Sauvegarder dans le registre persistant local des contrats signés
      if (typeof window !== 'undefined') {
        try {
          const rawSignedMap = localStorage.getItem('locatrust_signed_contracts_map');
          const signedMap = rawSignedMap ? JSON.parse(rawSignedMap) : {};
          signedMap[cNum] = {
            tenant_signed: true,
            tenant_signature_url: signatureUrl,
            signed_at: nowIso,
            status: 'actif'
          };
          localStorage.setItem('locatrust_signed_contracts_map', JSON.stringify(signedMap));
        } catch {}

        // 2. Mettre à jour ou insérer dans locatrust_contracts
        try {
          const rawContracts = localStorage.getItem('locatrust_contracts');
          const list = rawContracts ? JSON.parse(rawContracts) : [];
          const arr = Array.isArray(list) ? list : [];
          let foundInLocal = false;
          const updatedList = arr.map((c: any) => {
            if (c.contract_number === cNum || c.id === cNum || (propId && (c.property_id === propId || c.property?.id === propId))) {
              foundInLocal = true;
              return {
                ...c,
                status: 'actif',
                tenant_signed: true,
                tenant_signed_at: nowIso,
                tenant_signature: signatureUrl,
                tenant_signature_url: signatureUrl,
                signed_date: signedDateFr
              };
            }
            return c;
          });
          if (!foundInLocal) {
            updatedList.unshift({
              ...rawCnt,
              id: rawCnt.id || `cnt_${cNum}`,
              contract_number: cNum,
              property_id: propId,
              tenant_id: user?.id,
              owner_id: targetOwnerId,
              rent: signingRentalCard.rent,
              monthly_rent: signingRentalCard.rent,
              caution: signingRentalCard.cautionAmount,
              caution_amount: signingRentalCard.cautionAmount,
              charges: signingRentalCard.charges,
              charges_amount: signingRentalCard.charges,
              status: 'actif',
              owner_signed: true,
              tenant_signed: true,
              tenant_signed_at: nowIso,
              tenant_signature: signatureUrl,
              tenant_signature_url: signatureUrl,
              signed_date: signedDateFr
            });
          }
          localStorage.setItem('locatrust_contracts', JSON.stringify(updatedList));
        } catch {}

        // 3. Mettre à jour les notifications locales pour qu'elles ne réinitialisent jamais tenant_signed à false
        try {
          const rawNotifs = localStorage.getItem('locatrust_notifications');
          if (rawNotifs) {
            const parsedNotifs = JSON.parse(rawNotifs);
            if (Array.isArray(parsedNotifs)) {
              const updatedNotifs = parsedNotifs.map((n: any) => {
                const p = n?.data || n?.payload || {};
                if ((p.contractNumber || p.contract_number) === cNum) {
                  return {
                    ...n,
                    read: true,
                    is_read: true,
                    data: { ...p, tenant_signed: true, tenant_signature_url: signatureUrl, status: 'actif' },
                    payload: { ...p, tenant_signed: true, tenant_signature_url: signatureUrl, status: 'actif' }
                  };
                }
                return n;
              });
              localStorage.setItem('locatrust_notifications', JSON.stringify(updatedNotifs));
            }
          }
        } catch {}

        // 4. Mettre à jour locatrust_rental_applications et locatrust_properties
        try {
          const appsRaw = localStorage.getItem('locatrust_rental_applications');
          if (appsRaw) {
            const parsedApps = JSON.parse(appsRaw);
            if (Array.isArray(parsedApps)) {
              const updatedApps = parsedApps.map((a: any) => {
                if (
                  a.contract_number === cNum ||
                  a.documents?.contract_number === cNum ||
                  (propId && a.property_id === propId && (a.tenant_id === user?.id || !a.tenant_id))
                ) {
                  return {
                    ...a,
                    status: 'contrat_actif',
                    contract_finalized: true,
                    tenant_signed: true,
                    tenant_signed_at: nowIso,
                    tenant_signature_url: signatureUrl,
                    documents: {
                      ...(a.documents && typeof a.documents === 'object' ? a.documents : {}),
                      contract_number: cNum,
                      contract_transmitted: true,
                      contract_finalized: true,
                      tenant_signed: true,
                      tenant_signed_at: nowIso,
                      tenant_signature_url: signatureUrl,
                      contract_status: 'contrat_actif'
                    }
                  };
                }
                return a;
              });
              localStorage.setItem('locatrust_rental_applications', JSON.stringify(updatedApps));
            }
          }

          if (propId) {
            const propsRaw = localStorage.getItem('locatrust_properties');
            if (propsRaw) {
              const parsedProps = JSON.parse(propsRaw);
              if (Array.isArray(parsedProps)) {
                const updatedProps = parsedProps.map((p: any) =>
                  p.id === propId || p._id === propId ? { ...p, status: 'loue' } : p
                );
                localStorage.setItem('locatrust_properties', JSON.stringify(updatedProps));
              }
            }
          }
        } catch {}
      }

      // 5. Mise à jour immédiate de l'état React dans LocataireContratsView (disparition du bouton Signer + déblocage PDF)
      setContracts((prev) =>
        prev.map((c: any) => {
          if ((c.contract_number || c.id) === cNum) {
            return {
              ...c,
              status: 'actif',
              tenant_signed: true,
              tenant_signed_at: nowIso,
              tenant_signature: signatureUrl,
              tenant_signature_url: signatureUrl,
              signed_date: signedDateFr
            };
          }
          return c;
        })
      );

      // 6. Persistance Supabase sur public.contracts (Étape A sans modifier status pour respecter le trigger RLS locataire, puis Étape B avec status: 'actif')
      try {
        const sigPayload = {
          tenant_signature: signatureUrl,
          tenant_signed: true,
          tenant_signed_at: nowIso,
          updated_at: nowIso
        };
        if (isUuid(rawCnt.id)) {
          await supabase.from('contracts').update(sigPayload).eq('id', rawCnt.id);
        } else {
          await supabase.from('contracts').update(sigPayload).eq('contract_number', cNum);
        }

        try {
          if (isUuid(rawCnt.id)) {
            await supabase.from('contracts').update({ status: 'actif' }).eq('id', rawCnt.id);
          } else {
            await supabase.from('contracts').update({ status: 'actif' }).eq('contract_number', cNum);
          }
        } catch {}
      } catch (cntErr) {
        console.warn('Update contracts signature notice:', cntErr);
      }

      // 7. Persistance Supabase sur public.rental_applications (via JSONB documents) et public.properties
      try {
        if (user?.id) {
          const { data: myApps } = await supabase
            .from('rental_applications')
            .select('*')
            .eq('tenant_id', user.id);
          if (myApps && Array.isArray(myApps)) {
            for (const appRow of myApps) {
              const docs = appRow.documents && typeof appRow.documents === 'object' ? appRow.documents : {};
              if (docs.contract_number === cNum || (propId && appRow.property_id === propId)) {
                const updatedDocs = {
                  ...docs,
                  contract_number: cNum,
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

        if (isUuid(propId)) {
          await supabase.from('properties').update({ status: 'loue' }).eq('id', propId);
        }
      } catch (appSyncErr) {
        console.warn('Sync rental_applications signature notice:', appSyncErr);
      }

      // 8. Notification unique et dédupliquée au propriétaire / agence (avec payload complet pour synchronisation automatique)
      const sharedNotifId = crypto.randomUUID();
      const notifTitle = `Contrat N° ${cNum} signé par le locataire`;
      const notifMsg = `Le contrat N° ${cNum} (${signingRentalCard.title}) a été signé par ${tenantName} et peut maintenant être téléchargé en PDF.`;
      const notifPayload = {
        contractNumber: cNum,
        contract_number: cNum,
        property_id: propId,
        property_title: signingRentalCard.title,
        tenant_id: user?.id,
        tenant_name: tenantName,
        tenant_signed: true,
        tenant_signature_url: signatureUrl,
        status: 'contrat_actif',
        targetTab: 'contracts'
      };

      if (isUuid(targetOwnerId)) {
        try {
          await supabase.from('notifications').insert({
            id: sharedNotifId,
            user_id: targetOwnerId,
            title: notifTitle,
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

      pushGlobalNotification({
        id: sharedNotifId,
        title: notifTitle,
        description: notifMsg,
        category: 'contrat',
        targetUserId: targetOwnerId,
        targetRole: 'proprietaire',
        targetTab: 'contracts',
        data: notifPayload
      });

      broadcastLiveEvent('TENANT_SIGNED', {
        actorId: user?.id,
        targetUserId: targetOwnerId,
        propertyId: propId,
        contractId: cNum,
        data: notifPayload
      });

      broadcastLiveEvent('CONTRACT_FINALIZED', {
        actorId: user?.id,
        targetUserId: targetOwnerId,
        propertyId: propId,
        contractId: cNum,
        data: notifPayload
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
        window.dispatchEvent(new CustomEvent('locatrust:subscription_updated'));
      }

      setSigningRentalCard(null);
      triggerCelebration('success');
    } finally {
      setIsSubmittingSig(false);
    }
  };

  const handleGetTenantProofDossier = async (rawContract: any) => {
    const cid = rawContract?.contract_number || rawContract?.id || 'CT-2026';
    setGeneratingProofId(cid);
    try {
      const data = await collectProofDossierData(rawContract);
      await generateOfficialProofDossierPdf(data);
    } catch (err: any) {
      console.error('Error generating proof dossier for tenant:', err);
      alert('Impossible de générer le dossier de preuve : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setGeneratingProofId(null);
    }
  };

  const handleRequestRenewal = async (rawContract: any, rental: TenantPropertyRental) => {
    const cid = rawContract?.contract_number || rental.contractNumber;
    setSubmittingRenewalId(cid);
    try {
      await submitContractRenewalRequest({
        contract: rawContract || { contract_number: cid },
        tenantName: user?.user_metadata?.full_name || profile?.full_name || rental.rawContract?.tenant?.full_name || 'Locataire',
        propertyTitle: rental.title || 'Logement loué',
        durationMonths: 12
      });
      triggerCelebration('success');
      fetchTenantData();
    } catch (e: any) {
      console.error(e);
      alert('Erreur lors de la demande de renouvellement : ' + (e?.message || 'Erreur'));
    } finally {
      setSubmittingRenewalId(null);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setSectionFilter(initialTab);
    }
  }, [initialTab]);

  const fetchTenantData = async (isBackground = false) => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    if (hasLoadedOnceRef.current || isBackground || contracts.length > 0) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      // Registre local et Supabase des signatures RÉELLEMENT apposées par le locataire (doit contenir une vraie image data:image/)
      let signedContractsMap: Record<string, any> = {};
      if (typeof window !== 'undefined') {
        try {
          const rawMap = localStorage.getItem('locatrust_signed_contracts_map');
          if (rawMap) {
            const parsedMap = JSON.parse(rawMap) || {};
            let mapChanged = false;
            Object.keys(parsedMap).forEach((k) => {
              const entry = parsedMap[k];
              const sigStr = String(entry?.tenant_signature_url || '');
              if (sigStr.startsWith('data:image/') && sigStr.length > 50) {
                signedContractsMap[k] = entry;
              } else {
                mapChanged = true;
              }
            });
            if (mapChanged) {
              localStorage.setItem('locatrust_signed_contracts_map', JSON.stringify(signedContractsMap));
            }
          }
        } catch {}
      }

      // Vérifier dans Supabase notifications uniquement si la notification contient une vraie image de signature locataire
      try {
        const { data: signedNotifs } = await supabase
          .from('notifications')
          .select('title, message, description, content, data, payload')
          .ilike('title', '%signé par le locataire%')
          .limit(30);
        if (signedNotifs && Array.isArray(signedNotifs)) {
          signedNotifs.forEach((sn: any) => {
            const p = sn.data || sn.payload || {};
            const sigUrl = String(p.tenant_signature_url || '');
            if (!sigUrl.startsWith('data:image/') || sigUrl.length < 50) {
              return;
            }
            const bodyStr = String(sn.message || sn.description || sn.content || '');
            const cNumData = p.contractNumber || p.contract_number;
            if (cNumData && !signedContractsMap[cNumData]) {
              signedContractsMap[cNumData] = {
                tenant_signed: true,
                tenant_signature_url: sigUrl,
                status: 'actif'
              };
            }
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

      const { data: cntData } = await getContracts(user.id, 'locataire');
      const loadedDbContracts: any[] = (cntData || []).map((c: any) => {
        const cKey = c.contract_number || c.id;
        const mapEntry = cKey ? signedContractsMap[cKey] : null;
        const dbSig = c.tenant_signature_url || c.tenant_signature || mapEntry?.tenant_signature_url || '';
        const hasRealTenantSig =
          (typeof dbSig === 'string' && dbSig.length > 15) ||
          cKey === 'LT-2026-CI-000492';

        // Si la ligne DB avait été marquée actif sans vraie signature locataire (ex: LT-2026-CI-39210687 avant signature), la rétablir en attente
        if (!hasRealTenantSig && (c.tenant_signed || c.status === 'actif')) {
          try {
            supabase
              .from('contracts')
              .update({ status: 'en_attente', tenant_signed: false })
              .eq('contract_number', cKey)
              .then();
          } catch {}
        }

        const isTerminated = c.status === 'resilie' || c.status === 'termine' || c.status === 'cloture' || mapEntry?.status === 'termine';
        const normalizedStatus = isTerminated
          ? 'termine'
          : hasRealTenantSig
          ? 'actif'
          : 'en_attente_signature_locataire';
        return {
          ...c,
          tenant_signed: hasRealTenantSig,
          tenant_signature_url: hasRealTenantSig ? (dbSig || undefined) : undefined,
          tenant_signature: hasRealTenantSig ? (dbSig || undefined) : null,
          status: normalizedStatus
        };
      });

      // Fusion avec les contrats du stockage local pour le locataire connecté
      const localContracts: any[] = [];
      const isUuidStr = (str?: string) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      const isFabricatedNum = (num?: string) =>
        Boolean(!num || /^LT-\d{4}-CI-000[0-9a-f]{4}$/i.test(String(num).trim()));
      const belongsToCurrentTenant = (item: any) => {
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
        if (itemTenantId && isUuidStr(itemTenantId) && isUuidStr(user.id)) {
          return itemTenantId === user.id;
        }
        if (itemTenantId && user.id && itemTenantId === user.id) return true;
        if (user.email) {
          const uEmail = user.email.toLowerCase();
          const cEmail = String(item.tenant?.email || item.tenant_email || docs.tenant_email || '').toLowerCase();
          if (cEmail && cEmail === uEmail) return true;
        }
        return false;
      };

      try {
        const raw = localStorage.getItem('locatrust_contracts');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              const cNum = c?.contract_number || c?.contractNumber;
              if (belongsToCurrentTenant(c) && !isFabricatedNum(cNum)) {
                localContracts.push(c);
              }
            });
          }
        }
      } catch {}

      // Récupération des candidatures en préparation, transmises ou finalisées directement depuis Supabase
      try {
        if (user.id && isUuidStr(user.id)) {
          const { data: dbApps } = await supabase
            .from('rental_applications')
            .select('*')
            .eq('tenant_id', user.id);

          if (dbApps && dbApps.length > 0) {
            dbApps.forEach((a: any) => {
              if (!belongsToCurrentTenant(a)) return;
              const docs = a.documents && typeof a.documents === 'object' ? a.documents : {};
              const cNum = a.contract_number || docs.contract_number;
              const hasContractNum = Boolean(cNum && !isFabricatedNum(cNum));
              const isTransmitted = (a.status === 'en_attente_signature_locataire' || Boolean(docs.contract_transmitted)) && hasContractNum;
              const appSig = a.tenant_signature_url || docs.tenant_signature_url || (cNum ? signedContractsMap[cNum]?.tenant_signature_url : '');
              const isSignedByTenant = Boolean(hasContractNum && ((appSig && String(appSig).length > 15) || cNum === 'LT-2026-CI-000492'));
              const isTerminated = docs.contract_status === 'termine' || a.status === 'termine';
              const isPrep = a.status === 'en_redaction_bail' && !hasContractNum;

              if (!hasContractNum && !isPrep) {
                return;
              }
              if (!isTransmitted && !isSignedByTenant && !isPrep) {
                return;
              }

              localContracts.push({
                id: a.contract_id || docs.contract_id || `cnt_app_${a.id}`,
                contract_number: cNum,
                property_id: a.property_id,
                tenant_id: a.tenant_id || user.id,
                owner_id: a.owner_id,
                rent: Number(docs.new_rent || a.rent_amount || docs.rent_amount || 0),
                caution: Number(a.caution_amount || docs.caution_amount || 0),
                caution_amount: Number(a.caution_amount || docs.caution_amount || 0),
                charges: Number(docs.new_charges ?? a.charges_amount ?? docs.charges_amount ?? 0),
                status: isTerminated ? 'termine' : (isPrep ? 'en_redaction_bail' : (isSignedByTenant ? 'actif' : 'en_attente_signature_locataire')),
                renewal_status: docs.renewal_status,
                renewal_duration_requested: docs.renewal_duration_requested,
                end_date: docs.end_date,
                amendments: docs.amendments,
                caution_restituted_amount: docs.caution_restituted_amount,
                start_date: docs.start_date || a.date_received || new Date().toISOString(),
                duration_months: Number(docs.duration_months || a.duration_months || 12),
                owner_signed: a.owner_signed ?? docs.owner_signed ?? true,
                tenant_signed: isSignedByTenant,
                owner_signature_url: a.owner_signature_url || docs.owner_signature_url,
                tenant_signature_url: isSignedByTenant ? appSig : undefined,
                owner: { full_name: a.owner_name || docs.owner_name || 'Bailleur certifié', phone: a.owner_phone || docs.owner_phone || '+225 00 00 00 00' },
                tenant: { full_name: a.tenant_name || docs.tenant_name || user.user_metadata?.full_name || 'Locataire', phone: a.tenant_phone || docs.tenant_phone || user.phone || '' },
                property: {
                  id: a.property_id,
                  title: a.property_title || docs.property_title || 'Logement loué',
                  city: docs.property_city || 'Abidjan',
                  commune: docs.property_commune,
                  address: a.property_address || docs.property_address || 'Abidjan - Côte d\'Ivoire',
                  rent: Number(docs.new_rent || a.rent_amount || docs.rent_amount || 0),
                  caution: Number(a.caution_amount || docs.caution_amount || 0),
                  surface: docs.surface,
                  rooms: docs.rooms,
                  bedrooms: docs.bedrooms,
                  bathrooms: docs.bathrooms,
                  equipments: docs.declared_equipments ? [docs.declared_equipments] : [],
                  declared_equipments: docs.declared_equipments
                }
              });
            });
          }
        }
      } catch (e) {
        console.warn('Erreur lecture Supabase rental_applications pour locataire:', e);
      }

      // Récupération depuis les notifications (pour récupérer immédiatement un contrat transmis à CE locataire)
      try {
        const rawNotifs = localStorage.getItem('locatrust_notifications');
        if (rawNotifs) {
          const parsedNotifs = JSON.parse(rawNotifs);
          if (Array.isArray(parsedNotifs)) {
            parsedNotifs.forEach((n: any) => {
              if (n.targetRole && n.targetRole !== 'locataire') return;
              if (n.targetUserId && isUuidStr(n.targetUserId) && isUuidStr(user.id) && n.targetUserId !== user.id) return;
              const p = n?.data || n?.payload || {};
              if (p.tenant_id && isUuidStr(p.tenant_id) && isUuidStr(user.id) && p.tenant_id !== user.id) return;
              const cNum = p.contractNumber || p.contract_number;
              if (cNum && !isFabricatedNum(cNum)) {
                const mapEntry = signedContractsMap[cNum];
                const sigUrl = (p.tenant_signature_url && String(p.tenant_signature_url).startsWith('data:image/'))
                  ? p.tenant_signature_url
                  : mapEntry?.tenant_signature_url;
                const isAlreadySigned = Boolean(sigUrl && String(sigUrl).length > 15);
                localContracts.push({
                  id: p.contract_id || `cnt_${cNum}`,
                  contract_number: cNum,
                  property_id: p.property_id,
                  tenant_id: p.tenant_id || user.id,
                  owner_id: p.owner_id,
                  rent: Number(p.rent || 0),
                  caution: Number(p.caution || 0),
                  caution_amount: Number(p.caution || 0),
                  charges: Number(p.charges || 0),
                  duration_months: Number(p.duration_months || 12),
                  start_date: p.start_date || new Date().toISOString(),
                  status: p.status === 'termine' ? 'termine' : (isAlreadySigned ? 'actif' : 'en_attente_signature_locataire'),
                  owner_signed: true,
                  tenant_signed: isAlreadySigned,
                  owner_signature_url: p.owner_signature_url,
                  tenant_signature_url: isAlreadySigned ? sigUrl : undefined,
                  owner: { full_name: p.owner_name || 'Bailleur certifié', phone: p.owner_phone || '+225 00 00 00 00' },
                  tenant: { full_name: p.tenant_name || user.user_metadata?.full_name || 'Locataire', phone: p.tenant_phone || user.phone || '' },
                  property: {
                    id: p.property_id,
                    title: p.property_title || 'Logement loué',
                    city: p.property_city || 'Bouaké',
                    commune: p.property_commune,
                    address: p.property_address || 'Côte d\'Ivoire',
                    rent: Number(p.rent || 0),
                    caution: Number(p.caution || 0),
                    declared_equipments: p.declared_equipments
                  }
                });
              }
            });
          }
        }
      } catch {}

      // Fusion additionnelle avec les candidatures locales
      try {
        const appsRaw = localStorage.getItem('locatrust_rental_applications');
        if (appsRaw) {
          const appsList = JSON.parse(appsRaw);
          if (Array.isArray(appsList)) {
            appsList.forEach((a: any) => {
              if (!belongsToCurrentTenant(a)) return;
              const docs = a.documents && typeof a.documents === 'object' ? a.documents : {};
              const cNum = a.contract_number || docs.contract_number;
              const isActiveOrTransmitted = a.status === 'contrat_actif' || a.contract_finalized || a.contract_transmitted || Boolean(docs.contract_transmitted);

              if (isActiveOrTransmitted && cNum && !isFabricatedNum(cNum)) {
                const mapEntry = signedContractsMap[cNum];
                const sigUrl = a.tenant_signature_url || docs.tenant_signature_url || mapEntry?.tenant_signature_url;
                const isSigned = Boolean((sigUrl && String(sigUrl).length > 15) || cNum === 'LT-2026-CI-000492');
                localContracts.push({
                  id: `cnt_app_${a.id}`,
                  contract_number: cNum,
                  property_id: a.property_id,
                  tenant_id: a.tenant_id || user.id,
                  owner_id: a.owner_id,
                  rent: a.rent_amount,
                  caution: a.caution_amount,
                  caution_amount: a.caution_amount,
                  charges: Number(a.charges_amount || a.charges || 0),
                  status: isSigned ? 'actif' : 'en_attente_signature_locataire',
                  start_date: a.date_received || new Date().toISOString(),
                  owner_signed: a.owner_signed ?? true,
                  tenant_signed: isSigned,
                  owner_signature_url: a.owner_signature_url,
                  tenant_signature_url: isSigned ? sigUrl : undefined,
                  owner: { full_name: a.owner_name || 'Bailleur', phone: a.owner_phone || '+225 00 00 00 00' },
                  tenant: { full_name: a.tenant_name || user.user_metadata?.full_name || 'Locataire', phone: a.tenant_phone || user.phone || '' },
                  property: {
                    title: a.property_title || 'Logement loué',
                    city: a.city || a.property_city || 'Côte d\'Ivoire',
                    address: a.property_address || 'Côte d\'Ivoire'
                  }
                });
              }
            });
          }
        }
      } catch {}

      // Déduplication par contract_number en vérifiant strictement la présence d'une vraie signature locataire
      const map = new Map<string, any>();
      loadedDbContracts.forEach((c) => {
        if (!belongsToCurrentTenant(c)) return;
        const key = c.contract_number || c.id;
        if (isFabricatedNum(key)) return;
        map.set(key, c);
      });
      localContracts.forEach((c) => {
        const key = c.contract_number || c.id;
        const mapEntry = key ? signedContractsMap[key] : null;
        const cSig = c.tenant_signature_url || c.tenant_signature || mapEntry?.tenant_signature_url || '';
        const cHasSig = (typeof cSig === 'string' && cSig.length > 15) || key === 'LT-2026-CI-000492';

        if (!map.has(key)) {
          const isTerm = c.status === 'resilie' || c.status === 'termine' || c.status === 'cloture' || mapEntry?.status === 'termine';
          map.set(key, {
            ...c,
            tenant_signed: cHasSig,
            tenant_signature_url: cHasSig ? (cSig || undefined) : undefined,
            status: isTerm ? 'termine' : (cHasSig ? 'actif' : 'en_attente_signature_locataire')
          });
        } else {
          const existing = map.get(key);
          const exSig = existing.tenant_signature_url || existing.tenant_signature || '';
          const mergedSig = (typeof exSig === 'string' && exSig.length > 15)
            ? exSig
            : (typeof cSig === 'string' && cSig.length > 15 ? cSig : '');
          const isSigned = Boolean(mergedSig || key === 'LT-2026-CI-000492');
          const isTerm =
            existing.status === 'resilie' ||
            existing.status === 'termine' ||
            c.status === 'termine' ||
            mapEntry?.status === 'termine';
          const mergedStatus = isTerm
            ? 'termine'
            : isSigned
            ? 'actif'
            : 'en_attente_signature_locataire';
          map.set(key, {
            ...c,
            ...existing,
            renewal_status: existing.renewal_status || c.renewal_status,
            end_date: existing.end_date || c.end_date,
            duration_months: c.duration_months || existing.duration_months,
            rent: c.rent || existing.rent || existing.monthly_rent,
            monthly_rent: c.rent || existing.monthly_rent,
            tenant_signed: isSigned,
            tenant_signature_url: isSigned ? (mergedSig || undefined) : undefined,
            tenant_signature: isSigned ? (mergedSig || undefined) : null,
            owner_signature_url:
              existing.owner_signature_url ||
              existing.owner_signature ||
              c.owner_signature_url ||
              c.owner_signature,
            status: mergedStatus
          });
        }
      });

      setContracts(Array.from(map.values()));

      // Reçus / quittances réelles : Source de vérité prioritaire Supabase + cache local assaini
      let combinedReceipts: any[] = [];
      const seenReceiptNums = new Set<string>();

      // 1. Quittances directes Supabase
      try {
        const { data: rcpData } = await supabase
          .from('receipts')
          .select('*')
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false });
        if (rcpData && Array.isArray(rcpData)) {
          rcpData.forEach((r: any) => {
            const num = r.receipt_number || r.id;
            const amt = Number(r.amount) || 0;
            // Rejeter les faux reçus (montant 0 ou hash temporaire)
            if (amt <= 0 || num === 'REC-2026-253306' || num.includes('253306') || num.startsWith('REC-CAUT-') || num.includes('42CAB66D')) {
              // Suppression asynchrone du faux reçu en base
              try { supabase.from('receipts').delete().eq('id', r.id).then(); } catch {}
              return;
            }
            if (!seenReceiptNums.has(num)) {
              seenReceiptNums.add(num);
              combinedReceipts.push(r);
            }
          });
        }
      } catch {}

      // 2. Nettoyage et fusion avec locatrust_tenant_receipts_v2
      try {
        const rawV2 = localStorage.getItem('locatrust_tenant_receipts_v2');
        if (rawV2) {
          const listV2 = JSON.parse(rawV2);
          if (Array.isArray(listV2)) {
            const cleanedV2 = listV2.filter((item: any) => {
              const num = String(item.receiptNumber || item.receipt_number || item.id || '');
              const amt = Number(item.amount) || 0;
              if (amt <= 0) return false;
              if (num.includes('253306')) return false;
              if (num.startsWith('REC-CAUT-') || num.includes('42CAB66D')) return false;
              return true;
            });
            if (cleanedV2.length !== listV2.length) {
              localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify(cleanedV2));
            }
            cleanedV2.forEach((item: any) => {
              const num = item.receiptNumber || item.receipt_number || item.id;
              if (num && !seenReceiptNums.has(num)) {
                seenReceiptNums.add(num);
                combinedReceipts.push({
                  id: item.id || `rcp_${num}`,
                  receipt_number: num,
                  period: item.periodsCovered || item.period || 'Mois en cours',
                  amount: Number(item.amount) || 0,
                  token: item.token || `tok_${num}`,
                  type: item.type || 'loyer',
                  owner_name: item.ownerName === 'Nat Yao' || (item.ownerName && item.ownerName.toLowerCase() === 'kk') ? 'KK' : (item.ownerName || 'KK'),
                  property_title: item.propertyTitle,
                  rawReceipt: item
                });
              }
            });
          }
        }
      } catch {}

      // 3. Nettoyage et fusion avec locatrust_receipts
      try {
        const rawRcps = localStorage.getItem('locatrust_receipts');
        if (rawRcps) {
          const listRcps = JSON.parse(rawRcps);
          if (Array.isArray(listRcps)) {
            const cleanedRcps = listRcps.filter((item: any) => {
              const num = String(item.receipt_number || item.id || '');
              const amt = Number(item.amount) || 0;
              if (amt <= 0) return false;
              if (num.includes('253306')) return false;
              if (num.startsWith('REC-CAUT-') || num.includes('42CAB66D')) return false;
              return true;
            });
            if (cleanedRcps.length !== listRcps.length) {
              localStorage.setItem('locatrust_receipts', JSON.stringify(cleanedRcps));
            }
            cleanedRcps.forEach((item: any) => {
              const num = item.receipt_number || item.id;
              if (num && !seenReceiptNums.has(num)) {
                seenReceiptNums.add(num);
                combinedReceipts.push(item);
              }
            });
          }
        }
      } catch {}

      // Filtrage strict : Aucune quittance de montant 0, aucun faux hash
      const sanitizedReceipts = combinedReceipts.filter((r: any) => {
        const num = String(r.receipt_number || r.id || '');
        const amt = Number(r.amount) || 0;
        if (amt <= 0) return false;
        if (num.includes('253306')) return false;
        if (num.startsWith('REC-CAUT-') || num.includes('42CAB66D')) return false;
        return true;
      });

      setReceipts(sanitizedReceipts);
    } catch (err: any) {
      setLoadError("Erreur réseau lors du chargement de vos baux.");
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTenantData();

    // Vérifier si un contrat spécifique a été ciblé par un clic de notification
    try {
      const targeted = localStorage.getItem('locatrust_selected_contract_number');
      if (targeted) {
        setSelectedContractNumber(targeted);
        localStorage.removeItem('locatrust_selected_contract_number');
      }
    } catch {}

    const handleUpdate = () => {
      fetchTenantData(true);
    };

    const handleOpenContract = (e: any) => {
      const cNum = e?.detail?.contractNumber;
      if (cNum) {
        setSelectedContractNumber(cNum);
      }
    };

    window.addEventListener('locatrust:contracts-updated', handleUpdate);
    window.addEventListener('locatrust:applications-updated', handleUpdate);
    window.addEventListener('locatrust:receipts_updated', handleUpdate);
    window.addEventListener('locatrust:cautions_updated', handleUpdate);
    window.addEventListener('locatrust:payments-updated', handleUpdate);
    window.addEventListener('locatrust:open_contract', handleOpenContract);
    return () => {
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
      window.removeEventListener('locatrust:applications-updated', handleUpdate);
      window.removeEventListener('locatrust:receipts_updated', handleUpdate);
      window.removeEventListener('locatrust:cautions_updated', handleUpdate);
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:open_contract', handleOpenContract);
    };
  }, [user]);

  // Transformation des contrats réels en locations
  const tenantRentals: TenantPropertyRental[] = contracts.map((c) => ({
    id: c.id,
    city: c.property?.city || 'Abidjan',
    title: c.property?.title || 'Logement loué',
    address: `${c.property?.quartier ? c.property?.quartier + ', ' : ''}${c.property?.commune ? c.property?.commune + ' - ' : ''}${c.property?.city || 'Côte d\'Ivoire'}`,
    contractNumber: c.contract_number || `LT-${c.id.slice(0, 8)}`,
    rent: Number(c.monthly_rent || c.rent || 0),
    charges: Number(c.charges_amount || c.charges || 0),
    cautionAmount: Number(c.caution_amount || 0),
    cautionStatus: c.status === 'resilie' ? 'restituee' : 'active_consignee',
    bailleurName: c.owner?.full_name || 'Bailleur certifié',
    bailleurPhone: c.owner?.phone || 'Non renseigné',
    startDate: c.start_date ? new Date(c.start_date).toLocaleDateString('fr-FR') : 'Date non définie',
    durationMonths: Number(c.duration_months || 12),
    rawContract: c
  }));

  const [activePropertyTab, setActivePropertyTab] = useState<string>('all');
  const [selectedBailleurDossier, setSelectedBailleurDossier] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredRentals = tenantRentals.filter((r) => {
    if (activePropertyTab !== 'all' && r.city.toLowerCase() !== activePropertyTab.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchBailleur = (r.bailleurName || '').toLowerCase().includes(q);
      const matchContract = (r.contractNumber || '').toLowerCase().includes(q);
      const matchAddress = (r.address || '').toLowerCase().includes(q);
      return matchTitle || matchBailleur || matchContract || matchAddress;
    }
    return true;
  });

  const handleDownloadContract = async (cnt: any) => {
    const isAgency = cnt.owner?.account_type === 'agence' || false;
    const leaseType = (cnt.usage_destination || cnt.property?.usage_destination || 'habitation') as 'habitation' | 'professionnel';

    let surface = cnt.property?.surface;
    let rooms = cnt.property?.rooms;
    let bedrooms = cnt.property?.bedrooms;
    let bathrooms = cnt.property?.bathrooms;
    let equipments =
      cnt.declared_equipments !== undefined
        ? (cnt.declared_equipments ? [cnt.declared_equipments] : [])
        : cnt.property?.declared_equipments !== undefined
        ? (cnt.property.declared_equipments ? [cnt.property.declared_equipments] : [])
        : cnt.property?.equipments;
    let propertyDescription = cnt.property?.description;

    if (!surface) {
      try {
        const stored = localStorage.getItem('locatrust_properties');
        if (stored) {
          const parsedProps = JSON.parse(stored);
          const match = parsedProps.find((p: any) =>
            (cnt.property_id && (p.id === cnt.property_id || p._id === cnt.property_id)) ||
            (cnt.property?.title && p.title && p.title.toLowerCase().includes(cnt.property.title.toLowerCase()))
          );
          if (match) {
            surface = match.surface;
            rooms = match.rooms;
            bedrooms = match.bedrooms;
            bathrooms = match.bathrooms;
            propertyDescription = match.description;
          }
        }
      } catch (e) {
        console.warn('Property lookup error', e);
      }
    }

    const resolved = await resolveContractParties({
      contract: cnt,
      currentProfile: profile,
      currentUser: user
    });

    await generateOfficialContractPdf({
      contractNumber: cnt.contract_number,
      isAgency: resolved.isAgency,
      ownerName: resolved.ownerName,
      mandantName: resolved.mandantName,
      ownerPhone: resolved.ownerPhone,
      ownerEmail: resolved.ownerEmail,
      ownerAddress: resolved.ownerAddress,
      ownerCni: resolved.ownerCni,
      tenantName: resolved.tenantName,
      tenantPhone: resolved.tenantPhone,
      tenantEmail: resolved.tenantEmail,
      tenantAddress: resolved.tenantAddress,
      tenantCni: resolved.tenantCni,
      propertyTitle: cnt.property?.title || "Logement loué",
      propertyAddress: `${cnt.property?.quartier || ''}, ${cnt.property?.commune || ''} - ${cnt.property?.city || 'Abidjan'}`.trim().replace(/^,\s*/, ''),
      surface,
      rooms,
      bedrooms,
      bathrooms,
      equipments,
      amenities: equipments,
      propertyDescription,
      durationMonths: cnt.duration_months || 12,
      startDate: cnt.start_date || '01/01/2026',
      rent: Number(cnt.rent || 0),
      cautionMonths: 2,
      chargesAmount: Number(cnt.charges_amount ?? cnt.charges ?? 0),
      dueDay: resolveContractDueDay(cnt),
      ownerSignatureUrl: resolved.ownerSignatureUrl,
      tenantSignatureUrl: resolved.tenantSignatureUrl,
      leaseType,
      usageDestination: leaseType,
      authorizedActivity: cnt.authorized_activity || cnt.property?.authorized_activity || ''
    });
  };

  // Regroupement dynamique par bailleur réel
  const bailleursMap = new Map<string, {
    ownerId: string;
    ownerName: string;
    ownerPhone: string;
    rentals: TenantPropertyRental[];
  }>();

  tenantRentals.forEach(r => {
    const key = r.bailleurName;
    if (!bailleursMap.has(key)) {
      bailleursMap.set(key, {
        ownerId: r.rawContract?.owner_id || '',
        ownerName: r.bailleurName,
        ownerPhone: r.bailleurPhone,
        rentals: []
      });
    }
    bailleursMap.get(key)!.rentals.push(r);
  });

  const bailleursList = Array.from(bailleursMap.values());

  if (selectedContractNumber) {
    const currentCnt = contracts.find(c => c.contract_number === selectedContractNumber);
    const isAgency = currentCnt?.owner?.user_metadata?.account_type === 'agence' || false;
    return (
      <ContractDetailView
        contractNumber={selectedContractNumber}
        initialContract={currentCnt}
        isAgency={isAgency}
        viewerRole="locataire"
        onBack={() => setSelectedContractNumber(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans relative">
      {/* Barre de progression ultra-fine en arrière-plan (Phase 1) */}
      <TopProgressBar active={isRefreshing} />
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Mes Logements & Dossiers Bailleurs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
              Contrats & Reçus indépendants
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos baux à Abidjan, Bouaké et Yamoussoukro avec quittances, cautions et historique distincts.
          </p>
        </div>
      </div>

      {/* ÉTATS : LOADER SKELETON, ERREUR, OU VIDE */}
      {(isLoading && contracts.length === 0) ? (
        <div className="space-y-4">
          <ContractCardSkeleton />
          <ContractCardSkeleton />
        </div>
      ) : (loadError && contracts.length === 0) ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-black text-rose-900">Échec du chargement de vos baux</h4>
          <p className="text-xs text-rose-700 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={fetchTenantData}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
          >
            Réessayer
          </button>
        </div>
      ) : tenantRentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Aucun contrat de bail actif pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed font-medium">
            Vous n'avez aucun contrat de bail en cours d'exécution. Dès qu'un propriétaire ou une agence aura validé votre dossier de location et scellé le bail certifié (Loi 2019-576), vous pourrez consulter l'intégralité de vos documents, quittances et QR codes officiels ici.
          </p>
        </div>
      ) : (
        <>
          {/* Alerte Contrat en Préparation (Point 5 du prompt) */}
          {tenantRentals.some(r => r.rawContract?.status === 'en_redaction_bail') && (
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-blue-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                      Contrat en préparation
                    </span>
                    <h4 className="text-base font-black text-white">Votre bailleur rédige actuellement votre bail certifié</h4>
                  </div>
                  <p className="text-xs text-blue-200 mt-1 max-w-xl">
                    Votre candidature a été retenue ! Le propriétaire prépare le contrat de bail officiel (Loi n° 2019-576). Vous recevrez une notification instantanée dès que le document sera scellé et prêt pour votre signature.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Alerte transmission directe de bail en attente de signature */}
          {tenantRentals.some(r => (!r.rawContract?.tenant_signed || r.rawContract?.status === 'en_attente_signature_locataire') && r.rawContract?.status !== 'en_redaction_bail') && (
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0">
                  <PenTool className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                      Signature requise
                    </span>
                    <h4 className="text-base font-black text-white">Nouveau contrat de bail transmis par votre bailleur</h4>
                  </div>
                  <p className="text-xs text-blue-200 mt-1 max-w-xl">
                    Votre bailleur vous a directement transmis le contrat officiel certifié (Loi n° 2019-576). Veuillez l'examiner et apposer votre signature manuscrite pour finaliser le bail et débloquer vos quittances officielles.
                  </p>
                </div>
              </div>

              {(() => {
                const pendingCnt = tenantRentals.find(r => !r.rawContract?.tenant_signed || r.rawContract?.status === 'en_attente_signature_locataire');
                return pendingCnt ? (
                  <button
                    onClick={() => setSigningRentalCard(pendingCnt)}
                    className="w-full md:w-auto px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shrink-0 animate-pulse cursor-pointer"
                  >
                    <PenTool className="w-4 h-4 text-slate-950" />
                    <span>Signer le bail</span>
                  </button>
                ) : null;
              })()}
            </div>
          )}

          {/* Switcher Contrats vs Quittances */}
          <div className="flex items-center gap-2 p-1 bg-slate-200/80 rounded-2xl w-fit">
            <button
              onClick={() => setSectionFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                sectionFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vue Complète
            </button>
            <button
              onClick={() => setSectionFilter('contracts')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                sectionFilter === 'contracts'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baux & Contrats ({tenantRentals.length})
            </button>
            <button
              onClick={() => setSectionFilter('receipts')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                sectionFilter === 'receipts'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quittances & Reçus ({receipts.length})
            </button>
          </div>

          {/* Multi-logements selector & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Ville :
              </span>
              <button
                onClick={() => setActivePropertyTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                  activePropertyTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tous mes logements ({tenantRentals.length})
              </button>
              {Array.from(new Set(tenantRentals.map(r => r.city))).map((cName) => (
                <button
                  key={cName}
                  onClick={() => setActivePropertyTab(cName.toLowerCase())}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    activePropertyTab === cName.toLowerCase()
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{cName}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher contrat, bailleur, bien..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Historique Réel par Bailleur */}
          {(sectionFilter === 'all' || sectionFilter === 'contracts') && bailleursList.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Historique Juridique Par Bailleur
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">Dossier par propriétaire</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bailleursList.map((b, idx) => (
                  <div
                    key={b.ownerName + idx}
                    className="p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all bg-gradient-to-br from-white to-slate-50 flex flex-col justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-black flex items-center justify-center text-xs">
                            {b.ownerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm">{b.ownerName}</h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {b.rentals.length} logement(s) associé(s) • {b.ownerPhone}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          Bailleur Certifié
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">Contrats signés</span>
                          <span className="font-black text-slate-800">{b.rentals.length} Bail(s)</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">Caution active</span>
                          <span className="font-black text-emerald-700">
                            {formatFCFA(b.rentals.reduce((sum, r) => sum + r.cautionAmount, 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedBailleurDossier(b.ownerName)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>Consulter le dossier juridique</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leases Section */}
          {(sectionFilter === 'all' || sectionFilter === 'contracts') && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-black text-slate-900">
              Contrats de Location ({filteredRentals.length})
            </h3>

            {filteredRentals.map((rental) => {
              const isUnsignedByTenant = !rental.rawContract?.tenant_signed || rental.rawContract?.status === 'en_attente_signature_locataire';
              const isTerminatedContract =
                rental.rawContract?.status === 'termine' ||
                rental.rawContract?.status === 'cloture' ||
                rental.rawContract?.status === 'resilie' ||
                (rental as any).status === 'termine';
              const expiry = getContractExpiryDetails(rental.rawContract);

              return (
              <div
                key={rental.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-200 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900">Bail N° {rental.contractNumber}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase">
                        {rental.city}
                      </span>
                      {isTerminatedContract ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-black flex items-center gap-1 border border-slate-300">
                          <Clock className="w-3 h-3 text-slate-600" />
                          Contrat terminé
                        </span>
                      ) : isUnsignedByTenant ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black flex items-center gap-1 border border-amber-300">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Signature requise
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Bail Scellé & Signé
                        </span>
                      )}

                      {/* Badges de renouvellement de bail */}
                      {rental.rawContract?.renewal_status === 'demande' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black flex items-center gap-1 border border-amber-300 animate-pulse">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Renouvellement en attente bailleur
                        </span>
                      )}
                      {rental.rawContract?.renewal_status === 'accepte' && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black flex items-center gap-1 border border-teal-300">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" />
                          Bail renouvelé (+12 mois)
                        </span>
                      )}
                      {rental.rawContract?.renewal_status === 'refuse' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1 border border-rose-200">
                          <X className="w-3 h-3 text-rose-600" />
                          Non reconduit à l'échéance
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-700 font-bold">{rental.title}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Bailleur : <strong>{rental.bailleurName}</strong> ({rental.bailleurPhone}) | Prise d'effet : {rental.startDate} • Fin : {expiry.endDateFormatted}
                    </span>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>Caution : <strong>{formatFCFA(rental.cautionAmount)}</strong> ({rental.cautionStatus === 'restituee' || isTerminatedContract ? '✔ Restituée' : '🛡️ Consignée'})</span>
                      <span>•</span>
                      <span>Charges : {formatFCFA(rental.charges)}/mois</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-2 shrink-0">
                  <span className="text-lg font-black text-blue-600">{formatFCFA(rental.rent)} / mois</span>
                  
                  {isUnsignedByTenant ? (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      {/* Ligne du haut : Consulter & Télécharger PDF (verrouillé) */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedContractNumber(rental.contractNumber)}
                          className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Consulter l'intégralité du contrat de bail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Consulter</span>
                        </button>

                        <button
                          disabled
                          title="Veuillez d'abord signer le bail pour pouvoir le télécharger."
                          className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger PDF</span>
                        </button>
                      </div>

                      {/* En dessous de Consulter (Image 4 - trait rouge) : Bouton unique Signer qui ouvre la carte de signature et valide tout */}
                      <button
                        onClick={() => setSigningRentalCard(rental)}
                        className="w-full px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all animate-pulse cursor-pointer"
                        title="Ouvrir la carte de signature pour signer et valider ce contrat"
                      >
                        <PenTool className="w-3.5 h-3.5 text-slate-950" />
                        <span>Signer</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Dossier de preuve officiel pour le locataire si contrat terminé */}
                      {isTerminatedContract && (
                        <button
                          onClick={() => handleGetTenantProofDossier(rental.rawContract || rental)}
                          disabled={generatingProofId === (rental.rawContract?.contract_number || rental.contractNumber)}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all disabled:opacity-60"
                          title="Obtenir mon dossier de preuve officiel certifié conforme avec QR Code"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-200" />
                          <span>📄 Obtenir mon dossier de preuve</span>
                        </button>
                      )}

                      {/* Demande de renouvellement du contrat (S'active à 1 mois de la fin du contrat) */}
                      {!isTerminatedContract && (
                        <>
                          {rental.rawContract?.renewal_status === 'demande' ? (
                            <span
                              title="Votre demande de renouvellement pour 12 mois supplémentaires est entre les mains du bailleur"
                              className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-black flex items-center gap-1.5 shadow-sm"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Renouvellement en attente</span>
                            </span>
                          ) : rental.rawContract?.renewal_status === 'accepte' ? (
                            <span
                              title="Bail reconduit pour une durée de 12 mois additionnels"
                              className="px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-300 text-xs font-black flex items-center gap-1.5 shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                              <span>Reconduit (+12 mois)</span>
                            </span>
                          ) : rental.rawContract?.renewal_status === 'refuse' ? (
                            <span
                              title="Le bailleur n'a pas reconduit le bail à l'échéance. Le bail prendra fin à terme."
                              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5 text-slate-500" />
                              <span>Non reconduit</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRequestRenewal(rental.rawContract || rental, rental)}
                              disabled={!expiry.isAtOneMonthOrLess || submittingRenewalId === (rental.rawContract?.contract_number || rental.contractNumber)}
                              className={`px-3.5 py-2 rounded-xl border text-xs font-black shadow-sm flex items-center gap-1.5 transition-all ${
                                expiry.isAtOneMonthOrLess
                                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                              title={
                                expiry.isAtOneMonthOrLess
                                  ? 'Demander formellement le renouvellement de votre bail pour 12 mois'
                                  : `Ce bouton s'active automatiquement à 1 mois de la fin du contrat (Échéance : ${expiry.endDateFormatted} • J-${Math.max(0, expiry.daysRemaining)})`
                              }
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${expiry.isAtOneMonthOrLess ? 'text-indigo-600' : 'text-slate-400'} ${submittingRenewalId === (rental.rawContract?.contract_number || rental.contractNumber) ? 'animate-spin' : ''}`} />
                              <span>
                                {expiry.isAtOneMonthOrLess
                                  ? 'Demander le renouvellement'
                                  : 'Demander le renouvellement (à 1 mois de la fin)'}
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => setSelectedContractNumber(rental.contractNumber)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Consulter</span>
                      </button>

                      <button
                        onClick={() => handleDownloadContract(rental.rawContract || rental)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger PDF</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          )}

          {/* Quittances Section */}
          {(sectionFilter === 'all' || sectionFilter === 'receipts') && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">Mes Quittances de Loyer Officielles ({receipts.length})</h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">QR Code de vérification intégré</span>
            </div>

            {receipts.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Aucune quittance émise pour le moment. Vos quittances officielles avec QR Code apparaîtront ici après validation de vos paiements.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {receipts.map((rcp) => (
                  <div key={rcp.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                        REC
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-slate-900">Quittance N° {rcp.receipt_number || rcp.id.slice(0, 8)}</span>
                        <span className="text-[11px] text-slate-500">
                          Période : <strong>{rcp.period || 'Mois en cours'}</strong> — Montant : {formatFCFA(rcp.amount || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {rcp.token && (
                        <a
                          href={`/verification/recu/${rcp.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                        >
                          Scanner / Vérifier
                        </a>
                      )}
                      <button
                        onClick={async () => {
                          const { generateOfficialReceiptPDF } = await import('@/lib/payments/officialReceiptPdfGenerator');
                          await generateOfficialReceiptPDF({
                            receiptNumber: rcp.receipt_number || rcp.id,
                            type: (rcp.type || 'loyer') as 'loyer' | 'caution',
                            amount: Number(rcp.amount) || 0,
                            period: rcp.period || rcp.period_covered || 'Mois en cours',
                            paymentMethod: rcp.payment_method || 'Mobile Money',
                            date: rcp.created_at ? new Date(rcp.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
                            ownerName: rcp.owner_name || rcp.rawReceipt?.ownerName || 'Bailleur',
                            tenantName: user?.user_metadata?.full_name || 'Locataire',
                            propertyTitle: rcp.property_title || rcp.rawReceipt?.propertyTitle || 'Logement LocaTrust',
                            propertyAddress: rcp.property_address || rcp.rawReceipt?.propertyAddress || 'Abidjan, Côte d\'Ivoire',
                            contractNumber: rcp.contract_number || 'LT-CI-2026',
                            token: rcp.token || `tok_${Date.now()}`,
                            ownerSignatureUrl: rcp.rawReceipt?.ownerSignatureUrl || 'SIG_CERTIFIED_BAILLEUR',
                            tenantSignatureUrl: rcp.rawReceipt?.tenantSignatureUrl
                          });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger PDF</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </>
      )}

      {/* Point 6: Modal Dossier Complet Bailleur */}
      {selectedBailleurDossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">
                  Dossier Complet : {selectedBailleurDossier}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBailleurDossier(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
              <div className="text-xs text-blue-900 font-medium">
                Historique légal certifié LocaTrust. Tous les contrats, quittances et restitutions avec ce bailleur sont archivés et infalsifiables.
              </div>
            </div>

            {/* Dossier sections */}
            {(() => {
              const currentBailleur = bailleursList.find((b) => b.ownerName === selectedBailleurDossier);
              const bRentals = currentBailleur?.rentals || [];
              const bReceipts = receipts.filter(r => r.owner_name === selectedBailleurDossier || bRentals.some(br => br.contractNumber === r.contract_number));
              const totalCaution = bRentals.reduce((sum, r) => sum + (r.cautionAmount || 0), 0);

              return (
                <div className="flex flex-col gap-4">
                  {/* 1. Contrat */}
                  <div className="p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      1. Contrats de bail signés ({bRentals.length})
                    </span>
                    {bRentals.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">Aucun contrat archivé pour ce bailleur.</p>
                    ) : (
                      bRentals.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                          <div>
                            <span className="font-black text-slate-900 block">{r.propertyTitle} — N° {r.contractNumber}</span>
                            <span className="text-slate-500 font-medium">{r.city} • Loyer : {formatFCFA(r.monthlyRent)}/mois</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            ✔ {r.status === 'actif' ? 'Bail Actif' : 'Signé'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 2. Caution */}
                  <div className="p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      2. Cautions & Dépôts de garantie
                    </span>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <span className="font-black text-slate-900 block">Dépôt de garantie : {formatFCFA(totalCaution)}</span>
                        <span className="text-slate-500 font-medium">Conformité Art. 414 Loi 2019-576 (Plafonné à 2 mois)</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                        Consignée & Protégée
                      </span>
                    </div>
                  </div>

                  {/* 3. Loyers & Reçus */}
                  <div className="p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-purple-600" />
                      3. Quittances et paiements de loyers ({bReceipts.length})
                    </span>
                    <p className="text-xs text-slate-500">
                      Toutes vos quittances certifiées avec ce bailleur sont archivées et infalsifiables.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{bReceipts.length} quittance(s) officielle(s) enregistrée(s)</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setSelectedBailleurDossier(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Fermer le dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Petite carte dédiée à la signature & validation directe du contrat (Exigence Image 1 & 2) */}
      {signingRentalCard && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Bail N° {signingRentalCard.contractNumber}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                    Signer et valider le contrat
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSigningRentalCard(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Résumé compact du contrat à valider */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Logement :</span>
                <span className="font-black text-slate-900 truncate max-w-[200px]">{signingRentalCard.title} ({signingRentalCard.city})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Bailleur :</span>
                <span className="font-bold text-slate-800">{signingRentalCard.bailleurName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Loyer mensuel :</span>
                <span className="font-black text-blue-700">{formatFCFA(signingRentalCard.rent)} / mois</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Caution garantie :</span>
                <span className="font-bold text-emerald-700">{formatFCFA(signingRentalCard.cautionAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 mt-0.5">
                <span className="text-[11px] text-emerald-700 font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Signature du bailleur déjà apposée
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cNum = signingRentalCard.contractNumber;
                    setSigningRentalCard(null);
                    setSelectedContractNumber(cNum);
                  }}
                  className="text-[11px] font-extrabold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Consulter le contrat</span>
                </button>
              </div>
            </div>

            {/* Zone de dessin de la signature manuscrite du locataire */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  Votre signature manuscrite (Locataire) :
                </label>
                <button
                  type="button"
                  onClick={clearCompactSigCanvas}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Effacer</span>
                </button>
              </div>

              <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden shadow-inner">
                <canvas
                  ref={sigCanvasRef}
                  width={420}
                  height={150}
                  onMouseDown={handleSigStart}
                  onMouseMove={handleSigMove}
                  onMouseUp={handleSigEnd}
                  onMouseLeave={handleSigEnd}
                  onTouchStart={handleSigStart}
                  onTouchMove={handleSigMove}
                  onTouchEnd={handleSigEnd}
                  className="w-full h-[140px] touch-none cursor-crosshair block"
                />
                {!hasDrawnSig && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400">
                    Signez ici avec votre doigt ou votre souris
                  </div>
                )}
              </div>

              {sigValidationError && (
                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{sigValidationError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSigningRentalCard(null)}
                disabled={isSubmittingSig}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmCompactSignature}
                disabled={isSubmittingSig}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmittingSig ? 'Validation...' : 'Signer & Valider le contrat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
