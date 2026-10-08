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
  ArrowRight
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { Property } from '@/types/database.types';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PropertyGridSkeleton } from '@/components/common/SkeletonLoader';

export const LocataireSearchView: React.FC = () => {
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
  
  // Active Modals State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showVisitModal, setShowVisitModal] = useState<boolean>(false);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Form states for visit & application
  const [visitDate, setVisitDate] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [reportReason, setReportReason] = useState('');

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

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredProperties = properties.filter((p) => {
    if (p.status !== 'disponible') return false; // Only AVAILABLE properties in marketplace feed
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

  const handleSendVisitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setActionFeedback(`Demande de visite pour le ${visitDate} transmise avec succès au bailleur !`);
    setShowVisitModal(false);
    setVisitDate('');
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleSendRentalApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    try {
      setIsSubmitting(true);
      const applicantName = profile?.full_name || user?.email || 'Candidat Locataire';
      const { error: appErr } = await supabase.from('rental_applications').insert([
        {
          property_id: selectedProperty.id,
          tenant_id: user?.id || null,
          tenant_name: applicantName,
          tenant_email: user?.email || '',
          tenant_phone: profile?.phone || '',
          status: 'en_attente',
          monthly_income: 0,
          profession: 'Candidat LocaTrust',
          message: applyMessage,
          documents: []
        }
      ]);
      if (appErr) throw appErr;

      // Broadcast update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
      }

      setActionFeedback(`Votre dossier de candidature pour « ${selectedProperty.title} » a été transmis avec succès au bailleur !`);
      setShowApplyModal(false);
      setApplyMessage('');
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      console.error('Erreur envoi candidature:', err);
      alert('Erreur lors de l\'envoi de la candidature. Veuillez réessayer.');
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
      
      {/* Search Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Fil d'Offres Immobilières Vérifiées
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">
              {filteredProperties.length} disponible(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recherchez des logements certifiés avec <strong>photos réelles & vidéo de visite obligatoire</strong>.
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
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Home className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900">Aucun bien disponible trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Aucun logement ne correspond actuellement à vos critères de recherche.
          </p>
          {(searchQuery || typeFilter !== 'tous') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('tous');
              }}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
            >
              Réinitialiser les filtres
            </button>
          )}
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
                  src={property.photos[0]}
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

      {/* Visit Modal */}
      {showVisitModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleSendVisitRequest} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Demander une Visite</h3>
              <button type="button" onClick={() => setShowVisitModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <span className="text-xs font-bold text-blue-600">{selectedProperty.title}</span>

            <div>
              <label className="text-xs font-extrabold text-slate-800 block mb-1">Date & Heure souhaitée</label>
              <input
                type="datetime-local"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs font-bold"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={() => setShowVisitModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Annuler</button>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow">Confirmer la demande</button>
            </div>
          </form>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
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
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow">Envoyer le dossier</button>
            </div>
          </form>
        </div>
      )}

      {/* Report Ad Modal */}
      {showReportModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
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
