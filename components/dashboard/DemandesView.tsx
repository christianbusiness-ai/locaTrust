'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  FileText,
  MessageSquare,
  Eye,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Sparkles,
  ChevronRight,
  Filter,
  Send,
  X,
  ShieldCheck,
  Download,
  Check,
  Lock,
  PenTool,
  AlertTriangle
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { LegalContractGeneratorModal } from '@/components/contracts/LegalContractGeneratorModal';
import { SignatureModal } from '@/components/common/SignatureModal';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { resolveContractParties, persistOwnerSignature, getStoredOwnerSignature } from '@/lib/contractPartyResolver';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { notifyWaitingListCandidatesOnLeaseFinalized, pushGlobalNotification } from '@/lib/waitingListNotifications';
import { sendChatMessage, saveUserScopedContact, setActiveChatPartnerForUser } from '@/lib/messagingStore';
import { triggerCelebration } from '@/lib/celebration';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { updateRentalApplication } from '@/lib/supabase/services';
import { ApplicationCardSkeleton } from '@/components/common/SkeletonLoader';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { getDefaultRealisticAvatar } from '@/lib/avatarHelper';
import { UserAvatar } from '@/components/common/UserAvatar';

export interface RentalApplication {
  id: string;
  property_id: string;
  tenant_id?: string;
  tenant_name: string;
  tenant_avatar: string;
  tenant_phone: string;
  tenant_email: string;
  tenant_cni: string;
  property_title: string;
  property_address: string;
  rent_amount: number;
  caution_amount: number;
  date_received: string;
  status: 'en_attente' | 'validee' | 'liste_d_attente' | 'contrat_actif' | 'refusee';
  dossier_status: 'complet' | 'en_cours';
  tenant_signed?: boolean;
  tenant_signed_at?: string;
  tenant_signature_url?: string;
  owner_signed?: boolean;
  owner_signature_url?: string;
  contract_number?: string;
  contract_finalized?: boolean;
  unavailable_reason?: string;
  documents: {
    cni_url: string;
    quittances_url?: string;
    attestation_url?: string;
  };
}

interface DemandesViewProps {
  onOpenMessages?: (tenantId?: string) => void;
  onOpenContractGenerator?: (application?: RentalApplication) => void;
  isDemo?: boolean;
}

export const DemandesView: React.FC<DemandesViewProps> = ({
  onOpenMessages,
  onOpenContractGenerator,
  isDemo = false
}) => {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || profile?.id || 'usr_owner';
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedApplicationForContract, setSelectedApplicationForContract] = useState<RentalApplication | null>(null);
  const [contractModalStartStep, setContractModalStartStep] = useState<'form' | 'transmission'>('form');
  const [selectedDossierApp, setSelectedDossierApp] = useState<RentalApplication | null>(null);
  const [signingTenantApp, setSigningTenantApp] = useState<RentalApplication | null>(null);
  const [signingOwnerApp, setSigningOwnerApp] = useState<RentalApplication | null>(null);
  const [candidateAlert, setCandidateAlert] = useState<string | null>(null);

  // Auto-fermeture automatique de la bannière temporaire de notification (Point 8)
  useEffect(() => {
    if (candidateAlert) {
      const timer = setTimeout(() => {
        setCandidateAlert(null);
      }, 6500);
      return () => clearTimeout(timer);
    }
  }, [candidateAlert]);

  const loadFromDatabase = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Charger les propriétés enregistrées pour récupérer les vrais montants (loyer et caution)
      let storedProperties: any[] = [];
      if (typeof window !== 'undefined') {
        try {
          const rawProps = localStorage.getItem('locatrust_properties');
          if (rawProps) storedProperties = JSON.parse(rawProps);
        } catch {}
      }

      const getPropInfo = (propId: string, propTitle?: string) => {
        let found = storedProperties.find((p: any) => p && p.id === propId);
        if (!found && propTitle) {
          found = storedProperties.find(
            (p: any) => p && p.title && p.title.toLowerCase().trim() === propTitle.toLowerCase().trim()
          );
        }
        return found;
      };

      // 0. Synchronisation prioritaire depuis le serveur central (/api/sync)
      let serverApps: any[] = [];
      let localApps: RentalApplication[] = [];
      const userPropertyIds = new Set<string>();
      const userMandantIds = new Set<string>();

      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('locatrust_rental_applications');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localApps = parsed.filter(
                (a: any) =>
                  a &&
                  a.id !== 'app_demo_1' &&
                  a.id !== 'app_demo_2' &&
                  !a.id?.startsWith('app_demo_') &&
                  a.tenant_name !== 'Kouassi Jean-Philippe' &&
                  a.tenant_name !== 'Awa Touré' &&
                  a.property_id !== 'prop_cocody_1'
              );
            }
          }
        } catch {}
      }

      if (typeof window !== 'undefined' && user?.id) {
        try {
          const rawMandates = localStorage.getItem(`locatrust_mandants_${user.id}`) || localStorage.getItem('locatrust_agency_mandates');
          if (rawMandates) {
            const parsedM = JSON.parse(rawMandates);
            if (Array.isArray(parsedM)) {
              parsedM.forEach((m: any) => {
                if (m?.id && (!m.agency_id || m.agency_id === user.id)) {
                  userMandantIds.add(m.id);
                }
              });
            }
          }
        } catch {}
      }

      try {
        const effectiveRole = profile?.account_type === 'agence' || (profile?.role as string) === 'agence' ? 'agence' : (profile?.role || 'proprietaire');
        const syncUrl = user?.id ? `/api/sync?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(effectiveRole)}` : '/api/sync';
        const syncRes = await fetch(syncUrl);
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (syncJson?.success && Array.isArray(syncJson.data?.applications)) {
            serverApps = syncJson.data.applications;
          }
          if (syncJson?.data?.properties && Array.isArray(syncJson.data.properties)) {
            syncJson.data.properties.forEach((p: any) => {
              if (p.id && (p.owner_id === user?.id || p.agency_id === user?.id || !user?.id)) {
                userPropertyIds.add(p.id);
                if (p.mandant_id) userMandantIds.add(p.mandant_id);
              }
            });
          }
        }
      } catch (syncErr) {
        console.warn('API /api/sync applications notice:', syncErr);
      }

      for (const sa of serverApps) {
        if (!localApps.some(a => a.id === sa.id)) {
          localApps.unshift(sa);
        }
      }

      // 1. Récupérer les identifiants des biens appartenant au bailleur ou à l'agence connectée
      if (user?.id) {
        try {
          const { data: myProperties } = await supabase
            .from('properties')
            .select('id, mandant_id')
            .or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
          if (myProperties) {
            myProperties.forEach((p: any) => {
              userPropertyIds.add(p.id);
              if (p.mandant_id) userMandantIds.add(p.mandant_id);
            });
          }
        } catch (e) {
          console.warn('Erreur récupération propriétés utilisateur:', e);
        }
      }

      if (typeof window !== 'undefined') {
        try {
          const rawLocalProps = localStorage.getItem('locatrust_properties');
          if (rawLocalProps) {
            const parsedProps = JSON.parse(rawLocalProps);
            if (Array.isArray(parsedProps)) {
              parsedProps.forEach((p: any) => {
                if (p.id && (p.owner_id === user?.id || p.agency_id === user?.id || !user?.id)) {
                  userPropertyIds.add(p.id);
                  if (p.mandant_id) userMandantIds.add(p.mandant_id);
                }
              });
            }
          }
        } catch {}
      }

      // 2. Charger les candidatures réelles depuis la base de données Supabase
      const { data, error } = await supabase
        .from('rental_applications')
        .select('*')
        .order('created_at', { ascending: false });

      // Récupération des véritables profils pour les photos de profil (Point 6)
      const allRaw = [...(data || []), ...localApps, ...serverApps];
      const tenantIds = Array.from(new Set(allRaw.map((a: any) => a?.tenant_id).filter(Boolean)));
      const tenantEmails = Array.from(new Set(allRaw.map((a: any) => a?.tenant_email).filter(Boolean)));

      const tenantProfilesMap: Record<string, any> = {};
      if (tenantIds.length > 0) {
        try {
          const { data: profsById } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, phone, email')
            .in('id', tenantIds);
          if (profsById && Array.isArray(profsById)) {
            profsById.forEach((p) => {
              if (p?.id) tenantProfilesMap[p.id] = p;
              if (p?.email) tenantProfilesMap[p.email.toLowerCase()] = p;
              if (p?.avatar_url && !p.avatar_url.includes('ui-avatars.com') && typeof window !== 'undefined') {
                try { localStorage.setItem(`locatrust_user_avatar_${p.id}`, p.avatar_url); } catch {}
              }
            });
          }
        } catch (e) {
          console.warn('Erreur chargement profils par ID:', e);
        }
      }

      const missingEmails = tenantEmails.filter(em => em && !tenantProfilesMap[em.toLowerCase()]);
      if (missingEmails.length > 0) {
        try {
          const { data: profsByEmail } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, phone, email')
            .in('email', missingEmails);
          if (profsByEmail && Array.isArray(profsByEmail)) {
            profsByEmail.forEach((p) => {
              if (p?.email) tenantProfilesMap[p.email.toLowerCase()] = p;
              if (p?.id) tenantProfilesMap[p.id] = p;
              if (p?.avatar_url && !p.avatar_url.includes('ui-avatars.com') && typeof window !== 'undefined') {
                try { localStorage.setItem(`locatrust_user_avatar_${p.id}`, p.avatar_url); } catch {}
              }
            });
          }
        } catch (e) {
          console.warn('Erreur chargement profils par Email:', e);
        }
      }

      const enrichAppItem = (dbA: any): RentalApplication => {
        const pInfo = getPropInfo(dbA.property_id, dbA.property_title);
        const rent = Number(
          (pInfo && (pInfo.rent || pInfo.price))
            ? (pInfo.rent || pInfo.price)
            : (dbA.rent_amount || dbA.rent || dbA.property?.rent || 0)
        );
        const caution = Number(
          (pInfo && (pInfo.caution || pInfo.caution_amount))
            ? (pInfo.caution || pInfo.caution_amount)
            : (dbA.caution_amount || (pInfo?.rent ? Number(pInfo.rent) * 2 : 0) || (rent > 0 ? rent * 2 : 0))
        );

        // Vraie photo de profil récupérée depuis la table profiles (Point 6)
        const prof = (dbA.tenant_id && tenantProfilesMap[dbA.tenant_id]) ||
                     (dbA.tenant_email && tenantProfilesMap[dbA.tenant_email.toLowerCase()]) ||
                     (Object.values(tenantProfilesMap) as any[]).find((p: any) =>
                       p?.full_name && dbA.tenant_name && p.full_name.trim().toLowerCase() === dbA.tenant_name.trim().toLowerCase()
                     );
        const realProfileAvatar = prof?.avatar_url && !prof.avatar_url.includes('ui-avatars.com')
          ? prof.avatar_url
          : null;

        const effectiveAvatar =
          realProfileAvatar ||
          (dbA.tenant_avatar && !dbA.tenant_avatar.includes('ui-avatars.com') ? dbA.tenant_avatar : null) ||
          (typeof window !== 'undefined' && dbA.tenant_id
            ? localStorage.getItem(`locatrust_user_avatar_${dbA.tenant_id}`) ||
              localStorage.getItem(`locatrust_avatar_profile_${dbA.tenant_id}`)
            : null) ||
          undefined;

        if (realProfileAvatar && typeof window !== 'undefined' && dbA.tenant_id) {
          try { localStorage.setItem(`locatrust_user_avatar_${dbA.tenant_id}`, realProfileAvatar); } catch {}
        }

        return {
          ...dbA,
          property_title: pInfo?.title || dbA.property_title || dbA.property?.title || 'Bien immobilier',
          property_address: pInfo?.commune ? `${pInfo.commune}, ${pInfo.city || 'Abidjan'}` : (dbA.property_address || `${dbA.property?.location?.city || 'Abidjan'}`),
          rent_amount: rent,
          caution_amount: caution,
          date_received: dbA.date_received || (dbA.created_at ? new Date(dbA.created_at).toISOString().split('T')[0] : '2026-10-10'),
          dossier_status: dbA.dossier_status || 'complet',
          status: dbA.status || 'en_attente',
          tenant_name: prof?.full_name || dbA.tenant_name || 'Candidat Locataire',
          tenant_phone: prof?.phone || dbA.tenant_phone || '+225 07 00 00 00 00',
          tenant_email: prof?.email || dbA.tenant_email || '',
          tenant_avatar: effectiveAvatar,
          tenant_cni: dbA.tenant_cni || 'CI-ABJ-2024-B-89412',
          documents: dbA.documents && typeof dbA.documents === 'object' && !Array.isArray(dbA.documents)
            ? dbA.documents
            : { cni_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80' }
        };
      };

      const isAdmin = profile?.role === 'admin' || (user as any)?.role === 'admin';

      // Filtrer strictement les candidatures appartenant à l'utilisateur (Propriétaire ou Agence)
      const isRelevantForUser = (appItem: any) => {
        if (!appItem) return false;
        // Éliminer toute donnée fictive
        if (
          appItem.id === 'app_demo_1' ||
          appItem.id === 'app_demo_2' ||
          appItem.id?.startsWith('app_demo_') ||
          appItem.tenant_name === 'Kouassi Jean-Philippe' ||
          appItem.tenant_name === 'Awa Touré'
        ) {
          return false;
        }
        if (isAdmin) return true;
        if (!user?.id) return isDemo || !appItem.owner_id || appItem.owner_id === 'usr_owner' || appItem.agency_id === 'usr_agency' || appItem.owner_id === 'usr_agency';
        // Appartient strictement au bailleur ou à l'agence si c'est pour l'un de ses biens ou mandants
        return (
          appItem.owner_id === user.id ||
          appItem.agency_id === user.id ||
          appItem.mandant_id === user.id ||
          (Boolean(appItem.owner_id) && userMandantIds.has(appItem.owner_id)) ||
          (Boolean(appItem.mandant_id) && userMandantIds.has(appItem.mandant_id)) ||
          (Boolean(appItem.property_id) && userPropertyIds.has(appItem.property_id))
        );
      };

      const dbApps: RentalApplication[] = (data || [])
        .filter(isRelevantForUser)
        .map(enrichAppItem);

      const relevantLocalApps = localApps.filter(isRelevantForUser).map(enrichAppItem);
      
      // La base de données Supabase est la source de vérité absolue
      const localMap = new Map(relevantLocalApps.map((a) => [a.id, a]));
      const dbIds = new Set(dbApps.map((a) => a.id));

      const mergedDbApps = dbApps.map((dbItem) => {
        const localItem = localMap.get(dbItem.id);
        if (localItem) {
          const isLocalRetained =
            Boolean(localItem.candidate_selected) ||
            localItem.status === 'validee' ||
            localItem.status === 'en_attente_signature_locataire' ||
            localItem.status === 'contrat_signe_locataire';

          const effectiveStatus =
            isLocalRetained && dbItem.status === 'en_attente'
              ? localItem.status
              : dbItem.status;

          return {
            ...localItem,
            ...dbItem,
            status: effectiveStatus,
            // Préserver les indicateurs d'étape et signatures sans écrasement
            contract_transmitted: (dbItem as any).contract_transmitted ?? (localItem as any)?.contract_transmitted,
            tenant_signed: (dbItem as any).tenant_signed || (localItem as any)?.tenant_signed,
            candidate_selected: (dbItem as any).candidate_selected ?? localItem.candidate_selected,
            tenant_signature_url: (dbItem as any).tenant_signature_url || (localItem as any).tenant_signature_url,
            owner_signature_url: (dbItem as any).owner_signature_url || (localItem as any).owner_signature_url,
          };
        }
        return dbItem;
      });

      const combined = [
        ...relevantLocalApps.filter((a) => !dbIds.has(a.id)),
        ...mergedDbApps
      ];

      // Réconciliation avec les contrats réels (locatrust_contracts)
      let contractsList: any[] = [];
      try {
        const rawC = localStorage.getItem('locatrust_contracts');
        if (rawC) contractsList = JSON.parse(rawC);
      } catch {}

      const reconciledApps = combined.map((app) => {
        const matchingC = contractsList.find((c: any) =>
          (app.contract_number && (c.contract_number === app.contract_number || c.id === app.contract_number)) ||
          ((c.property_id === app.property_id || c.property?.id === app.property_id) &&
           (c.tenant_id === app.tenant_id || c.tenant?.id === app.tenant_id || c.tenant_name === app.tenant_name))
        );

        if (matchingC) {
          const isActif = matchingC.status === 'actif' || matchingC.status === 'contrat_actif';
          const isTransmitted = matchingC.status === 'en_attente_signature_locataire' || matchingC.status === 'transmis';
          const tenantSigned = Boolean(matchingC.tenant_signed || matchingC.tenant_signature || matchingC.tenant_signature_url);
          const ownerSigned = Boolean(matchingC.owner_signed || matchingC.owner_signature || matchingC.owner_signature_url);

          return {
            ...app,
            contract_number: matchingC.contract_number || app.contract_number,
            contract_transmitted: isTransmitted || Boolean(matchingC.contract_number) || (app as any).contract_transmitted,
            tenant_signed: tenantSigned || app.tenant_signed,
            owner_signed: ownerSigned || (app as any).owner_signed,
            tenant_signature_url: matchingC.tenant_signature || matchingC.tenant_signature_url || (app as any).tenant_signature_url,
            owner_signature_url: matchingC.owner_signature || matchingC.owner_signature_url || (app as any).owner_signature_url,
            status: isActif ? 'contrat_actif' : (tenantSigned ? 'contrat_signe_locataire' : (isTransmitted ? 'en_attente_signature_locataire' : app.status))
          };
        }
        return app;
      });

      setApplications(reconciledApps);
      if (typeof window !== 'undefined') {
        localStorage.setItem('locatrust_rental_applications', JSON.stringify(reconciledApps));
      }
    } catch (err: any) {
      console.warn('Erreur chargement candidatures:', err);
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFromDatabase();

    const handleAppsUpdated = () => {
      loadFromDatabase();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'locatrust_rental_applications' && e.newValue) {
        loadFromDatabase();
      }
    };
    window.addEventListener('locatrust:applications-updated', handleAppsUpdated);
    window.addEventListener('locatrust:contracts-updated', loadFromDatabase);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('locatrust:applications-updated', handleAppsUpdated);
      window.removeEventListener('locatrust:contracts-updated', loadFromDatabase);
      window.removeEventListener('storage', handleStorage);
    };
  }, [user?.id, profile?.role, profile?.account_type]);

  const saveApplications = (updated: RentalApplication[]) => {
    setApplications(updated);
    try {
      localStorage.setItem('locatrust_rental_applications', JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('locatrust:applications-updated', { detail: { updatedApps: updated } })
      );
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all',
          clientApplications: updated
        })
      }).catch(() => {});
    } catch (e) {
      console.warn(e);
    }
  };

  // Vérifier si un logement a déjà un contrat actif / finalisé (Point 4 & 5)
  const propertyHasActiveContract = (propertyId: string, propertyTitle?: string) => {
    // 1. Vérifier si un contrat actif finalisé existe dans les candidatures
    const hasActiveApp = applications.some((a) =>
      (a.property_id === propertyId || (propertyTitle && a.property_title === propertyTitle)) &&
      a.status === 'contrat_actif'
    );
    if (hasActiveApp) return true;

    // 2. Vérifier dans le registre officiel des contrats (locatrust_contracts) un contrat réellement actif
    try {
      const stored = localStorage.getItem('locatrust_contracts');
      if (stored) {
        const contracts = JSON.parse(stored);
        if (Array.isArray(contracts)) {
          return contracts.some((c: any) =>
            (c.property?.id === propertyId || c.property_id === propertyId || (propertyTitle && c.property?.title === propertyTitle)) &&
            (c.status === 'actif' || c.status === 'contrat_actif')
          );
        }
      }
    } catch {}

    return false;
  };

  // Choix d'un candidat : Met les concurrents en liste d'attente (NE PAS LES REFUSER TANT QUE LE CONTRAT N'EST PAS FINALISÉ - Points 3 & 4)
  const handleSelectAndSignWithCandidate = async (chosenApp: RentalApplication) => {
    // Contrôle d'état : si le logement est déjà pris
    if (propertyHasActiveContract(chosenApp.property_id, chosenApp.property_title)) {
      alert("Ce logement est déjà loué sous contrat actif. Impossible de sélectionner un nouveau candidat.");
      return;
    }

    const competingCandidates = applications.filter(
      (a) => (a.property_id === chosenApp.property_id || a.property_title === chosenApp.property_title) && a.id !== chosenApp.id
    );

    const updated = applications.map((app) => {
      if (app.id === chosenApp.id) {
        return {
          ...app,
          status: 'validee' as const,
          candidate_selected: true,
          tenant_signed: app.tenant_signed || false
        };
      }
      if (app.property_id === chosenApp.property_id || app.property_title === chosenApp.property_title) {
        // RÈGLE FONDAMENTALE (Points 3, 4, 5) : Les concurrents ne sont PAS refusés !
        // Ils passent en liste d'attente pendant que le contrat est en préparation / négociation.
        return {
          ...app,
          status: 'liste_d_attente' as const,
          candidate_selected: false
        };
      }
      return app;
    });

    saveApplications(updated);

    // Mettre à jour Supabase pour le candidat retenu et les concurrents (liste d'attente)
    try {
      await supabase.from('rental_applications').update({
        status: 'validee'
      }).eq('id', chosenApp.id);

      for (const comp of competingCandidates) {
        await supabase.from('rental_applications').update({
          status: 'liste_d_attente'
        }).eq('id', comp.id);
      }
    } catch (e) {
      console.warn('Erreur mise à jour Supabase sélection candidat:', e);
    }

    // Synchronisation persistante multi-appareils /api/sync
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_application',
          applicationId: chosenApp.id,
          updates: { status: 'validee', candidate_selected: true }
        })
      }).catch(() => {});

      for (const comp of competingCandidates) {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_application',
            applicationId: comp.id,
            updates: { status: 'liste_d_attente', candidate_selected: false }
          })
        }).catch(() => {});
      }
    } catch {}

    broadcastLiveEvent('APPLICATION_UPDATED', {
      actorId: user?.id,
      targetUserId: chosenApp.tenant_id,
      propertyId: chosenApp.property_id,
      data: { appId: chosenApp.id, status: 'validee' }
    });

    setSelectedApplicationForContract(null);

    // Notification temporaire ciblée (Points 7 & 8) : ne pas mentionner "les autres candidats" s'il n'y en a pas
    if (competingCandidates.length > 0) {
      setCandidateAlert(
        `✔ ${chosenApp.tenant_name} sélectionné pour « ${chosenApp.property_title} ». Les autres candidats ont été placés en liste d'attente. Vous pouvez maintenant préparer le contrat de bail.`
      );
    } else {
      setCandidateAlert(
        `✔ ${chosenApp.tenant_name} sélectionné pour « ${chosenApp.property_title} ». Vous pouvez maintenant préparer le contrat de bail.`
      );
    }
  };

  // Validation effective de la signature par le locataire (Étape 1 & 2)
  const handleConfirmTenantSignature = async (app: RentalApplication, signatureDataUrl?: string) => {
    const signedAt = new Date().toISOString();
    const sigUrl = signatureDataUrl || getCertifiedSignatureDataUrl(
      app.tenant_name,
      'locataire',
      (app as any).tenant_signature_url,
      `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    );
    const updated = applications.map((a) =>
      a.id === app.id
        ? {
            ...a,
            tenant_signed: true,
            tenant_signed_at: signedAt,
            tenant_signature_url: sigUrl,
            status: 'contrat_signe_locataire' as const
          }
        : a
    );
    saveApplications(updated);
    setSigningTenantApp(null);
    setCandidateAlert(
      `✍️ ${app.tenant_name} a apposé sa signature manuscrite certifiée ! Le bouton « Finaliser le contrat » est désormais actif pour le bailleur.`
    );
    try {
      await supabase.from('rental_applications').update({
        tenant_signed: true,
        tenant_signed_at: signedAt,
        status: 'contrat_signe_locataire'
      }).eq('id', app.id);
    } catch (e) {
      console.warn('Sync signature error:', e);
    }

    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_application',
          applicationId: app.id,
          updates: {
            tenant_signed: true,
            tenant_signed_at: signedAt,
            tenant_signature_url: sigUrl,
            status: 'contrat_signe_locataire'
          }
        })
      }).catch(() => {});
    } catch {}

    broadcastLiveEvent('CONTRACT_SIGNED_BY_TENANT', {
      actorId: user?.id,
      targetUserId: app.owner_id || currentUserId,
      propertyId: app.property_id,
      contractId: app.contract_number,
      data: { appId: app.id, signedAt }
    });
  };

  // Finalisation définitive du contrat par le propriétaire/agence
  const handleFinalizeContract = async (app: RentalApplication) => {
    // Contrôle 1 : Le locataire doit obligatoirement avoir signé et validé
    if (!app.tenant_signed) {
      alert("Le locataire n'a pas encore signé et validé sa signature. Le contrat ne peut être finalisé sans sa signature effective.");
      return;
    }

    // Contrôle 2 : Vérification de l'état réel du logement (impossible de signer 2 contrats simultanés)
    const propertyAlreadyTaken = applications.some(
      (a) => a.property_id === app.property_id && a.status === 'contrat_actif' && a.id !== app.id
    );
    if (propertyAlreadyTaken) {
      alert("Action refusée : Ce logement possède déjà un contrat actif en cours d'exécution.");
      return;
    }

    // Contrôle 3 : Signature manuscrite réelle du propriétaire / agence
    const existingOwnerSig = (app as any).owner_signature_url || getStoredOwnerSignature(user?.id);
    if (!existingOwnerSig) {
      // Déclencher le modal de signature interactive sur canvas pour le bailleur
      setSigningOwnerApp(app);
      return;
    }

    await handleExecuteFinalizeContract(app, existingOwnerSig);
  };

  const handleExecuteFinalizeContract = async (app: RentalApplication, ownerSigUrl: string) => {
    persistOwnerSignature(ownerSigUrl, user?.id);

    const contractNumber = app.contract_number || `LT-2026-CI-000${Math.floor(100 + Math.random() * 900)}`;

    const ownerName = profile?.full_name || user?.user_metadata?.full_name || "Bailleur";
    const ownerPhone = profile?.phone || "+225 07 00 00 00 00";
    const isAgencyUser = profile?.account_type === 'agence' || (profile?.role as string) === 'agence' || (profile?.role as string) === 'agent';
    const matchedProperty = getPropertyForApp(app.property_id);

    const tenantSigUrl = (app as any).tenant_signature_url || getCertifiedSignatureDataUrl(
      app.tenant_name,
      'locataire',
      null,
      `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    );

    // 1. Mettre à jour l'application retenue à 'contrat_actif'
    // 2. Mettre automatiquement toutes les autres demandes pour ce même logement à 'refusee'
    const competing = applications.filter(
      (a) => a.property_id === app.property_id && a.id !== app.id
    );
    const competingNames = competing.map((c) => c.tenant_name).join(', ');

    const updated = applications.map((a) => {
      if (a.id === app.id) {
        return {
          ...a,
          status: 'contrat_actif' as const,
          contract_finalized: true,
          contract_number: contractNumber,
          owner_signed: true,
          owner_signature_url: ownerSigUrl,
          tenant_signature_url: tenantSigUrl
        };
      }
      if (a.property_id === app.property_id) {
        return {
          ...a,
          status: 'refusee' as const,
          unavailable_reason: "Le logement demandé est déjà pris et n'est plus disponible."
        };
      }
      return a;
    });

    saveApplications(updated);

    // Synchronisation Supabase avec les colonnes exactes
    try {
      await supabase.from('rental_applications').update({
        status: 'contrat_actif',
        contract_finalized: true,
        contract_number: contractNumber
      }).eq('id', app.id);

      for (const comp of competing) {
        await supabase.from('rental_applications').update({
          status: 'refusee'
        }).eq('id', comp.id);
      }
    } catch (err) {
      console.warn('Supabase sync contract error:', err);
    }

    broadcastLiveEvent('CONTRACT_FINALIZED', {
      actorId: user?.id,
      targetUserId: app.tenant_id,
      propertyId: app.property_id,
      contractId: contractNumber,
      data: { appId: app.id, contractNumber }
    });

    // 3. Notifier automatiquement tous les candidats refusés
    try {
      notifyWaitingListCandidatesOnLeaseFinalized({
        propertyTitle: app.property_title,
        propertyAddress: app.property_address,
        chosenTenantName: app.tenant_name,
        contractNumber
      });
    } catch (e) {
      console.warn('Waiting list notification error:', e);
    }

    // 4. Enregistrer dans le registre des contrats et passer le bien au statut 'loue'
    try {
      // Mettre à jour le logement en 'loue' dans Supabase
      await supabase.from('properties').update({
        status: 'loue'
      }).eq('id', app.property_id);

      // Inscription du contrat officiel dans Supabase
      const isValidUuid = (str?: string) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      let targetTenantId = isValidUuid(app.tenant_id) ? app.tenant_id : null;
      if (!targetTenantId) {
        const { data: tenantProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('account_type', 'locataire')
          .limit(1)
          .maybeSingle();
        targetTenantId = tenantProfile?.id || null;
      }

      let targetOwnerId = user?.id && isValidUuid(user.id) ? user.id : (isValidUuid(matchedProperty?.owner_id) ? matchedProperty.owner_id : null);
      if (!targetOwnerId) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id')
          .in('account_type', ['proprietaire', 'agence'])
          .limit(1)
          .maybeSingle();
        targetOwnerId = ownerProfile?.id || null;
      }

      let targetPropId = isValidUuid(app.property_id) ? app.property_id : (isValidUuid(matchedProperty?.id) ? matchedProperty.id : null);
      if (!targetPropId) {
        const { data: userProps } = await supabase.from('properties').select('id').limit(1);
        if (userProps && userProps[0]?.id) {
          targetPropId = userProps[0].id;
        }
      }

      const contractUuid = crypto.randomUUID();

      if (targetPropId && targetTenantId && targetOwnerId) {
        const { error: insertErr } = await supabase.from('contracts').insert({
          id: contractUuid,
          contract_number: contractNumber,
          property_id: targetPropId,
          tenant_id: targetTenantId,
          owner_id: targetOwnerId,
          monthly_rent: Number(app.rent_amount || 0),
          caution_amount: Number(app.caution_amount || 0),
          charges_amount: Number(matchedProperty?.charges ?? 10000),
          duration_months: 12,
          status: 'actif',
          start_date: new Date().toISOString().split('T')[0],
          owner_signed: true,
          owner_signed_at: new Date().toISOString(),
          tenant_signed: true,
          tenant_signed_at: new Date().toISOString()
        });
        if (insertErr) {
          console.error('Erreur insertion Supabase contracts (DemandesView):', insertErr.message);
        } else {
          // Insérer la caution correspondante dans la table cautions de Supabase
          try {
            await supabase.from('cautions').upsert({
              id: crypto.randomUUID(),
              contract_id: contractUuid,
              tenant_id: targetTenantId,
              owner_id: targetOwnerId,
              amount_requested: Number(app.caution_amount || 0),
              amount_paid: Number(app.caution_amount || 0),
              status: 'caution_a_confirmer'
            });
          } catch {}

          // Diffuser l'événement temps réel
          try {
            broadcastLiveEvent('CONTRACT_FINALIZED', {
              contractId: contractUuid,
              actorId: targetOwnerId,
              targetUserId: targetTenantId,
              propertyId: targetPropId,
              data: { contractNumber, rent: app.rent_amount, caution: app.caution_amount }
            });
          } catch {}
        }
      }

      // Mettre à jour le statut du bien dans le localStorage pour disparition immédiate du Feed
      try {
        const rawProps = localStorage.getItem('locatrust_properties');
        if (rawProps) {
          const propsList = JSON.parse(rawProps);
          if (Array.isArray(propsList)) {
            const updatedProps = propsList.map((p: any) =>
              (p.id === app.property_id || p._id === app.property_id) ? { ...p, status: 'loue' } : p
            );
            localStorage.setItem('locatrust_properties', JSON.stringify(updatedProps));
          }
        }
      } catch {}

      const rawContracts = localStorage.getItem('locatrust_contracts');
      const currentContracts = rawContracts ? JSON.parse(rawContracts) : [];
      const newContractRecord = {
        id: contractUuid,
        contract_number: contractNumber,
        property_id: targetPropId || app.property_id,
        tenant_id: targetTenantId || app.tenant_id,
        owner_id: targetOwnerId || user?.id,
        rent: app.rent_amount,
        rent_amount: app.rent_amount,
        caution: app.caution_amount,
        caution_amount: app.caution_amount,
        charges: matchedProperty?.charges ?? 10000,
        payment_due_day: 5,
        duration_months: 12,
        owner: { id: user?.id, full_name: ownerName, phone: ownerPhone },
        tenant: { id: app.tenant_id, full_name: app.tenant_name, phone: app.tenant_phone, email: app.tenant_email },
        property: {
          id: app.property_id,
          title: app.property_title,
          location: { city: matchedProperty?.city || 'Abidjan', quartier: matchedProperty?.quartier || 'Riviera', commune: matchedProperty?.commune || 'Cocody' },
          surface: matchedProperty?.surface,
          rooms: matchedProperty?.rooms,
          bedrooms: matchedProperty?.bedrooms,
          bathrooms: matchedProperty?.bathrooms,
          equipments: matchedProperty?.equipments,
          status: 'loue'
        },
        surface: matchedProperty?.surface,
        rooms: matchedProperty?.rooms,
        bedrooms: matchedProperty?.bedrooms,
        bathrooms: matchedProperty?.bathrooms,
        equipments: matchedProperty?.equipments,
        owner_signature_url: ownerSigUrl,
        tenant_signature_url: tenantSigUrl,
        status: 'actif',
        signed_date: new Date().toLocaleDateString('fr-FR'),
        start_date: new Date().toLocaleDateString('fr-FR'),
        created_at: new Date().toISOString()
      };
      localStorage.setItem('locatrust_contracts', JSON.stringify([newContractRecord, ...currentContracts]));

      // Diffusion temps réel multi-appareils (Desktop ↔ Mobile)
      broadcastLiveEvent('CONTRACT_FINALIZED', {
        propertyId: app.property_id,
        contractId: contractNumber,
        targetUserId: app.tenant_id,
        data: { contract: newContractRecord }
      });
      broadcastLiveEvent('PROPERTY_RENTED', {
        propertyId: app.property_id,
        data: { status: 'loue' }
      });
    } catch (e) {
      console.warn('Contract storage error:', e);
    }

    triggerCelebration('success');

    setCandidateAlert(
      `🎉 Contrat N° ${contractNumber} définitivement finalisé avec ${app.tenant_name} pour « ${app.property_title} » ! Le logement est officiellement loué. ${
        competing.length > 0
          ? `Les autres candidats (${competingNames}) ont été automatiquement refusés et informés que le logement n'est plus disponible.`
          : ''
      }`
    );
  };

  const getPropertyForApp = (propId: string) => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('locatrust_properties');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find((p: any) => p.id === propId);
          if (found) return found;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  // Téléchargement du contrat finalisé au format PDF certifié
  const handleDownloadContract = async (app: RentalApplication) => {
    try {
      const matchedProperty = getPropertyForApp(app.property_id);
      const leaseType = (matchedProperty?.usage_destination || 'habitation') as 'habitation' | 'professionnel';

      const resolved = await resolveContractParties({
        app,
        matchedProperty,
        currentProfile: profile,
        currentUser: user
      });

      await generateOfficialContractPdf({
        contractNumber: app.contract_number || 'LT-2026-CI-000492',
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
        propertyTitle: app.property_title,
        propertyAddress: app.property_address,
        surface: matchedProperty?.surface,
        rooms: matchedProperty?.rooms,
        bedrooms: matchedProperty?.bedrooms,
        bathrooms: matchedProperty?.bathrooms,
        equipments: matchedProperty?.equipments,
        amenities: matchedProperty?.equipments,
        propertyDescription: matchedProperty?.description,
        durationMonths: app.duration_months || matchedProperty?.duration_months || (leaseType === 'professionnel' ? 24 : 12),
        startDate: app.signed_date || (app.signed_at ? new Date(app.signed_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')),
        rent: app.rent_amount,
        cautionMonths: matchedProperty?.caution_months || (leaseType === 'professionnel' ? 3 : 2),
        chargesAmount: matchedProperty?.charges !== undefined && matchedProperty?.charges !== null ? Number(matchedProperty.charges) : 0,
        dueDay: 5,
        ownerSignatureUrl: resolved.ownerSignatureUrl,
        tenantSignatureUrl: resolved.tenantSignatureUrl,
        isSignedCopy: true,
        leaseType,
        usageDestination: leaseType,
        authorizedActivity: matchedProperty?.authorized_activity || ''
      });
    } catch (err: any) {
      console.error('Download contract PDF error:', err);
      alert(err?.message || 'Erreur lors du téléchargement du contrat.');
    }
  };

  const filteredApps = applications.filter(
    (app) =>
      app.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.property_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.tenant_phone.includes(searchQuery)
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Demandes de Location
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-extrabold border border-blue-200 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Candidatures Reçues
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consultez les dossiers complets des candidats et générez les contrats de bail pour les demandes acceptées.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher candidat, bien..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Point 11: Notification banner pour la gestion multi-candidats */}
      {candidateAlert && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{candidateAlert}</span>
          </div>
          <button
            onClick={() => setCandidateAlert(null)}
            className="p-1 rounded-full text-blue-400 hover:text-blue-700 hover:bg-blue-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main List: 3 States (Loader, Error, Empty State) */}
      <div className="flex flex-col gap-2.5">
        {/* 1. Skeleton Loader */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ApplicationCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* 2. Erreur */}
        {!isLoading && loadError && (
          <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl flex flex-col items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
            <h3 className="text-slate-900 font-bold text-base">Impossible de charger les candidatures</h3>
            <p className="text-slate-600 text-xs mt-1 max-w-md">{loadError}</p>
            <button
              onClick={loadFromDatabase}
              className="mt-4 px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* 3. État vide */}
        {!isLoading && !loadError && filteredApps.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-slate-800 font-bold text-base">
              {searchQuery ? "Aucun résultat trouvé" : "Aucune candidature reçue pour le moment"}
            </h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm">
              {searchQuery
                ? "Aucune candidature ne correspond à votre recherche. Essayez avec d'autres termes."
                : "Dès qu'un locataire postule à l'un de vos biens immobiliers, son dossier complet apparaîtra ici pour vérification et établissement du bail."}
            </p>
          </div>
        )}

        {!isLoading && !loadError && filteredApps.map((app) => {
          const compactTitle = app.property_title
            .replace(/Appartement numéro /gi, 'App. N°')
            .replace(/Appartement /gi, 'App. ')
            .replace(/pièces /gi, 'P ')
            .replace(/pièce /gi, 'P ');

          // Vérifier s'il y a d'autres candidats concurrents sur ce même logement
          const otherCandidatesForThisProp = applications.filter(
            (a) =>
              (a.property_id === app.property_id ||
                (a.property_title && app.property_title && a.property_title.trim().toLowerCase() === app.property_title.trim().toLowerCase())) &&
              a.id !== app.id &&
              a.status !== 'refusee'
          );
          const hasMultipleCandidates = otherCandidatesForThisProp.length > 0;

          const isPropertyTaken = propertyHasActiveContract(app.property_id, app.property_title);
          const isThisActive = app.status === 'contrat_actif';
          const isAwaitingTenantSig =
            app.status === 'en_attente_signature_locataire' || (Boolean(app.contract_transmitted) && !app.tenant_signed);
          const isRetained =
            app.status === 'validee' ||
            Boolean(app.candidate_selected) ||
            isAwaitingTenantSig ||
            app.status === 'contrat_signe_locataire';

          // Un candidat n'est refusé que s'il n'est ni retenu ni actif, ET (statut refusé OU bien scellé par un tiers)
          const isRefused = !isRetained && !isThisActive && (app.status === 'refusee' || isPropertyTaken);

          return (
            <div
              key={app.id}
              className={`bg-white rounded-2xl border transition-all p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:shadow-sm ${
                isThisActive
                  ? 'border-blue-300 bg-blue-50/20'
                  : isRetained
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : isRefused
                  ? 'border-slate-200 bg-slate-50/50 opacity-80'
                  : app.status === 'liste_d_attente'
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-slate-200'
              }`}
            >
              {/* 1. Candidat Profil avec Vraie Photo */}
              <div className="flex items-center gap-3 min-w-0 sm:min-w-[180px]">
                <UserAvatar
                  src={app.tenant_avatar}
                  name={app.tenant_name}
                  fallbackRole="locataire"
                  sizeClassName="w-10 h-10"
                  borderClassName="ring-2 ring-slate-100"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-extrabold text-sm text-slate-900 truncate">
                    {app.tenant_name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium truncate">
                    {app.tenant_phone}
                  </span>
                </div>
              </div>

              {/* 2. Bien Demandé */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-bold text-slate-900 truncate cursor-help"
                    title={app.property_title}
                  >
                    {compactTitle}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                    <span className="font-extrabold text-blue-700 whitespace-nowrap">
                      {formatFCFA(app.rent_amount)}/mois
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 whitespace-nowrap font-medium">
                      Caution : {formatFCFA(app.caution_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Date & Statut */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                  {app.date_received}
                </span>

                {/* Badges de statut stricts */}
                {isRefused ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-black whitespace-nowrap flex items-center gap-1">
                    <X className="w-3 h-3 text-rose-600" />
                    <span>Refusé (Logement déjà attribué)</span>
                  </span>
                ) : isThisActive ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    <span>✔ Contrat Actif (Loué)</span>
                  </span>
                ) : app.tenant_signed ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>✍️ Signé par le locataire</span>
                  </span>
                ) : isAwaitingTenantSig ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                    <span>⏳ En attente signature locataire</span>
                  </span>
                ) : isRetained ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>✔ Retenu (Contrat en préparation)</span>
                  </span>
                ) : app.status === 'liste_d_attente' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>⏳ Liste d'attente</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>En attente</span>
                  </span>
                )}
              </div>

              {/* 4. Actions selon l'état réel */}
              <div className="flex items-center gap-1.5 w-full lg:w-auto justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                {/* Voir Dossier */}
                <button
                  type="button"
                  onClick={() => setSelectedDossierApp(app)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer"
                  title="Voir le dossier de candidature"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Dossier</span>
                </button>

                {/* Envoyer un message au candidat */}
                {onOpenMessages && (
                  <button
                    type="button"
                    onClick={() => {
                      const candidateId = app.tenant_id || `tenant_${app.id}`;
                      if (typeof window !== 'undefined') {
                        setActiveChatPartnerForUser(user?.id, candidateId);
                        localStorage.setItem('locatrust_active_chat_contact', candidateId);
                        saveUserScopedContact(user?.id, {
                          id: candidateId,
                          name: app.tenant_name,
                          phone: app.tenant_phone || '+225 07 00 00 00 00',
                          role: 'Locataire',
                          propertyTitle: app.property_title || 'Candidature',
                          avatar: app.tenant_avatar || '',
                          online: true,
                        });
                        window.dispatchEvent(new CustomEvent('locatrust:open_chat', { detail: { contactId: candidateId } }));
                      }
                      onOpenMessages(candidateId);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer"
                    title={`Envoyer un message à ${app.tenant_name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Message</span>
                  </button>
                )}

                {/* CAS A : Candidat refusé (logement pris par un autre candidat) */}
                {isRefused && (
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                    title="Le logement demandé a été attribué. Aucun contrat ne peut être généré ou signé pour ce bien."
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-300" />
                    <span>Contrat</span>
                  </button>
                )}

                {/* CAS B : Contrat finalisé / Contrat actif */}
                {isThisActive && (
                  <>
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed opacity-60 flex items-center gap-1.5 whitespace-nowrap"
                      title="Le contrat est scellé et actif. Aucune modification n'est permise."
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Contrat (Scellé)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadContract(app)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
                      title="Télécharger le contrat de bail officiel finalisé en PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger le contrat</span>
                    </button>
                  </>
                )}

                {/* CAS C : Candidat retenu / En attente de signature / En cours de finalisation */}
                {!isRefused && !isThisActive && isRetained && (
                  <>
                    {/* Bouton Créer le contrat */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContractModalStartStep('form');
                        setSelectedApplicationForContract(app);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                      title="Créer et paramétrer le contrat de bail certifié"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Créer le contrat</span>
                    </button>

                    {/* Bouton Transmettre le contrat */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContractModalStartStep('transmission');
                        setSelectedApplicationForContract(app);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                      title="Ouvrir le formulaire de transmission du contrat au locataire"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmettre le contrat</span>
                    </button>

                    {/* Tant que le locataire n'a pas signé : statut d'attente (Finaliser le contrat reste VISIBLE mais DÉSACTIVÉ) */}
                    {!app.tenant_signed ? (
                      <>
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs border border-slate-300 cursor-not-allowed opacity-60 flex items-center gap-1.5 whitespace-nowrap"
                          title="En attente de la signature effective du locataire. Ce bouton deviendra actif dès que le locataire aura apposé sa signature."
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Finaliser le contrat</span>
                        </button>

                        <div
                          className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200 flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                          title="Le bail officiel a été transmis au locataire. En attente de sa signature électronique sur son espace."
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                          <span>Statut : En attente de signature du locataire</span>
                        </div>
                      </>
                    ) : (
                      /* Dès que le locataire a signé : bouton de finalisation actif et animé */
                      <button
                        type="button"
                        onClick={() => handleFinalizeContract(app)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 animate-pulse cursor-pointer whitespace-nowrap"
                        title="Le locataire a signé et validé sa signature ! Cliquez pour finaliser définitivement le contrat et attribuer le bien."
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Finaliser le contrat</span>
                      </button>
                    )}
                  </>
                )}

                {/* CAS D : Candidat en attente ou liste d'attente (logement non encore pris) */}
                {!isRefused && !isThisActive && !isRetained && (
                  <>
                    {/* S'il y a plusieurs candidats sur ce logement, afficher 'Signer avec [Prénom]' */}
                    {app.status === 'en_attente' && hasMultipleCandidates && (
                      <button
                        type="button"
                        onClick={() => handleSelectAndSignWithCandidate(app)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer"
                        title={`Choisir ${app.tenant_name} pour ce logement`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Signer avec {app.tenant_name.split(' ')[0]}</span>
                      </button>
                    )}

                    {/* Si liste d'attente, permettre de le repêcher */}
                    {app.status === 'liste_d_attente' && (
                      <button
                        type="button"
                        onClick={() => handleSelectAndSignWithCandidate(app)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer"
                        title="Sélectionner ce candidat de la liste d'attente"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Choisir ce candidat</span>
                      </button>
                    )}

                    {/* Bouton Créer le contrat direct (notamment si 1 seul candidat) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Si c'est le seul candidat ou direct, on le retient et on ouvre le générateur
                        handleSelectAndSignWithCandidate(app);
                        setContractModalStartStep('form');
                        setSelectedApplicationForContract(app);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                      title="Créer immédiatement le contrat de bail officiel"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Créer le contrat</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filteredApps.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 text-xs">
            Aucune demande de location trouvée.
          </div>
        )}
      </div>

      {/* DOSSIER CANDIDAT COMPLET MODAL */}
      {selectedDossierApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Dossier de candidature locative
                  </h3>
                  <p className="text-xs text-slate-500">{selectedDossierApp.tenant_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDossierApp(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile summary */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border flex items-center gap-3 text-xs">
              <img
                src={selectedDossierApp.tenant_avatar}
                alt={selectedDossierApp.tenant_name}
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex flex-col">
                <span className="font-black text-slate-900 text-sm">{selectedDossierApp.tenant_name}</span>
                <span className="text-slate-500">Tél : {selectedDossierApp.tenant_phone}</span>
                <span className="text-slate-500">CNI : {selectedDossierApp.tenant_cni}</span>
              </div>
            </div>

            {/* Documents attached */}
            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">
                Pièces justificatives vérifiées
              </span>

              {/* CNI */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">Pièce nationale d'identité (CNI)</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Document authentifié</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alert("Affichage de la pièce d'identité")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                >
                  Consulter
                </button>
              </div>

              {/* Quittances antérieures */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">Antécédents locatifs / Quittances</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Historique régulier certifié</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alert("Affichage des quittances antérieures")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                >
                  Consulter
                </button>
              </div>

              {/* Fiche d'identification */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">Fiche de renseignements locataire</span>
                    <span className="text-[10px] text-slate-400">Complétée le {selectedDossierApp.date_received}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alert("Affichage de la fiche locataire")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                >
                  Consulter
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedDossierApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={() => {
                  const app = selectedDossierApp;
                  setSelectedDossierApp(null);
                  setSelectedApplicationForContract(app);
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Générer le contrat de bail</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Contract Generator Modal */}
      {selectedApplicationForContract && (() => {
        const matchedProperty = getPropertyForApp(selectedApplicationForContract.property_id);
        const leaseType = (matchedProperty?.usage_destination || 'habitation') as 'habitation' | 'professionnel';
        return (
          <LegalContractGeneratorModal
            isOpen={true}
            onClose={() => setSelectedApplicationForContract(null)}
            startAtStep={contractModalStartStep}
            isAgency={(profile?.role as any) === 'agence' || (profile?.role as any) === 'agent'}
            onContractFinalized={async ({ contractNumber, tenantName, propertyTitle }) => {
              const chosenApp = selectedApplicationForContract;
              const competing = applications.filter(
                (a) => a.property_id === chosenApp.property_id && a.id !== chosenApp.id
              );
              const competingNames = competing.map((c) => c.tenant_name).join(', ');
              const updated = applications.map((a) => {
                if (a.id === chosenApp.id) return { ...a, status: 'contrat_actif' as const, contract_number: contractNumber, contract_finalized: true };
                if (a.property_id === chosenApp.property_id) {
                  return { ...a, status: 'refusee' as const };
                }
                return a;
              });
              saveApplications(updated);

              try {
                await supabase.from('rental_applications').update({
                  status: 'contrat_actif',
                  contract_finalized: true,
                  contract_number: contractNumber
                }).eq('id', chosenApp.id);

                for (const comp of competing) {
                  await supabase.from('rental_applications').update({
                    status: 'refusee'
                  }).eq('id', comp.id);
                }

                if (chosenApp.property_id) {
                  await supabase.from('properties').update({
                    status: 'loue'
                  }).eq('id', chosenApp.property_id);
                }
              } catch (err) {
                console.warn('Erreur mise à jour Supabase après finalisation contrat:', err);
              }

              broadcastLiveEvent('CONTRACT_FINALIZED', {
                actorId: user?.id,
                targetUserId: chosenApp.tenant_id,
                propertyId: chosenApp.property_id,
                contractId: contractNumber,
                data: { appId: chosenApp.id, contractNumber }
              });

              setCandidateAlert(
                `🎉 Bail N° ${contractNumber} finalisé avec ${tenantName} pour « ${propertyTitle} » ! Les candidats en liste d'attente (${competingNames || 'demandeurs'}) ont été automatiquement notifiés que le logement n'est plus disponible.`
              );
            }}
            onContractTransmitted={({ contractNumber, tenantName, propertyTitle }) => {
              const chosenApp = selectedApplicationForContract;
              const updated = applications.map((a) => {
                if (a.id === chosenApp.id) {
                  return {
                    ...a,
                    status: 'en_attente_signature_locataire' as const,
                    contract_number: contractNumber,
                    contract_transmitted: true
                  };
                }
                return a;
              });
              saveApplications(updated);
              setCandidateAlert(
                `📄 Le contrat N° ${contractNumber} a été transmis à ${tenantName} pour « ${propertyTitle} ». Statut : En attente de signature du locataire.`
              );
            }}
            initialData={{
              id: selectedApplicationForContract.id,
              tenantId: selectedApplicationForContract.tenant_id,
              tenantEmail: selectedApplicationForContract.tenant_email,
              ownerId: (selectedApplicationForContract as any).owner_id || user?.id,
              ownerName: profile?.full_name || user?.user_metadata?.full_name || ((profile?.role as any) === 'agence' ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur'),
              ownerPhone: profile?.phone || user?.user_metadata?.phone || (typeof window !== 'undefined' ? localStorage.getItem('locatrust_user_phone') : null) || '+225 07 00 00 00 00',
              ownerCni: profile?.cni_number || user?.user_metadata?.cni_number || (typeof window !== 'undefined' ? localStorage.getItem('locatrust_user_cni') : null) || 'CI-002891048-A',
              ownerAddress: (profile as any)?.address || (profile?.commune ? `${profile.commune}, ${profile.city || 'Abidjan'}` : 'Abidjan - Côte d\'Ivoire'),
              tenantName: selectedApplicationForContract.tenant_name,
              tenantPhone: selectedApplicationForContract.tenant_phone,
              tenantCni: selectedApplicationForContract.tenant_cni,
              propertyId: selectedApplicationForContract.property_id,
              propertyTitle: selectedApplicationForContract.property_title,
              propertyAddress: selectedApplicationForContract.property_address,
              propertySurface: matchedProperty?.surface,
              propertyRooms: matchedProperty?.rooms,
              propertyBedrooms: matchedProperty?.bedrooms,
              propertyBathrooms: matchedProperty?.bathrooms,
              propertyEquipments: matchedProperty?.equipments,
              propertyPhotos: matchedProperty?.photos,
              propertyDescription: matchedProperty?.description,
              mandantName: (matchedProperty as any)?.mandant_name,
              rentAmount: selectedApplicationForContract.rent_amount,
              cautionAmount: selectedApplicationForContract.caution_amount,
              chargesAmount: matchedProperty?.charges ?? 10000,
              leaseType,
              usageDestination: leaseType,
              authorizedActivity: matchedProperty?.authorized_activity || '',
              propertyType: matchedProperty?.type || '',
              ownerDestinationAuthorized: matchedProperty?.owner_destination_authorized ?? true,
              tenantSignatureUrl: (selectedApplicationForContract as any).tenant_signature_url,
              ownerSignatureUrl: (selectedApplicationForContract as any).owner_signature_url || getStoredOwnerSignature(user?.id)
            }}
          />
        );
      })()}

      {/* Interactive Tenant Signature Modal (Vraie signature manuscrite sur canvas numérique certifié) */}
      {signingTenantApp && (
        <SignatureModal
          isOpen={!!signingTenantApp}
          onClose={() => setSigningTenantApp(null)}
          onConfirmSignature={(signatureDataUrl) => {
            handleConfirmTenantSignature(signingTenantApp, signatureDataUrl);
          }}
          signerName={signingTenantApp.tenant_name}
          signerRole="locataire"
          documentTitle={`Bail d'Habitation pour ${signingTenantApp.property_title}`}
          documentNumber={signingTenantApp.contract_number || 'LT-2026-CI-000492'}
        />
      )}

      {/* Interactive Owner / Agency Signature Modal (Vraie signature manuscrite sur canvas numérique certifié) */}
      {signingOwnerApp && (
        <SignatureModal
          isOpen={!!signingOwnerApp}
          onClose={() => setSigningOwnerApp(null)}
          onConfirmSignature={(signatureDataUrl) => {
            persistOwnerSignature(signatureDataUrl, user?.id);
            const targetApp = { ...signingOwnerApp, owner_signature_url: signatureDataUrl };
            setSigningOwnerApp(null);
            handleExecuteFinalizeContract(targetApp, signatureDataUrl);
          }}
          signerName={profile?.full_name || user?.user_metadata?.full_name || ((profile?.role as any) === 'agence' ? "Directeur d'Agence" : "Propriétaire Bailleur")}
          signerRole={(profile?.account_type === 'agence' || (profile?.role as any) === 'agence') ? 'agence' : 'bailleur'}
          documentTitle={`Bail d'Habitation pour ${signingOwnerApp.property_title}`}
          documentNumber={signingOwnerApp.contract_number || 'LT-2026-CI-000492'}
        />
      )}

    </div>
  );
};

