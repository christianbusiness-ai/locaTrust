'use client';

import React, { useState, useEffect } from 'react';
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
  Plus,
  X,
  MapPin,
  Tag,
  Link2,
  Unlink,
  Home,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { Property } from '@/types/database.types';

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

export const MultiProprietairesView: React.FC = () => {
  const [owners, setOwners] = useState<ManagedOwner[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_agency_mandates');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Filtrer les anciens faux mandants de démo
            return parsed.filter(
              (o: any) =>
                o.id !== 'owner_101' &&
                o.id !== 'owner_102' &&
                o.id !== 'owner_103' &&
                o.id !== 'owner_104'
            );
          }
        }
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [properties, setProperties] = useState<Property[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_properties');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedOwnerForDetails, setSelectedOwnerForDetails] = useState<ManagedOwner | null>(null);
  const [propertyToAssignId, setPropertyToAssignId] = useState<string>('');
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // Form states pour nouvel ajout
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMandate, setNewMandate] = useState<'exclusif' | 'simple'>('exclusif');

  // Écoute des mises à jour des propriétés
  useEffect(() => {
    const handlePropsUpdate = () => {
      try {
        const stored = localStorage.getItem('locatrust_properties');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setProperties(parsed);
        }
      } catch {}
    };

    window.addEventListener('locatrust:properties-updated', handlePropsUpdate);
    return () => {
      window.removeEventListener('locatrust:properties-updated', handlePropsUpdate);
    };
  }, []);

  // Calcul des métriques réelles pour un mandant
  const getOwnerMetrics = (owner: ManagedOwner) => {
    const assigned = properties.filter(
      (p) =>
        p.mandant_id === owner.id ||
        (p.mandant_name && p.mandant_name.toLowerCase() === owner.full_name.toLowerCase())
    );
    const count = assigned.length;
    const activeTenants = assigned.filter((p) => p.status === 'loue').length;
    const totalRent = assigned.reduce((acc, p) => acc + (p.rent || 0), 0);

    return {
      assignedProperties: assigned,
      properties_count: count > 0 ? count : owner.properties_count || 0,
      active_tenants: activeTenants > 0 ? activeTenants : owner.active_tenants || 0,
      total_monthly_rent: totalRent > 0 ? totalRent : owner.total_monthly_rent || 0
    };
  };

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

  // Attribution d'un bien du parc à ce mandant
  const handleAssignPropertyToOwner = (ownerId: string, ownerName: string) => {
    if (!propertyToAssignId) return;

    const updatedProps = properties.map((p) => {
      if (p.id === propertyToAssignId) {
        return {
          ...p,
          mandant_id: ownerId,
          mandant_name: ownerName
        };
      }
      return p;
    });

    setProperties(updatedProps);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_properties', JSON.stringify(updatedProps));
      window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: updatedProps }));
    }

    setPropertyToAssignId('');
    setAssignSuccessMsg('Bien attribué avec succès à ce mandant !');
    setTimeout(() => setAssignSuccessMsg(null), 3000);
  };

  // Détachement d'un bien
  const handleUnassignProperty = (propId: string) => {
    const updatedProps = properties.map((p) => {
      if (p.id === propId) {
        const copy = { ...p };
        delete copy.mandant_id;
        delete copy.mandant_name;
        return copy;
      }
      return p;
    });

    setProperties(updatedProps);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_properties', JSON.stringify(updatedProps));
      window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: updatedProps }));
    }

    setAssignSuccessMsg('Bien détaché du mandant.');
    setTimeout(() => setAssignSuccessMsg(null), 3000);
  };

  const filteredOwners = owners.filter(
    (o) =>
      o.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery)
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Gestion Multi-Propriétaires (Bailleurs Mandants)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-black">
              Portefeuille agence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Consultez, enregistrez et attribuez les lots de votre parc immobilier aux propriétaires ayant signé un mandat de gérance avec votre agence.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all shrink-0 cursor-pointer active:scale-95"
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
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">
          {filteredOwners.length} bailleur(s) trouvé(s)
        </span>
      </div>

      {/* Grid of Managed Owners or Clean Empty State */}
      {filteredOwners.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
          <h4 className="text-base font-black text-slate-900">Aucun bailleur mandant enregistré</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Votre agence n'a pas encore de bailleur sous mandat. Cliquez sur « Ajouter un propriétaire » pour enregistrer votre premier mandant et lui rattacher des logements.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all cursor-pointer shadow-md"
          >
            Ajouter mon premier mandant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredOwners.map((owner) => {
            const metrics = getOwnerMetrics(owner);

            return (
              <div
                key={owner.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center border border-purple-200 shadow-xs">
                      {owner.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-base font-black text-slate-900">{owner.full_name}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                        <a
                          href={`tel:${owner.phone}`}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{owner.phone}</span>
                        </a>
                        <a
                          href={`mailto:${owner.email}`}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{owner.email}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
                      owner.mandate_type === 'exclusif'
                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                        : 'bg-blue-100 text-blue-900 border border-blue-200'
                    }`}
                  >
                    Mandat {owner.mandate_type}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 text-center text-xs py-1">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 font-bold block text-[11px]">Biens confiés</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">
                      {metrics.properties_count}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 font-bold block text-[11px]">Locataires actifs</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">
                      {metrics.active_tenants}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 font-bold block text-[11px]">Revenu mensuel</span>
                    <span className="text-xs font-black text-emerald-600 mt-1 block">
                      {formatFCFA(metrics.total_monthly_rent)}
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-medium text-[11px]">
                    Bailleur depuis le {owner.joined_date}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedOwnerForDetails(owner);
                      setPropertyToAssignId('');
                      setAssignSuccessMsg(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-800 font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Voir les biens attribués</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL : FICHE DU MANDANT & BIENS ATTRIBUÉS (Remplace l'ancien alert JS) */}
      {selectedOwnerForDetails && (() => {
        const ownerMetrics = getOwnerMetrics(selectedOwnerForDetails);
        const assigned = ownerMetrics.assignedProperties;
        // Biens non encore attribués à ce mandant
        const unassignedProps = properties.filter(
          (p) =>
            p.mandant_id !== selectedOwnerForDetails.id &&
            (!p.mandant_name || p.mandant_name.toLowerCase() !== selectedOwnerForDetails.full_name.toLowerCase())
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
              
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-black text-base flex items-center justify-center border border-purple-200 shadow-sm">
                    {selectedOwnerForDetails.full_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        {selectedOwnerForDetails.full_name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-200">
                        Mandat {selectedOwnerForDetails.mandate_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Fiche officielle de gestion du propriétaire mandant • Inscrit le {selectedOwnerForDetails.joined_date}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOwnerForDetails(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback d'action */}
              {assignSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{assignSuccessMsg}</span>
                </div>
              )}

              {/* Coordonnées & Synthèse Financière */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Contact Standard</span>
                  <a href={`tel:${selectedOwnerForDetails.phone}`} className="text-xs font-black text-slate-900 hover:text-blue-600 flex items-center gap-1.5 mt-1">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>{selectedOwnerForDetails.phone}</span>
                  </a>
                  <a href={`mailto:${selectedOwnerForDetails.email}`} className="text-[11px] font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 mt-1 truncate">
                    <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{selectedOwnerForDetails.email}</span>
                  </a>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Portefeuille Déclaré</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">
                    {ownerMetrics.properties_count} bien(s) confié(s)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {ownerMetrics.active_tenants} locataire(s) actif(s)
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">Revenus Mensuels</span>
                  <span className="text-base font-black text-emerald-700 mt-1 block">
                    {formatFCFA(ownerMetrics.total_monthly_rent)}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium block">
                    Loyers bruts cumulés
                  </span>
                </div>
              </div>

              {/* Liste des Biens Attribués */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                    <Home className="w-4 h-4 text-blue-600" />
                    <span>Biens attribués à ce bailleur ({assigned.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Lots sous gestion agence</span>
                </div>

                {assigned.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center gap-2">
                    <Building2 className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-bold text-slate-700">Aucun bien n'est actuellement attribué à ce mandant</span>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      Utilisez le sélecteur ci-dessous pour lui assigner un logement ou local commercial de votre parc immobilier.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {assigned.map((prop) => (
                      <div
                        key={prop.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-black text-slate-900 truncate">{prop.title}</h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                              <span>{prop.city || 'Abidjan'} • {prop.commune || 'Cocody'}</span>
                              <span>•</span>
                              <span className="font-black text-slate-800">{formatFCFA(prop.rent)}/mois</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              prop.status === 'loue'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {prop.status === 'loue' ? 'Loué' : 'Disponible'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleUnassignProperty(prop.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Détacher ce bien du mandant"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attribution d'un nouveau bien */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-blue-900">
                    Attribuer un logement de votre parc à ce mandant
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={propertyToAssignId}
                    onChange={(e) => setPropertyToAssignId(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl border border-blue-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="">-- Choisir un bien du parc immobilier --</option>
                    {unassignedProps.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.commune || p.city || 'Abidjan'}) — {formatFCFA(p.rent)}/mois
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!propertyToAssignId}
                    onClick={() =>
                      handleAssignPropertyToOwner(
                        selectedOwnerForDetails.id,
                        selectedOwnerForDetails.full_name
                      )
                    }
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm"
                  >
                    Rattacher le bien
                  </button>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedOwnerForDetails(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors"
                >
                  Fermer la fiche
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Add Owner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleAddOwner}
            className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Nouveau Propriétaire Mandant</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  Nom complet ou Raison sociale
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Koffi Yao Christian Nathan ou SCI Les Palmiers"
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
                  placeholder="Ex: +225 05 08 58 42 69"
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
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black shadow-md hover:bg-blue-500"
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
