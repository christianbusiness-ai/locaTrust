'use client';

import React, { useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { Property } from '@/types/database.types';
import { MOCK_PROPERTIES } from '@/lib/mock/data';

export const LocataireSearchView: React.FC = () => {
  const [properties] = useState<Property[]>(MOCK_PROPERTIES);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('Côte d\'Ivoire');
  const [cityFilter, setCityFilter] = useState<string>('tous');
  const [typeFilter, setTypeFilter] = useState<string>('tous');
  const [favorites, setFavorites] = useState<string[]>(['prop_1']);
  
  // Active Modals State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showVisitModal, setShowVisitModal] = useState<boolean>(false);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Form states for visit & application
  const [visitDate, setVisitDate] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [reportReason, setReportReason] = useState('');

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredProperties = properties.filter((p) => {
    if (p.status !== 'disponible') return false; // Only AVAILABLE properties in marketplace feed
    if (typeFilter !== 'tous' && p.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchCity = p.location?.city?.toLowerCase().includes(q) || false;
      const matchCommune = p.location?.commune?.toLowerCase().includes(q) || false;
      return matchTitle || matchCity || matchCommune;
    }
    return true;
  });

  const handleSendVisitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Demande de visite pour le ${visitDate} transmise au bailleur !`);
    setShowVisitModal(false);
  };

  const handleSendRentalApplication = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Candidature à la location transmise avec votre profil au bailleur !');
    setShowApplyModal(false);
  };

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Signalement transmis à l\'équipe de modération LocaTrust pour contrôle.');
    setShowReportModal(false);
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

      {/* Grid of Listings */}
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
                      setSelectedProperty(property);
                      setShowVisitModal(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Demander Visite</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedProperty(property);
                      setShowApplyModal(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95"
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

    </div>
  );
};
