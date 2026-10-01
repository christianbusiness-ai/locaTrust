'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Property } from '@/types/database.types';
import { formatFCFA } from '@/lib/utils';
import { CheckCircle2, Calendar, Send } from 'lucide-react';

interface RentalRequestModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RentalRequestModal: React.FC<RentalRequestModalProps> = ({
  property,
  isOpen,
  onClose,
}) => {
  const [date, setDate] = useState('2026-09-01');
  const [message, setMessage] = useState('Bonjour, je souhaite réserver ce bien et planifier la constitution du dossier de location.');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!property) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReset} title={isSubmitted ? "Demande envoyée !" : "Demander cette location"}>
      {isSubmitted ? (
        <div className="flex flex-col items-center justify-center text-center p-6 gap-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-xl font-bold text-slate-900">Demande envoyée !</h4>
            <p className="text-sm text-slate-600 max-w-sm">
              Votre demande a été transmise avec succès au propriétaire ({property.owner?.full_name}). Vous serez notifié dès qu'il aura répondu.
            </p>
          </div>
          <Button onClick={handleReset} className="w-full py-3 mt-2 bg-brand-500 font-bold">
            Voir mes demandes
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <img
              src={property.photos?.[0]}
              alt={property.title}
              className="w-14 h-14 rounded-lg object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900">{property.title}</span>
              <span className="text-xs font-extrabold text-brand-600">{formatFCFA(property.rent)} / mois</span>
              <span className="text-[11px] text-slate-500">{property.location?.city}, {property.location?.quartier}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-600" />
              Date d'eménagement souhaitée
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Message au propriétaire (facultatif)</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="flex-1 font-bold">
              <Send className="w-4 h-4" />
              <span>Envoyer la demande</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
