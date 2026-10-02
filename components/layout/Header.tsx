'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Moon,
  Sun,
  MessageSquare,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  CheckCircle2,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  User,
  Settings,
  LifeBuoy,
  LogOut,
  X,
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Eye,
  BarChart3,
  Download,
  Folder,
  Wallet,
  History,
  Briefcase,
  UserPlus,
  Heart,
  HelpCircle
} from 'lucide-react';
import { User as UserType } from '@/types/database.types';
import { Logo } from '@/components/common/Logo';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: 'demande' | 'visite' | 'paiement' | 'contrat' | 'caution' | 'maintenance' | 'abonnement';
  read: boolean;
  targetTab: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    title: 'Nouvelle demande de location',
    description: 'Kouadio Jean a envoyé un dossier complet pour Appartement 3 pièces Cocody.',
    timestamp: 'Il y a 10 min',
    category: 'demande',
    read: false,
    targetTab: 'applications'
  },
  {
    id: 'notif_2',
    title: 'Demande de visite reçue',
    description: 'Amina Diabaté souhaite visiter la Villa 4 pièces le samedi 28/09 à 15h00.',
    timestamp: 'Il y a 45 min',
    category: 'visite',
    read: false,
    targetTab: 'visits'
  },
  {
    id: 'notif_3',
    title: 'Paiement de loyer à valider',
    description: 'Koffi N\'Guessan a déclaré son loyer d\'Août (150 000 FCFA via Orange Money).',
    timestamp: 'Il y a 2h',
    category: 'paiement',
    read: false,
    targetTab: 'payments'
  },
  {
    id: 'notif_4',
    title: 'Contrat de bail prêt à signer',
    description: 'Le locataire a apposé sa signature manuscrite sur le contrat LT-2026-CI-000492.',
    timestamp: 'Il y a 4h',
    category: 'contrat',
    read: true,
    targetTab: 'contracts'
  },
  {
    id: 'notif_5',
    title: 'Demande de maintenance signalée',
    description: 'Fuite légère sous l\'évier de la cuisine - Appartement Riviera Bonoumin.',
    timestamp: 'Hier',
    category: 'maintenance',
    read: true,
    targetTab: 'maintenance'
  },
  {
    id: 'notif_6',
    title: 'Abonnement LocaTrust actif',
    description: 'Votre formule 2 à 10 biens (2 000 FCFA/mois) est à jour. Prochaine échéance le 30/10.',
    timestamp: 'Il y a 2 jours',
    category: 'abonnement',
    read: true,
    targetTab: 'subscription'
  }
];

const TENANT_INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_t1',
    title: 'Nouvelle quittance certifiée disponible',
    description: 'Votre quittance de loyer d\'Août 2026 (150 000 FCFA) est disponible avec son QR Code officiel.',
    timestamp: 'Il y a 10 min',
    category: 'paiement',
    read: false,
    targetTab: 'receipts'
  },
  {
    id: 'notif_t2',
    title: 'Paiement Wave validé par le bailleur',
    description: 'Votre virement de 150 000 FCFA pour le loyer d\'Août 2026 a été confirmé et validé avec succès.',
    timestamp: 'Il y a 2h',
    category: 'paiement',
    read: false,
    targetTab: 'payments'
  },
  {
    id: 'notif_t3',
    title: 'Contrat de bail certifié et contresigné',
    description: 'Votre contrat de location pour Appartement 3 pièces Cocody Riviera 3 est validé et actif.',
    timestamp: 'Hier',
    category: 'contrat',
    read: true,
    targetTab: 'contracts'
  },
  {
    id: 'notif_t4',
    title: 'Séquestre de caution sécurisé',
    description: 'Votre caution légale de 300 000 FCFA est conservée sur le compte séquestre certifié LocaTrust.',
    timestamp: 'Il y a 3 jours',
    category: 'caution',
    read: true,
    targetTab: 'guarantees'
  },
  {
    id: 'notif_t5',
    title: 'Intervention de maintenance programmée',
    description: 'L\'artisan mandaté par votre bailleur interviendra le jeudi 15 à 14h30 pour révision plomberie.',
    timestamp: 'Il y a 4 jours',
    category: 'maintenance',
    read: true,
    targetTab: 'maintenance'
  }
];

interface HeaderProps {
  currentUser: UserType;
  onSearch?: (term: string) => void;
  onOpenMessages?: () => void;
  onOpenNotifications?: () => void;
  onToggleSidebar?: () => void;
  onNavigateTab?: (tabId: string) => void;
  onOpenRegisterModal?: () => void;
  onExitToLanding?: () => void;
  showCreateAccountBtn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSearch,
  onOpenMessages,
  onOpenNotifications,
  onToggleSidebar,
  onNavigateTab,
  onOpenRegisterModal,
  onExitToLanding,
  showCreateAccountBtn = false,
}) => {
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return currentUser.role === 'locataire' ? TENANT_INITIAL_NOTIFICATIONS : INITIAL_NOTIFICATIONS;
  });
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [avatarUrl, setAvatarUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('locatrust_user_avatar') || currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    }
    return currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
  });

  // Initialize theme and avatar listener from localStorage
  useEffect(() => {
    const handleAvatarUpdated = (e: any) => {
      if (e.detail?.avatarUrl) {
        setAvatarUrl(e.detail.avatarUrl);
      }
    };
    window.addEventListener('locatrust:avatar_updated', handleAvatarUpdated);

    const savedTheme = localStorage.getItem('locatrust_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    const loadStoredNotifs = () => {
      try {
        const raw = localStorage.getItem('locatrust_notifications');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotifications(parsed);
          }
        }
      } catch (e) {
        console.warn('Error reading notifications:', e);
      }
    };
    loadStoredNotifs();

    const handleNotifsUpdated = (e: any) => {
      if (e.detail?.notifications && Array.isArray(e.detail.notifications)) {
        setNotifications(e.detail.notifications);
      } else {
        loadStoredNotifs();
      }
    };
    window.addEventListener('locatrust:notifications-updated', handleNotifsUpdated);

    return () => {
      window.removeEventListener('locatrust:avatar_updated', handleAvatarUpdated);
      window.removeEventListener('locatrust:notifications-updated', handleNotifsUpdated);
    };
  }, []);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('locatrust_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('locatrust_theme', 'light');
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem('locatrust_notifications', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === item.id ? { ...n, read: true } : n));
      try {
        localStorage.setItem('locatrust_notifications', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
    setShowNotifications(false);
    setSelectedNotification(item);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-3 sm:px-4 lg:px-8 py-2 sm:py-2.5 transition-colors">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={() => {
            setIsMobileMenuOpen(true);
            onToggleSidebar?.();
          }}
          aria-label="Ouvrir le menu principal de navigation"
          className="lg:hidden min-w-[38px] min-h-[38px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Left Section: LocaTrust Logo & Global Search Bar */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-2xl">
          <div className="shrink-0 flex items-center">
            <Logo size="sm" variant={isDarkMode ? 'dark' : 'light'} showSubtitle={false} />
          </div>

          {/* Global Search Bar (visible on md+) */}
          <div className="relative flex-1 hidden md:block max-w-xl">
            <input
              type="text"
              placeholder="Rechercher locataire, bien, contrat, référence..."
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full bg-slate-100/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full py-2 pl-9 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Right Section: Action Controls & User Profile Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
          
          {/* Mobile Search Toggle Button (visible on < md) */}
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen((prev) => !prev)}
            aria-label="Rechercher"
            className="md:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="Rechercher"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Bouton unique "Créer un compte" - affiché uniquement si demandé (ex: landing) */}
          {showCreateAccountBtn && (
            <button
              type="button"
              id="header-create-account-btn"
              onClick={() => {
                if (onOpenRegisterModal) {
                  onOpenRegisterModal();
                } else if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('locatrust_open_register'));
                }
              }}
              className="px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 shrink-0"
              title="Créer un nouveau compte LocaTrust"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">Créer un compte</span>
              <span className="sm:hidden text-[10px]">+ Compte</span>
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Messages Button */}
          <button
            type="button"
            onClick={() => {
              setShowNotifications(false);
              setSelectedNotification(null);
              if (onOpenMessages) onOpenMessages();
              if (onNavigateTab) onNavigateTab('messages');
            }}
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="Messagerie"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-900">
              2
            </span>
          </button>

          {/* Notifications Button with Dropdown Panel */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-fadeIn">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Notifications LocaTrust
                    </h3>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                        item.read
                          ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        {item.category === 'demande' && <FileText className="w-4 h-4" />}
                        {item.category === 'visite' && <Calendar className="w-4 h-4" />}
                        {item.category === 'paiement' && <CreditCard className="w-4 h-4" />}
                        {item.category === 'contrat' && <CheckCircle2 className="w-4 h-4" />}
                        {item.category === 'caution' && <ShieldCheck className="w-4 h-4" />}
                        {item.category === 'maintenance' && <Wrench className="w-4 h-4" />}
                        {item.category === 'abonnement' && <AlertTriangle className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${item.read ? 'font-bold text-slate-800 dark:text-slate-200' : 'font-black text-blue-900 dark:text-blue-300'}`}>
                            {item.title}
                          </span>
                          <span className="text-[9px] text-slate-400 shrink-0 ml-2">{item.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigateTab?.('notifications');
                    }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Voir toutes les notifications &raquo;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill Header with Dropdown */}
          <div className="relative" ref={profileRef}>
            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 sm:gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-800 cursor-pointer group shrink-0"
            >
              <img
                src={avatarUrl}
                alt={currentUser.full_name}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-blue-600/30 group-hover:ring-blue-600 transition-all shrink-0"
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[120px]">
                  {currentUser.full_name}
                </span>
                <span className="text-[10px] text-amber-500 font-extrabold capitalize truncate max-w-[120px]">
                  {currentUser.role === 'proprietaire' ? 'Propriétaire Vérifié' : currentUser.role === 'agence' ? 'Agence Agréée' : 'Locataire Vérifié'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors hidden md:block shrink-0" />
            </div>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-56 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-fadeIn text-xs">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-extrabold text-slate-900 dark:text-white block">{currentUser.full_name}</span>
                  <span className="text-[10px] text-slate-400">{currentUser.email || 'koffi.nguessan@locatrust.ci'}</span>
                </div>

                {currentUser.role === 'locataire' ? (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('profile');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Mon Compte & Profil</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('notifications');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <Bell className="w-4 h-4 text-slate-500" />
                      <span>Mes Notifications</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('settings');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Paramètres</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('support');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      <span>Aide & Support</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('settings');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Paramètres du compte</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('subscription');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      <span>Mon Abonnement SaaS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('bank_accounts');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <ShieldCheck className="w-4 h-4 text-slate-500" />
                      <span>Compte de paiement</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateTab?.('support');
                      }}
                      className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center gap-2.5"
                    >
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      <span>Aide & Support</span>
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onExitToLanding) {
                        onExitToLanding();
                      } else if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('locatrust_exit_landing'));
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Se déconnecter (Sortir vers la Landing Page)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Expandable Mobile Search Bar (shows when toggled on mobile) */}
      {isMobileSearchOpen && (
        <div className="max-w-[1600px] mx-auto mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 md:hidden animate-fadeIn">
          <div className="relative w-full">
            <input
              type="text"
              autoFocus
              placeholder="Rechercher locataire, bien, contrat, référence..."
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-9 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(false)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Détail de la notification */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                  {selectedNotification.category === 'demande' && <FileText className="w-5 h-5" />}
                  {selectedNotification.category === 'visite' && <Calendar className="w-5 h-5" />}
                  {selectedNotification.category === 'paiement' && <CreditCard className="w-5 h-5" />}
                  {selectedNotification.category === 'contrat' && <CheckCircle2 className="w-5 h-5" />}
                  {selectedNotification.category === 'caution' && <ShieldCheck className="w-5 h-5" />}
                  {selectedNotification.category === 'maintenance' && <Wrench className="w-5 h-5" />}
                  {selectedNotification.category === 'abonnement' && <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">{selectedNotification.title}</h3>
                  <span className="text-[11px] text-slate-400">{selectedNotification.timestamp}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 flex flex-col gap-2">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Message intégral
              </span>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm leading-relaxed font-semibold text-slate-800 dark:text-slate-100">
                {selectedNotification.description}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedNotification.targetTab;
                  setSelectedNotification(null);
                  if (onNavigateTab) onNavigateTab(target);
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all"
              >
                <span>
                  {selectedNotification.category === 'demande' && 'Consulter le dossier candidat'}
                  {selectedNotification.category === 'visite' && 'Voir la demande de visite'}
                  {selectedNotification.category === 'paiement' && 'Vérifier le paiement'}
                  {selectedNotification.category === 'contrat' && 'Consulter le contrat'}
                  {selectedNotification.category === 'maintenance' && 'Ouvrir le ticket'}
                  {selectedNotification.category === 'abonnement' && 'Voir mon abonnement'}
                  {!['demande', 'visite', 'paiement', 'contrat', 'maintenance', 'abonnement'].includes(selectedNotification.category) && 'Accéder à la section'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MOBILE DRAWER NAVIGATION */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-fadeIn" role="dialog" aria-modal="true">
          {/* Backdrop with click to close */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Slide-out drawer panel */}
          <div className="relative w-[85vw] max-w-sm bg-[#0B192C] text-slate-200 h-full flex flex-col shadow-2xl z-10 border-r border-slate-800">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <Logo size="sm" variant="dark" showSubtitle={true} />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Fermer le menu"
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* User profile card */}
            <div className="p-3.5 mx-3 mt-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
              <img
                src={avatarUrl}
                alt={currentUser.full_name || currentUser.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-500 shrink-0"
              />
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-white block truncate">{currentUser.full_name || currentUser.name}</span>
                <span className="text-[11px] text-amber-400 font-semibold capitalize flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {currentUser.role === 'agence' ? 'Agence Immobilière' : currentUser.role === 'proprietaire' ? 'Propriétaire certifié' : 'Locataire vérifié'}
                  </span>
                </span>
              </div>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
              
              {/* CAS 1: LOCATAIRE (Fidèle à 100% au mobile - AUCUN rapport, AUCUN export, AUCUN bien immo, AUCUN dashboard) */}
              {currentUser.role === 'locataire' ? (
                <div className="flex flex-col gap-1">
                  <span className="px-3 text-[10px] font-black uppercase tracking-wider text-blue-400">
                    Espace Locataire
                  </span>

                  {[
                    { id: 'feed', name: "Fil d'actualité", icon: LayoutDashboard },
                    { id: 'search', name: 'Rechercher un logement', icon: Search },
                    { id: 'favorites', name: 'Mes Favoris', icon: Heart },
                    { id: 'applications', name: 'Mes Demandes', icon: Eye, badge: 2 },
                    { id: 'messages', name: 'Messagerie', icon: MessageSquare, badge: 5 },
                    { id: 'visits', name: 'Mes Visites', icon: Calendar },
                    { id: 'contracts', name: 'Mon Contrat de bail', icon: FileText },
                    { id: 'payments', name: 'Paiements & Loyers', icon: CreditCard },
                    { id: 'receipts', name: 'Mes Quittances & Reçus', icon: Receipt },
                    { id: 'guarantees', name: 'Séquestre Caution', icon: ShieldCheck },
                    { id: 'maintenance', name: 'Maintenance & Pannes', icon: Wrench },
                    { id: 'notifications', name: 'Notifications', icon: Bell },
                    { id: 'profile', name: 'Mon Compte & Profil', icon: User },
                    { id: 'settings', name: 'Paramètres', icon: Settings },
                    { id: 'support', name: 'Aide & Support', icon: HelpCircle },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onNavigateTab?.(item.id);
                        }}
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : currentUser.role === 'admin' ? (
                /* CAS 2: ADMIN */
                <div className="flex flex-col gap-1">
                  <span className="px-3 text-[10px] font-black uppercase tracking-wider text-purple-400">
                    Administration Système
                  </span>
                  {[
                    { id: 'supervision', name: 'Supervision globale', icon: BarChart3 },
                    { id: 'users', name: 'Gestion utilisateurs', icon: Users },
                    { id: 'subscriptions', name: 'Gestion abonnements', icon: CreditCard },
                    { id: 'verifications', name: 'Queue CNI & RCCM', icon: FileText, badge: 3 },
                    { id: 'disputes', name: 'Litiges & Fraude', icon: ShieldCheck },
                    { id: 'settings', name: 'Paramètres système', icon: Settings },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onNavigateTab?.(item.id);
                        }}
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between text-slate-300 hover:bg-purple-600/20 hover:text-white active:bg-purple-600 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* CAS 3: PROPRIETAIRE & AGENCE */
                <>
                  <div className="flex flex-col gap-1">
                    <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {currentUser.role === 'agence' ? 'Gestion Agence' : 'Tableau de bord'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('overview');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <LayoutDashboard className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Tableau de bord</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('properties');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{currentUser.role === 'agence' ? 'Parc Immobilier' : 'Biens immobiliers'}</span>
                    </button>

                    {currentUser.role === 'agence' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            onNavigateTab?.('owners');
                          }}
                          className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                        >
                          <UserPlus className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Bailleurs Mandants</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            onNavigateTab?.('team');
                          }}
                          className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                        >
                          <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Équipe Agence</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('tenants');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Users className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Locataires</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('applications');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Eye className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Demandes de location</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black">
                        8
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('contracts');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Contrats de bail</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black">
                        5
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('payments');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Paiements & Loyers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('guarantees');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Gestion des Cautions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('messages');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Messagerie & Appels</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">
                        6
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('receipts');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Receipt className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Reçus & Quittances</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('documents');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Documents & Pièces</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('maintenance');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Wrench className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Maintenance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('bank_accounts');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Wallet className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Comptes de paiement</span>
                    </button>
                  </div>

                  {/* Section 2: Rapports & Exports */}
                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                    <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Rapports & Comptabilité
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('stats');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Rapports & Statistiques</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('exports');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Exports comptables</span>
                    </button>
                  </div>

                  {/* Section 3: Configuration */}
                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                    <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Configuration
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('subscription');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Abonnement SaaS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onNavigateTab?.('settings');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 text-slate-300 hover:bg-blue-600/20 hover:text-white active:bg-blue-600 transition-all"
                    >
                      <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Paramètres</span>
                    </button>
                  </div>
                </>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold">LocaTrust v2.4</span>
              <span>Plateforme certifiée</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
