'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Home,
  Users,
  User,
  Shield,
  FileText,
  CreditCard,
  ArrowRight,
  Menu,
  X,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
  Phone,
  Mail,
  Key,
  ChevronRight,
  Building2,
  Mic,
  QrCode,
  Check,
  Send,
  Minus,
  Plus,
  Calculator,
  MessageCircle,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Heart,
  SlidersHorizontal,
  Search,
  Scale,
  Award,
  Zap,
  Clock,
  Compass,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { formatFCFA } from '@/lib/utils';

interface LandingPageViewProps {
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onEnterSaaS: (role?: UserRole, asDemo?: boolean) => void;
}

// Propriétés vérifiées et accessibles en Côte d'Ivoire (Abidjan & villes de l'intérieur)
const FEATURED_PROPERTIES = [
  {
    id: 'prop-1',
    title: 'Studio Moderne Autonome',
    location: 'Yopougon Niangon, Abidjan',
    type: 'Studio Autonome',
    price: 25000,
    beds: 1,
    baths: 1,
    area: '28 m²',
    tag: 'Très demandé',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    cautionMax: '50 000 F (2 mois max)',
  },
  {
    id: 'prop-2',
    title: 'Chambre Salon Confort',
    location: 'Bouaké (Quartier Commerce)',
    type: '2 Pièces Carrelé',
    price: 35000,
    beds: 1,
    baths: 1,
    area: '45 m²',
    tag: 'Bailleur Certifié',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    cautionMax: '70 000 F (2 mois max)',
  },
  {
    id: 'prop-3',
    title: 'Studio Étudiant / Jeune Actif',
    location: 'Yamoussoukro (Morofé)',
    type: 'Studio Économique',
    price: 18000,
    beds: 1,
    baths: 1,
    area: '22 m²',
    tag: 'Petit Budget',
    image: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    cautionMax: '36 000 F (2 mois max)',
  },
  {
    id: 'prop-4',
    title: 'Appartement 2 Pièces Rénové',
    location: 'Cocody Angré 8e Tranche, Abidjan',
    type: '2 Pièces Spacieux',
    price: 55000,
    beds: 1,
    baths: 1,
    area: '52 m²',
    tag: 'Quartier Calme',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    cautionMax: '110 000 F (2 mois max)',
  },
  {
    id: 'prop-5',
    title: 'Pavillon 3 Pièces avec Cour',
    location: 'San Pedro (Bardot Résidentiel)',
    type: 'Maison avec Cour',
    price: 45000,
    beds: 2,
    baths: 1,
    area: '78 m²',
    tag: 'San Pedro',
    image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    cautionMax: '90 000 F (2 mois max)',
  },
  {
    id: 'prop-6',
    title: 'Appartement 3 Pièces Lumineux',
    location: 'Koumassi Remblais, Abidjan',
    type: '3 Pièces Familial',
    price: 80000,
    beds: 2,
    baths: 2,
    area: '82 m²',
    tag: 'Famille',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    cautionMax: '160 000 F (2 mois max)',
  }
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenRegister,
  onOpenLogin,
  onEnterSaaS
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'accueil' | 'vision' | 'biens' | 'engagements' | 'tarifs' | 'contact'>('accueil');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [likedProperties, setLikedProperties] = useState<Record<string, boolean>>({});

  // Simulateur de parc immobilier pour tarification SaaS
  const [pricingPropertyCount, setPricingPropertyCount] = useState<number>(3);

  // Formulaire de contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const toggleLike = (id: string) => {
    setLikedProperties((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToSection = (id: string, tab: 'accueil' | 'vision' | 'biens' | 'engagements' | 'tarifs' | 'contact') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else if (tab === 'accueil') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Filtre dynamique des propriétés
  const filteredProperties = FEATURED_PROPERTIES.filter((prop) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'abidjan') return prop.location.toLowerCase().includes('abidjan');
    if (activeFilter === 'interieur') return !prop.location.toLowerCase().includes('abidjan');
    if (activeFilter === 'petits-prix') return prop.price <= 35000;
    if (activeFilter === 'famille') return prop.beds >= 2;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAFBFC] text-slate-900 font-sans selection:bg-slate-900 selection:text-white relative overflow-x-hidden antialiased">
      
      {/* ========================================================================= */}
      {/* 1. FLOATING PILL NAVBAR AVEC LE VRAI LOGO OFFICIEL LOCATRUST */}
      {/* ========================================================================= */}
      <div className="fixed top-3 sm:top-4 inset-x-0 z-50 px-2.5 sm:px-6 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <header className="rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-3 sm:px-6 py-1.5 sm:py-2.5 flex items-center justify-between transition-all">
            
            {/* Logo officiel LocaTrust */}
            <div 
              className="cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 py-0.5" 
              onClick={() => scrollToSection('hero', 'accueil')}
              title="LocaTrust Accueil"
            >
              <img
                src="/locatrust-official-logo.png"
                alt="LocaTrust"
                className="h-6 sm:h-8 w-auto object-contain"
              />
            </div>

            {/* Liens de navigation centrés (Desktop) */}
            <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => scrollToSection('hero', 'accueil')}
                className={`transition-colors py-1 ${activeTab === 'accueil' ? 'text-slate-950 font-extrabold' : 'hover:text-slate-950'}`}
              >
                Accueil
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('vision', 'vision')}
                className={`transition-colors py-1 ${activeTab === 'vision' ? 'text-slate-950 font-extrabold' : 'hover:text-slate-950'}`}
              >
                Vision
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('properties', 'biens')}
                className={`transition-colors py-1 ${activeTab === 'biens' ? 'text-slate-950 font-extrabold' : 'hover:text-slate-950'}`}
              >
                Propriétés
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('values', 'engagements')}
                className={`transition-colors py-1 ${activeTab === 'engagements' ? 'text-slate-950 font-extrabold' : 'hover:text-slate-950'}`}
              >
                Valeurs
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('pricing', 'tarifs')}
                className={`transition-colors py-1 ${activeTab === 'tarifs' ? 'text-slate-950 font-extrabold' : 'hover:text-slate-950'}`}
              >
                Tarifs
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className={`transition-colors py-1 ${activeTab === 'contact' ? 'text-slate-950 font-extrabold' : 'hover:text-slate-950'}`}
              >
                Contact
              </button>
            </nav>

            {/* Boutons d'action à droite (Pill Dark Northvale) */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('locatrust:open_pwa_install'));
                  }
                }}
                className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-xs border border-blue-200/60"
                title="Installer l'application sur votre appareil pour y accéder sans navigateur"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Installer l'app</span>
              </button>

              <button
                type="button"
                onClick={onOpenLogin}
                className="hidden sm:inline-flex text-xs font-bold text-slate-700 hover:text-slate-950 px-2.5 sm:px-3 py-1.5 transition-colors"
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={onOpenRegister}
                className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-[#3D231E] hover:bg-[#2B1814] text-white font-extrabold text-[11px] sm:text-xs shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1 sm:gap-1.5"
              >
                <span className="whitespace-nowrap">Espace Membre</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>

              {/* Hamburger Mobile Toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 sm:p-2 rounded-full text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Ouvrir le menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </header>
        </div>
      </div>

      {/* Menu mobile déroulant fluide */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-3 sm:inset-x-4 top-14 sm:top-16 z-50 md:hidden bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-2 max-h-[85vh] overflow-y-auto animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <img
              src="/locatrust-official-logo.png"
              alt="LocaTrust"
              className="h-6 sm:h-7 w-auto object-contain"
            />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection('hero', 'accueil')}
            className="text-left py-2 px-3 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            Accueil
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('vision', 'vision')}
            className="text-left py-2 px-3 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            Notre Vision
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('properties', 'biens')}
            className="text-left py-2 px-3 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            Propriétés certifiées
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('values', 'engagements')}
            className="text-left py-2 px-3 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            Nos Valeurs & Engagements
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('pricing', 'tarifs')}
            className="text-left py-2 px-3 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            Tarifs SaaS
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact', 'contact')}
            className="text-left py-2 px-3 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            Contact
          </button>
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('locatrust:open_pwa_install'));
                }
              }}
              className="w-full py-2.5 rounded-full text-center text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Installer l'application</span>
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full py-2.5 rounded-full text-center text-xs font-bold text-slate-800 border border-slate-300 hover:bg-slate-50"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full py-2.5 rounded-full text-center text-xs font-bold bg-[#3D231E] text-white shadow-md"
            >
              Créer un compte
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HERO SECTION CINÉMATIQUE (Inspiration Northvale "Spaces worth coming home to.") */}
      {/* ========================================================================= */}
      <section id="hero" className="relative min-h-[85vh] lg:min-h-[90vh] flex flex-col justify-between pt-24 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        
        {/* Grande image architecturale d'arrière-plan avec dégradé subtil */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=85"
            alt="Villa Contemporaine d'Exception LocaTrust"
            className="w-full h-full object-cover object-center filter brightness-[0.92]"
          />
          {/* Overlay gradient supérieur pour lisibilité du titre + dégradé inférieur vers fond blanc */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-[#FAFBFC]" />
        </div>

        {/* Contenu textuel centré au-dessus de la villa */}
        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center gap-5 mt-4 sm:mt-8">
          
          {/* Tag de statut officiel */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold shadow-sm tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Conforme à la Loi ivoirienne n° 2019-576 & AUDCG OHADA</span>
          </div>

          {/* Titre héro majestueux (Typo Northvale iconique) */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] sm:leading-[1.1] drop-shadow-sm px-2">
            Des espaces dignes de vous sentir chez vous.
          </h1>

          {/* Sous-titre raffiné et équilibré */}
          <p className="text-xs sm:text-sm lg:text-base text-white/90 font-medium max-w-2xl leading-relaxed drop-shadow-sm px-3">
            Découvrez des logements accessibles, vérifiés et certifiés à Abidjan et partout en Côte d'Ivoire. Des studios économiques aux logements familiaux, trouvez ou publiez un bien avec des baux certifiés, des cautions protégées (plafond légal de 2 mois) et des quittances infalsifiables.
          </p>

          {/* Double boutons CTA en pilule */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-1 w-full sm:w-auto px-4 sm:px-0">
            <button
              type="button"
              onClick={() => scrollToSection('properties', 'biens')}
              className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-full bg-[#3D231E] hover:bg-[#2B1814] text-white font-extrabold text-xs sm:text-sm shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Explorer les logements</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-full bg-white/95 hover:bg-white text-slate-900 font-extrabold text-xs sm:text-sm shadow-xl transition-all hover:scale-105 active:scale-95 border border-white/50 backdrop-blur-md flex items-center justify-center"
            >
              <span>Espace Propriétaire & Bailleur</span>
            </button>
          </div>

        </div>

        {/* BARRE DE RECHERCHE ARCHITECTURALE CAPSULE */}
        <div className="relative z-10 max-w-4xl mx-auto w-full mt-6 sm:mt-8 px-2 sm:px-0">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 shadow-2xl border border-white/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 items-center">
            
            {/* Champ 1: Ville / Secteur */}
            <div className="flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Localisation</span>
                <select className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer w-full truncate">
                  <option>Toute la Côte d'Ivoire</option>
                  <option>Abidjan (Cocody, Yopougon, Koumassi...)</option>
                  <option>Bouaké (Gbêkê)</option>
                  <option>Yamoussoukro (Capitale)</option>
                  <option>San Pedro (Bas-Sassandra)</option>
                  <option>Daloa (Haut-Sassandra)</option>
                  <option>Korhogo (Savanes)</option>
                </select>
              </div>
            </div>

            {/* Champ 2: Type de bien */}
            <div className="flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
              <Home className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Type de bien</span>
                <select className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer w-full truncate">
                  <option>Tous les logements</option>
                  <option>Studio autonome</option>
                  <option>2 Pièces (Chambre salon)</option>
                  <option>3 Pièces familial</option>
                  <option>Maison / Pavillon avec cour</option>
                </select>
              </div>
            </div>

            {/* Champ 3: Budget maximum */}
            <div className="flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
              <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Budget max</span>
                <select className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer w-full truncate">
                  <option>Tous les budgets</option>
                  <option>≤ 20 000 FCFA / mois</option>
                  <option>≤ 35 000 FCFA / mois</option>
                  <option>≤ 50 000 FCFA / mois</option>
                  <option>≤ 80 000 FCFA / mois</option>
                  <option>≤ 150 000 FCFA / mois</option>
                </select>
              </div>
            </div>

            {/* Bouton de recherche */}
            <button
              type="button"
              onClick={() => scrollToSection('properties', 'biens')}
              className="w-full min-h-[46px] sm:h-12 lg:h-full py-2.5 sm:py-3 lg:py-0 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 sm:col-span-2 lg:col-span-1"
            >
              <Search className="w-4 h-4" />
              <span>Trouver un logement</span>
            </button>

          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 3. SECTION ÉDITORIALE "ABOUT US" (Texte Raffiné & Épuré, Zéro Couleur Criarde) */}
      {/* ========================================================================= */}
      <section id="vision" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* En-tête éditorial typographique propre et équilibré */}
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-3 mb-8 sm:mb-10">
          <span className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-slate-400">
            À PROPOS DE NOTRE MISSION
          </span>
          
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 leading-relaxed tracking-tight">
            Nous croyons que trouver le bon logement ou gérer son patrimoine doit être une expérience limpide et sécurisée. Avec une maîtrise rigoureuse du Code de la Construction et de l'AUDCG OHADA, notre plateforme apporte une conformité juridique complète, des opportunités vérifiées et un service personnalisé — pour que chaque espace devienne un véritable chez-soi.
          </h2>
        </div>

        {/* Ruban horizontal de 4 photos d'intérieurs et architecture raffinée */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 rounded-3xl overflow-hidden mb-8 sm:mb-10">
          <div className="group overflow-hidden rounded-2xl h-44 sm:h-56 lg:h-64 relative">
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
              alt="Cuisine d'architecte contemporaine"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <span className="text-white text-xs font-bold">Cuisines équipées premium</span>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl h-44 sm:h-56 lg:h-64 relative">
            <img
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80"
              alt="Espace salon lumineux et épuré"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <span className="text-white text-xs font-bold">Salons baignés de lumière</span>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl h-44 sm:h-56 lg:h-64 relative">
            <img
              src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80"
              alt="Intérieur élégant et chaleureux"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <span className="text-white text-xs font-bold">Finitions soignées</span>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl h-44 sm:h-56 lg:h-64 relative">
            <img
              src="https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80"
              alt="Terrasse et jardin paysager"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <span className="text-white text-xs font-bold">Espaces extérieurs préservés</span>
            </div>
          </div>
        </div>

        {/* Ligne de statistiques minimalistes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 sm:py-8 border-y border-slate-200/80 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              +500
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500">
              Logements certifiés audités
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              100%
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500">
              Conforme Loi n° 2019-576
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              0 FCFA
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500">
              De caution perdue ou litige
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              24h
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500">
              Délai moyen de contractualisation
            </span>
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 4. SHOWCASE DE PROPRIÉTÉS "Des logements avec une vraie personnalité" */}
      {/* ========================================================================= */}
      <section id="properties" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* Titre et sous-titre de section */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 flex flex-col items-center gap-2.5">
          <span className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-slate-400">
            NOTRE SÉLECTION CERTIFIÉE
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Des logements accessibles avec une vraie personnalité.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
            Une sélection de studios, 2 pièces et logements familiaux abordables à Abidjan, Bouaké, Yamoussoukro et partout en Côte d'Ivoire — rigoureusement vérifiés, sans commissions occultes et avec des cautions strictement protégées.
          </p>

          {/* Filtres de catégories élégants */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {[
              { id: 'all', label: 'Toute la Côte d’Ivoire' },
              { id: 'abidjan', label: 'Abidjan (Toutes communes)' },
              { id: 'interieur', label: 'Bouaké, Yamoussoukro & Intérieur' },
              { id: 'petits-prix', label: 'Petits budgets (≤ 35 000 FCFA)' },
              { id: 'famille', label: 'Logements familiaux (2-3 pièces)' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === f.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grille de 6 propriétés prestigieuses (Cartes Northvale 3x2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {filteredProperties.map((prop) => (
            <div
              key={prop.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
            >
              {/* Photo avec tag et bouton favori */}
              <div className="relative h-60 sm:h-64 overflow-hidden bg-slate-100">
                <img
                  src={prop.image}
                  alt={prop.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Badge Tag */}
                <div className="absolute top-3.5 left-3.5">
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-extrabold shadow-sm">
                    {prop.tag}
                  </span>
                </div>

                {/* Bouton Cœur Favori */}
                <button
                  type="button"
                  onClick={() => toggleLike(prop.id)}
                  className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-600 transition-colors shadow-sm"
                  title="Ajouter aux favoris"
                >
                  <Heart
                    className={`w-4 h-4 ${likedProperties[prop.id] ? 'fill-rose-500 text-rose-500' : ''}`}
                  />
                </button>

                {/* Badge de conformité Loi 2019-576 */}
                <div className="absolute bottom-3 left-3.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Caution : {prop.cautionMax}</span>
                  </span>
                </div>
              </div>

              {/* Détails du logement */}
              <div className="p-5 flex-1 flex flex-col justify-between gap-3.5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                      {prop.title}
                    </h3>
                    <span className="font-black text-sm sm:text-base text-slate-900 whitespace-nowrap">
                      {formatFCFA(prop.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-2.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{prop.location}</span>
                  </div>

                  {/* Caractéristiques (Lits, Bains, Surface) */}
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 py-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Bed className="w-4 h-4 text-slate-400" />
                      <span>{prop.beds} ch.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bath className="w-4 h-4 text-slate-400" />
                      <span>{prop.baths} sdb</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-slate-400" />
                      <span>{prop.area}</span>
                    </div>
                  </div>
                </div>

                {/* Bouton pour candidater / voir */}
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-900 text-slate-800 hover:text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <span>Candidater en 1 clic</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

              </div>

            </div>
          ))}
        </div>

        {/* Bouton "Explorer plus" (Rapproché) */}
        <div className="flex justify-center mt-8">
          <button
            type="button"
            onClick={onOpenRegister}
            className="px-7 py-2.5 rounded-full bg-[#3D231E] hover:bg-[#2B1814] text-white font-extrabold text-xs shadow-md transition-all hover:scale-105 active:scale-95"
          >
            Explorer les 500+ annonces certifiées
          </button>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 5. GRAND FEATURE ÉDITORIAL "Rapprocher les personnes de logements d'exception" */}
      {/* ========================================================================= */}
      <section className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Colonne gauche : Texte éditorial fort */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <span className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-slate-400">
              NOTRE APPROCHE
            </span>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.2]">
              Rapprocher les personnes de logements d'exception.
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Nous pensons que le bon logement est bien plus qu'une simple adresse. C'est le cadre de votre quotidien, l'écrin de votre famille et le reflet de vos ambitions.
            </p>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              C'est pourquoi LocaTrust a standardisé l'ensemble du cycle locatif ivoirien pour éliminer toute friction : contrats opposables en justice, séquestre des dépôts de garantie, quittances numériques générées automatiquement et état des lieux contradictoire.
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>Contrats de bail 41-points avec dictée vocale IA</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>Séquestre et restitution garantie des cautions</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>QR Code officiel garantissant l'authenticité des quittances</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenRegister}
                className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <span>Découvrir l'expérience LocaTrust</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Colonne droite : Grande image living room de prestige */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 relative group">
              <img
                src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85"
                alt="Salon contemporain chaleureux et lumineux"
                className="w-full h-[320px] sm:h-[400px] lg:h-[460px] object-cover group-hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-lg flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">Résidence Les Oliviers — Cocody</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Bail scellé & locataire en place sous protection LocaTrust</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                  Contrat Actif
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. CORE VALUES "Ce qui guide notre manière d'agir" (Rapproché) */}
      {/* ========================================================================= */}
      <section id="values" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 flex flex-col items-center gap-2.5">
          <span className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-slate-400">
            NOS ENGAGEMENTS
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Ce qui guide notre manière d'agir.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
            Des principes immuables pour transformer durablement l'immobilier locatif en Afrique francophone et protéger chaque partie prenante.
          </p>
        </div>

        {/* Grille 3x2 des 6 valeurs avec icônes minimalist */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          
          {/* 1. Intégrité & Loi 2019-576 */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3D231E]/10 text-[#3D231E] flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              Intégrité & Respect des Lois
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Nous appliquons à la lettre l'Article 414 de la Loi 2019-576 plafonnant strictement le dépôt de garantie à 2 mois maximum. Fini les abus de 4 à 6 mois réclamés arbitrairement.
            </p>
          </div>

          {/* 2. Expertise Juridique IA */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3D231E]/10 text-[#3D231E] flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              Dictée Vocale & IA Juridique
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Chaque propriétaire ou agence peut dicter oralement ses exigences. Notre moteur IA catégorise les clauses, cite les articles du Code de l'Habitat et produit un contrat irréprochable.
            </p>
          </div>

          {/* 3. Séquestre de Caution */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3D231E]/10 text-[#3D231E] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              Séquestre des Cautions
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Les dépôts de garantie sont tracés et consignés en toute neutralité. Le calculateur officiel déduit uniquement les factures réelles justifiées, assurant une restitution sereine.
            </p>
          </div>

          {/* 4. Authentification QR Code */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3D231E]/10 text-[#3D231E] flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              QR Code Inviolable
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Chaque contrat et quittance émis par LocaTrust porte un token cryptographique scannable publiquement par les banques, ambassades et administrations pour vérifier sa validité.
            </p>
          </div>

          {/* 5. Fluidité Mobile Money */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3D231E]/10 text-[#3D231E] flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              Paiements Locaux Intégrés
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Prise en charge native des moyens de règlement africains dominants : Wave, Orange Money, MTN Moov et virements bancaires, avec émission instantanée du reçu horodaté.
            </p>
          </div>

          {/* 6. Zéro Double Signature */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3D231E]/10 text-[#3D231E] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              Verrouillage Anti-Conflit
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Dès qu'un bailleur et son locataire finalisent un contrat, le bien est automatiquement verrouillé et les autres candidats sont prévenus courtoisement. Impossible de louer deux fois le même bien.
            </p>
          </div>

        </div>

      </section>

      {/* ========================================================================= */}
      {/* 7. GRILLE DE TARIFS SAAS LOCATRUST (Zéro Bridage • Facturation au Parc) */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 flex flex-col items-center gap-2.5">
          <span className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-slate-400">
            TRANSPARENCE TARIFAIRE & ÉQUITÉ
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            100% des outils inclus pour tous. Facturation selon votre parc.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
            Chez LocaTrust, aucune fonctionnalité n'est restreinte : propriétaire et agence bénéficient de l'intégralité du SaaS (baux IA 41-points, quittances QR Code, validation Mobile Money, exports comptables). Vous payez simplement selon le nombre réel de logements gérés.
          </p>
        </div>

        {/* Bannière explicative d'équité : Bailleur vs Agence */}
        <div className="max-w-4xl mx-auto mb-8 p-4.5 sm:p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shrink-0 shadow-md">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white">
                Mêmes fonctionnalités ouvertes pour tous • Seule la gestion multi-mandats distingue l'agence
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                Que vous ayez 1 studio ou un immeuble entier, vous profitez de tous les outils d'exportation, de génération et d'audit légal. L'agence dispose en plus de la gestion multi-mandants pour administrer des portefeuilles de tiers.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0 border border-white/10">
            Zéro bridage
          </span>
        </div>

        {/* Sélecteur interactif rapide de parc immobilier */}
        <div className="max-w-3xl mx-auto mb-10 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-md flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulez votre tarif selon vos biens</span>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900">Combien de logements avez-vous en gestion ?</h4>
            </div>
            <div className="flex items-baseline gap-1.5 bg-slate-100 px-3.5 py-1.5 rounded-2xl">
              <span className="text-xl sm:text-2xl font-black text-slate-900">{pricingPropertyCount}</span>
              <span className="text-xs font-bold text-slate-500">{pricingPropertyCount > 1 ? 'biens gérés' : 'bien géré'}</span>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={35}
            step={1}
            value={pricingPropertyCount}
            onChange={(e) => setPricingPropertyCount(Number(e.target.value))}
            className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />

          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>1 bien (500 F)</span>
            <span>2 à 10 biens (2 000 F)</span>
            <span>11 à 20 biens (5 000 F)</span>
            <span>20+ biens (10 000 F)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-xs font-bold text-amber-900">Tarif exact de votre abonnement mensuel :</span>
              <div className="text-lg sm:text-xl font-black text-amber-950">
                {pricingPropertyCount <= 1
                  ? '500 FCFA / mois'
                  : pricingPropertyCount <= 10
                  ? '2 000 FCFA / mois'
                  : pricingPropertyCount <= 20
                  ? '5 000 FCFA / mois'
                  : '10 000 FCFA / mois'}
              </div>
            </div>
            <span className="text-xs font-extrabold text-amber-800 bg-amber-200/60 px-3 py-1.5 rounded-xl">
              100% des outils débloqués
            </span>
          </div>
        </div>

        {/* Les 3 cartes de formules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7 items-stretch">
          
          {/* Formule 1: Locataire */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Locataire</span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">Preneur</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">Candidat & Locataire</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">0 FCFA</span>
                <span className="text-xs font-bold text-slate-400">/ toujours gratuit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Accès garanti et illimité à toutes les annonces vérifiées, à la signature électronique et à votre registre de quittances.
              </p>

              <div className="space-y-2.5 pt-4 border-t border-slate-100 mt-5 text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dossier KYC & candidatures certifiées</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Signature manuscrite certifiée</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Quittances avec QR code téléchargeables 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Suivi du séquestre et restitution de caution</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-colors"
            >
              Créer mon compte Locataire
            </button>
          </div>

          {/* Formule 2: Propriétaire Bailleur Particulier */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl flex flex-col justify-between gap-5 relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Bailleur Particulier</span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold text-[10px]">Selon parc</span>
              </div>
              <h3 className="text-lg font-extrabold text-white mt-1">Propriétaire Indépendant</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">Dès 500 F</span>
                <span className="text-xs font-bold text-slate-400">/ mois selon parc</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5">
                1 bien : 500 F • 2-10 biens : 2 000 F • 11-20 biens : 5 000 F • 20+ : 10 000 F.
              </p>

              <div className="space-y-2.5 pt-4 border-t border-slate-800 mt-5 text-xs text-slate-200 font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>100% des fonctionnalités ouvertes</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Baux 41-points & Dictée vocale IA sans limite</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Validation loyers Mobile Money en 1 clic</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Émission automatique de quittances PDF & QR</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Tous les exports comptables & bilans financiers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Séquestre caution & calculateur de retenues</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 text-center mt-2"
            >
              Gérer mon parc immobilier
            </button>
          </div>

          {/* Formule 3: Agence Immobilière & Gestionnaires */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm flex flex-col justify-between gap-5 md:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Professionnels</span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px]">Multi-Mandats</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">Agence & Cabinet Immo</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">Dès 10 000 F</span>
                <span className="text-xs font-bold text-slate-400">/ mois</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Idéal pour les agences agréées et gestionnaires de portefeuilles multi-propriétaires.
              </p>

              <div className="space-y-2.5 pt-4 border-t border-slate-100 mt-5 text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span><strong>100% des fonctionnalités SaaS incluses</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span><strong>Module exclusif Multi-Mandats illimité</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Ventilation & attribution des lots par mandant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Baux avec agrément d'agence & cachet RCCM</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Calcul automatisé des honoraires de gestion</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Exports comptables individuels par propriétaire</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors shadow-sm"
            >
              Créer mon compte Agence
            </button>
          </div>

        </div>

      </section>

      {/* ========================================================================= */}
      {/* 8. TÉMOIGNAGES (Bailleurs Diaspora, Locataires & Agences) */}
      {/* ========================================================================= */}
      <section className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 flex flex-col items-center gap-2.5">
            <span className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-slate-400">
              EXPÉRIENCES RÉELLES
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              Ce que disent ceux qui utilisent LocaTrust.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-5">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                « Vivant à Paris, la gestion de mes 3 villas à la Riviera 4 était un cauchemar de confiance. Avec LocaTrust, je reçois mes notifications de paiement en direct, mes baux sont inattaquables et mes quittances sont émises automatiquement. »
              </p>
              <div className="flex items-center gap-3 pt-3 border-t border-slate-200/60">
                <div className="w-9 h-9 rounded-full bg-[#3D231E] text-white flex items-center justify-center font-bold text-xs">
                  KD
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">Kouamé Desiré</h4>
                  <p className="text-[10px] text-slate-400">Bailleur Diaspora (Paris / Cocody)</p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-5">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                « Enfin une plateforme où on ne me demande pas 6 mois de loyer d'avance ! J'ai signé mon bail à Zone 4 en toute transparence, et ma caution est séquestrée avec un reçu officiel QR Code. C'est le futur de l'immobilier à Abidjan. »
              </p>
              <div className="flex items-center gap-3 pt-3 border-t border-slate-200/60">
                <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                  AT
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">Aminata Touré</h4>
                  <p className="text-[10px] text-slate-400">Locataire certifiée (Marcory Zone 4)</p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-5">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                « Notre cabinet gère plus de 45 lots à Angré et Plateau. Le générateur de contrat vocal par IA nous fait gagner des heures précieuses et garantit la conformité stricte avec l'AUDCG et la Loi 2019-576. Incontournable. »
              </p>
              <div className="flex items-center gap-3 pt-3 border-t border-slate-200/60">
                <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  CI
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">Cabinet Ivoire Immo Conseil</h4>
                  <p className="text-[10px] text-slate-400">Agence Agréée (Abidjan Plateau)</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. FORMULAIRE DE CONTACT & GUICHET NUMÉRIQUE */}
      {/* ========================================================================= */}
      <section id="contact" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-md">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5">
              Une question juridique ou un besoin d'accompagnement ?
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Notre équipe d'experts en gestion locative ivoirienne vous répond sous 15 minutes.
            </p>

            {contactSubmitted ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center flex flex-col items-center gap-2.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <h4 className="font-bold text-sm">Message bien reçu !</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Merci de nous avoir contactés. Un conseiller LocaTrust prendra contact avec vous immédiatement.
                </p>
                <button
                  type="button"
                  onClick={() => setContactSubmitted(false)}
                  className="mt-1 text-xs font-bold text-emerald-700 underline"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setContactSubmitted(true);
                  setTimeout(() => {
                    setContactName('');
                    setContactEmail('');
                    setContactMessage('');
                  }, 1000);
                }}
                className="flex flex-col gap-3.5"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Votre nom complet *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Koffi Emmanuel"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email ou WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Ex: emmanuel@gmail.com ou +225 07 00 00 00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Votre message *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Bonjour, je souhaiterais des informations sur..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-1 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer ma demande</span>
                </button>
              </form>
            )}
          </div>

          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 flex flex-col gap-3 shadow-lg">
              <div className="flex items-center gap-2">
                <img
                  src="/locatrust-official-logo.png"
                  alt="LocaTrust"
                  className="h-6 w-auto object-contain brightness-0 invert"
                />
              </div>
              <h4 className="text-sm font-bold text-white">
                Guichet Numérique Certifié
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Toutes vos démarches sont protégées sous l'égide de la Loi ivoirienne n° 2019-576. Vos données restent strictement confidentielles.
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Assistance continue 7j/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Prise en charge sous 15 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Conformité juridique certifiée</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col gap-2.5 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Sécurité & Neutralité
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                LocaTrust n'est pas un démarcheur : nous sommes l'infrastructure numérique officielle de confiance qui régule, scelle et protège vos baux locatifs.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FINAL DRAMATIC CTA BANNER */}
      {/* ========================================================================= */}
      <section className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-[#3D231E] p-7 sm:p-10 text-white shadow-2xl flex flex-col items-center text-center gap-5 relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center gap-2 max-w-2xl">
            <span className="text-[10px] sm:text-xs font-bold text-amber-300 tracking-wider uppercase">
              REJOIGNEZ LA NOUVELLE ÈRE IMMOBILIÈRE
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
              Prêt à sécuriser votre prochain bail locatif ?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Que vous soyez locataire à la recherche d'un logement sans frais abusifs, ou propriétaire désireux de protéger son bien, créez votre compte en 2 minutes.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
            >
              Créer mon compte gratuitement
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs border border-white/20 backdrop-blur-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
            >
              Se connecter à mon espace
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 11. PIED DE PAGE AVEC LOGO OFFICIEL */}
      {/* ========================================================================= */}
      <footer className="bg-slate-950 text-slate-400 py-12 sm:py-14 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <img
                  src="/locatrust-official-logo.png"
                  alt="LocaTrust"
                  className="h-8 w-auto object-contain brightness-0 invert"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Le premier SaaS de gestion locative immobilière certifiée en Afrique, garantissant la conformité stricte au Code de l'Habitat et à l'AUDCG OHADA.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <h4 className="font-bold text-white text-sm">Navigation</h4>
              <button type="button" onClick={() => scrollToSection('hero', 'accueil')} className="text-left hover:text-white transition-colors">Accueil</button>
              <button type="button" onClick={() => scrollToSection('vision', 'vision')} className="text-left hover:text-white transition-colors">Notre Vision</button>
              <button type="button" onClick={() => scrollToSection('properties', 'biens')} className="text-left hover:text-white transition-colors">Propriétés certifiées</button>
              <button type="button" onClick={() => scrollToSection('values', 'engagements')} className="text-left hover:text-white transition-colors">Engagements & Valeurs</button>
              <button type="button" onClick={() => scrollToSection('pricing', 'tarifs')} className="text-left hover:text-white transition-colors">Tarifs Bailleurs & Agences</button>
              <button type="button" onClick={() => scrollToSection('contact', 'contact')} className="text-left hover:text-white transition-colors">Contact</button>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <h4 className="font-bold text-white text-sm">Cadre Juridique</h4>
              <span className="text-slate-500">Loi n° 2019-576 du 26 juin 2019</span>
              <span className="text-slate-500">Code de la Construction et de l'Habitat</span>
              <span className="text-slate-500">Acte Uniforme OHADA (AUDCG)</span>
              <span className="text-slate-500">Plafond légal 2 mois de caution garanti</span>
              <span className="text-slate-500">Vérification cryptographique QR Code</span>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <h4 className="font-bold text-white text-sm">Assistance & Sécurité</h4>
              <span className="text-slate-500">Abidjan, République de Côte d'Ivoire</span>
              <span className="text-slate-500">Support technique disponible 7j/7</span>
              <span className="text-slate-500">Paiements : Wave, Orange, MTN, Cartes</span>
              <button type="button" onClick={onOpenLogin} className="text-left text-amber-400 font-bold hover:underline mt-1.5">
                Accéder à l'Espace Sécurisé →
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} LocaTrust. Tous droits réservés. République de Côte d'Ivoire & Espace OHADA.</p>
            <p className="font-mono text-[11px] text-slate-600">Plateforme certifiée • Inviolabilité garantie</p>
          </div>

        </div>
      </footer>

    </div>
  );
};
