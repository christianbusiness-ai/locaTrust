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
    ownerName: string; // anonymisé/restreint pour conformité RGPD/protection données privées ex: Bailleur B.
    tenantName: string; // ex: Locataire L.
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

// In-memory verification registry for dynamic session registers (contracts & receipts)
export const MOCK_VERIFICATION_REGISTRY: {
  contracts: Record<string, ContractVerificationRecord>;
  receipts: Record<string, ReceiptVerificationRecord>;
} = {
  contracts: {},
  receipts: {}
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
