'use client';

import React, { useState } from 'react';
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
  X
} from 'lucide-react';

export interface VisitRequest {
  id: string;
  tenant_name: string;
  tenant_avatar: string;
  tenant_phone: string;
  tenant_email: string;
  property_title: string;
  property_address: string;
  request_date: string;
  preferred_date: string;
  preferred_time: string;
  comment: string;
  status: 'en_attente' | 'acceptee' | 'refusee' | 'visite_programmee' | 'visite_effectuee' | 'annulee';
}

const INITIAL_VISITS: VisitRequest[] = [];

interface VisitesViewProps {
  onOpenMessages?: (tenantId?: string) => void;
}

export const VisitesView: React.FC<VisitesViewProps> = ({ onOpenMessages }) => {
  const [visits, setVisits] = useState<VisitRequest[]>(INITIAL_VISITS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [selectedVisitDetails, setSelectedVisitDetails] = useState<VisitRequest | null>(null);

  // Proposer une autre date modal state
  const [reschedulingVisit, setReschedulingVisit] = useState<VisitRequest | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const handleUpdateStatus = (id: string, newStatus: VisitRequest['status']) => {
    setVisits((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v))
    );
  };

  const handleConfirmReschedule = () => {
    if (!reschedulingVisit || !newDate || !newTime) return;
    setVisits((prev) =>
      prev.map((v) =>
        v.id === reschedulingVisit.id
          ? {
              ...v,
              preferred_date: newDate,
              preferred_time: newTime,
              status: 'visite_programmee'
            }
          : v
      )
    );
    alert(`Nouvelle date proposée pour ${reschedulingVisit.tenant_name} : le ${newDate} à ${newTime}. Notifié par SMS/Email.`);
    setReschedulingVisit(null);
    setNewDate('');
    setNewTime('');
  };

  const filteredVisits = visits.filter((v) => {
    const matchesSearch =
      v.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.property_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'tous' || v.status === statusFilter;
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
            Gérez les rendez-vous de visite avec les candidats. Une visite permet au locataire de découvrir le bien avant d'effectuer une éventuelle demande de location.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-60">
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
        </div>
      </div>

      {/* Visites List (Clean compact cards / table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Demandes reçues ({filteredVisits.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Les contrats ne peuvent être générés que suite à une demande de location formelle.
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredVisits.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Aucune demande de visite ne correspond à vos critères.
            </div>
          ) : (
            filteredVisits.map((vis) => (
              <div
                key={vis.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                {/* Left: Tenant & Property */}
                <div className="flex items-start gap-3.5 min-w-[280px]">
                  <img
                    src={vis.tenant_avatar}
                    alt={vis.tenant_name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-900 leading-tight">
                      {vis.tenant_name}
                    </span>
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
                    onClick={() => onOpenMessages?.()}
                    className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                    title="Envoyer un message"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                </div>

              </div>
            ))
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
