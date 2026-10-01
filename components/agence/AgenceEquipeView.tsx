'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Briefcase,
  Shield,
  CheckCircle2,
  Mail,
  Phone,
  Trash2,
  Lock,
  Eye,
  CreditCard,
  Plus
} from 'lucide-react';

export interface AgencyMemberItem {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  agency_role: 'gestionnaire' | 'comptable' | 'lecture_seule';
  status: 'actif' | 'invite';
  joined_date: string;
}

const INITIAL_TEAM_MEMBERS: AgencyMemberItem[] = [
  {
    id: 'mem_1',
    full_name: "Yao Koffi (Directeur)",
    email: 'y.koffi@immogolf.ci',
    phone: '+225 27 22 44 55 66',
    agency_role: 'gestionnaire',
    status: 'actif',
    joined_date: '2024-09-01'
  },
  {
    id: 'mem_2',
    full_name: 'Esther Bamba',
    email: 'e.bamba@immogolf.ci',
    phone: '+225 07 11 22 33 44',
    agency_role: 'gestionnaire',
    status: 'actif',
    joined_date: '2025-01-15'
  },
  {
    id: 'mem_3',
    full_name: 'Marc Zadi',
    email: 'm.zadi@immogolf.ci',
    phone: '+225 05 99 88 77 66',
    agency_role: 'comptable',
    status: 'actif',
    joined_date: '2025-02-01'
  },
  {
    id: 'mem_4',
    full_name: 'Clarisse N\'Dri',
    email: 'c.ndri@immogolf.ci',
    phone: '+225 01 44 55 66 77',
    agency_role: 'lecture_seule',
    status: 'invite',
    joined_date: '2026-09-10'
  }
];

export const AgenceEquipeView: React.FC = () => {
  const [team, setTeam] = useState<AgencyMemberItem[]>(INITIAL_TEAM_MEMBERS);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);

  // Form states
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [roleInput, setRoleInput] = useState<'gestionnaire' | 'comptable' | 'lecture_seule'>('gestionnaire');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput || !emailInput) return;

    const newMember: AgencyMemberItem = {
      id: `mem_${Date.now()}`,
      full_name: nameInput,
      email: emailInput,
      phone: phoneInput || '+225 00 00 00 00 00',
      agency_role: roleInput,
      status: 'invite',
      joined_date: new Date().toISOString().split('T')[0]
    };

    setTeam((prev) => [...prev, newMember]);
    setShowInviteModal(false);
    setNameInput('');
    setEmailInput('');
    setPhoneInput('');
    alert('Invitation envoyée au collaborateur avec succès !');
  };

  const handleRemoveMember = (id: string) => {
    if (confirm('Voulez-vous révoquer l\'accès de ce collaborateur de l\'agence ?')) {
      setTeam((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const getRoleBadge = (role: 'gestionnaire' | 'comptable' | 'lecture_seule') => {
    switch (role) {
      case 'gestionnaire':
        return <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">Gestionnaire</span>;
      case 'comptable':
        return <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold">Comptable</span>;
      case 'lecture_seule':
        return <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold">Lecture Seule</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Gestion de l'Équipe & Rôles Collaborateurs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">
              Isolation RLS par Agence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos collaborateurs agence (`gestionnaire`, `comptable`, `lecture_seule`) avec contrôle des accès.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Inviter un collaborateur</span>
        </button>
      </div>

      {/* Permissions Matrix Info Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-blue-900 font-black text-xs">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>Rôle : Gestionnaire</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Accès complet : création de biens, génération de baux, confirmation des loyers, tickets de maintenance.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-amber-950 font-black text-xs">
            <CreditCard className="w-4 h-4 text-amber-600" />
            <span>Rôle : Comptable</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Accès dédié aux encaissements, confirmation des loyers, quittances et récapitulatifs comptables.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-900 font-black text-xs">
            <Eye className="w-4 h-4 text-slate-600" />
            <span>Rôle : Lecture Seule</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Consultation seule du parc et des contrats sans autorisation de modification ou validation.
          </p>
        </div>

      </div>

      {/* Team Members Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Membres de l'équipe agence ({team.length})</h3>
          <span className="text-xs text-slate-500">RLS agency_id isolée</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">Collaborateur</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Rôle Agence</th>
                <th className="p-4">Statut Compte</th>
                <th className="p-4">Date d'invitation</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                        {member.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-extrabold text-slate-900">{member.full_name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">
                    <div className="flex flex-col">
                      <span>{member.email}</span>
                      <span className="text-[10px] text-slate-400">{member.phone}</span>
                    </div>
                  </td>
                  <td className="p-4">{getRoleBadge(member.agency_role)}</td>
                  <td className="p-4">
                    {member.status === 'actif' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">Actif</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">Invitation envoyée</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500">{member.joined_date}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all"
                      title="Révoquer le collaborateur"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleInvite} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Inviter un collaborateur agence</h3>
              <button type="button" onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="flex flex-col gap-3 text-xs font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Nom & Prénom</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ex: Marc Zadi"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Adresse email pro</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Ex: m.zadi@immogolf.ci"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Numéro de téléphone</label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Ex: +225 05 99 88 77 66"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Rôle attribué (`agency_members`)</label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="gestionnaire">Gestionnaire (Accès complet biens/contrats/paiements)</option>
                  <option value="comptable">Comptable (Gestion encaissements & quittances)</option>
                  <option value="lecture_seule">Lecture Seule (Consultation uniquement)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-md hover:bg-blue-500"
              >
                Envoyer l'invitation
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
