'use client';

import React from 'react';
import {
  Building2,
  Users,
  Wallet,
  AlertTriangle,
  Plus,
  ArrowRight,
  UserPlus,
  FileText,
  CreditCard,
  Send,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { MOCK_PROPERTIES } from '@/lib/mock/data';

interface AgenceDashboardViewProps {
  onNavigateTab: (tabId: string) => void;
  onOpenAddProperty: () => void;
  onOpenCreateContract?: () => void;
  onOpenConfirmPayment: () => void;
  onOpenInviteMember: () => void;
  onOpenAddOwner: () => void;
}

export const AgenceDashboardView: React.FC<AgenceDashboardViewProps> = ({
  onNavigateTab,
  onOpenAddProperty,
  onOpenCreateContract,
  onOpenConfirmPayment,
  onOpenInviteMember,
  onOpenAddOwner,
}) => {

  // Aggregate stats across all managed properties in agency portfolio
  const totalProperties = 28;
  const totalOwnersManaged = 8;
  const activeTenantsCount = 34;
  const totalCollectedRent = 14850000;
  const overdueRentTotal = 950000;

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Immobilière du Golf Abidjan
            </h2>
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-black uppercase">
              Agence Agréée
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Aperçu global de votre portefeuille multi-propriétaires et de votre équipe de gestion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddOwner}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold transition-all"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>Nouveau Propriétaire</span>
          </button>

          <button
            onClick={onOpenAddProperty}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter au mandat</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards for Agency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Parc Immobilier Géré */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500">Parc Immobilier Agence</span>
              <span className="text-2xl font-black text-slate-900 mt-1">{totalProperties} biens</span>
              <span className="text-[11px] text-slate-400">Sous mandat actif</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('properties')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>Gérer le parc immobilier</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Card 2: Propriétaires Mandants */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500">Propriétaires Mandants</span>
              <span className="text-2xl font-black text-slate-900 mt-1">{totalOwnersManaged} bailleurs</span>
              <span className="text-[11px] text-slate-400">Bailleurs sous contrat</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('owners')}
            className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 group"
          >
            <span>Voir les propriétaires</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Card 3: Encaissé Global Agence */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500">Loyers Encaissés (Mois)</span>
              <span className="text-xl font-black text-emerald-600 mt-1">{formatFCFA(totalCollectedRent)}</span>
              <span className="text-[11px] text-slate-400">Confirmés uniquement</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('payments')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>Détails des encaissements</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Card 4: Équipe & Collaborateurs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500">Équipe Agence</span>
              <span className="text-2xl font-black text-slate-900 mt-1">6 membres</span>
              <span className="text-[11px] text-slate-400">Gestionnaires & comptables</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('team')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>Gérer l'équipe</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>

      {/* Middle Section: Mandats récents & Collaborateurs de garde */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 8 Cols: Mandats récents */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Propriétaires Mandants sous Gestion</h3>
                <span className="text-xs text-slate-500">Portefeuille agrégé de l'agence</span>
              </div>
              <button
                onClick={() => onNavigateTab('owners')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Tous les bailleurs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { name: 'Koffi N\'Guessan', properties: 12, rentTotal: 4850000, status: 'Mandat Exclusif' },
                { name: 'Aicha Diallo', properties: 5, rentTotal: 2200000, status: 'Mandat Simple' },
                { name: 'Koffi Traoré', properties: 6, rentTotal: 3400000, status: 'Mandat Exclusif' },
                { name: 'SCI Les Lagunes', properties: 5, rentTotal: 4400000, status: 'Mandat Exclusif' },
              ].map((owner, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                      {owner.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-900">{owner.name}</span>
                      <span className="text-[11px] text-slate-500">{owner.properties} biens sous mandat</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-emerald-600">{formatFCFA(owner.rentTotal)}</span>
                      <span className="text-[10px] text-slate-400 font-bold">Loyer mensuel</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                      {owner.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right 4 Cols: Quick Agency Actions & Subscription snapshot */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <h3 className="text-sm font-black text-slate-900">Actions Agence</h3>

            <button
              onClick={onOpenAddOwner}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 flex items-center gap-3 text-left transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <UserPlus className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900">Ajouter un propriétaire</span>
                <span className="text-[11px] text-slate-500">Nouveau mandat de gestion</span>
              </div>
            </button>

            <button
              onClick={onOpenInviteMember}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 flex items-center gap-3 text-left transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900">Inviter un collaborateur</span>
                <span className="text-[11px] text-slate-500">Ajouter à l'équipe agence</span>
              </div>
            </button>

            <button
              onClick={onOpenAddProperty}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 flex items-center gap-3 text-left transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900">Ajouter un bien</span>
                <span className="text-[11px] text-slate-500">Entrée dans le parc agence</span>
              </div>
            </button>

          </div>

        </div>

      </div>

    </div>
  );
};
