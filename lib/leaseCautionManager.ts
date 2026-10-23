/**
 * LOCATRUST LEASE & CAUTION MANAGEMENT SYSTEM
 * 
 * Gestion contextuelle et rigoureuse du dépôt de garantie (caution) selon le régime juridique du bail :
 * 1. RESIDENTIAL (Bail à usage d'habitation) :
 *    - Plafond impératif de 2 mois de loyer hors charges (Article 416 de la Loi ivoirienne n° 2019-576).
 *    - Tout dépassement (> 2 mois en mois ou en montant) est formellement bloqué.
 * 2. PROFESSIONAL (Bail à usage professionnel / commercial) :
 *    - Régime contractuel des parties.
 *    - RÈGLE ESSENTIELLE : Ne jamais affirmer arbitrairement que "3 mois est autorisé par l'AUDCG".
 *    - Mention informative invitant à s'assurer de la conformité juridique.
 * 3. UNKNOWN (Contrat ancien / type non renseigné) :
 *    - Pas de déduction aveugle. Statut neutre à qualifier par un administrateur.
 */

export type NormalizedLeaseType = 'RESIDENTIAL' | 'PROFESSIONAL' | 'UNKNOWN';
export type DepositConfigMode = 'MONTHS' | 'CUSTOM_AMOUNT';

export interface DepositValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  infoNote?: string;
  depositAmount: number;
  depositMonths: number;
  monthlyRent: number;
  leaseType: NormalizedLeaseType;
}

/**
 * Normalise le type juridique du bail sans jamais inventer une valeur inconnue
 */
export function normalizeLeaseType(rawType?: any): NormalizedLeaseType {
  if (!rawType) return 'UNKNOWN';
  const val = String(rawType).trim().toUpperCase();

  if (
    val === 'RESIDENTIAL' ||
    val === 'HABITATION' ||
    val === 'LOGEMENT' ||
    val === 'RESIDENCE' ||
    val.includes('HABITATION')
  ) {
    return 'RESIDENTIAL';
  }

  if (
    val === 'PROFESSIONAL' ||
    val === 'PROFESSIONNEL' ||
    val === 'COMMERCIAL' ||
    val === 'COMMERCE' ||
    val === 'BUREAU' ||
    val === 'BOUTIQUE' ||
    val.includes('PROFESSIONNEL') ||
    val.includes('COMMERCIAL')
  ) {
    return 'PROFESSIONAL';
  }

  return 'UNKNOWN';
}

/**
 * Libellé officiel du type de bail
 */
export function getLeaseTypeLabel(rawType?: any): string {
  const norm = normalizeLeaseType(rawType);
  switch (norm) {
    case 'RESIDENTIAL':
      return "Bail à usage d'habitation";
    case 'PROFESSIONAL':
      return 'Bail à usage professionnel/commercial';
    case 'UNKNOWN':
    default:
      return 'Type de bail non qualifié';
  }
}

/**
 * Libellé contractuel complet pour les actes et le PDF
 */
export function getLeaseTypeOfficialLegalName(rawType?: any): string {
  const norm = normalizeLeaseType(rawType);
  switch (norm) {
    case 'RESIDENTIAL':
      return "Bail à Usage d'Habitation (Loi n° 2019-576 du 26 juin 2019)";
    case 'PROFESSIONAL':
      return 'Bail à Usage Professionnel / Commercial (AUDCG OHADA)';
    case 'UNKNOWN':
    default:
      return 'Bail de Location';
  }
}

/**
 * Validation stricte du dépôt de garantie selon le type de bail
 * Utilisable côté client (UX réactive) et côté serveur / API
 */
export function validateDepositRule(params: {
  leaseType: any;
  monthlyRent: number;
  depositAmount?: number;
  depositMonths?: number;
  configMode?: DepositConfigMode;
}): DepositValidationResult {
  const normType = normalizeLeaseType(params.leaseType);
  const monthlyRent = Math.max(0, Number(params.monthlyRent || 0));

  let depositAmount = Number(params.depositAmount || 0);
  let depositMonths = Number(params.depositMonths || 0);

  // Si calculé depuis les mois
  if (params.configMode === 'MONTHS' && depositMonths > 0) {
    depositAmount = Math.round(monthlyRent * depositMonths);
  } else if (depositAmount > 0 && monthlyRent > 0 && (!depositMonths || depositMonths === 0)) {
    depositMonths = Number((depositAmount / monthlyRent).toFixed(2));
  } else if (depositAmount > 0 && monthlyRent > 0) {
    // Synchronisation de l'équivalent mois
    depositMonths = Number((depositAmount / monthlyRent).toFixed(2));
  }

  // 1. Cas BAIL À USAGE D'HABITATION (Art. 416 Loi n° 2019-576)
  if (normType === 'RESIDENTIAL') {
    const maxAllowedAmount = monthlyRent * 2;
    const isMonthsExceeded = depositMonths > 2.05; // marge minime d'arrondi
    const isAmountExceeded = monthlyRent > 0 && depositAmount > maxAllowedAmount;

    if (isMonthsExceeded || isAmountExceeded) {
      return {
        valid: false,
        error:
          "Pour un bail à usage d'habitation, le dépôt de garantie ne peut pas dépasser deux mois de loyer conformément aux règles applicables.",
        depositAmount,
        depositMonths,
        monthlyRent,
        leaseType: normType
      };
    }

    return {
      valid: true,
      infoNote: 'Dépôt de garantie maximum : 2 mois de loyer (Loi n° 2019-576 Art. 416).',
      depositAmount,
      depositMonths,
      monthlyRent,
      leaseType: normType
    };
  }

  // 2. Cas BAIL À USAGE PROFESSIONNEL / COMMERCIAL
  if (normType === 'PROFESSIONAL') {
    if (depositAmount < 0 || depositMonths < 0) {
      return {
        valid: false,
        error: 'Le montant de la garantie commerciale doit être positif.',
        depositAmount,
        depositMonths,
        monthlyRent,
        leaseType: normType
      };
    }

    return {
      valid: true,
      infoNote:
        'Le montant de la garantie pour un bail à usage professionnel doit être conforme aux dispositions applicables et aux clauses du contrat. En cas de doute, faites vérifier le montant par un professionnel du droit.',
      depositAmount,
      depositMonths,
      monthlyRent,
      leaseType: normType
    };
  }

  // 3. Cas UNKNOWN (Ancien contrat non qualifié)
  return {
    valid: true,
    warning:
      'Le régime juridique de ce contrat est indéterminé. Veuillez préciser si le bail est à usage d\'habitation ou professionnel.',
    depositAmount,
    depositMonths,
    monthlyRent,
    leaseType: normType
  };
}

/**
 * Formate la mention contractuelle exacte pour les clauses et le PDF
 * Exemple : "Le dépôt de garantie est fixé à la somme de 1 500 000 FCFA, correspondant à trois (3) mois de loyer."
 */
export function formatOfficialDepositClause(depositAmount: number, depositMonths: number): string {
  const formattedAmount = `${new Intl.NumberFormat('fr-FR').format(depositAmount)} FCFA`;
  const roundedMonths = Math.round(depositMonths * 10) / 10;
  return `Le dépôt de garantie est fixé à la somme de ${formattedAmount}, correspondant à ${roundedMonths} mois de loyer principal.`;
}
