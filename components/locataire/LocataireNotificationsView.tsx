'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Receipt,
  CreditCard,
  FileText,
  ShieldCheck,
  Wrench,
  Clock,
  Filter,
  CheckCheck,
  Trash2,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TenantNotification {
  id: string;
  title: string;
  description: string;
  category: 'paiement' | 'quittance' | 'contrat' | 'caution' | 'maintenance' | 'rappel';
  timestamp: string;
  read: boolean;
  actionText?: string;
  targetTab?: string;
}

const DEFAULT_TENANT_NOTIFICATIONS: TenantNotification[] = [
  {
    id: 'tnotif_1',
    title: 'Quittance officielle d\'Août 2026 émise',
    description: 'Votre quittance de loyer certifiée avec QR Code infalsifiable pour Appartement 3 pièces Cocody Riviera 3 est disponible en téléchargement.',
    category: 'quittance',
    timestamp: 'Aujourd\'hui à 08:30',
    read: false,
    actionText: 'Voir la quittance',
    targetTab: 'receipts',
  },
  {
    id: 'tnotif_2',
    title: 'Paiement de loyer validé par votre bailleur',
    description: 'Votre virement Wave de 150 000 FCFA référence TX-WAVE-89241 a été approuvé par M. Koffi N\'Guessan.',
    category: 'paiement',
    timestamp: 'Hier à 16:45',
    read: false,
    actionText: 'Détails du paiement',
    targetTab: 'payments',
  },
  {
    id: 'tnotif_3',
    title: 'Contrat de bail certifié et contresigné',
    description: 'Le contrat de bail conforme Loi N° 2019-576 a été enregistré avec signatures électroniques bilatérales.',
    category: 'contrat',
    timestamp: '28 Septembre 2026',
    read: true,
    actionText: 'Consulter le bail',
    targetTab: 'contracts',
  },
  {
    id: 'tnotif_4',
    title: 'Séquestre de votre caution locative',
    description: 'Votre dépôt de garantie de 300 000 FCFA est sécurisé sous séquestre bancaire certifié LocaTrust.',
    category: 'caution',
    timestamp: '25 Septembre 2026',
    read: true,
    actionText: 'Voir ma caution',
    targetTab: 'guarantees',
  },
  {
    id: 'tnotif_5',
    title: 'Intervention plomberie programmée',
    description: 'L\'artisan partenaire a confirmé son passage le jeudi 15 à 14h30 pour la révision du mitigeur.',
    category: 'maintenance',
    timestamp: '22 Septembre 2026',
    read: true,
    actionText: 'Suivi intervention',
    targetTab: 'maintenance',
  },
  {
    id: 'tnotif_6',
    title: 'Rappel : Échéance du loyer le 05 du mois',
    description: 'Pensez à effectuer votre paiement de loyer avant le 5 du mois pour maintenir votre score de ponctualité locative.',
    category: 'rappel',
    timestamp: '20 Septembre 2026',
    read: true,
    actionText: 'Déclarer un paiement',
    targetTab: 'payments',
  },
];

interface LocataireNotificationsViewProps {
  onNavigateTab?: (tabId: string) => void;
}

export const LocataireNotificationsView: React.FC<LocataireNotificationsViewProps> = ({
  onNavigateTab,
}) => {
  const [notifications, setNotifications] = useState<TenantNotification[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_tenant_notifications');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Error reading notifications', e);
      }
    }
    return DEFAULT_TENANT_NOTIFICATIONS;
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_tenant_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterUnreadOnly && n.read) return false;
    if (activeCategory !== 'all' && n.category !== activeCategory) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getCategoryIcon = (category: TenantNotification['category']) => {
    switch (category) {
      case 'quittance':
        return <Receipt className="w-4 h-4 text-emerald-600" />;
      case 'paiement':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'contrat':
        return <FileText className="w-4 h-4 text-purple-600" />;
      case 'caution':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'rappel':
      default:
        return <Clock className="w-4 h-4 text-rose-500" />;
    }
  };

  const getCategoryBadgeClass = (category: TenantNotification['category']) => {
    switch (category) {
      case 'quittance':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'paiement':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'contrat':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'caution':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'maintenance':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rappel':
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Mes Notifications
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-black shadow-sm">
                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Restez informé en temps réel de vos quittances, paiements validés, baux et interventions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Tout marquer comme lu</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'quittance', label: 'Quittances' },
            { id: 'paiement', label: 'Paiements' },
            { id: 'contrat', label: 'Contrats' },
            { id: 'maintenance', label: 'Maintenance' },
            { id: 'caution', label: 'Cautions' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterUnreadOnly}
              onChange={(e) => setFilterUnreadOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span>Non lues uniquement</span>
          </label>
        </div>
      </div>

      {/* 3. Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucune notification trouvée</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Vous n'avez pas de notification dans cette catégorie pour le moment.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                "p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                notif.read
                  ? "bg-white border-slate-200 hover:border-slate-300"
                  : "bg-blue-50/40 border-blue-200 shadow-sm ring-1 ring-blue-500/10"
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getCategoryIcon(notif.category)}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-md border font-extrabold uppercase tracking-wider",
                      getCategoryBadgeClass(notif.category)
                    )}>
                      {notif.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {notif.timestamp}
                    </span>
                    {!notif.read && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    )}
                  </div>

                  <h4 className={cn(
                    "text-sm mt-1.5",
                    notif.read ? "font-bold text-slate-800" : "font-black text-slate-900"
                  )}>
                    {notif.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {notif.description}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {notif.actionText && notif.targetTab && (
                  <button
                    type="button"
                    onClick={() => {
                      markAsRead(notif.id);
                      if (onNavigateTab && notif.targetTab) {
                        onNavigateTab(notif.targetTab);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <span>{notif.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => markAsRead(notif.id)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                    title="Marquer comme lu"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => deleteNotification(notif.id)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Supprimer la notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
