'use client';

import jsPDF from 'jspdf';
import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { LOCATRUST_OFFICIAL_LOGO_BASE64 } from '@/lib/officialLogoBase64';
import { generateScannableQrCodeDataUrl } from '@/lib/qr/qrGenerator';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { triggerCelebration } from '@/lib/celebration';

export interface RestitutionReceiptData {
  receiptNumber: string; // e.g. RRC-2026-000001
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  ownerName: string;
  ownerPhone?: string;
  tenantName: string;
  tenantPhone?: string;
  initialCautionAmount: number;
  amountRestituted: number;
  deductionAmount: number;
  deductionReason?: string;
  restitutionDate: string;
  paymentMethod: string;
  transactionReference: string;
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
}

export const generateRestitutionReceiptPDF = async (data: RestitutionReceiptData): Promise<void> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryNavy = [11, 25, 44]; // #0B192C
    const accentBlue = [29, 78, 216]; // #1D4ED8
    const goldAccent = [245, 158, 11]; // #F59E0B
    const emeraldGreen = [4, 120, 87]; // #047857
    const slateDark = [15, 23, 42]; // #0F172A
    const slateGray = [100, 116, 139]; // #64748B
    const bgLight = [248, 250, 252]; // #F8FAFC
    const borderSlate = [226, 232, 240]; // #E2E8F0

    // 1. TOP HEADER BRANDING
    try {
      doc.addImage(LOCATRUST_OFFICIAL_LOGO_BASE64, 'PNG', 15, 9, 44, 12);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(29, 78, 216);
      doc.text('Loca', 15, 18.5);
      doc.setTextColor(245, 158, 11);
      doc.text('Trust', 29, 18.5);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Votre bien, notre priorité • Sécurité & Conformité Juridique', 15, 23);

    // Official Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 78, 216);
    doc.text('RÉPUBLIQUE DE CÔTE D\'IVOIRE', 195, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Loi N° 2019-576 du 26 juin 2019 portant Code de la Construction et de l\'Habitat', 195, 18.5, { align: 'right' });
    doc.text('Décret N° 2019-594 fixant les modalités de restitution des dépôts de garantie', 195, 22.5, { align: 'right' });

    // 2. NAVY & GOLD BANNER
    doc.setFillColor(11, 25, 44);
    doc.roundedRect(15, 28, 180, 22, 2.5, 2.5, 'F');

    // Gold accent top bar
    doc.setFillColor(245, 158, 11);
    doc.rect(15, 28, 180, 1.8, 'F');

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('REÇU OFFICIEL DE RESTITUTION DE CAUTION', 22, 38.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    doc.text('Attestation de remboursement de dépôt de garantie • Fin de bail', 22, 44.5);

    // Nature comptable badge
    doc.setFillColor(30, 58, 138);
    doc.roundedRect(132, 32.5, 58, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(191, 219, 254);
    doc.text('OPÉRATION : RESTITUTION_CAUTION', 161, 37, { align: 'center' });

    // Receipt Number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(245, 158, 11);
    doc.text(`Réf : ${data.receiptNumber}`, 190, 46.5, { align: 'right' });

    // 3. 4 STRUCTURED INFORMATION CARDS (Always reset to clean #F8FAFC light background)
    const cardY = 54;
    const cardH = 34;
    const cardW = 42.5;
    const gap = 3.3;

    // Card 1: Propriétaire / Bailleur
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(29, 78, 216);
    doc.rect(15, cardY, cardW, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(29, 78, 216);
    doc.text('BAILLEUR / GESTIONNAIRE', 19, cardY + 5.5);

    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.ownerName, 19, cardY + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Qualité : Bailleur Propriétaire', 19, cardY + 16.5);
    doc.text(`Tél : ${data.ownerPhone || '+225 07 48 92 11 00'}`, 19, cardY + 21);
    doc.text('Compte séquestre certifié', 19, cardY + 25.5);
    doc.text('Abidjan, Côte d\'Ivoire', 19, cardY + 30);

    // Card 2: Locataire (RESET background to clean #F8FAFC)
    const card2X = 15 + cardW + gap;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(card2X, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(5, 150, 105);
    doc.rect(card2X, cardY, cardW, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87);
    doc.text('LOCATAIRE SORTANT', card2X + 4, cardY + 5.5);

    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.tenantName, card2X + 4, cardY + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Qualité : Preneur à bail', card2X + 4, cardY + 16.5);
    doc.text(`Tél : ${data.tenantPhone || '+225 07 08 09 10 11'}`, card2X + 4, cardY + 21);
    doc.text('État des lieux : Conforme', card2X + 4, cardY + 25.5);
    doc.text('Dossier locatif soldé', card2X + 4, cardY + 30);

    // Card 3: Bien Loué & Contrat (RESET background to clean #F8FAFC)
    const card3X = card2X + cardW + gap;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(card3X, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(245, 158, 11);
    doc.rect(card3X, cardY, cardW, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9);
    doc.text('LOGEMENT & CONTRAT', card3X + 4, cardY + 5.5);

    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const splitTitle = doc.splitTextToSize(data.propertyTitle, 35);
    doc.text(splitTitle[0] || data.propertyTitle, card3X + 4, cardY + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const splitAddr = doc.splitTextToSize(data.propertyAddress, 35);
    doc.text(splitAddr[0] || data.propertyAddress, card3X + 4, cardY + 16.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Contrat N° ${data.contractNumber}`, card3X + 4, cardY + 23);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Bail loi 2019-576', card3X + 4, cardY + 28);

    // Card 4: Modalités de Restitution (RESET background to clean #F8FAFC)
    const card4X = card3X + cardW + gap;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(card4X, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(15, 23, 42);
    doc.rect(card4X, cardY, cardW, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text('MODALITÉS DE RESTITUTION', card4X + 4, cardY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Date de restitution :', card4X + 4, cardY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.restitutionDate || new Date().toLocaleDateString('fr-FR'), card4X + 4, cardY + 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Moyen de règlement :', card4X + 4, cardY + 20.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.paymentMethod || 'Wave / Virement', card4X + 4, cardY + 24.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(4, 120, 87);
    doc.text('✓ Fonds débloqués du séquestre', card4X + 4, cardY + 30);

    // 4. FINANCIAL BREAKDOWN TABLE (Clean spaced columns with zero collision)
    const tableY = 93;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, tableY, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('DÉSIGNATION DE L\'OPÉRATION DE CAUTION', 19, tableY + 5.5);
    doc.text('MONTANT INITIAL', 115, tableY + 5.5, { align: 'right' });
    doc.text('DÉDUCTION / RETENUE', 155, tableY + 5.5, { align: 'right' });
    doc.text('MONTANT RESTITUÉ', 191, tableY + 5.5, { align: 'right' });

    // Table rows
    doc.setDrawColor(226, 232, 240);
    doc.line(15, tableY + 8, 195, tableY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Dépôt de garantie initial (Caution)', 19, tableY + 15);
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Enregistré et séquestré lors de la signature du contrat ${data.contractNumber}`, 19, tableY + 19.5);

    // Montant initial
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(formatFCFA(data.initialCautionAmount), 115, tableY + 15, { align: 'right' });

    // Deduction / Retenue
    if (data.deductionAmount > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatFCFA(data.deductionAmount)}`, 155, tableY + 15, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(185, 28, 28);
      const splitReason = doc.splitTextToSize(data.deductionReason || 'Dégradations constatées', 35);
      doc.text(splitReason[0] || 'Retenue légale', 155, tableY + 19.5, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text('0 FCFA (Aucune)', 155, tableY + 15, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Logement rendu conforme', 155, tableY + 19.5, { align: 'right' });
    }

    // Net restituted
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text(formatFCFA(data.amountRestituted), 191, tableY + 15, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(15, tableY + 24, 195, tableY + 24);

    // Deduction summary box if deduction exists
    if (data.deductionAmount > 0) {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(15, tableY + 27, 180, 13, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('JUSTIFICATION LÉGALE DE LA RETENUE (ARTICLE 8 DU CONTRAT & CODE DE LA CONSTRUCTION) :', 19, tableY + 31.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 53, 15);
      doc.text(
        `Une retenue de ${formatFCFA(data.deductionAmount)} est appliquée : "${data.deductionReason || 'Réparations locatives'}". Devis et justificatifs annexés.`,
        19,
        tableY + 36
      );
    }

    // 5. TOTALS BOX (Wider layout with ZERO text overlap)
    const totalBoxY = data.deductionAmount > 0 ? tableY + 44 : tableY + 27;

    // Transaction Stamp on the left (x: 15 to 112)
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(15, totalBoxY, 97, 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text('OPÉRATION COMPTABLE RESTITUTION_CAUTION ENREGISTRÉE', 19, totalBoxY + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87);
    doc.text(`Réf. transaction : ${data.transactionReference}`, 19, totalBoxY + 12);
    doc.text(`Moyen de remboursement : ${data.paymentMethod}`, 19, totalBoxY + 16.5);
    doc.text(`Date d'exécution : ${data.restitutionDate}`, 19, totalBoxY + 21);

    // Totals Box on the right (x: 116 to 195, width: 79mm)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(116, totalBoxY, 79, 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Caution initiale :', 121, totalBoxY + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatFCFA(data.initialCautionAmount), 191, totalBoxY + 6.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Retenue appliquée :', 121, totalBoxY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(data.deductionAmount > 0 ? 220 : 71, data.deductionAmount > 0 ? 38 : 85, data.deductionAmount > 0 ? 38 : 105);
    doc.text(`- ${formatFCFA(data.deductionAmount)}`, 191, totalBoxY + 12, { align: 'right' });

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(121, totalBoxY + 15.5, 191, totalBoxY + 15.5);

    // Net restituted (spacious & separated to avoid any visual collision)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('MONTANT NET RESTITUÉ :', 121, totalBoxY + 21);
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text(formatFCFA(data.amountRestituted), 191, totalBoxY + 21, { align: 'right' });

    // 6. SIGNATURES & SCANNABLE QR CODE
    const sigY = totalBoxY + 31;

    const resolvedOwnerSig = getCertifiedSignatureDataUrl(
      data.ownerName,
      'bailleur',
      data.ownerSignatureUrl,
      `${data.restitutionDate || '30/09/2026'} à 15:30`
    );

    const resolvedTenantSig = getCertifiedSignatureDataUrl(
      data.tenantName,
      'locataire',
      data.tenantSignatureUrl,
      `${data.restitutionDate || '30/09/2026'} à 15:45`
    );

    // Signature Bailleur
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, sigY, 52, 26, 2, 2, 'FD');
    if (resolvedOwnerSig) {
      try {
        doc.addImage(resolvedOwnerSig, 'PNG', 18, sigY + 2, 46, 15);
      } catch (err) {
        console.warn('Signature error:', err);
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(15, 39, 90);
        doc.text(data.ownerName, 20, sigY + 11);
      }
    } else {
      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(15, 39, 90);
      doc.text(data.ownerName, 20, sigY + 11);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Signature du bailleur', 18, sigY + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(data.ownerName, 18, sigY + 24);

    // Signature Locataire
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(70, sigY, 52, 26, 2, 2, 'FD');
    if (resolvedTenantSig) {
      try {
        doc.addImage(resolvedTenantSig, 'PNG', 73, sigY + 2, 46, 15);
      } catch (err) {
        console.warn('Signature error:', err);
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(30, 58, 138);
        doc.text(data.tenantName, 75, sigY + 11);
      }
    } else {
      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138);
      doc.text(data.tenantName, 75, sigY + 11);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Pour accord & décharge du locataire', 73, sigY + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(data.tenantName, 73, sigY + 24);

    // QR Code Verification (REAL 100% SCANNABLE QR CODE)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(125, sigY, 70, 26, 2, 2, 'FD');
    
    const verificationUrl = `https://locatrust.ci/verification/restitution/${data.receiptNumber}`;
    try {
      const qrDataUrl = generateScannableQrCodeDataUrl(verificationUrl, { size: 300, margin: 2 });
      doc.addImage(qrDataUrl, 'PNG', 127, sigY + 3, 20, 20);
    } catch (e) {
      console.warn('Dynamic QR generation fallback:', e);
      try {
        doc.addImage(LOCATRUST_QR_CODE_DATA_URL, 'PNG', 127, sigY + 3, 20, 20);
      } catch {}
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(29, 78, 216);
    doc.text('VÉRIFICATION SÉCURISÉE', 149, sigY + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Scanner pour vérifier l\'authenticité', 149, sigY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(100, 116, 139);
    doc.text('Attestation officielle de fin de compte.', 149, sigY + 14.5);
    doc.text('Restitution garantie par LocaTrust CI.', 149, sigY + 17.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(4, 120, 87);
    doc.text('✓ Solde de caution apuré', 149, sigY + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`locatrust.ci/v/r/${data.receiptNumber}`, 149, sigY + 24.5);

    // 7. FOOTER NOTE
    const footerY = 275;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, footerY, 195, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Document officiel de fin de bail valant décharge réciproque entre bailleur et locataire au titre du dépôt de garantie (Code de la Construction et de l\'Habitat Ivoirien).',
      105,
      footerY + 5,
      { align: 'center' }
    );

    doc.save(`Recu_Restitution_Caution_${data.receiptNumber}.pdf`);
    triggerCelebration('download');
  } catch (error) {
    console.error('Failed to generate restitution receipt PDF:', error);
  }
};
