'use client';

import React, { useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  X,
  Sparkles,
  Download
} from 'lucide-react';

interface EtatDesLieuxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EtatDesLieuxModal: React.FC<EtatDesLieuxModalProps> = ({ isOpen, onClose }) => {
  const [inspectionType, setInspectionType] = useState<'entree' | 'intermediaire' | 'sortie'>('entree');
  const [wallsState, setWallsState] = useState('bon_etat');
  const [floorsState, setFloorsState] = useState('bon_etat');
  const [plumbingState, setPlumbingState] = useState('bon_etat');
  const [electricityState, setElectricityState] = useState('bon_etat');
  const [waterMeter, setWaterMeter] = useState('04821');
  const [powerMeter, setPowerMeter] = useState('119283');
  const [observations, setObservations] = useState('Peinture neuve, aucun éclat mural.');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`État des lieux d'${inspectionType} enregistré avec succès et relié au contrat de bail ! Signature contradictoire validée.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn font-sans">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Procès-Verbal d'État des Lieux</h3>
              <p className="text-xs text-slate-500">Contradictoire et obligatoire avec le dépôt de garantie</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4 text-xs font-semibold">
          
          {/* Inspection Stage Selection */}
          <div>
            <label className="font-extrabold text-slate-800 block mb-1">Étape de l'État des Lieux</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setInspectionType('entree')}
                className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                  inspectionType === 'entree' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'
                }`}
              >
                1. Entrée dans les lieux
              </button>
              <button
                type="button"
                onClick={() => setInspectionType('intermediaire')}
                className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                  inspectionType === 'intermediaire' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'
                }`}
              >
                2. Intermédiaire
              </button>
              <button
                type="button"
                onClick={() => setInspectionType('sortie')}
                className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                  inspectionType === 'sortie' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'
                }`}
              >
                3. Sortie (Comparatif)
              </button>
            </div>
          </div>

          {/* Rooms Check Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="font-extrabold text-slate-800 block mb-1">État des Murs & Peinture</label>
              <select value={wallsState} onChange={(e) => setWallsState(e.target.value)} className="w-full p-2 rounded-xl border text-xs font-bold">
                <option value="neuf">Neuf</option>
                <option value="bon_etat">Bon état</option>
                <option value="usage">Usure normale</option>
                <option value="mauvais">Dégradé / À repeindre</option>
              </select>
            </div>

            <div>
              <label className="font-extrabold text-slate-800 block mb-1">État des Sols & Carreaux</label>
              <select value={floorsState} onChange={(e) => setFloorsState(e.target.value)} className="w-full p-2 rounded-xl border text-xs font-bold">
                <option value="neuf">Neuf</option>
                <option value="bon_etat">Bon état</option>
                <option value="usage">Usure normale</option>
                <option value="mauvais">Carreaux fêlés</option>
              </select>
            </div>

            <div>
              <label className="font-extrabold text-slate-800 block mb-1">Plomberie & Sanitaires</label>
              <select value={plumbingState} onChange={(e) => setPlumbingState(e.target.value)} className="w-full p-2 rounded-xl border text-xs font-bold">
                <option value="bon_etat">Fonctionnel sans fuite</option>
                <option value="fuite_legere">Légère infiltration</option>
                <option value="defectueux">Défectueux</option>
              </select>
            </div>

            <div>
              <label className="font-extrabold text-slate-800 block mb-1">Électricité & Prises</label>
              <select value={electricityState} onChange={(e) => setElectricityState(e.target.value)} className="w-full p-2 rounded-xl border text-xs font-bold">
                <option value="bon_etat">Conforme & Testé</option>
                <option value="defectueux">Ampoules/Prises à revoir</option>
              </select>
            </div>
          </div>

          {/* Meter Readings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-slate-800 block mb-1">Index Compteur SODECI (Eau)</label>
              <input
                type="text"
                value={waterMeter}
                onChange={(e) => setWaterMeter(e.target.value)}
                className="w-full p-2.5 rounded-xl border font-mono font-bold text-xs"
              />
            </div>
            <div>
              <label className="font-extrabold text-slate-800 block mb-1">Index Compteur CIE (Électricité)</label>
              <input
                type="text"
                value={powerMeter}
                onChange={(e) => setPowerMeter(e.target.value)}
                className="w-full p-2.5 rounded-xl border font-mono font-bold text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-extrabold text-slate-800 block mb-1">Observations particulières & Réserves</label>
            <textarea
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full p-2.5 rounded-xl border text-xs font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Annuler</button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow">
              Enregistrer l'État des Lieux
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
