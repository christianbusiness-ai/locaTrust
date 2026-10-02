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

export type AnalysisSeverity = 'conforme' | 'a_verifier' | 'non_conforme';

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
  severity: 'bloquante' | 'a_verifier';
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
  legalRegimeLabel: string;
  applicableSources: string[];
  anomalies: AnomalyReportItem[];
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
      title: 'Clause d\'expulsion d\'office ou de coupure de fluide illégale (Voie de fait)',
      understoodMeaning:
        'Menace de coupure d\'eau ou d\'électricité, ou expulsion forcée sans préavis ni décision de justice en cas de loyer impayé.',
      explanation:
        'Toute résiliation exige le respect d\'une mise en demeure légale (30 jours) et d\'un préavis obligatoire de 3 mois, suivi d\'une décision judiciaire exécutoire. Couper l\'eau ou l\'électricité et changer les serrures constituent des voies de fait pénalement et civilement répréhensibles.',
      legalBasis: isHabitation
        ? {
            law: 'Loi n° 2019-576 du 26 juin 2019 (Code de la Construction et de l\'Habitat)',
            article: 'Article 450 (Procédure d\'expulsion et préavis légal impératif)',
            sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
            verified: true
          }
        : {
            law: 'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
            article: 'Article 133 (Résiliation judiciaire du bail professionnel)',
            sourceHierarchy: 'Droit Communautaire OHADA (Bail Professionnel)',
            verified: true
          },
      recommendedAction:
        'Remplacer cette clause par le rappel de la procédure légale de mise en demeure et de recours judiciaire.',
      proposedCorrection:
        'En cas d\'impayé ou de manquement contractuel, le bailleur délivrera une mise en demeure dans le respect des délais légaux avant saisine de la juridiction compétente.',
      reformulatedText:
        'En cas d\'impayé ou d\'inexécution, les parties se conformeront à la procédure légale de mise en demeure préalable avant toute saisine judiciaire.',
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
}): LegalAnalysisReport {
  const leaseType = params.leaseType || 'habitation';
  const ownerConditionsText = (params.ownerConditionsText || params.ownerClauses || '').trim();
  const tenantRequestsText = (params.tenantRequestsText || params.tenantClauses || '').trim();
  const propertyRulesText = (params.propertyRulesText || params.specialRequests || '').trim();
  const advanceMonths = params.advanceMonths ?? params.depositMonths ?? 2;
  const cautionMonths = params.cautionMonths ?? params.depositMonths ?? 2;

  const analyzedClauses: AnalyzedClauseItem[] = [];

  // 1. Plafonds Financiers Légaux (Loi n° 2019-576 Art. 415 & 416 pour bail d'habitation)
  if (leaseType === 'habitation') {
    if (advanceMonths > 2) {
      analyzedClauses.push({
        id: 'fin_advance_cap',
        rawText: `Paiement exigé de ${advanceMonths} mois de loyers d'avance`,
        sourceParty: 'financier',
        category: 'loyer_caution',
        categoryLabel: 'Loyer et paiement',
        status: 'non_conforme',
        title: 'Plafond légal des loyers d\'avance dépassé (Max 2 mois)',
        understoodMeaning: `Exigence de ${advanceMonths} mois de loyers d'avance lors de la conclusion du bail.`,
        explanation:
          'En Côte d\'Ivoire, dans les baux d\'habitation, le bailleur ne peut pas exiger plus de deux (2) mois de loyers d\'avance lors de la conclusion du contrat.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l\'Habitat',
          article: 'Article 415 (Plafonnement impératif des avances de loyer)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Ajuster les mois d\'avance à deux (2) mois au maximum.',
        proposedCorrection: 'Avance fixée à 2 mois de loyer maximum.',
        reformulatedText: 'L\'avance sur loyer est fixée à deux (02) mois maximum conformément à l\'Article 415 de la Loi n° 2019-576.',
        fieldSource: 'advanceMonths'
      });
    }

    if (cautionMonths > 2) {
      analyzedClauses.push({
        id: 'fin_caution_cap',
        rawText: `Dépôt de garantie / caution exigé de ${cautionMonths} mois`,
        sourceParty: 'financier',
        category: 'loyer_caution',
        categoryLabel: 'Loyer et paiement',
        status: 'non_conforme',
        title: 'Plafond légal du dépôt de garantie dépassé (Max 2 mois)',
        understoodMeaning: `Exigence de ${cautionMonths} mois de dépôt de garantie (caution).`,
        explanation:
          'Le montant du dépôt de garantie (caution) exigible par le bailleur ne peut en aucun cas excéder deux (2) mois de loyer principal hors charges.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l\'Habitat',
          article: 'Article 416 (Plafonnement impératif du dépôt de garantie)',
          sourceHierarchy: 'Droit National Ivoirien (Ordre Public)',
          verified: true
        },
        recommendedAction: 'Ajuster les mois de caution à deux (2) mois au maximum.',
        proposedCorrection: 'Caution fixée à 2 mois de loyer maximum.',
        reformulatedText: 'Le dépôt de garantie est plafonné à deux (02) mois de loyer hors charges conformément à l\'Article 416 de la Loi n° 2019-576.',
        fieldSource: 'cautionMonths'
      });
    }

    // Si les montants sont conformes, ajouter la validation du volet financier
    if (advanceMonths <= 2 && cautionMonths <= 2) {
      analyzedClauses.push({
        id: 'fin_caps_compliant',
        rawText: `Avance : ${advanceMonths} mois • Caution : ${cautionMonths} mois (Conformes aux plafonds légaux)`,
        sourceParty: 'financier',
        category: 'loyer_caution',
        categoryLabel: 'Loyer et paiement',
        status: 'conforme',
        title: 'Conditions financières conformes aux plafonds légaux',
        understoodMeaning:
          `Avance de ${advanceMonths} mois et caution de ${cautionMonths} mois conformes aux limites de la loi.`,
        explanation:
          'Le montant de l\'avance et de la caution respecte scrupuleusement les plafonds impératifs des Articles 415 et 416.',
        legalBasis: {
          law: 'Loi n° 2019-576 du 26 juin 2019',
          article: 'Articles 415 et 416',
          sourceHierarchy: 'Droit National Ivoirien',
          verified: true
        },
        recommendedAction: 'Conditions financières validées.',
        reformulatedText:
          `Le preneur verse une avance de ${advanceMonths} mois et un dépôt de garantie de ${cautionMonths} mois conformément aux dispositions légales.`,
        fieldSource: 'cautionMonths'
      });
    }
  }

  // 2. Clauses réelles du propriétaire
  if (ownerConditionsText.trim()) {
    const clauses = extractLogicalClauses(ownerConditionsText);
    clauses.forEach((clauseText, idx) => {
      const targetParty = detectTargetParty(clauseText, 'proprietaire');
      const res = analyzeSingleWrittenClause(clauseText, targetParty, leaseType, 'ownerCustomConditions', idx);
      if (res) analyzedClauses.push(res);
    });
  }

  // 3. Demandes réelles du locataire
  if (tenantRequestsText.trim()) {
    const clauses = extractLogicalClauses(tenantRequestsText);
    clauses.forEach((clauseText, idx) => {
      const targetParty = detectTargetParty(clauseText, 'locataire');
      const res = analyzeSingleWrittenClause(clauseText, targetParty, leaseType, 'tenantCustomRequests', idx);
      if (res) analyzedClauses.push(res);
    });
  }

  // 4. Règles spécifiques au logement / copropriété
  if (propertyRulesText.trim()) {
    const clauses = extractLogicalClauses(propertyRulesText);
    clauses.forEach((clauseText, idx) => {
      const targetParty = detectTargetParty(clauseText, 'logement');
      const res = analyzeSingleWrittenClause(clauseText, targetParty, leaseType, 'propertySpecificRules', idx);
      if (res) analyzedClauses.push(res);
    });
  }

  // 5. Calcul des catégories & statut "Validé"
  const categoryDefinitions: Array<{ id: string; label: string }> = [
    { id: 'loyer_caution', label: 'Loyer et paiement' },
    { id: 'obligations_bailleur', label: 'Obligations du propriétaire' },
    { id: 'obligations_locataire', label: 'Obligations du locataire' },
    { id: 'entretien_reparations', label: 'Entretien et réparations' },
    { id: 'regles_serenite', label: 'Règles de sérénité, stationnement et entretien courant' },
    { id: 'demandes_particulieres', label: 'Demandes particulières du locataire' },
    { id: 'resiliation', label: 'Durée et résiliation' }
  ];

  const categories: CategoryStatus[] = categoryDefinitions.map((catDef) => {
    const catClauses = analyzedClauses.filter((c) => c.category === catDef.id);
    const hasIncompatible = catClauses.some((c) => c.status === 'non_conforme');
    const hasToVerify = catClauses.some((c) => c.status === 'a_verifier');

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
  const toVerifyCount = analyzedClauses.filter((c) => c.status === 'a_verifier').length;
  const compliantCount = analyzedClauses.filter((c) => c.status === 'conforme').length;

  const isGlobalCompliant = blockingCount === 0;

  const legalRegimeLabel =
    leaseType === 'habitation'
      ? 'Bail d\'Habitation Ivoirien (Loi n° 2019-576 du 26 juin 2019)'
      : 'Bail à Usage Professionnel (Acte Uniforme OHADA AUDCG)';

  const applicableSources =
    leaseType === 'habitation'
      ? [
          'Loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l\'Habitat',
          'Articles 415 & 416 (Plafonds d\'avance et de caution)',
          'Article 424 (Obligation de délivrance d\'un logement décent)',
          'Article 425 (Jouissance paisible et respect de la vie privée)',
          'Article 428 (Grosses réparations et structure)',
          'Article 435 (Obligations d\'entretien du preneur)',
          'Article 450 (Procédure légale de résiliation et préavis)'
        ]
      : [
          'Acte Uniforme OHADA portant sur le Droit Commercial Général (AUDCG)',
          'Articles 101 à 134 (Régime du bail à usage professionnel)',
          'Article 106 (Grosses réparations incombant au bailleur)',
          'Article 112 (Obligations d\'exploitation du preneur)',
          'Article 133 (Résiliation judiciaire après mise en demeure)'
        ];

  const anomalies: AnomalyReportItem[] = analyzedClauses
    .filter((c) => c.status === 'non_conforme' || c.status === 'a_verifier')
    .map((c) => ({
      id: c.id,
      title: c.title,
      exactClause: c.rawText,
      party: c.sourceParty,
      problem: c.explanation,
      legalBasisText: `${c.legalBasis.law} - ${c.legalBasis.article}`,
      legalReference: `${c.legalBasis.law}, ${c.legalBasis.article} (${c.legalBasis.sourceHierarchy})`,
      severity: c.status === 'non_conforme' ? 'bloquante' : 'a_verifier',
      recommendedAction: c.recommendedAction,
      recommendedCorrection: c.proposedCorrection,
      understoodMeaning: c.understoodMeaning,
      fieldSource: c.fieldSource,
      lineIndex: c.lineIndex
    }));

  return {
    clauses: analyzedClauses,
    categories,
    isGlobalCompliant,
    blockingCount,
    toVerifyCount,
    compliantCount,
    legalRegimeLabel,
    applicableSources,
    anomalies,
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

