'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  AlertCircle,
  Search,
  Filter,
  User,
  Building2,
  Check,
  X,
  History,
  Archive
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';

export interface VisitRequest {
  id: string;
  tenant_id?: string;
  tenant_name: string;
  tenant_avatar: string;
  tenant_phone: string;
  tenant_email: string;
  property_id?: string;
  property_title: string;
  property_address: string;
  owner_id?: string;
  agency_id?: string;
  request_date: string;
  preferred_date: string;
  preferred_time: string;
  comment: string;
  status: 'en_attente' | 'acceptee' | 'refusee' | 'visite_programmee' | 'visite_effectuee' | 'annulee';
  created_at?: string;
}

interface VisitesViewProps {
  onOpenMessages?: (tenantId?: string) => void;
}

export const VisitesView: React.FC<VisitesViewProps> = ({ onOpenMessages }) => {
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [showPastVisits, setShowPastVisits] = useState(false);
  const [selectedVisitDetails, setSelectedVisitDetails] = useState<VisitRequest | null>(null);

  // Proposer une autre date modal state
  const [reschedulingVisit, setReschedulingVisit] = useState<VisitRequest | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  // 1. Charger les visites depuis localStorage et Supabase
  const loadVisits = useCallback(async () => {
    setIsLoading(true);
    let localList: VisitRequest[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_visit_requests');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) localList = parsed;
        }
      } catch (err) {
        console.warn('Erreur lecture visites locales:', err);
      }
    }

    let dbList: VisitRequest[] = [];
    try {
      const { data, error } = await supabase
        .from('visit_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        dbList = data.map((item: any) => ({
          id: String(item.id),
          tenant_id: item.tenant_id,
          tenant_name: item.tenant_name || 'Candidat Locataire',
          tenant_avatar:
            item.tenant_avatar ||
            (item.tenant_name
              ? `https://ui-avatars.com/api/?name=${encodeURIComponent(item.tenant_name)}&background=0284c7&color=fff`
              : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'),
          tenant_phone: item.tenant_phone || '',
          tenant_email: item.tenant_email || '',
          property_id: item.property_id,
          property_title: item.property_title || 'Bien immobilier',
          property_address: item.property_address || 'Abidjan, Côte d\'Ivoire',
          owner_id: item.owner_id,
          agency_id: item.agency_id,
          request_date: item.request_date || (item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 'Aujourd\'hui'),
          preferred_date: item.preferred_date || '',
          preferred_time: item.preferred_time || '',
          comment: item.comment || 'Aucun commentaire renseigné.',
          status: item.status || 'en_attente',
          created_at: item.created_at
        }));
      }
    } catch (e) {
      console.warn('Erreur chargement visit_requests Supabase:', e);
    }

    // Fusion et déduplication par id
    const map = new Map<string, VisitRequest>();
    localList.forEach((v) => map.set(v.id, v));
    dbList.forEach((v) => {
      const existing = map.get(v.id);
      if (existing) {
        map.set(v.id, { ...existing, ...v });
      } else {
        map.set(v.id, v);
      }
    });

    const allVisits = Array.from(map.values());

    // Filtrer pour le propriétaire ou l'agence connecté
    const userVisits = allVisits.filter((v) => {
      if (!user?.id) return true;
      return (
        v.owner_id === user.id ||
        v.agency_id === user.id ||
        !v.owner_id ||
        v.owner_id === 'usr_owner' ||
        v.agency_id === 'usr_agency'
      );
    });

    setVisits(userVisits);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadVisits();

    const handleSync = () => loadVisits();
    window.addEventListener('locatrust:visit-requests-updated', handleSync);
    window.addEventListener('locatrust:applications-updated', handleSync);

    return () => {
      window.removeEventListener('locatrust:visit-requests-updated', handleSync);
      window.removeEventListener('locatrust:applications-updated', handleSync);
    };
  }, [loadVisits]);

  // Sauvegarder les visites en local et émettre l'événement
  const persistVisits = (updatedVisits: VisitRequest[]) => {
    setVisits(updatedVisits);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('locatrust_visit_requests', JSON.stringify(updatedVisits));
        window.dispatchEvent(new CustomEvent('locatrust:visit-requests-updated', { detail: { visits: updatedVisits } }));
      } catch (e) {
        console.warn('Erreur persistance visites:', e);
      }
    }
  };

  // Envoyer une notification au locataire
  const notifyTenant = async (vis: VisitRequest, title: string, message: string) => {
    if (!vis.tenant_id && !vis.tenant_name) return;
    try {
      const notifId = `notif_visit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const notifObj = {
        id: notifId,
        user_id: vis.tenant_id,
        title,
        message,
        type: 'visit',
        is_read: false,
        read: false,
        created_at: new Date().toISOString()
      };

      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('locatrust_notifications');
        const notifs = raw ? JSON.parse(raw) : [];
        if (Array.isArray(notifs)) {
          notifs.unshift(notifObj);
          localStorage.setItem('locatrust_notifications', JSON.stringify(notifs));
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: notifs } }));
        }
      }

      await supabase.from('notifications').insert({
        user_id: vis.tenant_id,
        title,
        message,
        type: 'visit',
        is_read: false
      }).catch(() => {});
    } catch {}
  };

  // Mettre à jour le statut d'une visite
  const handleUpdateStatus = async (id: string, newStatus: VisitRequest['status']) => {
    const targetVisit = visits.find((v) => v.id === id);
    const updated = visits.map((v) => (v.id === id ? { ...v, status: newStatus } : v));
    persistVisits(updated);

    try {
      await supabase.from('visit_requests').update({ status: newStatus }).eq('id', id);
    } catch (e) {
      console.warn('Erreur Supabase update visit status:', e);
    }

    if (targetVisit) {
      if (newStatus === 'visite_programmee' || newStatus === 'acceptee') {
        await notifyTenant(
          targetVisit,
          'Demande de visite acceptée',
          `Votre visite pour « ${targetVisit.property_title} » est confirmée pour le ${targetVisit.preferred_date} à ${targetVisit.preferred_time}.`
        );
      } else if (newStatus === 'refusee') {
        await notifyTenant(
          targetVisit,
          'Demande de visite refusée',
          `Le bailleur n'a pas pu valider votre créneau de visite pour « ${targetVisit.property_title} ». Vous pouvez proposer une autre date.`
        );
      } else if (newStatus === 'visite_effectuee') {
        await notifyTenant(
          targetVisit,
          'Visite effectuée',
          `Votre visite pour « ${targetVisit.property_title} » a été marquée comme effectuée. Vous pouvez maintenant soumettre votre dossier de location.`
        );
      }
    }
  };

  // Reporter / Proposer un nouveau créneau
  const handleConfirmReschedule = async () => {
    if (!reschedulingVisit || !newDate || !newTime) return;
    const targetId = reschedulingVisit.id;

    const updated = visits.map((v) =>
      v.id === targetId
        ? {
            ...v,
            preferred_date: newDate,
            preferred_time: newTime,
            status: 'visite_programmee' as const
          }
        : v
    );
    persistVisits(updated);

    try {
      await supabase.from('visit_requests').update({
        preferred_date: newDate,
        preferred_time: newTime,
        status: 'visite_programmee'
      }).eq('id', targetId);
    } catch (e) {
      console.warn('Erreur Supabase reschedule visit:', e);
    }

    await notifyTenant(
      reschedulingVisit,
      'Nouveau créneau de visite proposé',
      `Le bailleur vous propose un nouveau créneau pour visiter « ${reschedulingVisit.property_title} » : le ${newDate} à ${newTime}.`
    );

    setReschedulingVisit(null);
    setNewDate('');
    setNewTime('');
  };

  // Règle d'expiration : Masquer automatiquement les visites de plus de 24h par rapport à la date de rendez-vous
  const isPastVisit = (dateStr: string) => {
    if (!dateStr) return false;
    const visitDate = new Date(dateStr);
    if (isNaN(visitDate.getTime())) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    cutoff.setHours(0, 0, 0, 0);
    return visitDate < cutoff;
  };

  const pastVisitsCount = visits.filter((v) => isPastVisit(v.preferred_date)).length;

  const filteredVisits = visits.filter((v) => {
    const matchesSearch =
      v.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.property_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'tous' || v.status === statusFilter;
    const isPast = isPastVisit(v.preferred_date);

    // Par défaut, masquer automatiquement les visites dépassées de plus d'un jour
    if (!showPastVisits && isPast) {
      return false;
    }

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: VisitRequest['status']) => {
    switch (status) {
      case 'en_attente':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-amber-600" /> En attente
          </span>
        );
      case 'acceptee':
      case 'visite_programmee':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black flex items-center gap-1 w-fit">
            <Calendar className="w-3 h-3 text-blue-600" /> Visite programmée
          </span>
        );
      case 'visite_effectuee':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Visite effectuée
          </span>
        );
      case 'refusee':
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3 text-rose-600" /> Refusée
          </span>
        );
      case 'annulee':
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black flex items-center gap-1 w-fit">
            Annulée
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Demandes de Visite
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-extrabold border border-blue-200 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Planning Visites
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez les rendez-vous de visite avec les candidats. Une visite permet au candidat de découvrir le bien avant de soumettre une éventuelle demande de location.
          </p>
        </div>

        {/* Search, Filter & Past Visits Toggle Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher candidat, bien..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="visite_programmee">Visite programmée</option>
            <option value="visite_effectuee">Visite effectuée</option>
            <option value="refusee">Refusée</option>
          </select>

          {pastVisitsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowPastVisits((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                showPastVisits
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Masquer ou afficher les visites passées de plus de 24h"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showPastVisits ? 'Masquer passées' : `Passées (${pastVisitsCount})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Visites List (Clean compact cards / table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Demandes reçues ({filteredVisits.length})
          </h3>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Les contrats ne sont générés que suite à une demande de location formelle.
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-blue-600" />
              <span>Chargement du planning de visites...</span>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Aucune demande de visite ne correspond à vos critères.
            </div>
          ) : (
            filteredVisits.map((vis) => {
              const isPast = isPastVisit(vis.preferred_date);
              return (
                <div
                  key={vis.id}
                  className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    isPast ? 'bg-slate-50/50 opacity-75' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Tenant & Property */}
                  <div className="flex items-start gap-3.5 min-w-[280px]">
                    <img
                      src={vis.tenant_avatar}
                      alt={vis.tenant_name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 leading-tight">
                          {vis.tenant_name}
                        </span>
                        {isPast && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-200 text-slate-600">
                            Passée
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-blue-700 mt-0.5">
                        {vis.property_title}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" /> {vis.property_address}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Date & Comment */}
                  <div className="flex flex-col gap-1 text-xs max-w-md">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        Visite souhaitée : {vis.preferred_date} à {vis.preferred_time}
                      </span>
                      <span className="text-[11px] text-slate-400">Demande le {vis.request_date}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                      &laquo; {vis.comment} &raquo;
                    </p>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    {getStatusBadge(vis.status)}
                  </div>

                  {/* Actions (Strictly visit management actions, NO contract generator) */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {vis.status === 'en_attente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(vis.id, 'visite_programmee')}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm transition-all active:scale-95"
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() => setReschedulingVisit(vis)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                        >
                          Autre date
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(vis.id, 'refusee')}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs transition-colors"
                        >
                          Refuser
                        </button>
                      </>
                    )}

                    {vis.status === 'visite_programmee' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(vis.id, 'visite_effectuee')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm flex items-center gap-1 transition-all active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Visite effectuée</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReschedulingVisit(vis)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                        >
                          Reporter
                        </button>
                      </>
                    )}

                    {/* Details Modal Trigger */}
                    <button
                      type="button"
                      onClick={() => setSelectedVisitDetails(vis)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                      title="Voir les détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Message Trigger */}
                    <button
                      type="button"
                      onClick={() => onOpenMessages?.(vis.tenant_id)}
                      className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                      title="Envoyer un message"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL PROPOSER UNE AUTRE DATE */}
      {reschedulingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">
                Proposer un nouveau créneau de visite
              </h3>
              <button onClick={() => setReschedulingVisit(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Proposer une nouvelle date et heure à <strong>{reschedulingVisit.tenant_name}</strong> pour la visite du bien <strong>{reschedulingVisit.property_title}</strong>.
            </p>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Date proposée</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-xs"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Heure de rendez-vous</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setReschedulingVisit(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md"
              >
                Envoyer la proposition
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DÉTAILS DE LA VISITE */}
      {selectedVisitDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">
                Détails du rendez-vous de visite
              </h3>
              <button onClick={() => setSelectedVisitDetails(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
              <img
                src={selectedVisitDetails.tenant_avatar}
                alt={selectedVisitDetails.tenant_name}
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex flex-col text-xs">
                <span className="font-extrabold text-slate-900 text-sm">{selectedVisitDetails.tenant_name}</span>
                <span className="text-slate-500">Tél : {selectedVisitDetails.tenant_phone}</span>
                <span className="text-slate-500">Email : {selectedVisitDetails.tenant_email}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-col gap-1 text-xs">
              <span className="font-black text-blue-900">{selectedVisitDetails.property_title}</span>
              <span className="text-slate-600">{selectedVisitDetails.property_address}</span>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Créneau demandé :</span>
                <strong className="text-slate-900">{selectedVisitDetails.preferred_date} à {selectedVisitDetails.preferred_time}</strong>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Date d'émission :</span>
                <span className="font-bold text-slate-800">{selectedVisitDetails.request_date}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg flex flex-col gap-1">
                <span className="text-slate-500">Message / Remarques du candidat :</span>
                <p className="text-slate-800 italic">&laquo; {selectedVisitDetails.comment} &raquo;</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedVisitDetails(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
