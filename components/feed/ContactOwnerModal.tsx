'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Property } from '@/types/database.types';
import { Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { sendChatMessage } from '@/lib/messagingStore';
import { triggerCelebration } from '@/lib/celebration';

interface ContactOwnerModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMessages?: (contactId?: string) => void;
}

export const ContactOwnerModal: React.FC<ContactOwnerModalProps> = ({
  property,
  isOpen,
  onClose,
  onOpenMessages,
}) => {
  const { user, profile } = useAuth();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  if (!property) return null;

  const defaultMsg = `Bonjour ${property.owner?.full_name || 'Bailleur'}, je suis intéressé par votre annonce "${property.title}". Est-il toujours disponible pour une visite ?`;
  const targetOwnerId = property.owner_id || property.owner?.id || 'usr_owner';

  const handleSend = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const applicantId = user?.id || profile?.id || 'usr_tenant';
    const textToSend = message.trim() || defaultMsg;

    // Sauvegarder les métadonnées de contact pour la messagerie
    if (typeof window !== 'undefined') {
      localStorage.setItem('locatrust_active_chat_contact', targetOwnerId);
      localStorage.setItem(
        'locatrust_contact_' + targetOwnerId,
        JSON.stringify({
          id: targetOwnerId,
          name: property.owner?.full_name || 'Propriétaire Bailleur',
          phone: property.owner?.phone || '+225 07 00 00 00 00',
          role: 'Propriétaire Bailleur',
          propertyTitle: property.title || 'Bien immobilier',
          avatar: property.owner?.avatar_url || '',
          online: true,
        })
      );
      window.dispatchEvent(new CustomEvent('locatrust:open_chat', { detail: { contactId: targetOwnerId } }));
    }

    try {
      sendChatMessage(applicantId, targetOwnerId, textToSend);
    } catch (err) {
      console.warn('Erreur envoi chat:', err);
    }

    triggerCelebration('send');
    setSent(true);
  };

  const handleClose = () => {
    setSent(false);
    setMessage('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Contacter ${property.owner?.full_name || 'le propriétaire'}`}>
      {sent ? (
        <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-brand-600 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-slate-900 text-base">Message transmis !</h4>
          <p className="text-xs text-slate-500">
            Votre message a été transmis dans la messagerie sécurisée de LocaTrust.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 w-full mt-2">
            <Button
              type="button"
              onClick={() => {
                handleClose();
                if (onOpenMessages) {
                  onOpenMessages(targetOwnerId);
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/dashboard?tab=messages';
                }
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
            >
              Accéder à la messagerie
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 cursor-pointer">
              Fermer
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <img
              src={property.owner?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(property.owner?.full_name || 'Bailleur')}&background=0284c7&color=fff`}
              alt={property.owner?.full_name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900">{property.owner?.full_name || 'Propriétaire certifié'}</span>
              <span className="text-[11px] text-emerald-600 font-bold">● Propriétaire vérifié en ligne</span>
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 cursor-pointer">
              Annuler
            </Button>
            <Button
              type="submit"
              id="btn-envoyer-message-feed-card"
              onClick={handleSend}
              variant="primary"
              className="flex-1 font-bold cursor-pointer touch-manipulation active:scale-95 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Envoyer le message</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

