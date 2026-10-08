import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { triggerCelebration } from '@/lib/celebration';

export interface ContractPdfData {
  contractNumber: string;
  leaseType?: 'habitation' | 'professionnel';
  usageDestination?: 'habitation' | 'professionnel';
  authorizedActivity?: string;
  isAgency?: boolean;
  ownerName: string;
  ownerPhone?: string;
  tenantName: string;
  tenantPhone?: string;
  tenantCni?: string;
  tenantEntityKind?: 'personne_physique' | 'personne_morale';
  tenantRccm?: string;
  propertyTitle: string;
  propertyAddress: string;
  surface?: number;
  durationMonths?: number;
  startDate?: string;
  rent: number;
  cautionMonths?: number;
  advanceMonths?: number;
  chargesAmount?: number;
  dueDay?: number;
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
  isSignedCopy?: boolean;
  ownerCustomConditions?: string;
  tenantCustomRequests?: string;
  propertySpecificRules?: string;
  customConditions?: string[] | string;
}

export const generateOfficialContractPdf = async (data: ContractPdfData) => {
  try {
    const jspdfModule = await import('jspdf');
    const jsPDFClass = (jspdfModule as any)?.jsPDF || (jspdfModule as any)?.default || jspdfModule;
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const isProfessional = data.leaseType === 'professionnel';

    const {
      contractNumber,
      isAgency = false,
      ownerName = 'Bailleur',
      ownerPhone = '+225 07 89 45 12 34',
      tenantName = 'Locataire',
      tenantPhone = '+225 05 67 89 45 12',
      tenantCni = 'CI002894129',
      tenantRccm,
      propertyTitle = isProfessional ? 'Local Professionnel / Bureaux' : 'Appartement 3 pièces',
      propertyAddress = 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
      durationMonths = isProfessional ? 24 : 12,
      startDate = '01/07/2026',
      rent = isProfessional ? 350000 : 75000,
      cautionMonths = isProfessional ? 3 : 2,
      chargesAmount = isProfessional ? 25000 : 5000,
      dueDay = 5,
      authorizedActivity = isProfessional ? 'Bureaux administratifs et commerciaux' : undefined
    } = data;

    // En-tête gauche : Logo Agence ou LocaTrust
    doc.setFont('helvetica', 'bold');
    if (isAgency) {
      doc.setFontSize(14);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text(ownerName.toUpperCase(), 15, 20);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('AGENCE IMMOBILIÈRE MANDATAIRE AGRÉÉE', 15, 25);
    } else {
      doc.setFontSize(16);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text('LocaTrust', 15, 20);
      doc.setFontSize(8);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text(isProfessional ? '— DROIT COMMERCIAL & IMMOBILIER PRO —' : '— GESTION LOCATIVE CONFORME —', 15, 25);
    }

    // En-tête droite : CONTRAT DE BAIL + Badge N° + QR Code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(isProfessional ? 'BAIL À USAGE PROFESSIONNEL' : 'CONTRAT DE BAIL D\'HABITATION', 105, 17);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      isProfessional
        ? 'RÉGIME OHADA AUDCG & LOI N° 2025-221 ART. 14'
        : 'LOI N° 2019-576 (HABITAT) & LOI N° 2025-221',
      105,
      21
    );

    // Badge N° Contrat
    doc.setFillColor(245, 158, 11); // amber-500
    doc.roundedRect(105, 23, 38, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`N° ${contractNumber}`, 108, 27.2);

    // Enregistrement automatique dans le registre officiel de vérification LocaTrust
    const { registerContractInVerificationRegistry } = await import('@/lib/verificationRegistry');
    const { token } = registerContractInVerificationRegistry({
      contractNumber,
      ownerName,
      tenantName,
      propertyTitle,
      propertyAddress,
      rentAmount: rent,
      cautionAmount: rent * cautionMonths
    });

    // QR Code officiel scannable calibré avec marge blanche et haute résolution
    try {
      const { getLocaTrustVerificationQR } = await import('@/lib/qrCode');
      const publicVerifyUrl = `https://locatrust.com/verify/contrat/${token}`;
      const qrDataUrl = getLocaTrustVerificationQR(publicVerifyUrl, 360);

      // Fond blanc propre pour quiet zone
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(164, 11, 32, 33, 1, 1, 'F');

      // QR Code 28x28 mm
      doc.addImage(qrDataUrl, 'PNG', 166, 12, 28, 28);
      doc.setFontSize(5);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text("SCANNER POUR VÉRIFIER", 180, 42, { align: 'center' });
      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text("Authentification publique sans abonnement", 180, 45, { align: 'center' });
    } catch (err) {
      console.warn('QR Code embedding error in PDF:', err);
    }

    // Entre les soussignés
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Entre les soussignés :', 15, 34);

    // Boîtes Parties (Bailleur & Locataire)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 36, 85, 25, 2, 2, 'FD');
    doc.roundedRect(105, 36, 85, 25, 2, 2, 'FD');

    // Bailleur / Agence
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE (BAILLEUR)' : 'LE BAILLEUR (PROPRIÉTAIRE)', 18, 41);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nom / Raison : ${ownerName}`, 18, 46);
    doc.text(`Téléphone : ${ownerPhone}`, 18, 50);
    doc.text(`Adresse : Cocody, Abidjan - Côte d'Ivoire`, 18, 54);
    doc.text(`Identifiant : CNI / RCCM vérifié`, 18, 58);

    // Preneur (Personne physique ou morale)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      isProfessional
        ? (tenantRccm ? 'LE PRENEUR PROFESSIONNEL (SOCIÉTÉ)' : 'LE PRENEUR (ENTREPRISE / PROFESSIONNEL)')
        : 'LE LOCATAIRE (PRENEUR)',
      108,
      41
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nom / Raison sociale : ${tenantName}`, 108, 46);
    doc.text(`Téléphone : ${tenantPhone}`, 108, 50);
    if (isProfessional && tenantRccm) {
      doc.text(`Immatriculation RCCM : ${tenantRccm}`, 108, 54);
      doc.text(`Représenté par titulaire CNI N° ${tenantCni}`, 108, 58);
    } else {
      doc.text(`Adresse : Abidjan - Côte d'Ivoire`, 108, 54);
      doc.text(`Pièce d'identité : CNI N° ${tenantCni}`, 108, 58);
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Il a été arrêté et convenu ce qui suit :', 15, 65);

    // ========================================================================
    // CORPS DU CONTRAT : DEUX MODÈLES DISTINCTS (HABITATION vs PROFESSIONNEL)
    // ========================================================================
    if (isProfessional) {
      // ----------------------------------------------------------------------
      // MODEL 2 : BAIL À USAGE PROFESSIONNEL (OHADA AUDCG 2010 & LOI 2025-221)
      // ----------------------------------------------------------------------
      // ARTICLE 1 : DÉSIGNATION DU LOCAL ET DESTINATION CONTRACTUELLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 1 : DÉSIGNATION DU LOCAL & ACTIVITÉ COMMERCIALE AUTORISÉE', 15, 71);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      doc.text('Le bailleur donne à bail à usage professionnel au preneur les locaux décrits ci-dessous :', 15, 75);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 77, 175, 14, 2, 2, 'FD');
      doc.text(`• Type & Localisation : ${propertyTitle} | ${propertyAddress}`, 18, 82);
      doc.text(
        `• Destination contractuelle exclusive (Art. 101/103 AUDCG) : ${authorizedActivity || 'Bureaux administratifs, commerciaux et exploitation'}.`,
        18,
        86
      );
      doc.text(
        '• Autorisations administratives : Le preneur est seul responsable de l\'obtention de ses licences, RCCM et conformités ERP.',
        18,
        89.5
      );

      // ARTICLE 2 : DURÉE DU BAIL COMMERCIAL (Art. 104 AUDCG)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 2 : DURÉE DU BAIL COMMERCIAL (ART. 104 AUDCG)', 15, 96);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Le bail est conclu pour une durée ferme de ${durationMonths} mois, prenant effet le ${startDate}. Il est régi par les stipulations de l'Article 104 de l'AUDCG.`,
        15,
        100
      );

      // ARTICLES 3, 4, 5 : CONDITIONS FINANCIÈRES COMMERCIALES (OHADA Art. 116)
      doc.roundedRect(15, 104, 175, 11, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 3 : LOYER COMMERCIAL (ART. 116 AUDCG)', 18, 109);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(`Payable d'avance le ${dueDay < 10 ? '0' + dueDay : dueDay} de chaque mois par Virement bancaire ou Mobile Money certifié.`, 18, 113);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(145, 105.5, 42, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(rent), 149, 110.5);

      // Article 4 : Dépôt de garantie commercial
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 117, 175, 11, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 4 : DÉPÔT DE GARANTIE COMMERCIAL (ART. 116 AUDCG)', 18, 122);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Garantie commerciale fixée par accord des parties (${cautionMonths} mois) en couverture des dégradations et charges.`, 18, 126);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(145, 118.5, 42, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(rent * cautionMonths), 149, 123.5);

      // Article 5 : Charges d'exploitation
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 130, 175, 11, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 5 : PROVISION SUR CHARGES D\'EXPLOITATION', 18, 135);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Charges communes, eau, électricité et gardiennage liées à l'activité professionnelle.`, 18, 139);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(145, 131.5, 42, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(`${formatFCFA(chargesAmount)} / mois`, 147, 136.5);

      // ARTICLES 6 & 7 : OBLIGATIONS ET RÉPARATIONS COMMERCIALES (2 COLONNES)
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 144, 85, 34, 2, 2, 'FD');
      doc.roundedRect(105, 144, 85, 34, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 6 : OBLIGATIONS DU PRENEUR (ART. 112)', 18, 149);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text('• Exploiter les locaux conformément à l\'activité convenue.', 18, 153.5);
      doc.text('• Assumer l\'entretien locatif et les réparations d\'usage.', 18, 157.5);
      doc.text('• Détenir l\'ensemble des autorisations administratives/RCCM.', 18, 161.5);
      doc.text('• Sous-location soumise à l\'accord exprès écrit (Art. 118).', 18, 165.5);
      doc.text('• Souscrire une assurance responsabilité civile et d\'exploitation.', 18, 169.5);
      doc.text('• Restituer les locaux en état conforme aux stipulations du bail.', 18, 173.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 7 : GROSSES RÉPARATIONS DU BAILLEUR (ART. 106)', 108, 149);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text('• Délivrer les locaux en bon état d\'usage commercial.', 108, 153.5);
      doc.text('• Assurer la jouissance paisible contre tout trouble de droit.', 108, 157.5);
      doc.text('• Grosses réparations impératives : toiture, gros murs, structure.', 108, 161.5);
      doc.text('• Ne pas entraver l\'exploitation normale de l\'activité autorisée.', 108, 165.5);
      doc.text('• Délivrer les quittances de paiement régulières certifiées.', 108, 169.5);
      doc.text('• Respecter le droit d\'ordre public au renouvellement commercial.', 108, 173.5);

      // ARTICLES 8 & 9 : RENOUVELLEMENT, RÉSILIATION ET EXPULSION PROFESSIONNELLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 8 : DROIT AU RENOUVELLEMENT D\'ORDRE PUBLIC (ART. 123 & 134 AUDCG)', 15, 183);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'Le droit au renouvellement est acquis au preneur justifiant d\'au moins 2 ans d\'exploitation conforme. Aucune clause ne peut y déroger (Art. 134).',
        15,
        187
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 9 : RÉSILIATION JUDICIAIRE & EXPULSION (ART. 133 AUDCG & LOI 2025-221 ART. 14)', 15, 193);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'Toute résiliation requiert une mise en demeure d\'au moins 1 mois (Art. 133). Expulsion soumise à l\'Article 14 de la Loi ivoirienne N° 2025-221 (ministère d\'un Commissaire de Justice sur titre exécutoire, voies de fait prohibées).',
        15,
        197
      );
    } else {
      // ----------------------------------------------------------------------
      // MODEL 1 : BAIL À USAGE D'HABITATION (LOI 2019-576 & LOI 2025-221)
      // ----------------------------------------------------------------------
      // ARTICLE 1 : DÉSIGNATION DU BIEN
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 1 : DÉSIGNATION DU BIEN & DESTINATION EXCLUSIVE D\'HABITATION', 15, 71);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      doc.text('Le bailleur donne en location au preneur qui accepte, le bien immobilier suivant :', 15, 75);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 77, 175, 14, 2, 2, 'FD');
      doc.text(`• Type : ${propertyTitle} | Localisation : ${propertyAddress}`, 18, 82);
      doc.text(
        '• Destination exclusive : Logement d\'habitation principale du preneur et des siens (Art. 409 & 410 Loi 2019-576).',
        18,
        86
      );
      doc.text(
        '• Exclusion d\'ordre public : Toute utilisation commerciale, industrielle ou artisanale est expressément prohibée.',
        18,
        89.5
      );

      // ARTICLE 2 : DURÉE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 2 : DURÉE DU BAIL D\'HABITATION (ART. 414)', 15, 96);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Le présent contrat est conclu pour une durée de ${durationMonths} mois, commençant le ${startDate}, renouvelable tacitement par période de même durée.`,
        15,
        100
      );

      // ARTICLES 3, 4, 5 : CONDITIONS FINANCIÈRES (LOI 2019-576 ART. 415 & 416)
      doc.roundedRect(15, 104, 175, 11, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 3 : LOYER & AVANCE LÉGALEMENT PLAFONNÉE (ART. 415)', 18, 109);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(
        `Payable d'avance le ${dueDay < 10 ? '0' + dueDay : dueDay} du mois. Avance strictement plafonnée à 2 mois maximum par la loi.`,
        18,
        113
      );
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(145, 105.5, 42, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(rent), 149, 110.5);

      // Article 4 : Caution
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 117, 175, 11, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 4 : DÉPÔT DE GARANTIE PLAFONNÉ À 2 MOIS (ART. 416)', 18, 122);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(
        'Dépôt de garantie légalement plafonné à 2 mois hors charges. Restitution sous 30 jours après remise des clés.',
        18,
        126
      );
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(145, 118.5, 42, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(rent * cautionMonths), 149, 123.5);

      // Article 5 : Charges
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 130, 175, 11, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 5 : PROVISION SUR CHARGES LOCATIVES D\'USAGE (ART. 417)', 18, 135);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Eau, électricité des communs et ordures ménagères. Les impôts fonciers incombent au bailleur.', 18, 139);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(145, 131.5, 42, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(`${formatFCFA(chargesAmount)} / mois`, 147, 136.5);

      // ARTICLE 6 & 7 : OBLIGATIONS (2 COLONNES)
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 144, 85, 34, 2, 2, 'FD');
      doc.roundedRect(105, 144, 85, 34, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 6 : OBLIGATIONS DU LOCATAIRE (ART. 435)', 18, 149);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text('• Payer le loyer et charges aux dates convenues.', 18, 153.5);
      doc.text('• User paisiblement des lieux en bon père de famille.', 18, 157.5);
      doc.text('• Assumer l\'entretien courant et menues réparations locatives.', 18, 161.5);
      doc.text('• Ne pas transformer les lieux sans accord écrit (Art. 436).', 18, 165.5);
      doc.text('• Sous-location prohibée sans accord écrit préalable (Art. 437).', 18, 169.5);
      doc.text('• Restituer le logement en état conforme à l\'état des lieux.', 18, 173.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 7 : OBLIGATIONS DU BAILLEUR (ART. 424)', 108, 149);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text('• Délivrer un logement décent et salubre en bon état (Art. 424).', 108, 153.5);
      doc.text('• Assurer la jouissance paisible des lieux loués (Art. 425).', 108, 157.5);
      doc.text('• Grosses réparations structurelles et toiture à charge (Art. 428).', 108, 161.5);
      doc.text('• Droit de visite annuel avec préavis écrit de 48h (Art. 430).', 108, 165.5);
      doc.text('• Délivrer gratuitement les quittances certifiées (Art. 418).', 108, 169.5);
      doc.text('• Restituer la caution sous 30 jours après remise des clés.', 108, 173.5);

      // ARTICLE 8 : ÉTAT DES LIEUX & FORMALITÉ FISCALE DGI OBLIGATOIRE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 8 : ÉTAT DES LIEUX CONTRADICTOIRE & ENREGISTREMENT FISCAL DGI OBLIGATOIRE (ART. 414 & 416)', 15, 183);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'État des lieux contradictoire écrit obligatoire à l\'entrée et à la sortie (Art. 416). Enregistrement fiscal obligatoire à la Direction Générale des Impôts (DGI) conformément à l\'Article 414 de la Loi 2019-576.',
        15,
        187
      );

      // ARTICLE 9 : RÉSILIATION ET EXPULSION LÉGALE (LOI 2019-576 & LOI 2025-221)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 9 : RÉSILIATION & PROCÉDURE LÉGALE D\'EXPULSION (LOI N° 2025-221 & ART. 450)', 15, 193);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'Résiliation après mise en demeure (Art. 450). Expulsion strictement encadrée par la Loi n° 2025-221 du 28 mars 2025 (commandement de libérer les lieux et intervention exclusive du Commissaire de Justice, coupures d\'eau et de courant pénalement prohibées).',
        15,
        197
      );
    }

    // SIGNATURES DES PARTIES
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 212, 85, 30, 2, 2, 'FD');
    doc.roundedRect(105, 212, 85, 30, 2, 2, 'FD');

    // Résolution des signatures certifiées
    const resolvedOwnerSig = getCertifiedSignatureDataUrl(
      ownerName,
      isAgency ? 'agence' : 'bailleur',
      data.ownerSignatureUrl,
      `${startDate} à 10:30`
    );

    const resolvedTenantSig = getCertifiedSignatureDataUrl(
      tenantName,
      'locataire',
      data.tenantSignatureUrl,
      `${startDate} à 11:15`
    );

    // 1. Bailleur
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE' : 'LE PROPRIÉTAIRE (BAILLEUR)', 18, 217);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(ownerName, 18, 221.5);

    if (resolvedOwnerSig) {
      try {
        doc.addImage(resolvedOwnerSig, 'PNG', 18, 222.5, 48, 12);
      } catch (err) {
        console.warn('Could not render owner signature image on PDF:', err);
        doc.setFont('times', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(15, 39, 90);
        doc.text(ownerName, 20, 230);
      }
    } else {
      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(15, 39, 90);
      doc.text(ownerName, 20, 230);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(5, 150, 105);
    doc.text('Signature electronique certifiee LocaTrust', 21, 238.5);
    // Draw green badge dot
    doc.setFillColor(5, 150, 105);
    doc.circle(18.5, 237.5, 1.2, 'F');

    // 2. Locataire
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('LE LOCATAIRE (PRENEUR)', 108, 217);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(tenantName, 108, 221.5);

    if (resolvedTenantSig) {
      try {
        doc.addImage(resolvedTenantSig, 'PNG', 108, 222.5, 48, 12);
      } catch (err) {
        console.warn('Could not render tenant signature image on PDF:', err);
        doc.setFont('times', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(tenantName, 110, 230);
      }
    } else {
      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text(tenantName, 110, 230);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(5, 150, 105);
    doc.text('Signature electronique certifiee LocaTrust', 111, 238.5);
    // Draw green badge dot
    doc.setFillColor(5, 150, 105);
    doc.circle(108.5, 237.5, 1.2, 'F');

    // Sceau circulaire officiel type tampon de certification LocaTrust (forme ronde demandée - Point 2.1)
    const sealCenterX = 105;
    const sealCenterY = 258;
    
    // Cercle extérieur doré renforcé
    doc.setDrawColor(217, 119, 6); // amber-600
    doc.setLineWidth(0.85);
    doc.circle(sealCenterX, sealCenterY, 17.5, 'S');

    // Cercle intérieur double bordure
    doc.setLineWidth(0.35);
    doc.circle(sealCenterX, sealCenterY, 15.5, 'S');

    // Texte supérieur : « RÉPUBLIQUE DE CÔTE D'IVOIRE » parfaitement contenu et centré
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(180, 83, 9);
    doc.text('RÉPUBLIQUE DE CÔTE D\'IVOIRE', sealCenterX, sealCenterY - 9.5, { align: 'center' });

    // Étoiles décoratives de certification
    doc.setFontSize(5);
    doc.setTextColor(217, 119, 6);
    doc.text('★   ★   ★', sealCenterX, sealCenterY - 6.2, { align: 'center' });

    // En-tête principal central
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('LOCATRUST', sealCenterX, sealCenterY - 1, { align: 'center' });

    // Mention de conformité
    doc.setFontSize(5.5);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(isProfessional ? 'BAIL PROFESSIONNEL AUDCG' : 'BAIL D\'HABITATION CONFORME', sealCenterX, sealCenterY + 3.5, { align: 'center' });

    // Référence légale
    doc.setFontSize(4.3);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(isProfessional ? 'OHADA AUDCG & LOI N° 2025-221' : 'LOI N° 2019-576 & LOI 2025-221', sealCenterX, sealCenterY + 7.2, { align: 'center' });

    // Pied du sceau
    doc.setFontSize(4.8);
    doc.setTextColor(180, 83, 9);
    doc.text(isProfessional ? 'COMMERCE • SÉCURITÉ JURIDIQUE' : 'ABIDJAN • SÉCURITÉ JURIDIQUE', sealCenterX, sealCenterY + 11.2, { align: 'center' });

    // Extraction et analyse des conditions particulières pour pagination
    const parseRuleLines = (raw?: string | string[]): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter((r) => typeof r === 'string' && r.trim().length > 0);
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    };

    const ownerRules = parseRuleLines(data.ownerCustomConditions);
    const tenantRules = parseRuleLines(data.tenantCustomRequests);
    const propertyRules = parseRuleLines(data.propertySpecificRules);
    const generalCustomRules = parseRuleLines(data.customConditions);

    const hasCustomClauses =
      ownerRules.length > 0 ||
      tenantRules.length > 0 ||
      propertyRules.length > 0 ||
      generalCustomRules.length > 0;

    const totalPages = hasCustomClauses ? 2 : 1;

    // Bas de Page 1 : Pagination officielle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Page 1 / ${totalPages} • LocaTrust Certifié — Contrat de bail officiel N° ${contractNumber}`,
      105,
      287,
      { align: 'center' }
    );

    // ========================================================================
    // PAGE 2 : ANNEXE OFFICIELLE — CONDITIONS PARTICULIÈRES & RÈGLEMENTS
    // ========================================================================
    if (totalPages === 2) {
      doc.addPage('a4', 'portrait');

      // En-tête gauche Page 2 : Logo
      doc.setFont('helvetica', 'bold');
      if (isAgency) {
        doc.setFontSize(13);
        doc.setTextColor(29, 78, 216);
        doc.text(ownerName.toUpperCase(), 15, 18);
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('AGENCE IMMOBILIÈRE MANDATAIRE AGRÉÉE', 15, 22.5);
      } else {
        doc.setFontSize(15);
        doc.setTextColor(29, 78, 216);
        doc.text('LocaTrust', 15, 18);
        doc.setFontSize(7.5);
        doc.setTextColor(217, 119, 6);
        doc.text(isProfessional ? '— CONTRAT PROFESSIONNEL OHADA —' : '— GESTION LOCATIVE CONFORME —', 15, 22.5);
      }

      // Badge N° Annexe en haut à droite
      doc.setFillColor(245, 158, 11); // amber-500
      doc.roundedRect(115, 13, 80, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`ANNEXE OFFICIELLE N° ${contractNumber}`, 155, 17.5, { align: 'center' });

      // Titre de l'Annexe
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ANNEXE CONTRACTUELLE : CONDITIONS PARTICULIÈRES & RÈGLEMENTS CONVENUS', 15, 30);

      // Sous-titre explicatif & cadre juridique
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      const subNotice = isProfessional
        ? 'Faisant partie intégrante et indissociable du Bail Professionnel souscrit en application de l\'Acte Uniforme OHADA (AUDCG). Les stipulations ci-dessous sont arrêtées de bonne foi et lient les parties contractantes.'
        : 'Faisant partie intégrante et indissociable du Bail d\'Habitation conclu sous l\'empire de la Loi n° 2019-576 et de la Loi n° 2025-221. Les clauses particulières ci-dessous ont été convenues d\'un commun accord entre les parties.';
      doc.text(doc.splitTextToSize(subNotice, 180), 15, 34.5);

      // Ligne décorative séparatrice
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 41, 195, 41);

      let yPos = 46;

      // Helper pour dessiner une section de règles avec style carte aérée
      const renderRulesSection = (
        title: string,
        rules: string[],
        badgeLabel: string,
        headerColor: [number, number, number] = [29, 78, 216]
      ) => {
        if (rules.length === 0) return;

        // Préparation des lignes avec puces
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        let totalLinesCount = 0;
        const parsedLines: string[][] = [];

        rules.forEach((rule) => {
          const cleanRule = rule.replace(/^\d+[\.\)\-]\s*/, '').trim();
          const wrapped = doc.splitTextToSize(`•  ${cleanRule}`, 170);
          parsedLines.push(wrapped);
          totalLinesCount += wrapped.length;
        });

        const sectionPadding = 7;
        const headerHeight = 7;
        const lineHeight = 4.2;
        const contentHeight = totalLinesCount * lineHeight;
        const boxHeight = headerHeight + contentHeight + sectionPadding;

        // Dessin du container carte
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, yPos, 180, boxHeight, 2, 2, 'FD');

        // Bandeau d'en-tête de la section
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
        doc.text(title, 20, yPos + 5.5);

        // Badge à droite
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(badgeLabel, 190, yPos + 5.5, { align: 'right' });

        // Ligne fine sous l'en-tête
        doc.setDrawColor(241, 245, 249);
        doc.line(20, yPos + 7.5, 190, yPos + 7.5);

        // Contenu des règles
        let textY = yPos + 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(30, 41, 59);

        parsedLines.forEach((lines) => {
          lines.forEach((lineText, idx) => {
            doc.text(lineText, idx === 0 ? 20 : 23, textY);
            textY += lineHeight;
          });
        });

        yPos += boxHeight + 4;
      };

      // Rendu des 3 sections si disponibles
      if (ownerRules.length > 0) {
        renderRulesSection(
          '1. CONDITIONS PARTICULIÈRES DU PROPRIÉTAIRE (BAILLEUR)',
          ownerRules,
          'Exigences Bailleur Validées',
          [29, 78, 216]
        );
      }

      if (tenantRules.length > 0) {
        renderRulesSection(
          '2. DEMANDES & MODALITÉS PARTICULIÈRES ACCORDÉES AU LOCATAIRE',
          tenantRules,
          'Accords Locataire Validés',
          [5, 150, 105]
        );
      }

      if (propertyRules.length > 0) {
        renderRulesSection(
          '3. RÈGLES SPÉCIFIQUES DU LOGEMENT & COPROPRIÉTÉ',
          propertyRules,
          'Usage & Copropriété',
          [180, 83, 9]
        );
      }

      if (ownerRules.length === 0 && tenantRules.length === 0 && propertyRules.length === 0 && generalCustomRules.length > 0) {
        renderRulesSection(
          'CLAUSES & STIPULATIONS PARTICULIÈRES CONVENUES ENTRE LES PARTIES',
          generalCustomRules,
          'Stipulations Particulières',
          [29, 78, 216]
        );
      }

      // Zone des Signatures et Paraphes en bas de Page 2
      const sigY = Math.max(yPos + 4, 215);

      // Boîte gauche : Bailleur
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, sigY, 85, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(isAgency ? 'POUR LA SOCIÉTÉ IMMOBILIÈRE' : 'POUR LE BAILLEUR (PROPRIÉTAIRE)', 18, sigY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Mention : « Lu et approuvé sans réserve »', 18, sigY + 9);

      if (resolvedOwnerSig) {
        try {
          doc.addImage(resolvedOwnerSig, 'PNG', 18, sigY + 10.5, 45, 11);
        } catch (e) {
          doc.setFont('times', 'italic');
          doc.setFontSize(10);
          doc.text(ownerName, 20, sigY + 18);
        }
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.text(ownerName, 20, sigY + 18);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(5, 150, 105);
      doc.text('Paraphe & Signature électronique certifiée', 21, sigY + 26);
      doc.setFillColor(5, 150, 105);
      doc.circle(18.5, sigY + 25.2, 1, 'F');

      // Boîte droite : Preneur
      doc.roundedRect(105, sigY, 85, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('POUR LE PRENEUR (LOCATAIRE)', 108, sigY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Mention : « Lu et approuvé sans réserve »', 108, sigY + 9);

      if (resolvedTenantSig) {
        try {
          doc.addImage(resolvedTenantSig, 'PNG', 108, sigY + 10.5, 45, 11);
        } catch (e) {
          doc.setFont('times', 'italic');
          doc.setFontSize(10);
          doc.text(tenantName, 110, sigY + 18);
        }
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.text(tenantName, 110, sigY + 18);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(5, 150, 105);
      doc.text('Paraphe & Signature électronique certifiée', 111, sigY + 26);
      doc.setFillColor(5, 150, 105);
      doc.circle(108.5, sigY + 25.2, 1, 'F');

      // Tampon de conformité Annexe
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(180, 83, 9);
      doc.text('DOCUMENT OFFICIEL ET SCELLÉ NUMÉRIQUEMENT PAR LOCATRUST', 105, sigY + 34.5, { align: 'center' });

      // Pagination Page 2
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page 2 / 2 • Document indissociable du contrat principal N° ${contractNumber}`,
        105,
        287,
        { align: 'center' }
      );
    }

    doc.save(`Contrat_Officiel_${contractNumber}.pdf`);
    // Déclenchement automatique de l'animation festive de célébration
    triggerCelebration('download');
  } catch (e) {
    console.warn('PDF export error:', e);
    window.print();
  }
};
