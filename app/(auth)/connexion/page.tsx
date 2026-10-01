'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ConnexionPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = '/feed';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-elevated flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white shadow-md">
            <Shield className="w-7 h-7 text-gold-400 fill-gold-400/20" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">Connexion LocaTrust</h2>
          <p className="text-xs text-slate-500">Accédez à votre espace sécurisé de gestion locative</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.email@exemple.ci"
              className="p-3 bg-slate-50 border rounded-xl text-xs"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
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

          <Button type="submit" variant="primary" className="w-full py-3 font-bold mt-2">
            Se connecter
          </Button>
        </form>

        <div className="flex items-center justify-center gap-1 text-xs text-slate-500 border-t pt-4">
          <span>Pas encore de compte ?</span>
          <Link href="/inscription/locataire" className="text-brand-600 font-bold hover:underline">
            S'inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}
