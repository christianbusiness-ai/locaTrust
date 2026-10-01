// Registre sécurisé des vérifications officielles LocaTrust (Contrats & Reçus)
// Conforme au Code de la Construction et de l'Habitat (Loi n° 2019-576)

export type DocumentVerificationStatus = 'valide' | 'modifie_avenant' | 'revoque_annule' | 'non_authentifie';

export interface AvenantHistoryItem {
  version: number;
  date: string;
  title: string;
  summary: string;
}

export interface ContractVerificationRecord {
  type: 'contrat';
  token: string;
  contractNumber: string;
  status: DocumentVerificationStatus;
  currentVersion: number;
  totalVersions: number;
  createdAt: string;
  signedAt: string;
  isRegisteredLocaTrust: boolean;
  parties: {
    ownerName: string; // anonymisé/restreint pour conformité RGPD/protection données privées ex: Koffi N.
    tenantName: string; // ex: Kouadio J.
    isOwnerSigned: boolean;
    isTenantSigned: boolean;
    ownerSignedAt?: string;
    tenantSignedAt?: string;
  };
  property: {
    propertyRef: string;
    type: string;
    location: string;
  };
  financials: {
    rentAmount: number;
    currency: string;
    cautionAmount: number;
  };
  history?: AvenantHistoryItem[];
  relatedReceipts?: string[]; // IDs/Tokens des reçus
}

export interface ReceiptVerificationRecord {
  type: 'recu';
  token: string;
  receiptNumber: string;
  contractNumber: string;
  contractToken: string;
  status: DocumentVerificationStatus;
  periodCovered: string; // ex: "Août 2026"
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  parties: {
    ownerName: string;
    tenantName: string;
  };
  property: {
    type: string;
    location: string;
  };
  isValidatedByOwner: boolean;
  validatedAt: string;
}

// Token store initial / Registry
export const MOCK_VERIFICATION_REGISTRY: {
  contracts: Record<string, ContractVerificationRecord>;
  receipts: Record<string, ReceiptVerificationRecord>;
} = {
  contracts: {
    'CT-2026-00059': {
      type: 'contrat',
      token: 'CT-2026-00059',
      contractNumber: 'CT-2026-00059',
      status: 'valide',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: '24/09/2026',
      signedAt: '24/09/2026 14:30',
      isRegisteredLocaTrust: true,
      parties: {
        ownerName: 'Kouassi A.',
        tenantName: 'Kouamé Y.',
        isOwnerSigned: true,
        isTenantSigned: false,
        ownerSignedAt: '24/09/2026 14:30'
      },
      property: {
        propertyRef: 'BIEN-2026-059',
        type: 'Villa Duplex 4 pièces',
        location: 'Cocody Angré 8ème Tranche, Abidjan - Côte d\'Ivoire'
      },
      financials: {
        rentAmount: 250000,
        currency: 'FCFA',
        cautionAmount: 500000
      },
      history: [
        {
          version: 1,
          date: '24/09/2026',
          title: 'Contrat de bail certifié conforme',
          summary: 'Bail d\'habitation 12 mois conforme Loi n° 2019-576. En attente signature preneur.'
        }
      ],
      relatedReceipts: []
    },
    'CT-2026-00060': {
      type: 'contrat',
      token: 'CT-2026-00060',
      contractNumber: 'CT-2026-00060',
      status: 'valide',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: '28/09/2026',
      signedAt: '28/09/2026 11:15',
      isRegisteredLocaTrust: true,
      parties: {
        ownerName: 'Kouassi A.',
        tenantName: 'Touré M.',
        isOwnerSigned: true,
        isTenantSigned: true,
        ownerSignedAt: '28/09/2026 11:10',
        tenantSignedAt: '28/09/2026 11:15'
      },
      property: {
        propertyRef: 'BIEN-2026-060',
        type: 'Appartement 3 pièces Standing',
        location: 'Cocody Riviera Palmeraie, Abidjan - Côte d\'Ivoire'
      },
      financials: {
        rentAmount: 180000,
        currency: 'FCFA',
        cautionAmount: 360000
      },
      history: [
        {
          version: 1,
          date: '28/09/2026',
          title: 'Contrat de bail signé et validé',
          summary: 'Bail d\'habitation 12 mois avec certification numérique LocaTrust.'
        }
      ],
      relatedReceipts: []
    },
    'CT-2026-00061': {
      type: 'contrat',
      token: 'CT-2026-00061',
      contractNumber: 'CT-2026-00061',
      status: 'valide',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: '30/09/2026',
      signedAt: '30/09/2026 16:40',
      isRegisteredLocaTrust: true,
      parties: {
        ownerName: 'Kouassi A.',
        tenantName: 'Bamba F.',
        isOwnerSigned: true,
        isTenantSigned: true,
        ownerSignedAt: '30/09/2026 16:35',
        tenantSignedAt: '30/09/2026 16:40'
      },
      property: {
        propertyRef: 'BIEN-2026-061',
        type: 'Studio meublé moderne',
        location: 'Marcory Zone 4, Abidjan - Côte d\'Ivoire'
      },
      financials: {
        rentAmount: 120000,
        currency: 'FCFA',
        cautionAmount: 240000
      },
      history: [
        {
          version: 1,
          date: '30/09/2026',
          title: 'Contrat de bail certifié conforme',
          summary: 'Bail d\'habitation meublé conforme avec inventaire numérique.'
        }
      ],
      relatedReceipts: []
    },
    'tok_cnt_ci2026_000123': {
      type: 'contrat',
      token: 'tok_cnt_ci2026_000123',
      contractNumber: 'LT-CI-2026-000123',
      status: 'valide',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: '01/07/2026',
      signedAt: '01/07/2026 10:32',
      isRegisteredLocaTrust: true,
      parties: {
        ownerName: 'Koffi N.',
        tenantName: 'Kouadio J.',
        isOwnerSigned: true,
        isTenantSigned: true,
        ownerSignedAt: '01/07/2026 10:30',
        tenantSignedAt: '01/07/2026 10:32'
      },
      property: {
        propertyRef: 'BIEN-000456',
        type: 'Appartement 3 pièces',
        location: 'Cocody Riviera 3, Abidjan'
      },
      financials: {
        rentAmount: 75000,
        currency: 'FCFA',
        cautionAmount: 150000
      },
      history: [
        {
          version: 1,
          date: '01/07/2026',
          title: 'Contrat original signé',
          summary: 'Bail d\'habitation initial 12 mois certifié conforme Loi n°2019-576.'
        }
      ],
      relatedReceipts: ['tok_rec_2026_000987', 'tok_rec_2026_000988']
    },
    'tok_cnt_ci2026_000492': {
      type: 'contrat',
      token: 'tok_cnt_ci2026_000492',
      contractNumber: 'LT-2026-CI-000492',
      status: 'valide',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: '24/09/2026',
      signedAt: '24/09/2026 11:35',
      isRegisteredLocaTrust: true,
      parties: {
        ownerName: 'Kouassi A.',
        tenantName: 'Kouadio J.',
        isOwnerSigned: true,
        isTenantSigned: true,
        ownerSignedAt: '24/09/2026 11:30',
        tenantSignedAt: '24/09/2026 11:35'
      },
      property: {
        propertyRef: 'BIEN-000492',
        type: 'Appartement 3 pièces',
        location: 'Cocody Riviera 3, Abidjan'
      },
      financials: {
        rentAmount: 75000,
        currency: 'FCFA',
        cautionAmount: 150000
      },
      history: [
        {
          version: 1,
          date: '24/09/2026',
          title: 'Bail certifié original',
          summary: 'Contrat de bail certifié 41 points légaux conforme.'
        }
      ],
      relatedReceipts: []
    },
    'tok_cnt_ci2026_avenant_demo': {
      type: 'contrat',
      token: 'tok_cnt_ci2026_avenant_demo',
      contractNumber: 'LT-CI-2026-000888',
      status: 'modifie_avenant',
      currentVersion: 2,
      totalVersions: 2,
      createdAt: '01/01/2026',
      signedAt: '01/01/2026',
      isRegisteredLocaTrust: true,
      parties: {
        ownerName: 'Diallo A.',
        tenantName: 'Bakayoko S.',
        isOwnerSigned: true,
        isTenantSigned: true,
        ownerSignedAt: '15/06/2026',
        tenantSignedAt: '15/06/2026'
      },
      property: {
        propertyRef: 'BIEN-000789',
        type: 'Villa 4 pièces',
        location: 'Riviera Bonoumin, Abidjan'
      },
      financials: {
        rentAmount: 350000,
        currency: 'FCFA',
        cautionAmount: 700000
      },
      history: [
        {
          version: 1,
          date: '01/01/2026',
          title: 'Contrat de bail original',
          summary: 'Bail initial à 300 000 FCFA.'
        },
        {
          version: 2,
          date: '15/06/2026',
          title: 'Avenant n°1 (Révision loyer & ajout place de parking)',
          summary: 'Avenant dûment ratifié par les deux parties avec nouvelle mensualité.'
        }
      ],
      relatedReceipts: []
    },
    'tok_cnt_ci2026_revoque_demo': {
      type: 'contrat',
      token: 'tok_cnt_ci2026_revoque_demo',
      contractNumber: 'LT-CI-2026-000999',
      status: 'revoque_annule',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: '01/02/2026',
      signedAt: '01/02/2026',
      isRegisteredLocaTrust: false,
      parties: {
        ownerName: 'Koné M.',
        tenantName: 'Touré F.',
        isOwnerSigned: true,
        isTenantSigned: false
      },
      property: {
        propertyRef: 'BIEN-000999',
        type: 'Studio moderne',
        location: 'Yopougon Maroc, Abidjan'
      },
      financials: {
        rentAmount: 60000,
        currency: 'FCFA',
        cautionAmount: 120000
      },
      history: [
        {
          version: 1,
          date: '01/02/2026',
          title: 'Résiliation prononcée',
          summary: 'Bail révoqué pour non-respect des conditions d\'entrée et absence de caution.'
        }
      ]
    }
  },
  receipts: {
    'tok_rec_2026_000987': {
      type: 'recu',
      token: 'tok_rec_2026_000987',
      receiptNumber: 'REC-2026-000987',
      contractNumber: 'LT-CI-2026-000123',
      contractToken: 'tok_cnt_ci2026_000123',
      status: 'valide',
      periodCovered: 'Août 2026',
      amountPaid: 75000,
      paymentDate: '05/08/2026',
      paymentMethod: 'Wave Mobile Money',
      transactionReference: 'WAVE-CI-77382109',
      parties: {
        ownerName: 'Koffi N.',
        tenantName: 'Kouadio J.'
      },
      property: {
        type: 'Appartement 3 pièces',
        location: 'Cocody Riviera 3, Abidjan'
      },
      isValidatedByOwner: true,
      validatedAt: '05/08/2026 14:22'
    },
    'tok_rec_2026_000988': {
      type: 'recu',
      token: 'tok_rec_2026_000988',
      receiptNumber: 'REC-2026-000988',
      contractNumber: 'LT-CI-2026-000123',
      contractToken: 'tok_cnt_ci2026_000123',
      status: 'valide',
      periodCovered: 'Juillet 2026',
      amountPaid: 75000,
      paymentDate: '04/07/2026',
      paymentMethod: 'Orange Money Côte d\'Ivoire',
      transactionReference: 'OM-CI-99482103',
      parties: {
        ownerName: 'Koffi N.',
        tenantName: 'Kouadio J.'
      },
      property: {
        type: 'Appartement 3 pièces',
        location: 'Cocody Riviera 3, Abidjan'
      },
      isValidatedByOwner: true,
      validatedAt: '04/07/2026 16:10'
    }
  }
};

// Fonction pour générer un token difficile à deviner
export function generateSecureVerificationToken(prefix: 'cnt' | 'rec'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `tok_${prefix}_ci2026_${rand}`;
}

// Fonction pour masquer/anonymiser un nom complet pour la protection de la vie privée (RGPD & Lois Ivoiriennes)
export function maskPersonName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

// Enregistrement dynamique d'un nouveau contrat dans le registre de vérification
export function registerContractInVerificationRegistry(contract: {
  contractNumber: string;
  ownerName: string;
  tenantName: string;
  propertyTitle: string;
  propertyAddress: string;
  rentAmount: number;
  cautionAmount: number;
}): { token: string; verificationUrl: string } {
  const existingToken = Object.keys(MOCK_VERIFICATION_REGISTRY.contracts).find(
    (tok) => MOCK_VERIFICATION_REGISTRY.contracts[tok].contractNumber === contract.contractNumber
  );

  if (existingToken) {
    return {
      token: existingToken,
      verificationUrl: `/verification/contrat/${existingToken}`
    };
  }

  const token = generateSecureVerificationToken('cnt');
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  MOCK_VERIFICATION_REGISTRY.contracts[token] = {
    type: 'contrat',
    token,
    contractNumber: contract.contractNumber,
    status: 'valide',
    currentVersion: 1,
    totalVersions: 1,
    createdAt: dateStr,
    signedAt: `${dateStr} ${timeStr}`,
    isRegisteredLocaTrust: true,
    parties: {
      ownerName: maskPersonName(contract.ownerName),
      tenantName: maskPersonName(contract.tenantName),
      isOwnerSigned: true,
      isTenantSigned: true,
      ownerSignedAt: `${dateStr} ${timeStr}`,
      tenantSignedAt: `${dateStr} ${timeStr}`
    },
    property: {
      propertyRef: `BIEN-${contract.contractNumber.replace(/\D/g, '').slice(-6) || '000100'}`,
      type: contract.propertyTitle,
      location: contract.propertyAddress
    },
    financials: {
      rentAmount: contract.rentAmount,
      currency: 'FCFA',
      cautionAmount: contract.cautionAmount
    },
    history: [
      {
        version: 1,
        date: dateStr,
        title: 'Contrat de bail certifié original',
        summary: 'Émission et certification cryptographique conforme Loi n° 2019-576.'
      }
    ],
    relatedReceipts: []
  };

  return {
    token,
    verificationUrl: `/verification/contrat/${token}`
  };
}

// Enregistrement dynamique d'un nouveau reçu dans le registre de vérification
export function registerReceiptInVerificationRegistry(receipt: {
  receiptNumber: string;
  contractNumber: string;
  contractToken?: string;
  periodCovered: string;
  amountPaid: number;
  paymentMethod: string;
  transactionReference: string;
  ownerName: string;
  tenantName: string;
  propertyTitle: string;
  propertyAddress: string;
}): { token: string; verificationUrl: string } {
  const existingToken = Object.keys(MOCK_VERIFICATION_REGISTRY.receipts).find(
    (tok) => MOCK_VERIFICATION_REGISTRY.receipts[tok].receiptNumber === receipt.receiptNumber
  );

  if (existingToken) {
    return {
      token: existingToken,
      verificationUrl: `/verification/recu/${existingToken}`
    };
  }

  const token = generateSecureVerificationToken('rec');
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Trouver ou créer le lien contrat
  const cToken = receipt.contractToken || 'tok_cnt_ci2026_000123';

  MOCK_VERIFICATION_REGISTRY.receipts[token] = {
    type: 'recu',
    token,
    receiptNumber: receipt.receiptNumber,
    contractNumber: receipt.contractNumber,
    contractToken: cToken,
    status: 'valide',
    periodCovered: receipt.periodCovered,
    amountPaid: receipt.amountPaid,
    paymentDate: dateStr,
    paymentMethod: receipt.paymentMethod,
    transactionReference: receipt.transactionReference,
    parties: {
      ownerName: maskPersonName(receipt.ownerName),
      tenantName: maskPersonName(receipt.tenantName)
    },
    property: {
      type: receipt.propertyTitle,
      location: receipt.propertyAddress
    },
    isValidatedByOwner: true,
    validatedAt: `${dateStr} ${timeStr}`
  };

  // Lier le reçu au contrat s'il existe
  if (MOCK_VERIFICATION_REGISTRY.contracts[cToken]) {
    const list = MOCK_VERIFICATION_REGISTRY.contracts[cToken].relatedReceipts || [];
    if (!list.includes(token)) {
      MOCK_VERIFICATION_REGISTRY.contracts[cToken].relatedReceipts = [...list, token];
    }
  }

  return {
    token,
    verificationUrl: `/verification/recu/${token}`
  };
}
