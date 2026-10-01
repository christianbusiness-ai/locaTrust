'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check, Save, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getCurrentAccountingYear,
  saveCurrentAccountingYear,
  getSelectedViewingYear,
  setSelectedViewingYear,
  getActiveReferenceYear,
  getArchivedYears
} from '@/lib/reports/accountingHistoryStore';

interface AccountingYearCompactControlProps {
  onYearChanged?: (year: string, isTemporary: boolean) => void;
  className?: string;
}

export const AccountingYearCompactControl: React.FC<AccountingYearCompactControlProps> = ({
  onYearChanged,
  className = ''
}) => {
  // Current real accounting year saved in DB / localStorage
  const [currentAccountingYear, setCurrentAccountingYear] = useState<string>(() => getCurrentAccountingYear());
  // Input field for Control 1
  const [inputYear, setInputYear] = useState<string>(() => getCurrentAccountingYear());
  // Temporary viewing year (in-memory)
  const [viewingYear, setViewingYear] = useState<string | null>(() => getSelectedViewingYear());
  // List of archived years
  const [archivedYears, setArchivedYears] = useState<string[]>(() => getArchivedYears());
  // Dropdown state for Control 3
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // Feedback message
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state on mount and with global custom events
  useEffect(() => {
    const handleYearChanged = (e: any) => {
      const cy = getCurrentAccountingYear();
      const vy = getSelectedViewingYear();
      setCurrentAccountingYear(cy);
      setViewingYear(vy);
      setArchivedYears(getArchivedYears());
    };

    window.addEventListener('locatrust:year_changed', handleYearChanged);
    return () => window.removeEventListener('locatrust:year_changed', handleYearChanged);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Active highlighted year: viewingYear if set, otherwise currentAccountingYear
  const activeSelectedYear = viewingYear || currentAccountingYear;
  const isTemporaryViewing = Boolean(viewingYear && viewingYear !== currentAccountingYear);

  // CONTRÔLE 1 — Enregistrer l'année
  const handleSaveYear = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputYear.trim();
    if (!clean || isNaN(Number(clean)) || Number(clean) < 2000 || Number(clean) > 2100) {
      setFeedback({ message: 'Veuillez saisir une année valide à 4 chiffres (ex: 2027).', type: 'error' });
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    const res = saveCurrentAccountingYear(clean);
    if (res.success) {
      setCurrentAccountingYear(res.currentYear);
      setViewingYear(null); // Reset temporary viewing
      setArchivedYears(res.archivedYears);
      setInputYear(res.currentYear);
      setFeedback({
        message: `L'année ${res.currentYear} est enregistrée et devient l'année comptable actuelle.`,
        type: 'success'
      });
      setTimeout(() => setFeedback(null), 4000);
      onYearChanged?.(res.currentYear, false);
    }
  };

  // CONTRÔLE 3 — Sélection d'une année archivée
  const handleSelectArchivedYear = (pastYear: string) => {
    const selected = setSelectedViewingYear(pastYear);
    setViewingYear(selected);
    setIsDropdownOpen(false);
    setFeedback({
      message: `Consultation temporaire de l'exercice ${selected}. Les données affichées correspondent à ${selected}.`,
      type: 'info'
    });
    setTimeout(() => setFeedback(null), 4500);
    onYearChanged?.(selected, true);
  };

  // Revenir à l'année comptable réelle
  const handleResetToCurrentYear = () => {
    setSelectedViewingYear(null);
    setViewingYear(null);
    setFeedback({
      message: `Retour à l'année comptable actuelle (${currentAccountingYear}).`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 3000);
    onYearChanged?.(currentAccountingYear, false);
  };

  // Filter archived years to exclude currently selected active year if needed
  const availableArchives = archivedYears.filter((y) => y !== currentAccountingYear);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4 ${className}`}>
      {/* Title & Description */}
      <div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-black text-slate-900">
            Année comptable
          </h4>
          {isTemporaryViewing && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
              Mode consultation archivée ({activeSelectedYear})
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Définissez l'exercice comptable de référence pour les statistiques, rapports, recettes, dépenses et exports.
        </p>
      </div>

      {/* FEEDBACK TOAST / ALERT */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'info'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* LES 3 CONTRÔLES PRINCIPAUX DEMANDÉS */}
      <div className="flex flex-wrap items-center gap-4 pt-1">
        
        {/* ============================================================== */}
        {/* CONTRÔLE 1 — ENREGISTRER L'ANNÉE                               */}
        {/* Zone de saisie manuelle [ 2027 ] + [ Enregistrer l'année ]     */}
        {/* ============================================================== */}
        <form onSubmit={handleSaveYear} className="flex items-center gap-2">
          <label htmlFor="input-accounting-year" className="sr-only">
            Année comptable
          </label>
          <input
            id="input-accounting-year"
            type="number"
            min={2020}
            max={2035}
            value={inputYear}
            onChange={(e) => setInputYear(e.target.value)}
            placeholder="2027"
            className="w-24 px-3 py-2 rounded-xl border border-slate-300 font-black text-sm text-slate-900 bg-white text-center focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 outline-none shadow-inner"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-blue-400" />
            <span>Enregistrer l'année</span>
          </button>
        </form>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* ============================================================== */}
        {/* CONTRÔLE 2 — ANNÉE EN COURS                                    */}
        {/* Élément / bouton BLEU indiquant l'année sélectionnée           */}
        {/* ============================================================== */}
        <div className="flex items-center gap-1.5">
          <div
            title={`Année active sélectionnée : ${activeSelectedYear}`}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-sm shadow-md border border-blue-500 flex items-center gap-2 select-none"
          >
            <span>{activeSelectedYear}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-800/80 text-blue-100">
              {isTemporaryViewing ? 'Consultée' : 'En cours'}
            </span>
          </div>

          {/* Quick button to revert back to real year if currently viewing archive */}
          {isTemporaryViewing && (
            <button
              type="button"
              onClick={handleResetToCurrentYear}
              title="Revenir à l'année comptable réelle"
              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Revenir à {currentAccountingYear}</span>
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* ============================================================== */}
        {/* CONTRÔLE 3 — ANNÉES ARCHIVÉES                                  */}
        {/* Bouton compact [ Années archivées ▼ ] avec liste déroulante   */}
        {/* ============================================================== */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 border border-slate-200 transition-all active:scale-95 shadow-sm"
          >
            <span>Années archivées</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                isDropdownOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {/* Menu déroulant des années archivées */}
          {isDropdownOpen && (
            <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-scaleUp">
              <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Archives clôturées
              </div>

              {availableArchives.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleSelectArchivedYear(yr)}
                  className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-blue-50 transition-colors ${
                    activeSelectedYear === yr ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">→</span>
                    <span>Exercice {yr}</span>
                  </div>
                  {activeSelectedYear === yr && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}

              {availableArchives.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-400 text-center">
                  Aucune archive disponible
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Explication discrète du retour automatique */}
      <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between flex-wrap gap-2">
        <span>
          <strong>Règle de session :</strong> La sélection d'une archive est un contexte de consultation temporaire. Au rechargement de la page, le système revient automatiquement à l'année en cours ({currentAccountingYear}).
        </span>
        <span className="font-semibold text-slate-400">
          Données historiques scellées sans écrasement
        </span>
      </div>
    </div>
  );
};
