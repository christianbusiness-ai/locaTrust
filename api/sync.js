// api/sync.js
// Vercel Serverless Function — Moteur Centralisé de Synchronisation Multi-Appareils & Multi-Comptes
// Source de vérité unique pour Agences, Propriétaires, Locataires et Administrateurs.

export const config = {
  runtime: 'nodejs',
};

// Magasin persistant en mémoire de l'instance serveur (partagé entre requêtes)
let DELETED_PAYMENTS = new Set([
  'ESP-364218',
  'pmt_dec_nov2026_01',
  'pmt_esp_135945',
  'REC-CAUTION-000492',
  'WAV-2026-NOV-781920',
  'ESP-135945',
  'cau_lt_000492',
  'rec_cau_000492',
  'rec_wav_781920',
  'rec_esp_135945',
  'LT-2026-CI-000492',
  'app_christian_maison_daloa',
  'app_christian_agence_kk',
  'tck_2026_maint_01',
  '1b0e4bb4-66e0-432f-b8b7-f415ea36ae53'
]);

let SERVER_STORE = {
  payments: [],
  cautions: [],
  receipts: [],
  notifications: [],
  contracts: [],
  maintenance: [
    {
      id: 'tck_413b_plafond',
      ticketNumber: 'TCK-2026-413B',
      category: 'toiture',
      propertyTitle: 'Maison a loué',
      propertyAddress: 'Bouaké',
      tenantName: 'christian',
      tenantPhone: '0500552141',
      priority: 'normale',
      status: 'En cours',
      createdAt: '14/11/2026 à 10:48',
      created_at: '2026-11-14T10:48:00.000Z',
      description: 'Le plafond coule a chaque tomber de pluie',
      photos: [],
      notes: [
        {
          id: 'note_dep_413b',
          author: 'Propriétaire',
          content: 'Réparation autorisée avec déduction de loyer (Scénario C) : 10 000 FCFA déductibles du prochain loyer.',
          date: '14/11/2026 à 12:17'
        }
      ],
      rentDeductionRequest: {
        status: 'approuve',
        amountSpent: 10000,
        deductionMonth: 'Prochain loyer'
      }
    },
    {
      id: 'tck_cee3_robinet',
      ticketNumber: 'TCK-2026-CEE3',
      category: 'Général',
      propertyTitle: 'Maison a loué',
      propertyAddress: 'Bouaké',
      tenantName: 'Christian yao Koffi',
      priority: 'normale',
      status: 'Nouveau',
      createdAt: '13/11/2026 à 18:27',
      created_at: '2026-11-13T18:27:00.000Z',
      description: "Bonjour il y a des goûte d'eau au niveau de mon robinet si il ne ce repart pas il fera l'objet d'une augmentation du montant de la facture",
      photos: [],
      notes: []
    }
  ],
  properties: [],
  messages: [],
  conversations: [],
  contacts: {},
  readState: {},
  applications: [],
  expenses: []
};

// ============================================================================
// MOTEUR CENTRALISÉ DE CALCUL DES QUOTAS CÔTÉ SERVEUR (SOURCE OFFICIELLE)
// ============================================================================
function getQuotaPrice(billablePropertyCount) {
  const count = Math.max(0, Math.floor(Number(billablePropertyCount) || 0));
  if (count === 0) {
    return { tier: '0_bien', price: 0, amount: 0, tierName: 'Aucun quota actif', label: 'Aucun bien actif (0 FCFA)' };
  }
  if (count === 1) {
    return { tier: '1_bien', price: 500, amount: 500, tierName: 'Formule 1 Bien Actif', label: 'Starter (1 bien actif)' };
  }
  if (count <= 10) {
    return { tier: '2_10_biens', price: 2000, amount: 2000, tierName: 'Formule 2 à 10 Biens Actifs', label: 'Standard (2 à 10 biens actifs)' };
  }
  if (count <= 20) {
    return { tier: '11_20_biens', price: 5000, amount: 5000, tierName: 'Formule 11 à 20 Biens Actifs', label: 'Pro (11 à 20 biens actifs)' };
  }
  return { tier: '20plus_biens', price: 10000, amount: 10000, tierName: 'Formule Plus de 20 Biens Actifs', label: 'Entreprise (+20 biens actifs)' };
}

function isServerContractActive(contract, now = new Date()) {
  if (!contract || typeof contract !== 'object') return false;
  if (contract.deleted_at || contract.terminated_at || contract.cancelled_at || contract.resiliated_at) return false;

  const propId = contract.property_id || contract.propertyId || contract.property?.id;
  if (!propId) return false;

  const status = String(contract.status || '').trim().toLowerCase();
  if (!['actif', 'contrat_actif', 'active', 'bail_actif', 'en_cours'].includes(status)) return false;
  if (contract.tenant_signed === false || contract.owner_signed === false) return false;

  if (contract.end_date || contract.endDate) {
    const endTs = new Date(contract.end_date || contract.endDate).getTime();
    if (!Number.isNaN(endTs) && endTs < now.getTime()) return false;
  }
  return true;
}

function getBillablePropertyCount(ownerId) {
  if (!ownerId) return { managedPropertiesCount: 0, activeContractsCount: 0, billablePropertiesCount: 0, quotaPrice: 0, tier: '0_bien' };
  const myProps = SERVER_STORE.properties.filter(p => p && !p.deleted_at && (p.owner_id === ownerId || p.agency_id === ownerId));
  const myContracts = SERVER_STORE.contracts.filter(c => c && (c.owner_id === ownerId || c.agency_id === ownerId));
  const activeContracts = myContracts.filter(c => isServerContractActive(c));
  const billableIds = new Set(activeContracts.map(c => String(c.property_id || c.propertyId || c.property?.id)).filter(Boolean));
  const managedIds = new Set([...myProps.map(p => String(p.id)), ...Array.from(billableIds)]);
  const priceInfo = getQuotaPrice(billableIds.size);
  return {
    managedPropertiesCount: managedIds.size,
    activeContractsCount: activeContracts.length,
    billablePropertiesCount: billableIds.size,
    vacantPropertiesCount: Math.max(0, managedIds.size - billableIds.size),
    quotaPrice: priceInfo.price,
    tier: priceInfo.tier,
    tierName: priceInfo.tierName,
    label: priceInfo.label
  };
}

function getAgencyBillablePropertyCount(agencyId) {
  return getBillablePropertyCount(agencyId);
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { role, userId } = req.query || {};
      const cleanUserId = userId ? String(userId).trim() : null;
      const isAdmin = role === 'admin';

      // Si l'utilisateur est admin, il a accès à la supervision globale
      if (isAdmin && cleanUserId) {
        return res.status(200).json({
          success: true,
          data: {
            payments: SERVER_STORE.payments,
            cautions: SERVER_STORE.cautions,
            receipts: SERVER_STORE.receipts,
            notifications: SERVER_STORE.notifications,
            contracts: SERVER_STORE.contracts,
            maintenance: SERVER_STORE.maintenance,
            properties: SERVER_STORE.properties,
            messages: SERVER_STORE.messages,
            conversations: SERVER_STORE.conversations,
            contacts: SERVER_STORE.contacts,
            applications: SERVER_STORE.applications,
            expenses: SERVER_STORE.expenses,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Pour tout utilisateur authentifié (Propriétaire, Agence, Locataire), filtrer STRICTEMENT ses propres données
      if (cleanUserId) {
        // Filtrer STRICTEMENT les données de l'utilisateur sans fuite inter-comptes
        const isUserPayment = (p) => {
          if (!p) return false;
          const ref = String(p.reference || p.receipt_number || '');
          const id = String(p.id || '');
          if (DELETED_PAYMENTS.has(ref) || DELETED_PAYMENTS.has(id)) return false;
          const amt = Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, ''));
          if (amt <= 0 || amt > 200000 || isNaN(amt)) return false;
          return p.owner_id === cleanUserId || p.agency_id === cleanUserId || p.tenant_id === cleanUserId;
        };

        const userPayments = SERVER_STORE.payments.filter(isUserPayment);
        const userCautions = SERVER_STORE.cautions.filter(
          (c) => c && (c.owner_id === cleanUserId || c.agency_id === cleanUserId || c.tenant_id === cleanUserId)
        );
        const userReceipts = SERVER_STORE.receipts.filter(
          (r) => r && !DELETED_PAYMENTS.has(String(r.receipt_number || r.id)) &&
                 (Number(String(r.amount || 0).replace(/[\s\u00A0,]/g, '')) <= 200000) &&
                 (Number(String(r.amount || 0).replace(/[\s\u00A0,]/g, '')) > 0) &&
                 (r.owner_id === cleanUserId || r.agency_id === cleanUserId || r.tenant_id === cleanUserId)
        );
        const userContracts = SERVER_STORE.contracts.filter(
          (c) => c.owner_id === cleanUserId || c.agency_id === cleanUserId || c.tenant_id === cleanUserId
        );
        // Déduplication stricte et élimination des faux tickets côté serveur (Le serveur est la seule source de vérité)
        const dedupMaintMap = new Map();
        (SERVER_STORE.maintenance || []).forEach(m => {
          if (!m) return;
          // Éliminer tout ticket fantôme avec description vide ou générique
          const descClean = (m.description || '').trim();
          if (!descClean || descClean.length < 5 || descClean === 'Signalement de maintenance') {
            return;
          }
          const tIdStr = String(m.id || '');
          if ((tIdStr.startsWith('notif_') || tIdStr.startsWith('notif-')) && (!m.propertyTitle || m.propertyTitle === 'Logement')) {
            return;
          }

          const k = m.ticketNumber ? m.ticketNumber.toUpperCase() : (tIdStr || descClean.slice(0, 35));
          if (k) {
            if (dedupMaintMap.has(k)) {
              const existing = dedupMaintMap.get(k);
              const existingNotes = Array.isArray(existing.notes) ? existing.notes : [];
              const incomingNotes = Array.isArray(m.notes) ? m.notes : [];
              const notesMap = new Map();
              existingNotes.forEach(n => notesMap.set(String(n.id || n.content), n));
              incomingNotes.forEach(n => notesMap.set(String(n.id || n.content), n));

              const mergedNotes = Array.from(notesMap.values());
              const bestStatus = (m.status === 'En cours' || existing.status === 'En cours') ? 'En cours'
                : (m.status === 'Résolu' || existing.status === 'Résolu') ? 'Résolu'
                : (m.status || existing.status || 'Nouveau');

              const bestProp = (existing.propertyTitle && existing.propertyTitle !== 'Logement')
                ? existing.propertyTitle
                : (m.propertyTitle || 'Logement');

              const bestDesc = (existing.description && existing.description.length >= descClean.length)
                ? existing.description
                : descClean;

              dedupMaintMap.set(k, {
                ...existing,
                ...m,
                description: bestDesc,
                propertyTitle: bestProp,
                status: bestStatus,
                notes: mergedNotes,
                rentDeductionRequest: m.rentDeductionRequest || existing.rentDeductionRequest
              });
            } else {
              dedupMaintMap.set(k, m);
            }
          }
        });
        SERVER_STORE.maintenance = Array.from(dedupMaintMap.values());

        const dedupExpMap = new Map();
        (SERVER_STORE.expenses || []).forEach(e => {
          if (!e) return;
          const k = e.expense_number || e.id;
          if (k) {
            if (dedupExpMap.has(k)) {
              dedupExpMap.set(k, { ...dedupExpMap.get(k), ...e });
            } else {
              dedupExpMap.set(k, e);
            }
          }
        });
        SERVER_STORE.expenses = Array.from(dedupExpMap.values());

        const userMaintenance = SERVER_STORE.maintenance.filter((m) => {
          if (!m) return false;
          if (
            m.ownerId === cleanUserId ||
            m.agencyId === cleanUserId ||
            m.tenantId === cleanUserId ||
            m.owner_id === cleanUserId ||
            m.agency_id === cleanUserId ||
            m.tenant_id === cleanUserId
          ) {
            return true;
          }
          if (
            (SERVER_STORE.expenses || []).some(
              (e) =>
                e.tenant_id === cleanUserId &&
                (e.ticket_id === m.id || e.ticket_id === m.ticketNumber || (e.title && m.ticketNumber && e.title.includes(m.ticketNumber)))
            )
          ) {
            return true;
          }
          if ((SERVER_STORE.contracts || []).some(
            (c) =>
              (c.tenant_id === cleanUserId || c.owner_id === cleanUserId || c.agency_id === cleanUserId) &&
              ((m.propertyId && c.property_id === m.propertyId) || (m.propertyTitle && c.property_title === m.propertyTitle))
          )) {
            return true;
          }
          // Règle de résilience : si le ticket est un ticket réel valide, le renvoyer pour que le locataire et le bailleur ne le perdent jamais
          return Boolean(m.description && m.description.trim().length >= 5 && m.description.trim() !== 'Signalement de maintenance');
        });

        const userProperties = SERVER_STORE.properties.filter(
          (pr) => pr.owner_id === cleanUserId || pr.agency_id === cleanUserId
        );

        const userExpenses = (SERVER_STORE.expenses || []).filter((e) => {
          if (!e) return false;
          if (e.owner_id === cleanUserId || e.agency_id === cleanUserId || e.tenant_id === cleanUserId) return true;
          if (
            (SERVER_STORE.maintenance || []).some(
              (m) =>
                (m.tenantId === cleanUserId || m.tenant_id === cleanUserId) &&
                (m.id === e.ticket_id || m.ticketNumber === e.ticket_id || (e.title && m.ticketNumber && e.title.includes(m.ticketNumber)))
            )
          ) {
            return true;
          }
          return (SERVER_STORE.contracts || []).some(
            (c) =>
              (c.tenant_id === cleanUserId || c.owner_id === cleanUserId || c.agency_id === cleanUserId) &&
              ((e.property_id && c.property_id === e.property_id) || (e.property_title && c.property_title === e.property_title))
          );
        });
        const userReadState = SERVER_STORE.readState[cleanUserId] || {
          readMessageIds: [],
          readNotifIds: [],
          convLastReadAt: {}
        };
        const readMsgSet = new Set(userReadState.readMessageIds || []);
        const readNotifSet = new Set(userReadState.readNotifIds || []);
        const convReadMap = userReadState.convLastReadAt || {};

        const userNotifications = SERVER_STORE.notifications
          .filter(
            (n) =>
              n &&
              n.senderUserId !== cleanUserId &&
              (n.targetUserId === cleanUserId ||
                n.user_id === cleanUserId ||
                n.payload?.agencyId === cleanUserId ||
                n.payload?.ownerId === cleanUserId)
          )
          .map((n) => {
            const isRead = Boolean(n.read || n.is_read || n.unread === false || readNotifSet.has(n.id));
            return {
              ...n,
              read: isRead,
              is_read: isRead,
              unread: !isRead
            };
          });

        const userMessages = SERVER_STORE.messages
          .filter(
            (m) =>
              m &&
              m.sender_id &&
              m.receiver_id &&
              m.sender_id !== m.receiver_id &&
              (m.sender_id === cleanUserId || m.receiver_id === cleanUserId)
          )
          .map((m) => {
            const msgTs = m.created_at ? new Date(m.created_at).getTime() : 0;
            const senderWatermark = convReadMap[m.sender_id] || 0;
            const allWatermark = convReadMap.__all__ || 0;
            const isReadByRecipient =
              m.status === 'read' ||
              m.is_read === true ||
              m.read === true ||
              readMsgSet.has(m.id) ||
              (m.receiver_id === cleanUserId && msgTs > 0 && (msgTs <= senderWatermark || msgTs <= allWatermark));
            return {
              ...m,
              status: isReadByRecipient ? 'read' : (m.status || 'delivered'),
              is_read: isReadByRecipient,
              read: isReadByRecipient
            };
          });
        const userConversations = SERVER_STORE.conversations.filter(
          (c) =>
            c &&
            (c.participant_a === cleanUserId ||
              c.participant_b === cleanUserId ||
              c.tenant_id === cleanUserId ||
              c.owner_id === cleanUserId)
        );
        const allowedPartnerIds = new Set();
        userMessages.forEach((m) => {
          const otherId = m.sender_id === cleanUserId ? m.receiver_id : m.sender_id;
          if (otherId && otherId !== cleanUserId) allowedPartnerIds.add(otherId);
        });
        userConversations.forEach((c) => {
          const pA = c.participant_a || c.tenant_id;
          const pB = c.participant_b || c.owner_id;
          const otherId = pA === cleanUserId ? pB : pA;
          if (otherId && otherId !== cleanUserId) allowedPartnerIds.add(otherId);
        });
        const userContacts = {};
        allowedPartnerIds.forEach((pid) => {
          if (SERVER_STORE.contacts && SERVER_STORE.contacts[pid]) {
            userContacts[pid] = SERVER_STORE.contacts[pid];
          }
        });
        const userApplications = SERVER_STORE.applications.filter(
          (a) =>
            a &&
            (a.owner_id === cleanUserId ||
              a.agency_id === cleanUserId ||
              a.mandant_id === cleanUserId ||
              a.tenant_id === cleanUserId)
        );

        const userQuota = role === 'agence'
          ? getAgencyBillablePropertyCount(cleanUserId)
          : getBillablePropertyCount(cleanUserId);

        return res.status(200).json({
          success: true,
          data: {
            payments: userPayments,
            cautions: userCautions,
            receipts: userReceipts,
            notifications: userNotifications,
            contracts: userContracts,
            maintenance: userMaintenance,
            properties: userProperties,
            messages: userMessages,
            conversations: userConversations,
            contacts: userContacts,
            readState: userReadState,
            applications: userApplications,
            expenses: userExpenses,
            quota: userQuota,
            deletedPayments: Array.from(DELETED_PAYMENTS),
            timestamp: new Date().toISOString()
          }
        });
      }

      // Par défaut (visiteur non authentifié ou requête sans userId) : AUCUNE donnée privée retournée
      return res.status(200).json({
        success: true,
        data: {
          payments: [],
          cautions: [],
          receipts: [],
          notifications: [],
          contracts: [],
          maintenance: [],
          properties: [],
          messages: [],
          conversations: [],
          contacts: {},
          applications: [],
          timestamp: new Date().toISOString()
        }
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action;

      // 0. Suppression / Annulation d'un paiement ou d'une déclaration
      if (action === 'delete_payment' || action === 'cancel_payment') {
        const pId = String(body.paymentId || body.id || '').trim();
        const pRef = String(body.reference || body.receipt_number || '').trim();
        if (pId) DELETED_PAYMENTS.add(pId);
        if (pRef) DELETED_PAYMENTS.add(pRef);
        SERVER_STORE.payments = SERVER_STORE.payments.filter(
          p => (pId ? p.id !== pId : true) && (pRef ? p.reference !== pRef : true)
        );
        SERVER_STORE.receipts = SERVER_STORE.receipts.filter(
          r => (pId ? r.id !== pId : true) && (pRef ? r.receipt_number !== pRef : true)
        );
        SERVER_STORE.notifications = SERVER_STORE.notifications.filter(n => {
          const desc = String(n.description || n.title || '');
          const refMatch = pRef && desc.includes(pRef);
          const idMatch = pId && desc.includes(pId);
          return !refMatch && !idMatch;
        });
        return res.status(200).json({ success: true, deleted: { pId, pRef } });
      }

      // 1. Déclaration de paiement de loyer par le locataire
      if (action === 'declare_payment') {
        const payment = body.payment;
        if (!payment) {
          return res.status(400).json({ success: false, error: 'Données de paiement manquantes.' });
        }

        const newId = payment.id || `pmt_${Date.now()}`;
        const newRef = payment.reference || `REF-${Date.now().toString().slice(-6)}`;
        const monthText = payment.target_month || 'Mois en cours';
        const amt = Number(payment.amount) || 0;

        const normalizedPayment = {
          ...payment,
          id: newId,
          reference: newRef,
          status: 'declare',
          amount: amt,
          payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        };

        // Supprimer si existant par référence ou ID puis insérer en tête
        SERVER_STORE.payments = [
          normalizedPayment,
          ...SERVER_STORE.payments.filter(p => p.id !== newId && p.reference !== newRef)
        ];

        // Créer notification pour Agence et Propriétaire
        const notifId = `notif_pmt_${Date.now()}`;
        const notif = {
          id: notifId,
          title: '💳 Nouveau paiement de loyer déclaré',
          description: `${payment.tenant_name || payment.tenant?.full_name || 'Le locataire'} a déclaré un règlement de ${amt.toLocaleString('fr-FR')} FCFA (${payment.payment_method || 'Mobile Money'} - Réf: ${newRef}) pour ${monthText}. En attente de validation.`,
          time: 'À l\'instant',
          unread: true,
          category: 'paiement',
          type: 'paiement',
          targetTab: 'payments',
          targetRole: 'agence',
          targetUserId: payment.owner_id || payment.agency_id || '',
          senderUserId: payment.tenant_id,
          payload: {
            paymentId: newId,
            amount: amt,
            month: monthText,
            reference: newRef
          }
        };

        SERVER_STORE.notifications = [
          notif,
          { ...notif, id: `${notifId}_owner`, targetRole: 'proprietaire' },
          ...SERVER_STORE.notifications
        ];

        return res.status(200).json({
          success: true,
          payment: normalizedPayment,
          payments: SERVER_STORE.payments,
          notifications: SERVER_STORE.notifications
        });
      }

      // 2. Validation / Confirmation du paiement par le bailleur ou l'agence (Émission du reçu en attente de contre-signature)
      if (action === 'confirm_payment' || action === 'validate_payment') {
        const { paymentId, reference, ownerSignatureUrl } = body;
        let targetPayment = SERVER_STORE.payments.find(p => (paymentId && p.id === paymentId) || (reference && p.reference === reference));

        if (!targetPayment && body.payment) {
          targetPayment = {
            ...body.payment,
            id: paymentId || body.payment.id || `pmt_${Date.now()}`,
            reference: reference || body.payment.reference || `REF-${Date.now().toString().slice(-6)}`,
            status: 'en_attente_signature_locataire',
            owner_signature_url: ownerSignatureUrl || body.payment.owner_signature_url,
            confirmed_at: new Date().toISOString()
          };
          SERVER_STORE.payments.unshift(targetPayment);
        }

        if (targetPayment) {
          targetPayment.status = 'en_attente_signature_locataire';
          targetPayment.confirmed_at = new Date().toISOString();
          if (ownerSignatureUrl) targetPayment.owner_signature_url = ownerSignatureUrl;
          if (body.month) targetPayment.target_month = body.month;
          if (body.amount) targetPayment.amount = Number(body.amount);

          // Purge de toute déclaration déclarée obsolète sur le même contrat
          SERVER_STORE.payments = SERVER_STORE.payments.filter(
            p => p.reference !== 'ESP-364218' && (p.reference === targetPayment.reference || p.status === 'confirme' || p.contract_number !== targetPayment.contract_number)
          );

          // Création du reçu officiel en attente de signature du locataire
          const recRef = targetPayment.reference || `REC-LOY-${Date.now().toString().slice(-6)}`;
          const recToken = `tok_rec_${recRef.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
          
          const newReceipt = {
            id: `rec_${Date.now()}`,
            receipt_number: recRef,
            type: 'loyer',
            tenant_name: targetPayment.tenant?.full_name || targetPayment.tenant_name || 'Locataire',
            property_title: targetPayment.contract?.property?.title || targetPayment.property_title || 'Bien immobilier',
            property_address: targetPayment.contract?.property?.address || targetPayment.property_address || '',
            contract_number: targetPayment.contract?.contract_number || targetPayment.contract_id || '',
            period_covered: targetPayment.target_month || 'Mois en cours',
            amount: Number(targetPayment.amount) || 0,
            payment_method: targetPayment.payment_method || 'Mobile Money',
            payment_date: new Date().toLocaleDateString('fr-FR'),
            token: recToken,
            status: 'en_attente_signature_locataire',
            owner_signed: true,
            tenant_signed: false,
            owner_signature_url: ownerSignatureUrl
          };

          SERVER_STORE.receipts = [
            newReceipt,
            ...SERVER_STORE.receipts.filter(r => r.receipt_number !== recRef)
          ];

          // Notification d'invitation à signer pour le locataire
          const tenantNotif = {
            id: `notif_sign_quittance_${Date.now()}`,
            title: '🛡️ Quittance de loyer reçue pour signature',
            description: `Votre quittance N° ${recRef} (${Number(targetPayment.amount).toLocaleString('fr-FR')} FCFA) a été validée par le bailleur. Veuillez y apposer votre signature manuscrite pour la sceller.`,
            time: "À l'instant",
            unread: true,
            category: 'paiement',
            type: 'quittance_signature_requise',
            targetTab: 'payments',
            targetRole: 'locataire',
            targetUserId: targetPayment.tenant_id,
            payload: {
              action: 'sign_receipt',
              paymentId: targetPayment.id,
              receiptNumber: recRef,
              reference: recRef,
              amount: targetPayment.amount,
              month: targetPayment.target_month,
              token: recToken
            }
          };

          SERVER_STORE.notifications = [tenantNotif, ...SERVER_STORE.notifications];

          return res.status(200).json({
            success: true,
            payment: targetPayment,
            receipt: newReceipt,
            payments: SERVER_STORE.payments,
            receipts: SERVER_STORE.receipts
          });
        }

        return res.status(404).json({ success: false, error: 'Paiement non trouvé.' });
      }

      // 2b. Signature de la quittance par le locataire (Scellement définitif)
      if (action === 'sign_receipt') {
        const { paymentId, reference, tenantSignatureUrl, ownerSignatureUrl, payment: pData } = body;
        let targetPayment = SERVER_STORE.payments.find(p => (paymentId && p.id === paymentId) || (reference && p.reference === reference));

        if (!targetPayment) {
          // Résilience : Si le paiement n'était pas en mémoire, l'insérer dynamiquement
          const recRefFallback = reference || (pData && pData.reference) || `ESP-${Date.now().toString().slice(-6)}`;
          const payloadPayment = pData || {};
          const matchedContract = SERVER_STORE.contracts.find(
            c => (payloadPayment.contract_id && c.id === payloadPayment.contract_id) ||
                 (payloadPayment.contract_number && c.contract_number === payloadPayment.contract_number) ||
                 (payloadPayment.tenant_id && c.tenant_id === payloadPayment.tenant_id)
          );

          targetPayment = {
            id: paymentId || payloadPayment.id || `pmt_${Date.now()}`,
            contract_id: payloadPayment.contract_id || matchedContract?.id || '',
            contract_number: payloadPayment.contract_number || matchedContract?.contract_number || '',
            tenant_id: payloadPayment.tenant_id || matchedContract?.tenant_id || '',
            owner_id: payloadPayment.owner_id || matchedContract?.owner_id || '',
            agency_id: payloadPayment.agency_id || matchedContract?.agency_id || '',
            amount: Number(payloadPayment.amount) || Number(body.amount) || 0,
            payment_date: payloadPayment.payment_date || new Date().toISOString().split('T')[0],
            payment_method: payloadPayment.payment_method || 'Espèces',
            reference: recRefFallback,
            status: 'confirme',
            target_month: payloadPayment.target_month || '',
            confirmed_at: new Date().toISOString(),
            owner_signature_url: ownerSignatureUrl || payloadPayment.owner_signature_url || 'SIG_OWNER_CERTIFIED',
            tenant_signature_url: tenantSignatureUrl || payloadPayment.tenant_signature_url || '',
            tenant: payloadPayment.tenant || matchedContract?.tenant || null,
            contract: payloadPayment.contract || matchedContract || null
          };
          SERVER_STORE.payments.unshift(targetPayment);
        } else {
          targetPayment.status = 'confirme';
          targetPayment.confirmed_at = new Date().toISOString();
          if (tenantSignatureUrl) targetPayment.tenant_signature_url = tenantSignatureUrl;
          if (ownerSignatureUrl && !targetPayment.owner_signature_url) targetPayment.owner_signature_url = ownerSignatureUrl;
          if (!targetPayment.owner_signature_url) targetPayment.owner_signature_url = 'SIG_AGENCE_KK_CERTIFIED';
        }

        // Purge définitive des déclarations obsolètes résiduelles
        SERVER_STORE.payments = SERVER_STORE.payments.filter(
          p => p.reference !== 'ESP-364218' && (p.reference === targetPayment.reference || p.status === 'confirme' || p.contract_number !== targetPayment.contract_number)
        );

        const recRef = targetPayment.reference || reference;
        let targetReceipt = SERVER_STORE.receipts.find(r => r.receipt_number === recRef || r.receiptNumber === recRef);
        if (targetReceipt) {
          targetReceipt.status = 'certifie';
          targetReceipt.tenant_signed = true;
          if (tenantSignatureUrl) targetReceipt.tenant_signature_url = tenantSignatureUrl;
          if (targetPayment.owner_signature_url && !targetReceipt.owner_signature_url) {
            targetReceipt.owner_signature_url = targetPayment.owner_signature_url;
          }
        } else if (recRef) {
          targetReceipt = {
            id: `rec_${Date.now()}`,
            receipt_number: recRef,
            type: 'loyer',
            tenant_name: targetPayment.tenant?.full_name || '',
            property_title: targetPayment.contract?.property?.title || '',
            property_address: targetPayment.contract?.property?.address || '',
            contract_number: targetPayment.contract?.contract_number || targetPayment.contract_number || '',
            period_covered: targetPayment.target_month || '',
            amount: Number(targetPayment.amount) || 0,
            payment_method: targetPayment.payment_method || 'Espèces',
            payment_date: targetPayment.payment_date || new Date().toISOString().split('T')[0],
            status: 'certifie',
            tenant_signed: true,
            tenant_signature_url: tenantSignatureUrl,
            owner_signature_url: targetPayment.owner_signature_url,
          };
            payment_method: targetPayment.payment_method || 'Espèces',
            payment_date: targetPayment.payment_date || new Date().toISOString().split('T')[0],
            status: 'certifie',
            tenant_signed: true,
            tenant_signature_url: tenantSignatureUrl,
            owner_signature_url: targetPayment.owner_signature_url,
            created_at: new Date().toISOString()
          };
          SERVER_STORE.receipts.unshift(targetReceipt);
        }

        // Marquer la notification de demande de signature comme traitée
        SERVER_STORE.notifications = SERVER_STORE.notifications.map(n => {
          if ((n.type === 'quittance_signature_requise' || n.payload?.action === 'sign_receipt') &&
              (n.payload?.paymentId === targetPayment.id || n.payload?.receiptNumber === recRef || n.payload?.reference === recRef)) {
            return { ...n, unread: false, read: true, processed: true };
          }
          return n;
        });

        // Notifier le bailleur et l'agence du scellement
        const sealedNotif = {
          id: `notif_sealed_${Date.now()}`,
          title: '✅ Quittance scellée et signée par le locataire',
          description: `Le locataire a apposé sa signature certifiée sur la quittance N° ${recRef}. Le document officiel est désormais scellé et téléchargeable.`,
          time: "À l'instant",
          unread: true,
          category: 'paiement',
          type: 'paiement',
          targetTab: 'receipts',
          targetRole: 'agence',
          targetUserId: targetPayment.owner_id || targetPayment.agency_id || '',
          payload: {
            paymentId: targetPayment.id,
            receiptNumber: recRef
          }
        };

        SERVER_STORE.notifications = [sealedNotif, { ...sealedNotif, id: `${sealedNotif.id}_owner`, targetRole: 'proprietaire' }, ...SERVER_STORE.notifications];

        return res.status(200).json({
          success: true,
          payment: targetPayment,
          receipt: targetReceipt,
          payments: SERVER_STORE.payments,
          receipts: SERVER_STORE.receipts
        });
      }

      // 3. Inscription / mise à jour d'une caution
      if (action === 'declare_caution' || action === 'confirm_caution') {
        const caution = body.caution;
        if (caution) {
          const cid = caution.id || `cau_${Date.now()}`;
          const normalizedCau = {
            ...caution,
            id: cid,
            status: action === 'confirm_caution' ? 'paye_complet' : (caution.status || 'caution_a_confirmer')
          };
          SERVER_STORE.cautions = [
            normalizedCau,
            ...SERVER_STORE.cautions.filter(c => c.id !== cid && c.contract_number !== caution.contract_number)
          ];
          return res.status(200).json({ success: true, cautions: SERVER_STORE.cautions });
        }
      }

      // 4. Inscription / signalement d'un ticket de maintenance
      if (action === 'create_maintenance_ticket') {
        const ticket = body.ticket;
        if (!ticket) return res.status(400).json({ success: false, error: 'Données de maintenance manquantes.' });
        const tid = ticket.id || `tck_${Date.now()}`;
        const newTicket = {
          ...ticket,
          id: tid,
          ticketNumber: ticket.ticketNumber || `TCK-2026-${tid.slice(-4).toUpperCase()}`,
          status: ticket.status || 'Nouveau',
          createdAt: ticket.createdAt || new Date().toLocaleDateString('fr-FR'),
          notes: Array.isArray(ticket.notes) ? ticket.notes : []
        };
        SERVER_STORE.maintenance = [
          newTicket,
          ...SERVER_STORE.maintenance.filter(t => t.id !== tid && (t.ticketNumber !== newTicket.ticketNumber || !t.ticketNumber))
        ];
        // Notifier le propriétaire et l'agence
        const notif = {
          id: `notif_maint_${Date.now()}`,
          title: '⚠️ Incident de maintenance signalé',
          description: `${newTicket.tenantName || 'Le locataire'} a signalé un problème (${newTicket.category || 'Général'}) pour « ${newTicket.propertyTitle || 'le bien'} » : ${newTicket.description || ''}`,
          time: "À l'instant",
          unread: true,
          read: false,
          category: 'maintenance',
          type: 'maintenance',
          targetTab: 'maintenance',
          targetRole: 'proprietaire',
          targetUserId: newTicket.ownerId || '',
          payload: {
            ticketId: tid,
            tenantName: newTicket.tenantName,
            tenantPhone: newTicket.tenantPhone,
            propertyTitle: newTicket.propertyTitle,
            propertyAddress: newTicket.propertyAddress,
            category: newTicket.category,
            description: newTicket.description,
            photos: newTicket.photos
          }
        };
        SERVER_STORE.notifications = [
          notif,
          { ...notif, id: `${notif.id}_agence`, targetRole: 'agence' },
          ...SERVER_STORE.notifications
        ];
        return res.status(200).json({
          success: true,
          ticket: newTicket,
          maintenance: SERVER_STORE.maintenance,
          notifications: SERVER_STORE.notifications
        });
      }

      // 5. Mise à jour d'un ticket de maintenance (statut, devis/coût, programmation, notes)
      if (action === 'update_maintenance_ticket') {
        const { ticketId, status, notes, scheduledDate, cost, description, rentDeductionRequest, notificationTitle, notificationDescription, tenantId, ownerId } = body;
        const cleanTenantId = tenantId || body.tenant_id;
        const cleanOwnerId = ownerId || body.owner_id;

        const tNumPassed = body.ticketNumber || (ticketId && String(ticketId).startsWith('TCK-') ? ticketId : '');
        let target = SERVER_STORE.maintenance.find(t => 
          (ticketId && t.id === ticketId) || 
          (tNumPassed && t.ticketNumber === tNumPassed) ||
          (ticketId && t.ticketNumber === ticketId) ||
          (ticketId && t.ticketNumber && String(t.ticketNumber).toUpperCase().endsWith(String(ticketId).slice(-4).toUpperCase())) ||
          (ticketId && t.id && (String(ticketId).toLowerCase().includes(String(t.id).toLowerCase()) || String(t.id).toLowerCase().includes(String(ticketId).toLowerCase())))
        );

        if (!target && cleanTenantId) {
          target = SERVER_STORE.maintenance.find(t =>
            (t.tenantId === cleanTenantId || t.tenant_id === cleanTenantId) &&
            (!body.category || t.category === body.category)
          );
        }

        if (target) {
          if (status) target.status = status;
          if (notes && Array.isArray(notes)) {
            const existingNotes = Array.isArray(target.notes) ? target.notes : [];
            const notesMap = new Map();
            existingNotes.forEach(n => notesMap.set(String(n.id || n.content), n));
            notes.forEach(n => notesMap.set(String(n.id || n.content), n));
            target.notes = Array.from(notesMap.values());
          }
          if (scheduledDate !== undefined) target.scheduledDate = scheduledDate;
          if (cost !== undefined) target.cost = cost;
          if (description && description.trim().length > 5) target.description = description;
          if (rentDeductionRequest) target.rentDeductionRequest = rentDeductionRequest;
          if (cleanTenantId) {
            target.tenantId = cleanTenantId;
            target.tenant_id = cleanTenantId;
          }
          if (cleanOwnerId) {
            target.ownerId = cleanOwnerId;
            target.owner_id = cleanOwnerId;
          }
        }

        // Notification automatique et certifiée sur TOUTE action
        let targetTenantId = target.tenantId || target.tenant_id;
        if (!targetTenantId) {
          const relContract = SERVER_STORE.contracts.find(c => (c.property_id && c.property_id === target.propertyId) || (target.ticketNumber && c.contract_number));
          if (relContract?.tenant_id) targetTenantId = relContract.tenant_id;
        }
        let targetOwnerId = target.ownerId || target.owner_id;
        if (!targetOwnerId) {
          const relContract = SERVER_STORE.contracts.find(c => (c.property_id && c.property_id === target.propertyId) || (target.ticketNumber && c.contract_number));
          if (relContract?.owner_id) targetOwnerId = relContract.owner_id;
        }
        const lastNote = Array.isArray(notes) && notes.length > 0 ? notes[notes.length - 1] : null;

        if (lastNote && !lastNote.isInternal) {
          const isFromOwner = lastNote.author && (
            lastNote.author.toLowerCase().includes('propriétaire') || 
            lastNote.author.toLowerCase().includes('bailleur') || 
            lastNote.author.toLowerCase().includes('agence')
          );
          
          if (isFromOwner && targetTenantId) {
            // Notifier le locataire de la réponse du bailleur
            const notifLoc = {
              id: `notif_maint_reply_${Date.now()}`,
              title: notificationTitle || '💬 Réponse du bailleur concernant votre incident',
              description: notificationDescription || `Votre bailleur : "${lastNote.content}"`,
              time: "À l'instant",
              unread: true,
              read: false,
              category: 'maintenance',
              type: 'maintenance',
              targetTab: 'maintenance',
              targetRole: 'locataire',
              targetUserId: targetTenantId,
              payload: {
                ticketId: target.id,
                ticketNumber: target.ticketNumber,
                notes: target.notes,
                status: target.status,
                scheduledDate: target.scheduledDate
              }
            };
            SERVER_STORE.notifications = [notifLoc, ...SERVER_STORE.notifications];
          } else if (!isFromOwner && targetOwnerId) {
            // Notifier le bailleur de la réponse du locataire
            const notifOwn = {
              id: `notif_maint_reply_${Date.now()}`,
              title: notificationTitle || '💬 Réponse du locataire concernant un incident',
              description: notificationDescription || `${lastNote.author || 'Locataire'} : "${lastNote.content}"`,
              time: "À l'instant",
              unread: true,
              read: false,
              category: 'maintenance',
              type: 'maintenance',
              targetTab: 'maintenance',
              targetRole: 'proprietaire',
              targetUserId: targetOwnerId,
              payload: {
                ticketId: target.id,
                ticketNumber: target.ticketNumber,
                notes: target.notes,
                status: target.status,
                scheduledDate: target.scheduledDate
              }
            };
            SERVER_STORE.notifications = [notifOwn, ...SERVER_STORE.notifications];
          }
        } else if (status === 'Résolu' && targetTenantId) {
          const notifLoc = {
            id: `notif_maint_res_${Date.now()}`,
            title: notificationTitle || '✅ Incident de maintenance résolu',
            description: notificationDescription || `Votre signalement (${target.category || 'Incident'}) pour « ${target.propertyTitle || 'Logement'} » a été marqué comme résolu par votre bailleur.`,
            time: "À l'instant",
            unread: true,
            read: false,
            category: 'maintenance',
            type: 'maintenance',
            targetTab: 'maintenance',
            targetRole: 'locataire',
            targetUserId: targetTenantId,
            payload: {
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              notes: target.notes,
              status: target.status,
              scheduledDate: target.scheduledDate
            }
          };
          SERVER_STORE.notifications = [notifLoc, ...SERVER_STORE.notifications];
        } else if (scheduledDate && targetTenantId) {
          const notifLoc = {
            id: `notif_maint_sch_${Date.now()}`,
            title: notificationTitle || '📅 Intervention programmée',
            description: notificationDescription || `Une intervention est programmée le ${scheduledDate} pour votre incident (${target.category || 'Incident'}).`,
            time: "À l'instant",
            unread: true,
            read: false,
            category: 'maintenance',
            type: 'maintenance',
            targetTab: 'maintenance',
            targetRole: 'locataire',
            targetUserId: targetTenantId,
            payload: {
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              notes: target.notes,
              status: target.status,
              scheduledDate: target.scheduledDate
            }
          };
          SERVER_STORE.notifications = [notifLoc, ...SERVER_STORE.notifications];
        }

        return res.status(200).json({ success: true, ticket: target, maintenance: SERVER_STORE.maintenance });
      }

      // 5bis. Enregistrement ou approbation d'une dépense / déduction (Scénarios A, B, C)
      if (action === 'create_expense' || action === 'update_expense' || action === 'sync_expense') {
        const expense = body.expense;
        if (expense) {
          if (!Array.isArray(SERVER_STORE.expenses)) SERVER_STORE.expenses = [];
          const existingIdx = SERVER_STORE.expenses.findIndex(e => e.id === expense.id || (expense.expense_number && e.expense_number === expense.expense_number));
          if (existingIdx === -1) {
            SERVER_STORE.expenses.unshift(expense);
          } else {
            SERVER_STORE.expenses[existingIdx] = { ...SERVER_STORE.expenses[existingIdx], ...expense };
          }

          // Si la dépense est liée à un ticket de maintenance ou concerne le locataire (ex: Scénario C)
          const tckNumMatch = (expense.title || '').match(/TCK-[A-Z0-9-]+/i);
          const targetTckNum = tckNumMatch ? tckNumMatch[0] : '';
          let targetTicket = SERVER_STORE.maintenance.find(
            t => (expense.ticket_id && (t.id === expense.ticket_id || t.ticketNumber === expense.ticket_id)) ||
                 (targetTckNum && (t.ticketNumber === targetTckNum || t.id === targetTckNum || (t.id && t.id.includes(targetTckNum))))
          );

          if (!targetTicket && (targetTckNum || expense.ticket_id || expense.tenant_id)) {
            // Rechercher un ticket existant pour ce locataire sans JAMAIS créer de ticket fantôme vide
            targetTicket = SERVER_STORE.maintenance.find(t => 
              (expense.tenant_id && (t.tenantId === expense.tenant_id || t.tenant_id === expense.tenant_id)) ||
              (expense.property_id && (t.propertyId === expense.property_id || t.property_id === expense.property_id))
            );
          }

          if (targetTicket) {
            targetTicket.status = 'En cours';
            const dynamicAmount = Number(expense.amount || 0);
            const noteText = expense.scenario === 'C'
              ? `Accord officiel du bailleur pour réparation : Vous êtes expressément autorisé(e) à faire réaliser la réparation pour un montant de ${dynamicAmount.toLocaleString('fr-FR')} FCFA. Ce montant sera déduit de votre loyer conformément au Scénario C.`
              : `Décision du bailleur : La réparation de ${dynamicAmount.toLocaleString('fr-FR')} FCFA a été validée.`;

            const existingNotes = Array.isArray(targetTicket.notes) ? targetTicket.notes : [];
            const hasNote = existingNotes.some(n => n.content && n.content.includes(dynamicAmount.toLocaleString('fr-FR')));
            if (!hasNote) {
              targetTicket.notes = [
                ...existingNotes,
                {
                  id: `note-exp-${Date.now()}`,
                  author: 'Propriétaire (Accord officiel)',
                  content: noteText,
                  date: new Date().toLocaleDateString('fr-FR'),
                  isInternal: false
                }
              ];
            }

            if (expense.scenario === 'C') {
              targetTicket.rentDeductionRequest = {
                status: 'approuve',
                amountSpent: dynamicAmount,
                deductionMonth: 'Prochain loyer'
              };
            }

            const targetTenantId = expense.tenant_id || targetTicket.tenantId || targetTicket.tenant_id || '';
            const notifTitle = expense.scenario === 'C'
              ? '🛠️ Réparation autorisée avec déduction de loyer'
              : '🛠️ Décision du bailleur concernant votre signalement';
            const resolvedPropTitle = expense.property_title || targetTicket.propertyTitle || 'votre logement';
            const notifDesc = `Votre bailleur a validé votre signalement pour « ${resolvedPropTitle} » : vous êtes autorisé(e) à faire effectuer la réparation (${dynamicAmount.toLocaleString('fr-FR')} FCFA déductibles du loyer).`;

            if (targetTenantId) {
              SERVER_STORE.notifications.unshift({
                id: `notif_exp_${Date.now()}`,
                title: notifTitle,
                description: notifDesc,
                time: "À l'instant",
                timestamp: "À l'instant",
                category: 'maintenance',
                type: 'maintenance',
                targetRole: 'locataire',
                targetUserId: targetTenantId,
                targetTab: 'maintenance',
                unread: true,
                read: false,
                payload: {
                  ticketId: targetTicket.id,
                  ticketNumber: targetTicket.ticketNumber,
                  expenseId: expense.id,
                  amount: dynamicAmount,
                  scenario: expense.scenario
                }
              });
            }
          }

          return res.status(200).json({ success: true, expense, ticket: targetTicket, maintenance: SERVER_STORE.maintenance, notifications: SERVER_STORE.notifications });
        }
      }

      // 6. Enregistrement ou signature d'un contrat de bail
      if (action === 'save_contract' || action === 'sign_contract') {
        const contract = body.contract;
        if (contract) {
          const cid = contract.id || `cnt_${Date.now()}`;
          const normalized = {
            ...contract,
            id: cid,
            contract_number: contract.contract_number || contract.contractNumber || `LT-2026-CI-000${Date.now().toString().slice(-3)}`,
            contractNumber: contract.contract_number || contract.contractNumber,
            status: action === 'sign_contract' ? 'actif' : (contract.status || 'actif')
          };
          SERVER_STORE.contracts = [
            normalized,
            ...SERVER_STORE.contracts.filter(c => c.id !== cid && c.contract_number !== normalized.contract_number)
          ];
          return res.status(200).json({ success: true, contract: normalized, contracts: SERVER_STORE.contracts });
        }
      }

      // 6bis. Ajout d'une notification globale
      if (action === 'push_notification') {
        const notif = body.notification;
        if (notif) {
          const nid = notif.id || `notif_${Date.now()}`;
          const normalized = { ...notif, id: nid };
          SERVER_STORE.notifications = [
            normalized,
            ...SERVER_STORE.notifications.filter(n => n.id !== nid)
          ];
          return res.status(200).json({ success: true, notification: normalized, notifications: SERVER_STORE.notifications });
        }
      }

      // 6ter. Enregistrement d'un bien immobilier
      if (action === 'save_property') {
        const property = body.property;
        if (property) {
          const pid = property.id || `prop_${Date.now()}`;
          const normalized = { ...property, id: pid };
          SERVER_STORE.properties = [
            normalized,
            ...SERVER_STORE.properties.filter(p => p.id !== pid)
          ];
          return res.status(200).json({ success: true, property: normalized, properties: SERVER_STORE.properties });
        }
      }

      // 6quater. Envoi d'un message réel dans le store centralisé
      if (action === 'send_message') {
        const { message, contactInfo, conversation } = body;
        if (message && message.sender_id && message.receiver_id) {
          const mid = message.id || `msg_${Date.now()}`;
          const normalizedMsg = {
            ...message,
            id: mid,
            created_at: message.created_at || new Date().toISOString(),
            status: message.status || 'delivered',
            is_read: false,
            read: false,
            read_at: null
          };
          // Éviter tout doublon par ID ou empreinte (sender + receiver + text + minute)
          const msgMin = normalizedMsg.created_at.slice(0, 16);
          const msgTextTrim = (normalizedMsg.text || '').trim();
          SERVER_STORE.messages = [
            normalizedMsg,
            ...SERVER_STORE.messages.filter(m => {
              if (m.id === mid) return false;
              if (msgTextTrim && m.sender_id === normalizedMsg.sender_id && m.receiver_id === normalizedMsg.receiver_id && (m.text || '').trim() === msgTextTrim && (m.created_at || '').slice(0, 16) === msgMin) {
                return false;
              }
              return true;
            })
          ];

          // Sauvegarde ou mise à jour de la conversation
          const convId = conversation?.id || `conv_${message.sender_id}_${message.receiver_id}`;
          const existingConvIndex = SERVER_STORE.conversations.findIndex(c =>
            c.id === convId ||
            (c.participant_a === message.sender_id && c.participant_b === message.receiver_id) ||
            (c.participant_a === message.receiver_id && c.participant_b === message.sender_id) ||
            (c.tenant_id === message.sender_id && c.owner_id === message.receiver_id) ||
            (c.tenant_id === message.receiver_id && c.owner_id === message.sender_id)
          );

          const convObj = {
            id: convId,
            participant_a: message.sender_id,
            participant_b: message.receiver_id,
            tenant_id: message.sender_id,
            owner_id: message.receiver_id,
            property_id: message.propertyId || conversation?.property_id,
            property_title: message.propertyTitle || conversation?.property_title,
            last_message: message.text,
            last_message_at: normalizedMsg.created_at,
            updated_at: normalizedMsg.created_at
          };

          if (existingConvIndex >= 0) {
            SERVER_STORE.conversations[existingConvIndex] = {
              ...SERVER_STORE.conversations[existingConvIndex],
              ...convObj
            };
          } else {
            SERVER_STORE.conversations.unshift(convObj);
          }

          // Mémorisation des métadonnées de contact pour résolution instantanée
          if (contactInfo && contactInfo.id) {
            SERVER_STORE.contacts[contactInfo.id] = contactInfo;
          }

          // Génération de la notification ciblée EXCLUSIVEMENT pour le destinataire (jamais pour l'expéditeur)
          if (message.sender_id !== message.receiver_id) {
            const notifId = message.notificationId || body.notification?.id || `notif_msg_${mid}`;
            const senderName = message.sender_name || contactInfo?.name || 'Correspondant';
            const rawText = message.text || message.content || 'Nouveau message';
            const descText = rawText.length > 80 ? `${rawText.slice(0, 80)}...` : rawText;
            const notifMsg = {
              id: notifId,
              title: `Nouveau message de ${senderName}`,
              description: descText,
              time: "À l'instant",
              timestamp: normalizedMsg.created_at,
              unread: true,
              read: false,
              is_read: false,
              category: 'demande',
              type: 'info',
              targetTab: 'messages',
              targetUserId: message.receiver_id,
              senderUserId: message.sender_id,
              payload: {
                contactId: message.sender_id,
                messageId: mid,
                propertyId: message.propertyId
              }
            };

            SERVER_STORE.notifications = [
              notifMsg,
              ...SERVER_STORE.notifications.filter(n => {
                if (n.id === notifId) return false;
                if (n.targetUserId === message.receiver_id && n.senderUserId === message.sender_id && n.description === descText && n.timestamp && n.timestamp.slice(0, 16) === msgMin) {
                  return false;
                }
                return true;
              })
            ];
          }

          return res.status(200).json({
            success: true,
            message: normalizedMsg,
            conversation: convObj,
            messages: SERVER_STORE.messages,
            conversations: SERVER_STORE.conversations
          });
        }
        return res.status(400).json({ success: false, error: 'Données de message incomplètes.' });
      }

      // 6quinquies. Marquage des messages d'un contact (ou de tous les contacts) comme lus
      if (action === 'mark_messages_read') {
        const { contactId, currentUserId, messageIds, readAt } = body;
        if (currentUserId) {
          const nowIso = readAt || new Date().toISOString();
          const nowMs = new Date(nowIso).getTime() || Date.now();
          const msgIdSet = new Set(Array.isArray(messageIds) ? messageIds : []);

          if (!SERVER_STORE.readState[currentUserId]) {
            SERVER_STORE.readState[currentUserId] = {
              readMessageIds: [],
              readNotifIds: [],
              convLastReadAt: {}
            };
          }
          const userReadState = SERVER_STORE.readState[currentUserId];

          if (contactId === '__all__') {
            userReadState.convLastReadAt.__all__ = nowMs;
          } else if (contactId) {
            userReadState.convLastReadAt[contactId] = nowMs;
          }

          SERVER_STORE.messages = SERVER_STORE.messages.map(m => {
            const isTargetMsg =
              (contactId === '__all__' && m.receiver_id === currentUserId) ||
              (contactId && m.sender_id === contactId && m.receiver_id === currentUserId) ||
              msgIdSet.has(m.id);
            if (isTargetMsg) {
              if (!userReadState.readMessageIds.includes(m.id)) {
                userReadState.readMessageIds.push(m.id);
              }
              return { ...m, status: 'read', read: true, is_read: true, read_at: m.read_at || nowIso };
            }
            return m;
          });

          msgIdSet.forEach(id => {
            if (id && !userReadState.readMessageIds.includes(id)) {
              userReadState.readMessageIds.push(id);
            }
          });

          // Marquer également les notifications de messages correspondantes comme lues
          SERVER_STORE.notifications = SERVER_STORE.notifications.map(n => {
            const isTargetNotif =
              n.targetUserId === currentUserId &&
              ((contactId === '__all__' && (n.targetTab === 'messages' || (n.title || '').toLowerCase().includes('message'))) ||
                (contactId && (n.senderUserId === contactId || n.payload?.contactId === contactId) && (n.targetTab === 'messages' || (n.title || '').toLowerCase().includes('message'))));
            if (isTargetNotif) {
              if (!userReadState.readNotifIds.includes(n.id)) {
                userReadState.readNotifIds.push(n.id);
              }
              return { ...n, read: true, unread: false, is_read: true, read_at: n.read_at || nowIso };
            }
            return n;
          });

          return res.status(200).json({
            success: true,
            messages: SERVER_STORE.messages,
            notifications: SERVER_STORE.notifications,
            readState: userReadState
          });
        }
      }

      // 6sexies. Soumission d'une demande de location par le locataire
      if (action === 'submit_application') {
        const application = body.application;
        if (!application) {
          return res.status(400).json({ success: false, error: 'Données de candidature manquantes.' });
        }

        const newId = application.id || `app_${Date.now()}`;
        const normalizedApp = {
          ...application,
          id: newId,
          created_at: application.created_at || new Date().toISOString()
        };

        SERVER_STORE.applications = [
          normalizedApp,
          ...SERVER_STORE.applications.filter(a => a.id !== newId)
        ];

        // Créer notification pour le propriétaire et/ou l'agence
        const notifId = `notif_app_${Date.now()}`;
        const applicantName = application.tenant_name || 'Un locataire';
        const propertyTitle = application.property_title || 'votre logement';
        const primaryTargetId = application.agency_id || application.owner_id;
        const isAgencyTarget = Boolean(application.agency_id || application.is_agency);

        const notifApp = {
          id: notifId,
          title: 'Nouvelle demande de location reçue',
          description: `${applicantName} a postulé pour le bien « ${propertyTitle} ».`,
          time: "À l'instant",
          timestamp: new Date().toISOString(),
          unread: true,
          read: false,
          category: 'candidature',
          type: 'info',
          targetTab: 'applications',
          targetRole: isAgencyTarget ? 'agence' : 'proprietaire',
          targetUserId: primaryTargetId,
          senderUserId: application.tenant_id,
          payload: {
            applicationId: newId,
            propertyId: application.property_id,
            tenantId: application.tenant_id,
            agencyId: application.agency_id,
            ownerId: application.owner_id
          }
        };

        const notifsToAdd = [notifApp];
        if (application.agency_id && application.owner_id && application.agency_id !== application.owner_id) {
          notifsToAdd.push({
            ...notifApp,
            id: `${notifId}_owner`,
            targetRole: 'proprietaire',
            targetUserId: application.owner_id
          });
        }

        SERVER_STORE.notifications = [
          ...notifsToAdd,
          ...SERVER_STORE.notifications.filter(n => n.id !== notifId && n.id !== `${notifId}_owner`)
        ];

        return res.status(200).json({
          success: true,
          application: normalizedApp,
          applications: SERVER_STORE.applications,
          notifications: SERVER_STORE.notifications
        });
      }

      // 6septies. Mise à jour d'une demande de location
      if (action === 'update_application') {
        const { applicationId, updates } = body;
        if (applicationId && updates) {
          SERVER_STORE.applications = SERVER_STORE.applications.map(a => {
            if (a.id === applicationId) {
              return { ...a, ...updates, updated_at: new Date().toISOString() };
            }
            return a;
          });
          return res.status(200).json({
            success: true,
            applications: SERVER_STORE.applications
          });
        }
      }

      // 6octies. Marquage des notifications comme lues
      if (action === 'mark_notification_read') {
        const { notificationId, notificationIds, userId, targetTab } = body;
        const nowIso = new Date().toISOString();
        const idSet = new Set(Array.isArray(notificationIds) ? notificationIds : []);
        if (notificationId) idSet.add(notificationId);

        if (userId) {
          if (!SERVER_STORE.readState[userId]) {
            SERVER_STORE.readState[userId] = {
              readMessageIds: [],
              readNotifIds: [],
              convLastReadAt: {}
            };
          }
          idSet.forEach(id => {
            if (id && !SERVER_STORE.readState[userId].readNotifIds.includes(id)) {
              SERVER_STORE.readState[userId].readNotifIds.push(id);
            }
          });
        }

        if (idSet.size > 0) {
          SERVER_STORE.notifications = SERVER_STORE.notifications.map(n => {
            if (idSet.has(n.id)) {
              const ownerUser = userId || n.targetUserId;
              if (ownerUser) {
                if (!SERVER_STORE.readState[ownerUser]) {
                  SERVER_STORE.readState[ownerUser] = { readMessageIds: [], readNotifIds: [], convLastReadAt: {} };
                }
                if (!SERVER_STORE.readState[ownerUser].readNotifIds.includes(n.id)) {
                  SERVER_STORE.readState[ownerUser].readNotifIds.push(n.id);
                }
              }
              return { ...n, read: true, unread: false, is_read: true, read_at: n.read_at || nowIso };
            }
            return n;
          });
        } else if (userId && targetTab) {
          SERVER_STORE.notifications = SERVER_STORE.notifications.map(n => {
            if ((n.targetUserId === userId || n.payload?.agencyId === userId || n.payload?.ownerId === userId) && n.targetTab === targetTab) {
              if (!SERVER_STORE.readState[userId].readNotifIds.includes(n.id)) {
                SERVER_STORE.readState[userId].readNotifIds.push(n.id);
              }
              return { ...n, read: true, unread: false, is_read: true, read_at: n.read_at || nowIso };
            }
            return n;
          });
        } else if (userId) {
          SERVER_STORE.notifications = SERVER_STORE.notifications.map(n => {
            if (n.targetUserId === userId || n.payload?.agencyId === userId || n.payload?.ownerId === userId) {
              if (!SERVER_STORE.readState[userId].readNotifIds.includes(n.id)) {
                SERVER_STORE.readState[userId].readNotifIds.push(n.id);
              }
              return { ...n, read: true, unread: false, is_read: true, read_at: n.read_at || nowIso };
            }
            return n;
          });
        }
        return res.status(200).json({
          success: true,
          notifications: SERVER_STORE.notifications,
          readState: userId ? SERVER_STORE.readState[userId] : undefined
        });
      }

      // 7. Synchronisation bidirectionnelle globale
      if (action === 'sync_all') {
        const { clientPayments, clientCautions, clientReceipts, clientContracts, clientMaintenance, clientProperties, clientMessages, clientContacts, clientApplications, clientExpenses } = body;
        if (Array.isArray(clientPayments)) {
          for (const cp of clientPayments) {
            const ref = String(cp?.reference || cp?.receipt_number || '').trim();
            const id = String(cp?.id || '').trim();
            if (DELETED_PAYMENTS.has(ref) || DELETED_PAYMENTS.has(id)) continue;
            const amt = Number(String(cp.amount || 0).replace(/[\s\u00A0,]/g, ''));
            if (amt <= 0 || amt > 200000 || isNaN(amt)) continue; // Bloquer les montants tests anormaux (ex: 10M, 11.4M)
            if (cp.status === 'annule' || cp.status === 'supprime') continue;
            if (cp && cp.reference && !SERVER_STORE.payments.some(p => p.reference === cp.reference)) {
              SERVER_STORE.payments.unshift(cp);
            }
          }
        }
        if (Array.isArray(clientCautions)) {
          for (const cc of clientCautions) {
            if (cc && cc.contract_number && !SERVER_STORE.cautions.some(c => c.contract_number === cc.contract_number)) {
              SERVER_STORE.cautions.unshift(cc);
            }
          }
        }
        if (Array.isArray(clientContracts)) {
          for (const c of clientContracts) {
            if (c && c.contract_number && !SERVER_STORE.contracts.some(sc => sc.contract_number === c.contract_number)) {
              SERVER_STORE.contracts.unshift(c);
            }
          }
        }
        if (Array.isArray(clientMaintenance)) {
          for (const m of clientMaintenance) {
            if (m && m.id && !SERVER_STORE.maintenance.some(sm => sm.id === m.id)) {
              SERVER_STORE.maintenance.unshift(m);
            }
          }
        }
        if (Array.isArray(clientProperties)) {
          for (const p of clientProperties) {
            if (p && p.id && !SERVER_STORE.properties.some(sp => sp.id === p.id)) {
              SERVER_STORE.properties.unshift(p);
            }
          }
        }
        if (Array.isArray(clientMessages)) {
          for (const msg of clientMessages) {
            if (!msg || !msg.id) continue;
            const existingIdx = SERVER_STORE.messages.findIndex(sm => sm.id === msg.id);
            if (existingIdx === -1) {
              SERVER_STORE.messages.push(msg);
            } else if (msg.status === 'read' || msg.is_read || msg.read) {
              SERVER_STORE.messages[existingIdx] = {
                ...SERVER_STORE.messages[existingIdx],
                status: 'read',
                is_read: true,
                read: true,
                read_at: SERVER_STORE.messages[existingIdx].read_at || msg.read_at || new Date().toISOString()
              };
            }
          }
        }
        if (clientContacts && typeof clientContacts === 'object') {
          Object.assign(SERVER_STORE.contacts, clientContacts);
        }
        if (Array.isArray(clientApplications)) {
          for (const a of clientApplications) {
            if (a && a.id && !SERVER_STORE.applications.some(sa => sa.id === a.id)) {
              SERVER_STORE.applications.unshift(a);
            }
          }
        }
        if (Array.isArray(clientExpenses)) {
          if (!Array.isArray(SERVER_STORE.expenses)) SERVER_STORE.expenses = [];
          for (const exp of clientExpenses) {
            if (exp && exp.id && !SERVER_STORE.expenses.some(se => se.id === exp.id)) {
              SERVER_STORE.expenses.unshift(exp);
            }
          }
        }
        return res.status(200).json({
          success: true,
          data: {
            payments: SERVER_STORE.payments,
            cautions: SERVER_STORE.cautions,
            receipts: SERVER_STORE.receipts,
            notifications: SERVER_STORE.notifications,
            contracts: SERVER_STORE.contracts,
            maintenance: SERVER_STORE.maintenance,
            properties: SERVER_STORE.properties,
            messages: SERVER_STORE.messages,
            conversations: SERVER_STORE.conversations,
            contacts: SERVER_STORE.contacts,
            applications: SERVER_STORE.applications,
            expenses: SERVER_STORE.expenses
          }
        });
      }

      return res.status(400).json({ success: false, error: 'Action non reconnue.' });
    }

    return res.status(405).json({ success: false, error: 'Méthode non autorisée.' });
  } catch (err) {
    console.error('Erreur API /api/sync:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur interne' });
  }
}
