'use client';

import React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export const FavoritesWidget: React.FC = () => {
  const favorites = [
    {
      id: 'prop_3',
      title: 'Studio meublé à Angré',
      location: 'Angré 8e tranche',
      price: 220000,
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'prop_4',
      title: 'Appartement 2 pièces',
      location: 'Marcory Zone 4',
      price: 300000,
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'prop_5',
      title: 'Villa 4 pièces',
      location: "Riviera M'Badon",
      price: 650000,
      image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=200&q=80',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-900 text-sm">Annonces favorites</span>
        <Link href="/locataire/favoris" className="text-xs text-brand-600 font-semibold hover:underline">
          Voir tout
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {favorites.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <img
                src={item.image}
                alt={item.title}
                className="w-12 h-12 rounded-lg object-cover group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                  {item.title}
                </span>
                <span className="text-[11px] text-slate-400">{item.location}</span>
                <span className="text-xs font-extrabold text-brand-600">
                  {formatFCFA(item.price)} <span className="font-normal text-[10px] text-slate-400">/ mois</span>
                </span>
              </div>
            </div>

            <button className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 transition-colors">
              <Heart className="w-4 h-4 fill-rose-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
