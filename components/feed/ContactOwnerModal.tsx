'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Property } from '@/types/database.types';
import { Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { sendRealChatMessage } from '@/lib/messagingStore';
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
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!property) return null;

  const defaultMsg = `Bonjour ${property.owner?.full_name || 'Bailleur'}, je suis intéressé par votre annonce "${property.title}". Est-il toujours disponible pour une visite ?`;
  const targetOwnerId = property.owner_id || property.owner?.id || (property as any)?.agency_id || (property as any)?.mandant_id || '';
  const ownerFullName = property.owner?.full_name || (property as any)?.owner_name || 'Propriétaire Bailleur';
  const ownerAvatar = property.owner?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerFullName)}&background=1E40AF&color=fff`;

  const handleSend = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (isSending) return;

    const applicantId = user?.id || profile?.id;
    if (!applicantId) {
      setErrorMessage("Veuillez vous connecter pour contacter directement le bailleur de ce logement.");
      return;
    }
    if (!targetOwnerId) {
      setErrorMessage("Les coordonnées du bailleur de ce logement sont momentanément indisponibles.");
      return;
    }

    const textToSend = message.trim() || defaultMsg;

    setIsSending(true);
    setErrorMessage(null);

    try {
      // 1. Enregistrement réel dans Supabase et diffusion
      await sendRealChatMessage(applicantId, targetOwnerId, textToSend, {
        propertyId: property.id,
        propertyTitle: property.title
      });

      // 2. Sauvegarder les métadonnées de contact pour la messagerie
      if (typeof window !== 'undefined') {
        localStorage.setItem('locatrust_active_chat_contact', targetOwnerId);
        localStorage.setItem(
          'locatrust_contact_' + targetOwnerId,
          JSON.stringify({
            id: targetOwnerId,
            name: ownerFullName,
            phone: property.owner?.phone || '+225 07 00 00 00 00',
            role: Boolean((property as any).is_agency || property.agency_id || property.owner?.role === 'agence' || (property.owner as any)?.account_type === 'agence') ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur',
            propertyTitle: property.title || 'Bien immobilier',
            avatar: ownerAvatar,
            online: true,
          })
        );
        window.dispatchEvent(new CustomEvent('locatrust:open_chat', { detail: { contactId: targetOwnerId } }));
      }

      triggerCelebration('send');
      setSent(true);
    } catch (err: any) {
      console.error('Erreur technique détaillée envoi message:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        applicantId,
        targetOwnerId
      });
      const userMsg = err?.message?.includes('violates')
        ? "Action non autorisée. Veuillez vérifier votre session ou vous reconnecter."
        : err?.message || "Impossible d'envoyer le message pour le moment. Veuillez réessayer.";
      setErrorMessage(userMsg);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setIsSending(false);
    setErrorMessage(null);
    setMessage('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Contacter ${ownerFullName}`}>
      {sent ? (
        <div className="flex flex-col items-center justify-center p-6 text-center gap-3 animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-slate-900 text-base">Message transmis avec succès !</h4>
          <p className="text-xs text-slate-500">
            Votre message a été enregistré et transmis directement dans la messagerie du bailleur.
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
              src={ownerAvatar}
              alt={ownerFullName}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900">{ownerFullName}</span>
              <span className="text-[11px] text-emerald-600 font-bold">● Bailleur certifié en ligne</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

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
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSending} className="flex-1 cursor-pointer">
              Annuler
            </Button>
            <Button
              type="submit"
              id="btn-envoyer-message-feed-card"
              disabled={isSending}
              variant="primary"
              className="flex-1 font-bold cursor-pointer touch-manipulation active:scale-95 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Envoyer le message</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

