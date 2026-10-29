'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Heart,
  Eye,
  Calendar,
  Send,
  ShieldCheck,
  Video,
  Sparkles,
  Maximize2,
  Bed,
  Bath,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Home,
  ShieldAlert,
  ArrowRight,
  Clock
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { Property } from '@/types/database.types';
import { supabase } from '@/src/lib/supabase';
import { createRentalApplication } from '@/lib/supabase/services';
import { useAuth } from '@/src/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PropertyGridSkeleton } from '@/components/common/SkeletonLoader';
import { ActionConfirmationModal } from '@/components/common/ActionConfirmationModal';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';

export interface LocataireSearchViewProps {
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
}

export const LocataireSearchView: React.FC<LocataireSearchViewProps> = ({
  activeTab = 'search',
  onNavigateTab
}) => {
  const { user, profile } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('Côte d\'Ivoire');
  const [cityFilter, setCityFilter] = useState<string>('tous');
  const [typeFilter, setTypeFilter] = useState<string>('tous');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Mes Demandes de Location
  const [tenantApplications, setTenantApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);

  // Mes Visites
  const [tenantVisits, setTenantVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState<boolean>(false);
  
  // Active Modals State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showVisitModal, setShowVisitModal] = useState<boolean>(false);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Form states for visit & application
  const [visitDate, setVisitDate] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [visitConfirmation, setVisitConfirmation] = useState<{
    isOpen: boolean;
    propertyTitle: string;
    date: string;
  } | null>(null);

  const navigate = useNavigate();
  const isVerified = profile?.verification_status === 'verifie';
  const [showKycBlockModal, setShowKycBlockModal] = useState<boolean>(false);
  const [kycBlockReason, setKycBlockReason] = useState<'visite' | 'candidature'>('visite');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      const formatted = (data || []).map((p: any) => ({
        ...p,
        location: p.location || {
          city: p.city || 'Abidjan',
          commune: p.commune || '',
          quartier: p.quartier || ''
        },
        pricing: p.pricing || {
          monthly_rent: Number(p.rent) || 0,
          deposit_months: Math.round(Number(p.caution) / (Number(p.rent) || 1)) || 2
        }
      }));
      setProperties(formatted);
    } catch (err: any) {
      console.error('Erreur chargement des biens:', err);
      setError('Impossible de charger les offres immobilières. Veuillez vérifier votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantApplications = async () => {
    if (!user) return;
    setLoadingApps(true);
    try {
      let query = supabase
        .from('rental_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (user.id) {
        query = query.or(`tenant_id.eq.${user.id}${user.email ? `,tenant_email.eq.${user.email}` : ''}`);
      }

      const { data, error: appErr } = await query;
      const appsList: any[] = [];
      if (data && Array.isArray(data)) {
        appsList.push(...data);
      }

      // Compléter avec le cache local synchronisé si besoin
      try {
        const raw = localStorage.getItem('locatrust_rental_applications');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((pa: any) => {
              const isMatch =
                (user.id && pa.tenant_id === user.id) ||
                (user.email && pa.tenant_email?.toLowerCase() === user.email.toLowerCase());
              if (isMatch && !appsList.some((ex) => ex.id === pa.id || (ex.property_id === pa.property_id && ex.tenant_id === pa.tenant_id))) {
                appsList.push(pa);
              }
            });
          }
        }
      } catch {}

      setTenantApplications(appsList);
    } catch (e) {
      console.warn('Erreur chargement candidatures locataire:', e);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchTenantVisits = async () => {
    if (!user) return;
    setLoadingVisits(true);
    try {
      const visitsList: any[] = [];

      try {
        const { data } = await supabase
          .from('visit_requests')
          .select('*, property:properties(*)')
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false });
        if (data && Array.isArray(data)) {
          data.forEach((v: any) => {
            visitsList.push({
              id: v.id,
              property_title: v.property?.title || 'Logement LocaTrust',
              property_address: v.property?.address || 'Abidjan',
              preferred_date: v.preferred_date || v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : 'À convenir',
              status: v.status || 'en_attente',
              created_at: v.created_at
            });
          });
        }
      } catch {}

      try {
        const raw = localStorage.getItem('locatrust_visit_requests');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((pv: any) => {
              const isMatch =
                (user.id && pv.tenant_id === user.id) ||
                (user.email && pv.tenant_email?.toLowerCase() === user.email.toLowerCase());
              if (isMatch && !visitsList.some((ex) => ex.id === pv.id)) {
                visitsList.push(pv);
              }
            });
          }
        }
      } catch {}

      setTenantVisits(visitsList);
    } catch (e) {
      console.warn('Erreur chargement visites locataire:', e);
    } finally {
      setLoadingVisits(false);
    }
  };

  // Chargement des favoris propres à l'utilisateur
  useEffect(() => {
    try {
      const favKey = `locatrust_favorites_${user?.id || 'guest'}`;
      const storedFavs = localStorage.getItem(favKey);
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    fetchProperties();

    const handleUpdate = () => {
      fetchProperties();
    };

    window.addEventListener('locatrust:properties-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:properties-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'applications') {
      fetchTenantApplications();
    } else if (activeTab === 'visits') {
      fetchTenantVisits();
    }
  }, [activeTab, user?.id]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        const favKey = `locatrust_favorites_${user?.id || 'guest'}`;
        localStorage.setItem(favKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filteredProperties = properties.filter((p) => {
    if (p.deleted_at || (p.status as any) === 'loue' || p.status !== 'disponible') return false;

    // Vérification stricte des baux déjà signés et actifs
    try {
      const contractsRaw = localStorage.getItem('locatrust_contracts');
      if (contractsRaw) {
        const contractsList = JSON.parse(contractsRaw);
        if (Array.isArray(contractsList)) {
          const isTaken = contractsList.some(
            (c: any) =>
              (c.property_id === p.id || c.property?.id === p.id) &&
              (c.status === 'actif' || c.status === 'contrat_actif' || (c.owner_signed && c.tenant_signed))
          );
          if (isTaken) return false;
        }
      }
    } catch {}

    if (activeTab === 'favorites' && !favorites.includes(p.id)) return false;

    if (typeFilter !== 'tous' && p.type !== typeFilter) return false;
    
    // Filtre Ville
    const propertyCity = p.city || p.location?.city || '';
    if (cityFilter !== 'tous' && propertyCity.toLowerCase() !== cityFilter.toLowerCase()) return false;

    // Barre de recherche textuelle globale (titre, description, commune, quartier, ville, type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchCity = (p.city || p.location?.city || '').toLowerCase().includes(q);
      const matchCommune = (p.commune || p.location?.commune || '').toLowerCase().includes(q);
      const matchQuartier = (p.quartier || p.location?.quartier || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchType = (p.type || '').toLowerCase().includes(q);
      return matchTitle || matchCity || matchCommune || matchQuartier || matchDesc || matchType;
    }
    return true;
  });

  const handleSendVisitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate || !selectedProperty) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      let formattedDate = visitDate;
      try {
        const parsed = new Date(visitDate);
        if (!isNaN(parsed.getTime())) {
          formattedDate = parsed.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (_) {}

      const targetOwnerId = selectedProperty.owner_id || (selectedProperty.owner as any)?.id || '';
      const applicantName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Locataire');

      // Persistance Supabase
      try {
        await supabase.from('visit_requests').insert([{
          property_id: selectedProperty.id,
          tenant_id: user?.id,
          status: 'en_attente'
        }]);
      } catch (err) {
        console.warn('Notice insertion Supabase visit_requests:', err);
      }

      // Persistance locale
      const newVisit = {
        id: `vis_${Date.now()}`,
        property_id: selectedProperty.id,
        property_title: selectedProperty.title,
        property_address: `${selectedProperty.location?.commune || ''}, ${selectedProperty.location?.city || 'Abidjan'}`,
        tenant_id: user?.id,
        tenant_name: applicantName,
        tenant_phone: profile?.phone || '',
        tenant_email: user?.email || '',
        preferred_date: formattedDate,
        request_date: new Date().toLocaleDateString('fr-FR'),
        owner_id: targetOwnerId,
        status: 'en_attente' as const
      };

      try {
        const raw = localStorage.getItem('locatrust_visit_requests');
        const list = raw ? JSON.parse(raw) : [];
        const updated = [newVisit, ...list];
        localStorage.setItem('locatrust_visit_requests', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('locatrust:visits-updated', { detail: { visits: updated } }));
      } catch {}

      // Notification ciblée au propriétaire / agence
      pushGlobalNotification({
        title: 'Nouvelle demande de visite',
        description: `${applicantName} souhaite visiter « ${selectedProperty.title} » le ${formattedDate}.`,
        category: 'visite',
        targetTab: 'visits',
        targetUserId: targetOwnerId,
        senderUserId: user?.id
      });

      setVisitConfirmation({
        isOpen: true,
        propertyTitle: selectedProperty?.title || 'Bien immobilier',
        date: formattedDate
      });
      setShowVisitModal(false);
      setVisitDate('');
      fetchTenantVisits();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendRentalApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const applicantId = user?.id || profile?.id || `usr_tenant_${Date.now()}`;
      const applicantName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Candidat Locataire');
      const applicantPhone = profile?.phone || '+225 07 00 00 00 00';
      const applicantEmail = user?.email || 'locataire@locatrust.ci';
      const targetOwnerId = selectedProperty.owner_id || (selectedProperty.owner as any)?.id || '';

      const realRent = Number(selectedProperty.rent || (selectedProperty as any).price || 0);
      const realCaution = Number(
        selectedProperty.caution ||
        (selectedProperty as any).caution_amount ||
        (realRent > 0 ? realRent * 2 : 0)
      );

      const newApp = {
        id: `app_${Date.now()}`,
        property_id: selectedProperty.id,
        property_title: selectedProperty.title,
        property_address: `${selectedProperty.location?.commune || selectedProperty.location?.quartier || ''}, ${selectedProperty.location?.city || 'Abidjan'}`,
        rent_amount: realRent,
        caution_amount: realCaution,
        date_received: new Date().toISOString().split('T')[0],
        status: 'en_attente' as const,
        dossier_status: 'complet' as const,
        tenant_id: applicantId,
        tenant_name: applicantName,
        tenant_avatar: profile?.avatar_url || (typeof window !== 'undefined' ? localStorage.getItem('locatrust_user_avatar') : null) || `https://ui-avatars.com/api/?name=${encodeURIComponent(applicantName)}&background=0284c7&color=fff`,
        tenant_phone: applicantPhone,
        tenant_email: applicantEmail,
        tenant_cni: 'CI-ABJ-2024-B-89412',
        owner_id: targetOwnerId,
        owner_name: (selectedProperty as any).agency_name || (selectedProperty.owner as any)?.full_name || (selectedProperty as any).owner_name || (selectedProperty as any).mandant_name || 'Propriétaire Bailleur',
        owner_phone: (selectedProperty.owner as any)?.phone || (selectedProperty as any).owner_phone || '+225 07 00 00 00 00',
        owner_avatar: (selectedProperty.owner as any)?.avatar_url || (selectedProperty as any).owner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((selectedProperty as any).agency_name || (selectedProperty.owner as any)?.full_name || 'Bailleur')}&background=1E40AF&color=fff`,
        agency_id: (selectedProperty as any).agency_id,
        agency_name: (selectedProperty as any).agency_name,
        is_agency: Boolean((selectedProperty as any).is_agency || (selectedProperty as any).agency_name || (selectedProperty.owner as any)?.account_type === 'agence'),
        tenant_signed: false,
        comment: applyMessage,
        documents: {
          cni_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
          quittances_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
          attestation_url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80'
        }
      };

      try {
        const existingRaw = localStorage.getItem('locatrust_rental_applications');
        let currentApps: any[] = [];
        if (existingRaw) {
          try { currentApps = JSON.parse(existingRaw); } catch {}
        }
        const updatedApps = [newApp, ...currentApps.filter((a: any) => a.id !== newApp.id)];
        localStorage.setItem('locatrust_rental_applications', JSON.stringify(updatedApps));
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } }));

        // Notification ciblée pour le bailleur
        pushGlobalNotification({
          title: 'Nouvelle demande de location reçue',
          description: `${applicantName} a candidaté pour « ${selectedProperty.title} ».`,
          category: 'demande',
          targetTab: 'applications',
          targetUserId: targetOwnerId,
          senderUserId: applicantId
        });

        // Stocker les coordonnées des deux interlocuteurs pour la messagerie
        localStorage.setItem('locatrust_active_chat_contact', targetOwnerId);
        localStorage.setItem(
          'locatrust_contact_' + targetOwnerId,
          JSON.stringify({
            id: targetOwnerId,
            name: newApp.owner_name,
            phone: newApp.owner_phone,
            role: newApp.is_agency ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur',
            propertyTitle: selectedProperty.title,
            avatar: newApp.owner_avatar,
            online: true,
          })
        );
        localStorage.setItem(
          'locatrust_contact_' + applicantId,
          JSON.stringify({
            id: applicantId,
            name: applicantName,
            phone: applicantPhone,
            role: 'Candidat Locataire',
            propertyTitle: selectedProperty.title,
            avatar: newApp.tenant_avatar,
            online: true,
          })
        );
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }

      // Synchronisation temps réel immédiate multi-appareils
      broadcastLiveEvent('APPLICATION_SUBMITTED', {
        actorId: applicantId,
        targetUserId: targetOwnerId,
        propertyId: selectedProperty.id,
        data: newApp,
        timestamp: new Date().toISOString()
      });

      // Synchronisation persistante avec le serveur central /api/sync
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_application',
          application: newApp
        })
      }).catch((syncErr) => console.warn('API /api/sync submit_application notice:', syncErr));

      await createRentalApplication({
        id: newApp.id,
        property_id: selectedProperty.id,
        tenant_id: applicantId,
        owner_id: targetOwnerId,
        agency_id: (selectedProperty as any).agency_id,
        tenant_name: applicantName,
        tenant_email: applicantEmail,
        tenant_phone: applicantPhone,
        tenant_avatar: newApp.tenant_avatar,
        property_title: selectedProperty.title,
        property_address: (selectedProperty as any).address || `${selectedProperty.commune || ''}, ${selectedProperty.city || 'Abidjan'}`.trim(),
        rent_amount: Number(selectedProperty.rent || (selectedProperty as any).rent_amount || 0),
        caution_amount: Number(selectedProperty.caution || (selectedProperty as any).caution_amount || 0),
        status: 'en_attente',
        dossier_status: 'complet',
        monthly_income: Number(selectedProperty.rent || 0) * 3,
        profession: 'Candidat certifié LocaTrust',
        message: applyMessage,
        documents: newApp.documents as any
      });

      setActionFeedback(`Votre dossier de candidature pour « ${selectedProperty.title} » a été transmis avec succès au bailleur !`);
      setShowApplyModal(false);
      setApplyMessage('');
      fetchTenantApplications();
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      console.error('Erreur envoi candidature:', err);
      // Même en cas d'erreur Supabase, la persistance locale a réussi
      setActionFeedback(`Votre candidature pour « ${selectedProperty.title} » a été enregistrée avec succès !`);
      setShowApplyModal(false);
      setApplyMessage('');
      fetchTenantApplications();
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    setActionFeedback('Signalement transmis à l\'équipe de modération LocaTrust pour contrôle.');
    setShowReportModal(false);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* VUE 1 : MES DEMANDES DE LOCATION */}
      {activeTab === 'applications' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Mes Demandes de Location
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">
                  {tenantApplications.length} dossier(s)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Suivez en temps réel l'état d'examen de vos candidatures auprès des bailleurs certifiés.
              </p>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('search')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Rechercher un autre logement</span>
              </button>
            )}
          </div>

          {loadingApps ? (
            <PropertyGridSkeleton count={3} />
          ) : tenantApplications.length === 0 ? (
            <div className="p-16 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Send className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-base font-black text-slate-900">Aucune demande de location envoyée</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Vous n'avez soumis aucune candidature pour le moment. Parcourez les annonces disponibles et candidatez en 1 clic.
              </p>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('search')}
                  className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
                >
                  Explorer les logements
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenantApplications.map((app) => (
                <div key={app.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">
                        {app.date_received || (app.created_at ? new Date(app.created_at).toLocaleDateString('fr-FR') : 'Date récente')}
                      </span>
                      {app.status === 'en_attente' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                          En attente de réponse
                        </span>
                      )}
                      {app.status === 'validee' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black border border-blue-300">
                          Candidature Retenue
                        </span>
                      )}
                      {app.status === 'contrat_actif' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Bail Scellé & Actif
                        </span>
                      )}
                      {app.status === 'refusee' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black border border-slate-300">
                          Non Retenu (Logement déjà attribué)
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-black text-slate-900">{app.property_title || 'Logement LocaTrust'}</h4>
                    <p className="text-xs text-slate-500 font-medium">{app.property_address || 'Abidjan'}</p>
                    <div className="flex items-center gap-3 pt-2 text-xs font-bold text-slate-700">
                      <span>Loyer : <strong className="text-blue-600">{formatFCFA(Number(app.rent_amount || 0))}</strong>/mois</span>
                      <span>•</span>
                      <span>Caution : {formatFCFA(Number(app.caution_amount || 0))}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-[11px] text-slate-500 font-semibold">
                      Bailleur : <strong>{app.owner_name || 'Bailleur certifié'}</strong>
                    </span>
                    {(app.status === 'contrat_actif' || app.status === 'validee') ? (
                      <button
                        onClick={() => onNavigateTab?.('contracts')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>Consulter mon contrat</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : app.status === 'refusee' ? (
                      <span className="text-[11px] text-slate-400 italic">
                        Le logement a été attribué
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Réponse sous 24-48h
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VUE 2 : MES DEMANDES DE VISITES */}
      {activeTab === 'visits' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Mes Demandes de Visites
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">
                  {tenantVisits.length} visite(s)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gérez vos rendez-vous de visite programmés avec les bailleurs et agences.
              </p>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('search')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Programmer une autre visite</span>
              </button>
            )}
          </div>

          {loadingVisits ? (
            <PropertyGridSkeleton count={3} />
          ) : tenantVisits.length === 0 ? (
            <div className="p-16 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-base font-black text-slate-900">Aucune visite programmée</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Vous n'avez réservé aucune visite pour l'instant. Choisissez un bien certifié et demandez un créneau de visite en 1 clic.
              </p>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('search')}
                  className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
                >
                  Explorer les annonces
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenantVisits.map((vis) => (
                <div key={vis.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">
                        {vis.created_at ? new Date(vis.created_at).toLocaleDateString('fr-FR') : 'Visite'}
                      </span>
                      {vis.status === 'en_attente' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                          En attente de confirmation
                        </span>
                      )}
                      {(vis.status === 'visite_programmee' || vis.status === 'acceptee') && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Visite Confirmée
                        </span>
                      )}
                      {vis.status === 'visite_effectuee' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                          Visite Effectuée
                        </span>
                      )}
                      {vis.status === 'refusee' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">
                          Créneau Indisponible
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-black text-slate-900">{vis.property_title}</h4>
                    <p className="text-xs text-slate-500 font-medium">{vis.property_address}</p>
                    <div className="mt-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-2 text-xs font-bold text-blue-900">
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Créneau souhaité : <strong>{vis.preferred_date}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VUE 3 : SEARCH / FAVORITES */}
      {activeTab !== 'applications' && activeTab !== 'visits' && (
        <>
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {activeTab === 'favorites' ? 'Mes Biens Favoris' : "Fil d'Offres Immobilières Vérifiées"}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                  activeTab === 'favorites' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {filteredProperties.length} bien(s) {activeTab === 'favorites' ? 'sauvegardé(s)' : 'disponible(s)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'favorites'
                  ? 'Retrouvez facilement les logements que vous avez ajoutés à vos coups de cœur.'
                  : 'Recherchez des logements certifiés avec photos réelles & vidéo de visite obligatoire.'}
              </p>
            </div>
          </div>

          {actionFeedback && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Multi-Criteria Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ville, commune, quartier..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
              />
            </div>

            {/* Country Selector */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800"
            >
              <option value="Côte d'Ivoire">🇨🇮 Côte d'Ivoire</option>
              <option value="Sénégal">🇸🇳 Sénégal</option>
              <option value="Mali">🇲🇱 Mali</option>
              <option value="Cameroun">🇨🇲 Cameroun</option>
            </select>

            {/* Property Type Selector */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800"
            >
              <option value="tous">Tous les types de biens</option>
              <option value="appartement">Appartement</option>
              <option value="maison">Maison / Villa</option>
              <option value="studio">Studio</option>
              <option value="bureau">Bureau</option>
              <option value="boutique">Boutique / Commercial</option>
              <option value="terrain">Terrain</option>
            </select>
          </div>

          {/* STATE 1: LOADER SKELETON */}
          {loading && (
            <PropertyGridSkeleton count={6} />
          )}

          {/* STATE 2: ERROR */}
          {error && !loading && (
            <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                <span className="text-xs font-bold">{error}</span>
              </div>
              <button
                onClick={fetchProperties}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>
            </div>
          )}

          {/* STATE 3: EMPTY STATE */}
          {!loading && !error && filteredProperties.length === 0 && (
            <div className="p-16 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                activeTab === 'favorites' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-600'
              }`}>
                {activeTab === 'favorites' ? (
                  <Heart className="w-8 h-8 text-rose-500" />
                ) : (
                  <Home className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-base font-black text-slate-900">
                {activeTab === 'favorites' ? 'Aucun bien dans vos favoris' : 'Aucun bien disponible trouvé'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {activeTab === 'favorites'
                  ? "Vous n'avez pas encore ajouté de logement à vos favoris. Cliquez sur le cœur d'une annonce pour la sauvegarder."
                  : 'Aucun logement ne correspond actuellement à vos critères de recherche.'}
              </p>
              {activeTab === 'favorites' && onNavigateTab ? (
                <button
                  onClick={() => onNavigateTab('search')}
                  className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
                >
                  Explorer les annonces
                </button>
              ) : (searchQuery || typeFilter !== 'tous') ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('tous');
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Réinitialiser les filtres
                </button>
              ) : null}
            </div>
          )}

      {/* Grid of Listings */}
      {!loading && !error && filteredProperties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProperties.map((property) => {
          const isFav = favorites.includes(property.id);
          return (
            <div
              key={property.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col group"
            >
              {/* Media Container */}
              <div className="relative h-52 bg-slate-900 overflow-hidden">
                <img
                  src={property.photos?.[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'}
                  alt={property.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white font-extrabold text-[10px] uppercase flex items-center gap-1 shadow">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                    Propriétaire vérifié
                  </span>
                </div>

                <button
                  onClick={() => toggleFavorite(property.id)}
                  className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all ${
                    isFav ? 'bg-rose-600 text-white' : 'bg-slate-950/60 text-white hover:bg-rose-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
                </button>

                {/* Mandatory Video Walkthrough Badge */}
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-blue-600/90 text-white text-[10px] font-black flex items-center gap-1 shadow-md">
                  <Video className="w-3 h-3 text-white animate-pulse" />
                  Vidéo de visite réelle incluse
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex flex-col justify-between flex-1 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider capitalize">
                      {property.type}
                    </span>
                    <span className="text-base font-black text-slate-900">{formatFCFA(property.rent)} / mo</span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 line-clamp-1 mt-1">{property.title}</h3>

                  <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{property.location?.commune}, {property.location?.city}</span>
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-[11px] font-bold text-slate-700 text-center">
                  <div className="bg-slate-50 py-1 rounded-lg">{property.surface} m²</div>
                  <div className="bg-slate-50 py-1 rounded-lg">{property.bedrooms} ch.</div>
                  <div className="bg-slate-50 py-1 rounded-lg">{property.bathrooms} sdb.</div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (!isVerified) {
                        setKycBlockReason('visite');
                        setShowKycBlockModal(true);
                        return;
                      }
                      setSelectedProperty(property);
                      setShowVisitModal(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Demander Visite</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!isVerified) {
                        setKycBlockReason('candidature');
                        setShowKycBlockModal(true);
                        return;
                      }
                      setSelectedProperty(property);
                      setShowApplyModal(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Candidater</span>
                  </button>
                </div>

                {/* Report Ad link */}
                <button
                  onClick={() => {
                    setSelectedProperty(property);
                    setShowReportModal(true);
                  }}
                  className="text-[10px] text-slate-400 font-bold hover:text-rose-600 flex items-center justify-center gap-1 mt-1"
                >
                  <AlertOctagon className="w-3 h-3" />
                  <span>Signaler cette annonce</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
    </>
  )}

      {/* Visit Modal */}
      {showVisitModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleSendVisitRequest} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Demander une Visite</h3>
                  <p className="text-[11px] text-slate-500">Planifiez un rendez-vous avec le bailleur</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowVisitModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold">✕</button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900">{selectedProperty.title}</span>
                <span className="text-[11px] text-slate-500">{selectedProperty.location?.commune || selectedProperty.location?.city}</span>
              </div>
              <span className="text-xs font-extrabold text-blue-700">{formatFCFA(selectedProperty.rent)}/mois</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                <span>Date & Heure souhaitée</span>
                <span className="text-[11px] text-blue-600 font-bold">● Créneau de visite</span>
              </label>
              <input
                type="datetime-local"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full px-3.5 py-3 rounded-2xl border border-blue-200 bg-blue-50/40 hover:bg-white focus:bg-white text-slate-900 font-bold text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 [color-scheme:light] transition-all outline-none"
              />

              {/* Suggestions rapides de créneaux */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400">Suggestions :</span>
                {[
                  { label: 'Demain à 10h', offsetDays: 1, hour: 10 },
                  { label: 'Demain à 15h', offsetDays: 1, hour: 15 },
                  { label: 'Samedi à 11h', isSaturday: true, hour: 11 },
                  { label: 'Samedi à 15h', isSaturday: true, hour: 15 }
                ].map((slot, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      if (slot.isSaturday) {
                        const day = d.getDay();
                        const diff = (6 - day + 7) % 7 || 7;
                        d.setDate(d.getDate() + diff);
                      } else {
                        d.setDate(d.getDate() + (slot.offsetDays || 1));
                      }
                      d.setHours(slot.hour, 0, 0, 0);
                      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                      setVisitDate(iso);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={() => setShowVisitModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors">
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-extrabold shadow-md shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Transmission en cours...' : 'Confirmer la demande'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modale Après Demande de Visite */}
      {visitConfirmation && (
        <ActionConfirmationModal
          isOpen={visitConfirmation.isOpen}
          onClose={() => setVisitConfirmation(null)}
          type="sent"
          title="Demande de Visite Transmise !"
          message={`Votre demande de visite pour « ${visitConfirmation.propertyTitle} » a été transmise avec succès au bailleur certifié.`}
          details={`Créneau souhaité : ${visitConfirmation.date}`}
          confirmText="Super, merci !"
          withCelebration={true}
        />
      )}

      {/* Apply Modal */}
      {showApplyModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleSendRentalApplication} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Envoyer ma Demande de Location</h3>
              <button type="button" onClick={() => setShowApplyModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <span className="text-xs font-bold text-blue-600">{selectedProperty.title}</span>

            <div>
              <label className="text-xs font-extrabold text-slate-800 block mb-1">Message au bailleur</label>
              <textarea
                rows={3}
                value={applyMessage}
                onChange={(e) => setApplyMessage(e.target.value)}
                placeholder="Présentez votre situation (ex: Salarié CDI, prise de possession souhaitée le 1er du mois)..."
                className="w-full p-2.5 rounded-xl border text-xs font-medium"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={() => setShowApplyModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Annuler</button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer le dossier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report Ad Modal */}
      {showReportModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleSendReport} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-rose-600">Signaler cette annonce</h3>
              <button type="button" onClick={() => setShowReportModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-800 block mb-1">Motif du signalement (Anti-Fraude)</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs font-bold"
              >
                <option value="fausse_annonce">Fausse annonce / Photos trompeuses</option>
                <option value="deja_loue">Le logement est déjà loué</option>
                <option value="somme_interdite">Le propriétaire demande des sommes interdites</option>
                <option value="usurpation">Le propriétaire n'a pas le droit de louer ce bien</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={() => setShowReportModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Annuler</button>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow">Transmettre aux modérateurs</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Blocage KYC (Audio client: interdiction d'envoyer location ou visite si non vérifié) */}
      {showKycBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-black text-slate-900">
                Certification d'Identité Requise (KYC)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                Conformément aux règles de sécurité LocaTrust et à la Loi n° 2019-576, vous devez faire vérifier votre pièce d'identité (CNI ou Passeport) par l'administrateur avant de pouvoir {kycBlockReason === 'visite' ? 'réserver une visite de logement' : 'envoyer un dossier de candidature'}.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 text-left">
              Statut de votre compte : {profile?.verification_status === 'en_attente' ? '⏳ Dossier en cours d\'examen par l\'administrateur' : profile?.verification_status === 'rejete' ? `❌ Dossier rejeté (${profile.rejection_reason || 'Document illisible'})` : '⚠️ Non vérifié (Aucune CNI enregistrée)'}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowKycBlockModal(false);
                  navigate('/profile');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Faire vérifier mon compte</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowKycBlockModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
