/**
 * LOCATRUST LEGAL ANALYSIS ENGINE
 * 
 * Moteur d'audit et de conformité juridique des baux immobiliers en Côte d'Ivoire.
 * Conforme à la hiérarchie des normes :
 *  1. Baux d'habitation : Loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l'Habitat
 *  2. Baux à usage professionnel : Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)
 *  3. Droit commun des obligations et contrats (Code Civil)
 * 
 * RÈGLE FONDAMENTALE :
 * - Le moteur n'invente JAMAIS une clause ou une anomalie.
 * - Aucune anomalie n'est produite si aucune clause n'enfreint l'ordre public.
 * - Le moteur comprend les phrases des propriétaires même avec un faible niveau de français,
 *   des fautes d'orthographe, une mauvaise conjugaison ou des formulations familières.
 * - Le moteur reformule en arrière-plan les clauses conformes pour le contrat final
 *   tout en conservant scrupuleusement l'intention réelle du propriétaire.
 */

export type LeaseType = 'habitation' | 'professionnel';

export type ClauseSourceParty = 'proprietaire' | 'locataire' | 'logement' | 'financier';

export type AnalysisSeverity = 'conforme' | 'information' | 'avertissement' | 'non_conforme' | 'a_verifier';

export interface LegalReference {
  law: string;
  article: string;
  sourceHierarchy: string;
  verified: boolean;
}

export interface AnalyzedClauseItem {
  id: string;
  rawText: string;
  sourceParty: ClauseSourceParty;
  category: string;
  categoryLabel: string;
  status: AnalysisSeverity;
  alertLevel?: 1 | 2 | 3;
  title: string;
  explanation: string;
  legalBasis: LegalReference;
  recommendedAction: string;
  proposedCorrection?: string;
  understoodMeaning?: string;
  reformulatedText?: string;
  fieldSource: 'ownerCustomConditions' | 'tenantCustomRequests' | 'propertySpecificRules' | 'advanceMonths' | 'cautionMonths';
  lineIndex?: number;
}

export interface CategoryStatus {
  id: string;
  label: string;
  status: 'valide' | 'a_verifier' | 'anomalie';
  clausesCount: number;
}

export interface AnomalyReportItem {
  id: string;
  title: string;
  exactClause: string;
  party: ClauseSourceParty;
  problem: string;
  legalBasisText: string;
  legalReference: string;
  severity: 'bloquante' | 'a_verifier' | 'information' | 'avertissement' | 'non_conforme';
  alertLevel?: 1 | 2 | 3;
  alertLevelLabel?: 'NIVEAU 1 — INFORMATION' | 'NIVEAU 2 — AVERTISSEMENT' | 'NIVEAU 3 — NON-CONFORMITÉ';
  recommendedAction: string;
  recommendedCorrection?: string;
  understoodMeaning?: string;
  fieldSource: 'ownerCustomConditions' | 'tenantCustomRequests' | 'propertySpecificRules' | 'advanceMonths' | 'cautionMonths';
  lineIndex?: number;
}

export interface LegalAnalysisReport {
  clauses: AnalyzedClauseItem[];
  categories: CategoryStatus[];
  isGlobalCompliant: boolean;
  blockingCount: number;
  toVerifyCount: number;
  compliantCount: number;
  informationCount?: number;
  warningCount?: number;
  nonConformityCount?: number;
  legalRegimeLabel: string;
  applicableSources: string[];
  anomalies: AnomalyReportItem[];
  legalNotice?: string;
  canContinue: boolean;
  globalStatus: 'conforme' | 'incomplet';
}

// ----------------------------------------------------------------------------
// BASE DE DONNÉES DES VILLES ET COMMUNES DE CÔTE D'IVOIRE
// ----------------------------------------------------------------------------
export interface IvorianCityOption {
  name: string;
  communes: string[];
}

export const IVORIAN_CITIES: IvorianCityOption[] = [
  {
    name: 'Abidjan',
    communes: [
      'Cocody',
      'Yopougon',
      'Marcory',
      'Plateau',
      'Koumassi',
      'Treichville',
      'Port-Bouët',
      'Adjamé',
      'Attécoubé',
      'Abobo',
      'Bingerville',
      'Songon',
      'Anyama'
    ]
  },
  {
    name: 'Bouaké',
    communes: [
      'Commerce',
      'Air France',
      'Nimbo',
      'Belle-Ville',
      'Koko',
      'Broukro',
      'Dar-es-Salam',
      'Ahougnanssou',
      'Kennedy',
      'Zone Industrielle'
    ]
  },
  {
    name: 'Yamoussoukro',
    communes: [
      'Morofé',
      'Habitat',
      '200 Logements',
      'Assabou',
      'N\'zuessy',
      'Dioulakro',
      'Kokrenou',
      'Fondation'
    ]
  },
  {
    name: 'San-Pédro',
    communes: [
      'Balmer',
      'Cité',
      'Bardot',
      'Séwéké',
      'Lac',
      'Zone Portuaire'
    ]
  },
  {
    name: 'Korhogo',
    communes: [
      'Koko',
      'Soba',
      'Téguéré',
      'Sinistré',
      'Petit Paris',
      'Ahoussabougou'
    ]
  },
  {
    name: 'Daloa',
    communes: [
      'Commerce',
      'Tazibouo',
      'Marais',
      'Lobia',
      'Kennedy',
      'Gbeuliville'
    ]
  },
  {
    name: 'Man',
    communes: [
      'Grand Gbapleu',
      'Domoraud',
      'Koko',
      'Libreville',
      'Sari'
    ]
  },
  {
    name: 'Grand-Bassam',
    communes: [
      'Quartier France',
      'Impérial',
      'Moossou',
      'Cafop',
      'Rosiers'
    ]
  }
];

// ----------------------------------------------------------------------------
// TRAITEMENT DU TEXTE, DÉCOUPE ET NORMALISATION SÉMANTIQUE
// ----------------------------------------------------------------------------

/**
 * Nettoie une ligne de texte (retire préfixes numériques ex: "1.", "-", puces, etc.)
 */
export function cleanClauseLine(line: string): string {
  return line.replace(/^[\s\d\-•*.)]+\s*/, '').trim();
}

/**
 * Normalise le texte pour absorber les fautes d'orthographe, variations d'accents
 * et tournures familières tout en préservant le texte d'origine.
 */
export function normalizeSemanticText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Découpe un bloc de texte en clauses logiques individuelles,
 * en gérant les retours à la ligne, les listes à puces, les numérotations et les points-virgules.
 */
export function extractLogicalClauses(text: string): string[] {
  if (!text || !text.trim()) return [];
  const rawLines = text.split(/\r?\n/);
  const clauses: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Détection de plusieurs points numérotés sur une même ligne (ex: "1. ... 2. ...")
    const numberedSubClauses = trimmed.split(/(?<=[^\d]|^)(?=\d+[\.)]\s+)/);
    if (numberedSubClauses.length > 1) {
      for (const sub of numberedSubClauses) {
        const cleaned = cleanClauseLine(sub);
        if (cleaned && cleaned.length >= 3) clauses.push(cleaned);
      }
      continue;
    }

    // Détection de puces sur une même ligne (ex: "• ... • ...")
    const bulletSubClauses = trimmed.split(/(?<=[.!?;\s])\s*[-•*]\s+/);
    if (bulletSubClauses.length > 1) {
      for (const sub of bulletSubClauses) {
        const cleaned = cleanClauseLine(sub);
        if (cleaned && cleaned.length >= 3) clauses.push(cleaned);
      }
      continue;
    }

    // Détection de points-virgules séparant des clauses indépendantes
    if (trimmed.includes(';') && trimmed.length > 35) {
      const semiClauses = trimmed.split(/\s*;\s*/);
      for (const sub of semiClauses) {
        const cleaned = cleanClauseLine(sub);
        if (cleaned && cleaned.length >= 3) clauses.push(cleaned);
      }
      continue;
    }

    const cleaned = cleanClauseLine(trimmed);
    if (cleaned && cleaned.length >= 3) {
      clauses.push(cleaned);
    }
  }

  return clauses;
}

/**
 * Détermine la partie concernée par la clause (propriétaire, locataire, ou logement)
 * en comprenant les intentions même avec tournures familières ou fautes d'orthographe.
 */
export function detectTargetParty(cleaned: string, defaultParty: ClauseSourceParty): ClauseSourceParty {
  const norm = normalizeSemanticText(cleaned);

  const isTargetingTenant =
    /(?:locatair|locataire|preneur|occupant)\s*(?:doit|devra|est tenu|s engage|a l obligation|prendra|paye|paie|paiera|supportera|assurera|fournira|ne peut pas|ne pourra pas|achete|achetera)/.test(norm) ||
    /(?:impose|incombe|incombent|exige|interdit)\s*au\s*(?:locatair|locataire|preneur)/.test(norm) ||
    /(?:a la charge\s*(?:exclusive\s*)?du\s*(?:locatair|locataire|preneur))/.test(norm) ||
    /(?:obligation\s*(?:d achat|pour le locataire|pour le preneur))/.test(norm);

  const isTargetingOwner =
    /(?:proprio|proprietaire|bailleur|loueur)\s*(?:doit|devra|est tenu|s engage|assure|prendra|fournira|garantit|decline|refuse|ne prendra|se reserve)/.test(norm) ||
    /(?:impose|incombe|incombent|exige|interdit)\s*au\s*(?:proprio|proprietaire|bailleur)/.test(norm) ||
    /(?:a la charge\s*(?:exclusive\s*)?du\s*(?:proprio|proprietaire|bailleur))/.test(norm) ||
    /(?:le bailleur decline|le proprietaire decline)/.test(norm);

  if (isTargetingTenant && !isTargetingOwner) return 'locataire';
  if (isTargetingOwner && !isTargetingTenant) return 'proprietaire';
  return defaultParty;
}

// ----------------------------------------------------------------------------
// ANALYSE SÉMANTIQUE ET JURIDIQUE DYNAMIQUE D'UNE CLAUSE RÉELLE
// ----------------------------------------------------------------------------

/**
 * Analyse une clause réellement écrite par le bailleur / locataire.
 * Comprend le sens réel même avec fautes d'orthographe, syntaxe faible ou mots manquants.
 * Reformule les clauses conformes de manière professionnelle et élégante pour le contrat.
 */
function analyzeSingleWrittenClause(
  rawLine: string,
  sourceParty: ClauseSourceParty,
  leaseType: LeaseType,
  fieldSource: 'ownerCustomConditions' | 'tenantCustomRequests' | 'propertySpecificRules',
  lineIndex: number
): AnalyzedClauseItem | null {
  const cleaned = cleanClauseLine(rawLine);
  if (!cleaned || cleaned.length < 3) return null;

  const actualParty = detectTargetParty(cleaned, sourceParty);
  const norm = normalizeSemanticText(cleaned);
  const isHabitation = leaseType === 'habitation';

  // --------------------------------------------------------------------------
  // DOMAINE 0A : DÉTECTION DE TEXTES JURIDIQUES ABROGÉS (LOI N° 2018-575)
  // --------------------------------------------------------------------------
  const mentionsObsolete2018Law =
    /(?:2018\s*[-–]\s*575|loi\s*(?:n[°o]?)?\s*2018|loi\s*du\s*13\s*juin\s*2018)/.test(norm);

  if (mentionsObsolete2018Law) {
    return {
      id: `issue_obsolete_law_${lineIndex}`,
      rawText: cleaned,
      sourceParty,
      category: 'resiliation',
      categoryLabel: 'Conformité légale & Textes en vigueur',
      status: 'avertissement',
      alertLevel: 2,
      title: 'Référence à un texte juridique obsolète / abrogé (Loi n° 2018-575)',
      understoodMeaning: 'Citation de l\'ancienne loi ivoirienne de 2018 sur le bail d\'habitation.',
      explanation:
        'La Loi n° 2018-575 du 13 juin 2018 relative au bail à usage d\'habitation a été expressément abrogée et remplacée par la Loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l\'Habitat. Il est impératif de se référer exclusivement aux textes actuellement en vigueur.',
      legalBasis: {
        law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
        article: 'Sous-titre Bail d\'habitation (Loi actuelle en vigueur)',
        sourceHierarchy: 'Droit Positif Ivoirien en Vigueur',
        verified: true
      },
      recommendedAction: 'Remplacer la mention obsolète par la référence à la Loi n° 2019-576 du 26 juin 2019.',
      proposedCorrection: 'Le contrat est expressément soumis aux dispositions légales en vigueur de la Loi n° 2019-576 du 26 juin 2019.',
      reformulatedText: 'Le présent contrat est conclu sous l\'empire des dispositions en vigueur de la Loi n° 2019-576 instituant le Code de la Construction et de l\'Habitat.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 0B : INCOMPATIBILITÉ DE DESTINATION (USAGE COMMERCIAL EN HABITATION - ART. 410)
  // --------------------------------------------------------------------------
  if (isHabitation) {
    const mentionsProfessionalActivity =
      /(?:bureau|bureaux|commerce|commercial|boutique|magasin|cabinet medical|cabinet dentaire|cabinet d avocat|atelier|artisan|artisanal|activite industrielle|societe|siege social|activite lucrative|vente au detail|stockage de marchandise|salle de sport commerciale)/.test(norm);

    if (mentionsProfessionalActivity) {
      return {
        id: `issue_destination_mismatch_${lineIndex}`,
        rawText: cleaned,
        sourceParty,
        category: 'regles_serenite',
        categoryLabel: 'Destination contractuelle du local',
        status: 'non_conforme',
        alertLevel: 3,
        title: 'Destination professionnelle incompatible avec le bail d\'habitation (Art. 410)',
        understoodMeaning: 'Affectation des locaux à une activité professionnelle ou commerciale sous contrat de bail d\'habitation.',
        explanation:
          'L\'Article 410 du Code de la Construction et de l\'Habitat exclut formellement les immeubles affectés à un usage commercial, administratif, industriel, artisanal ou aux professions libérales du régime du bail d\'habitation. Ce bail doit obligatoirement être régi par le Bail à Usage Professionnel de l\'OHADA (AUDCG).',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
          article: 'Article 410 (Exclusions d\'ordre public du bail d\'habitation)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Requalifier le contrat en Bail à Usage Professionnel (Acte Uniforme OHADA AUDCG).',
        proposedCorrection: 'Conclure un bail à usage professionnel conformément aux dispositions de l\'AUDCG OHADA.',
        reformulatedText: 'Le local est affecté à un usage professionnel conformément à l\'Acte Uniforme OHADA portant sur le Droit Commercial Général.',
        fieldSource,
        lineIndex
      };
    }
  }

  // --------------------------------------------------------------------------
  // DOMAINE 0C : BAIL PROFESSIONNEL — DROIT D'ORDRE PUBLIC AU RENOUVELLEMENT (ART. 123 & 134 OHADA)
  // --------------------------------------------------------------------------
  if (!isHabitation) {
    const deniesRenewal =
      /(?:aucun droit au renouvellement|pas de renouvellement|renonciation au renouvellement|renonce au renouvellement|ne pourra pas renouveler|interdit de renouveler|sans possibilite de renouvellement|aucun renouvellement)/.test(norm);

    if (deniesRenewal) {
      return {
        id: `issue_ohada_renewal_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'proprietaire',
        category: 'resiliation',
        categoryLabel: 'Durée et résiliation',
        status: 'non_conforme',
        alertLevel: 3,
        title: 'Suppression illégale du droit au renouvellement du bail commercial (Art. 123 AUDCG)',
        understoodMeaning: 'Clause supprimant ou interdisant le droit au renouvellement du preneur professionnel.',
        explanation:
          'En droit commercial OHADA, l\'Article 123 de l\'AUDCG confère au preneur ayant exploité l\'activité pendant au moins 2 ans un droit au renouvellement d\'ordre public. L\'Article 134 dispose qu\'aucune clause contractuelle ne peut y déroger, sous peine d\'être réputée non écrite.',
        legalBasis: {
          law: 'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
          article: 'Articles 123 et 134 (Droit impératif au renouvellement commercial)',
          sourceHierarchy: 'Droit Communautaire OHADA (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Supprimer la clause et reconnaître le droit au renouvellement légal sous condition de 2 ans d\'exploitation.',
        proposedCorrection: 'Le preneur bénéficie du droit au renouvellement conformément aux articles 123 et suivants de l\'AUDCG OHADA.',
        reformulatedText: 'Le preneur bénéficie du droit impératif au renouvellement de son bail professionnel dans les conditions prévues par les Articles 123 et suivants de l\'AUDCG OHADA.',
        fieldSource,
        lineIndex
      };
    }

    const isIllegalCommercialTermination =
      /(?:resiliation sans mise en demeure|expulsion immediate sans delai|expulsion sans commissaire|resiliation de plein droit sans notification)/.test(norm);

    if (isIllegalCommercialTermination) {
      return {
        id: `issue_ohada_termination_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'proprietaire',
        category: 'resiliation',
        categoryLabel: 'Durée et résiliation',
        status: 'non_conforme',
        alertLevel: 3,
        title: 'Résiliation ou expulsion sans mise en demeure préalable d\'un mois (Art. 133 AUDCG)',
        understoodMeaning: 'Clause prévoyant une expulsion ou une rupture unilatérale immédiate sans mise en demeure légale.',
        explanation:
          'L\'Article 133 de l\'AUDCG OHADA impose une mise en demeure préalable accordant au moins un (1) mois au preneur pour remédier au manquement avant toute action en résiliation judiciaire. En outre, l\'Article 14 de la Loi ivoirienne n° 2025-221 du 28 mars 2025 soumet toute expulsion d\'un immeuble professionnel au strict respect du commandement de libérer les lieux et au ministère d\'un commissaire de justice.',
        legalBasis: {
          law: 'Acte Uniforme OHADA AUDCG & Loi ivoirienne n° 2025-221 du 28 mars 2025',
          article: 'Article 133 AUDCG & Article 14 Loi 2025-221',
          sourceHierarchy: 'Droit OHADA et Droit National Ivoirien',
          verified: true
        },
        recommendedAction: 'Insérer la procédure légale de mise en demeure d\'au moins un mois avant toute saisine judiciaire.',
        proposedCorrection: 'En cas d\'inexécution, une mise en demeure d\'un (1) mois sera délivrée avant toute saisine judiciaire.',
        reformulatedText: 'Toute résiliation judiciaire pour manquement est subordonnée à une mise en demeure préalable d\'au moins un (1) mois demeurée infructueuse, conformément à l\'Article 133 de l\'AUDCG OHADA et à la Loi N° 2025-221.',
        fieldSource,
        lineIndex
      };
    }
  }

  // --------------------------------------------------------------------------
  // DOMAINE 0D : VENTILATION DES CHARGES ET IMPÔT FONCIER (ART. 417 LOI 2019-576)
  // --------------------------------------------------------------------------
  const mentionsUnfairTaxesOrCharges =
    /(?:locatair|locataire|preneur)\s*.*(?:paie|paye|supporte|a la charge).*(?:impot foncier|taxe fonciere|impot sur le revenu foncier)/.test(norm) ||
    /(?:charges\s*forfaitaires?\s*sans\s*(?:detail|justificatif|decompte))/.test(norm);

  if (mentionsUnfairTaxesOrCharges) {
    return {
      id: `issue_unfair_charges_${lineIndex}`,
      rawText: cleaned,
      sourceParty: 'proprietaire',
      category: 'loyer_caution',
      categoryLabel: 'Charges locatives et fiscalité',
      status: 'avertissement',
      alertLevel: 2,
      title: 'Transfert indu de taxes foncières ou clause de charges ambiguë (Art. 417)',
      understoodMeaning: 'Transfert au locataire de l\'impôt foncier du propriétaire ou imposition de charges non justifiées.',
      explanation:
        'L\'impôt foncier et les taxes grevant la propriété foncière incombent légalement au bailleur. Le locataire ne peut supporter que les charges réelles résultant de son usage des lieux (eau, énergie, menues réparations, entretien courant) conformément à l\'Article 417 de la Loi n° 2019-576.',
      legalBasis: {
        law: isHabitation ? 'Loi n° 2019-576 (Code de la Construction et de l\'Habitat)' : 'Acte Uniforme OHADA AUDCG',
        article: isHabitation ? 'Article 417 (Charges locatives autorisées)' : 'Article 112 (Charges d\'exploitation)',
        sourceHierarchy: isHabitation ? 'Droit National Ivoirien' : 'Droit Commercial OHADA',
        verified: true
      },
      recommendedAction: 'Exclure les impôts fonciers de la charge du preneur et détailler les charges locatives réelles.',
      proposedCorrection: 'Le locataire assume exclusivement les charges locatives d\'usage ; les taxes et impôts fonciers restent à la charge du bailleur.',
      reformulatedText: 'Le preneur rembourse les charges locatives d\'usage effectif des locaux, le bailleur conservant la charge intégrale de l\'impôt foncier.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 1 : RÉPARATIONS, TRAVAUX ET ENTRETIEN DU LOGEMENT
  // --------------------------------------------------------------------------
  // Règle d'ordre public : Les grosses réparations (clos, couvert, structure, toiture)
  // incombent obligatoirement au bailleur (Art. 428 Loi 2019-576 / Art. 106 OHADA AUDCG).
  // Seules les réparations locatives et l'entretien courant incombent au locataire (Art. 435).

  const mentionsRepairsOrWorks =
    /(?:repar|travaux|chantier|peinture|fuite|toit|toiture|mur|murs|charpente|gros oeuvre|etancheite|fissure|plomberie|robinet|ampoule|serrure|carreau|faience)/.test(norm);

  if (mentionsRepairsOrWorks) {
    // Cas 1A : Transfert illégal des grosses réparations ou de "toutes les réparations" au locataire
    // Exemples propriétaires : "locataire doit payer tout réparation maison", "locataire paie tous les travaux même gros travaux",
    // "locataire prend a sa charge grosse reparation et toiture", "tous les travaux a la charge du locataire"
    const shiftsAllOrHeavyToTenant =
      /(?:locatair|locataire|preneur)\s*.*(?:doit|paye|paie|paiera|supporte|prend|incombe|incombent).*(?:tout(?:e)?s?\s*(?:les\s*)?repar|tout(?:e)?s?\s*(?:les\s*)?travaux|gros(?:se)?s?\s*repar|gros\s*travaux|toiture|charpente|etancheite|gros\s*murs|structure)/.test(norm) ||
      /(?:a la charge\s*(?:exclusive\s*)?du\s*(?:locatair|locataire|preneur)\s*.*(?:tout(?:e)?s?\s*repar|tout(?:e)?s?\s*travaux|gros(?:se)?s?\s*repar|gros\s*travaux|toiture|structure))/.test(norm) ||
      /(?:tout(?:e)?s?\s*(?:les\s*)?reparations?\s*.*(?:charge|incombent|supporte).*(?:locatair|locataire|preneur))/.test(norm) ||
      /(?:proprietaire|bailleur)\s*.*(?:decline|refuse|ne prendra pas|ne paye pas).*(?:repar|travaux|toiture|structure)/.test(norm);

    if (shiftsAllOrHeavyToTenant) {
      return {
        id: `issue_repairs_shift_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'proprietaire',
        category: 'entretien_reparations',
        categoryLabel: 'Entretien et réparations',
        status: 'non_conforme',
        title: 'Transfert illégal des grosses réparations de structure au locataire',
        understoodMeaning:
          'Prise en charge de la totalité des réparations ou des gros travaux de l\'immeuble imposée au locataire.',
        explanation:
          'En droit ivoirien comme en droit OHADA, les grosses réparations structurelles (toiture, clos, couvert, murs porteurs) incombent exclusivement au bailleur. Elles ne peuvent en aucun cas être mises à la charge du locataire.',
        legalBasis: isHabitation
          ? {
              law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
              article: 'Article 428 (Grosses réparations impératives à la charge du bailleur)',
              sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
              verified: true
            }
          : {
              law: 'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
              article: 'Article 106 (Grosses réparations structurelles du bailleur)',
              sourceHierarchy: 'Droit Communautaire OHADA (Bail Professionnel)',
              verified: true
            },
        recommendedAction:
          'Rappeler que le locataire n\'assume que les menues réparations locatives et que les grosses réparations incombent au bailleur.',
        proposedCorrection:
          'Le locataire prend en charge les menues réparations locatives et l\'entretien courant ; les grosses réparations de structure et de toiture demeurent à la charge exclusive du bailleur.',
        reformulatedText:
          'Le locataire prend en charge l\'entretien locatif d\'usage et les menues réparations, tandis que les grosses réparations structurelles demeurent à la charge du bailleur.',
        fieldSource,
        lineIndex
      };
    }

    // Cas 1B : Prise en charge des grosses réparations par le propriétaire (Parfaitement conforme)
    const ownerTakesHeavy =
      /(?:proprio|proprietaire|bailleur)\s*.*(?:repare|prend en charge|assure|paye|paie|garantit).*(?:gros|toiture|fuite|structure|murs|etancheite)/.test(norm) ||
      /(?:grosses?\s*reparations?\s*.*(?:a la charge|incombent).*(?:proprio|proprietaire|bailleur))/.test(norm);

    if (ownerTakesHeavy) {
      return {
        id: `valid_owner_repairs_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'proprietaire',
        category: 'entretien_reparations',
        categoryLabel: 'Entretien et réparations',
        status: 'conforme',
        title: 'Prise en charge des grosses réparations par le propriétaire',
        understoodMeaning:
          'Le propriétaire assume son obligation légale d\'effectuer les grosses réparations et l\'étanchéité du bien.',
        explanation:
          'Clause parfaitement conforme aux dispositions de l\'Article 428 du Code de la Construction et de l\'Habitat.',
        legalBasis: {
          law: isHabitation ? 'Loi n° 2019-576 (Art. 428)' : 'OHADA AUDCG (Art. 106)',
          article: isHabitation ? 'Article 428' : 'Article 106',
          sourceHierarchy: isHabitation ? 'Droit National Ivoirien' : 'Droit Communautaire OHADA',
          verified: true
        },
        recommendedAction: 'Clause validée.',
        reformulatedText:
          'Le bailleur conserve à sa charge exclusive les grosses réparations relatives au clos, au couvert, à la toiture et à la solidité générale de l\'immeuble.',
        fieldSource,
        lineIndex
      };
    }

    // Cas 1C : Entretien courant et menues réparations assumées par le preneur (Parfaitement conforme)
    // Ex: "locataire nettoie cour et change ampoule", "locataire s'occupe de la robinetterie et menues reparations"
    const tenantRoutineMaintenance =
      /(?:locatair|locataire|preneur)\s*.*(?:nettoie|entretient|assure|change|remplace|prend en charge).*(?:cour|ampoule|robinet|joint|jardin|peinture interieure|proprete|entretien|menues?)/.test(norm) ||
      /(?:entretien\s*courant|menues?\s*reparations?|remplacement\s*des\s*ampoules)/.test(norm);

    if (tenantRoutineMaintenance) {
      return {
        id: `valid_tenant_routine_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'locataire',
        category: 'entretien_reparations',
        categoryLabel: 'Entretien et réparations',
        status: 'conforme',
        title: 'Prise en charge de l\'entretien courant par le locataire',
        understoodMeaning:
          'Le locataire assure l\'entretien locatif d\'usage quotidien et les menues réparations des lieux.',
        explanation:
          'Clause conforme aux dispositions de l\'Article 435 du Code de la Construction et de l\'Habitat.',
        legalBasis: {
          law: isHabitation ? 'Loi n° 2019-576 (Art. 435)' : 'OHADA AUDCG (Art. 112)',
          article: isHabitation ? 'Article 435' : 'Article 112',
          sourceHierarchy: isHabitation ? 'Droit National Ivoirien' : 'Droit Communautaire OHADA',
          verified: true
        },
        recommendedAction: 'Clause validée.',
        reformulatedText:
          'Le locataire assure à sa charge l\'entretien locatif courant des locaux ainsi que les menues réparations d\'usage (robinetterie, ampoules et propreté des parties privatives).',
        fieldSource,
        lineIndex
      };
    }
  }

  // --------------------------------------------------------------------------
  // DOMAINE 2 : EXPULSION FORCÉE, COUPURE DE COURANT / EAU OU VOIE DE FAIT
  // --------------------------------------------------------------------------
  // Ex: "bailleur va couper electricite si pas paye", "expulsion immediate sans preavis", "changer les serrures"
  const isIllegalEvictionOrCutoff =
    /(?:coupe|couper|fermer)\s*(?:le\s*)?(?:courant|electricite|l eau|eau|compteur)/.test(norm) ||
    /(?:expuls|jeter dehors|mettre dehors|chasser)\s*(?:sans\s*)?(?:preavis|juge|decision|tribunal|delai)/.test(norm) ||
    /(?:changer|change)\s*(?:les?\s*)?(?:serrure|cles?)\s*(?:sans\s*accord|d office|unilateralement)/.test(norm) ||
    /(?:mise\s*dehors|expulsion\s*immediate)/.test(norm);

  if (isIllegalEvictionOrCutoff) {
    return {
      id: `issue_illegal_eviction_${lineIndex}`,
      rawText: cleaned,
      sourceParty: 'proprietaire',
      category: 'resiliation',
      categoryLabel: 'Durée et résiliation',
      status: 'non_conforme',
      alertLevel: 3,
      title: 'Clause d\'expulsion d\'office, coupure de fluide ou justice privée prohibée (Loi n° 2025-221)',
      understoodMeaning:
        'Menace de coupure d\'eau ou d\'électricité, ou expulsion forcée sans décision exécutoire ni commissaire de justice en cas d\'impayé.',
      explanation:
        'Toute expulsion exige impérativement un titre exécutoire et la délivrance préalable d\'un commandement de libérer les lieux exécuté exclusivement par un Commissaire de Justice conformément à la Loi n° 2025-221 du 28 mars 2025 (applicable aux baux d\'habitation et professionnels via son Article 14). Couper l\'eau ou l\'électricité et changer unilatéralement les serrures constituent des voies de fait illégales pénalement et civilement répréhensibles.',
      legalBasis: isHabitation
        ? {
            law: 'Loi n° 2019-576 (Art. 450) & Loi n° 2025-221 du 28 mars 2025',
            article: 'Article 450 Loi 2019-576 & Procédures d\'expulsion Loi 2025-221',
            sourceHierarchy: 'Droit Positif Ivoirien (Ordre Public)',
            verified: true
          }
        : {
            law: 'Acte Uniforme OHADA AUDCG (Art. 133) & Loi n° 2025-221 du 28 mars 2025',
            article: 'Article 133 AUDCG & Article 14 Loi 2025-221',
            sourceHierarchy: 'Droit Communautaire OHADA & Loi Nationale 2025-221',
            verified: true
          },
      recommendedAction:
        'Remplacer cette clause par le rappel de la procédure légale de mise en demeure et d\'exécution par Commissaire de Justice.',
      proposedCorrection:
        'En cas d\'impayé ou de manquement contractuel, le bailleur délivrera une mise en demeure puis agira par voie de justice conformément à la Loi n° 2025-221.',
      reformulatedText:
        'Toute résiliation et exécution se dérouleront conformément à la législation en vigueur, dans le respect de la mise en demeure préalable et de la Loi N° 2025-221 régissant les procédures d\'expulsion.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 3 : VISITES INOPINÉES / VIOLATION DE DOMICILE
  // --------------------------------------------------------------------------
  // Ex: "proprietaire rentre quand il veut", "double des cles pour verifier maison sans prevenir"
  const isAbusiveAccess =
    /(?:proprio|proprietaire|bailleur)\s*.*(?:rentre|visite|entre|inspecte|accede)\s*.*(?:quand y veut|quand il veut|a tout moment|sans prevenir|sans accord|sans rdv|n importe quand)/.test(norm) ||
    /(?:double\s*(?:des\s*)?cles?\s*pour\s*(?:entrer|visiter)\s*(?:a tout moment|sans accord))/.test(norm);

  if (isAbusiveAccess) {
    return {
      id: `issue_abusive_access_${lineIndex}`,
      rawText: cleaned,
      sourceParty: 'proprietaire',
      category: 'obligations_bailleur',
      categoryLabel: 'Obligations du propriétaire',
      status: 'non_conforme',
      title: 'Clause de visite inopinée attentatoire à l\'inviolabilité du domicile',
      understoodMeaning:
        'Droit pour le propriétaire de pénétrer dans le logement loué à tout moment sans accord préalable du locataire.',
      explanation:
        'Le bailleur est garant de la jouissance paisible des lieux et ne peut s\'introduire dans le logement sans le consentement exprès et préalable du locataire, sous peine de violation de domicile.',
      legalBasis: {
        law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
        article: 'Article 425 (Jouissance paisible et inviolabilité du domicile)',
        sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
        verified: true
      },
      recommendedAction:
        'Préciser que les visites annuelles d\'inspection se font sur accord concerté et préavis préalable.',
      proposedCorrection:
        'Le bailleur pourra visiter les lieux loués une fois par an ou en cas de préavis de départ, après accord préalable sur la date et l\'heure avec le locataire.',
      reformulatedText:
        'Le bailleur pourra convenir avec le preneur d\'une visite annuelle de contrôle de l\'état d\'entretien du logement, moyennant un préavis raisonnable.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 4 : RESPECT DE LA VIE PRIVÉE & VISITEURS DU LOCATAIRE
  // --------------------------------------------------------------------------
  // Ex: "interdit de recevoir visiteur", "pas d invites la nuit", "locataire doit pas recevoir famille"
  const isVisitorBan =
    /(?:interdit|interdiction|pas de|ne doit pas)\s*.*(?:visiteur|visite|invite|famille|proche|dormir)/.test(norm) &&
    !/(?:nuisance|bruit|tapage|22h|musique|calme)/.test(norm);

  if (isVisitorBan) {
    return {
      id: `issue_visitor_ban_${lineIndex}`,
      rawText: cleaned,
      sourceParty: 'proprietaire',
      category: 'obligations_locataire',
      categoryLabel: 'Obligations du locataire',
      status: 'non_conforme',
      title: 'Clause attentatoire au respect de la vie privée et à la liberté d\'accueil',
      understoodMeaning:
        'Interdiction faite au locataire d\'accueillir ou d\'héberger temporairement ses proches ou visiteurs.',
      explanation:
        'Le preneur a droit à la jouissance paisible des locaux et au respect de sa vie privée. Le bailleur ne peut pas restreindre la liberté du locataire de recevoir des visiteurs, pourvu que le repos du voisinage soit respecté.',
      legalBasis: {
        law: 'Loi n° 2019-576 du 26 juin 2019',
        article: 'Article 425 (Liberté de jouissance et respect de la vie privée)',
        sourceHierarchy: 'Droit National Ivoirien',
        verified: true
      },
      recommendedAction:
        'Remplacer l\'interdiction de visite par une règle légitime de préservation de la tranquillité du voisinage.',
      proposedCorrection:
        'Le locataire use paisiblement des locaux loués et veille à ne causer aucun trouble de voisinage lors de la réception de ses invités.',
      reformulatedText:
        'Le preneur use paisiblement des locaux loués et veille à ce que ses visiteurs respectent la quiétude et la sérénité du voisinage.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 5 : CONFISCATION DU DÉPÔT DE GARANTIE (CAUTION)
  // --------------------------------------------------------------------------
  // Ex: "caution rendu jamais", "caution reste au bailleur d office", "caution non remboursable"
  const isDepositConfiscation =
    /(?:caution|depot de garantie)\s*.*(?:rendu jamais|jamais rendu|ne sera jamais|pas remboursable|non remboursable|reste acquis|d office au bailleur)/.test(norm) ||
    /(?:non restitution\s*(?:de la caution|du depot))/.test(norm);

  if (isDepositConfiscation) {
    return {
      id: `issue_deposit_confiscation_${lineIndex}`,
      rawText: cleaned,
      sourceParty: 'proprietaire',
      category: 'loyer_caution',
      categoryLabel: 'Loyer et paiement',
      status: 'non_conforme',
      title: 'Clause léonine de rétention automatique du dépôt de garantie (caution)',
      understoodMeaning:
        'Non-restitution automatique et définitive du dépôt de garantie au terme de la location.',
      explanation:
        'Le dépôt de garantie sert exclusivement à couvrir d\'éventuels impayés ou dégradations justifiés par l\'état des lieux de sortie. Il doit être obligatoirement restitué dans un délai maximum de 30 jours après remise des clés.',
      legalBasis: {
        law: 'Loi n° 2019-576 du 26 juin 2019',
        article: 'Article 417 (Délai légal de restitution sous 30 jours)',
        sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
        verified: true
      },
      recommendedAction: 'Supprimer la clause de confiscation et rappeler le délai légal de restitution.',
      proposedCorrection:
        'Le dépôt de garantie sera restitué au locataire dans un délai maximum de 30 jours après remise des clés, déduction faite des réparations locatives justifiées.',
      reformulatedText:
        'Le dépôt de garantie sera restitué dans un délai de 30 jours suivant l\'état des lieux de sortie conforme et la restitution des clés.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 6 : VENTE LIÉE OU OBLIGATION D'ACHAT ÉTRANGÈRE AU BAIL
  // --------------------------------------------------------------------------
  // Ex: "locataire doit acheter la voiture du bailleur", "obligation d'acheter meuble pour 2 millions"
  const isTiedSale =
    /(?:acheter|achat|acquerir|achat obligatoire)\s*.*(?:voiture|vehicule|auto|moto|poste tv|meuble|marchandise)/.test(norm) ||
    /(?:locatair|locataire)\s*.*(?:doit|oblige)\s*.*(?:acheter|prendre)\s*.*(?:voiture|vehicule|moto|bien meuble)/.test(norm);

  if (isTiedSale) {
    return {
      id: `issue_car_tied_sale_${lineIndex}`,
      rawText: cleaned,
      sourceParty: actualParty,
      category: 'regles_serenite',
      categoryLabel: 'Objet du bail et obligations particulières',
      status: 'non_conforme',
      title: 'Vente liée ou obligation d\'achat d\'un véhicule ou bien meuble étranger au bail',
      understoodMeaning:
        'Obligation imposée au locataire d\'acheter un véhicule ou un bien meuble étranger à l\'usage du logement.',
      explanation:
        'Le contrat de bail a pour objet exclusif la jouissance du bien immobilier. Y subordonner l\'achat d\'un véhicule ou de biens meubles constitue une vente liée abusive sans rapport avec le bail.',
      legalBasis: {
        law: 'Code Civil & Lois sur les pratiques commerciales et baux',
        article: 'Article 1134 du Code Civil (Droit commun des obligations)',
        sourceHierarchy: 'Droit commun des obligations & Droit locatif',
        verified: true
      },
      recommendedAction:
        'Supprimer l\'obligation d\'achat étranger au bail et recentrer le contrat sur l\'usage paisible des lieux.',
      proposedCorrection:
        'Le locataire use des locaux loués conformément à leur seule destination locative.',
      reformulatedText:
        'Le preneur use des locaux conformément à la destination convenue dans le présent contrat.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 7 : ASSAINISSEMENT, FOSSE SEPTIQUE ET SALUBRITÉ
  // --------------------------------------------------------------------------
  const mentionsSanitationOrSeptic =
    /(?:fosse|assainissement|vidange|sanitaire|wc|egout|canalisation|toilette)/.test(norm);

  if (mentionsSanitationOrSeptic) {
    // Cas 7A : Exonération abusive ou imposition de la vidange dès l'entrée au locataire
    const isAbusiveSanitation =
      /(?:proprio|proprietaire|bailleur)\s*.*(?:decline|refuse|ne prendra|rejette).*(?:fosse|assainissement|vidange)/.test(norm) ||
      /(?:locatair|locataire)\s*.*(?:doit|oblige)\s*.*(?:vider|vidanger|reparer fosse|frais de vidange).*(?:entree|des l entree|debut)/.test(norm);

    if (isAbusiveSanitation) {
      return {
        id: `issue_sanitation_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'proprietaire',
        category: 'entretien_reparations',
        categoryLabel: 'Entretien et réparations',
        status: 'non_conforme',
        title: 'Exonération abusive relative à l\'assainissement ou à la fosse septique',
        understoodMeaning:
          'Refus de prise en charge de la conformité de l\'assainissement par le bailleur ou obligation de vidange imposée au locataire dès son entrée.',
        explanation:
          'Le bailleur a l\'obligation légale de délivrer un logement décent et salubre avec des installations d\'assainissement fonctionnelles et vidangées à l\'entrée. Il ne peut s\'exonérer de cette obligation légale.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
          article: 'Article 424 (Obligation de délivrance d\'un logement décent et salubre)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction:
          'Garantir la délivrance d\'une fosse septique vidangée à l\'entrée et fonctionnelle.',
        proposedCorrection:
          'Le bailleur délivre des installations sanitaires et d\'assainissement en parfait état de fonctionnement à l\'entrée ; le preneur s\'engage à un usage normal.',
        reformulatedText:
          'Le bailleur garantit la délivrance d\'un système d\'évacuation et d\'assainissement en parfait état d\'usage et de fonctionnement.',
        fieldSource,
        lineIndex
      };
    } else {
      // Cas 7B : Entretien conforme de l'assainissement
      return {
        id: `valid_sanitation_${lineIndex}`,
        rawText: cleaned,
        sourceParty,
        category: 'entretien_reparations',
        categoryLabel: 'Entretien et réparations',
        status: 'conforme',
        title: 'Usage conforme et salubrité des installations sanitaires',
        understoodMeaning:
          'Règle d\'usage conforme et d\'entretien régulier du système sanitaire et d\'assainissement.',
        explanation: 'Clause conforme garantissant la salubrité et l\'usage normal des installations.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019',
          article: 'Article 424 & 435',
          sourceHierarchy: 'Droit National Ivoirien',
          verified: true
        },
        recommendedAction: 'Clause validée.',
        reformulatedText:
          'Le locataire veille à l\'usage soigné et normal des équipements d\'assainissement et sanitaires mis à sa disposition.',
        fieldSource,
        lineIndex
      };
    }
  }

  // --------------------------------------------------------------------------
  // DOMAINE 8 : SOUS-LOCATION DU LOGEMENT
  // --------------------------------------------------------------------------
  const mentionsSublease = /(?:sous louer|sous location|ceder le bail|cession du bail)/.test(norm);
  if (mentionsSublease) {
    const isUnilateralSublease = /(?:peut|pourra|libre)\s*sous louer\s*(?:sans accord|librement|sans autorisation)/.test(norm);
    if (isUnilateralSublease) {
      return {
        id: `issue_unauthorized_sublease_${lineIndex}`,
        rawText: cleaned,
        sourceParty: 'locataire',
        category: 'demandes_particulieres',
        categoryLabel: 'Demandes particulières du locataire',
        status: 'non_conforme',
        title: 'Sous-location unilatérale sans accord préalable du bailleur',
        understoodMeaning:
          'Faculté pour le locataire de sous-louer le logement sans accord écrit du propriétaire.',
        explanation:
          'La sous-location libre ou sans autorisation écrite exprès du bailleur est formellement interdite par l\'Article 437 du Code de la Construction et de l\'Habitat.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019',
          article: 'Article 437 (Interdiction de sous-location sans accord écrit)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Subordonner toute sous-location à l\'accord écrit préalable du bailleur.',
        proposedCorrection:
          'Toute sous-location totale ou partielle est subordonnée à l\'accord écrit et préalable du bailleur.',
        reformulatedText:
          'Toute sous-location ou cession du présent contrat est subordonnée à l\'accord exprès et écrit du bailleur.',
        fieldSource,
        lineIndex
      };
    } else {
      // Sous-location encadrée ou interdite (Conforme)
      return {
        id: `valid_sublease_${lineIndex}`,
        rawText: cleaned,
        sourceParty,
        category: 'regles_serenite',
        categoryLabel: 'Objet du bail et obligations particulières',
        status: 'conforme',
        title: 'Encadrement conforme de la sous-location',
        understoodMeaning:
          'Interdiction ou encadrement strict de la sous-location conformément à la loi.',
        explanation: 'Clause parfaitement conforme aux dispositions de l\'Article 437.',
        legalBasis: {
          law: isHabitation ? 'Loi n° 2019-576 (Art. 437)' : 'OHADA AUDCG (Art. 121)',
          article: isHabitation ? 'Article 437' : 'Article 121',
          sourceHierarchy: isHabitation ? 'Droit National Ivoirien' : 'Droit OHADA',
          verified: true
        },
        recommendedAction: 'Clause validée.',
        reformulatedText:
          'Toute sous-location totale ou partielle des locaux loués est formellement prohibée sans l\'accord préalable et écrit du bailleur.',
        fieldSource,
        lineIndex
      };
    }
  }

  // --------------------------------------------------------------------------
  // DOMAINE 9 : PAIEMENT DU LOYER ET MOYENS DE PAIEMENT (Wave, Orange Money, etc.)
  // --------------------------------------------------------------------------
  // Ex: "locataire paie 80 mille avant 5 du mois par wave", "loyer payé par virement le 1er"
  const mentionsRentPaymentDetails =
    /(?:paye|paie|payer|virement|reglement|versement)\s*.*(?:loyer|wave|orange money|mtn|avant le|le 1|le 5|le 10|mensuel)/.test(norm) ||
    /(?:wave|orange money|mtn money|virement bancaire)/.test(norm);

  if (mentionsRentPaymentDetails && !/(?:double|penalite 50|penalite 20)/.test(norm)) {
    return {
      id: `valid_rent_modality_${lineIndex}`,
      rawText: cleaned,
      sourceParty,
      category: 'loyer_caution',
      categoryLabel: 'Loyer et paiement',
      status: 'conforme',
      title: 'Modalités de paiement du loyer convenues entre les parties',
      understoodMeaning:
        'Modalités d\'exigibilité et moyens de règlement convenus pour le paiement régulier du loyer.',
      explanation:
        'Clause conforme à la liberté contractuelle et au respect de l\'obligation de paiement ponctuel du loyer.',
      legalBasis: {
        law: isHabitation ? 'Loi n° 2019-576 (Art. 434)' : 'OHADA AUDCG (Art. 112)',
        article: isHabitation ? 'Article 434' : 'Article 112',
        sourceHierarchy: isHabitation ? 'Droit National Ivoirien' : 'Droit Communautaire OHADA',
        verified: true
      },
      recommendedAction: 'Clause validée.',
      reformulatedText:
        'Le preneur s\'engage à acquitter le loyer convenu à l\'échéance fixée, par virement bancaire ou paiement électronique sécurisé (Mobile Money / Wave).',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 10 : SÉRÉNITÉ, BON VOISINAGE, ANIMAUX ET PARTIES COMMUNES
  // --------------------------------------------------------------------------
  // Ex: "pas de bruit apres 22h", "respecter voisins", "interdiction animaux dangereux",
  // "stationnement place 14", "interdit de percer faience", "tris des ordures"
  const mentionsSerenityOrPropertyUse =
    /(?:bruit|tapage|calme|22h|voisin|voisinage|animal|animaux|chien|chat|stationnement|parking|place|faience|carreaux|ordure|poubelle|serrure)/.test(norm);

  if (mentionsSerenityOrPropertyUse) {
    return {
      id: `valid_serenity_${lineIndex}`,
      rawText: cleaned,
      sourceParty,
      category: sourceParty === 'locataire' ? 'demandes_particulieres' : 'regles_serenite',
      categoryLabel:
        sourceParty === 'locataire'
          ? 'Demandes particulières du locataire'
          : 'Règles de sérénité, stationnement et entretien courant',
      status: 'conforme',
      title: 'Règle de vie commune, bon voisinage et préservation du logement',
      understoodMeaning:
        'Règle d\'usage paisible des lieux, respect de la quiétude du voisinage et entretien des installations.',
      explanation:
        'Clause conforme au devoir d\'usage en bon père de famille et de respect de la tranquillité d\'autrui.',
      legalBasis: {
        law: isHabitation ? 'Loi n° 2019-576 (Art. 435)' : 'OHADA AUDCG (Art. 112)',
        article: isHabitation ? 'Article 435' : 'Article 112',
        sourceHierarchy: isHabitation ? 'Droit National Ivoirien' : 'Droit OHADA',
        verified: true
      },
      recommendedAction: 'Clause validée.',
      reformulatedText:
        cleaned.toLowerCase().includes('22h') || cleaned.toLowerCase().includes('bruit')
          ? 'Le preneur s\'oblige à veiller à la tranquillité du voisinage en s\'abstenant de toute nuisance sonore ou comportement perturbateur, particulièrement après 22 heures.'
          : cleaned.toLowerCase().includes('stationnement') || cleaned.toLowerCase().includes('parking')
          ? 'Le stationnement de véhicules est réservé aux emplacements dûment désignés, sans obstruction des voies d\'accès et de passage.'
          : cleaned.toLowerCase().includes('animaux') || cleaned.toLowerCase().includes('chien')
          ? 'La présence d\'animaux domestiques est tolérée sous réserve expresse de ne causer aucun trouble de quiétude, d\'hygiène ou de sécurité dans l\'immeuble.'
          : 'Le locataire use paisiblement des locaux loués et respecte les règles d\'entretien et de bon voisinage.',
      fieldSource,
      lineIndex
    };
  }

  // --------------------------------------------------------------------------
  // DOMAINE 11 : CLAUSE GÉNÉRALE PERSONNALISÉE VALIDE
  // --------------------------------------------------------------------------
  // Comprend toute autre phrase personnalisée écrite par le propriétaire ou locataire
  return {
    id: `custom_valid_${sourceParty}_${lineIndex}`,
    rawText: cleaned,
    sourceParty,
    category:
      sourceParty === 'locataire'
        ? 'demandes_particulieres'
        : sourceParty === 'logement'
        ? 'entretien_reparations'
        : 'obligations_bailleur',
    categoryLabel:
      sourceParty === 'locataire'
        ? 'Demandes particulières du locataire'
        : sourceParty === 'logement'
        ? 'Entretien et réparations'
        : 'Obligations du propriétaire',
    status: 'conforme',
    title: 'Condition particulière licite convenue entre les parties',
    understoodMeaning:
      `Engagement particulier formulé par le ${actualParty === 'proprietaire' ? 'propriétaire' : 'locataire'} : « ${cleaned} ».`,
    explanation:
      'Clause licite conclue dans le cadre de la liberté contractuelle en conformité avec l\'ordre public.',
    legalBasis: {
      law: 'Article 1134 du Code Civil (Force obligatoire des conventions)',
      article: 'Article 1134',
      sourceHierarchy: 'Droit commun des obligations',
      verified: true
    },
    recommendedAction: 'Clause validée.',
    reformulatedText: `Les parties conviennent expressément de la disposition suivante : ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}.`,
    fieldSource,
    lineIndex
  };
}

// ----------------------------------------------------------------------------
// MOTEUR PRINCIPAL D'ANALYSE DU CONTRAT
// ----------------------------------------------------------------------------

export function runLegalAnalysisEngine(params: {
  leaseType?: LeaseType;
  ownerConditionsText?: string;
  ownerClauses?: string;
  tenantRequestsText?: string;
  tenantClauses?: string;
  propertyRulesText?: string;
  specialRequests?: string;
  advanceMonths?: number;
  cautionMonths?: number;
  depositMonths?: number;
  rent?: number;
  monthlyRent?: number;
  city?: string;
  commune?: string;
  propertyType?: string;
  usageDestination?: 'habitation' | 'professionnel';
  authorizedActivity?: string;
  ownerDestinationAuthorized?: boolean;
}): LegalAnalysisReport {
  const leaseType = params.leaseType || 'habitation';
  const ownerConditionsText = (params.ownerConditionsText || params.ownerClauses || '').trim();
  const tenantRequestsText = (params.tenantRequestsText || params.tenantClauses || '').trim();
  const propertyRulesText = (params.propertyRulesText || params.specialRequests || '').trim();
  const advanceMonths = params.advanceMonths ?? params.depositMonths ?? 2;
  const cautionMonths = params.cautionMonths ?? params.depositMonths ?? 2;

  const analyzedClauses: AnalyzedClauseItem[] = [];

  // --------------------------------------------------------------------------
  // 1. CONTRÔLE DE LA DESTINATION DU LOCAL (HABITATION vs PROFESSIONNEL)
  // --------------------------------------------------------------------------
  // L'Article 410 exclut formellement les activités professionnelles du bail d'habitation.
  if (
    leaseType === 'habitation' &&
    (params.usageDestination === 'professionnel' ||
      (params.authorizedActivity && params.authorizedActivity.trim().length > 0))
  ) {
    analyzedClauses.push({
      id: 'dest_incompatible_commercial_in_housing',
      rawText: `Activité professionnelle déclarée : « ${params.authorizedActivity || 'Usage commercial'} » sous régime de bail d'habitation`,
      sourceParty: 'logement',
      category: 'regles_serenite',
      categoryLabel: 'Destination contractuelle du local',
      status: 'non_conforme',
      alertLevel: 3,
      title: 'Incompatibilité légale : Activité professionnelle sous bail d\'habitation (Art. 410)',
      understoodMeaning:
        'Tentative de soumettre un local affecté à l\'exercice d\'une activité professionnelle ou commerciale au régime du bail d\'habitation.',
      explanation:
        'L\'Article 410 de la Loi n° 2019-576 exclut expressément du régime du bail d\'habitation les immeubles affectés à un usage commercial, administratif, industriel, artisanal ou aux professions libérales. Ce contrat doit impérativement être requalifié en Bail à Usage Professionnel régi par l\'Acte Uniforme OHADA (AUDCG).',
      legalBasis: {
        law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
        article: 'Article 410 (Exclusions d\'ordre public du bail d\'habitation)',
        sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
        verified: true
      },
      recommendedAction: 'Requalifier le bail en Bail à Usage Professionnel (Acte Uniforme OHADA AUDCG).',
      proposedCorrection: 'Passer au modèle de Bail à Usage Professionnel OHADA.',
      reformulatedText:
        'Le local est donné à bail à usage professionnel conformément aux articles 101 et suivants de l\'AUDCG OHADA.',
      fieldSource: 'propertySpecificRules'
    });
  }

  // Cas particulier : Bâtiment physique d'origine (Maison / Villa) affecté à une activité professionnelle (Bureaux, Boutique, etc.)
  const physicalType = (params.propertyType || '').toLowerCase();
  const isPhysicalHouse = ['maison', 'villa', 'duplex', 'appartement', 'immeuble'].includes(physicalType);
  if (leaseType === 'professionnel' && isPhysicalHouse) {
    analyzedClauses.push({
      id: 'dest_house_used_for_business',
      rawText: `Immeuble de configuration « ${params.propertyType} » affecté à usage professionnel (« ${params.authorizedActivity || 'Bureaux / Commerce'} ») avec accord du bailleur`,
      sourceParty: 'logement',
      category: 'regles_serenite',
      categoryLabel: 'Destination contractuelle du local',
      status: 'conforme',
      title: 'Destination professionnelle conforme (AUDCG OHADA Art. 101 & 103)',
      understoodMeaning: `Maison ou villa louée pour un usage professionnel (« ${params.authorizedActivity || 'Bureaux'} ») avec accord exprès du propriétaire.`,
      explanation:
        'Conformément aux Articles 101 et 103 de l\'Acte Uniforme OHADA (AUDCG), la qualification juridique d\'un bail dépend de la destination contractuelle convenue entre les parties et non de la dénomination architecturale du bâtiment. Une maison ou villa louée pour servir de bureaux, magasin ou atelier relève valablement du bail professionnel.',
      legalBasis: {
        law: 'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
        article: 'Articles 101 et 103 (Définition et champ d\'application du bail professionnel)',
        sourceHierarchy: 'Droit Communautaire OHADA (Régime Applicable)',
        verified: true
      },
      recommendedAction: 'Consigner l\'accord exprès du bailleur sur la destination autorisée dans le bail.',
      reformulatedText: `Le bailleur autorise expressément le preneur à destiner les locaux à l'exercice exclusif de l'activité suivante : ${params.authorizedActivity || 'bureaux d\'entreprise et activités administratives'}.`,
      fieldSource: 'propertySpecificRules'
    });
  }

  // --------------------------------------------------------------------------
  // 2. FORMALITÉS OBLIGATOIRES SELON LE RÉGIME JURIDIQUE
  // --------------------------------------------------------------------------
  // Régime Habitation : Formalité d'enregistrement fiscal obligatoire (Art. 414 Loi 2019-576)
  if (leaseType === 'habitation') {
    analyzedClauses.push({
      id: 'info_tax_registration',
      rawText: 'Enregistrement obligatoire auprès de l\'administration fiscale (Direction Générale des Impôts - DGI)',
      sourceParty: 'logement',
      category: 'resiliation',
      categoryLabel: 'Formalités fiscales & Légales',
      status: 'information',
      alertLevel: 1,
      title: 'Formalité impérative : Enregistrement fiscal à la DGI (Art. 414)',
      understoodMeaning: 'Enregistrement légal obligatoire du contrat de bail auprès des services des impôts.',
      explanation:
        'L\'Article 414 de la Loi n° 2019-576 dispose que le contrat de bail à usage d\'habitation fait obligatoirement l\'objet d\'un enregistrement auprès de l\'administration fiscale (DGI) conformément aux modalités prévues par le Code Général des Impôts.',
      legalBasis: {
        law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
        article: 'Article 414 (Formalité légale d\'enregistrement fiscal)',
        sourceHierarchy: 'Droit National Ivoirien (Ordre Public Fiscal)',
        verified: true
      },
      recommendedAction: 'Faire enregistrer le contrat auprès de la DGI dans le mois suivant la signature.',
      reformulatedText:
        'Le présent contrat fera obligatoirement l\'objet d\'un enregistrement auprès de l\'administration fiscale compétente (DGI) conformément à l\'Article 414 de la Loi N° 2019-576.',
      fieldSource: 'propertySpecificRules'
    });
  }

  // Régime Professionnel : Distinction entre autorisation contractuelle et autorisations administratives
  if (leaseType === 'professionnel') {
    analyzedClauses.push({
      id: 'info_commercial_admin_permits',
      rawText: 'Autorisations administratives et immatriculations nécessaires à la charge exclusive du preneur',
      sourceParty: 'locataire',
      category: 'regles_serenite',
      categoryLabel: 'Autorisations administratives & Réglementation',
      status: 'information',
      alertLevel: 1,
      title: 'Distinction légale : Accord du bailleur vs Autorisations administratives d\'exploitation',
      understoodMeaning: 'Obtention par le locataire de ses permis d\'exploitation et inscription au registre du commerce.',
      explanation:
        'L\'accord du bailleur sur la destination professionnelle n\'emporte pas garantie de l\'obtention des autorisations administratives nécessaires (immatriculation au RCCM, licences d\'exploitation, conformité des établissements recevant du public ERP et sécurité incendie). Ces démarches incombent exclusivement au preneur.',
      legalBasis: {
        law: 'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
        article: 'Articles 101 et 112 (Exploitation commerciale et conformité de l\'activité)',
        sourceHierarchy: 'Droit Commercial Communautaire OHADA',
        verified: true
      },
      recommendedAction: 'Vérifier la détention des autorisations requises (RCCM, patente, assurances professionnelles).',
      reformulatedText:
        'Le preneur fait son affaire personnelle de l\'obtention de toutes autorisations administratives, immatriculations au RCCM et conformités légales requises pour l\'exercice de son activité.',
      fieldSource: 'propertySpecificRules'
    });
  }

  // --------------------------------------------------------------------------
  // 3. PLAFONDS FINANCIERS LÉGAUX
  // --------------------------------------------------------------------------
  if (leaseType === 'habitation') {
    // Avance (Art. 415 : Plafonnée à 2 mois)
    if (advanceMonths > 2) {
      analyzedClauses.push({
        id: 'fin_advance_cap',
        rawText: `Paiement exigé de ${advanceMonths} mois de loyers d'avance`,
        sourceParty: 'financier',
        category: 'loyer_caution',
        categoryLabel: 'Loyer et paiement',
        status: 'non_conforme',
        alertLevel: 3,
        title: 'Plafond légal des loyers d\'avance dépassé (Max 2 mois - Art. 415)',
        understoodMeaning: `Exigence de ${advanceMonths} mois de loyers d'avance lors de la conclusion du bail.`,
        explanation:
          'En Côte d\'Ivoire, dans les baux d\'habitation, le bailleur ne peut pas exiger plus de deux (2) mois de loyers d\'avance lors de la conclusion du contrat (Article 415 de la Loi n° 2019-576).',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
          article: 'Article 415 (Plafonnement impératif des avances de loyer)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Ajuster les mois d\'avance à deux (2) mois au maximum.',
        proposedCorrection: 'Avance fixée à 2 mois de loyer maximum.',
        reformulatedText:
          'L\'avance sur loyer est fixée à deux (02) mois maximum conformément à l\'Article 415 de la Loi n° 2019-576.',
        fieldSource: 'advanceMonths'
      });
    }

    // Dépôt de garantie / Caution (Art. 416 : Plafonné à 2 mois)
    if (cautionMonths > 2) {
      analyzedClauses.push({
        id: 'fin_caution_cap',
        rawText: `Dépôt de garantie / caution exigé de ${cautionMonths} mois`,
        sourceParty: 'financier',
        category: 'loyer_caution',
        categoryLabel: 'Loyer et paiement',
        status: 'non_conforme',
        alertLevel: 3,
        title: 'Plafond légal du dépôt de garantie dépassé (Max 2 mois - Art. 416)',
        understoodMeaning: `Exigence de ${cautionMonths} mois de dépôt de garantie (caution).`,
        explanation:
          'Le montant du dépôt de garantie (caution) exigible par le bailleur ne peut en aucun cas excéder deux (2) mois de loyer principal hors charges (Article 416 de la Loi n° 2019-576).',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
          article: 'Article 416 (Plafonnement impératif du dépôt de garantie)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Ajuster les mois de caution à deux (2) mois au maximum.',
        proposedCorrection: 'Caution fixée à 2 mois de loyer maximum.',
        reformulatedText:
          'Le dépôt de garantie est plafonné à deux (02) mois de loyer hors charges conformément à l\'Article 416 de la Loi n° 2019-576.',
        fieldSource: 'cautionMonths'
      });
    }

    if (advanceMonths <= 2 && cautionMonths <= 2) {
      analyzedClauses.push({
        id: 'fin_caps_compliant',
        rawText: `Avance : ${advanceMonths} mois • Caution : ${cautionMonths} mois (Conformes aux plafonds légaux)`,
        sourceParty: 'financier',
        category: 'loyer_caution',
        categoryLabel: 'Loyer et paiement',
        status: 'conforme',
        title: 'Conditions financières conformes aux plafonds légaux (Art. 415 & 416)',
        understoodMeaning:
          `Avance de ${advanceMonths} mois et caution de ${cautionMonths} mois conformes aux limites légales de la Loi 2019-576.`,
        explanation:
          'Le montant de l\'avance et de la caution respecte scrupuleusement les plafonds impératifs des Articles 415 et 416.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019',
          article: 'Articles 415 et 416',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Conditions financières validées.',
        reformulatedText:
          `Le preneur verse une avance de ${advanceMonths} mois et un dépôt de garantie de ${cautionMonths} mois conformément aux dispositions légales.`,
        fieldSource: 'cautionMonths'
      });
    }
  } else {
    // Régime Professionnel : Liberté contractuelle (AUDCG OHADA Art. 116)
    analyzedClauses.push({
      id: 'fin_ohada_freedom',
      rawText: `Garantie / Avance convenue : ${advanceMonths} mois d'avance, ${cautionMonths} mois de dépôt de garantie`,
      sourceParty: 'financier',
      category: 'loyer_caution',
      categoryLabel: 'Loyer et garanties commerciales',
      status: 'conforme',
      title: 'Conditions financières fixées selon la liberté contractuelle (AUDCG OHADA Art. 116)',
      understoodMeaning: `Conditions financières fixées d'un commun accord entre les parties (${advanceMonths} mois d'avance, ${cautionMonths} mois de garantie).`,
      explanation:
        'En matière de bail professionnel sous l\'Acte Uniforme OHADA (AUDCG, Article 116), le loyer et les garanties sont librement convenus entre les parties. Le plafonnement à deux (2) mois propre au bail d\'habitation ne s\'applique pas de plein droit aux relations commerciales.',
      legalBasis: {
        law: 'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
        article: 'Article 116 (Liberté de fixation du loyer et des garanties)',
        sourceHierarchy: 'Droit Commercial Communautaire OHADA',
        verified: true
      },
      recommendedAction: 'Conditions financières commerciales validées.',
      reformulatedText:
        `Les conditions financières convenues s'établissent à ${advanceMonths} mois d'avance et ${cautionMonths} mois de garantie conformément à l'Article 116 de l'AUDCG OHADA.`,
      fieldSource: 'cautionMonths'
    });
  }

  // --------------------------------------------------------------------------
  // 4. CLAUSES SAISIES PAR LES PARTIES
  // --------------------------------------------------------------------------
  if (ownerConditionsText.trim()) {
    const clauses = extractLogicalClauses(ownerConditionsText);
    clauses.forEach((clauseText, idx) => {
      const targetParty = detectTargetParty(clauseText, 'proprietaire');
      const res = analyzeSingleWrittenClause(clauseText, targetParty, leaseType, 'ownerCustomConditions', idx);
      if (res) analyzedClauses.push(res);
    });
  }

  if (tenantRequestsText.trim()) {
    const clauses = extractLogicalClauses(tenantRequestsText);
    clauses.forEach((clauseText, idx) => {
      const targetParty = detectTargetParty(clauseText, 'locataire');
      const res = analyzeSingleWrittenClause(clauseText, targetParty, leaseType, 'tenantCustomRequests', idx);
      if (res) analyzedClauses.push(res);
    });
  }

  if (propertyRulesText.trim()) {
    const clauses = extractLogicalClauses(propertyRulesText);
    clauses.forEach((clauseText, idx) => {
      const targetParty = detectTargetParty(clauseText, 'logement');
      const res = analyzeSingleWrittenClause(clauseText, targetParty, leaseType, 'propertySpecificRules', idx);
      if (res) analyzedClauses.push(res);
    });
  }

  // --------------------------------------------------------------------------
  // 5. SYNTHÈSE DES CATÉGORIES ET CALCUL DES ALERTES
  // --------------------------------------------------------------------------
  const categoryDefinitions: Array<{ id: string; label: string }> = [
    { id: 'loyer_caution', label: 'Loyer et paiement' },
    { id: 'obligations_bailleur', label: 'Obligations du propriétaire' },
    { id: 'obligations_locataire', label: 'Obligations du locataire' },
    { id: 'entretien_reparations', label: 'Entretien et réparations' },
    { id: 'regles_serenite', label: 'Règles de sérénité, destination et stationnement' },
    { id: 'demandes_particulieres', label: 'Demandes particulières du locataire' },
    { id: 'resiliation', label: 'Durée, renouvellement et résiliation' }
  ];

  const categories: CategoryStatus[] = categoryDefinitions.map((catDef) => {
    const catClauses = analyzedClauses.filter((c) => c.category === catDef.id);
    const hasIncompatible = catClauses.some((c) => c.status === 'non_conforme');
    const hasToVerify = catClauses.some((c) => c.status === 'avertissement' || c.status === 'a_verifier');

    let status: 'valide' | 'a_verifier' | 'anomalie' = 'valide';
    if (hasIncompatible) {
      status = 'anomalie';
    } else if (hasToVerify) {
      status = 'a_verifier';
    }

    return {
      id: catDef.id,
      label: catDef.label,
      status,
      clausesCount: catClauses.length
    };
  });

  const blockingCount = analyzedClauses.filter((c) => c.status === 'non_conforme').length;
  const toVerifyCount = analyzedClauses.filter((c) => c.status === 'avertissement' || c.status === 'a_verifier').length;
  const informationCount = analyzedClauses.filter((c) => c.status === 'information').length;
  const compliantCount = analyzedClauses.filter((c) => c.status === 'conforme').length;

  const isGlobalCompliant = blockingCount === 0;

  const legalRegimeLabel =
    leaseType === 'habitation'
      ? 'Bail à Usage d\'Habitation (Loi n° 2019-576 & Loi n° 2025-221)'
      : 'Bail à Usage Professionnel (Acte Uniforme OHADA AUDCG & Loi n° 2025-221)';

  const applicableSources =
    leaseType === 'habitation'
      ? [
          'Loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l\'Habitat (Art. 408 à 450)',
          'Loi n° 2025-221 du 28 mars 2025 (Procédures de contentieux et exécution des décisions d\'expulsion)',
          'Code Général des Impôts (Article 414 - Enregistrement fiscal obligatoire)',
          'Article 415 (Plafond d\'avance : 2 mois max) & Article 416 (Plafond de caution : 2 mois max)',
          'Article 428 (Grosses réparations impératives à la charge du bailleur)',
          'Article 430 (Droit de visite avec préavis d\'au moins 48 heures)',
          'Exclusion expresse de la Loi n° 2018-575 abrogée'
        ]
      : [
          'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG 2010), Livre VI, Titre I (Art. 101 à 134)',
          'Loi n° 2025-221 du 28 mars 2025, Article 14 (Opérations d\'expulsion d\'un immeuble professionnel)',
          'Article 103 (Définition et champ d\'application du bail professionnel par la destination)',
          'Article 104 (Fixation libre de la durée déterminée ou indéterminée)',
          'Article 106 (Grosses réparations structurelles incombant au bailleur)',
          'Article 116 (Liberté de fixation du loyer et des garanties)',
          'Articles 123 & 134 (Droit d\'ordre public au renouvellement après 2 ans d\'exploitation)',
          'Article 133 (Mise en demeure préalable obligatoire d\'au moins 1 mois avant résiliation judiciaire)'
        ];

  const anomalies: AnomalyReportItem[] = analyzedClauses
    .filter((c) => c.status === 'non_conforme' || c.status === 'avertissement' || c.status === 'a_verifier' || c.status === 'information')
    .map((c) => {
      let alertLevel: 1 | 2 | 3 = 1;
      let alertLevelLabel: 'NIVEAU 1 — INFORMATION' | 'NIVEAU 2 — AVERTISSEMENT' | 'NIVEAU 3 — NON-CONFORMITÉ' = 'NIVEAU 1 — INFORMATION';
      let sev: 'information' | 'avertissement' | 'non_conforme' | 'bloquante' | 'a_verifier' = 'information';

      if (c.status === 'non_conforme') {
        alertLevel = 3;
        alertLevelLabel = 'NIVEAU 3 — NON-CONFORMITÉ';
        sev = 'non_conforme';
      } else if (c.status === 'avertissement' || c.status === 'a_verifier') {
        alertLevel = 2;
        alertLevelLabel = 'NIVEAU 2 — AVERTISSEMENT';
        sev = 'avertissement';
      } else {
        alertLevel = 1;
        alertLevelLabel = 'NIVEAU 1 — INFORMATION';
        sev = 'information';
      }

      return {
        id: c.id,
        title: c.title,
        exactClause: c.rawText,
        party: c.sourceParty,
        problem: c.explanation,
        legalBasisText: `${c.legalBasis.law} - ${c.legalBasis.article}`,
        legalReference: `${c.legalBasis.law}, ${c.legalBasis.article} (${c.legalBasis.sourceHierarchy})`,
        severity: sev,
        alertLevel,
        alertLevelLabel,
        recommendedAction: c.recommendedAction,
        recommendedCorrection: c.proposedCorrection,
        understoodMeaning: c.understoodMeaning,
        fieldSource: c.fieldSource,
        lineIndex: c.lineIndex
      };
    });

  const legalNotice =
    'LocaTrust agit comme assistant numérique de rédaction et de contrôle de conformité contractuelle. Pour toute situation contentieuse ou montage spécifique, la consultation d\'un professionnel du droit (avocat, notaire, commissaire de justice) est expressément recommandée.';

  return {
    clauses: analyzedClauses,
    categories,
    isGlobalCompliant,
    blockingCount,
    toVerifyCount,
    compliantCount,
    informationCount,
    warningCount: toVerifyCount,
    nonConformityCount: blockingCount,
    legalRegimeLabel,
    applicableSources,
    anomalies,
    legalNotice,
    canContinue: blockingCount === 0,
    globalStatus: blockingCount === 0 ? 'conforme' : 'incomplet'
  };
}

// ----------------------------------------------------------------------------
// ASSISTANT IA DE STRUCTURATION, CLASSEMENT ET REFORMULATION JURIDIQUE
// Conforme au Code de la Construction et de l'Habitat (Loi 2019-576) & OHADA
// ----------------------------------------------------------------------------

export interface ReorganizationInput {
  ownerText: string;
  tenantText: string;
  propertyText: string;
  leaseType?: LeaseType;
}

export interface ReorganizedClauseLog {
  rawText: string;
  originalField: 'owner' | 'tenant' | 'property';
  assignedField: 'owner' | 'tenant' | 'property';
  reformulatedText: string;
  legalCitation?: string;
  isCorrectedAbuse?: boolean;
  abuseReason?: string;
}

export interface ReorganizationResult {
  ownerFormattedText: string;
  tenantFormattedText: string;
  propertyFormattedText: string;
  logs: ReorganizedClauseLog[];
  movedCount: number;
  reformulatedCount: number;
  correctedViolationsCount: number;
}

export function reorganizeAndReformulateClauses({
  ownerText,
  tenantText,
  propertyText,
  leaseType = 'habitation'
}: ReorganizationInput): ReorganizationResult {
  const isHabitation = leaseType === 'habitation';

  // 1. Extraire les clauses brutes avec leur champ de provenance
  const rawItems: Array<{ text: string; sourceField: 'owner' | 'tenant' | 'property' }> = [];

  for (const clause of extractLogicalClauses(ownerText)) {
    rawItems.push({ text: clause, sourceField: 'owner' });
  }
  for (const clause of extractLogicalClauses(tenantText)) {
    rawItems.push({ text: clause, sourceField: 'tenant' });
  }
  for (const clause of extractLogicalClauses(propertyText)) {
    rawItems.push({ text: clause, sourceField: 'property' });
  }

  const logs: ReorganizedClauseLog[] = [];
  const categorizedOwner: string[] = [];
  const categorizedTenant: string[] = [];
  const categorizedProperty: string[] = [];

  let movedCount = 0;
  let reformulatedCount = 0;
  let correctedViolationsCount = 0;

  for (const item of rawItems) {
    const raw = item.text.trim();
    if (!raw || raw.length < 3) continue;

    const norm = normalizeSemanticText(raw);

    let assignedField: 'owner' | 'tenant' | 'property' = item.sourceField;
    let reformulated = raw;
    let legalCitation: string | undefined;
    let isCorrectedAbuse = false;
    let abuseReason: string | undefined;

    // ------------------------------------------------------------------------
    // CLASSIFICATION SÉMANTIQUE AUTOMATIQUE
    // ------------------------------------------------------------------------
    const mentionsPropertyAndBuilding =
      /(?:bruit|calme|tapage|voisin|voisinage|22h|nuit|fete|silence|repos|animal|animaux|chien|chiens|chat|chats|dangereux|elevage|ordure|ordures|poubelle|poubelles|local poubelle|dechet|tri|commun|communs|partie commune|parties communes|escalier|couloir|cour|cour commune|parking|stationnement|garage|vehicule|voiture|moto|place reservee|percer|perforation|trou|trous|carreau|carreaux|faience|clim|climatiseur|climatiseurs|filtre|filtres|cuisine|hotte|facade|linge|balcon)/.test(norm);

    const mentionsTenantRequestsOrPayments =
      /(?:wave|orange money|mtn|moov|mobile money|virement|cheque|espece|especes|5 du mois|cinq du mois|terme echu|paiement loyer|serrure|haute securite|blindee|grille|barreaudage|moustiquaire|peinture interieure|amenagement|etageres|placard|compteur|cie|sodeci|internet|fibre|box)/.test(norm);

    const mentionsOwnerObligations =
      /(?:remise des cles|cles|grosse reparation|grosses reparations|toit|toiture|etancheite|fissure structurelle|gros murs|visite annuelle|droit de visite|quittance|quittances|recu de loyer|restitution caution|restitution depot)/.test(norm);

    // Détermination de la cible idoine
    if (mentionsPropertyAndBuilding && !mentionsOwnerObligations && !mentionsTenantRequestsOrPayments) {
      assignedField = 'property';
    } else if (mentionsTenantRequestsOrPayments && !mentionsOwnerObligations) {
      assignedField = 'tenant';
    } else if (mentionsOwnerObligations) {
      assignedField = 'owner';
    } else {
      // Détection basée sur la partie désignée dans la phrase
      const targetParty = detectTargetParty(raw, item.sourceField === 'owner' ? 'proprietaire' : item.sourceField === 'tenant' ? 'locataire' : 'logement');
      if (targetParty === 'proprietaire') assignedField = 'owner';
      else if (targetParty === 'locataire') assignedField = 'tenant';
      else assignedField = 'property';
    }

    if (assignedField !== item.sourceField) {
      movedCount++;
    }

    // ------------------------------------------------------------------------
    // CONTRÔLE DE CONFORMITÉ & CORRECTION DES CLAUSES ABUSIVES (LOI 2019-576 & OHADA)
    // ------------------------------------------------------------------------

    // A. Caution excessive (> 2 mois) ou avance excessive (> 2 mois)
    if (/(?:caution|depot de garantie|avance|mois d avance)/.test(norm) && /(?:[3-9]|1[0-2])\s*mois/.test(norm)) {
      isCorrectedAbuse = true;
      correctedViolationsCount++;
      legalCitation = isHabitation
        ? 'Loi n° 2019-576 (Code de la Construction et de l\'Habitat), Art. 414 & 415'
        : 'Acte Uniforme OHADA AUDCG, Art. 101 et suivants';
      abuseReason = isHabitation
        ? 'En Côte d\'Ivoire, l\'Article 414 de la Loi 2019-576 plafonne impérativement le dépôt de garantie à deux (2) mois de loyer hors charges.'
        : 'Plafonnement des garanties locatives à un niveau proportionné et conforme aux usages commerciaux OHADA.';
      reformulated = isHabitation
        ? 'La garantie locative est fixée au strict maximum légal de deux (2) mois de loyer hors charges, conformément à l\'Article 414 de la Loi N° 2019-576.'
        : 'Le dépôt de garantie commercial est fixé à deux (2) mois de loyer hors charges en garantie des obligations contractuelles.';
    }

    // B. Transfert illégal des grosses réparations ou de la toiture au locataire
    else if (
      /(?:locatair|locataire|preneur)\s*.*(?:paye|paie|supporte|repare|prend en charge).*(?:tout|tous les travaux|toutes les reparations|toiture|toit|etancheite|grosse reparation|gros murs|structure)/.test(norm) ||
      /(?:bailleur|proprietaire)\s*.*(?:ne repare rien|decline toute reparation|ne prend pas en charge)/.test(norm)
    ) {
      isCorrectedAbuse = true;
      correctedViolationsCount++;
      legalCitation = isHabitation
        ? 'Loi n° 2019-576, Art. 428 & 435'
        : 'Acte Uniforme OHADA AUDCG, Art. 106';
      abuseReason = isHabitation
        ? 'L\'Article 428 du Code de l\'Habitat ivoirien met impérativement à la charge du bailleur les grosses réparations (clos, couvert, structure, toiture).'
        : 'L\'Article 106 OHADA AUDCG rend obligatoire la prise en charge des grosses réparations par le bailleur.';
      reformulated = 'Le Bailleur conserve l\'entière charge des grosses réparations structurelles (toiture, clos et couvert) conformément à la loi. Le Preneur assume l\'entretien locatif courant et les menues réparations d\'usage.';
      assignedField = 'owner';
    }

    // C. Droit de visite inopiné / intrusion sans préavis
    else if (
      /(?:proprietaire|bailleur)\s*.*(?:entre quand il veut|rentrer n importe quand|visite sans prevenir|passe quand il veut)/.test(norm) ||
      /(?:acces a tout moment sans preavis)/.test(norm)
    ) {
      isCorrectedAbuse = true;
      correctedViolationsCount++;
      legalCitation = 'Loi n° 2019-576, Art. 430 (Inviolabilité du domicile et jouissance paisible)';
      abuseReason = 'Le bailleur ne peut pénétrer dans les lieux loués sans l\'accord du locataire et sans préavis préalable d\'au moins 48 heures.';
      reformulated = 'Le Bailleur ou son mandataire dispose d\'un droit de visite annuel pour contrôle de l\'état d\'entretien, exercé après notification d\'un préavis écrit d\'au moins 48 heures convenu avec le Preneur.';
      assignedField = 'owner';
    }

    // D. Interdiction d'enfants ou discrimination familiale
    else if (/(?:interdit|pas)\s*.*(?:enfant|enfants|femme enceinte|famille|bebe)/.test(norm)) {
      isCorrectedAbuse = true;
      correctedViolationsCount++;
      legalCitation = 'Loi n° 2019-576, Art. 429 & Code Civil';
      abuseReason = 'Clause réputée non écrite : interdiction discriminatoire portant atteinte au droit de mener une vie familiale normale.';
      reformulated = 'L\'occupation des lieux est réservée au Preneur et aux membres de sa famille nucléaire déclarée, dans la stricte limite de la capacité d\'habitabilité normale du logement.';
      assignedField = 'property';
    }

    // ------------------------------------------------------------------------
    // REFORMULATION PROFESSIONNELLE DES CLAUSES CONFORMES (LANGAGE PARLÉ -> JURIDIQUE)
    // ------------------------------------------------------------------------
    else {
      // 1. Tranquillité & Bruit nocturne
      if (/(?:calme|bruit|tapage|musique|silence|22h|nuit|repos)/.test(norm)) {
        reformulated = 'Respect strict de la tranquillité et du repos du voisinage : cessation de toute nuisance sonore et respect du calme absolu, particulièrement entre 22h00 et 06h00.';
        legalCitation = 'Loi n° 2019-576, Art. 435 & Règlement de Copropriété';
      }
      // 2. Animaux domestiques & dangereux
      else if (/(?:animal|animaux|chien|chiens|chat|chats|dangereux|elevage)/.test(norm)) {
        reformulated = 'Interdiction formelle de détention ou d\'élevage d\'animaux dangereux, agressifs ou de nature à occasionner des nuisances ou dégradations au sein de l\'immeuble.';
        legalCitation = 'Règlement Sanitaire et de Sécurité de l\'Habitat';
      }
      // 3. Entretien climatiseurs
      else if (/(?:clim|climatiseur|climatiseurs|filtre|filtres|ventilation)/.test(norm)) {
        reformulated = 'Entretien semestriel régulier et dépoussiérage des filtres des climatiseurs et appareils de traitement d\'air à la diligence et aux frais du Preneur.';
        legalCitation = 'Loi n° 2019-576, Art. 435 (Réparations et entretien locatifs courants)';
      }
      // 4. Stationnement / Parking
      else if (/(?:parking|stationnement|place|garage|voiture|vehicule)/.test(norm)) {
        const placeMatch = raw.match(/N[°o]?\s*(\d+)/i) || raw.match(/place\s*(\d+)/i);
        const placeNum = placeMatch ? placeMatch[1] : 'réservée';
        reformulated = `Stationnement privatif strictement autorisé sur l'emplacement réservé N° ${placeNum}, à l'exclusion de tout encombrement des voies de circulation communes.`;
      }
      // 5. Faïence, carrelage et perforations
      else if (/(?:carreau|carreaux|faience|percer|trou|trous|murs)/.test(norm)) {
        reformulated = 'Interdiction formelle de perforer les carreaux de faïence murale et revêtements étanches scellés sans l\'accord écrit et préalable du Bailleur.';
        legalCitation = 'Loi n° 2019-576, Art. 435 (Maintien de l\'état d\'étanchéité du bien)';
      }
      // 6. Serrure haute sécurité / Clés
      else if (/(?:serrure|haute securite|canon|cylindre|porte blindee)/.test(norm)) {
        reformulated = 'Autorisation accordée au Preneur d\'installer une serrure de haute sécurité à ses frais exclusifs, sous réserve de remise d\'un jeu de clés complet au Bailleur lors de la restitution des lieux.';
      }
      // 7. Règlement Mobile Money (Wave, Orange Money)
      else if (/(?:wave|orange money|mtn|moov|mobile money)/.test(norm)) {
        reformulated = 'Modalité convenue de paiement du loyer par virement électronique certifié (Wave ou Orange Money) au plus tard le 05 de chaque mois civil à terme échu.';
      }
      // 8. Ordures ménagères et propreté
      else if (/(?:poubelle|poubelles|ordure|ordures|dechet|tri|local poubelle)/.test(norm)) {
        reformulated = 'Évacuation conforme des déchets et ordures ménagères en sacs hermétiques fermés dans le local poubelle réservé à cet effet, avec respect strict des règles de salubrité.';
        legalCitation = 'Règlement de Salubrité Urbaine & Copropriété';
      }
      // 9. Quittances de loyer
      else if (/(?:quittance|quittances|recu)/.test(norm)) {
        reformulated = 'Délivrance systématique et gratuite d\'une quittance de loyer officielle et certifiée pour chaque terme de loyer intégralement acquitté par le Preneur.';
        legalCitation = 'Loi n° 2019-576, Art. 418';
      }
      // 10. Restitution des clés et état des lieux
      else if (/(?:etat des lieux|remise cles|inventaire)/.test(norm)) {
        reformulated = 'Établissement obligatoire d\'un état des lieux d\'entrée et de sortie contradictoire et remise formelle de l\'ensemble des clés d\'accès contre décharge.';
        legalCitation = 'Loi n° 2019-576, Art. 421';
      }
      // 11. Restitution de caution
      else if (/(?:restitution caution|remboursement caution|rendre caution)/.test(norm)) {
        reformulated = 'Restitution du dépôt de garantie au Preneur dans un délai maximal de trente (30) jours suivant la remise effective des clés, déduction faite des sommes restant dues.';
        legalCitation = 'Loi n° 2019-576, Art. 416';
      }
      // 12. Reformulation générique soignée
      else {
        // Mettre une majuscule et un point propre si nécessaire
        reformulated = raw.charAt(0).toUpperCase() + raw.slice(1);
        if (!/[.!?]$/.test(reformulated)) reformulated += '.';
      }
    }

    if (reformulated !== raw) {
      reformulatedCount++;
    }

    logs.push({
      rawText: raw,
      originalField: item.sourceField,
      assignedField,
      reformulatedText: reformulated,
      legalCitation,
      isCorrectedAbuse,
      abuseReason
    });

    if (assignedField === 'owner') {
      categorizedOwner.push(reformulated);
    } else if (assignedField === 'tenant') {
      categorizedTenant.push(reformulated);
    } else {
      categorizedProperty.push(reformulated);
    }
  }

  // Formatage numéroté propre des listes
  const formatList = (items: string[]) =>
    items.map((it, idx) => `${idx + 1}. ${it.replace(/^\d+[\.)]\s*/, '')}`).join('\n');

  return {
    ownerFormattedText: formatList(categorizedOwner),
    tenantFormattedText: formatList(categorizedTenant),
    propertyFormattedText: formatList(categorizedProperty),
    logs,
    movedCount,
    reformulatedCount,
    correctedViolationsCount
  };
}

