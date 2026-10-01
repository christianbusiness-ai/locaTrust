'use client';

import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  CreditCard,
  ShieldCheck,
  Receipt,
  Eye,
  Wrench,
  MessageSquare,
  BarChart3,
  Download,
  Settings,
  Folder,
  Wallet,
  CheckCircle2,
  LifeBuoy,
  UserPlus,
  Briefcase,
  History,
  Heart,
  Search,
  Bell,
  User as UserIcon,
  HelpCircle,
  FileCheck,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { UserRole } from '@/types/database.types';

interface SidebarProps {
  currentRole: UserRole;
  activeTab?: string;
  onSelectTab?: (tabId: string) => void;
  onOpenSupport?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  activeTab = 'overview',
  onSelectTab,
  onOpenSupport,
}) => {
  const isProprietaire = currentRole === 'proprietaire';
  const isAgence = currentRole === 'agence';
  const isLocataire = currentRole === 'locataire';
  const isAdmin = currentRole === 'admin';

  const [avatarUrl, setAvatarUrl] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('locatrust_user_avatar');
      if (stored) return stored;
    }
    if (isAgence) {
      return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80';
    }
    if (isLocataire) {
      return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    }
    if (isAdmin) {
      return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80';
    }
    return 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80';
  });

  React.useEffect(() => {
    const handleAvatarUpdated = (e: any) => {
      if (e.detail?.avatarUrl) {
        setAvatarUrl(e.detail.avatarUrl);
      }
    };
    window.addEventListener('locatrust:avatar_updated', handleAvatarUpdated);
    return () => window.removeEventListener('locatrust:avatar_updated', handleAvatarUpdated);
  }, []);

  // 1. LOCATAIRE SPECIFIC NAVIGATION (Fidèle à l'image fournie)
  // Supprime complètement: Dashboard, Rapports, Export comptable, Abonnement SaaS
  const tenantItems = [
    { id: 'feed', name: "Fil d'actualité", icon: LayoutDashboard },
    { id: 'search', name: 'Rechercher', icon: Search },
    { id: 'favorites', name: 'Favoris', icon: Heart },
    { id: 'applications', name: 'Demandes', icon: Eye, badge: 2 },
    { id: 'messages', name: 'Messages', icon: MessageSquare, badge: 5 },
    { id: 'visits', name: 'Visites', icon: Calendar },
    { id: 'contracts', name: 'Contrats', icon: FileText },
    { id: 'payments', name: 'Paiements', icon: CreditCard },
    { id: 'receipts', name: 'Reçus', icon: Receipt },
    { id: 'guarantees', name: 'Cautions', icon: ShieldCheck },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'profile', name: 'Mon profil', icon: UserIcon },
    { id: 'settings', name: 'Paramètres', icon: Settings },
    { id: 'support', name: 'Aide & Support', icon: HelpCircle },
  ];

  // 2. ADMIN SPECIFIC NAVIGATION (Point 9 du prompt : ne pas copier celui du propriétaire)
  const adminItems = [
    { id: 'supervision', name: 'Supervision globale', icon: BarChart3 },
    { id: 'users', name: 'Gestion utilisateurs', icon: Users },
    { id: 'subscriptions', name: 'Gestion abonnements', icon: CreditCard },
    { id: 'verifications', name: 'Queue CNI & RCCM', icon: FileCheck, badge: 3 },
    { id: 'disputes', name: 'Litiges & Fraude', icon: ShieldAlert },
    { id: 'settings', name: 'Paramètres système', icon: Settings },
  ];

  // 3. OWNER / AGENCY NAVIGATION
  const dashboardItems = [
    { id: 'overview', name: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'properties', name: isAgence ? 'Parc Immobilier' : 'Biens immobiliers', icon: Building2 },
    ...(isAgence
      ? [
        { id: 'owners', name: 'Bailleurs Mandants', icon: UserPlus },
        { id: 'team', name: 'Équipe Agence', icon: Briefcase },
      ]
      : []),
    { id: 'tenants', name: 'Locataires', icon: Users },
    { id: 'applications', name: 'Demandes de location', icon: Eye, badge: 8 },
    { id: 'contracts', name: 'Contrats', icon: FileText, badge: 5 },
    { id: 'payments', name: 'Paiements & Loyers', icon: CreditCard },
    { id: 'guarantees', name: 'Cautions', icon: ShieldCheck },
    { id: 'messages', name: 'Messagerie', icon: MessageSquare, badge: 6 },
    { id: 'visits', name: 'Demandes de visite', icon: Eye },
    { id: 'documents', name: 'Documents', icon: Folder },
    { id: 'receipts', name: 'Reçus & Quittances', icon: Receipt },
    { id: 'history', name: 'Historique général', icon: History },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench },
    { id: 'bank_accounts', name: 'Comptes de paiement', icon: Wallet },
  ];

  const reportItems = [
    { id: 'stats', name: 'Rapports & Statistiques', icon: BarChart3 },
    { id: 'exports', name: 'Exports comptables', icon: Download },
  ];

  const settingItems = [
    { id: 'subscription', name: 'Abonnement SaaS', icon: CreditCard },
    { id: 'settings', name: 'Paramètres', icon: Settings },
  ];

  const getProfileName = () => {
    if (isAgence) return 'Immobilière du Golf';
    if (isLocataire) return "Koffi N'Guessan";
    if (isAdmin) return 'Super Administrateur';
    return "Koffi N'Guessan";
  };

  const getProfileSubtext = () => {
    if (isAgence) return 'Agence Agréée';
    if (isLocataire) return 'Locataire';
    if (isAdmin) return 'Superviseur Système';
    return 'Propriétaire vérifié';
  };

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col bg-[#0B192C] text-slate-300 h-screen sticky top-0 border-r border-slate-800 p-4 select-none overflow-hidden">

      {/* Top Logo */}
      <div className="px-2 py-3 mb-4 border-b border-slate-800/80">
        <Logo size="md" variant="dark" showSubtitle={true} />
      </div>

      {/* User / Agency Profile Card Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 mb-6 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="relative shrink-0">
          <img
            src={avatarUrl}
            alt={getProfileName()}
            className="w-10 h-10 rounded-full object-cover border-2 border-amber-500"
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B192C] rounded-full" />
        </div>
        <div className="flex flex-col text-left overflow-hidden">
          <span className="text-xs font-bold text-white truncate">
            {getProfileName()}
          </span>
          <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-amber-400 fill-amber-400/20" />
            {getProfileSubtext()}
          </span>
        </div>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1 scrollbar-thin">

        {/* CAS 1: LOCATAIRE (Exact match à l'image) */}
        {isLocataire ? (
          <div className="flex flex-col gap-1">
            {tenantItems.map((item) => {
              const Icon = item.icon;
              const isActive = (activeTab === item.id) || (item.id === 'feed' && activeTab === 'overview');

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'support' && onOpenSupport) {
                      onOpenSupport();
                    } else {
                      onSelectTab?.(item.id);
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 whitespace-nowrap ${isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${isActive ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : isAdmin ? (
          /* CAS 2: SUPER ADMIN (Menu administration dédié - Point 9) */
          <div className="flex flex-col gap-1">
            <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-purple-400">
              Administration Système
            </span>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'supervision' && activeTab === 'overview');

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab?.(item.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 whitespace-nowrap ${isActive
                      ? 'bg-purple-700 text-white font-bold shadow-lg shadow-purple-700/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${isActive ? 'bg-white text-purple-800' : 'bg-amber-500 text-slate-950'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* CAS 3: PROPRIÉTAIRE & AGENCE IMMOBILIÈRE */
          <>
            {/* TABLEAU DE BORD */}
            <div className="flex flex-col gap-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {isAgence ? 'Gestion Agence' : 'Tableau de bord'}
              </span>
              {dashboardItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab?.(item.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 whitespace-nowrap ${isActive
                        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${isActive ? 'bg-white text-blue-700' : 'bg-amber-500 text-slate-950'
                          }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* RAPPORTS */}
            <div className="flex flex-col gap-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Rapports
              </span>
              {reportItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab?.(item.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 whitespace-nowrap ${isActive
                        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PARAMÈTRES */}
            <div className="flex flex-col gap-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Paramètres
              </span>
              {settingItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab?.(item.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 whitespace-nowrap ${isActive
                        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

      </div>

      {/* Need Help Card (Fidèle à l'image: "Besoin d'aide ? Consultez notre centre d'aide" -> "Centre d'aide") */}
      <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 border border-blue-800/40 flex flex-col gap-2 shadow-lg">
        <div className="flex items-center justify-between text-white font-bold text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400">
              <LifeBuoy className="w-3 h-3" />
            </div>
            <span className="text-[11px] font-extrabold">Besoin d'aide ?</span>
          </div>
          <span className="text-[9px] text-amber-400 font-semibold">7j/7</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          Consultez notre centre d'aide et assistance LocaTrust.
        </p>
        <button
          onClick={onOpenSupport}
          className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold text-center shadow-sm shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Centre d'aide</span>
        </button>
      </div>

    </aside>
  );
};

