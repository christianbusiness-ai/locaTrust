import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { triggerCelebration } from '@/lib/celebration';

export interface ContractPdfData {
  contractNumber: string;
  isAgency?: boolean;
  ownerName: string;
  ownerPhone?: string;
  tenantName: string;
  tenantPhone?: string;
  tenantCni?: string;
  propertyTitle: string;
  propertyAddress: string;
  surface?: number;
  durationMonths?: number;
  startDate?: string;
  rent: number;
  cautionMonths?: number;
  chargesAmount?: number;
  dueDay?: number;
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
  isSignedCopy?: boolean;
}

export const generateOfficialContractPdf = async (data: ContractPdfData) => {
  try {
    const jspdfModule = await import('jspdf');
    const jsPDFClass = (jspdfModule as any)?.jsPDF || (jspdfModule as any)?.default || jspdfModule;
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const {
      contractNumber,
      isAgency = false,
      ownerName = 'Koffi N\'Guessan',
      ownerPhone = '+225 07 89 45 12 34',
      tenantName = 'Kouadio Jean',
      tenantPhone = '+225 05 67 89 45 12',
      tenantCni = 'CI002894129',
      propertyTitle = 'Appartement 3 pièces',
      propertyAddress = 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
      durationMonths = 12,
      startDate = '01/07/2026',
      rent = 75000,
      cautionMonths = 2,
      chargesAmount = 5000,
      dueDay = 5
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
      doc.text('— GESTION LOCATIVE PREMIUM —', 15, 25);
    }

    // En-tête droite : CONTRAT DE BAIL + Badge N° + QR Code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('CONTRAT DE BAIL', 120, 18);

    // Badge N° Contrat
    doc.setFillColor(245, 158, 11); // amber-500
    doc.roundedRect(120, 22, 38, 6.5, 1.5, 1.5, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`N° ${contractNumber}`, 123, 26.5);

    // Enregistrement automatique dans le registre officiel de vérification LocaTrust
    const { registerContractInVerificationRegistry } = await import('@/lib/verificationRegistry');
    const { token, verificationUrl } = registerContractInVerificationRegistry({
      contractNumber,
      ownerName,
      tenantName,
      propertyTitle,
      propertyAddress,
      rentAmount: rent,
      cautionAmount: rent * cautionMonths
    });

    // QR Code officiel scannable calibré avec marge blanche et haute résolution (Point 3)
    try {
      const { getLocaTrustVerificationQR } = await import('@/lib/qrCode');
      // Public verification URL (no subscription wall, no login required)
      const publicVerifyUrl = `https://locatrust.com/verify/contrat/${token}`;
      const qrDataUrl = getLocaTrustVerificationQR(publicVerifyUrl, 360);

      // Fond blanc propre pour quiet zone
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(164, 11, 32, 33, 1, 1, 'F');
      
      // QR Code 28x28 mm parfaitement lisible sur smartphone
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
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Entre les soussignés :', 15, 36);

    // Boîtes Parties (Bailleur & Locataire)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 39, 85, 25, 2, 2, 'FD');
    doc.roundedRect(105, 39, 85, 25, 2, 2, 'FD');

    // Bailleur / Agence
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE (BAILLEUR)' : 'LE PROPRIÉTAIRE (BAILLEUR)', 18, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nom : ${ownerName}`, 18, 49);
    doc.text(`Téléphone : ${ownerPhone}`, 18, 53);
    doc.text(`Adresse : Cocody, Abidjan - Côte d'Ivoire`, 18, 57);
    doc.text(`Pièce d'identité : CNI N° CI123456789`, 18, 61);

    // Preneur
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('LE LOCATAIRE (PRENEUR)', 108, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nom : ${tenantName}`, 108, 49);
    doc.text(`Téléphone : ${tenantPhone}`, 108, 53);
    doc.text(`Adresse : Riviera 3, Cocody - Abidjan`, 108, 57);
    doc.text(`Pièce d'identité : CNI N° ${tenantCni}`, 108, 61);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Il a été convenu et arrêté ce qui suit :', 15, 68);

    // ARTICLE 1 : DÉSIGNATION DU BIEN
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 78, 216);
    doc.text('ARTICLE 1 : DÉSIGNATION DU BIEN', 15, 74);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Le bailleur donne en location au preneur qui accepte, le bien immobilier suivant :`, 15, 78);
    
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 80, 175, 14, 2, 2, 'FD');
    doc.text(`• Type : ${propertyTitle} | Localisation : ${propertyAddress} | Surface : 120 m²`, 18, 85);
    doc.text(`• Composition : 3 pièces, 2 chambres, 1 salon, 2 salles de bain | Équipements : Climatisation, parking`, 18, 90);

    // ARTICLE 2 : DURÉE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 78, 216);
    doc.text('ARTICLE 2 : DURÉE', 15, 99);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Le contrat est conclu pour une durée de ${durationMonths} mois, commençant le ${startDate}. Il se renouvelle tacitement par période de même durée.`, 15, 104);

    // ARTICLES 3, 4, 5 : CONDITIONS FINANCIÈRES (AVEC PILLS RECTANGULAIRES)
    // Article 3 : Loyer
    doc.roundedRect(15, 108, 175, 12, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('ARTICLE 3 : LOYER', 18, 113);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Payable d'avance le ${dueDay < 10 ? '0' + dueDay : dueDay} de chaque mois par Mobile Money (Wave, OM, Moov) ou Virement.`, 18, 117);
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(145, 110, 42, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(formatFCFA(rent), 149, 115.5);

    // Article 4 : Caution
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, 122, 175, 12, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('ARTICLE 4 : CAUTION (DÉPÔT DE GARANTIE)', 18, 127);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`Dépôt de garantie légalement plafonné à 2 mois (Art. 416). Restitué dans 1 mois après la fin du bail.`, 18, 131);
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(145, 124, 42, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(formatFCFA(rent * cautionMonths), 149, 129.5);

    // Article 5 : Charges
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, 136, 175, 12, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('ARTICLE 5 : PROVISION SUR CHARGES', 18, 141);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`Eau, électricité des parties communes et ordures ménagères avec régularisation annuelle.`, 18, 145);
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(145, 138, 42, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`${formatFCFA(chargesAmount)} / mois`, 147, 143.5);

    // ARTICLE 6 & 7 : OBLIGATIONS (2 COLONNES)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 151, 85, 34, 2, 2, 'FD');
    doc.roundedRect(105, 151, 85, 34, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text('ARTICLE 6 : OBLIGATIONS DU LOCATAIRE', 18, 156);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('• Payer le loyer et charges aux dates convenues.', 18, 161);
    doc.text('• User paisiblement des lieux en bon père de famille.', 18, 165);
    doc.text('• Entretenir le logement et menues réparations.', 18, 169);
    doc.text('• Ne pas transformer sans accord écrit du bailleur.', 18, 173);
    doc.text('• Restituer les lieux en bon état.', 18, 177);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text('ARTICLE 7 : OBLIGATIONS DU PROPRIÉTAIRE', 108, 156);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('• Délivrer un logement décent en bon état.', 108, 161);
    doc.text('• Assurer la jouissance paisible des lieux.', 108, 165);
    doc.text('• Grosses réparations de structure à charge.', 108, 169);
    doc.text('• Respecter la vie privée du locataire.', 108, 173);
    doc.text('• Fournir les quittances de paiement.', 108, 177);

    // ARTICLE 8 & 9 : RÉSILIATION ET LITIGES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text('ARTICLE 8 : RÉSILIATION', 15, 190);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text("En cas de manquement grave, résiliation après mise en demeure de 30 jours (Art. 450 Loi 2019-576).", 15, 194);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text('ARTICLE 9 : LITIGES', 15, 201);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text("Règlement à l'amiable, puis compétence exclusive au Tribunal de Première Instance d'Abidjan.", 15, 205);

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
    doc.text('BAIL CONFORME & CERTIFIÉ', sealCenterX, sealCenterY + 3.5, { align: 'center' });

    // Référence légale
    doc.setFontSize(4.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('LOI N° 2019-576 DU 26 JUIN 2019', sealCenterX, sealCenterY + 7.2, { align: 'center' });

    // Pied du sceau
    doc.setFontSize(4.8);
    doc.setTextColor(180, 83, 9);
    doc.text('ABIDJAN • SÉCURITÉ JURIDIQUE', sealCenterX, sealCenterY + 11.2, { align: 'center' });

    doc.save(`Contrat_Officiel_${contractNumber}.pdf`);
    // Déclenchement automatique de l'animation festive de célébration
    triggerCelebration('download');
  } catch (e) {
    console.warn('PDF export error:', e);
    window.print();
  }
};
