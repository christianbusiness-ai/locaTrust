'use client';

import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Heart,
  MessageSquare,
  Send,
  ShieldCheck,
  Video,
  Camera,
  Compass,
  MoreHorizontal,
  Bed,
  Sofa,
  Bath,
  Maximize2,
  Building,
  RotateCcw,
  Clock,
  Key,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { MOCK_PROPERTIES } from '@/lib/mock/data';
import { Property } from '@/types/database.types';
import { triggerCelebration } from '@/lib/celebration';

interface LocataireFeedViewProps {
  onOpenMessages?: (landlordName?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const LocataireFeedView: React.FC<LocataireFeedViewProps> = ({
  onOpenMessages,
  onNavigateTab
}) => {
  // Feed search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('Toutes les villes');
  const [districtFilter, setDistrictFilter] = useState('Tous les quartiers');
  const [typeFilter, setTypeFilter] = useState('Tous les types');
  const [budgetFilter, setBudgetFilter] = useState('Tous les budgets');
  const [roomsFilter, setRoomsFilter] = useState('Toutes');

  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({
    feed_1: false,
    feed_2: true,
    feed_3: false,
    feed_4: true
  });
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({
    feed_1: 24,
    feed_2: 18,
    feed_3: 31,
    feed_4: 15
  });

  // Gallery Modal State
  const [galleryModal, setGalleryModal] = useState<{
    item: any;
    activeIndex: number;
  } | null>(null);

  const openGallery = (item: any, index: number = 0) => {
    setGalleryModal({ item, activeIndex: index });
  };

  const closeGallery = () => setGalleryModal(null);

  const galleryImages = (item: any): string[] => [
    item.images.main,
    item.images.thumb1,
    item.images.thumb2
  ];

  // Modals state
  const [selectedRental, setSelectedRental] = useState<any | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [desiredDate, setDesiredDate] = useState('2026-10-01');
  const [applyComment, setApplyComment] = useState('Bonjour, je souhaite visiter et candidater pour ce logement. Mon dossier est complet.');
  const [directMessageText, setDirectMessageText] = useState('Bonjour, ce logement est-il toujours disponible ? Je souhaiterais planifier une visite.');
  const [applySuccessModal, setApplySuccessModal] = useState(false);

  const toggleLike = (id: string) => {
    setLikedPosts(prev => {
      const isLiked = !prev[id];
      setLikeCounts(cPrev => ({
        ...cPrev,
        [id]: isLiked ? (cPrev[id] || 0) + 1 : Math.max(0, (cPrev[id] || 1) - 1)
      }));
      return { ...prev, [id]: isLiked };
    });
  };

  const handleApply = (rental: any) => {
    setSelectedRental(rental);
    setIsApplyModalOpen(true);
  };

  const handleMessage = (rental: any) => {
    setSelectedRental(rental);
    setIsMessageModalOpen(true);
  };

  const submitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    setIsApplyModalOpen(false);
    setApplySuccessModal(true);
    triggerCelebration('send');
  };

  const submitMessage = (e: React.FormEvent) => {
    e.preventDefault();
    triggerCelebration('send');
    alert(`Votre message a été envoyé à ${selectedRental?.authorName} dans la messagerie LocaTrust !`);
    setIsMessageModalOpen(false);
    if (onOpenMessages) onOpenMessages(selectedRental?.authorName);
  };

  // Comprehensive verified feed database
  const ALL_FEED_ITEMS = [
    {
      id: 'feed_1',
      authorName: 'Aïcha Diallo',
      authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      isVerified: true,
      roleBadge: 'Propriétaire vérifié',
      locationPublished: 'Abidjan, Cocody Riviera • Publiée aujourd\'hui à 09:30',
      badge: 'À LOUER',
      title: 'Appartement 3 pièces moderne à Cocody Riviera',
      description: 'Bel appartement moderne avec 3 pièces, salon spacieux, cuisine équipée, 2 salles de bain et balcon avec belle vue.',
      city: 'Abidjan',
      district: 'Cocody Riviera',
      type: 'Appartement',
      price: 450000,
      location: 'Cocody Riviera, Abidjan',
      amenities: [
        { label: '2 Chambres', icon: Bed },
        { label: '1 Salon', icon: Sofa },
        { label: '2 Salles de bain', icon: Bath },
        { label: '120 m²', icon: Maximize2 },
        { label: '2e étage', icon: Building }
      ],
      images: {
        main: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80',
        thumb1: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
        thumb2: 'https://images.unsplash.com/photo-1540518614846-7ede433c4550?auto=format&fit=crop&w=400&q=80',
        extraCount: '+8'
      }
    },
    {
      id: 'feed_2',
      authorName: 'Koffi Traoré',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      isVerified: true,
      roleBadge: 'Propriétaire vérifié',
      locationPublished: 'Yamoussoukro, Quartier Millionnaire • Publiée hier à 18:45',
      badge: 'À LOUER',
      title: 'Villa duplex 5 pièces à Yamoussoukro',
      description: 'Villa duplex de standing avec 5 pièces, jardin, garage, chauffe-eau, climatisation et groupe électrogène.',
      city: 'Yamoussoukro',
      district: 'Quartier Millionnaire',
      type: 'Villa duplex',
      price: 750000,
      location: 'Yamoussoukro, Quartier Millionnaire',
      amenities: [
        { label: '4 Chambres', icon: Bed },
        { label: '2 Salons', icon: Sofa },
        { label: '4 Salles de bain', icon: Bath },
        { label: '250 m²', icon: Maximize2 },
        { label: 'Garage', icon: Building }
      ],
      images: {
        main: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80',
        thumb1: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
        thumb2: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
        extraCount: '+12'
      }
    },
    {
      id: 'feed_3',
      authorName: 'Jean-Marc Kouassi',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      isVerified: true,
      roleBadge: 'Agence agréée',
      locationPublished: 'Abidjan, Angré 8e tranche • Publiée aujourd\'hui',
      badge: 'À LOUER',
      title: 'Studio meublé de standing à Angré 8e tranche',
      description: 'Superbe studio meublé avec finitions de standing, internet fibre optique, gardiennage 24h/7j et terrasse privative.',
      city: 'Abidjan',
      district: 'Angré 8e tranche',
      type: 'Studio meublé',
      price: 220000,
      location: 'Angré 8e tranche, Abidjan',
      amenities: [
        { label: '1 Chambre', icon: Bed },
        { label: '1 Salon', icon: Sofa },
        { label: '1 Salle de bain', icon: Bath },
        { label: '45 m²', icon: Maximize2 },
        { label: 'Climatisé', icon: Building }
      ],
      images: {
        main: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
        thumb1: 'https://images.unsplash.com/photo-1502005229762-ee1b2b8100f9?auto=format&fit=crop&w=400&q=80',
        thumb2: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=400&q=80',
        extraCount: '+6'
      }
    },
    {
      id: 'feed_4',
      authorName: 'Fatou Bamba',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      isVerified: true,
      roleBadge: 'Propriétaire vérifié',
      locationPublished: 'Abidjan, Marcory Zone 4 • Publiée il y a 2 jours',
      badge: 'À LOUER',
      title: 'Appartement 2 pièces standing à Marcory Zone 4',
      description: 'Appartement lumineux et sécurisé au cœur de Zone 4, résidence avec piscine, ascenseur et parking souterrain.',
      city: 'Abidjan',
      district: 'Marcory Zone 4',
      type: 'Appartement',
      price: 350000,
      location: 'Marcory Zone 4, Abidjan',
      amenities: [
        { label: '1 Chambre', icon: Bed },
        { label: '1 Salon', icon: Sofa },
        { label: '1 Salle de bain', icon: Bath },
        { label: '70 m²', icon: Maximize2 },
        { label: 'Piscine', icon: Building }
      ],
      images: {
        main: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80',
        thumb1: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=400&q=80',
        thumb2: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
        extraCount: '+9'
      }
    },
    {
      id: 'feed_5',
      authorName: 'Patrick Touré',
      authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
      isVerified: true,
      roleBadge: 'Propriétaire vérifié',
      locationPublished: 'Abidjan, Riviera M\'Badon • Publiée cette semaine',
      badge: 'À LOUER',
      title: 'Villa 4 pièces avec jardin à Riviera M\'Badon',
      description: 'Splendide villa d\'architecte avec grand jardin paysager, séjour cathédrale, cuisine américaine et suite parentale.',
      city: 'Abidjan',
      district: 'Riviera M\'Badon',
      type: 'Villa duplex',
      price: 650000,
      location: 'Riviera M\'Badon, Abidjan',
      amenities: [
        { label: '3 Chambres', icon: Bed },
        { label: '1 Grand Salon', icon: Sofa },
        { label: '3 Salles de bain', icon: Bath },
        { label: '210 m²', icon: Maximize2 },
        { label: 'Jardin privé', icon: Building }
      ],
      images: {
        main: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
        thumb1: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
        thumb2: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=400&q=80',
        extraCount: '+15'
      }
    }
  ];

  const handleExecuteSearch = () => {
    setActiveSearch(searchQuery.trim());
  };

  const handleResetAll = () => {
    setSearchQuery('');
    setActiveSearch('');
    setCityFilter('Toutes les villes');
    setDistrictFilter('Tous les quartiers');
    setTypeFilter('Tous les types');
    setBudgetFilter('Tous les budgets');
    setRoomsFilter('Toutes');
  };

  // Filtrage précis selon la saisie et les filtres sélectionnés
  const filteredFeedItems = ALL_FEED_ITEMS.filter((item) => {
    // 1. Recherche textuelle (titre, description, commune, quartier, ville, type)
    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      const matchText =
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    // 2. Filtre Ville
    if (cityFilter !== 'Toutes les villes' && !item.city.toLowerCase().includes(cityFilter.toLowerCase())) {
      return false;
    }

    // 3. Filtre Quartier
    if (
      districtFilter !== 'Tous les quartiers' &&
      !item.district.toLowerCase().includes(districtFilter.toLowerCase()) &&
      !item.location.toLowerCase().includes(districtFilter.toLowerCase())
    ) {
      return false;
    }

    // 4. Filtre Type de bien
    if (typeFilter !== 'Tous les types' && !item.type.toLowerCase().includes(typeFilter.toLowerCase())) {
      return false;
    }

    // 5. Filtre Budget
    if (budgetFilter !== 'Tous les budgets') {
      if (budgetFilter === '≤ 200 000 FCFA' && item.price > 200000) return false;
      if (budgetFilter === '≤ 500 000 FCFA' && item.price > 500000) return false;
      if (budgetFilter === '≤ 1 000 000 FCFA' && item.price > 1000000) return false;
      if (budgetFilter === '> 1 000 000 FCFA' && item.price <= 1000000) return false;
    }

    return true;
  });

  // Propositions similaires affichées lorsqu'aucun résultat direct n'est trouvé
  const similarPropositions = ALL_FEED_ITEMS.filter((item) => {
    // Proposer des biens alternatifs certifiés
    if (cityFilter !== 'Toutes les villes' && item.city.toLowerCase().includes(cityFilter.toLowerCase())) {
      return true;
    }
    if (typeFilter !== 'Tous les types' && item.type.toLowerCase().includes(typeFilter.toLowerCase())) {
      return true;
    }
    return true;
  }).slice(0, 3);

  const favoriteAnnouncements = [
    {
      id: 'fav_1',
      title: 'Studio meublé à Angré',
      neighborhood: 'Angré 8e tranche',
      price: 220000,
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'fav_2',
      title: 'Appartement 2 pièces',
      neighborhood: 'Marcory Zone 4',
      price: 300000,
      image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'fav_3',
      title: 'Villa 4 pièces',
      neighborhood: "Riviera M'Badon",
      price: 650000,
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=200&q=80'
    }
  ];

  const recentSearches = [
    { query: 'Appartements à Cocody', count: '20 résultats' },
    { query: 'Maisons à Yamoussoukro', count: '15 résultats' },
    { query: 'Studios à Marcory', count: '12 résultats' }
  ];

  // Render individual feed post card with optional "Proposition similaire" badge
  const renderFeedCard = (item: any, isSimilar: boolean = false) => (
    <div
      key={item.id + (isSimilar ? '_sim' : '')}
      className={`bg-white rounded-2xl border ${
        isSimilar ? 'border-amber-200/90 ring-1 ring-amber-100' : 'border-slate-200/90'
      } shadow-sm overflow-hidden flex flex-col gap-3 p-5 transition-all hover:shadow-md`}
    >
      {/* Proposition similaire header if applicable */}
      {isSimilar && (
        <div className="flex items-center justify-between pb-2 border-b border-amber-100 text-amber-800 text-xs font-extrabold">
          <span className="flex items-center gap-1.5 bg-amber-100/90 px-3 py-1 rounded-full text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Proposition similaire recommandée
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Alternative disponible dans la même région</span>
        </div>
      )}

      {/* Post Header: Author info & badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={item.authorAvatar}
            alt={item.authorName}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900">{item.authorName}</span>
              <ShieldCheck className="w-4 h-4 text-blue-600 fill-blue-50" />
            </div>
            <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
              🛡️ {item.roleBadge}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {item.locationPublished}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-extrabold text-[11px] tracking-wide uppercase shadow-sm">
            {item.badge}
          </span>
          <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Collage Images: Large left + 2 stacked right — CLICKABLE GALLERY */}
      <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden h-64 sm:h-72 my-1">
        <div
          className="col-span-2 h-full relative group cursor-pointer overflow-hidden"
          onClick={() => openGallery(item, 0)}
          title="Voir la galerie complète"
        >
          <img
            src={item.images.main}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-black bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
              Voir la galerie
            </span>
          </div>
        </div>
        <div className="col-span-1 grid grid-rows-2 gap-2 h-full">
          <div
            className="relative group cursor-pointer overflow-hidden rounded-r-none"
            onClick={() => openGallery(item, 1)}
          >
            <img
              src={item.images.thumb1}
              alt="Vue pièce"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </div>
          <div
            className="relative group cursor-pointer overflow-hidden"
            onClick={() => openGallery(item, 2)}
          >
            <img
              src={item.images.thumb2}
              alt="Vue intérieure"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center backdrop-blur-[1px] hover:bg-black/35 transition-colors">
              <span className="text-white font-extrabold text-base sm:text-lg">
                {item.images.extraCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Post Title & Description */}
      <div className="flex flex-col gap-1">
        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          {item.title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 font-medium line-clamp-2">
          {item.description}
        </p>
      </div>

      {/* Amenities Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {item.amenities.map((amenity: any, idx: number) => {
          const Icon = amenity.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold"
            >
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              <span>{amenity.label}</span>
            </div>
          );
        })}
      </div>

      {/* Price & Location Row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black text-blue-700">
            {formatFCFA(item.price)}
          </span>
          <span className="text-xs font-semibold text-slate-500">/ mois</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{item.location}</span>
        </div>
      </div>

      {/* Bottom Actions: Message, Demander, Heart */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => handleMessage(item)}
          className="flex-1 py-2.5 px-3 rounded-xl border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100/70 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="whitespace-nowrap">Envoyer un message</span>
        </button>

        <button
          onClick={() => handleApply(item)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
        >
          <Key className="w-4 h-4" />
          <span className="whitespace-nowrap">Demander cette location</span>
        </button>

        <button
          onClick={() => toggleLike(item.id)}
          className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 ${
            likedPosts[item.id]
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
          title="Ajouter aux favoris"
        >
          <Heart
            className={`w-4 h-4 ${likedPosts[item.id] ? 'fill-rose-500 text-rose-500' : ''}`}
          />
          <span className="text-xs font-black">{likeCounts[item.id] || 0}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full animate-fadeIn font-sans pb-12">
      
      {/* ======================================================== */}
      {/* CENTER COLUMN: MAIN FEED (Fidèle à l'image du locataire) */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        
        {/* BARRE DE RECHERCHE & FILTRES INTÉGRÉS POUR LE LOCATAIRE */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col gap-3.5">
          <div className="relative w-full flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="locataire-feed-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleExecuteSearch();
                  }
                }}
                placeholder="Rechercher par commune, quartier, type (ex: 3 pièces Cocody)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl pl-9 sm:pl-11 pr-8 sm:pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveSearch('');
                  }}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors"
                  title="Effacer le texte"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>

            {/* Bouton pour lancer la recherche */}
            <button
              id="locataire-feed-search-btn"
              type="button"
              onClick={handleExecuteSearch}
              className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all active:scale-95 shrink-0"
              title="Lancer la recherche"
            >
              <Search className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">Rechercher</span>
            </button>
          </div>

          {/* Filtres intégrés sur la même barre */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            {/* Ville */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option>Toutes les villes</option>
                <option>Abidjan</option>
                <option>Yamoussoukro</option>
                <option>Bouaké</option>
                <option>San-Pédro</option>
              </select>
            </div>

            {/* Quartier */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors">
              <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option>Tous les quartiers</option>
                <option>Cocody Riviera</option>
                <option>Angré 8e tranche</option>
                <option>Marcory Zone 4</option>
                <option>Quartier Millionnaire</option>
                <option>Riviera M'Badon</option>
              </select>
            </div>

            {/* Type */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors">
              <Sofa className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option>Tous les types</option>
                <option>Appartement</option>
                <option>Villa duplex</option>
                <option>Studio meublé</option>
                <option>Bureau professionnel</option>
              </select>
            </div>

            {/* Budget */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors">
              <span className="text-amber-600 font-bold text-xs">CFA</span>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option>Tous les budgets</option>
                <option>≤ 200 000 FCFA</option>
                <option>≤ 500 000 FCFA</option>
                <option>≤ 1 000 000 FCFA</option>
                <option>&gt; 1 000 000 FCFA</option>
              </select>
            </div>

            {/* Reset */}
            {(searchQuery || activeSearch || cityFilter !== 'Toutes les villes' || districtFilter !== 'Tous les quartiers' || typeFilter !== 'Tous les types' || budgetFilter !== 'Tous les budgets') && (
              <button
                type="button"
                onClick={handleResetAll}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>

        {/* FEED LISTING POSTS OR NO-RESULTS SIMILAR PROPOSITIONS */}
        {filteredFeedItems.length === 0 ? (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Message d'information lorsqu'aucun résultat direct ne correspond */}
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-black text-[11px] tracking-wide uppercase">
                    Information recherche
                  </span>
                  <h4 className="text-sm font-black text-slate-900">
                    Aucun résultat exact pour {activeSearch ? `« ${activeSearch} »` : 'vos critères'}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                  Nous n'avons trouvé aucun logement correspondant strictement à tous vos filtres actuels. Découvrez ci-dessous nos <strong>propositions similaires vérifiées</strong> sélectionnées pour vous dans des zones ou gammes de budget proches :
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100/60 transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Voir tout le fil</span>
              </button>
            </div>

            {/* En-tête des propositions similaires */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Propositions similaires recommandées ({similarPropositions.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Logements certifiés avec garantie</span>
            </div>

            {/* Affichage des propositions similaires */}
            {similarPropositions.map((item) => renderFeedCard(item, true))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Résumé du nombre de résultats si recherche active */}
            {(activeSearch || cityFilter !== 'Toutes les villes' || districtFilter !== 'Tous les quartiers' || typeFilter !== 'Tous les types' || budgetFilter !== 'Tous les budgets') && (
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                <span>{filteredFeedItems.length} logement(s) trouvé(s)</span>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  Effacer la recherche
                </button>
              </div>
            )}
            {filteredFeedItems.map((item) => renderFeedCard(item, false))}
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: WIDGETS (Fidèle à l'image du locataire)     */}
      {/* ======================================================== */}
      <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
        
        {/* BANNIÈRE DE CONFIANCE LOCATRUST */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-xs uppercase tracking-wider text-blue-200">Garantie LocaTrust</h4>
              <p className="text-[11px] text-blue-300/80">Logements 100% vérifiés</p>
            </div>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            Toutes les annonces publiées sur ce fil proviennent de bailleurs ou agences certifiés. Vos cautions sont protégées avec reçu officiel et QR code scannable.
          </p>
        </div>

        {/* WIDGET 2: Annonces favorites */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-sm text-slate-900 tracking-tight">Annonces favorites</h4>
            <button
              onClick={() => onNavigateTab && onNavigateTab('favorites')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Voir tout
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {favoriteAnnouncements.map((fav) => (
              <div
                key={fav.id}
                onClick={() => {
                  setSearchQuery(fav.neighborhood);
                  setActiveSearch(fav.neighborhood);
                }}
                className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                title="Cliquer pour afficher ce secteur"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={fav.image}
                    alt={fav.title}
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-black text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {fav.title}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium truncate">
                      {fav.neighborhood}
                    </span>
                    <span className="text-xs font-black text-blue-700">
                      {formatFCFA(fav.price)} / mois
                    </span>
                  </div>
                </div>
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* WIDGET 3: Recherches récentes */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
          <h4 className="font-black text-sm text-slate-900 tracking-tight">Recherches récentes</h4>
          <div className="flex flex-col gap-3">
            {recentSearches.map((rec, i) => (
              <div
                key={i}
                onClick={() => {
                  const cleaned = rec.query.replace(/Appartements à |Maisons à |Studios à /g, '');
                  setSearchQuery(cleaned);
                  setActiveSearch(cleaned);
                }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-blue-50/70 transition-colors cursor-pointer group"
                title="Cliquer pour lancer cette recherche"
              >
                <Clock className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">{rec.query}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({rec.count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WIDGET 4: Blue Banner "Vous cherchez à louer ?" */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col gap-4">
          <div className="relative z-10 flex flex-col gap-1.5">
            <h4 className="text-base font-black tracking-tight leading-snug">
              Vous cherchez à louer ?
            </h4>
            <p className="text-xs text-blue-200 leading-relaxed font-medium">
              Trouvez le logement idéal rapidement et facilement.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab && onNavigateTab('search')}
            className="relative z-10 w-full py-2.5 rounded-xl bg-white text-blue-900 font-extrabold text-xs hover:bg-blue-50 transition-colors text-center shadow-md"
          >
            Voir toutes les annonces
          </button>

          {/* Decorative key graphic */}
          <div className="absolute right-2 -bottom-2 opacity-20 pointer-events-none">
            <Key className="w-24 h-24 text-white" />
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL: Demander cette location (Fidèle à l'image mobile) */}
      {/* ======================================================== */}
      {isApplyModalOpen && selectedRental && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">Demander cette location</h3>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
              <img
                src={selectedRental.images.main}
                alt=""
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900">{selectedRental.title}</span>
                <span className="text-xs font-bold text-blue-700">{formatFCFA(selectedRental.price)} / mois</span>
              </div>
            </div>

            <form onSubmit={submitApplication} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Date souhaitée d'emménagement</label>
                <input
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Message (facultatif)</label>
                <textarea
                  rows={3}
                  value={applyComment}
                  onChange={(e) => setApplyComment(e.target.value)}
                  placeholder="Bonjour, je souhaite visiter cet appartement. Merci."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 font-medium">
                🛡️ Votre dossier certifié (CNI, quittances) sera automatiquement transmis au propriétaire <strong>{selectedRental.authorName}</strong>.
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all"
              >
                Envoyer la demande
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Contacter le propriétaire                        */}
      {/* ======================================================== */}
      {isMessageModalOpen && selectedRental && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">Contacter le propriétaire</h3>
              </div>
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <img
                src={selectedRental.authorAvatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900">{selectedRental.authorName}</span>
                <span className="text-[11px] text-emerald-600 font-bold">● Propriétaire vérifié en ligne</span>
              </div>
            </div>

            <form onSubmit={submitMessage} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Votre message</label>
                <textarea
                  rows={4}
                  value={directMessageText}
                  onChange={(e) => setDirectMessageText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer le message</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Demande envoyée avec succès (Vue mobile screenshot) */}
      {/* ======================================================== */}
      {applySuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl flex flex-col items-center text-center gap-4 border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-black text-slate-900">Demande envoyée !</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Votre demande a été envoyée au propriétaire. Vous serez notifié dès qu'il répondra.
              </p>
            </div>

            <button
              onClick={() => {
                setApplySuccessModal(false);
                if (onNavigateTab) onNavigateTab('applications');
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all mt-2"
            >
              Voir mes demandes
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: GALERIE COMPLÈTE INTERACTIVE                      */}
      {/* ======================================================== */}
      {galleryModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fadeIn"
          onClick={closeGallery}
        >
          {/* Header */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/70 to-transparent z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <span className="text-white font-black text-sm">{galleryModal.item.title}</span>
              <span className="text-white/60 text-xs font-medium">{galleryModal.item.location}</span>
            </div>
            <button
              onClick={closeGallery}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image */}
          <div
            className="relative flex items-center justify-center w-full max-w-3xl max-h-[60vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Arrow */}
            {galleryModal.activeIndex > 0 && (
              <button
                onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: prev.activeIndex - 1 } : null)}
                className="absolute left-2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <span className="text-lg font-bold">&lsaquo;</span>
              </button>
            )}

            <img
              src={galleryImages(galleryModal.item)[galleryModal.activeIndex]}
              alt={`Photo ${galleryModal.activeIndex + 1}`}
              className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />

            {/* Next Arrow */}
            {galleryModal.activeIndex < galleryImages(galleryModal.item).length - 1 && (
              <button
                onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: prev.activeIndex + 1 } : null)}
                className="absolute right-2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <span className="text-lg font-bold">&rsaquo;</span>
              </button>
            )}
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            {galleryImages(galleryModal.item).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: idx } : null)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === galleryModal.activeIndex
                    ? 'bg-white w-6'
                    : 'bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>

          {/* Thumbnails Strip */}
          <div
            className="flex items-center gap-3 mt-5 px-4 overflow-x-auto pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            {galleryImages(galleryModal.item).map((img, idx) => (
              <button
                key={idx}
                onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: idx } : null)}
                className={`shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                  idx === galleryModal.activeIndex
                    ? 'border-white scale-105 shadow-lg'
                    : 'border-white/20 hover:border-white/60 opacity-60 hover:opacity-90'
                }`}
              >
                <img src={img} alt={`Miniature ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Property info bar at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-4 bg-gradient-to-t from-black/70 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <img
                src={galleryModal.item.authorAvatar}
                alt={galleryModal.item.authorName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/30"
              />
              <span className="text-white font-bold text-xs">{galleryModal.item.authorName}</span>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-white font-black text-sm">
              {formatFCFA(galleryModal.item.price)}<span className="text-white/60 font-normal text-xs"> / mois</span>
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
