'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function InscriptionLocatairePage() {
  const [fullName, setFullName] = useState('');
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-elevated flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white shadow-md">
            <Shield className="w-7 h-7 text-gold-400 fill-gold-400/20" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">Inscription Locataire</h2>
          <p className="text-xs text-slate-500">Compte activé automatiquement dès confirmation par email</p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-lg">Email de confirmation envoyé !</h4>
            <p className="text-xs text-slate-500">
              Veuillez cliquer sur le lien envoyé à <strong>{email}</strong> pour activer immédiatement votre compte locataire ({city}{commune ? ` - ${commune}` : ''}). Le badge vérifié CNI sera proposé de façon optionnelle et asynchrone dans votre profil.
            </p>
            <Link href="/feed" className="w-full mt-2">
              <Button className="w-full font-bold">Accéder à l'application</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Nom Complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="LocaTrust Utilisateur"
                className="p-3 bg-slate-50 border rounded-xl text-xs"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Adresse Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@locatrust.ci"
                className="p-3 bg-slate-50 border rounded-xl text-xs"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Téléphone (Mobile Money / SMS)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 07 08 09 10 11"
                className="p-3 bg-slate-50 border rounded-xl text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Ville *</span>
                  <span className="text-[10px] text-blue-600 font-semibold">Libre</span>
                </label>
                <input
                  type="text"
                  list="tenant-cities"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="ex: Abidjan, Bouaké..."
                  className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Commune *</span>
                  <span className="text-[10px] text-blue-600 font-semibold">Libre</span>
                </label>
                <input
                  type="text"
                  list="tenant-communes"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="ex: Cocody, Air France..."
                  className="p-3 bg-slate-50 border rounded-xl text-xs font-semibold"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="p-3 bg-slate-50 border rounded-xl text-xs"
                required
              />
            </div>

            <datalist id="tenant-cities">
              <option value="Abidjan" />
              <option value="Bouaké" />
              <option value="Yamoussoukro" />
              <option value="San-Pédro" />
              <option value="Korhogo" />
              <option value="Daloa" />
              <option value="Man" />
              <option value="Grand-Bassam" />
            </datalist>

            <datalist id="tenant-communes">
              <option value="Cocody" />
              <option value="Yopougon" />
              <option value="Marcory" />
              <option value="Plateau" />
              <option value="Koumassi" />
              <option value="Treichville" />
              <option value="Port-Bouët" />
              <option value="Bingerville" />
              <option value="Air France" />
              <option value="Commerce" />
              <option value="Koko" />
              <option value="Bardot" />
            </datalist>


            <Button type="submit" variant="primary" className="w-full py-3 font-bold mt-2">
              Créer mon compte locataire
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
