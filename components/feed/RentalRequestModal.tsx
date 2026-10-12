'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Property } from '@/types/database.types';
import { formatFCFA } from '@/lib/utils';
import { CheckCircle2, Calendar, Send } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createRentalApplication } from '@/lib/supabase/services';
import { sendChatMessage } from '@/lib/messagingStore';
import { triggerCelebration } from '@/lib/celebration';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';

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
  const { user, profile } = useAuth();
  const [date, setDate] = useState('2026-09-01');
  const [message, setMessage] = useState('Bonjour, je souhaite réserver ce bien et planifier la constitution du dossier de location.');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!property) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const applicantId = user?.id || profile?.id || 'usr_tenant';
    const applicantName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Candidat Locataire');
    const applicantPhone = profile?.phone || user?.user_metadata?.phone || '+225 07 00 00 00 00';
    const applicantEmail = profile?.email || user?.email || 'locataire@locatrust.ci';
    const applicantAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(applicantName)}&background=0284c7&color=fff`;
    const targetOwnerId = property.owner_id || property.owner?.id || 'usr_owner';

    const realRent = Number(property.rent || (property as any).price || 0);
    const realCaution = Number(
      (property as any).caution ||
      (property as any).caution_amount ||
      (realRent > 0 ? realRent * 2 : 0)
    );

    const newApp = {
      id: `app_${Date.now()}`,
      property_id: property.id,
      property_title: property.title,
      property_address: `${property.location?.commune || property.location?.quartier || ''}, ${property.location?.city || 'Abidjan'}`,
      rent_amount: realRent,
      caution_amount: realCaution,
      date_received: date || new Date().toISOString().split('T')[0],
      status: 'en_attente' as const,
      dossier_status: 'complet' as const,
      tenant_id: applicantId,
      tenant_name: applicantName,
      tenant_avatar: applicantAvatar,
      tenant_phone: applicantPhone,
      tenant_email: applicantEmail,
      tenant_cni: 'CI-ABJ-2024-B-89412',
      owner_id: targetOwnerId,
      owner_name: property.owner?.full_name || 'Propriétaire Bailleur',
      owner_phone: property.owner?.phone || '+225 07 00 00 00 00',
      owner_avatar: property.owner?.avatar_url || '',
      tenant_signed: false,
      comment: message,
      documents: {
        cni_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        quittances_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        attestation_url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80'
      }
    };

    try {
      const existingRaw = localStorage.getItem('locatrust_rental_applications');
      let currentApps: any[] = [];
      if (existingRaw) {
        try { currentApps = JSON.parse(existingRaw); } catch {}
      }
      const updatedApps = [newApp, ...currentApps.filter((a: any) => a.id !== newApp.id)];
      localStorage.setItem('locatrust_rental_applications', JSON.stringify(updatedApps));
      window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } }));

      // Notification en temps réel pour le bailleur
      pushGlobalNotification({
        title: 'Nouvelle demande de location reçue',
        description: `${applicantName} a soumis sa candidature pour le bien « ${property.title} ».`,
        category: 'demande',
        targetTab: 'applications'
      });

      // Stocker les coordonnées du propriétaire pour la messagerie
      localStorage.setItem('locatrust_active_chat_contact', targetOwnerId);
      localStorage.setItem(
        'locatrust_contact_' + targetOwnerId,
        JSON.stringify({
          id: targetOwnerId,
          name: property.owner?.full_name || 'Propriétaire Bailleur',
          phone: property.owner?.phone || '+225 07 00 00 00 00',
          role: 'Propriétaire Bailleur',
          propertyTitle: property.title,
          avatar: property.owner?.avatar_url || '',
          online: true,
        })
      );
    } catch (err) {
      console.warn('LocalStorage error:', err);
    }

    try {
      const introMsg = `Bonjour, je viens de déposer ma candidature certifiée pour le bien « ${property.title} ». ${message ? `Message : "${message}"` : ''}`;
      sendChatMessage(applicantId, targetOwnerId, introMsg);
    } catch (msgErr) {
      console.warn('Chat message warning:', msgErr);
    }

    try {
      createRentalApplication({
        property_id: property.id,
        tenant_id: applicantId,
        tenant_name: applicantName,
        tenant_email: applicantEmail,
        tenant_phone: applicantPhone,
        status: 'en_attente',
        dossier_status: 'complet',
        monthly_income: Number(property.rent || 0) * 3,
        profession: 'Locataire vérifié',
        message: message,
        documents: newApp.documents as any
      }).catch(() => {});
    } catch {}

    triggerCelebration('send');
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
              className="w-full bg-blue-50/40 border border-blue-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none [color-scheme:light]"
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 cursor-pointer">
              Annuler
            </Button>
            <Button
              type="submit"
              id="btn-envoyer-demande-feed-modal"
              onClick={handleSubmit}
              variant="primary"
              className="flex-1 font-bold cursor-pointer touch-manipulation active:scale-95 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Envoyer la demande</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
