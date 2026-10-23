'use client';

import { supabase } from '@/src/lib/supabase';
import { formatFCFA } from '@/lib/utils';
import { sendChatMessage } from '@/lib/messagingStore';

export interface ContractRenewalState {
  renewalStatus?: 'aucun' | 'demande' | 'accepte' | 'refuse';
  requestedDurationMonths?: number;
  requestedAt?: string;
  processedAt?: string;
  refusalReason?: string;
  extendedUntilDate?: string;
}

/**
 * Calcule les métriques d'échéance d'un contrat de bail
 */
export function getContractExpiryDetails(contract: any) {
  try {
    const rawStart = contract?.start_date || contract?.lease_start_date || contract?.signed_date || contract?.created_at || '2026-10-01';
    const duration = Number(contract?.duration_months || 12);
    
    let startDateObj = new Date(rawStart);
    if (isNaN(startDateObj.getTime()) && typeof rawStart === 'string' && rawStart.includes('/')) {
      const parts = rawStart.split('/');
      startDateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    if (isNaN(startDateObj.getTime())) {
      startDateObj = new Date();
    }

    let endDateObj: Date;
    if (contract?.end_date) {
      endDateObj = new Date(contract.end_date);
      if (isNaN(endDateObj.getTime()) && typeof contract.end_date === 'string' && contract.end_date.includes('/')) {
        const parts = contract.end_date.split('/');
        endDateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    } else {
      endDateObj = new Date(startDateObj);
      endDateObj.setMonth(endDateObj.getMonth() + duration);
    }

    const now = new Date();
    const diffMs = endDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const monthsRemaining = Math.max(0, Math.ceil(diffDays / 30.5));

    // J-30 : arrive à terme dans 30 jours (1 mois ou moins)
    const isAtOneMonthOrLess = diffDays <= 30 && diffDays >= 0;
    const isExpired = diffDays < 0;

    return {
      startDateObj,
      endDateObj,
      endDateFormatted: isNaN(endDateObj.getTime()) ? 'Terme convenu' : endDateObj.toLocaleDateString('fr-FR'),
      diffDays,
      monthsRemaining,
      isAtOneMonthOrLess,
      isExpired
    };
  } catch {
    return {
      startDateObj: new Date(),
      endDateObj: new Date(),
      endDateFormatted: 'Terme convenu',
      diffDays: 365,
      monthsRemaining: 12,
      isAtOneMonthOrLess: false,
      isExpired: false
    };
  }
}

/**
 * Vérifie silencieusement les contrats à 1 mois de l'échéance (J-30)
 * et notifie simultanément le bailleur et le preneur (Audio utilisateur).
 */
export async function checkAndSendContractExpiryNotifications(userId?: string) {
  if (typeof window === 'undefined') return;

  try {
    let contracts: any[] = [];
    const stored = localStorage.getItem('locatrust_contracts');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) contracts = parsed;
    }

    // Récupérer aussi depuis Supabase si connecté
    try {
      const { data: dbContracts } = await supabase
        .from('contracts')
        .select('*')
        .in('status', ['actif', 'contrat_actif', 'signe']);
      if (Array.isArray(dbContracts)) {
        dbContracts.forEach((dc) => {
          if (!contracts.some((c) => (c.contract_number && c.contract_number === dc.contract_number) || c.id === dc.id)) {
            contracts.push(dc);
          }
        });
      }
    } catch {}

    const rawNotifs = localStorage.getItem('locatrust_notifications');
    let notifsList: any[] = [];
    if (rawNotifs) {
      try {
        notifsList = JSON.parse(rawNotifs);
      } catch {}
    }

    let hasNewNotifs = false;

    contracts.forEach((c) => {
      const st = String(c.status || '').toLowerCase().trim();
      // Ignorer les contrats déjà clôturés ou terminés
      if (st === 'termine' || st === 'cloture' || st === 'resilie') return;

      const expiry = getContractExpiryDetails(c);
      const contractNumber = c.contract_number || c.id || 'LT-2026';
      const propertyTitle = c.property_title || c.property?.title || 'Logement';
      const tenantName = c.tenant_name || c.tenant?.full_name || 'Christian';
      const ownerId = c.owner_id || c.owner?.id || 'usr_owner';
      const tenantId = c.tenant_id || c.tenant?.id || 'usr_tenant';

      // Déclencher l'alerte J-30 (1 mois avant la fin du contrat)
      if (expiry.isAtOneMonthOrLess) {
        const notifKey = `locatrust_expiry_notified_1m_${contractNumber}`;
        const alreadyNotified = localStorage.getItem(notifKey);

        if (!alreadyNotified) {
          // 1. Notification au bailleur / agence
          const ownerNotif = {
            id: `notif_exp_owner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `⏳ Fin de contrat dans 1 mois (J-30)`,
            description: `Le bail N° ${contractNumber} pour "${propertyTitle}" (${tenantName}) arrive à terme le ${expiry.endDateFormatted}. Le locataire peut demander un renouvellement.`,
            timestamp: 'À l\'instant',
            category: 'contrat' as const,
            read: false,
            targetTab: 'contracts',
            targetRole: 'proprietaire',
            targetUserId: ownerId
          };

          // 2. Notification au locataire
          const tenantNotif = {
            id: `notif_exp_tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `⏳ Votre bail arrive à terme dans 1 mois (J-30)`,
            description: `Votre contrat de bail N° ${contractNumber} pour "${propertyTitle}" prend fin le ${expiry.endDateFormatted}. Vous pouvez dès aujourd'hui demander son renouvellement.`,
            timestamp: 'À l\'instant',
            category: 'contrat' as const,
            read: false,
            targetTab: 'contrats',
            targetRole: 'locataire',
            targetUserId: tenantId
          };

          notifsList.unshift(ownerNotif, tenantNotif);
          localStorage.setItem(notifKey, new Date().toISOString());
          hasNewNotifs = true;
        }
      }
    });

    if (hasNewNotifs) {
      localStorage.setItem('locatrust_notifications', JSON.stringify(notifsList));
      window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    }
  } catch (err) {
    console.warn('Erreur verification echeance 1 mois:', err);
  }
}

/**
 * Action Locataire : Demande officielle de renouvellement de contrat
 */
export async function submitContractRenewalRequest(params: {
  contract: any;
  tenantName: string;
  propertyTitle: string;
  durationMonths?: number;
}) {
  const { contract, tenantName, propertyTitle, durationMonths = 12 } = params;
  const contractNumber = contract.contract_number || contract.id;
  const ownerId = contract.owner_id || contract.owner?.id || 'usr_owner';
  const tenantId = contract.tenant_id || contract.tenant?.id || 'usr_tenant';

  // 1. Mettre à jour l'état local du contrat
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('locatrust_contracts');
    if (stored) {
      const list = JSON.parse(stored);
      if (Array.isArray(list)) {
        const updated = list.map((c: any) => {
          if (c.contract_number === contractNumber || c.id === contractNumber) {
            return {
              ...c,
              renewal_status: 'demande',
              renewal_requested_at: new Date().toISOString(),
              renewal_duration_requested: durationMonths
            };
          }
          return c;
        });
        localStorage.setItem('locatrust_contracts', JSON.stringify(updated));
      }
    }

    // 2. Notification officielle au bailleur
    const rawNotifs = localStorage.getItem('locatrust_notifications');
    const notifs = rawNotifs ? JSON.parse(rawNotifs) : [];
    const notifItem = {
      id: `notif_renew_req_${Date.now()}`,
      title: '🔄 Demande de renouvellement de bail reçue',
      description: `${tenantName} demande formellement le renouvellement du bail N° ${contractNumber} (${propertyTitle}) pour une durée de ${durationMonths} mois.`,
      timestamp: 'À l\'instant',
      category: 'contrat' as const,
      read: false,
      targetTab: 'contracts',
      targetRole: 'proprietaire',
      targetUserId: ownerId
    };
    notifs.unshift(notifItem);
    localStorage.setItem('locatrust_notifications', JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
  }

  // 3. Message écrit dans la messagerie interne
  try {
    sendChatMessage(
      tenantId,
      ownerId,
      `🔄 DEMANDE OFFICIELLE DE RENOUVELLEMENT DE BAIL\n\nMadame, Monsieur,\nPar la présente, je sollicite formellement le renouvellement de mon contrat de bail N° ${contractNumber} portant sur le logement "${propertyTitle}" pour une période additionnelle de ${durationMonths} mois.\n\nJe me tiens à votre entière disposition pour la validation de cette reconduction.\n\nCordialement,\n${tenantName}`
    );
  } catch {}

  // 4. Mise à jour Supabase si possible
  try {
    await supabase
      .from('contracts')
      .update({
        renewal_status: 'demande',
        renewal_requested_at: new Date().toISOString()
      })
      .or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
  } catch {}
}

/**
 * Action Propriétaire / Agence : Accepter le renouvellement du contrat
 * Le contrat prolonge son cours normal jusqu'à la nouvelle date de fin (+ durationMonths).
 */
export async function acceptContractRenewal(params: {
  contract: any;
  durationMonths?: number;
}) {
  const { contract, durationMonths = 12 } = params;
  const contractNumber = contract.contract_number || contract.id;
  const tenantId = contract.tenant_id || contract.tenant?.id || 'usr_tenant';
  const tenantName = contract.tenant_name || contract.tenant?.full_name || 'Locataire';
  const propertyTitle = contract.property_title || contract.property?.title || 'Logement';

  const expiry = getContractExpiryDetails(contract);
  const newEndDate = new Date(expiry.endDateObj);
  newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
  const newEndDateStr = newEndDate.toLocaleDateString('fr-FR');
  const newDurationTotal = Number(contract.duration_months || 12) + durationMonths;

  // 1. Mettre à jour dans le localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('locatrust_contracts');
    if (stored) {
      const list = JSON.parse(stored);
      if (Array.isArray(list)) {
        const updated = list.map((c: any) => {
          if (c.contract_number === contractNumber || c.id === contractNumber) {
            return {
              ...c,
              status: 'actif',
              renewal_status: 'accepte',
              duration_months: newDurationTotal,
              end_date: newEndDate.toISOString().split('T')[0],
              renewal_accepted_at: new Date().toISOString(),
              periode: `${c.signed_date || '01/10/2026'} - ${newEndDateStr} (Renouvelé +${durationMonths} mois)`
            };
          }
          return c;
        });
        localStorage.setItem('locatrust_contracts', JSON.stringify(updated));
      }
    }

    // 2. Notification de validation au locataire
    const rawNotifs = localStorage.getItem('locatrust_notifications');
    const notifs = rawNotifs ? JSON.parse(rawNotifs) : [];
    const notifItem = {
      id: `notif_renew_acc_${Date.now()}`,
      title: '✅ Renouvellement de bail accepté !',
      description: `Votre demande de renouvellement pour le bail N° ${contractNumber} (${propertyTitle}) a été acceptée. Votre bail est prolongé jusqu'au ${newEndDateStr}.`,
      timestamp: 'À l\'instant',
      category: 'contrat' as const,
      read: false,
      targetTab: 'contrats',
      targetRole: 'locataire',
      targetUserId: tenantId
    };
    notifs.unshift(notifItem);
    localStorage.setItem('locatrust_notifications', JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
  }

  // 3. Message écrit dans le tchat
  try {
    sendChatMessage(
      contract.owner_id || 'usr_owner',
      tenantId,
      `✅ RENOUVELLEMENT DE BAIL VALIDÉ\n\nCher(e) ${tenantName},\nNous avons le plaisir de vous confirmer que votre contrat de bail N° ${contractNumber} pour le bien "${propertyTitle}" a été renouvelé avec succès pour une nouvelle période de ${durationMonths} mois.\n\nNouvelle date de fin de contrat : ${newEndDateStr}.\n\nLocaTrust vous remercie pour votre confiance.`
    );
  } catch {}

  // 4. Mise à jour Supabase
  try {
    await supabase
      .from('contracts')
      .update({
        status: 'actif',
        renewal_status: 'accepte',
        duration_months: newDurationTotal,
        end_date: newEndDate.toISOString().split('T')[0]
      })
      .or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
  } catch {}

  return { newEndDateStr, newDurationTotal };
}

/**
 * Action Propriétaire / Agence : Refuser le renouvellement du contrat
 * Le contrat prendra fin à sa date d'échéance convenue, sans reconduction.
 */
export async function refuseContractRenewal(params: {
  contract: any;
  reason?: string;
}) {
  const { contract, reason = 'Non-reconduction du bail à son terme convenu' } = params;
  const contractNumber = contract.contract_number || contract.id;
  const tenantId = contract.tenant_id || contract.tenant?.id || 'usr_tenant';
  const tenantName = contract.tenant_name || contract.tenant?.full_name || 'Locataire';
  const propertyTitle = contract.property_title || contract.property?.title || 'Logement';
  const expiry = getContractExpiryDetails(contract);

  // 1. Mettre à jour dans le localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('locatrust_contracts');
    if (stored) {
      const list = JSON.parse(stored);
      if (Array.isArray(list)) {
        const updated = list.map((c: any) => {
          if (c.contract_number === contractNumber || c.id === contractNumber) {
            return {
              ...c,
              renewal_status: 'refuse',
              renewal_refusal_reason: reason,
              renewal_refused_at: new Date().toISOString()
            };
          }
          return c;
        });
        localStorage.setItem('locatrust_contracts', JSON.stringify(updated));
      }
    }

    // 2. Notification officielle au locataire
    const rawNotifs = localStorage.getItem('locatrust_notifications');
    const notifs = rawNotifs ? JSON.parse(rawNotifs) : [];
    const notifItem = {
      id: `notif_renew_ref_${Date.now()}`,
      title: '❌ Non-renouvellement du contrat de bail',
      description: `Le bailleur a notifié que le bail N° ${contractNumber} (${propertyTitle}) ne sera pas renouvelé. Il prendra fin le ${expiry.endDateFormatted}. Motif : ${reason}.`,
      timestamp: 'À l\'instant',
      category: 'contrat' as const,
      read: false,
      targetTab: 'contrats',
      targetRole: 'locataire',
      targetUserId: tenantId
    };
    notifs.unshift(notifItem);
    localStorage.setItem('locatrust_notifications', JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
  }

  // 3. Message écrit dans le tchat
  try {
    sendChatMessage(
      contract.owner_id || 'usr_owner',
      tenantId,
      `❌ AVIS DE NON-RENOUVELLEMENT DU BAIL\n\nCher(e) ${tenantName},\nNous vous informons que le contrat de bail N° ${contractNumber} pour "${propertyTitle}" ne fera pas l'objet d'un renouvellement et prendra fin à son échéance contractuelle le ${expiry.endDateFormatted}.\n\nMotif : ${reason}.\n\nL'état des lieux de sortie et les modalités de restitution des clés et de caution seront organisés à cette date.`
    );
  } catch {}

  // 4. Mise à jour Supabase
  try {
    await supabase
      .from('contracts')
      .update({
        renewal_status: 'refuse',
        renewal_refused_at: new Date().toISOString()
      })
      .or(`contract_number.eq.${contractNumber},id.eq.${contractNumber}`);
  } catch {}
}
