// api/sync.js
// Vercel Serverless Function — Moteur Centralisé de Synchronisation Multi-Appareils & Multi-Comptes
// Source de vérité unique pour Agences (KK), Propriétaires, Locataires (Christian) et Administrateurs.

export const config = {
  runtime: 'nodejs',
};

// Magasin persistant en mémoire de l'instance serveur (partagé entre requêtes)
let SERVER_STORE = {
  payments: [
    {
      id: 'pmt_esp_135945',
      contract_id: 'LT-2026-CI-000492',
      tenant_id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      owner_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      amount: 30000,
      payment_date: '2026-10-17',
      payment_method: 'Espèces',
      reference: 'ESP-135945',
      status: 'confirme',
      target_month: 'Octobre 2026',
      confirmed_at: '2026-10-17T20:51:00.000Z',
      owner_signature_url: 'SIG_AGENCE_KK_CERTIFIED',
      tenant_signature_url: 'SIG_TENANT_CHRISTIAN_CERTIFIED',
      tenant: {
        id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
        full_name: 'Christian',
        email: 'christianyaokoffi88@gmail.com',
        phone: '0500552141',
        role: 'locataire',
        verification_status: 'verifie'
      },
      contract: {
        id: 'LT-2026-CI-000492',
        contract_number: 'LT-2026-CI-000492',
        monthly_rent: 30000,
        caution_amount: 60000,
        property: {
          title: 'Maison 4 pièce',
          address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
          city: 'Yamoussoukro'
        }
      }
    },
    {
      id: 'pmt_dec_nov2026_01',
      contract_id: 'LT-2026-CI-000492',
      tenant_id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      owner_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      amount: 30000,
      payment_date: '2026-10-19',
      payment_method: 'Wave',
      reference: 'WAV-2026-NOV-781920',
      status: 'confirme',
      target_month: 'Novembre 2026',
      created_at: '2026-10-19T17:15:00.000Z',
      confirmed_at: '2026-10-19T17:20:00.000Z',
      owner_signature_url: 'SIG_AGENCE_KK_CERTIFIED',
      tenant_signature_url: 'SIG_TENANT_CHRISTIAN_CERTIFIED',
      tenant: {
        id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
        full_name: 'Christian',
        email: 'christianyaokoffi88@gmail.com',
        phone: '0500552141',
        role: 'locataire',
        verification_status: 'verifie'
      },
      contract: {
        id: 'LT-2026-CI-000492',
        contract_number: 'LT-2026-CI-000492',
        monthly_rent: 30000,
        caution_amount: 60000,
        property: {
          title: 'Maison 4 pièce',
          address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
          city: 'Yamoussoukro'
        }
      }
    }
  ],

  cautions: [
    {
      id: 'cau_lt_000492',
      contract_id: 'LT-2026-CI-000492',
      contract_number: 'LT-2026-CI-000492',
      tenant_id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      owner_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      amount_requested: 60000,
      amount_paid: 60000,
      status: 'paye_complet',
      receipt_number: 'REC-CAUTION-000492',
      token: 'tok_rec_caution_000492',
      payment_method: 'Wave CI / Mobile Money',
      declared_reference: 'CAUT-000492-CONF',
      property_title: 'Maison 4 pièce',
      property_address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      created_at: '2026-10-16T15:45:00.000Z',
      confirmed_at: '2026-10-16T15:45:00.000Z',
      tenant_name: 'Christian',
      owner_name: 'KK'
    }
  ],

  receipts: [
    {
      id: 'rec_esp_135945',
      receipt_number: 'ESP-135945',
      type: 'loyer',
      tenant_name: 'Christian',
      property_title: 'Maison 4 pièce',
      property_address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      contract_number: 'LT-2026-CI-000492',
      period_covered: 'Octobre 2026',
      amount: 30000,
      payment_method: 'Espèces (Règlement direct)',
      payment_date: '17/10/2026',
      token: 'tok_rec_ci2026_ljy8knh31z579ov2',
      status: 'certifie',
      owner_signed: true,
      tenant_signed: true,
      owner_signature_url: 'SIG_AGENCE_KK_CERTIFIED',
      tenant_signature_url: 'SIG_TENANT_CHRISTIAN_CERTIFIED'
    },
    {
      id: 'rec_wav_781920',
      receipt_number: 'WAV-2026-NOV-781920',
      type: 'loyer',
      tenant_name: 'Christian',
      property_title: 'Maison 4 pièce',
      property_address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      contract_number: 'LT-2026-CI-000492',
      period_covered: 'Novembre 2026',
      amount: 30000,
      payment_method: 'Wave',
      payment_date: '19/10/2026',
      token: 'tok_rec_wav_2026_nov_781920',
      status: 'certifie',
      owner_signed: true,
      tenant_signed: true,
      owner_signature_url: 'SIG_AGENCE_KK_CERTIFIED',
      tenant_signature_url: 'SIG_TENANT_CHRISTIAN_CERTIFIED'
    },
    {
      id: 'rec_cau_000492',
      receipt_number: 'REC-CAUTION-000492',
      type: 'caution',
      tenant_name: 'Christian',
      property_title: 'Maison 4 pièce',
      property_address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      contract_number: 'LT-2026-CI-000492',
      period_covered: 'Dépôt de Garantie Contractuel (Loi n° 2019-576 Art. 414)',
      amount: 60000,
      payment_method: 'Wave CI / Mobile Money',
      payment_date: '16/10/2026',
      token: 'tok_rec_caution_000492',
      status: 'certifie',
      owner_signed: true,
      tenant_signed: true,
      owner_signature_url: 'SIG_AGENCE_KK_CERTIFIED',
      tenant_signature_url: 'SIG_TENANT_CHRISTIAN_CERTIFIED'
    }
  ],

  notifications: [
    {
      id: 'notif_pmt_dec_nov2026_finalized',
      title: '✅ Reçu de paiement finalisé',
      description: 'Le locataire Christian a signé le reçu N° WAV-2026-NOV-781920. Le document est officiellement scellé et téléchargeable par les deux parties.',
      time: 'À l\'instant',
      unread: false,
      read: true,
      category: 'paiement',
      type: 'paiement',
      targetTab: 'payments',
      targetRole: 'agence',
      targetUserId: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      senderUserId: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      payload: {
        paymentId: 'pmt_dec_nov2026_01',
        amount: 30000,
        month: 'Novembre 2026',
        reference: 'WAV-2026-NOV-781920'
      }
    },
    {
      id: 'notif_pmt_dec_nov2026_agency',
      title: '💳 Nouveau paiement de loyer déclaré',
      description: 'Christian a déclaré le paiement du loyer de Novembre 2026 (30 000 FCFA • Wave - Réf: WAV-2026-NOV-781920). Reçu vérifié et validé.',
      time: '19/10/2026',
      unread: false,
      read: true,
      processed: true,
      category: 'paiement',
      type: 'paiement',
      targetTab: 'payments',
      targetRole: 'agence',
      targetUserId: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      senderUserId: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      payload: {
        paymentId: 'pmt_dec_nov2026_01',
        amount: 30000,
        month: 'Novembre 2026',
        reference: 'WAV-2026-NOV-781920'
      }
    }
  ],

  contracts: [
    {
      id: 'LT-2026-CI-000492',
      contract_number: 'LT-2026-CI-000492',
      contractNumber: 'LT-2026-CI-000492',
      property_id: '1b0e4bb4-66e0-432f-b8b7-f415ea36ae53',
      tenant_id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      owner_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      rent: 30000,
      monthly_rent: 30000,
      caution: 60000,
      caution_amount: 60000,
      charges: 10000,
      charges_amount: 10000,
      duration_months: 12,
      start_date: '2026-10-15',
      end_date: '2027-10-14',
      status: 'actif',
      owner_signed: true,
      tenant_signed: true,
      owner_signature_url: 'SIG_AGENCE_KK_CERTIFIED',
      tenant_signature_url: 'SIG_TENANT_CHRISTIAN_CERTIFIED',
      owner: {
        id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
        full_name: 'kk',
        phone: '0584269885',
        email: 'ny8667496@gmail.com',
        account_type: 'agence'
      },
      tenant: {
        id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
        full_name: 'Christian',
        phone: '0500552141',
        email: 'christianyaokoffi88@gmail.com',
        account_type: 'locataire'
      },
      property: {
        id: '1b0e4bb4-66e0-432f-b8b7-f415ea36ae53',
        title: 'Maison 4 pièce',
        address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
        city: 'Yamoussoukro'
      }
    }
  ],

  maintenance: [
    {
      id: 'tck_2026_maint_01',
      ticketNumber: 'TCK-2026-PLMB',
      tenantId: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      ownerId: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      tenantName: 'Christian',
      tenantPhone: '0500552141',
      propertyTitle: 'Maison 4 pièce',
      propertyAddress: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      category: 'Plomberie',
      priority: 'normale',
      status: 'En cours',
      createdAt: '18/10/2026',
      scheduledDate: '24/10/2026',
      cost: 15000,
      description: 'Fuite robinet salle de bain et contrôle pression arrivée d\'eau.',
      photos: [],
      notes: [
        {
          id: 'note_1',
          author: 'Agence KK',
          content: 'Plombier contacté. Intervention calée pour le 24 octobre à 10h.',
          date: '18/10/2026 14:30',
          isInternal: false
        }
      ]
    }
  ],

  properties: [
    {
      id: '1b0e4bb4-66e0-432f-b8b7-f415ea36ae53',
      title: 'Maison 4 pièce',
      type: 'villa',
      address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      city: 'Yamoussoukro',
      commune: 'Centre',
      quartier: '100 villard',
      rent: 30000,
      caution: 60000,
      charges: 10000,
      status: 'loue',
      owner_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      owner_name: 'KK',
      created_at: '2026-10-15T10:00:00.000Z'
    }
  ],
  messages: [],
  conversations: [],
  contacts: {},
  readState: {},
  applications: [
    {
      id: 'app_christian_maison_daloa',
      property_id: '8c6bb0dd-d482-4878-96ff-8ba245c4f9af',
      property_title: 'Maison à louer',
      property_address: 'Daloa, Daloa',
      rent_amount: 250000,
      caution_amount: 500000,
      date_received: '2026-10-29',
      status: 'en_attente',
      dossier_status: 'complet',
      tenant_id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      tenant_name: 'christian',
      tenant_email: 'christianyaokoffi88@gmail.com',
      tenant_phone: '+225 07 00 00 00 00',
      owner_id: 'c26c548a-4a86-4f0f-a6b5-6eb38127021d',
      owner_name: 'Romaric koffi',
      comment: 'Bonjour, je souhaite réserver ce bien et planifier la constitution du dossier de location.',
      documents: {
        cni_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        quittances_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        attestation_url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80'
      },
      created_at: new Date().toISOString()
    },
    {
      id: 'app_christian_agence_kk',
      property_id: '1b0e4bb4-66e0-432f-b8b7-f415ea36ae53',
      property_title: 'Maison 4 pièce',
      property_address: '100 villard, Yamoussoukro - Côte d\'Ivoire',
      rent_amount: 30000,
      caution_amount: 60000,
      date_received: '2026-10-15',
      status: 'contrat_actif',
      dossier_status: 'complet',
      tenant_id: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      tenant_name: 'christian',
      tenant_email: 'christianyaokoffi88@gmail.com',
      tenant_phone: '0500552141',
      owner_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_id: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      agency_name: 'kk',
      owner_name: 'kk',
      is_agency: true,
      tenant_signed: true,
      owner_signed: true,
      contract_finalized: true,
      contract_number: 'LT-2026-CI-000492',
      comment: 'Dossier de location validé et contrat scellé avec l\'agence kk.',
      documents: {
        cni_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        quittances_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        attestation_url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80'
      },
      created_at: '2026-10-15T10:00:00.000Z'
    }
  ]
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
            timestamp: new Date().toISOString()
          }
        });
      }

      // Pour tout utilisateur authentifié (Propriétaire, Agence, Locataire), filtrer STRICTEMENT ses propres données
      if (cleanUserId) {
        const userPayments = SERVER_STORE.payments.filter(
          (p) => p.owner_id === cleanUserId || p.agency_id === cleanUserId || p.tenant_id === cleanUserId
        );
        const userCautions = SERVER_STORE.cautions.filter(
          (c) => c.owner_id === cleanUserId || c.agency_id === cleanUserId || c.tenant_id === cleanUserId
        );
        const userReceipts = SERVER_STORE.receipts.filter(
          (r) => r.owner_id === cleanUserId || r.agency_id === cleanUserId || r.tenant_id === cleanUserId
        );
        const userContracts = SERVER_STORE.contracts.filter(
          (c) => c.owner_id === cleanUserId || c.agency_id === cleanUserId || c.tenant_id === cleanUserId
        );
        const userMaintenance = SERVER_STORE.maintenance.filter(
          (m) => m.ownerId === cleanUserId || m.agencyId === cleanUserId || m.tenantId === cleanUserId
        );
        const userProperties = SERVER_STORE.properties.filter(
          (pr) => pr.owner_id === cleanUserId || pr.agency_id === cleanUserId
        );
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
          .filter((m) => m && (m.sender_id === cleanUserId || m.receiver_id === cleanUserId))
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
          (c) => c.participant_a === cleanUserId || c.participant_b === cleanUserId || c.tenant_id === cleanUserId || c.owner_id === cleanUserId
        );
        const userApplications = SERVER_STORE.applications.filter(
          (a) =>
            a.owner_id === cleanUserId ||
            a.agency_id === cleanUserId ||
            a.mandant_id === cleanUserId ||
            a.tenant_id === cleanUserId ||
            (!cleanUserId && (a.owner_id === 'usr_owner' || a.agency_id === 'usr_agency' || a.owner_id === 'usr_agency' || a.tenant_id === 'usr_tenant'))
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
            contacts: SERVER_STORE.contacts,
            readState: userReadState,
            applications: userApplications,
            quota: userQuota,
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

      // 1. Déclaration de paiement de loyer par le locataire
      if (action === 'declare_payment') {
        const payment = body.payment;
        if (!payment) {
          return res.status(400).json({ success: false, error: 'Données de paiement manquantes.' });
        }

        const newId = payment.id || `pmt_${Date.now()}`;
        const newRef = payment.reference || `REF-${Date.now().toString().slice(-6)}`;
        const monthText = payment.target_month || 'Mois en cours';
        const amt = Number(payment.amount) || 30000;

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
          targetUserId: payment.owner_id || payment.agency_id || 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
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
        const targetPayment = SERVER_STORE.payments.find(p => p.id === paymentId || p.reference === reference);

        if (targetPayment) {
          targetPayment.status = 'en_attente_signature_locataire';
          targetPayment.confirmed_at = new Date().toISOString();
          if (ownerSignatureUrl) targetPayment.owner_signature_url = ownerSignatureUrl;

          // Création du reçu officiel en attente de signature du locataire
          const recRef = targetPayment.reference || `REC-LOY-${Date.now().toString().slice(-6)}`;
          const recToken = `tok_rec_${recRef.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
          
          const newReceipt = {
            id: `rec_${Date.now()}`,
            receipt_number: recRef,
            type: 'loyer',
            tenant_name: targetPayment.tenant?.full_name || targetPayment.tenant_name || 'Christian',
            property_title: targetPayment.contract?.property?.title || targetPayment.property_title || 'Maison 4 pièce',
            property_address: targetPayment.contract?.property?.address || targetPayment.property_address || '100 villard, Yamoussoukro - Côte d\'Ivoire',
            contract_number: targetPayment.contract?.contract_number || targetPayment.contract_id || 'LT-2026-CI-000492',
            period_covered: targetPayment.target_month || 'Mois en cours',
            amount: Number(targetPayment.amount) || 30000,
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
        const { paymentId, reference, tenantSignatureUrl, ownerSignatureUrl } = body;
        const targetPayment = SERVER_STORE.payments.find(p => p.id === paymentId || p.reference === reference);

        if (targetPayment) {
          targetPayment.status = 'confirme';
          targetPayment.confirmed_at = new Date().toISOString();
          if (tenantSignatureUrl) targetPayment.tenant_signature_url = tenantSignatureUrl;
          if (ownerSignatureUrl && !targetPayment.owner_signature_url) targetPayment.owner_signature_url = ownerSignatureUrl;
          if (!targetPayment.owner_signature_url) targetPayment.owner_signature_url = 'SIG_AGENCE_KK_CERTIFIED';

          const recRef = targetPayment.reference || reference;
          let targetReceipt = SERVER_STORE.receipts.find(r => r.receipt_number === recRef);
          if (targetReceipt) {
            targetReceipt.status = 'certifie';
            targetReceipt.tenant_signed = true;
            if (tenantSignatureUrl) targetReceipt.tenant_signature_url = tenantSignatureUrl;
            if (targetPayment.owner_signature_url && !targetReceipt.owner_signature_url) {
              targetReceipt.owner_signature_url = targetPayment.owner_signature_url;
            }
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
            targetUserId: targetPayment.owner_id || targetPayment.agency_id || 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
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

        return res.status(404).json({ success: false, error: 'Paiement non trouvé.' });
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
          ...SERVER_STORE.maintenance.filter(t => t.id !== tid)
        ];
        // Notifier le propriétaire et l'agence
        const notif = {
          id: `notif_maint_${Date.now()}`,
          title: '⚠️ Incident de maintenance signalé',
          description: `${newTicket.tenantName || 'Le locataire'} a signalé un problème (${newTicket.category || 'Général'}) pour « ${newTicket.propertyTitle || 'le bien'} » : ${(newTicket.description || '').slice(0, 50)}...`,
          time: "À l'instant",
          unread: true,
          read: false,
          category: 'maintenance',
          type: 'maintenance',
          targetTab: 'maintenance',
          targetRole: 'proprietaire',
          targetUserId: newTicket.ownerId || 'd3a42346-c227-4c67-b4a3-52bd09b98ad9'
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
        const { ticketId, status, notes, scheduledDate, cost, description, rentDeductionRequest } = body;
        const target = SERVER_STORE.maintenance.find(t => t.id === ticketId);
        if (target) {
          if (status) target.status = status;
          if (notes) target.notes = notes;
          if (scheduledDate !== undefined) target.scheduledDate = scheduledDate;
          if (cost !== undefined) target.cost = cost;
          if (description) target.description = description;
          if (rentDeductionRequest) target.rentDeductionRequest = rentDeductionRequest;

          // Si intervention programmée ou résolue, notifier le locataire
          if (status === 'Résolu' || scheduledDate) {
            const notifLoc = {
              id: `notif_maint_upd_${Date.now()}`,
              title: status === 'Résolu' ? '✅ Incident de maintenance résolu' : '📅 Intervention programmée',
              description: status === 'Résolu'
                ? `Votre signalement (${target.category}) pour « ${target.propertyTitle} » a été marqué comme résolu.`
                : `Une intervention est programmée le ${scheduledDate} pour votre incident (${target.category}).`,
              time: "À l'instant",
              unread: true,
              read: false,
              category: 'maintenance',
              type: 'maintenance',
              targetTab: 'maintenance',
              targetRole: 'locataire',
              targetUserId: target.tenantId || target.tenant_id
            };
            SERVER_STORE.notifications = [notifLoc, ...SERVER_STORE.notifications];
          }
          return res.status(200).json({ success: true, ticket: target, maintenance: SERVER_STORE.maintenance });
        }
        return res.status(404).json({ success: false, error: 'Ticket de maintenance non trouvé.' });
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
        const { clientPayments, clientCautions, clientReceipts, clientContracts, clientMaintenance, clientProperties, clientMessages, clientContacts, clientApplications } = body;
        if (Array.isArray(clientPayments)) {
          for (const cp of clientPayments) {
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
            applications: SERVER_STORE.applications
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
