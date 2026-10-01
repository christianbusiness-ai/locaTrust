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
  Check
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { LegalContractGeneratorModal } from '@/components/contracts/LegalContractGeneratorModal';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export interface RentalApplication {
  id: string;
  property_id: string;
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
  documents: {
    cni_url: string;
    quittances_url?: string;
    attestation_url?: string;
  };
}

// Point 11: Multiples candidats sur le même bien (Kwame, Moussa, Awa sur Appartement A)
const MOCK_APPLICATIONS: RentalApplication[] = [
  {
    id: 'app_kwame',
    property_id: 'prop_apt_a',
    tenant_name: 'Kwame Koffi',
    tenant_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 07 45 89 12 00',
    tenant_email: 'kwame.koffi@email.ci',
    tenant_cni: 'CI-009841201',
    property_title: 'Appartement A (Cocody Riviera 3)',
    property_address: 'Cocody Riviera 3, Abidjan',
    rent_amount: 150000,
    caution_amount: 300000,
    date_received: '24/09/2026',
    status: 'en_attente',
    dossier_status: 'complet',
    documents: {
      cni_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
      quittances_url: 'Quittances_anciennes_2026.pdf',
      attestation_url: 'Contrat_travail_cadre.pdf'
    }
  },
  {
    id: 'app_moussa',
    property_id: 'prop_apt_a',
    tenant_name: 'Moussa Touré',
    tenant_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 05 67 89 45 12',
    tenant_email: 'moussa.toure@yahoo.fr',
    tenant_cni: 'CI-0029481920',
    property_title: 'Appartement A (Cocody Riviera 3)',
    property_address: 'Cocody Riviera 3, Abidjan',
    rent_amount: 150000,
    caution_amount: 300000,
    date_received: '24/09/2026',
    status: 'en_attente',
    dossier_status: 'complet',
    documents: {
      cni_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      quittances_url: 'Quittance_locative_2026.pdf'
    }
  },
  {
    id: 'app_awa',
    property_id: 'prop_apt_a',
    tenant_name: 'Awa Diallo',
    tenant_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 07 44 55 66 77',
    tenant_email: 'awa.diallo@gmail.com',
    tenant_cni: 'CI-0033221199',
    property_title: 'Appartement A (Cocody Riviera 3)',
    property_address: 'Cocody Riviera 3, Abidjan',
    rent_amount: 150000,
    caution_amount: 300000,
    date_received: '23/09/2026',
    status: 'en_attente',
    dossier_status: 'complet',
    documents: {
      cni_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    }
  },
  {
    id: 'app_bamba',
    property_id: 'prop_villa_mbadon',
    tenant_name: 'Bamba Souleymane',
    tenant_avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 01 22 33 44 55',
    tenant_email: 'bamba.s@gmail.com',
    tenant_cni: 'CI-0055443322',
    property_title: "Villa 4 pièces Riviera M'Badon",
    property_address: "Riviera M'Badon, Cocody",
    rent_amount: 450000,
    caution_amount: 900000,
    date_received: '20/09/2026',
    status: 'validee',
    dossier_status: 'complet',
    documents: {
      cni_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
    }
  }
];

interface DemandesViewProps {
  onOpenMessages?: (tenantId?: string) => void;
  onOpenContractGenerator?: (application?: RentalApplication) => void;
}

export const DemandesView: React.FC<DemandesViewProps> = ({
  onOpenMessages,
  onOpenContractGenerator
}) => {
  const [applications, setApplications] = useState<RentalApplication[]>(MOCK_APPLICATIONS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedApplicationForContract, setSelectedApplicationForContract] = useState<RentalApplication | null>(null);
  const [selectedDossierApp, setSelectedDossierApp] = useState<RentalApplication | null>(null);
  const [candidateAlert, setCandidateAlert] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('locatrust_rental_applications');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setApplications(parsed);
        }
      }
    } catch (e) {
      console.warn(e);
    }

    const handleAppsUpdated = (e: any) => {
      if (e.detail?.updatedApps && Array.isArray(e.detail.updatedApps)) {
        setApplications(e.detail.updatedApps);
      }
    };
    window.addEventListener('locatrust:applications-updated', handleAppsUpdated);
    return () => window.removeEventListener('locatrust:applications-updated', handleAppsUpdated);
  }, []);

  const handleUpdateStatus = (id: string, newStatus: RentalApplication['status']) => {
    setApplications((prev) => {
      const updated = prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app));
      try {
        localStorage.setItem('locatrust_rental_applications', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };

  // Point 11 : Le propriétaire signe avec un candidat (ex: Kwame)
  // Le système : valide Kwame et met les autres en liste d'attente
  const handleSelectAndSignWithCandidate = (chosenApp: RentalApplication) => {
    const competingCandidates = applications.filter(
      (a) => a.property_id === chosenApp.property_id && a.id !== chosenApp.id
    );

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === chosenApp.id) {
          return { ...app, status: 'validee' };
        }
        if (app.property_id === chosenApp.property_id && app.status !== 'refusee') {
          return { ...app, status: 'liste_d_attente' };
        }
        return app;
      })
    );

    setSelectedApplicationForContract(chosenApp);
    const competingNames = competingCandidates.map((c) => c.tenant_name).join(', ');
    setCandidateAlert(
      `✔ ${chosenApp.tenant_name} validé pour ${chosenApp.property_title} ! ${
        competingCandidates.length > 0
          ? `Les autres candidats (${competingNames}) ont été automatiquement placés en liste d'attente.`
          : ''
      }`
    );
  };

  // Point 11 : Quand le candidat signe, le contrat devient actif et le logement disparaît du fil d'actualités
  const handleTenantSignsContract = (app: RentalApplication) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, status: 'contrat_actif' } : a))
    );
    setCandidateAlert(
      `🎉 ${app.tenant_name} a signé ! Le contrat est désormais actif. Le logement '${app.property_title}' a été loué et retiré automatiquement du fil d'actualités public.`
    );
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

      {/* Helper pour abréviation intelligente des longs libellés (Point 23 du prompt) */}
      {/* Main List: Sleek, Ultra-compact single-row layout without vertical bloat (Points 21 to 26) */}
      <div className="flex flex-col gap-2.5">
        {filteredApps.map((app) => {
          const compactTitle = app.property_title
            .replace(/Appartement numéro /gi, 'App. N°')
            .replace(/Appartement /gi, 'App. ')
            .replace(/pièces /gi, 'P ')
            .replace(/pièce /gi, 'P ');

          return (
            <div
              key={app.id}
              className={`bg-white rounded-2xl border transition-all p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:shadow-sm ${
                app.status === 'validee'
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : app.status === 'liste_d_attente'
                  ? 'border-amber-200 bg-amber-50/30'
                  : app.status === 'contrat_actif'
                  ? 'border-blue-300 bg-blue-50/20'
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

                {app.status === 'en_attente' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>En attente</span>
                  </span>
                )}
                {app.status === 'validee' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>✔ Retenu (Contrat en cours)</span>
                  </span>
                )}
                {app.status === 'liste_d_attente' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>⏳ Liste d'attente</span>
                  </span>
                )}
                {app.status === 'contrat_actif' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-black flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    <span>✔ Contrat Actif (Loué)</span>
                  </span>
                )}
                {app.status === 'refusee' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-black whitespace-nowrap">
                    Refusée
                  </span>
                )}
              </div>

              {/* 4. Zone d'actions Point 11 */}
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

                {/* Point 11 : Signer avec ce candidat */}
                {app.status === 'en_attente' && (
                  <button
                    type="button"
                    onClick={() => handleSelectAndSignWithCandidate(app)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all whitespace-nowrap"
                    title="Choisir ce candidat et mettre les autres en liste d'attente"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Signer avec {app.tenant_name.split(' ')[0]}</span>
                  </button>
                )}

                {/* Point 11 : Simuler la signature du locataire retenu */}
                {app.status === 'validee' && (
                  <button
                    type="button"
                    onClick={() => handleTenantSignsContract(app)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all whitespace-nowrap"
                    title="Valider la signature du locataire et clore le logement du fil d'actualité"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Finaliser signature locataire</span>
                  </button>
                )}

                {/* Bouton Générer un contrat */}
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

                {/* Message */}
                <button
                  type="button"
                  onClick={() => onOpenMessages?.(app.id)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
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
      {selectedApplicationForContract && (
        <LegalContractGeneratorModal
          isOpen={true}
          onClose={() => setSelectedApplicationForContract(null)}
          onContractFinalized={({ contractNumber, tenantName, propertyTitle }) => {
            const chosenApp = selectedApplicationForContract;
            const competing = applications.filter(
              (a) => a.property_id === chosenApp.property_id && a.id !== chosenApp.id
            );
            const competingNames = competing.map((c) => c.tenant_name).join(', ');
            setApplications((prev) => {
              const updated = prev.map((a) => {
                if (a.id === chosenApp.id) return { ...a, status: 'contrat_actif' as const };
                if (a.property_id === chosenApp.property_id) {
                  return { ...a, status: 'refusee' as const };
                }
                return a;
              });
              try {
                localStorage.setItem('locatrust_rental_applications', JSON.stringify(updated));
              } catch (e) {
                console.warn(e);
              }
              return updated;
            });
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
            cautionAmount: selectedApplicationForContract.caution_amount
          }}
        />
      )}

    </div>
  );
};
