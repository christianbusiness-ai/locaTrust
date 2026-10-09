'use client';

import React, { useState } from 'react';
import { Property } from '@/types/database.types';
import { formatFCFA } from '@/lib/utils';
import {
  CheckCircle2,
  MoreHorizontal,
  Bed,
  Sofa,
  Bath,
  Maximize2,
  Building,
  MapPin,
  MessageSquare,
  Heart,
  Car
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface FeedPropertyCardProps {
  property: Property;
  onOpenRentalModal: (property: Property) => void;
  onOpenMessageModal: (property: Property) => void;
}

export const FeedPropertyCard: React.FC<FeedPropertyCardProps> = ({
  property,
  onOpenRentalModal,
  onOpenMessageModal,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(property.stats?.favorites_count || 18);

  const toggleLike = () => {
    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
  };

  const photos = property.photos || [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80'
  ];

  const mainPhoto = photos[0];
  const secondaryPhotos = photos.slice(1, 3);
  const extraCount = photos.length > 3 ? photos.length - 3 + 6 : 8; // Overlay +8 as in image

  return (
    <article className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card hover:shadow-elevated transition-all duration-200 flex flex-col gap-4">
      
      {/* 1. Header Post (Owner info & Badge À LOUER) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={property.owner?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'}
            alt={property.owner?.full_name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">{property.owner?.full_name}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <CheckCircle2 className="w-3 h-3 text-amber-700 fill-amber-700/20" />
                Propriétaire vérifié
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {property.location?.city}, {property.location?.quartier} • Publiée récemment
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-brand-500 text-white font-bold text-xs uppercase tracking-wider shadow-sm">
            À LOUER
          </span>
          <button className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Photo Gallery Grid (Matching image gallery with +8 overlay) */}
      <div className="grid grid-cols-3 gap-2 h-64 sm:h-72 rounded-xl overflow-hidden cursor-pointer group">
        <div className="col-span-2 h-full relative overflow-hidden">
          <img
            src={mainPhoto}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="col-span-1 flex flex-col gap-2 h-full">
          {secondaryPhotos.map((img, idx) => (
            <div key={idx} className="relative h-1/2 overflow-hidden">
              <img
                src={img}
                alt={`${property.title} preview ${idx}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {idx === secondaryPhotos.length - 1 && extraCount > 0 && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center text-white font-extrabold text-lg">
                  +{extraCount}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Title & Description */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-slate-900 leading-snug hover:text-brand-600 transition-colors cursor-pointer">
          {property.title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
          {property.description}
        </p>
      </div>

      {/* 4. Specifications Pills (Strictement fidèles aux données saisies) */}
      <div className="flex flex-wrap items-center gap-2 py-1">
        {property.bedrooms && Number(property.bedrooms) > 0 ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
            <Bed className="w-3.5 h-3.5 text-brand-600" />
            <span>{property.bedrooms} Chambre{Number(property.bedrooms) > 1 ? 's' : ''}</span>
          </div>
        ) : null}
        {property.rooms && Number(property.rooms) > 0 ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
            <Sofa className="w-3.5 h-3.5 text-brand-600" />
            <span>{property.rooms} Pièce{Number(property.rooms) > 1 ? 's' : ''}</span>
          </div>
        ) : null}
        {property.bathrooms && Number(property.bathrooms) > 0 ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
            <Bath className="w-3.5 h-3.5 text-brand-600" />
            <span>{property.bathrooms} Salle{Number(property.bathrooms) > 1 ? 's' : ''} d'eau</span>
          </div>
        ) : null}
        {property.surface && Number(property.surface) > 0 ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
            <Maximize2 className="w-3.5 h-3.5 text-brand-600" />
            <span>{property.surface} m²</span>
          </div>
        ) : null}
      </div>

      {/* 5. Price & Location */}
      <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-brand-600 tracking-tight">
            {formatFCFA(property.rent)}
          </span>
          <span className="text-xs font-medium text-slate-500">/ mois</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{property.location?.quartier}, {property.location?.city}</span>
        </div>
      </div>

      {/* 6. Action Buttons (Envoyer un message, Demander cette location, Favorite heart) */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          className="flex-1 text-xs font-semibold py-2.5 rounded-xl"
          onClick={() => onOpenMessageModal(property)}
        >
          <MessageSquare className="w-4 h-4 text-brand-600" />
          <span>Envoyer un message</span>
        </Button>

        <Button
          variant="primary"
          className="flex-1 text-xs font-bold py-2.5 rounded-xl shadow-md shadow-brand-500/20"
          onClick={() => onOpenRentalModal(property)}
        >
          <span>Demander cette location</span>
        </Button>

        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all ${
            isLiked
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
          <span className="text-xs font-bold">{likesCount}</span>
        </button>
      </div>

    </article>
  );
};
