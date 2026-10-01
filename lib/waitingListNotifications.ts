'use client';

import { getStoredMessages, saveStoredMessages, ChatMessage } from '@/lib/messagingStore';

export interface WaitingListCandidateNotification {
  candidateId: string;
  candidateName: string;
  candidatePhone?: string;
  candidateEmail?: string;
  propertyTitle: string;
  propertyAddress: string;
  contractNumber: string;
  finalizedDate: string;
  message: string;
}

export const NOTIFICATIONS_STORAGE_KEY = 'locatrust_notifications';
export const APPLICATIONS_STORAGE_KEY = 'locatrust_rental_applications';

export interface GlobalNotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: 'demande' | 'visite' | 'paiement' | 'contrat' | 'caution' | 'maintenance' | 'abonnement';
  read: boolean;
  targetTab: string;
}

// Candidats par défaut (alignés avec DemandesView MOCK_APPLICATIONS)
const DEFAULT_APPLICATIONS = [
  {
    id: 'app_kwame',
    property_id: 'prop_apt_a',
    tenant_name: 'Kwame Koffi',
    tenant_phone: '+225 07 45 89 12 00',
    tenant_email: 'kwame.koffi@email.ci',
    tenant_cni: 'CI-009841201',
    property_title: 'Appartement A (Cocody Riviera 3)',
    property_address: 'Cocody Riviera 3, Abidjan',
    status: 'en_attente'
  },
  {
    id: 'app_moussa',
    property_id: 'prop_apt_a',
    tenant_name: 'Moussa Touré',
    tenant_phone: '+225 05 67 89 45 12',
    tenant_email: 'moussa.toure@yahoo.fr',
    tenant_cni: 'CI-0029481920',
    property_title: 'Appartement A (Cocody Riviera 3)',
    property_address: 'Cocody Riviera 3, Abidjan',
    status: 'en_attente'
  },
  {
    id: 'app_awa',
    property_id: 'prop_apt_a',
    tenant_name: 'Awa Diallo',
    tenant_phone: '+225 07 44 55 66 77',
    tenant_email: 'awa.diallo@gmail.com',
    tenant_cni: 'CI-0033221199',
    property_title: 'Appartement A (Cocody Riviera 3)',
    property_address: 'Cocody Riviera 3, Abidjan',
    status: 'en_attente'
  },
  {
    id: 'app_bamba',
    property_id: 'prop_villa_mbadon',
    tenant_name: 'Bamba Souleymane',
    tenant_phone: '+225 01 22 33 44 55',
    tenant_email: 'bamba.s@gmail.com',
    tenant_cni: 'CI-0055443322',
    property_title: "Villa 4 pièces Riviera M'Badon",
    property_address: "Riviera M'Badon, Cocody",
    status: 'en_attente'
  }
];

/**
 * Notifie automatiquement tous les demandeurs de contrat / candidats en liste d'attente
 * lorsqu'un bailleur finalise un contrat de bail pour un logement donné.
 */
export function notifyWaitingListCandidatesOnLeaseFinalized({
  propertyTitle,
  propertyAddress = '',
  chosenTenantName,
  contractNumber
}: {
  propertyTitle: string;
  propertyAddress?: string;
  chosenTenantName: string;
  contractNumber: string;
}): WaitingListCandidateNotification[] {
  if (typeof window === 'undefined') return [];

  // 1. Récupération des candidatures enregistrées ou par défaut
  let storedApps: any[] = [];
  try {
    const raw = localStorage.getItem(APPLICATIONS_STORAGE_KEY);
    if (raw) {
      storedApps = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erreur lecture applications:', e);
  }

  if (!storedApps || storedApps.length === 0) {
    storedApps = DEFAULT_APPLICATIONS;
  }

  // Normalisation pour recherche flexible
  const normTitle = propertyTitle.toLowerCase().trim();
  const normChosen = chosenTenantName.toLowerCase().trim();

  // Filtrer les candidats sur ce bien qui ne sont PAS le locataire choisi
  const competingCandidates = storedApps.filter((app) => {
    const appTitle = (app.property_title || '').toLowerCase().trim();
    const appName = (app.tenant_name || '').toLowerCase().trim();

    // Même bien ou correspondance forte
    const isSameProperty =
      appTitle.includes(normTitle) ||
      normTitle.includes(appTitle) ||
      (normTitle.includes('appartement') && appTitle.includes('appartement a'));

    // Candidat différent du locataire finalisé
    const isDifferentTenant = !appName.includes(normChosen) && !normChosen.includes(appName);

    return isSameProperty && isDifferentTenant;
  });

  const notificationsGenerated: WaitingListCandidateNotification[] = [];
  const now = new Date().toISOString();

  // 2. Mettre à jour les candidatures dans le localStorage
  const updatedApps = storedApps.map((app) => {
    const isComp = competingCandidates.some((c) => c.id === app.id);
    if (isComp) {
      return {
        ...app,
        status: 'refusee',
        unavailable_reason: `Logement loué : Bail N° ${contractNumber} finalisé avec un autre locataire`,
        date_notified: now
      };
    }
    const appName = (app.tenant_name || '').toLowerCase().trim();
    if (appName.includes(normChosen) || normChosen.includes(appName)) {
      return {
        ...app,
        status: 'contrat_actif',
        contract_number: contractNumber
      };
    }
    return app;
  });

  try {
    localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(updatedApps));
    window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } }));
  } catch (e) {
    console.warn('Erreur sauvegarde applications:', e);
  }

  // 3. Ajouter les notifications dans le centre de notifications global (Header Bell)
  let currentNotifs: GlobalNotificationItem[] = [];
  try {
    const rawNotifs = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (rawNotifs) {
      currentNotifs = JSON.parse(rawNotifs);
    }
  } catch (e) {
    console.warn('Erreur lecture notifications:', e);
  }

  const newNotifs: GlobalNotificationItem[] = [];

  for (const candidate of competingCandidates) {
    const message = `Bonjour ${candidate.tenant_name}, nous vous informons que le logement « ${propertyTitle} » pour lequel vous étiez sur la liste d'attente n'est plus disponible. Le bailleur a finalisé un contrat de bail officiel avec un autre preneur.`;

    notificationsGenerated.push({
      candidateId: candidate.id,
      candidateName: candidate.tenant_name,
      candidatePhone: candidate.tenant_phone,
      candidateEmail: candidate.tenant_email,
      propertyTitle,
      propertyAddress,
      contractNumber,
      finalizedDate: now,
      message
    });

    // Notification système
    newNotifs.push({
      id: `notif_waitlist_${candidate.id}_${Date.now()}`,
      title: `Logement non disponible : ${propertyTitle}`,
      description: `Notification envoyée à ${candidate.tenant_name} (Liste d'attente) : Le bien a été attribué et finalisé sous le contrat N° ${contractNumber}.`,
      timestamp: "À l'instant",
      category: 'demande',
      read: false,
      targetTab: 'applications'
    });

    // 4. Ajouter également un message direct dans la messagerie
    try {
      const messages = getStoredMessages();
      const chatMsg: ChatMessage = {
        id: `msg_waitlist_notify_${candidate.id}_${Date.now()}`,
        sender_id: 'usr_owner_1',
        receiver_id: candidate.id || 'usr_candidate',
        text: `📢 INFORMATION LISTE D'ATTENTE :\n${message}\n\nNous vous remercions pour l'intérêt porté à notre patrimoine et conservons votre dossier certifié pour nos prochaines disponibilités.`,
        created_at: now,
        status: 'delivered'
      };
      saveStoredMessages([...messages, chatMsg]);
    } catch (e) {
      console.warn('Erreur envoi message chat liste attente:', e);
    }
  }

  // Sauvegarder les notifications dans le Header
  if (newNotifs.length > 0) {
    const combinedNotifs = [...newNotifs, ...currentNotifs];
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(combinedNotifs));
      window.dispatchEvent(
        new CustomEvent('locatrust:notifications-updated', {
          detail: { notifications: combinedNotifs }
        })
      );
    } catch (e) {
      console.warn('Erreur sauvegarde notifications:', e);
    }
  }

  return notificationsGenerated;
}
