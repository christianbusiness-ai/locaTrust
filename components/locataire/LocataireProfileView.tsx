'use client';

import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  FileText,
  CheckCircle2,
  Camera,
  Save,
  Building2,
  Lock,
  Download,
  AlertCircle
} from 'lucide-react';
import { MOCK_USERS } from '@/lib/mock/data';

export const LocataireProfileView: React.FC = () => {
  const currentUser = MOCK_USERS.locataire;

  const [formData, setFormData] = useState({
    fullName: currentUser.full_name || "Koffi N'Guessan",
    email: currentUser.email || 'koffi.nguessan@locatrust.ci',
    phone: currentUser.phone || '+225 07 08 09 10 11',
    whatsapp: '+225 07 08 09 10 11',
    birthDate: '1992-05-14',
    gender: 'M',
    nationality: 'Ivoirienne',
    cniNumber: 'CI-0029481920',
    cniExpiry: '2030-10-12',
    address: 'Cocody Riviera 3, Villa 42, Abidjan',
    profession: 'Cadre Commercial Grands Comptes',
    employer: 'Orange Côte d\'Ivoire',
    contractType: 'CDI',
    monthlyIncome: '650 000 FCFA',
    emergencyContactName: 'N\'Guessan Yao Marc',
    emergencyRelation: 'Frère / Garant moral',
    emergencyPhone: '+225 05 12 34 56 78',
  });

  const [avatarUrl, setAvatarUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('locatrust_user_avatar') || currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80';
    }
    return currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80';
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarUrl(result);
        if (typeof window !== 'undefined') {
          localStorage.setItem('locatrust_user_avatar', result);
          window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: result } }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3500);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* 1. Header Banner Profile */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar with edit button */}
          <div className="relative group shrink-0">
            <img
              src={avatarUrl}
              alt={formData.fullName}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover ring-4 ring-blue-600/20 shadow-md"
            />
            <label className="absolute bottom-1 right-1 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg transition-transform active:scale-90">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {formData.fullName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Locataire Vérifié</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Membre locataire LocaTrust depuis Janvier 2025 • Contrat actif
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-4 mt-1 text-xs text-slate-600 font-semibold flex-wrap">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                {formData.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                {formData.email}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Abidjan, Côte d'Ivoire
              </span>
            </div>
          </div>
        </div>

        {/* Badge Score Locatif */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 p-4 rounded-2xl flex flex-col items-center justify-center text-center shrink-0 w-full sm:w-auto">
          <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
            Score Locatif LocaTrust
          </span>
          <span className="text-3xl font-black text-slate-900 mt-1">
            98<span className="text-base text-blue-600 font-bold">/100</span>
          </span>
          <span className="text-[11px] font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Excellente ponctualité
          </span>
        </div>
      </div>

      {/* Success alert message */}
      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Vos informations personnelles et professionnelles ont été mises à jour avec succès !</span>
        </div>
      )}

      {/* 2. Formulaire Mon Compte */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        
        {/* Section A : Informations Personnelles & CNI */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Identité & Informations Personnelles
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              CNI Validée
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom et prénoms</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone Principal</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone WhatsApp</label>
              <input
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Numéro CNI / Passeport</label>
              <input
                type="text"
                value={formData.cniNumber}
                onChange={(e) => setFormData({ ...formData, cniNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nationalité</label>
              <input
                type="text"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Adresse de résidence actuelle</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Section B : Situation Professionnelle & Solvabilité */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Situation Professionnelle & Solvabilité
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Profession / Poste</label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Employeur / Entreprise</label>
              <input
                type="text"
                value={formData.employer}
                onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type de Contrat</label>
              <select
                value={formData.contractType}
                onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option value="CDI">CDI (Durée indéterminée)</option>
                <option value="CDD">CDD (Durée déterminée)</option>
                <option value="Fonctionnaire">Fonctionnaire d'État</option>
                <option value="Profession Liberale">Profession Libérale / Indépendant</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Revenu Mensuel Net Estimé</label>
              <input
                type="text"
                value={formData.monthlyIncome}
                onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Section C : Contact d'Urgence / Personne à Prévenir */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Phone className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Contact d'Urgence & Personne à Prévenir
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom complet</label>
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lien de parenté</label>
              <input
                type="text"
                value={formData.emergencyRelation}
                onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone d'urgence</label>
              <input
                type="tel"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Section D : Pièces du Dossier Locatif Certifié */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Pièces Justificatives de mon Dossier Locatif
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              100% Complet & Conforme
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { name: 'CNI Recto-Verso', date: 'Validé le 15/01/2025', size: '1.4 Mo' },
              { name: '3 Derniers Bulletins de Salaire', date: 'Validé le 15/01/2025', size: '2.1 Mo' },
              { name: 'Attestation de Travail', date: 'Validé le 15/01/2025', size: '850 Ko' },
              { name: 'Quittances Antérieures', date: 'Validé le 15/01/2025', size: '1.2 Mo' },
            ].map((doc, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1">{doc.name}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>{doc.date}</span>
                  <span>{doc.size}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer les modifications</span>
          </button>
        </div>

      </form>
    </div>
  );
};
