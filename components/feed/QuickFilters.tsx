'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

interface QuickFiltersProps {
  onFilterChange: (filters: any) => void;
  onReset: () => void;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  onFilterChange,
  onReset,
}) => {
  const [city, setCity] = useState('');
  const [quartier, setQuartier] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [rooms, setRooms] = useState('');

  const handleSearch = () => {
    onFilterChange({ city, quartier, type, budget, rooms });
  };

  const handleResetFilters = () => {
    setCity('');
    setQuartier('');
    setType('');
    setBudget('');
    setRooms('');
    onReset();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <SlidersHorizontal className="w-4 h-4 text-brand-600" />
          <span>Filtres rapides</span>
        </div>
        <button
          onClick={handleResetFilters}
          className="text-xs text-brand-600 hover:underline font-semibold flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Réinitialiser
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Ville */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">Ville</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Toutes les villes</option>
            <option value="Abidjan">Abidjan</option>
            <option value="Yamoussoukro">Yamoussoukro</option>
            <option value="San-Pedro">San-Pedro</option>
            <option value="Bouaké">Bouaké</option>
          </select>
        </div>

        {/* Quartier */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">Quartier</label>
          <select
            value={quartier}
            onChange={(e) => setQuartier(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Tous les quartiers</option>
            <option value="Cocody Riviera">Cocody Riviera</option>
            <option value="Marcory Zone 4">Marcory Zone 4</option>
            <option value="Angré 8e tranche">Angré 8e tranche</option>
            <option value="Quartier Millionnaire">Quartier Millionnaire</option>
          </select>
        </div>

        {/* Type de bien */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">Type de bien</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Tous les types</option>
            <option value="appartement">Appartement</option>
            <option value="maison">Villa / Maison</option>
            <option value="studio">Studio</option>
            <option value="bureau">Bureau</option>
          </select>
        </div>

        {/* Budget max */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">Budget max</label>
          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Tous les budgets</option>
            <option value="250000">&lt; 250 000 FCFA</option>
            <option value="500000">&lt; 500 000 FCFA</option>
            <option value="1000000">&lt; 1 000 000 FCFA</option>
          </select>
        </div>

        {/* Nombre de pièces */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">Nombre de pièces</label>
          <select
            value={rooms}
            onChange={(e) => setRooms(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Toutes</option>
            <option value="1">1 pièce</option>
            <option value="2">2 pièces</option>
            <option value="3">3 pièces</option>
            <option value="4">4 pièces et +</option>
          </select>
        </div>

        <Button
          onClick={handleSearch}
          className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-md mt-1"
        >
          Rechercher
        </Button>
      </div>
    </div>
  );
};
