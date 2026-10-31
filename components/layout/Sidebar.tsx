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
  Calendar,
  Clock
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { UserRole } from '@/types/database.types';
import { getActiveUser } from '@/lib/authStore';
import { useAuth } from '@/src/context/AuthContext';
import { getUnreadMessagesCountForUser, markAllMessagesAsReadForUser } from '@/lib/messagingStore';

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
  const { user, profile } = useAuth();
  const effectiveRole: UserRole = (currentRole === 'admin' || profile?.role === 'admin')
    ? 'admin'
    : (profile?.account_type ? (profile.account_type as UserRole) : currentRole);
  const isProprietaire = effectiveRole === 'proprietaire';
  const isAgence = effectiveRole === 'agence';
  const isLocataire = effectiveRole === 'locataire';
  const isAdmin = effectiveRole === 'admin';

  const getInitials = (name?: string, email?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.trim().slice(0, 2).toUpperCase();
    }
    return 'LT';
  };

  const [avatarUrl, setAvatarUrl] = React.useState<string>(() => {
    const profAvatar = profile?.avatar_url;
    if (profAvatar) return profAvatar;
    if (typeof window !== 'undefined') {
      const stored = (user?.id && localStorage.getItem(`locatrust_user_avatar_${user.id}`)) || localStorage.getItem('locatrust_user_avatar');
      if (stored) return stored;
    }
    return '';
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

  React.useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  // Calcul dynamique des badges réels (données réelles de la base uniquement)
  const [appCount, setAppCount] = React.useState<number>(0);
  const [msgCount, setMsgCount] = React.useState<number>(0);
  const [contractCount, setContractCount] = React.useState<number>(0);
  const [cautionPendingCount, setCautionPendingCount] = React.useState<number>(0);

  React.useEffect(() => {
    const updateCounts = () => {
      try {
        const appsRaw = localStorage.getItem('locatrust_rental_applications');
        let countApps = 0;
        if (appsRaw) {
          const apps = JSON.parse(appsRaw);
          if (Array.isArray(apps)) {
            const validApps = apps.filter((a: any) => a.id !== 'app_kwame' && a.id !== 'app_moussa' && a.id !== 'app_awa' && a.id !== 'app_bamba');
            if (isLocataire) {
              const myApps = validApps.filter((a: any) => 
                ((user?.email && a.tenant_email?.toLowerCase() === user.email.toLowerCase()) ||
                 (user?.id && a.tenant_id === user.id)) &&
                a.status !== 'refusee'
              );
              // Deduplicate by property_id to guarantee one count per real property demanded (Points 14, 15, 16)
              const uniqueProperties = new Set(myApps.map((a: any) => a.property_id || a.id));
              countApps = uniqueProperties.size;
            } else if (isProprietaire || isAgence) {
              countApps = validApps.filter((a: any) =>
                a.status === 'en_attente' &&
                (!user?.id || a.owner_id === user.id || a.agency_id === user.id || a.property_owner_id === user.id)
              ).length;
            }
          }
        }
        setAppCount(countApps);

        const contractsRaw = localStorage.getItem('locatrust_contracts');
        let countContracts = 0;
        if (contractsRaw) {
          const cnts = JSON.parse(contractsRaw);
          if (Array.isArray(cnts)) {
            if (isLocataire) {
              countContracts = cnts.filter((c: any) =>
                (user?.email && (c.tenant?.email?.toLowerCase() === user.email.toLowerCase() || c.tenant_email?.toLowerCase() === user.email.toLowerCase())) ||
                (user?.id && (c.tenant_id === user.id || c.tenant?.id === user.id))
              ).length;
            } else if (isProprietaire || isAgence) {
              countContracts = cnts.filter((c: any) =>
                c.status === 'actif' &&
                (!user?.id || c.owner_id === user.id || c.agency_id === user.id || c.owner?.id === user.id)
              ).length;
            }
          }
        }
        setContractCount(countContracts);

        // Cautions awaiting tenant signature or owner verification
        let countCautions = 0;
        const cautionsRaw = localStorage.getItem('locatrust_caution_deposits');
        if (cautionsRaw) {
          const cList = JSON.parse(cautionsRaw);
          if (Array.isArray(cList)) {
            if (isLocataire) {
              countCautions = cList.filter((c: any) =>
                (c.owner_signature || c.confirmed_by) && !c.tenant_signature && (c.amount_paid > 0 || c.status === 'paye_complet' || c.status === 'caution_confirmee')
              ).length;
            } else if (isProprietaire || isAgence) {
              countCautions = cList.filter((c: any) =>
                c.status === 'en_attente_verification' || c.status === 'declare_paye'
              ).length;
            }
          }
        }
        setCautionPendingCount(countCautions);

        const countMsgs = getUnreadMessagesCountForUser(
          user ? { id: user.id, email: user.email, role: user.role || currentRole } : { role: currentRole }
        );
        setMsgCount(countMsgs);
      } catch (e) {
        setAppCount(0);
        setMsgCount(0);
        setContractCount(0);
        setCautionPendingCount(0);
      }
    };

    updateCounts();
    window.addEventListener('locatrust:applications-updated', updateCounts);
    window.addEventListener('locatrust:contracts-updated', updateCounts);
    window.addEventListener('locatrust:messages_updated', updateCounts);
    window.addEventListener('locatrust:messages-updated', updateCounts);
    window.addEventListener('locatrust:cautions_updated', updateCounts);
    return () => {
      window.removeEventListener('locatrust:applications-updated', updateCounts);
      window.removeEventListener('locatrust:contracts-updated', updateCounts);
      window.removeEventListener('locatrust:messages_updated', updateCounts);
      window.removeEventListener('locatrust:messages-updated', updateCounts);
      window.removeEventListener('locatrust:cautions_updated', updateCounts);
    };
  }, [user, isLocataire, isProprietaire, isAgence]);

  // 1. LOCATAIRE SPECIFIC NAVIGATION
  const tenantItems = [
    { id: 'feed', name: "Fil d'actualité", icon: LayoutDashboard },
    { id: 'favorites', name: 'Favoris', icon: Heart },
    { id: 'applications', name: 'Demandes', icon: Eye, badge: appCount > 0 ? appCount : undefined },
    { id: 'messages', name: 'Messages', icon: MessageSquare, badge: msgCount > 0 ? msgCount : undefined },
    { id: 'visits', name: 'Visites', icon: Calendar },
    { id: 'contracts', name: 'Contrats', icon: FileText, badge: contractCount > 0 ? contractCount : undefined },
    { id: 'payments', name: 'Paiements', icon: CreditCard },
    { id: 'receipts', name: 'Reçus', icon: Receipt },
    { id: 'guarantees', name: 'Cautions', icon: ShieldCheck, badge: cautionPendingCount > 0 ? cautionPendingCount : undefined },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench },
    { id: 'profile', name: 'Mon profil', icon: UserIcon },
    { id: 'settings', name: 'Paramètres', icon: Settings },
    { id: 'support', name: 'Aide & Support', icon: HelpCircle },
  ];

  // 2. ADMIN SPECIFIC NAVIGATION (Fil d'actualité & Paramètres uniquement)
  const adminItems = [
    { id: 'supervision', name: "Fil d'actualité", icon: LayoutDashboard },
    { id: 'settings', name: 'Paramètres', icon: Settings },
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
    { id: 'applications', name: 'Demandes de location', icon: Eye, badge: appCount > 0 ? appCount : undefined },
    { id: 'contracts', name: 'Contrats', icon: FileText, badge: contractCount > 0 ? contractCount : undefined },
    { id: 'payments', name: 'Paiements & Loyers', icon: CreditCard },
    { id: 'guarantees', name: 'Cautions', icon: ShieldCheck, badge: cautionPendingCount > 0 ? cautionPendingCount : undefined },
    { id: 'messages', name: 'Messagerie', icon: MessageSquare, badge: msgCount > 0 ? msgCount : undefined },
    { id: 'visits', name: 'Visites', icon: Calendar },
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

  const activeUser = typeof window !== 'undefined' ? getActiveUser() : null;
  const isVerified = profile?.verification_status === 'verifie' || activeUser?.verification_status === 'verifie';

  const getProfileName = () => {
    if (isAdmin) return profile?.full_name || user?.user_metadata?.full_name || 'Administrateur LocaTrust';
    if (profile?.full_name) return profile.full_name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (activeUser?.full_name) return activeUser.full_name;
    if (user?.email) return user.email.split('@')[0];
    if (isAgence) return 'Mon Agence';
    if (isLocataire) return 'Locataire';
    return "Bailleur";
  };

  const getProfileSubtext = () => {
    if (isAdmin) return 'Administrateur';
    if (isAgence) return isVerified ? 'Agence Agréée' : 'Agence Immobilière';
    if (isLocataire) return isVerified ? 'Locataire Certifié' : 'Locataire';
    return isVerified ? 'Propriétaire Certifié' : 'Propriétaire';
  };

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col bg-[#0B192C] text-slate-300 h-screen sticky top-0 border-r border-slate-800 p-4 select-none overflow-hidden">

      {/* Top Logo */}
      <div className="px-2 py-3 mb-4 border-b border-slate-800/80">
        <Logo size="md" variant="dark" align="left" showSubtitle={true} />
      </div>

      {/* User / Agency Profile Card Header */}
      <div 
        onClick={() => onSelectTab?.('settings')}
        className="flex items-center gap-3 px-3 py-2.5 mb-6 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all hover:bg-slate-850 group select-none shadow-sm"
        title="Accéder aux paramètres de mon compte"
      >
        <div className="relative shrink-0">
          {avatarUrl && !avatarUrl.includes('images.unsplash.com') ? (
            <img
              src={avatarUrl}
              alt={getProfileName()}
              className={`w-10 h-10 rounded-full object-cover border-2 ${isVerified ? 'border-emerald-500' : 'border-slate-600'}`}
            />
          ) : (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center border-2 shadow-sm shrink-0 select-none ${isVerified ? 'border-emerald-500' : 'border-slate-700'}`}>
              {getInitials(getProfileName(), user?.email)}
            </div>
          )}
          <span className={`absolute bottom-0 right-0 w-3 h-3 ${isVerified ? 'bg-emerald-500' : 'bg-slate-400'} border-2 border-[#0B192C] rounded-full`} />
        </div>
        <div className="flex flex-col text-left overflow-hidden flex-1 min-w-0">
          <span className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
            {getProfileName()}
          </span>
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${isVerified ? 'text-emerald-400' : 'text-slate-400'}`}>
            {isVerified && (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
            )}
            {getProfileSubtext()}
          </span>
        </div>
        <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
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
          /* CAS 2: SUPER ADMIN (Fil d'actualité & Paramètres) */
          <div className="flex flex-col gap-1">
            <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-purple-400">
              Administration Système
            </span>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || 
                (item.id === 'supervision' && (activeTab === 'overview' || activeTab === 'supervision' || activeTab === 'verifications' || activeTab === 'disputes' || activeTab === 'users' || activeTab === 'subscriptions' || activeTab === 'support'));

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
                    onClick={() => {
                      onSelectTab?.(item.id);
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
        <div className="flex flex-col gap-1.5 mt-1">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('locatrust:open_pwa_install'));
              }
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold text-center border border-slate-700/80 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Installer l'application</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenSupport) {
                onOpenSupport();
              } else if (onSelectTab) {
                onSelectTab('support');
              } else if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('locatrust:open_support'));
              }
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold text-center shadow-sm shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Centre d'aide</span>
          </button>
        </div>
      </div>



    </aside>
  );
};

