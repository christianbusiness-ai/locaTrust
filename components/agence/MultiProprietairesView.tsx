'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  FileText,
  CreditCard,
  Phone,
  Mail,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export interface ManagedOwner {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  properties_count: number;
  active_tenants: number;
  total_monthly_rent: number;
  mandate_type: 'exclusif' | 'simple';
  joined_date: string;
}

const INITIAL_MANAGED_OWNERS: ManagedOwner[] = [];

export const MultiProprietairesView: React.FC = () => {
  const [owners, setOwners] = useState<ManagedOwner[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_agency_mandates');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Filtrer les anciens faux mandants de démo
            return parsed.filter((o: any) => o.id !== 'owner_101' && o.id !== 'owner_102' && o.id !== 'owner_103' && o.id !== 'owner_104');
          }
        }
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMandate, setNewMandate] = useState<'exclusif' | 'simple'>('exclusif');

  const filteredOwners = owners.filter(
    (o) =>
      o.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery)
  );

  const handleAddOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPhone) return;

    const created: ManagedOwner = {
      id: `owner_${Date.now()}`,
      full_name: newName,
      email: newEmail,
      phone: newPhone,
      properties_count: 0,
      active_tenants: 0,
      total_monthly_rent: 0,
      mandate_type: newMandate,
      joined_date: new Date().toISOString().split('T')[0]
    };

    const next = [created, ...owners];
    setOwners(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_agency_mandates', JSON.stringify(next));
    }
    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Gestion Multi-Propriétaires (Bailleurs Mandants)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-extrabold">
              Portefeuille agence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez tous les bailleurs qui confient la gestion de leurs logements ou locaux à votre agence immobilière.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Ajouter un propriétaire</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, téléphone, email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">{filteredOwners.length} bailleur(s) trouvé(s)</span>
      </div>

      {/* Grid of Managed Owners or Clean Empty State */}
      {filteredOwners.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
          <h4 className="text-base font-black text-slate-900">Aucun bailleur mandant enregistré</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Votre agence n'a pas encore de bailleur sous mandat. Cliquez sur « Ajouter un propriétaire » pour enregistrer votre premier mandant et lui rattacher des lots.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Ajouter mon premier mandant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {filteredOwners.map((owner) => (
          <div
            key={owner.id}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center border border-purple-200">
                  {owner.full_name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-black text-slate-900">{owner.full_name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{owner.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{owner.email}</span>
                  </div>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                owner.mandate_type === 'exclusif' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
              }`}>
                Mandat {owner.mandate_type}
              </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs py-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-bold block">Biens confiés</span>
                <span className="text-base font-black text-slate-900 mt-0.5">{owner.properties_count}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-bold block">Locataires actifs</span>
                <span className="text-base font-black text-slate-900 mt-0.5">{owner.active_tenants}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-bold block">Revenu mensuel</span>
                <span className="text-xs font-black text-emerald-600 mt-1 block">{formatFCFA(owner.total_monthly_rent)}</span>
              </div>
            </div>

            {/* Card Footer */}
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-slate-400 font-medium">Bailleur depuis le {owner.joined_date}</span>
              <button
                onClick={() => alert(`Fiche complète du bailleur ${owner.full_name}...`)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold transition-all"
              >
                Voir les biens attribués
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Add Owner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleAddOwner} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Nouveau Propriétaire Mandant</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="flex flex-col gap-3 text-xs font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Nom complet ou Raison sociale</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: LocaTrust Utilisateur ou SCI Les Palmiers"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Ex: contact@locatrust.ci"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Numéro de téléphone</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ex: +225 07 08 09 10 11"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Type de mandat agence</label>
                <select
                  value={newMandate}
                  onChange={(e) => setNewMandate(e.target.value as 'exclusif' | 'simple')}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="exclusif">Mandat Exclusif (Gestion 100% agence)</option>
                  <option value="simple">Mandat Simple</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-md hover:bg-blue-500"
              >
                Enregistrer le bailleur
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
