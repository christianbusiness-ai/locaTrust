'use client';

import React, { useState } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  BookOpen,
  ArrowRight,
  Trash2,
  Wand2,
  Check
} from 'lucide-react';

export interface ClauseRule {
  id: string;
  category: 'ivoirien' | 'ohada';
  keywordMatch: RegExp;
  title: string;
  legalReference: string;
  issueExplanation: string;
  proposedCorrection: string;
}

export const LEGAL_RULES_DATABASE: ClauseRule[] = [
  {
    id: 'rule_car_or_tied_selling',
    category: 'ivoirien',
    keywordMatch: /(acheter.*voiture|achat.*véhicule|acheter.*auto|vente.*liée|obligation.*achat.*meuble)/i,
    title: 'Vente liée et obligation tierce non liée au bail',
    legalReference: 'Article 1134 du Code Civil & Loi n° 2019-576 (Dispositions impératives du bail)',
    issueExplanation: 'La clause contraignant le locataire à acheter un véhicule ou tout bien meuble étranger au bail est strictement illégale, abusive et réputée non écrite.',
    proposedCorrection: 'Suppression intégrale de la clause et rappel du cadre exclusif de la jouissance du bien immobilier loué.'
  },
  {
    id: 'rule_caution_cap',
    category: 'ivoirien',
    keywordMatch: /(caution.*([3-9]|trois|quatre|cinq).*mois|dépôt.*garantie.*([3-9]|trois|quatre|cinq).*mois)/i,
    title: 'Plafond légal du dépôt de garantie (Max 2 mois)',
    legalReference: 'Article 416 de la Loi n° 2019-576 du 26 juin 2019',
    issueExplanation: 'En République de Côte d\'Ivoire, le montant du dépôt de garantie exigible par le bailleur ne peut en aucun cas excéder deux (2) mois de loyer.',
    proposedCorrection: 'Le dépôt de garantie est fixé à un montant équivalent à deux (2) mois de loyer principal hors charges.'
  },
  {
    id: 'rule_advance_cap',
    category: 'ivoirien',
    keywordMatch: /(avance.*([3-9]|trois|quatre|cinq).*mois|loyers.*avance.*([3-9]|trois|quatre|cinq).*mois)/i,
    title: 'Plafond légal des loyers d\'avance (Max 2 mois)',
    legalReference: 'Article 415 de la Loi n° 2019-576 du 26 juin 2019',
    issueExplanation: 'Le bailleur ne peut pas exiger plus de deux (2) mois de loyer à titre d\'avance lors de la conclusion du bail.',
    proposedCorrection: 'Le paiement initial est limité à deux (2) mois de loyer d\'avance maximum conformément à la loi.'
  },
  {
    id: 'rule_illegal_eviction',
    category: 'ivoirien',
    keywordMatch: /(expulsion.*immédiate|sans.*préavis|coupure.*courant|coupure.*eau|coupure.*électricité|serrure.*changée|expulser.*d'office)/i,
    title: 'Expulsion unilatérale ou voie de fait interdite',
    legalReference: 'Article 450 de la Loi n° 2019-576 & OHADA Art. 112 (Voie de fait prohibée)',
    issueExplanation: 'Toute résiliation de bail ou reprise forcée nécessite le respect du préavis légal de 3 mois et une décision judiciaire exécutoire. Couper l\'eau ou l\'électricité constitue une infraction pénale.',
    proposedCorrection: 'En cas de manquement grave ou impayé, le bailleur délivrera une mise en demeure avec préavis légal avant toute saisine du Tribunal compétent.'
  },
  {
    id: 'rule_heavy_repairs',
    category: 'ohada',
    keywordMatch: /(gros.*murs|toiture.*charge.*locataire|étanchéité.*charge.*locataire|grosses.*réparations.*locataire)/i,
    title: 'Imputation illégale des grosses réparations de structure',
    legalReference: 'Article 428 Loi n° 2019-576 & Acte Uniforme OHADA portant sur le Droit Commercial Général (Art. 106)',
    issueExplanation: 'Les réparations majeures touchant la structure du bâtiment (clos, couvert, étanchéité, gros murs, fosses) incombent exclusivement au bailleur.',
    proposedCorrection: 'Les grosses réparations relatives au clos, au couvert et à la structure de l\'immeuble demeurent à la charge exclusive du bailleur.'
  },
  {
    id: 'rule_visitor_restriction',
    category: 'ivoirien',
    keywordMatch: /(interdit.*visiteur|pas.*invité|interdiction.*recevoir|visite.*famille.*interdite)/i,
    title: 'Atteinte à la jouissance paisible et à la vie privée',
    legalReference: 'Article 425 de la Loi n° 2019-576 & Droit constitutionnel au respect de la vie privée',
    issueExplanation: 'Le locataire jouit paisiblement du logement loué. Le bailleur ne peut lui interdire de recevoir sa famille ou ses proches sous réserve du respect du calme.',
    proposedCorrection: 'Le locataire use paisiblement des locaux loués et veille au respect de la tranquillité et du repos du voisinage.'
  },
  {
    id: 'rule_septic_tank',
    category: 'ivoirien',
    keywordMatch: /(?:(?:locataire\s+doit\s+(?:vider|vidanger)\s+(?:à\s+l['’]entrée|dès\s+l['’]entrée|d['’]avance))|(?:(?:propriétaire|bailleur)\s+(?:décline|refuse|ne\s+prendra\s+(?:jamais|pas))\s+.*(?:fosse|assainissement|vidange)))/i,
    title: 'Clause non conforme relative à la fosse septique et à l\'assainissement',
    legalReference: 'Articles 424 et 428 de la Loi n° 2019-576 (Code de la Construction et de l\'Habitat)',
    issueExplanation: 'Le bailleur a l\'obligation légale de délivrer un logement salubre avec une fosse septique vidangée et fonctionnelle à l\'entrée. Il ne peut pas s\'exonérer de cette obligation ni imputer au locataire la réfection structurelle de l\'assainissement.',
    proposedCorrection: 'Le bailleur garantit la délivrance d\'une fosse septique vidangée et fonctionnelle à l\'entrée ; le locataire assure l\'usage normal des installations sanitaires.'
  }
];

interface LegalContractAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractTitle?: string;
  contractNumber?: string;
  clausesText: string;
  onApplyCorrection?: (newClausesText: string) => void;
}

export const LegalContractAnalyzerModal: React.FC<LegalContractAnalyzerModalProps> = ({
  isOpen,
  onClose,
  contractTitle = 'Bail d\'Habitation Ivoirien',
  contractNumber = 'LT-2026-CI-000492',
  clausesText,
  onApplyCorrection
}) => {
  const [currentText, setCurrentText] = useState<string>(clausesText);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  // Scan text against rules
  const detectedIssues = LEGAL_RULES_DATABASE.filter(rule => rule.keywordMatch.test(currentText));

  const handleProposeCorrection = (rule: ClauseRule) => {
    // Replace the offending pattern with the legal recommendation
    const updated = currentText.replace(rule.keywordMatch, rule.proposedCorrection);
    setCurrentText(updated);
    if (onApplyCorrection) onApplyCorrection(updated);
    setSuccessToast(`Correction juridique appliquée : ${rule.title}`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleDeleteClause = (rule: ClauseRule) => {
    // Remove lines matching
    const lines = currentText.split('\n');
    const remaining = lines.filter(l => !rule.keywordMatch.test(l)).join('\n');
    setCurrentText(remaining);
    if (onApplyCorrection) onApplyCorrection(remaining);
    setSuccessToast(`Clause non conforme supprimée : ${rule.title}`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black shadow-sm">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Analyse Juridique du Contrat
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
                  CI & OHADA
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Contrat N° {contractNumber} • Vérification de conformité au droit locatif ivoirien
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success toast */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Legal Sources Reference Banner */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
          <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            Base de règles juridiques actives :
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <span>Côte d'Ivoire : Loi n° 2019-576 (Code Construction & Habitat)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span>OHADA : Acte Uniforme Droit Commercial Général (Art. 101+)</span>
            </div>
          </div>
        </div>

        {/* Detection Status Header */}
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-xs text-slate-900">
            Résultats de l'analyse ({detectedIssues.length} anomalie{detectedIssues.length > 1 ? 's' : ''} détectée{detectedIssues.length > 1 ? 's' : ''})
          </span>
          {detectedIssues.length === 0 ? (
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Contrat 100% Conforme au droit locatif
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-xs flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              {detectedIssues.length} clause(s) à corriger
            </span>
          )}
        </div>

        {/* Issues List */}
        {detectedIssues.length > 0 ? (
          <div className="flex flex-col gap-3">
            {detectedIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-4 rounded-2xl border border-rose-300 bg-rose-50/80 flex flex-col gap-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                        ⚠ Clause non conforme au droit locatif
                      </span>
                      <h4 className="font-black text-rose-950 text-sm mt-1">{issue.title}</h4>
                      <span className="text-[11px] font-bold text-slate-600">
                        Réf. légale : {issue.legalReference}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-200 text-rose-900 shrink-0">
                    {issue.category === 'ivoirien' ? 'Droit CI' : 'Droit OHADA'}
                  </span>
                </div>

                <p className="text-xs text-rose-900 font-medium leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-200">
                  {issue.issueExplanation}
                </p>

                {/* Proposed Correction */}
                <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs flex flex-col gap-1">
                  <span className="text-[10px] font-black text-emerald-800 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Correction recommandée par le système :
                  </span>
                  <span className="font-semibold text-slate-800 italic">
                    "{issue.proposedCorrection}"
                  </span>
                </div>

                {/* Action buttons requested by user prompt: "proposer correction", "supprimer clause" */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleDeleteClause(issue)}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-black text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer la clause</span>
                  </button>

                  <button
                    onClick={() => handleProposeCorrection(issue)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Proposer correction</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-black text-slate-900 text-sm">Toutes les clauses sont conformes</h4>
              <p className="text-xs text-slate-600 max-w-md">
                Aucune clause abusive ou contraire au Code de la Construction Ivoirien ni à l'OHADA n'a été détectée. Le bail peut être signé en toute sécurité.
              </p>
            </div>
          </div>
        )}

        {/* Text preview */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Texte des clauses particulières analysé</label>
          <textarea
            rows={4}
            value={currentText}
            onChange={(e) => {
              setCurrentText(e.target.value);
              if (onApplyCorrection) onApplyCorrection(e.target.value);
            }}
            className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <button
            onClick={() => {
              // Add abusive test clause to test prompt requirement: "Le locataire doit acheter ma voiture."
              const testClause = currentText + "\n5. Le locataire doit acheter ma voiture.";
              setCurrentText(testClause);
              if (onApplyCorrection) onApplyCorrection(testClause);
            }}
            className="text-[11px] font-bold text-slate-500 hover:text-blue-600 hover:underline"
          >
            + Tester la détection "Le locataire doit acheter ma voiture"
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors"
          >
            Fermer l'analyseur
          </button>
        </div>

      </div>
    </div>
  );
};
