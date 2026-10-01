'use client';

import React from 'react';
import Link from 'next/link';
import { Home, Key, Building2, Shield, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

export default function InscriptionRoleSelectorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      
      <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 p-8 shadow-2xl flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" variant="light" showSubtitle={true} />
          <div className="mt-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Que souhaitez-vous faire ?
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sélectionnez votre profil pour personnaliser votre expérience sur LocaTrust.
            </p>
          </div>
        </div>

        {/* 3 Role Options */}
        <div className="flex flex-col gap-4">
          
          {/* Option 1: Locataire */}
          <Link
            href="/inscription/locataire"
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-600 bg-slate-50/50 hover:bg-blue-50/50 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <Home className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-slate-900">🏠 Je suis locataire</span>
                <span className="text-xs text-slate-500 font-medium">
                  Rechercher un logement, signer des baux sécurisés et recevoir mes quittances officiels.
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
          </Link>

          {/* Option 2: Propriétaire */}
          <Link
            href="/inscription/proprietaire"
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 bg-slate-50/50 hover:bg-emerald-50/50 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <Key className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-slate-900">🔑 Je suis propriétaire</span>
                <span className="text-xs text-slate-500 font-medium">
                  Gérer mes biens en direct, valider les paiements et suivre l'historique de mes baux.
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0" />
          </Link>

          {/* Option 3: Agence */}
          <Link
            href="/inscription/agence"
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-purple-600 bg-slate-50/50 hover:bg-purple-50/50 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-slate-900">🏢 Je suis une agence immobilière</span>
                <span className="text-xs text-slate-500 font-medium">
                  Gérer plusieurs propriétaires sous mandat, affecter les collaborateurs et suivre le parc agence.
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all shrink-0" />
          </Link>

        </div>

        {/* Footer Link */}
        <div className="text-center text-xs text-slate-500 border-t pt-4">
          Vous avez déjà un compte ?{' '}
          <Link href="/connexion" className="text-blue-600 font-bold hover:underline">
            Se connecter
          </Link>
        </div>

      </div>

    </div>
  );
}
