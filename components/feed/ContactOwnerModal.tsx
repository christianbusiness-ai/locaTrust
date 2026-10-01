'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Property } from '@/types/database.types';
import { Send, CheckCircle2 } from 'lucide-react';

interface ContactOwnerModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ContactOwnerModal: React.FC<ContactOwnerModalProps> = ({
  property,
  isOpen,
  onClose,
}) => {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  if (!property) return null;

  const defaultMsg = `Bonjour ${property.owner?.full_name}, je suis intéressé par votre annonce "${property.title}". Est-il toujours disponible pour une visite ?`;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Contacter ${property.owner?.full_name}`}>
      {sent ? (
        <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-brand-600 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-slate-900 text-base">Message transmis !</h4>
          <p className="text-xs text-slate-500">
            Votre message instantané a été envoyé dans la messagerie sécurisée de LocaTrust.
          </p>
          <Button onClick={handleClose} className="w-full mt-2">Fermer</Button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <img
              src={property.owner?.avatar_url}
              alt={property.owner?.full_name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900">{property.owner?.full_name}</span>
              <span className="text-[11px] text-slate-500">Propriétaire vérifié LocaTrust</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Votre message</label>
            <textarea
              rows={4}
              defaultValue={defaultMsg}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="flex-1 font-bold">
              <Send className="w-4 h-4" />
              <span>Envoyer le message</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
