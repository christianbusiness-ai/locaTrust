'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { MOCK_PROPERTIES, MOCK_USERS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { formatFCFA } from '@/lib/utils';
import { CheckCircle2, MapPin, Bed, Bath, Maximize2, ShieldCheck, Heart, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const property = MOCK_PROPERTIES.find(p => p.id === id) || MOCK_PROPERTIES[0];
  const currentUser = MOCK_USERS.locataire;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RoleSwitcher currentRole="locataire" onRoleChange={() => {}} />
      <Header currentUser={currentUser} />

      <div className="max-w-7xl w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        <Sidebar currentRole="locataire" />

        <main className="flex-1 flex flex-col gap-6">
          
          <Link href="/feed" className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-brand-600 w-fit">
            <ArrowLeft className="w-4 h-4" />
            <span>Retour au fil d'actualité</span>
          </Link>

          {/* Property Card Detail */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card flex flex-col gap-6">
            
            {/* Owner banner */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-3">
                <img
                  src={property.owner?.avatar_url}
                  alt={property.owner?.full_name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-sm">{property.owner?.full_name}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                      <CheckCircle2 className="w-3 h-3 text-amber-700" />
                      Propriétaire vérifié
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{property.location?.city}, {property.location?.quartier}</span>
                </div>
              </div>

              <span className="px-3 py-1 bg-brand-500 text-white font-bold text-xs rounded-full">
                À LOUER
              </span>
            </div>

            {/* Gallery */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-80 rounded-2xl overflow-hidden">
              <div className="sm:col-span-2 h-full">
                <img src={property.photos?.[0]} alt={property.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col gap-3 h-full">
                {property.photos?.slice(1, 3).map((img, idx) => (
                  <img key={idx} src={img} alt={`Preview ${idx}`} className="w-full h-1/2 object-cover rounded-xl" />
                ))}
              </div>
            </div>

            {/* Main Info */}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-slate-900">{property.title}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-4 h-4 text-brand-600" />
                <span>{property.location?.quartier}, {property.location?.city}, {property.location?.country}</span>
              </div>
            </div>

            {/* Price & Specs */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-brand-600">{formatFCFA(property.rent)}</span>
                <span className="text-xs text-slate-500 font-medium">/ mois</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-white border text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <Bed className="w-4 h-4 text-brand-600" /> {property.bedrooms} Chambres
                </span>
                <span className="px-3 py-1.5 bg-white border text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <Bath className="w-4 h-4 text-brand-600" /> {property.bathrooms} Salles de bain
                </span>
                <span className="px-3 py-1.5 bg-white border text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <Maximize2 className="w-4 h-4 text-brand-600" /> {property.surface} m²
                </span>
              </div>
            </div>

            {/* Description & Equipments */}
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-slate-900 text-sm">Description</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{property.description}</p>

              <h3 className="font-bold text-slate-900 text-sm mt-2">Équipements & Prestations</h3>
              <div className="flex flex-wrap gap-2">
                {property.equipments.map((eq, idx) => (
                  <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
                    ✓ {eq}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Link href="/feed" className="flex-1">
                <Button className="w-full font-bold py-3">
                  Demander cette location
                </Button>
              </Link>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
