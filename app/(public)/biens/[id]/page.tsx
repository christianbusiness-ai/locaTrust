'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { formatFCFA } from '@/lib/utils';
import { CheckCircle2, MapPin, Bed, Bath, Maximize2, ShieldCheck, Heart, MessageSquare, ArrowLeft, Loader2, AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { Property } from '@/types/database.types';

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, profile } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperty = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (qErr) throw qErr;
      setProperty(data);
    } catch (err: any) {
      console.error('Erreur chargement du bien:', err);
      setError('Impossible de charger les détails de ce logement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const currentUser = {
    id: user?.id || 'guest',
    email: user?.email || 'visiteur@locatrust.ci',
    full_name: profile?.full_name || 'Utilisateur LocaTrust',
    avatar_url: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    role: 'locataire' as const,
    phone: profile?.phone || '',
    is_verified: profile?.is_verified ?? false,
    created_at: new Date().toISOString()
  };

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

          {/* STATE 1: LOADER */}
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-bold text-slate-700">Chargement de la fiche du logement...</p>
            </div>
          )}

          {/* STATE 2: ERROR */}
          {error && !loading && (
            <div className="bg-rose-50 rounded-2xl border border-rose-200 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-800 text-xs font-bold">
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchProperty}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>
            </div>
          )}

          {/* STATE 3: EMPTY STATE */}
          {!loading && !error && !property && (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Home className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">Logement introuvable</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Ce bien n'existe plus ou a été retiré du catalogue par son propriétaire.
              </p>
              <Link href="/feed">
                <Button className="font-bold text-xs">
                  Explorer d'autres logements
                </Button>
              </Link>
            </div>
          )}

          {/* Property Card Detail */}
          {!loading && !error && property && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card flex flex-col gap-6">
            
            {/* Owner banner */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {(property.title || 'LT').substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-sm">Bailleur Certifié LocaTrust</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                      <CheckCircle2 className="w-3 h-3 text-amber-700" />
                      Propriétaire vérifié
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{property.location?.city}, {property.location?.commune || property.location?.quartier}</span>
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
          )}
        </main>
      </div>
    </div>
  );
}
