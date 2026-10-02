'use client';

import React from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  QrCode,
  FileCheck,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Lock,
  ChevronRight,
  Download,
  Calendar,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Smartphone,
  Award
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { UserRole } from '@/types/database.types';

interface LandingPageViewProps {
  onOpenRegister: () => void;
  onEnterSaaS: (role?: UserRole, asDemo?: boolean) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenRegister,
  onEnterSaaS
}) => {
  const handleLoginClick = () => {
    if (typeof window !== 'undefined' && localStorage.getItem('locatrust_account_created') === 'true') {
      const savedRole = (localStorage.getItem('locatrust_registered_role') as UserRole) || 'proprietaire';
      onEnterSaaS(savedRole, false);
    } else {
      onOpenRegister();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo size="md" variant="dark" showSubtitle={true} />
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-300">
            <a href="#features" className="hover:text-blue-400 transition-colors">Fonctionnalités</a>
            <a href="#spaces" className="hover:text-blue-400 transition-colors">Espaces Dédiés</a>
            <a href="#qrcode" className="hover:text-blue-400 transition-colors">Contrat & QR Code</a>
            <a href="#pricing" className="hover:text-blue-400 transition-colors">Tarifs</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleLoginClick}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Connexion
            </button>

            {/* BOUTON PRÊT À SORTIR SUR LA LANDING PAGE */}
            <button
              type="button"
              onClick={onOpenRegister}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Créer un compte</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/20 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-indigo-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center gap-6">
          {/* Tag officiel */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-700/60 text-blue-300 text-xs font-black shadow-inner">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Conforme Loi N° 2019-576 du 26 juin 2019 • République de Côte d'Ivoire</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl leading-[1.15]">
            La Plateforme SaaS de Gestion Locative <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">Certifiée & Sécurisée</span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl font-medium leading-relaxed">
            Baux de location certifiés avec QR Code infalsifiable, séquestre transparent des cautions, encaissements Wave & Mobile Money et automatisation fiscale pour <strong>Bailleurs</strong>, <strong>Agences</strong> et <strong>Locataires</strong>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto mt-2">
            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Créer un compte maintenant</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onEnterSaaS('proprietaire')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Accéder à la plateforme</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Key Trust Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mt-10 pt-10 border-t border-slate-800/80">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black text-blue-400">100%</div>
              <div className="text-xs text-slate-400 mt-1">Conformité Légale CI</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">99.8%</div>
              <div className="text-xs text-slate-400 mt-1">Paiements à l'Échéance</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black text-amber-400">0 Litige</div>
              <div className="text-xs text-slate-400 mt-1">Cautions sous Séquestre</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black text-purple-400">QR Code</div>
              <div className="text-xs text-slate-400 mt-1">Vérification Instantanée</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LES 3 ESPACES DU SAAS */}
      <section id="spaces" className="py-16 sm:py-24 bg-slate-950 border-t border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Une Solution Tout-en-Un</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              Des Espaces Conçus pour Chaque Acteur
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Basculez d'un rôle à l'autre en toute fluidité avec des autorisations adaptées.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Carte Propriétaire */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-6 hover:border-blue-500/50 transition-all">
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Espace Propriétaire</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gérez votre patrimoine, générez des baux officiels avec signature électronique, recevez vos loyers directement par Wave ou virement et éditez vos quittances automatiques.
                </p>
                <ul className="space-y-2 mt-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Tableau de bord financier en temps réel</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Génération de baux avec QR Code certifié</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Rappels automatiques de loyer sans conflit</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onEnterSaaS('proprietaire')}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Découvrir l'Espace Bailleur</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Carte Agence Immobilière */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-6 hover:border-indigo-500/50 transition-all">
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Espace Agence Immobilière</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pensé pour les professionnels agréés MCU. Pilotez vos mandats multi-bailleurs, gérez vos collaborateurs et générez vos exports comptables FEC pour votre expert-comptable.
                </p>
                <ul className="space-y-2 mt-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Gestionnaire Multi-Bailleurs mandants</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Comptes d'équipe avec rôles sécurisés</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Exports Grand Livre & Journaux certifiés</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onEnterSaaS('agence')}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Découvrir l'Espace Agence</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Carte Locataire */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-6 hover:border-teal-500/50 transition-all">
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Espace Locataire</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Postulez en 1 clic avec un dossier vérifié, effectuez vos paiements en toute sérénité et téléchargez vos reçus et quittances valables devant toute institution.
                </p>
                <ul className="space-y-2 mt-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Fil d'actualité des biens disponibles</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Paiements mobiles transparents</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Signalement d'incidents et maintenance</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onEnterSaaS('locataire')}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Découvrir l'Espace Locataire</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SECTION QR CODE VERIFICATION */}
      <section id="qrcode" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-8 sm:p-12 rounded-3xl border border-blue-900/40 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex flex-col gap-4 max-w-xl">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-black uppercase tracking-wider self-start">
                Sécurité & Anti-Fraude
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Chaque contrat certifié possède son propre QR Code unique
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Fini les faux baux et signatures imitées. Tout tiers (banque, ambassade, autorité judiciaire) peut scanner le QR code pour accéder à l'état officiel certifié du contrat en temps réel.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, '', '/verify/contrat/CT-2026-00059');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs transition-all shadow-md flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <span>Tester la vérification en direct</span>
                </button>
              </div>
            </div>

            <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col items-center text-center gap-3 shrink-0 text-slate-900 max-w-xs">
              <div className="w-40 h-40 bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center justify-center">
                <img
                  src="/locatrust-qr-official.png"
                  alt="QR Code Certifié LocaTrust"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-black block">CT-2026-00059</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-1">
                  ✓ Contrat Certifié Valide
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TARIFS SAAS */}
      <section id="pricing" className="py-16 sm:py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center gap-10">
          <div>
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Tarification Accessible</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              Un Forfait Simple et Transparent
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl">
              Payez uniquement selon le volume de biens sous gestion. Gratuit pour les locataires.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between text-left">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Starter</span>
                <h4 className="text-xl font-black text-white mt-1">1 bien</h4>
                <div className="text-2xl font-black text-blue-400 mt-3">500 <span className="text-xs font-bold text-slate-400">FCFA / mois</span></div>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="mt-6 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Créer un compte
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-900/40 to-slate-900 border-2 border-blue-500 flex flex-col justify-between text-left relative">
              <span className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-black uppercase">
                Populaire
              </span>
              <div>
                <span className="text-xs font-bold text-blue-300 uppercase">Particulier</span>
                <h4 className="text-xl font-black text-white mt-1">2 à 10 biens</h4>
                <div className="text-2xl font-black text-blue-400 mt-3">2 000 <span className="text-xs font-bold text-slate-400">FCFA / mois</span></div>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="mt-6 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md"
              >
                Créer un compte
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between text-left">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Bailleur Pro</span>
                <h4 className="text-xl font-black text-white mt-1">11 à 20 biens</h4>
                <div className="text-2xl font-black text-blue-400 mt-3">5 000 <span className="text-xs font-bold text-slate-400">FCFA / mois</span></div>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="mt-6 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Créer un compte
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between text-left">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Agence & Parc</span>
                <h4 className="text-xl font-black text-white mt-1">Plus de 20 biens</h4>
                <div className="text-2xl font-black text-blue-400 mt-3">10 000 <span className="text-xs font-bold text-slate-400">FCFA / mois</span></div>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="mt-6 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Créer un compte
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800/80 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" variant="dark" showSubtitle={false} />
          <p>© 2026 LocaTrust. Plateforme de Gestion Locative Sécurisée en Côte d'Ivoire. Tous droits réservés.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="hover:text-white cursor-pointer">Loi 2019-576</span>
            <span className="hover:text-white cursor-pointer">ARTCI</span>
            <span className="hover:text-white cursor-pointer">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
