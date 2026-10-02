'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Paperclip,
  ShieldCheck,
  ChevronRight,
  User,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  message: string;
  date: string;
  status: 'en_attente' | 'en_cours' | 'repondu' | 'resolu';
  lastReply?: string;
  replyDate?: string;
}

const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'TK-2026-0842',
    subject: 'Demande de précision sur la quittance de Juillet 2026',
    category: 'Paiement & Quittance',
    message: 'Bonjour, j\'ai effectué le paiement le 03 Juillet via Wave mais le libellé sur la quittance indique 04 Juillet. Pouvez-vous vérifier ? Merci.',
    date: '10 Août 2026',
    status: 'repondu',
    lastReply: 'Bonjour M. N\'Guessan, nous confirmons que la date de valeur bancaire est bien le 03 Juillet. La quittance rectificative certifiée a été actualisée dans votre espace Reçus.',
    replyDate: '10 Août 2026 à 14:15',
  },
  {
    id: 'TK-2026-0711',
    subject: 'Confirmation de séquestre de ma caution de 300 000 FCFA',
    category: 'Caution & Garantie',
    message: 'Bonjour l\'équipe, je souhaitais avoir l\'attestation officielle de séquestre pour mon dossier bancaire.',
    date: '20 Juillet 2026',
    status: 'resolu',
    lastReply: 'Bonjour, votre certificat de séquestre conforme Loi N° 2019-576 a été déposé dans votre section Cautions avec son QR Code infalsifiable.',
    replyDate: '21 Juillet 2026 à 09:30',
  }
];

export const LocataireSupportView: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Paiement & Quittance');
  const [newPriority, setNewPriority] = useState('Normale');
  const [newMessage, setNewMessage] = useState('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;

    const newTicketId = `TK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: SupportTicket = {
      id: newTicketId,
      subject: newSubject,
      category: newCategory,
      message: newMessage,
      date: 'À l\'instant',
      status: 'en_attente',
    };

    setTickets([newTicket, ...tickets]);
    setIsSubmitted(true);
    setNewSubject('');
    setNewMessage('');
    setAttachedFileName(null);

    setTimeout(() => {
      setIsSubmitted(false);
    }, 4500);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* 1. Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Assistance & Support Locataire
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Posez vos questions et signalez vos demandes directement à l'équipe d'experts LocaTrust.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Support en ligne 7j/7</span>
          </span>
        </div>
      </div>

      {isSubmitted && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Votre message a été transmis avec succès au support LocaTrust ! Un conseiller traitera votre demande et vous répondra dans un délai garanti de moins de 2 heures.
            </span>
          </div>
        </div>
      )}

      {/* 2. Main Grid : Formulaire de message (Gauche) + Historique des demandes (Droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Formulaire d'envoi de message */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Envoyer un message au Support
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Objet de votre demande <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Ex: Question sur ma quittance d'août, problème de contrat..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="Paiement & Quittance">Paiement & Quittance</option>
                  <option value="Contrat de bail & Signatures">Contrat de bail & Signatures</option>
                  <option value="Caution & Garantie">Caution & Garantie</option>
                  <option value="Panne & Maintenance">Panne & Maintenance</option>
                  <option value="Question Générale">Question Générale</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Priorité
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="Normale">Normale (Réponse sous 2h)</option>
                  <option value="Urgente">Urgente (Immédiate)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Votre Message détaillé <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Décrivez précisément votre situation ou votre question pour une prise en charge rapide par nos conseillers..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none leading-relaxed"
                required
              />
            </div>

            {/* Pièce jointe optionnelle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">
                  {attachedFileName || 'Joindre une photo ou un justificatif (optionnel)'}
                </span>
              </div>
              <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer shadow-sm">
                Parcourir
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachedFileName(f.name);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Envoyer mon message au Support LocaTrust</span>
            </button>
          </form>
        </div>

        {/* Historique des messages & Réponses */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Mes Demandes d'Assistance ({tickets.length})
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Historique sécurisé</span>
            </div>

            <div className="flex flex-col gap-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2",
                    selectedTicket?.id === ticket.id
                      ? "bg-blue-50/70 border-blue-400 shadow-sm"
                      : "bg-slate-50/70 hover:bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                      {ticket.id}
                    </span>
                    <span className={cn(
                      "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                      ticket.status === 'repondu'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : ticket.status === 'resolu'
                        ? "bg-slate-100 text-slate-700 border-slate-300"
                        : "bg-amber-50 text-amber-700 border-amber-300"
                    )}>
                      {ticket.status === 'repondu' ? 'Réponse disponible' : ticket.status === 'resolu' ? 'Résolu' : 'En cours d\'examen'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {ticket.subject}
                  </h4>

                  <span className="text-[11px] text-slate-400">
                    Envoyé le {ticket.date} • {ticket.category}
                  </span>

                  {/* Expanded reply preview */}
                  {selectedTicket?.id === ticket.id && ticket.lastReply && (
                    <div className="mt-2 pt-2 border-t border-blue-200/60 flex flex-col gap-1.5 animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-900">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Réponse de l'équipe Support LocaTrust :</span>
                      </div>
                      <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-blue-100 leading-relaxed">
                        {ticket.lastReply}
                      </p>
                      <span className="text-[10px] text-slate-400 self-end">
                        {ticket.replyDate}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
