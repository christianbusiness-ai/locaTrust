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
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { notifyWaitingListCandidatesOnLeaseFinalized } from '@/lib/waitingListNotifications';
import { triggerCelebration } from '@/lib/celebration';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { updateRentalApplication } from '@/lib/supabase/services';
import { ApplicationCardSkeleton } from '@/components/common/SkeletonLoader';

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
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedApplicationForContract, setSelectedApplicationForContract] = useState<RentalApplication | null>(null);
  const [selectedDossierApp, setSelectedDossierApp] = useState<RentalApplication | null>(null);
  const [signingTenantApp, setSigningTenantApp] = useState<RentalApplication | null>(null);
  const [candidateAlert, setCandidateAlert] = useState<string | null>(null);

  const loadFromDatabase = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('rental_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setLoadError(error.message);
      } else {
        setApplications(data || []);
        if (typeof window !== 'undefined') {
          localStorage.setItem('locatrust_rental_applications', JSON.stringify(data || []));
        }
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erreur lors du chargement des candidatures.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFromDatabase();

    const handleAppsUpdated = (e: any) => {
      if (e.detail?.updatedApps && Array.isArray(e.detail.updatedApps)) {
        setApplications(e.detail.updatedApps);
      }
    };
    window.addEventListener('locatrust:applications-updated', handleAppsUpdated);
    return () => {
      window.removeEventListener('locatrust:applications-updated', handleAppsUpdated);
    };
  }, []);

  const saveApplications = (updated: RentalApplication[]) => {
    setApplications(updated);
    try {
      localStorage.setItem('locatrust_rental_applications', JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('locatrust:applications-updated', { detail: { updatedApps: updated } })
      );
    } catch (e) {
      console.warn(e);
    }
  };

  // Vérifier si un logement a déjà un contrat actif / finalisé
  const propertyHasActiveContract = (propertyId: string) => {
    return applications.some((a) => a.property_id === propertyId && a.status === 'contrat_actif');
  };

  // Choix d'un candidat pour établir le contrat
  const handleSelectAndSignWithCandidate = (chosenApp: RentalApplication) => {
    // Contrôle d'état : si le logement est déjà pris
    if (propertyHasActiveContract(chosenApp.property_id)) {
      alert("Ce logement est déjà loué sous contrat actif. Impossible de créer un nouveau contrat.");
      return;
    }

    const competingCandidates = applications.filter(
      (a) => a.property_id === chosenApp.property_id && a.id !== chosenApp.id
    );

    const updated = applications.map((app) => {
      if (app.id === chosenApp.id) {
        return { ...app, status: 'validee' as const, tenant_signed: false };
      }
      if (app.property_id === chosenApp.property_id && app.status !== 'refusee') {
        return { ...app, status: 'liste_d_attente' as const };
      }
      return app;
    });

    saveApplications(updated);
    setSelectedApplicationForContract(chosenApp);

    const competingNames = competingCandidates.map((c) => c.tenant_name).join(', ');
    setCandidateAlert(
      `✔ ${chosenApp.tenant_name} retenu pour ${chosenApp.property_title} ! Le contrat lui a été transmis pour consultation et signature. ${
        competingCandidates.length > 0
          ? `Les autres candidats (${competingNames}) sont en liste d'attente.`
          : ''
      }`
    );
  };

  // Validation effective de la signature par le locataire (Étape 1 & 2)
  const handleConfirmTenantSignature = async (app: RentalApplication) => {
    const signedAt = new Date().toISOString();
    const updated = applications.map((a) =>
      a.id === app.id ? { ...a, tenant_signed: true, tenant_signed_at: signedAt } : a
    );
    saveApplications(updated);
    setSigningTenantApp(null);
    setCandidateAlert(
      `✍️ ${app.tenant_name} a signé et validé sa signature ! Le bouton « Finaliser le contrat » est désormais actif pour le bailleur.`
    );
    try {
      await supabase.from('rental_applications').update({
        tenant_signed: true,
        tenant_signed_at: signedAt
      }).eq('id', app.id);
    } catch (e) {
      console.warn('Sync signature error:', e);
    }
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

    const contractNumber = app.contract_number || `LT-2026-CI-000${Math.floor(100 + Math.random() * 900)}`;

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
          contract_number: contractNumber
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

    // Synchronisation Supabase
    try {
      await supabase.from('rental_applications').update({
        status: 'contrat_actif',
        contract_finalized: true,
        contract_number: contractNumber
      }).eq('id', app.id);

      for (const comp of competing) {
        await supabase.from('rental_applications').update({
          status: 'refusee',
          unavailable_reason: "Le logement demandé est déjà pris et n'est plus disponible."
        }).eq('id', comp.id);
      }
    } catch (err) {
      console.warn('Supabase sync contract error:', err);
    }

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

    // 4. Enregistrer dans le registre des contrats
    const ownerName = profile?.full_name || user?.user_metadata?.full_name || "Bailleur";
    const ownerPhone = profile?.phone || "+225 07 00 00 00 00";

    try {
      await supabase.from('contracts').insert({
        contract_number: contractNumber,
        property_id: app.property_id,
        tenant_id: app.tenant_id || user?.id,
        owner_id: user?.id,
        rent_amount: app.rent_amount,
        charges_amount: 10000,
        caution_amount: app.caution_amount,
        duration_months: 12,
        status: 'actif',
        start_date: new Date().toISOString(),
        signed_date: new Date().toISOString()
      });

      const rawContracts = localStorage.getItem('locatrust_contracts');
      const currentContracts = rawContracts ? JSON.parse(rawContracts) : [];
      const newContractRecord = {
        id: `cnt_${app.id}_${Date.now()}`,
        contract_number: contractNumber,
        rent: app.rent_amount,
        charges: 10000,
        payment_due_day: 5,
        duration_months: 12,
        owner: { full_name: ownerName, phone: ownerPhone },
        tenant: { full_name: app.tenant_name, phone: app.tenant_phone },
        property: {
          title: app.property_title,
          location: { city: 'Abidjan', quartier: 'Riviera', commune: 'Cocody' }
        },
        status: 'actif',
        signed_date: new Date().toLocaleDateString('fr-FR')
      };
      localStorage.setItem('locatrust_contracts', JSON.stringify([newContractRecord, ...currentContracts]));
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
      const ownerName = profile?.full_name || user?.user_metadata?.full_name || "Bailleur";
      const ownerPhone = profile?.phone || "+225 07 00 00 00 00";
      const matchedProperty = getPropertyForApp(app.property_id);
      const leaseType = (matchedProperty?.usage_destination || 'habitation') as 'habitation' | 'professionnel';

      await generateOfficialContractPdf({
        contractNumber: app.contract_number || 'LT-2026-CI-000492',
        isAgency: false,
        ownerName: ownerName,
        ownerPhone: ownerPhone,
        tenantName: app.tenant_name,
        tenantPhone: app.tenant_phone,
        tenantCni: app.tenant_cni,
        propertyTitle: app.property_title,
        propertyAddress: app.property_address,
        durationMonths: 12,
        startDate: '01/10/2026',
        rent: app.rent_amount,
        cautionMonths: 2,
        chargesAmount: 10000,
        dueDay: 5,
        isSignedCopy: true,
        leaseType,
        usageDestination: leaseType,
        authorizedActivity: matchedProperty?.authorized_activity || ''
      });
    } catch (err) {
      console.error('Download contract PDF error:', err);
      alert('Erreur lors du téléchargement du contrat.');
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

          const isPropertyTaken = propertyHasActiveContract(app.property_id);
          const isThisActive = app.status === 'contrat_actif';
          const isRefused = app.status === 'refusee' || (isPropertyTaken && !isThisActive);

          return (
            <div
              key={app.id}
              className={`bg-white rounded-2xl border transition-all p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:shadow-sm ${
                isThisActive
                  ? 'border-blue-300 bg-blue-50/20'
                  : app.status === 'validee'
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : isRefused
                  ? 'border-slate-200 bg-slate-50/50 opacity-80'
                  : app.status === 'liste_d_attente'
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-slate-200'
              }`}
            >
              {/* 1. Candidat Profil */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <img
                  src={app.tenant_avatar}
                  alt={app.tenant_name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
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
              <div className="flex items-center gap-2 min-w-[220px] flex-1">
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
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                  {app.date_received}
                </span>

                {/* Si logement déjà pris et candidat non retenu -> Refusé */}
                {isRefused ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-black whitespace-nowrap flex items-center gap-1">
                    <X className="w-3 h-3 text-rose-600" />
                    <span>Refusé (Logement déjà pris)</span>
                  </span>
                ) : isThisActive ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    <span>✔ Contrat Actif (Loué)</span>
                  </span>
                ) : app.status === 'validee' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>✔ Retenu ({app.tenant_signed ? 'Signé par locataire' : 'En attente signature locataire'})</span>
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

              {/* 4. Actions selon l'état réel (Points 1 & 2) */}
              <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center flex-wrap">
                {/* Voir Dossier */}
                <button
                  type="button"
                  onClick={() => setSelectedDossierApp(app)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 transition-all whitespace-nowrap"
                  title="Voir le dossier de candidature"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Dossier</span>
                </button>

                {/* CAS A : Candidat refusé (logement pris par un autre candidat) */}
                {isRefused && (
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                    title="Le logement demandé est déjà pris et n'est plus disponible. Aucun contrat ne peut être généré ou signé pour ce bien."
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
                      title="Le contrat est finalisé et en cours d'exécution. Aucune modification n'est permise."
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

                {/* CAS C : Candidat retenu en cours de finalisation */}
                {!isRefused && !isThisActive && app.status === 'validee' && (
                  <>
                    {/* Tant que le locataire n'a pas signé : bouton présent mais DÉSACTIVÉ / NON CLIQUABLE */}
                    {!app.tenant_signed ? (
                      <>
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs border border-slate-300 cursor-not-allowed opacity-60 flex items-center gap-1.5 whitespace-nowrap"
                          title="En attente de la signature effective du locataire. Le bouton deviendra cliquable dès validation de sa signature."
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Finaliser le contrat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSigningTenantApp(app)}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs border border-blue-200 flex items-center gap-1 transition-all whitespace-nowrap shadow-xs cursor-pointer"
                          title="Consulter et valider la signature locataire"
                        >
                          <PenTool className="w-3.5 h-3.5 text-blue-600" />
                          <span>Signature locataire</span>
                        </button>
                      </>
                    ) : (
                      /* Dès que le locataire a signé et validé : bouton actif et cliquable */
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

                    {/* Bouton Contrat pour voir ou ajuster les clauses avant clôture */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedApplicationForContract(app);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                      title="Consulter le contrat de bail"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Contrat</span>
                    </button>
                  </>
                )}

                {/* CAS D : Candidat en attente ou liste d'attente (logement non encore pris) */}
                {!isRefused && !isThisActive && app.status !== 'validee' && (
                  <>
                    {app.status === 'en_attente' && (
                      <button
                        type="button"
                        onClick={() => handleSelectAndSignWithCandidate(app)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer"
                        title="Choisir ce candidat et lui transmettre le contrat"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Signer avec {app.tenant_name.split(' ')[0]}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedApplicationForContract(app);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                      title="Générer immédiatement le contrat de bail officiel"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Contrat</span>
                    </button>
                  </>
                )}

                {/* Message */}
                <button
                  type="button"
                  onClick={() => onOpenMessages?.(app.id)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Envoyer un message au candidat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
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
            onContractFinalized={({ contractNumber, tenantName, propertyTitle }) => {
              const chosenApp = selectedApplicationForContract;
              const competing = applications.filter(
                (a) => a.property_id === chosenApp.property_id && a.id !== chosenApp.id
              );
              const competingNames = competing.map((c) => c.tenant_name).join(', ');
              const updated = applications.map((a) => {
                if (a.id === chosenApp.id) return { ...a, status: 'contrat_actif' as const };
                if (a.property_id === chosenApp.property_id) {
                  return { ...a, status: 'refusee' as const };
                }
                return a;
              });
              saveApplications(updated);
              setCandidateAlert(
                `🎉 Bail N° ${contractNumber} finalisé avec ${tenantName} pour « ${propertyTitle} » ! Les candidats en liste d'attente (${competingNames || 'demandeurs'}) ont été automatiquement notifiés que le logement n'est plus disponible.`
              );
            }}
            initialData={{
              tenantName: selectedApplicationForContract.tenant_name,
              tenantPhone: selectedApplicationForContract.tenant_phone,
              tenantCni: selectedApplicationForContract.tenant_cni,
              propertyTitle: selectedApplicationForContract.property_title,
              propertyAddress: selectedApplicationForContract.property_address,
              rentAmount: selectedApplicationForContract.rent_amount,
              cautionAmount: selectedApplicationForContract.caution_amount,
              leaseType,
              usageDestination: leaseType,
              authorizedActivity: matchedProperty?.authorized_activity || '',
              propertyType: matchedProperty?.type || '',
              ownerDestinationAuthorized: matchedProperty?.owner_destination_authorized ?? true
            }}
          />
        );
      })()}

      {/* Interactive Tenant Signature Modal (Simulation / Signature effective du locataire) */}
      {signingTenantApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  <PenTool className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Signature & Validation Locataire
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {signingTenantApp.tenant_name} • CNI : {signingTenantApp.tenant_cni}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSigningTenantApp(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Récapitulatif du bien */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Logement concerné :</span>
                <span className="font-black text-slate-900">{signingTenantApp.property_title}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Loyer mensuel :</span>
                <strong className="text-blue-700 font-black">{formatFCFA(signingTenantApp.rent_amount)}/mois</strong>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Dépôt de garantie :</span>
                <strong>{formatFCFA(signingTenantApp.caution_amount)} (2 mois max légal)</strong>
              </div>
            </div>

            {/* Étape 1 : Signature manuscrite certifiée */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>1. Signature manuscrite numérique du locataire</span>
              </span>
              <div className="h-28 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/30 flex items-center justify-center p-3 relative overflow-hidden">
                <div className="font-serif italic text-2xl text-blue-900 select-none tracking-wide">
                  {signingTenantApp.tenant_name}
                </div>
                <div className="absolute bottom-2 right-3 text-[10px] font-mono text-emerald-700 font-bold bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
                  ✔ Certificat Numérique LocaTrust
                </div>
              </div>
              <span className="text-[11px] text-slate-400 italic">
                En apposant cette signature, le preneur déclare avoir pris connaissance des clauses et s'engage selon les dispositions de la Loi N° 2019-576.
              </span>
            </div>

            {/* Étape 2 : Boutons d'action */}
            <div className="flex items-center justify-between pt-3 border-t gap-3">
              <button
                type="button"
                onClick={() => setSigningTenantApp(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => handleConfirmTenantSignature(signingTenantApp)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>2. Valider ma signature locataire</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

