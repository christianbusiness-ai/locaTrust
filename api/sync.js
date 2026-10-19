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
      status: 'declare',
      target_month: 'Novembre 2026',
      created_at: '2026-10-19T17:15:00.000Z',
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
      tenant_signed: true
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
      tenant_signed: true
    }
  ],

  notifications: [
    {
      id: 'notif_pmt_dec_nov2026_agency',
      title: '💳 Nouveau paiement de loyer déclaré',
      description: 'Christian a déclaré le paiement du loyer de Novembre 2026 (30 000 FCFA • Wave - Réf: WAV-2026-NOV-781920). Cliquez pour vérifier et valider la quittance.',
      time: 'À l\'instant',
      unread: true,
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
      id: 'notif_pmt_dec_nov2026_owner',
      title: '💳 Nouveau paiement de loyer déclaré',
      description: 'Christian a déclaré le paiement du loyer de Novembre 2026 (30 000 FCFA • Wave - Réf: WAV-2026-NOV-781920). Cliquez pour vérifier et valider la quittance.',
      time: 'À l\'instant',
      unread: true,
      category: 'paiement',
      type: 'paiement',
      targetTab: 'payments',
      targetRole: 'proprietaire',
      targetUserId: 'd3a42346-c227-4c67-b4a3-52bd09b98ad9',
      senderUserId: 'a939eff5-c93d-4e6e-9f1f-b61c39986a46',
      payload: {
        paymentId: 'pmt_dec_nov2026_01',
        amount: 30000,
        month: 'Novembre 2026',
        reference: 'WAV-2026-NOV-781920'
      }
    }
  ]
};

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
      
      return res.status(200).json({
        success: true,
        data: {
          payments: SERVER_STORE.payments,
          cautions: SERVER_STORE.cautions,
          receipts: SERVER_STORE.receipts,
          notifications: SERVER_STORE.notifications,
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

      // 2. Validation / Confirmation du paiement par le bailleur ou l'agence
      if (action === 'confirm_payment' || action === 'validate_payment') {
        const { paymentId, reference, ownerSignatureUrl } = body;
        const targetPayment = SERVER_STORE.payments.find(p => p.id === paymentId || p.reference === reference);

        if (targetPayment) {
          targetPayment.status = 'confirme';
          targetPayment.confirmed_at = new Date().toISOString();
          if (ownerSignatureUrl) targetPayment.owner_signature_url = ownerSignatureUrl;

          // Création de la quittance certifiée
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
            status: 'certifie',
            owner_signed: true,
            tenant_signed: true
          };

          SERVER_STORE.receipts = [
            newReceipt,
            ...SERVER_STORE.receipts.filter(r => r.receipt_number !== recRef)
          ];

          // Notification pour le locataire
          const tenantNotif = {
            id: `notif_quittance_${Date.now()}`,
            title: '📜 Quittance de loyer certifiée émise',
            description: `Votre quittance N° ${recRef} (${Number(targetPayment.amount).toLocaleString('fr-FR')} FCFA) a été validée et scellée avec QR Code officiel.`,
            time: 'À l\'instant',
            unread: true,
            category: 'paiement',
            type: 'quittance',
            targetTab: 'receipts',
            targetRole: 'locataire',
            targetUserId: targetPayment.tenant_id,
            payload: {
              receiptNumber: recRef,
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

      // 4. Synchronisation bidirectionnelle globale
      if (action === 'sync_all') {
        const { clientPayments, clientCautions, clientReceipts } = body;
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
        return res.status(200).json({
          success: true,
          data: {
            payments: SERVER_STORE.payments,
            cautions: SERVER_STORE.cautions,
            receipts: SERVER_STORE.receipts,
            notifications: SERVER_STORE.notifications
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
