'use client';

import { generateOfficialReceiptPDF, OfficialReceiptData } from '@/lib/payments/officialReceiptPdfGenerator';
import { triggerCelebration } from '@/lib/celebration';

export interface ChatQuittanceAttachment {
  receiptNumber: string;
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  amount: number;
  periodCovered: string;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  ownerName: string;
  tenantName: string;
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
}

export interface ChatContractAttachment {
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  rentAmount: number;
  cautionAmount: number;
  durationMonths: number;
  startDate: string;
  ownerName: string;
  tenantName: string;
  ownerSigned: boolean;
  tenantSigned: boolean;
}

export interface ChatAttachment {
  type: 'image' | 'document' | 'audio';
  url: string;
  name?: string;
  size?: string;
  duration?: number;
}

export interface ChatRestitutionAttachment {
  receiptNumber: string;
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  initialCautionAmount: number;
  amountRestituted: number;
  deductionAmount: number;
  deductionReason?: string;
  restitutionDate: string;
  restitutionMethod: string;
  ownerName: string;
  tenantName: string;
  operationType: 'RESTITUTION_CAUTION';
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  media_url?: string;
  created_at: string;
  quittance?: ChatQuittanceAttachment;
  contract?: ChatContractAttachment;
  restitution?: ChatRestitutionAttachment;
  reminderContractNumber?: string;
  attachment?: ChatAttachment;
  status?: 'sent' | 'delivered' | 'read';
}

export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  propertyTitle: string;
  avatar: string;
  online: boolean;
  lastSeen?: string;
  unreadCount?: number;
}

export const OWNER_CHAT_CONTACTS: ChatContact[] = [
  {
    id: 'usr_tenant_1',
    name: 'Kouadio Jean',
    phone: '+225 07 08 09 10 11',
    role: 'Locataire actif',
    propertyTitle: 'Appartement 3 pièces Cocody',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    online: true,
    unreadCount: 1
  },
  {
    id: 'usr_tenant_2',
    name: 'Amina Diabaté',
    phone: '+225 05 55 66 77 88',
    role: 'Candidature visite',
    propertyTitle: 'Villa 4 pièces Riviera M\'Badon',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    online: true,
    unreadCount: 1
  },
  {
    id: 'usr_tenant_3',
    name: 'Marc-Aurèle Koné',
    phone: '+225 01 02 03 04 05',
    role: 'Locataire actif',
    propertyTitle: 'Studio Meublé Cocody Danga',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    online: false,
    lastSeen: "Aujourd'hui à 08:30"
  },
  {
    id: 'usr_tenant_4',
    name: 'Bamba Ali',
    phone: '+225 07 11 22 33 44',
    role: 'Locataire actif',
    propertyTitle: 'Appartement 2P Marcory',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    online: false,
    lastSeen: 'Hier à 18:30'
  },
  {
    id: 'usr_agency_1',
    name: 'Immobilière du Golf',
    phone: '+225 27 22 44 55 66',
    role: 'Agence Agréée (Mandataire)',
    propertyTitle: 'Partenaire Gestion Locative',
    avatar: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=250&q=80',
    online: true
  }
];

export const TENANT_CHAT_CONTACTS: ChatContact[] = [
  {
    id: 'usr_owner_1',
    name: "Koffi N'Guessan",
    phone: '+225 07 89 45 12 34',
    role: 'Propriétaire Bailleur',
    propertyTitle: 'Appartement 3 pièces Cocody Riviera 3',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
    online: true,
    unreadCount: 1
  },
  {
    id: 'usr_agency_1',
    name: 'Immobilière du Golf',
    phone: '+225 27 22 44 55 66',
    role: 'Agence Agréée (Mandataire)',
    propertyTitle: 'Gestion Locative Abidjan',
    avatar: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=250&q=80',
    online: true
  },
  {
    id: 'usr_support',
    name: 'Support LocaTrust',
    phone: '+225 25 20 00 11 22',
    role: 'Assistance Client 24/7',
    propertyTitle: 'Support Technique & Juridique',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    online: true
  }
];

export const AGENCY_CHAT_CONTACTS: ChatContact[] = [
  {
    id: 'usr_owner_1',
    name: "Koffi N'Guessan",
    phone: '+225 07 89 45 12 34',
    role: 'Bailleur Mandant (5 biens)',
    propertyTitle: 'Portefeuille Cocody & Riviera',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
    online: true
  },
  {
    id: 'usr_tenant_1',
    name: 'Kouadio Jean',
    phone: '+225 07 08 09 10 11',
    role: 'Locataire (Bail N° CT-2026-00058)',
    propertyTitle: 'Appartement 3 pièces Cocody',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    online: true
  },
  {
    id: 'usr_tenant_2',
    name: 'Amina Diabaté',
    phone: '+225 05 55 66 77 88',
    role: 'Candidature visite validée',
    propertyTitle: 'Villa 4 pièces Riviera M\'Badon',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    online: true
  },
  {
    id: 'usr_tenant_3',
    name: 'Marc-Aurèle Koné',
    phone: '+225 01 02 03 04 05',
    role: 'Locataire (Studio Danga)',
    propertyTitle: 'Studio Meublé Cocody Danga',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    online: false,
    lastSeen: "Aujourd'hui à 08:30"
  }
];

export const CHAT_CONTACTS: ChatContact[] = OWNER_CHAT_CONTACTS;

const DEFAULT_MESSAGES: ChatMessage[] = [
  // Kouadio Jean
  {
    id: 'msg_1',
    sender_id: 'usr_tenant_1',
    receiver_id: 'usr_owner_1',
    text: "Bonjour M. le bailleur, j'espère que vous allez bien. Je vous confirme avoir effectué le virement de mon loyer d'Août de 475 000 FCFA via Orange Money.",
    created_at: '2026-09-24T09:42:00Z',
    status: 'read'
  },
  {
    id: 'msg_2',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_1',
    text: "Bonjour Kouadio, bien reçu ! Je viens de vérifier et de valider votre quittance officielle certifiée avec signature et QR code.",
    created_at: '2026-09-24T09:45:00Z',
    status: 'read'
  },
  {
    id: 'msg_3',
    sender_id: 'usr_tenant_1',
    receiver_id: 'usr_owner_1',
    text: "Merci beaucoup pour votre réactivité ! Est-ce qu'il serait possible de faire passer le technicien pour l'entretien annuel du climatiseur ce samedi ?",
    created_at: '2026-09-25T10:15:00Z',
    status: 'read'
  },
  {
    id: 'msg_contract_sample',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_1',
    text: "📑 Contrat de Bail Officiel Transmis (N° CT-2026-00058)\nVotre propriétaire vous a transmis le bail d'habitation pour le logement : Appartement 3 pièces - Cocody Riviera 3.\nVeuillez consulter les articles et apposer votre signature électronique pour officialiser la location.",
    created_at: '2026-09-25T15:32:00Z',
    contract: {
      contractNumber: 'CT-2026-00058',
      propertyTitle: 'Appartement 3 pièces - Cocody Riviera 3',
      propertyAddress: "Cocody Riviera 3, Abidjan - Côte d'Ivoire",
      rentAmount: 75000,
      cautionAmount: 150000,
      durationMonths: 12,
      startDate: '01/10/2026',
      ownerName: "Koffi N'Guessan",
      tenantName: 'Kouadio Jean',
      ownerSigned: true,
      tenantSigned: false
    },
    status: 'delivered'
  },
  {
    id: 'msg_quittance_sample',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_1',
    text: "📄 Quittance de Loyer Officielle Émise (N° OM-225-88492019)\nVotre bailleur a validé votre règlement et a apposé sa signature manuscrite certifiée. La quittance est disponible au téléchargement.",
    created_at: '2026-09-25T15:35:00Z',
    quittance: {
      receiptNumber: 'OM-225-88492019',
      contractNumber: 'CT-2026-00058',
      propertyTitle: 'Appartement 3 pièces - Cocody Riviera 3',
      propertyAddress: "Cocody Riviera 3, Abidjan - Côte d'Ivoire",
      amount: 75000,
      periodCovered: 'Septembre 2026',
      paymentDate: '04/09/2026',
      paymentMethod: 'Orange Money',
      transactionReference: 'OM-225-88492019',
      ownerName: "Koffi N'Guessan",
      tenantName: 'Kouadio Jean'
    },
    status: 'delivered'
  },
  // Amina Diabaté
  {
    id: 'msg_4',
    sender_id: 'usr_tenant_2',
    receiver_id: 'usr_owner_1',
    text: "Bonjour M. N'Guessan, j'ai envoyé une demande de visite pour la Villa à M'Badon ce samedi 28/09 à 15h00. Est-ce que cette heure vous convient toujours ?",
    created_at: '2026-09-24T16:30:00Z',
    status: 'read'
  },
  {
    id: 'msg_5',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_2',
    text: "Bonjour Mme Diabaté, oui parfaitement. Je vous donne rendez-vous directement devant l'entrée de la cité Étoile.",
    created_at: '2026-09-24T17:00:00Z',
    status: 'read'
  },
  {
    id: 'msg_6',
    sender_id: 'usr_tenant_2',
    receiver_id: 'usr_owner_1',
    text: "Parfait, je viendrai avec mon dossier complet. Merci pour votre accueil !",
    created_at: '2026-09-25T08:10:00Z',
    status: 'read'
  },
  // Marc-Aurèle Koné
  {
    id: 'msg_7',
    sender_id: 'usr_tenant_3',
    receiver_id: 'usr_owner_1',
    text: "Bonjour, comme signalé ce matin dans l'espace maintenance, la serrure de la porte blindée accroche un peu à la fermeture.",
    created_at: '2026-09-25T07:20:00Z',
    status: 'read'
  },
  {
    id: 'msg_8',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_3',
    text: "Bonjour Marc-Aurèle, notre artisan serrurier agréé a été mandaté. Il vous contactera d'ici midi.",
    created_at: '2026-09-25T08:00:00Z',
    status: 'read'
  },
  // Bamba Ali
  {
    id: 'msg_9',
    sender_id: 'usr_tenant_4',
    receiver_id: 'usr_owner_1',
    text: "Bonjour M. le bailleur, l'électricien est bien intervenu pour le disjoncteur du couloir. Tout est en ordre. Merci !",
    created_at: '2026-09-24T18:00:00Z',
    status: 'read'
  },
  {
    id: 'msg_10',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_4',
    text: "Très bonne nouvelle Bamba. Merci pour votre confirmation rapide et bonne fin de semaine.",
    created_at: '2026-09-24T18:30:00Z',
    status: 'read'
  },
  // Immobilière du Golf (Agence) <-> Propriétaire
  {
    id: 'msg_agency_owner_1',
    sender_id: 'usr_agency_1',
    receiver_id: 'usr_owner_1',
    text: "Bonjour M. N'Guessan, l'état des lieux d'entrée pour votre logement de Cocody a été validé et numérisé dans la plateforme.",
    created_at: '2026-09-25T11:00:00Z',
    status: 'read'
  },
  {
    id: 'msg_agency_owner_2',
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_agency_1',
    text: "Merci pour le suivi exemplaire. Pouvez-vous préparer le compte-rendu de gestion mensuelle ?",
    created_at: '2026-09-25T11:15:00Z',
    status: 'read'
  },
  // Immobilière du Golf (Agence) <-> Locataire
  {
    id: 'msg_agency_tenant_1',
    sender_id: 'usr_agency_1',
    receiver_id: 'usr_tenant_1',
    text: "Bonjour M. Kouadio, l'agence Immobilière du Golf reste à votre entière disposition pour tout renseignement sur les quittances ou le contrat.",
    created_at: '2026-09-24T14:00:00Z',
    status: 'read'
  },
  // Support LocaTrust <-> Locataire
  {
    id: 'msg_support_tenant_1',
    sender_id: 'usr_support',
    receiver_id: 'usr_tenant_1',
    text: "Bienvenue sur l'assistance LocaTrust ! Vos reçus et votre contrat de bail certifié restent conservés en toute sécurité.",
    created_at: '2026-09-24T10:00:00Z',
    status: 'read'
  }
];

const STORAGE_KEY = 'locatrust_chat_messages_v3';
const RECEIPTS_STORAGE_KEY = 'locatrust_tenant_receipts_v2';

export function getStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return DEFAULT_MESSAGES;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data || data === 'null' || data === 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MESSAGES));
      return DEFAULT_MESSAGES;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MESSAGES));
      return DEFAULT_MESSAGES;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse stored messages:', e);
    return DEFAULT_MESSAGES;
  }
}

export function saveStoredMessages(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  } catch (e) {
    console.error('Failed to save stored messages:', e);
  }
}

export function sendChatMessage(senderId: string, receiverId: string, text: string): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    sender_id: senderId,
    receiver_id: receiverId,
    text,
    created_at: new Date().toISOString(),
    status: 'delivered'
  };
  const updated = [...current, newMsg];
  saveStoredMessages(updated);
  return newMsg;
}

export function sendQuittanceToTenant(quittance: ChatQuittanceAttachment): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_quittance_${Date.now()}`,
    sender_id: 'usr_owner_1',
    receiver_id: 'usr_tenant_1',
    text: `📄 Quittance de Loyer Officielle Émise (N° ${quittance.receiptNumber})\nVotre bailleur a validé votre règlement et a apposé sa signature manuscrite certifiée. La quittance est disponible au téléchargement.`,
    created_at: new Date().toISOString(),
    quittance,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Also persist in tenant receipts store
  try {
    if (typeof window !== 'undefined') {
      const existingReceipts = getStoredTenantReceipts();
      const exists = existingReceipts.some((r) => r.receiptNumber === quittance.receiptNumber);
      if (!exists) {
        const updatedReceipts = [quittance, ...existingReceipts];
        localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updatedReceipts));
        window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
      }
    }
  } catch (e) {
    console.error('Error saving tenant receipt:', e);
  }

  return newMsg;
}

export function getStoredTenantReceipts(): ChatQuittanceAttachment[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse stored tenant receipts:', e);
    return [];
  }
}

export function sendContractToTenant(tenantId: string, contract: ChatContractAttachment): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_contract_${Date.now()}`,
    sender_id: 'usr_owner_1',
    receiver_id: tenantId,
    text: `📑 Contrat de Bail Officiel Transmis (N° ${contract.contractNumber})\nVotre propriétaire vous a transmis le bail d'habitation pour le logement : ${contract.propertyTitle}.\nVeuillez consulter les articles et apposer votre signature électronique pour officialiser la location.`,
    created_at: new Date().toISOString(),
    contract,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);
  return newMsg;
}

export function sendContractReminderToTenant(
  tenantId: string,
  contractNumber: string,
  tenantName: string,
  propertyTitle: string
): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_reminder_${Date.now()}`,
    sender_id: 'usr_owner_1',
    receiver_id: tenantId,
    text: `⚠️ RAPPEL DE SIGNATURE : Contrat N° ${contractNumber}\nBonjour ${tenantName}, votre bailleur a déjà signé et validé le bail pour « ${propertyTitle} ». Votre signature électronique est attendue pour finaliser officiellement l'entrée dans les lieux.`,
    created_at: new Date().toISOString(),
    reminderContractNumber: contractNumber,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);
  return newMsg;
}

export async function downloadQuittancePdfFromAttachment(q: ChatQuittanceAttachment) {
  const pdfData: OfficialReceiptData = {
    receiptNumber: q.receiptNumber,
    contractNumber: q.contractNumber,
    contractToken: 'tok_cnt_ci2026_000123',
    propertyTitle: q.propertyTitle,
    propertyAddress: q.propertyAddress,
    propertyReference: 'BIEN-000456',
    propertyType: 'Appartement 3 pièces',
    durationMonths: 12,
    leaseStartDate: '01/10/2026',
    leaseEndDate: '30/09/2027',
    ownerName: q.ownerName,
    ownerCni: 'CI987654321',
    ownerPhone: '05 05 43 21 00',
    tenantName: q.tenantName,
    tenantCni: 'CI123456789',
    tenantPhone: '07 00 12 34 56',
    amount: q.amount,
    periodCovered: q.periodCovered,
    paymentDate: q.paymentDate,
    paymentMethod: q.paymentMethod,
    transactionReference: q.transactionReference,
    ownerSignatureUrl: q.ownerSignatureUrl,
    tenantSignatureUrl: q.tenantSignatureUrl
  };

  await generateOfficialReceiptPDF(pdfData);
}
