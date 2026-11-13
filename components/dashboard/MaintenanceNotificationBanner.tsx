'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, AlertTriangle, ArrowRight, X, Clock, Camera } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import {
  getMaintenanceTickets,
  extractCleanMaintenanceMessage,
  healMaintenanceDescription,
  resolvePropertyCity
} from '@/src/lib/db';

interface MaintenanceNotificationBannerProps {
  currentUserId?: string;
  role?: 'proprietaire' | 'agence' | 'locataire';
  onNavigateToMaintenance?: (ticketId?: string) => void;
}

export const MaintenanceNotificationBanner: React.FC<MaintenanceNotificationBannerProps> = ({
  currentUserId,
  role = 'proprietaire',
  onNavigateToMaintenance
}) => {
  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('locatrust_dismissed_maintenance_banners');
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch {}
    }
    return new Set();
  });

  const loadUnresolvedTickets = useCallback(async () => {
    if (!currentUserId && role !== 'locataire') return;

    let ticketsList: any[] = [];

    // 1. Charger depuis le serveur central / DB
    try {
      const { data } = await getMaintenanceTickets(currentUserId || '');
      if (Array.isArray(data) && data.length > 0) {
        ticketsList = data;
      }
    } catch {}

    // 2. Récupérer aussi depuis le cache local réactif
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_maintenance_tickets');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((pt: any) => {
              if (!ticketsList.some((t: any) => t.id === pt.id || (pt.ticketNumber && t.ticketNumber === pt.ticketNumber))) {
                ticketsList.push(pt);
              }
            });
          }
        }
      } catch {}
    }

    // 3. Filtrer les tickets pertinents et non résolus
    const pending = ticketsList.filter((t: any) => {
      if (!t) return false;
      const st = String(t.status || '').toLowerCase().trim();
      const isPending = st === 'nouveau' || st === 'ouvert' || st === 'en_attente' || st === 'en cours' || st === 'en_cours';
      if (!isPending) return false;

      // Pour les propriétaires / agences : tous les incidents ouverts signalés
      if (role === 'proprietaire' || role === 'agence') {
        if (!currentUserId) return true;
        const matchesOwner = t.owner_id === currentUserId || t.agency_id === currentUserId;
        const matchesProperty = Boolean(t.property_id);
        return matchesOwner || matchesProperty;
      }

      // Pour le locataire : ses propres incidents en attente
      if (role === 'locataire') {
        return !currentUserId || t.tenant_id === currentUserId;
      }

      return true;
    });

    setActiveTickets(pending);
  }, [currentUserId, role]);

  useEffect(() => {
    loadUnresolvedTickets();

    const handleUpdate = () => {
      loadUnresolvedTickets();
    };

    window.addEventListener('locatrust:maintenance-updated', handleUpdate);
    window.addEventListener('locatrust:notifications-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('locatrust:maintenance-updated', handleUpdate);
      window.removeEventListener('locatrust:notifications-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadUnresolvedTickets]);

  const handleDismiss = (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(ticketId);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('locatrust_dismissed_maintenance_banners', JSON.stringify(Array.from(next)));
        } catch {}
      }
      return next;
    });
  };

  const handleActionClick = (ticket: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_selected_maintenance_ticket', ticket.id);
    }
    if (onNavigateToMaintenance) {
      onNavigateToMaintenance(ticket.id);
    }
  };

  // Filtrer les tickets non encore masqués par l'utilisateur
  const visibleTickets = activeTickets.filter((t) => !dismissedIds.has(t.id));

  if (visibleTickets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mb-6 w-full animate-fadeIn font-sans">
      {visibleTickets.map((ticket) => {
        const photosCount = Array.isArray(ticket.photos) ? ticket.photos.length : 0;
        let tName = ticket.tenantName || ticket.tenant?.full_name;
        let pTitle = ticket.propertyTitle || ticket.property?.title;

        if (typeof ticket.description === 'string') {
          const nameMatch = ticket.description.match(/^([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]+?)\s+a signalé/);
          if (nameMatch && (!tName || tName === 'Locataire')) tName = nameMatch[1].trim();
          const propMatch = ticket.description.match(/pour «\s*(.*?)\s*»/);
          if (propMatch && (!pTitle || pTitle === 'Logement')) pTitle = propMatch[1].trim();
        }

        const tenantName = tName || 'Locataire';
        const propertyTitle = pTitle || 'Logement';
        const propertyCity = resolvePropertyCity(propertyTitle, ticket.propertyAddress);
        const cleanDesc = healMaintenanceDescription(ticket.description);
        const dateStr = ticket.createdAt || (ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : 'Aujourd’hui');
        const categoryLabel = ticket.category ? String(ticket.category).toUpperCase() : 'PANNE';

        return (
          <div
            key={ticket.id}
            onClick={() => handleActionClick(ticket)}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-500/40 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-amber-500 transition-all cursor-pointer"
          >
            {/* Ligne d'accentuation supérieure animée */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Côté gauche : Icône + Informations détaillées */}
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30 animate-pulse">
                  <Wrench className="w-5 h-5" />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-sm">
                      <AlertTriangle className="w-3 h-3" />
                      Signalement Maintenance
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {dateStr}
                    </span>
                    {photosCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-extrabold flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        {photosCount} photo(s) / vidéo(s)
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                    {role === 'locataire'
                      ? `Votre signalement pour « ${propertyTitle} » (${propertyCity} • ${categoryLabel})`
                      : `Incident signalé par ${tenantName} pour « ${propertyTitle} » (${propertyCity})`}
                  </h4>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2 mt-0.5 leading-relaxed">
                    « {cleanDesc || 'Problème de maintenance signalé par le preneur.'} »
                  </p>
                </div>
              </div>

              {/* Côté droit : Bouton d'action principale + Dismiss */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/60">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActionClick(ticket);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-md shadow-amber-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <span>{role === 'locataire' ? 'Suivre mon signalement' : 'Consulter & Traiter l’incident'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDismiss(ticket.id, e)}
                  className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors shrink-0"
                  title="Masquer cette bannière"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

