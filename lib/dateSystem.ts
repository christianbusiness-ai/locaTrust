/**
 * LocaTrust Date & Calendar System
 * Moteur centralisé d'extraction de la date réelle de la machine (smartphone/ordinateur),
 * calcul dynamique des échéances par contrat et rappels automatiques d'échéance à J-3.
 */

import { formatFCFA } from '@/lib/utils';
import { sendChatMessage } from '@/lib/messagingStore';

export interface ContractDueDetails {
  contractId: string;
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  ownerId: string;
  ownerName: string;
  tenantId: string;
  tenantName: string;
  rentAmount: number;
  signedDate: string;
  dueDay: number;
  nextDueDate: Date;
  nextDueDateFormatted: string;
  daysRemaining: number;
  status: 'paid' | 'due_today' | 'due_soon_3_days' | 'upcoming' | 'overdue';
  overdueDays: number;
  targetMonthLabel: string;
  targetMonthKey: string;
  isPaidThisMonth: boolean;
}

/**
 * Extrait la date réelle du système (téléphone, tablette ou ordinateur)
 */
export function getDeviceDate(): Date {
  return new Date();
}

/**
 * Formate la date réelle de l'appareil en français
 */
export function getDeviceDateFormatted(style: 'short' | 'long' | 'iso' | 'full' = 'long'): string {
  const now = getDeviceDate();
  if (style === 'iso') {
    return now.toISOString().split('T')[0];
  }
  if (style === 'short') {
    return now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  if (style === 'full') {
    const dateStr = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${capitalize(dateStr)} à ${timeStr}`;
  }
  // long
  return capitalize(now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Parse une chaîne de date sous divers formats (ISO, JJ/MM/AAAA, etc.)
 */
export function parseAnyDate(input?: any): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  
  const str = String(input).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

/**
 * Calcule l'échéance exacte d'un contrat en fonction de sa date de signature / début
 * et de l'historique des paiements déjà effectués.
 */
export function calculateContractDueDetails(
  contract: any,
  paidPayments: any[] = []
): ContractDueDetails {
  const now = getDeviceDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const todayDay = now.getDate();

  // Extraction de la date de signature ou de prise d'effet réelle
  const rawSignedDate =
    contract.signed_date ||
    contract.start_date ||
    contract.created_at ||
    getDeviceDateFormatted('iso');
  
  const signedDateObj = parseAnyDate(rawSignedDate);
  
  // Jour contractuel d'exigibilité :
  // Si le contrat a été signé un 16 ou 17, l'échéance mensuelle tombe ce même jour
  // sauf si un due_day explicite (ex: le 05) a été convenu.
  const signedDay = signedDateObj.getDate();
  const dueDay = contract.due_day ? Number(contract.due_day) : (signedDay || 5);
  
  const rentAmount = Number(
    contract.monthly_rent ||
    contract.rent ||
    contract.rent_amount ||
    30000
  );

  const contractNumber =
    contract.contract_number ||
    contract.id ||
    'LT-2026-CI-000492';

  const propertyTitle =
    contract.property?.title ||
    contract.property_title ||
    'Logement LocaTrust';

  const propertyAddress =
    contract.property?.address ||
    contract.property_address ||
    'Abidjan - Côte d\'Ivoire';

  const ownerId =
    contract.owner_id ||
    contract.owner?.id ||
    'usr_owner';

  const ownerName =
    contract.owner?.full_name ||
    contract.owner_name ||
    'Bailleur';

  const tenantId =
    contract.tenant_id ||
    contract.tenant?.id ||
    'usr_tenant';

  const tenantName =
    contract.tenant?.full_name ||
    contract.tenant_name ||
    'Locataire';

  // Vérifier si le loyer du mois courant (ou de la période courante) a déjà été payé et validé
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  
  const isPaidThisMonth = paidPayments.some((p: any) => {
    const isMatchingContract =
      p.contract_id === contract.id ||
      p.contract_number === contractNumber ||
      p.reference?.includes(contractNumber) ||
      (contract.property_id && p.property_id === contract.property_id);

    const isConfirmed = p.status === 'confirme' || p.status === 'validé' || p.status === 'valide';
    if (!isConfirmed) return false;

    // Correspondance sur le mois cible ou la date de paiement
    const pMonth = p.target_month ? String(p.target_month).slice(0, 7) : '';
    const pDate = p.created_at || p.payment_date || '';
    const isThisMonth = pMonth === currentMonthKey || pDate.includes(currentMonthKey);

    return isMatchingContract && isThisMonth;
  });

  // Calcul de la date de la prochaine échéance
  let nextDueDate: Date;
  let targetMonthObj: Date;

  if (isPaidThisMonth) {
    // Si le mois en cours est déjà payé (ex: payé le 17 octobre),
    // la prochaine échéance est le mois suivant (ex: 17 novembre)
    targetMonthObj = new Date(currentYear, currentMonth + 1, 1);
    nextDueDate = new Date(currentYear, currentMonth + 1, dueDay);
  } else {
    // Si pas encore payé ce mois-ci :
    // Est-ce que le jour d'échéance de ce mois est déjà passé ou à venir ?
    if (todayDay > dueDay) {
      // Échéance de ce mois est passée et impayée (en retard)
      targetMonthObj = new Date(currentYear, currentMonth, 1);
      nextDueDate = new Date(currentYear, currentMonth, dueDay);
    } else {
      // Échéance de ce mois est à venir
      targetMonthObj = new Date(currentYear, currentMonth, 1);
      nextDueDate = new Date(currentYear, currentMonth, dueDay);
    }
  }

  // Calcul du nombre de jours restants
  // Mise à zéro des heures pour calcul de jours entiers
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueMidnight = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate()).getTime();
  const diffMs = dueMidnight - nowMidnight;
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let status: 'paid' | 'due_today' | 'due_soon_3_days' | 'upcoming' | 'overdue' = 'upcoming';
  let overdueDays = 0;

  if (isPaidThisMonth && daysRemaining > 15) {
    status = 'paid';
  } else if (daysRemaining === 0) {
    status = 'due_today';
  } else if (daysRemaining < 0) {
    status = 'overdue';
    overdueDays = Math.abs(daysRemaining);
  } else if (daysRemaining <= 3) {
    status = 'due_soon_3_days';
  } else {
    status = 'upcoming';
  }

  const nextDueDateFormatted = nextDueDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const targetMonthLabel = targetMonthObj.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });

  const targetMonthKey = `${targetMonthObj.getFullYear()}-${String(targetMonthObj.getMonth() + 1).padStart(2, '0')}-01`;

  return {
    contractId: contract.id || contractNumber,
    contractNumber,
    propertyTitle,
    propertyAddress,
    ownerId,
    ownerName,
    tenantId,
    tenantName,
    rentAmount,
    signedDate: rawSignedDate,
    dueDay,
    nextDueDate,
    nextDueDateFormatted,
    daysRemaining,
    status,
    overdueDays,
    targetMonthLabel: capitalize(targetMonthLabel),
    targetMonthKey,
    isPaidThisMonth
  };
}

/**
 * Moteur d'alerte automatique à J-3 (détecte et envoie les notifications réelles)
 */
export function checkAndTriggerRentDueAlerts(currentUserId?: string): ContractDueDetails[] {
  if (typeof window === 'undefined') return [];

  try {
    // 1. Récupération des contrats actifs
    let contracts: any[] = [];
    const storedContracts = localStorage.getItem('locatrust_contracts');
    if (storedContracts) {
      try {
        const parsed = JSON.parse(storedContracts);
        if (Array.isArray(parsed)) contracts = parsed;
      } catch {}
    }

    // Récupération des applications en contrat_actif
    const storedApps = localStorage.getItem('locatrust_rental_applications');
    if (storedApps) {
      try {
        const parsedApps = JSON.parse(storedApps);
        if (Array.isArray(parsedApps)) {
          parsedApps
            .filter((a: any) => a.status === 'contrat_actif')
            .forEach((a: any) => {
              if (!contracts.some((c) => c.contract_number === a.contract_number || c.id === a.id)) {
                contracts.push({
                  id: a.id,
                  contract_number: a.contract_number || `LT-2026-CI-000492`,
                  property_title: a.property_title,
                  property_address: a.property_address,
                  rent: Number(a.rent_amount || 30000),
                  monthly_rent: Number(a.rent_amount || 30000),
                  signed_date: a.signed_date || a.created_at || getDeviceDateFormatted('iso'),
                  tenant_id: a.tenant_id,
                  tenant_name: a.applicant_name || a.tenant_name || 'Christian',
                  owner_id: a.owner_id,
                  owner_name: a.owner_name || 'KK',
                  due_day: 17
                });
              }
            });
        }
      } catch {}
    }

    // 2. Récupération des paiements validés
    let payments: any[] = [];
    const storedPmts = localStorage.getItem('locatrust_rent_payments');
    if (storedPmts) {
      try {
        const parsed = JSON.parse(storedPmts);
        if (Array.isArray(parsed)) payments = parsed;
      } catch {}
    }
    const storedReceipts = localStorage.getItem('locatrust_tenant_receipts_v2');
    if (storedReceipts) {
      try {
        const parsed = JSON.parse(storedReceipts);
        if (Array.isArray(parsed)) {
          parsed.forEach((rcp: any) => {
            payments.push({
              ...rcp,
              status: 'confirme',
              contract_id: rcp.contractNumber || rcp.contract_id,
              target_month: rcp.periodCovered
            });
          });
        }
      } catch {}
    }

    const todayIso = getDeviceDateFormatted('iso');
    const alertsToReturn: ContractDueDetails[] = [];

    // 3. Analyse de chaque contrat
    contracts.forEach((contract) => {
      const details = calculateContractDueDetails(contract, payments);
      alertsToReturn.push(details);

      // Si l'échéance est dans 3 jours ou moins (J-3, J-2, J-1, Jour J) et non encore payée
      if (details.status === 'due_soon_3_days' || details.status === 'due_today') {
        const reminderSentKey = `locatrust_due_alert_sent_${details.contractNumber}_${details.targetMonthKey}_${todayIso}`;
        const alreadySentToday = localStorage.getItem(reminderSentKey);

        if (!alreadySentToday) {
          // Créer la notification pour le locataire et le propriétaire
          const notifTitle =
            details.status === 'due_today'
              ? '🔔 Échéance de loyer due AUJOURD\'HUI'
              : `⏳ Rappel de loyer : Échéance dans ${details.daysRemaining} jour${details.daysRemaining > 1 ? 's' : ''}`;

          const notifDescription =
            details.status === 'due_today'
              ? `Votre loyer de ${formatFCFA(details.rentAmount)} pour "${details.propertyTitle}" est exigible aujourd'hui (${details.nextDueDateFormatted}).`
              : `Votre loyer de ${formatFCFA(details.rentAmount)} pour "${details.propertyTitle}" arrive à échéance le ${details.nextDueDateFormatted} (dans ${details.daysRemaining} jours).`;

          // Injection dans locatrust_notifications
          try {
            const rawNotifs = localStorage.getItem('locatrust_notifications');
            let notifsList: any[] = [];
            if (rawNotifs) {
              try {
                notifsList = JSON.parse(rawNotifs);
              } catch {}
            }

            const newNotif = {
              id: `notif_due_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: notifTitle,
              description: notifDescription,
              timestamp: 'À l\'instant',
              category: 'paiement',
              read: false,
              targetTab: 'paiements'
            };

            notifsList.unshift(newNotif);
            localStorage.setItem('locatrust_notifications', JSON.stringify(notifsList));

            // Notifier également dans la messagerie interne
            if (details.ownerId && details.tenantId) {
              sendChatMessage(
                'system_bot',
                details.tenantId,
                `📅 ALERTE ÉCHÉANCE DE LOYER (J-${details.daysRemaining})\n\nBonjour ${details.tenantName},\n\nVotre prochain loyer d'un montant de ${formatFCFA(details.rentAmount)} pour le logement "${details.propertyTitle}" arrive à échéance le ${details.nextDueDateFormatted}.\n\nPensez à effectuer votre déclaration de règlement via Mobile Money ou virement pour recevoir votre quittance certifiée conforme.\n\nCordialement,\nLocaTrust Automate`
              );
            }

            // Marquer comme envoyé pour aujourd'hui
            localStorage.setItem(reminderSentKey, 'true');

            // Dispatch live update
            window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { newNotif } }));
          } catch (e) {
            console.warn('Erreur envoi alerte J-3 loyer:', e);
          }
        }
      }
    });

    return alertsToReturn;
  } catch (err) {
    console.error('Erreur checkAndTriggerRentDueAlerts:', err);
    return [];
  }
}
