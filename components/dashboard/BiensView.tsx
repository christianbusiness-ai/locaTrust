'use client';

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Trash2,
  RotateCcw,
  Eye,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Tag,
  ChevronRight,
  Sparkles,
  DollarSign,
  ShieldCheck
} from 'lucide-react';
import { Property, PropertyType, PropertyStatus } from '@/types/database.types';
import { formatFCFA } from '@/lib/utils';
import { MOCK_PROPERTIES } from '@/lib/mock/data';

interface BiensViewProps {
  onOpenAddProperty: () => void;
  onSelectProperty?: (propertyId: string) => void;
}

const PROPERTY_TYPES: { id: PropertyType | 'tous'; label: string }[] = [
  { id: 'tous', label: 'Tous les types' },
  { id: 'appartement', label: 'Appartement' },
  { id: 'maison', label: 'Maison' },
  { id: 'studio', label: 'Studio' },
  { id: 'chambre-salon', label: 'Chambre-salon' },
  { id: 'entree-coucher', label: 'Entrée-coucher' },
  { id: 'villa', label: 'Villa' },
  { id: 'duplex', label: 'Duplex' },
  { id: 'bureau', label: 'Bureau' },
  { id: 'magasin', label: 'Magasin' },
  { id: 'boutique', label: 'Boutique' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'entrepot', label: 'Entrepôt' },
  { id: 'parking', label: 'Parking' },
  { id: 'autre', label: 'Autre' },
];

export const BiensView: React.FC<BiensViewProps> = ({
  onOpenAddProperty,
  onSelectProperty,
}) => {
  const [properties, setProperties] = useState<Property[]>(MOCK_PROPERTIES);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('tous');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showTrash, setShowTrash] = useState<boolean>(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Filter properties
  const filteredProperties = properties.filter((p) => {
    // Trash bin logic (Soft Delete)
    if (showTrash) {
      if (!p.deleted_at) return false;
    } else {
      if (p.deleted_at) return false;
    }

    if (activeTypeFilter !== 'tous' && p.type !== activeTypeFilter) return false;
    if (activeStatusFilter !== 'tous' && p.status !== activeStatusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchCity = p.location?.city?.toLowerCase().includes(q) || false;
      const matchCommune = p.location?.commune?.toLowerCase().includes(q) || false;
      const matchQuartier = p.location?.quartier?.toLowerCase().includes(q) || false;
      return matchTitle || matchCity || matchCommune || matchQuartier;
    }

    return true;
  });

  // Handle Soft Delete
  const handleSoftDelete = (id: string) => {
    if (confirm('Voulez-vous placer ce bien dans la corbeille temporaire ?')) {
      setProperties((prev) =>
        prev.map((p) => (p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p))
      );
    }
  };

  // Handle Restore from Trash
  const handleRestore = (id: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deleted_at: undefined } : p))
    );
  };

  // Status Badge Helper
  const getStatusBadge = (status: PropertyStatus) => {
    switch (status) {
      case 'disponible':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Disponible
          </span>
        );
      case 'loue':
        return (
          <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-white" />
            Loué (Contrat actif)
          </span>
        );
      case 'reserve':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <Clock className="w-3 h-3 text-slate-950" />
            Réservé
          </span>
        );
      case 'fin_de_contrat':
        return (
          <span className="px-3 py-1 rounded-full bg-purple-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <AlertCircle className="w-3 h-3 text-white" />
            Fin de contrat
          </span>
        );
      case 'desactive':
        return (
          <span className="px-3 py-1 rounded-full bg-slate-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
            Désactivé
          </span>
        );
      default:
        return null;
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredProperties.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const paginatedProperties = filteredProperties.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {showTrash ? 'Corbeille temporaire' : 'Mes Biens Immobiliers'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-extrabold">
              {filteredProperties.length} bien{filteredProperties.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {showTrash
              ? 'Biens supprimés conservés temporairement avant suppression définitive.'
              : 'Gérez vos logements, espaces commerciaux, bureaux et terrains avec statuts automatisés.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
              showTrash
                ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm'
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{showTrash ? 'Voir les biens actifs' : 'Corbeille'}</span>
          </button>

          {!showTrash && (
            <button
              onClick={onOpenAddProperty}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau bien</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chercher ville, quartier, titre..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
          />
        </div>

        {/* Type selector */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTypeFilter(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                activeTypeFilter === t.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={activeStatusFilter}
          onChange={(e) => setActiveStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-700 focus:outline-none"
        >
          <option value="tous">Tous les statuts</option>
          <option value="disponible">Disponible</option>
          <option value="loue">Loué</option>
          <option value="reserve">Réservé</option>
          <option value="fin_de_contrat">Fin de contrat</option>
          <option value="desactive">Désactivé</option>
        </select>
      </div>

      {/* Main Grid View */}
      {filteredProperties.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucun bien ne correspond aux critères</h3>
          <p className="text-xs text-slate-500 max-w-md">
            Modifiez vos filtres ou ajoutez un nouveau bien immobilier avec toutes ses métadonnées (types, GPS, photos, caution, loyer).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProperties.map((property) => (
            <div
              key={property.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col group"
            >
              {/* Photo Header */}
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                <img
                  src={
                    property.photos?.[0] ||
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
                  }
                  alt={property.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                />
                
                {/* Status Overlay */}
                <div className="absolute top-3 left-3">
                  {getStatusBadge(property.status)}
                </div>

                {/* Type Badge */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-black capitalize border border-white/20">
                  {property.type}
                </div>

                {/* Price tag */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <span className="text-lg font-black text-amber-300 drop-shadow-md">
                    {formatFCFA(property.rent)} <span className="text-xs text-white/80 font-normal">/ mois</span>
                  </span>
                  {property.furnished && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-white font-extrabold text-[10px] shadow">
                      Meublé
                    </span>
                  )}
                </div>
              </div>

              {/* Body Content */}
              <div className="p-5 flex flex-col gap-3 flex-1 justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-1">
                    {property.title}
                  </h3>
                  
                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {property.location?.commune}, {property.location?.quartier} ({property.location?.city})
                    </span>
                  </div>

                  {/* Description preview */}
                  <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                    {property.description}
                  </p>
                </div>

                {/* Spec Badges */}
                <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-100 text-[11px] font-bold text-slate-700 text-center">
                  <div className="flex items-center justify-center gap-1 bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                    <Maximize2 className="w-3 h-3 text-blue-600" />
                    <span>{property.surface} m²</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                    <Bed className="w-3 h-3 text-blue-600" />
                    <span>{property.bedrooms} ch.</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                    <Bath className="w-3 h-3 text-blue-600" />
                    <span>{property.bathrooms} sdb.</span>
                  </div>
                </div>

                {/* Deposit & Charges summary */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Caution : <strong className="text-slate-800">{formatFCFA(property.caution)}</strong></span>
                  <span>Charges : <strong className="text-slate-800">{formatFCFA(property.charges)}</strong></span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setSelectedProperty(property)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Fiche complète</span>
                  </button>

                  {showTrash ? (
                    <button
                      onClick={() => handleRestore(property.id)}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all"
                      title="Restaurer le bien"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSoftDelete(property.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all"
                      title="Déplacer vers la corbeille"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAGINATION FONCTIONNELLE (Point 5) */}
        {filteredProperties.length > itemsPerPage && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Affichage {startIndex + 1} à {Math.min(startIndex + itemsPerPage, filteredProperties.length)} sur {filteredProperties.length} biens
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage === 1}
                className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                  validCurrentPage === 1
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Page précédente"
              >
                &laquo; Précédent
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = validCurrentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                  validCurrentPage === totalPages
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Page suivante"
              >
                Suivant &raquo;
              </button>
            </div>
          </div>
        )}

      {/* Property Detail Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedProperty.title}</h3>
                  <span className="text-xs text-slate-500 font-medium">Ref ID: {selectedProperty.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-6">
              
              {/* Photo Gallery Grid */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Galerie Photos & Médias</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {selectedProperty.photos.map((p, idx) => (
                    <img
                      key={idx}
                      src={p}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-28 object-cover rounded-xl border border-slate-200 hover:scale-105 transition-transform"
                    />
                  ))}
                </div>
              </div>

              {/* Specs Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">Type</span>
                  <span className="font-extrabold text-slate-900 capitalize">{selectedProperty.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Loyer mensuel</span>
                  <span className="font-extrabold text-blue-600">{formatFCFA(selectedProperty.rent)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Caution exigée</span>
                  <span className="font-extrabold text-slate-900">{formatFCFA(selectedProperty.caution)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Charges</span>
                  <span className="font-extrabold text-slate-900">{formatFCFA(selectedProperty.charges)}</span>
                </div>
              </div>

              {/* Location details */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-black">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Localisation enregistrée en base (auto-créée)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                  <div><strong>Pays:</strong> {selectedProperty.location?.country}</div>
                  <div><strong>Ville:</strong> {selectedProperty.location?.city}</div>
                  <div><strong>Commune:</strong> {selectedProperty.location?.commune}</div>
                  <div><strong>Quartier:</strong> {selectedProperty.location?.quartier}</div>
                </div>
              </div>

              {/* Equipments */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Équipements & Prestations</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProperty.equipments.map((eq, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-xl bg-slate-100 border text-slate-700 text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      {eq}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Description</h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border">
                  {selectedProperty.description}
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setSelectedProperty(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-md hover:bg-blue-500"
              >
                Fermer la fiche
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
