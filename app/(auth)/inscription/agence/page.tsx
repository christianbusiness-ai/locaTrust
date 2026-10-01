'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function InscriptionAgencePage() {
  const [agencyName, setAgencyName] = useState('');
  const [rccmNumber, setRccmNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Abidjan');
  const [commune, setCommune] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">Inscription Agence Immobilière</h2>
          <p className="text-xs text-slate-500">Conforme au Code de la Construction et de l'Habitat ivoirien</p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-lg">Demande transmise avec succès !</h4>
            <p className="text-xs text-slate-500">
              Un email de confirmation a été envoyé à <strong>{email}</strong> pour l'agence basée à {city}{commune ? ` (${commune})` : ''}. Vos pièces justificatives (RCCM & agrément) pourront être soumises dans votre espace pour obtenir le badge <strong>« Agence vérifiée »</strong>.
            </p>
            <Link href="/agence/dashboard" className="w-full mt-2">
              <Button className="w-full font-bold bg-purple-600 hover:bg-purple-500 text-white">
                Accéder à l'Espace Agence
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Raison Sociale / Nom de l'Agence</label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Immobilière du Golf Abidjan"
                className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Numéro RCCM (Registre du Commerce)</label>
              <input
                type="text"
                value={rccmNumber}
                onChange={(e) => setRccmNumber(e.target.value)}
                placeholder="CI-ABJ-03-2022-B12-09876"
                className="p-3 bg-slate-50 border rounded-xl text-xs font-mono"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Adresse Email Professionnelle</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@immogolf.ci"
                className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Téléphone de l'Agence</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 27 22 44 55 66"
                className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Ville du Siège *</span>
                  <span className="text-[10px] text-purple-600 font-semibold">Libre</span>
                </label>
                <input
                  type="text"
                  list="agency-cities"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="ex: Abidjan, Bouaké..."
                  className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Commune du Siège *</span>
                  <span className="text-[10px] text-purple-600 font-semibold">Libre</span>
                </label>
                <input
                  type="text"
                  list="agency-communes"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="ex: Plateau, Cocody..."
                  className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                required
              />
            </div>

            <datalist id="agency-cities">
              <option value="Abidjan" />
              <option value="Bouaké" />
              <option value="Yamoussoukro" />
              <option value="San-Pédro" />
              <option value="Korhogo" />
              <option value="Daloa" />
              <option value="Man" />
              <option value="Grand-Bassam" />
            </datalist>

            <datalist id="agency-communes">
              <option value="Plateau" />
              <option value="Cocody" />
              <option value="Marcory" />
              <option value="Zone 4" />
              <option value="Yopougon" />
              <option value="Koumassi" />
              <option value="Treichville" />
              <option value="Port-Bouët" />
              <option value="Bingerville" />
              <option value="Commerce" />
              <option value="Air France" />
            </datalist>


            <Button type="submit" className="w-full py-3 font-extrabold bg-purple-600 hover:bg-purple-500 text-white mt-2">
              Créer le compte agence
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
