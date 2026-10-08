'use client';

import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  User,
  Building2,
  Eye,
  MessageSquare,
  Sparkles,
  Paperclip,
  Calendar,
  Filter,
  Check,
  ChevronDown,
  FileText,
  AlertCircle,
  XCircle,
  HelpCircle,
  StickyNote,
  DollarSign
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export type MaintenanceStatus =
  | 'Nouveau'
  | 'En cours'
  | 'Intervention programmée'
  | 'En attente'
  | 'Résolu'
  | 'Fermé';

export type MaintenancePriority = 'Haute' | 'Moyenne' | 'Normale';

export interface RentDeductionRequest {
  hasRequestedDeduction: boolean;
  amountSpent: number;
  invoiceReference: string;
  description: string;
  status: 'en_attente_accord' | 'approuve' | 'rejete';
  deductionMonth: string;
  monthlyRent: number;
}

export interface MaintenanceItem {
  id: string;
  ticketNumber: string;
  tenantName: string;
  tenantPhone: string;
  tenantAvatar?: string;
  propertyTitle: string;
  propertyAddress: string;
  category: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdAt: string;
  scheduledDate?: string;
  description: string;
  photos: string[];
  rentDeductionRequest?: RentDeductionRequest;
  notes: { id: string; author: string; content: string; date: string; isInternal?: boolean }[];
}

export const MaintenanceView: React.FC = () => {
  const [tickets, setTickets] = useState<MaintenanceItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_maintenance_tickets');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [internalNoteMessage, setInternalNoteMessage] = useState<string>('');
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [interventionText, setInterventionText] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  // Filtering
  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return ['Nouveau', 'En cours', 'Intervention programmée', 'En attente'].includes(ticket.status);
    if (statusFilter === 'resolved') return ['Résolu', 'Fermé'].includes(ticket.status);
    return ticket.status === statusFilter;
  });

  // Action: Add Reply to Tenant
  const handleSendReply = () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    const now = new Date();
    const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === selectedTicket.id) {
          return {
            ...t,
            notes: [
              ...t.notes,
              {
                id: `n-${Date.now()}`,
                author: 'Propriétaire (Vous)',
                content: replyMessage,
                date: dateStr,
                isInternal: false
              }
            ]
          };
        }
        return t;
      })
    );
    setReplyMessage('');
  };

  // Action: Add Internal Landlord Note
  const handleAddInternalNote = () => {
    if (!internalNoteMessage.trim() || !selectedTicket) return;
    const now = new Date();
    const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === selectedTicket.id) {
          return {
            ...t,
            notes: [
              ...t.notes,
              {
                id: `int-${Date.now()}`,
                author: 'Note interne bailleur (privée)',
                content: internalNoteMessage,
                date: dateStr,
                isInternal: true
              }
            ]
          };
        }
        return t;
      })
    );
    setInternalNoteMessage('');
  };

  // Action: Change Status
  const handleChangeStatus = (newStatus: MaintenanceStatus) => {
    if (!selectedTicket) return;
    setTickets((prev) =>
      prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: newStatus } : t))
    );
    setShowStatusModal(false);
  };

  // Action: Schedule Intervention
  const handleSaveSchedule = () => {
    if (!interventionText.trim() || !selectedTicket) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === selectedTicket.id
          ? {
              ...t,
              status: 'Intervention programmée',
              scheduledDate: interventionText
            }
          : t
      )
    );
    setShowScheduleModal(false);
    setInterventionText('');
  };

  // Action: Approve Tenant Rent Deduction for out-of-pocket repair
  const handleApproveDeduction = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId && t.rentDeductionRequest) {
          const req = t.rentDeductionRequest;
          const netRemaining = req.monthlyRent - req.amountSpent;
          return {
            ...t,
            rentDeductionRequest: {
              ...req,
              status: 'approuve'
            },
            notes: [
              ...t.notes,
              {
                id: `note-deduct-${Date.now()}`,
                author: 'Propriétaire (Accord officiel)',
                content: `Accord de déduction validé : ${formatFCFA(req.amountSpent)} avancés par le locataire sont déduits du loyer de ${req.deductionMonth}. Reste net à payer par le locataire : ${formatFCFA(netRemaining)}. Dès règlement du solde de ${formatFCFA(netRemaining)}, le reçu complet de ${formatFCFA(req.monthlyRent)} sera émis.`,
                date: new Date().toLocaleDateString('fr-FR'),
                isInternal: false
              }
            ]
          };
        }
        return t;
      })
    );
  };

  const handleRejectDeduction = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId && t.rentDeductionRequest) {
          return {
            ...t,
            rentDeductionRequest: {
              ...t.rentDeductionRequest,
              status: 'rejete'
            },
            notes: [
              ...t.notes,
              {
                id: `note-deduct-${Date.now()}`,
                author: 'Propriétaire (Décision)',
                content: `La déduction directe sur loyer a été refusée pour cette intervention. Un remboursement direct ou une régularisation séparée sera effectuée.`,
                date: new Date().toLocaleDateString('fr-FR'),
                isInternal: false
              }
            ]
          };
        }
        return t;
      })
    );
  };

  // Priority badge styling
  const getPriorityBadge = (p: MaintenancePriority) => {
    switch (p) {
      case 'Haute':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-200">
            Urgence Haute
          </span>
        );
      case 'Moyenne':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            Priorité Moyenne
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
            Priorité Normale
          </span>
        );
    }
  };

  // Status badge styling
  const getStatusBadge = (s: MaintenanceStatus) => {
    switch (s) {
      case 'Nouveau':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            Nouveau
          </span>
        );
      case 'En cours':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-800 border border-blue-200">
            En cours
          </span>
        );
      case 'Intervention programmée':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
            Intervention programmée
          </span>
        );
      case 'En attente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
            En attente
          </span>
        );
      case 'Résolu':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
            ✓ Résolu
          </span>
        );
      case 'Fermé':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200 text-slate-700">
            Fermé
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Gestion de la Maintenance & Incidents
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 text-xs font-black border border-amber-500/20">
              Espace Propriétaire
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Suivi centralisé des demandes de réparation, planification des interventions et historique des échanges avec vos locataires.
          </p>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Tous ({tickets.length})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'open'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Actifs ({tickets.filter((t) => ['Nouveau', 'En cours', 'Intervention programmée', 'En attente'].includes(t.status)).length})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Résolus ({tickets.filter((t) => ['Résolu', 'Fermé'].includes(t.status)).length})
          </button>
        </div>
      </div>

      {/* Main Grid: Ticket List + Active Ticket Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tickets List */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Tickets signalés ({filteredTickets.length})
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {filteredTickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2.5 ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-600 shadow-md ring-1 ring-blue-600/30'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-blue-900 tracking-wide font-mono">
                      {t.ticketNumber}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-900">{t.tenantName}</h4>
                    <p className="text-xs text-slate-500 font-medium">{t.propertyTitle}</p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    {t.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {t.category}
                      </span>
                      {getPriorityBadge(t.priority)}
                    </div>
                    <span>{t.createdAt.split(' à ')[0]}</span>
                  </div>
                </div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Aucune demande de maintenance trouvée pour ce filtre.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Full Details & Action Hub */}
        <div className="lg:col-span-7 flex flex-col">
          {selectedTicket ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[620px]">
              {/* Card Header */}
              <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-t-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">{selectedTicket.tenantName}</h3>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        {selectedTicket.ticketNumber}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600 font-medium">
                      {selectedTicket.propertyTitle} &bull; {selectedTicket.propertyAddress}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Tel: {selectedTicket.tenantPhone} &bull; Signalé le {selectedTicket.createdAt}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(selectedTicket.status)}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1 shadow-sm transition-all"
                  >
                    <span>Changer statut</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status & Priority Ribbon */}
              <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-medium">Catégorie :</span>
                  <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    {selectedTicket.category}
                  </span>
                  <span className="text-slate-500 font-medium">Priorité :</span>
                  {getPriorityBadge(selectedTicket.priority)}
                </div>

                {selectedTicket.scheduledDate ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Intervention : {selectedTicket.scheduledDate}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Programmer une intervention</span>
                  </button>
                )}
              </div>

              {/* Body Content */}
              <div className="p-6 flex-1 flex flex-col gap-5 overflow-y-auto">
                {/* Description Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                    Problème signalé par le locataire
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                    {selectedTicket.description}
                  </p>

                  {/* Photos / Videos Attached */}
                  {selectedTicket.photos && selectedTicket.photos.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Photos & Justificatifs fournis ({selectedTicket.photos.length})
                      </span>
                      <div className="flex items-center gap-3">
                        {selectedTicket.photos.map((photo, idx) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewPhoto(photo)}
                            className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 cursor-pointer group hover:ring-2 hover:ring-blue-600 transition-all"
                          >
                            <img src={photo} alt="Avarie" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* TENANT OUT-OF-POCKET EXPENSE & RENT DEDUCTION REQUEST */}
                {selectedTicket.rentDeductionRequest?.hasRequestedDeduction && (
                  <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                            Réparation avancée par le locataire — Demande de déduction sur loyer
                          </span>
                          <span className="text-[11px] text-amber-800 dark:text-amber-300">
                            Facture fournie : <strong>{selectedTicket.rentDeductionRequest.invoiceReference}</strong> &bull; Imputation sur loyer : <strong>{selectedTicket.rentDeductionRequest.deductionMonth}</strong>
                          </span>
                        </div>
                      </div>

                      {selectedTicket.rentDeductionRequest.status === 'en_attente_accord' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold text-[10px] whitespace-nowrap">
                          En attente de votre accord
                        </span>
                      )}
                      {selectedTicket.rentDeductionRequest.status === 'approuve' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center gap-1 whitespace-nowrap">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Déduction validée par le bailleur
                        </span>
                      )}
                      {selectedTicket.rentDeductionRequest.status === 'rejete' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] whitespace-nowrap">
                          Déduction refusée
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-amber-900 dark:text-amber-200 font-medium bg-white/70 dark:bg-slate-900/50 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                      &laquo; {selectedTicket.rentDeductionRequest.description} &raquo;
                    </p>

                    {/* Breakdown calculation */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Loyer normal</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatFCFA(selectedTicket.rentDeductionRequest.monthlyRent)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Avancé par locataire</span>
                        <span className="font-extrabold text-amber-700 dark:text-amber-400">
                          - {formatFCFA(selectedTicket.rentDeductionRequest.amountSpent)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Reste net à régler</span>
                        <span className="font-black text-blue-700 dark:text-blue-400 text-sm">
                          {formatFCFA(selectedTicket.rentDeductionRequest.monthlyRent - selectedTicket.rentDeductionRequest.amountSpent)}
                        </span>
                      </div>
                    </div>

                    {/* Owner approval actions */}
                    {selectedTicket.rentDeductionRequest.status === 'en_attente_accord' && (
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleApproveDeduction(selectedTicket.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approuver la déduction ({formatFCFA(selectedTicket.rentDeductionRequest.amountSpent)}) sur le loyer</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRejectDeduction(selectedTicket.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all"
                        >
                          Refuser la déduction
                        </button>
                      </div>
                    )}

                    {selectedTicket.rentDeductionRequest.status === 'approuve' && (
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Le SaaS complétera automatiquement la quittance du mois de <strong>{selectedTicket.rentDeductionRequest.deductionMonth}</strong> avec cette maintenance dès que le locataire aura payé son solde de <strong>{formatFCFA(selectedTicket.rentDeductionRequest.monthlyRent - selectedTicket.rentDeductionRequest.amountSpent)}</strong>.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Conversation History & Notes */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Historique des échanges & Notes
                  </span>

                  <div className="flex flex-col gap-3">
                    {selectedTicket.notes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-4 rounded-xl border flex flex-col gap-1.5 ${
                          note.isInternal
                            ? 'bg-amber-50/60 border-amber-300/80 ml-4'
                            : note.author.includes('Propriétaire')
                            ? 'bg-blue-50/80 border-blue-200 ml-6'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`font-black ${
                              note.isInternal
                                ? 'text-amber-900 flex items-center gap-1.5'
                                : note.author.includes('Propriétaire')
                                ? 'text-blue-900'
                                : 'text-slate-900'
                            }`}
                          >
                            {note.isInternal && <StickyNote className="w-3.5 h-3.5 text-amber-600" />}
                            {note.author}
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold">{note.date}</span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Actions & Reply Tabs */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/90 rounded-b-2xl flex flex-col gap-3">
                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setReplyMessage('Bonjour, pouvez-vous nous préciser si le problème est continu ou intermittent ?')}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all"
                  >
                    Demander des précisions
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all"
                  >
                    Proposer une date d'artisan
                  </button>
                  {selectedTicket.status !== 'Résolu' && (
                    <button
                      onClick={() => handleChangeStatus('Résolu')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 transition-all ml-auto"
                    >
                      ✓ Clôturer comme résolu
                    </button>
                  )}
                </div>

                {/* Reply Input Form */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="Répondre au locataire (action principale)..."
                    className="flex-1 p-3 rounded-xl bg-white border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                  <button
                    onClick={handleSendReply}
                    className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer</span>
                  </button>
                </div>

                {/* Internal Landlord Note input */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <input
                    type="text"
                    value={internalNoteMessage}
                    onChange={(e) => setInternalNoteMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInternalNote()}
                    placeholder="Ajouter une note interne privée bailleur (invisible pour le locataire)..."
                    className="flex-1 p-2 rounded-xl bg-amber-50/50 border border-amber-200 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleAddInternalNote}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
                  >
                    + Note interne
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-sm h-full min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Wrench className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800">Aucun incident ou ticket signalé</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Les signalements de pannes, fuites ou demandes d'intervention de vos locataires apparaîtront ici.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Change Status */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <h3 className="text-base font-black text-slate-900 mb-1">Modifier le statut</h3>
            <p className="text-xs text-slate-500 mb-4">
              Sélectionnez le nouveau statut d'avancement pour ce ticket.
            </p>

            <div className="flex flex-col gap-2">
              {(['Nouveau', 'En cours', 'Intervention programmée', 'En attente', 'Résolu', 'Fermé'] as MaintenanceStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleChangeStatus(status)}
                  className={`w-full p-3 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between ${
                    selectedTicket?.status === status
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  <span>{status}</span>
                  {selectedTicket?.status === status && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Schedule Intervention */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <h3 className="text-base font-black text-slate-900 mb-1">Programmer une intervention</h3>
            <p className="text-xs text-slate-500 mb-4">
              Précisez la date et les coordonnées du technicien ou artisan pour informer le locataire.
            </p>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-700">Date et détails de l'intervention</label>
              <input
                type="text"
                value={interventionText}
                onChange={(e) => setInterventionText(e.target.value)}
                placeholder="Ex: Samedi 26/09 à 10h00 (Plombier M. Bamba - 07 00 00 00)"
                className="p-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveSchedule}
                disabled={!interventionText.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md disabled:opacity-50"
              >
                Enregistrer & Notifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Lightbox */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl">
            <img src={previewPhoto} alt="Aperçu photo" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
