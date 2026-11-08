import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { triggerCelebration } from '@/lib/celebration';
import { resolveBestPartyCni } from '@/lib/contractPartyResolver';

async function ensureImageDataUrl(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:image/')) return url;
  if (typeof window === 'undefined') return null;
  try {
    return await new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 460;
          canvas.height = img.naturalHeight || 140;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(url);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  } catch {
    return url;
  }
}

export interface ContractPdfData {
  contractNumber: string;
  leaseType?: 'habitation' | 'professionnel';
  usageDestination?: 'habitation' | 'professionnel';
  authorizedActivity?: string;
  isAgency?: boolean;
  ownerName: string;
  mandantName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerAddress?: string;
  ownerCni?: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantAddress?: string;
  tenantCni?: string;
  tenantEntityKind?: 'personne_physique' | 'personne_morale';
  tenantRccm?: string;
  propertyTitle: string;
  propertyAddress: string;
  surface?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  equipments?: string[] | string;
  amenities?: string[] | string;
  propertyDescription?: string;
  durationMonths?: number;
  startDate?: string;
  rent: number;
  cautionAmount?: number;
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
  // Contrôle strict de sécurité et conformité juridique (Point 10) :
  // Le document officiel final scellé ne peut JAMAIS être généré ou téléchargé
  // tant que les DEUX signatures (bailleur et locataire) ne sont pas présentes.
  if (!data.ownerSignatureUrl || !data.tenantSignatureUrl) {
    const errorMsg = "Téléchargement bloqué : Le contrat officiel final ne peut pas être téléchargé tant que le locataire et le propriétaire n'ont pas tous les deux apposé leurs signatures manuscrites certifiées.";
    console.warn(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const jspdfModule = await import('jspdf');
    const jsPDFClass = (jspdfModule as any)?.jsPDF || (jspdfModule as any)?.default || jspdfModule;
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const isProfessional = data.leaseType === 'professionnel';

    const {
      contractNumber,
      isAgency = false,
      ownerName = 'Bailleur',
      mandantName,
      ownerPhone = data.ownerPhone || '',
      tenantName = 'Locataire',
      tenantPhone = data.tenantPhone || '',
      tenantCni = data.tenantCni || '',
      tenantRccm,
      propertyTitle = isProfessional ? 'Local Professionnel / Bureaux' : 'Bien immobilier',
      propertyAddress = data.propertyAddress || 'Abidjan - Côte d\'Ivoire',
      surface,
      rooms,
      bedrooms,
      bathrooms,
      equipments,
      amenities,
      propertyDescription,
      durationMonths = isProfessional ? 24 : 12,
      startDate = data.startDate || new Date().toLocaleDateString('fr-FR'),
      rent = data.rent || 0,
      cautionAmount: rawCautionAmount,
      cautionMonths = data.cautionMonths ?? (rent > 0 && rawCautionAmount ? Number((rawCautionAmount / rent).toFixed(1)) : (isProfessional ? 3 : 2)),
      chargesAmount = Number(data.chargesAmount ?? (data as any)?.charges ?? 0),
      dueDay = data.dueDay || 5,
      authorizedActivity = isProfessional ? (data.authorizedActivity || 'Activités commerciales et professionnelles') : undefined
    } = data;

    const effectiveCautionAmount = rawCautionAmount !== undefined && rawCautionAmount !== null
      ? Number(rawCautionAmount)
      : (rent * cautionMonths);

    const rawEquipments = equipments || amenities || [];
    const equipmentsList = Array.isArray(rawEquipments)
      ? rawEquipments.filter(Boolean).join(', ')
      : (typeof rawEquipments === 'string' ? rawEquipments : '');

    // En-tête gauche : Logo Agence ou LocaTrust
    doc.setFont('helvetica', 'bold');
    if (isAgency) {
      doc.setFontSize(14);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text(ownerName.toUpperCase(), 15, 18);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('AGENCE IMMOBILIÈRE MANDATAIRE AGRÉÉE', 15, 23);
    } else {
      doc.setFontSize(16);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text('LocaTrust', 15, 18);
      doc.setFontSize(7.5);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text(isProfessional ? '— DROIT COMMERCIAL & IMMOBILIER PRO —' : '— GESTION LOCATIVE CONFORME —', 15, 23);
    }

    // En-tête centre/droite : CONTRAT DE BAIL + Badge N°
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(isProfessional ? 'BAIL À USAGE PROFESSIONNEL' : 'CONTRAT DE BAIL D\'HABITATION', 88, 16);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      isProfessional
        ? 'RÉGIME OHADA AUDCG & LOI N° 2025-221 ART. 14'
        : 'LOI N° 2019-576 (HABITAT) & LOI N° 2025-221',
      88,
      20
    );

    // Badge N° Contrat
    doc.setFillColor(245, 158, 11); // amber-500
    doc.roundedRect(88, 22.5, 38, 5.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`N° ${contractNumber}`, 91, 26.3);

    // Enregistrement automatique dans le registre officiel de vérification LocaTrust
    const { registerContractInVerificationRegistry } = await import('@/lib/verificationRegistry');
    const { token } = registerContractInVerificationRegistry({
      contractNumber,
      ownerName,
      tenantName,
      propertyTitle,
      propertyAddress,
      rentAmount: rent,
      cautionAmount: effectiveCautionAmount
    });

    // QR Code officiel scannable calibré en haut à droite avec quiet zone et AUCUN chevauchement
    try {
      const { getLocaTrustVerificationQR, getAbsoluteVerificationUrl } = await import('@/lib/qrCode');
      const publicVerifyUrl = getAbsoluteVerificationUrl(`/verify/contrat/${token || contractNumber}`, 'contrat');
      const qrDataUrl = getLocaTrustVerificationQR(publicVerifyUrl, 360);

      // Fond blanc propre pour quiet zone (parfaitement cantonné entre Y=8.5 et Y=33)
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(171, 8.5, 24, 25, 1, 1, 'F');

      // QR Code 18x18 mm
      doc.addImage(qrDataUrl, 'PNG', 174, 9.5, 18, 18);
      doc.setFontSize(4.5);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text("SCANNER POUR VÉRIFIER", 183, 29.5, { align: 'center' });
      doc.setFontSize(3.8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text("Authentification publique certifiée", 183, 32, { align: 'center' });
    } catch (err) {
      console.warn('QR Code embedding error in PDF:', err);
    }

    const ownerCniDisplay = resolveBestPartyCni([data.ownerCni], 'owner');
    const tenantCniDisplay = resolveBestPartyCni([tenantCni, data.tenantCni], 'tenant');

    // Entre les soussignés (Commence proprement sous le bandeau d'en-tête et le QR code)
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Entre les soussignés :', 15, 35.0);

    // Boîtes Parties (Bailleur & Locataire) - Zéro chevauchement avec le QR Code qui se termine à Y=33
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 36.8, 85, 24.8, 2, 2, 'FD');
    doc.roundedRect(105, 36.8, 85, 24.8, 2, 2, 'FD');

    // Bailleur / Agence
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);
    if (isAgency && mandantName) {
      doc.text('L\'AGENCE IMMOBILIÈRE (MANDATAIRE)', 18, 41.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(51, 65, 85);
      doc.text(`Agence : ${ownerName}`, 18, 45.4);
      doc.setFont('helvetica', 'bold');
      doc.text(`Propriétaire Mandant : ${mandantName}`, 18, 49.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Téléphone : ${ownerPhone || data.ownerPhone || 'Non renseigné'}`, 18, 53.6);
      doc.text(`Identifiant : RCCM/CNI N° ${ownerCniDisplay}`, 18, 57.8);
    } else {
      doc.text(isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE (BAILLEUR)' : 'LE BAILLEUR (PROPRIÉTAIRE)', 18, 41.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Nom / Raison : ${ownerName}`, 18, 45.6);
      doc.text(`Téléphone : ${ownerPhone || data.ownerPhone || 'Non renseigné'}`, 18, 49.9);
      doc.text(`Adresse : ${data.ownerAddress || 'Abidjan - Côte d\'Ivoire'}`, 18, 54.2);
      doc.text(`Identifiant : CNI/Passeport N° ${ownerCniDisplay}`, 18, 58.5);
    }

    // Preneur (Personne physique ou morale)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);
    doc.text(
      isProfessional
        ? (tenantRccm ? 'LE PRENEUR PROFESSIONNEL (SOCIÉTÉ)' : 'LE PRENEUR (ENTREPRISE / PROFESSIONNEL)')
        : 'LE LOCATAIRE (PRENEUR)',
      108,
      41.2
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nom / Raison sociale : ${tenantName}`, 108, 45.6);
    doc.text(`Téléphone : ${tenantPhone || data.tenantPhone || 'Non renseigné'}`, 108, 49.9);
    if (isProfessional && tenantRccm) {
      doc.text(`Immatriculation RCCM : ${tenantRccm}`, 108, 54.2);
      doc.text(`Représenté par CNI N° ${tenantCniDisplay}`, 108, 58.5);
    } else {
      doc.text(`Adresse : ${data.tenantAddress || 'Abidjan - Côte d\'Ivoire'}`, 108, 54.2);
      doc.text(`Pièce d'identité : CNI/Passeport N° ${tenantCniDisplay}`, 108, 58.5);
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Il a été arrêté et convenu ce qui suit :', 15, 65.0);

    // Helper d'impression avec retour à la ligne automatique strict et respect des marges
    const printWrapped = (
      text: string,
      x: number,
      y: number,
      maxWidth: number = 178,
      lineHeight: number = 3.3
    ): number => {
      const lines: string[] = doc.splitTextToSize(text, maxWidth);
      lines.forEach((l, i) => {
        doc.text(l, x, y + i * lineHeight);
      });
      return y + Math.max(0, lines.length - 1) * lineHeight + 2.0;
    };

    let curY = 69.0;

    const addContinuationPage = (customSubtitle?: string) => {
      doc.addPage('a4', 'portrait');
      doc.setFont('helvetica', 'bold');
      if (isAgency) {
        doc.setFontSize(13);
        doc.setTextColor(29, 78, 216);
        doc.text(ownerName.toUpperCase(), 15, 17);
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('AGENCE IMMOBILIÈRE MANDATAIRE AGRÉÉE', 15, 21.5);
      } else {
        doc.setFontSize(15);
        doc.setTextColor(29, 78, 216);
        doc.text('LocaTrust', 15, 17);
        doc.setFontSize(7.5);
        doc.setTextColor(217, 119, 6);
        doc.text(isProfessional ? '— CONTRAT PROFESSIONNEL OHADA —' : '— GESTION LOCATIVE CONFORME —', 15, 21.5);
      }

      doc.setFillColor(245, 158, 11);
      doc.roundedRect(115, 12.5, 80, 6.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(customSubtitle || `SUITE CONTRAT N° ${contractNumber}`, 155, 16.8, { align: 'center' });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 25, 195, 25);
      curY = 31;
    };

    const ensureSpace = (neededHeight: number, customSubtitle?: string) => {
      if (curY + neededHeight > 281) {
        addContinuationPage(customSubtitle);
      }
    };

    // Parties réelles et désignations dynamiques (Point 4)
    const cleanOwnerName = (ownerName || '').trim() || (isAgency ? 'L\'agence mandataire' : 'Le bailleur');
    const cleanTenantName = (tenantName || '').trim() || 'Le preneur';

    // Caractéristiques réelles du bien sans invention de données (Point 5)
    const surfaceText = surface && Number(surface) > 0
      ? `${surface} m²`
      : 'Information non renseignée';

    const roomParts: string[] = [];
    if (rooms && Number(rooms) > 0) roomParts.push(`${rooms} pièce(s)`);
    if (bedrooms && Number(bedrooms) > 0) roomParts.push(`${bedrooms} chambre(s)`);
    if (bathrooms && Number(bathrooms) > 0) roomParts.push(`${bathrooms} salle(s) d'eau`);
    const roomsCompositionText = roomParts.length > 0 ? roomParts.join(' • ') : 'Information non renseignée';

    let equipmentsRealText = '';
    if (Array.isArray(rawEquipments)) {
      const validEq = rawEquipments.filter((e) => typeof e === 'string' && e.trim().length > 0);
      if (validEq.length > 0) equipmentsRealText = validEq.join(', ');
    } else if (typeof rawEquipments === 'string' && rawEquipments.trim().length > 0) {
      equipmentsRealText = rawEquipments.trim();
    }

    // Durée contractuelle réelle dynamique (Point 6)
    const effectiveDurationMonths = data.durationMonths && Number(data.durationMonths) > 0
      ? Number(data.durationMonths)
      : (isProfessional ? 24 : 12);

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
      doc.text('ARTICLE 1 : DÉSIGNATION DU LOCAL & CONSISTANCE RÉELLE (OHADA AUDCG)', 15, curY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(51, 65, 85);
      const article1ProIntro = `M./Mme ${cleanOwnerName}, ci-après dénommé(e) « le Bailleur », donne en location à M./Mme ${cleanTenantName}, ci-après dénommé(e) « le Preneur », qui accepte, le bien immobilier désigné ci-après :`;
      curY = printWrapped(article1ProIntro, 15, curY + 3.5, 178, 3.2);

      const proBullets: string[] = [
        `• Type & Localisation : ${propertyTitle} | ${propertyAddress}`,
        `• Consistance réelle : Superficie exploitable : ${surfaceText} | Agencement : ${roomsCompositionText}`
      ];
      if (equipmentsRealText) {
        proBullets.push(`• Équipements déclarés : ${equipmentsRealText}`);
      }
      proBullets.push(`• Activité contractuelle autorisée (Art. 101/103 AUDCG) : ${authorizedActivity || 'Bureaux administratifs, commerciaux et exploitation'}.`);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      const wrappedProBullets = proBullets.map((b) => doc.splitTextToSize(b, 172));
      const totalProBulletLines = wrappedProBullets.reduce((acc, lines) => acc + lines.length, 0);
      const proCardHeight = totalProBulletLines * 3.5 + 3.2;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, curY, 180, proCardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(30, 41, 59);
      let bY = curY + 3.8;
      wrappedProBullets.forEach((lines) => {
        lines.forEach((l: string, idx: number) => {
          doc.text(l, idx === 0 ? 18 : 21, bY);
          bY += 3.5;
        });
      });
      curY += proCardHeight + 4.0;

      // ARTICLE 2 : DURÉE DU BAIL COMMERCIAL (Art. 104 AUDCG)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 2 : DURÉE DU BAIL COMMERCIAL (ART. 104 AUDCG)', 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(51, 65, 85);
      const article2ProText = `Le bail est conclu pour une durée ferme de ${effectiveDurationMonths} mois, prenant effet le ${startDate}. Il est régi par les stipulations de l'Article 104 de l'AUDCG.`;
      curY = printWrapped(article2ProText, 15, curY + 3.5, 178, 3.2) + 1.5;

      // ARTICLES 3, 4, 5 : CONDITIONS FINANCIÈRES COMMERCIALES (OHADA Art. 116)
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, curY, 180, 11.2, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 3 : LOYER COMMERCIAL (ART. 116 AUDCG)', 18, curY + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`Payable d'avance le ${dueDay < 10 ? '0' + dueDay : dueDay} de chaque mois par Virement ou Mobile Money certifié.`, 18, curY + 8.6);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(148, curY + 1.8, 44, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(rent), 170, curY + 6.8, { align: 'center' });
      curY += 12.8;

      // Article 4 : Dépôt de garantie commercial
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, curY, 180, 11.2, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 4 : DÉPÔT DE GARANTIE COMMERCIAL', 18, curY + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`Garantie commerciale convenue (${cautionMonths} mois) en couverture des obligations locatives.`, 18, curY + 8.6);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(148, curY + 1.8, 44, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(effectiveCautionAmount), 170, curY + 6.8, { align: 'center' });
      curY += 12.8;

      // Article 5 : Charges d'exploitation
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, curY, 180, 11.2, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(chargesAmount > 0 ? 'ARTICLE 5 : PROVISION SUR CHARGES D\'EXPLOITATION' : 'ARTICLE 5 : CHARGES D\'EXPLOITATION', 18, curY + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(
        chargesAmount > 0
          ? `Provision mensuelle sur charges : ${formatFCFA(chargesAmount)} (communs, gardiennage, entretien).`
          : 'Aucune provision sur charges exigée.',
        18,
        curY + 8.6
      );
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(148, curY + 1.8, 44, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(chargesAmount > 0 ? 8 : 6.8);
      doc.setTextColor(180, 83, 9);
      doc.text(chargesAmount > 0 ? `${formatFCFA(chargesAmount)} / mois` : 'Aucune provision', 170, curY + 6.8, { align: 'center' });
      curY += 13.8;

      // ARTICLES 6 & 7 : OBLIGATIONS ET RÉPARATIONS COMMERCIALES (2 COLONNES)
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, curY, 87, 34.5, 2, 2, 'FD');
      doc.roundedRect(108, curY, 87, 34.5, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 6 : OBLIGATIONS DU PRENEUR (ART. 112)', 18, curY + 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);
      doc.setTextColor(51, 65, 85);
      doc.text('• Exploiter conformément à l\'activité convenue.', 18, curY + 9.3);
      doc.text('• Assumer l\'entretien et réparations d\'usage.', 18, curY + 13.8);
      doc.text('• Détenir les autorisations administratives/RCCM.', 18, curY + 18.3);
      doc.text('• Sous-location soumise à accord écrit (Art. 118).', 18, curY + 22.8);
      doc.text('• Souscrire une assurance responsabilité civile.', 18, curY + 27.3);
      doc.text('• Restituer les locaux en état conforme au bail.', 18, curY + 31.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 7 : OBLIGATIONS DU BAILLEUR (ART. 106)', 111, curY + 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);
      doc.setTextColor(51, 65, 85);
      doc.text('• Délivrer les locaux en bon état commercial.', 111, curY + 9.3);
      doc.text('• Assurer la jouissance paisible des locaux.', 111, curY + 13.8);
      doc.text('• Grosses réparations (toiture, murs, structure).', 111, curY + 18.3);
      doc.text('• Ne pas entraver l\'exploitation normale.', 111, curY + 22.8);
      doc.text('• Délivrer les quittances régulières certifiées.', 111, curY + 27.3);
      doc.text('• Respecter le droit au renouvellement (Art. 123).', 111, curY + 31.8);
      curY += 38.5;

      // ARTICLES 8 & 9 : RENOUVELLEMENT, RÉSILIATION ET EXPULSION PROFESSIONNELLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 8 : DROIT AU RENOUVELLEMENT D\'ORDRE PUBLIC (ART. 123 & 134 AUDCG)', 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      const art8ProText = 'Le droit au renouvellement est acquis au preneur justifiant d\'au moins 2 ans d\'exploitation conforme. Aucune clause contractuelle ne peut déroger à cette disposition d\'ordre public (Art. 134).';
      curY = printWrapped(art8ProText, 15, curY + 3.4, 178, 3.1) + 1.5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 9 : RÉSILIATION JUDICIAIRE & EXPULSION (ART. 133 AUDCG & LOI 2025-221 ART. 14)', 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      const art9ProText = 'Toute résiliation requiert une mise en demeure d\'au moins 1 mois (Art. 133). Expulsion soumise à l\'Article 14 de la Loi ivoirienne N° 2025-221 (ministère exclusif d\'un Commissaire de Justice sur titre exécutoire, voies de fait et expulsions de fait prohibées).';
      curY = printWrapped(art9ProText, 15, curY + 3.4, 178, 3.1) + 1.5;
    } else {
      // ----------------------------------------------------------------------
      // MODEL 1 : BAIL À USAGE D'HABITATION (LOI 2019-576 & LOI 2025-221)
      // ----------------------------------------------------------------------
      // ARTICLE 1 : DÉSIGNATION DU BIEN
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 1 : DÉSIGNATION DU BIEN & CONSISTANCE RÉELLE (LOI N° 2019-576)', 15, curY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(51, 65, 85);
      const article1HabIntro = `M./Mme ${cleanOwnerName}, ci-après dénommé(e) « le Bailleur », donne en location à M./Mme ${cleanTenantName}, ci-après dénommé(e) « le Preneur », qui accepte, le bien immobilier désigné ci-après :`;
      curY = printWrapped(article1HabIntro, 15, curY + 3.5, 178, 3.2);

      const surfaceHabText = surface ? `${surface} m²` : 'Information non renseignée';
      const roomsHabList = [
        rooms ? `${rooms} pièce(s)` : null,
        bedrooms ? `${bedrooms} chambre(s)` : null,
        bathrooms ? `${bathrooms} salle(s) d'eau` : null
      ].filter(Boolean).join(' • ');

      const habBullets: string[] = [
        `• Type & Localisation : ${propertyTitle} | ${propertyAddress}`,
        `• Consistance réelle : Surface habitable : ${surfaceHabText} | Composition : ${roomsHabList || 'Information non renseignée'}`
      ];
      if (equipmentsRealText) {
        habBullets.push(`• Équipements déclarés : ${equipmentsRealText}`);
      }
      habBullets.push('• Destination exclusive : Logement d\'habitation principale (Art. 409 & 410 Loi 2019-576). Exploitation commerciale prohibée.');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      const wrappedHabBullets = habBullets.map((b) => doc.splitTextToSize(b, 172));
      const totalHabBulletLines = wrappedHabBullets.reduce((acc, lines) => acc + lines.length, 0);
      const habCardHeight = totalHabBulletLines * 3.5 + 3.2;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, curY, 180, habCardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(30, 41, 59);
      let bY = curY + 3.8;
      wrappedHabBullets.forEach((lines) => {
        lines.forEach((l: string, idx: number) => {
          doc.text(l, idx === 0 ? 18 : 21, bY);
          bY += 3.5;
        });
      });
      curY += habCardHeight + 4.0;

      // ARTICLE 2 : DURÉE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 2 : DURÉE DU BAIL D\'HABITATION (ART. 414)', 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(51, 65, 85);
      const article2HabText = `Le présent contrat est conclu pour une durée de ${effectiveDurationMonths} mois, commençant le ${startDate}, renouvelable tacitement par période de même durée.`;
      curY = printWrapped(article2HabText, 15, curY + 3.5, 178, 3.2) + 1.5;

      // ARTICLES 3, 4, 5 : CONDITIONS FINANCIÈRES (LOI 2019-576 ART. 415 & 416)
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, curY, 180, 11.2, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 3 : LOYER & AVANCE LÉGALEMENT PLAFONNÉE (ART. 415)', 18, curY + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Payable d'avance le ${dueDay < 10 ? '0' + dueDay : dueDay} du mois. Avance plafonnée à 2 mois maximum par la loi.`,
        18,
        curY + 8.6
      );
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(148, curY + 1.8, 44, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(rent), 170, curY + 6.8, { align: 'center' });
      curY += 12.8;

      // Article 4 : Caution
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, curY, 180, 11.2, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ARTICLE 4 : DÉPÔT DE GARANTIE PLAFONNÉ À 2 MOIS (ART. 416)', 18, curY + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(
        'Dépôt de garantie plafonné à 2 mois hors charges. Restitution sous 30 jours après remise des clés.',
        18,
        curY + 8.6
      );
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(148, curY + 1.8, 44, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(formatFCFA(effectiveCautionAmount), 170, curY + 6.8, { align: 'center' });
      curY += 12.8;

      // Article 5 : Charges
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, curY, 180, 11.2, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(chargesAmount > 0 ? 'ARTICLE 5 : PROVISION SUR CHARGES LOCATIVES D\'USAGE (ART. 417)' : 'ARTICLE 5 : CHARGES (AUCUNE PROVISION EXIGÉE)', 18, curY + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(chargesAmount > 0 ? 'Eau, électricité des communs et ordures ménagères. Impôts fonciers au bailleur.' : 'Aucune provision sur charges (compteurs individuels directs CIE/SODECI).', 18, curY + 8.6);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(148, curY + 1.8, 44, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(chargesAmount > 0 ? 8 : 6.8);
      doc.setTextColor(180, 83, 9);
      doc.text(chargesAmount > 0 ? `${formatFCFA(chargesAmount)} / mois` : 'Aucune provision', 170, curY + 6.8, { align: 'center' });
      curY += 13.8;

      // ARTICLE 6 & 7 : OBLIGATIONS (2 COLONNES)
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, curY, 87, 34.5, 2, 2, 'FD');
      doc.roundedRect(108, curY, 87, 34.5, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 6 : OBLIGATIONS DU LOCATAIRE (ART. 435)', 18, curY + 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);
      doc.setTextColor(51, 65, 85);
      doc.text('• Payer le loyer et charges aux dates convenues.', 18, curY + 9.3);
      doc.text('• User paisiblement des lieux en bon père de famille.', 18, curY + 13.8);
      doc.text('• Assumer l\'entretien courant et menues réparations.', 18, curY + 18.3);
      doc.text('• Ne pas transformer sans accord écrit (Art. 436).', 18, curY + 22.8);
      doc.text('• Sous-location prohibée sans accord écrit (Art. 437).', 18, curY + 27.3);
      doc.text('• Restituer le bien conforme à l\'état des lieux.', 18, curY + 31.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 7 : OBLIGATIONS DU BAILLEUR (ART. 424)', 111, curY + 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);
      doc.setTextColor(51, 65, 85);
      doc.text('• Délivrer un logement décent en bon état (Art. 424).', 111, curY + 9.3);
      doc.text('• Assurer la jouissance paisible des lieux (Art. 425).', 111, curY + 13.8);
      doc.text('• Grosses réparations et toiture à charge (Art. 428).', 111, curY + 18.3);
      doc.text('• Visite annuelle avec préavis écrit de 48h (Art. 430).', 111, curY + 22.8);
      doc.text('• Délivrer gratuitement les quittances (Art. 418).', 111, curY + 27.3);
      doc.text('• Restituer la caution sous 30 jours après clés.', 111, curY + 31.8);
      curY += 38.5;

      // ARTICLE 8 : ÉTAT DES LIEUX & FORMALITÉ FISCALE DGI OBLIGATOIRE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 8 : ÉTAT DES LIEUX CONTRADICTOIRE & ENREGISTREMENT FISCAL DGI OBLIGATOIRE (ART. 414 & 416)', 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      const art8HabText = 'État des lieux contradictoire écrit obligatoire à l\'entrée et à la sortie (Art. 416). Enregistrement fiscal obligatoire à la Direction Générale des Impôts (DGI) conformément à l\'Article 414 de la Loi 2019-576.';
      curY = printWrapped(art8HabText, 15, curY + 3.4, 178, 3.1) + 1.5;

      // ARTICLE 9 : RÉSILIATION ET EXPULSION LÉGALE (LOI 2019-576 & LOI 2025-221)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 78, 216);
      doc.text('ARTICLE 9 : RÉSILIATION & PROCÉDURE LÉGALE D\'EXPULSION (LOI N° 2025-221 & ART. 450)', 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      const art9HabText = 'Résiliation après mise en demeure (Art. 450). Expulsion strictement encadrée par la Loi n° 2025-221 du 28 mars 2025 (commandement de libérer les lieux et intervention exclusive du Commissaire de Justice sur titre exécutoire, voies de fait et expulsions de fait prohibées).';
      curY = printWrapped(art9HabText, 15, curY + 3.4, 178, 3.1) + 1.5;
    }

    // Résolution des signatures certifiées apposées sur ce contrat spécifique
    const resolvedOwnerSig = await ensureImageDataUrl(data.ownerSignatureUrl);
    const resolvedTenantSig = await ensureImageDataUrl(data.tenantSignatureUrl);

    const getImgFormat = (dataUrl?: string | null) => {
      if (!dataUrl) return 'PNG';
      if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG';
      if (dataUrl.includes('image/webp')) return 'WEBP';
      return 'PNG';
    };

    // Fonction d'impression du bloc des signatures + Sceau officiel rond sur la Page 1
    const renderSignaturesAndSealBlock = (startY: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, startY, 85, 29, 2, 2, 'FD');
      doc.roundedRect(105, startY, 85, 29, 2, 2, 'FD');

      // 1. Bailleur
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(isAgency ? 'LA SOCIÉTÉ IMMOBILIÈRE' : 'LE PROPRIÉTAIRE (BAILLEUR)', 18, startY + 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.text(ownerName, 18, startY + 9.0);

      if (resolvedOwnerSig) {
        try {
          doc.addImage(resolvedOwnerSig, getImgFormat(resolvedOwnerSig), 18, startY + 10.0, 48, 11.5);
        } catch (err) {
          console.warn('Could not render owner signature image on PDF:', err);
          doc.setFont('times', 'italic');
          doc.setFontSize(11);
          doc.setTextColor(15, 39, 90);
          doc.text(ownerName, 20, startY + 17.5);
        }
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(15, 39, 90);
        doc.text(ownerName, 20, startY + 17.5);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(5, 150, 105);
      doc.text('Signature electronique certifiee LocaTrust', 21, startY + 26.0);
      doc.setFillColor(5, 150, 105);
      doc.circle(18.5, startY + 25.0, 1.2, 'F');

      // 2. Locataire
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('LE LOCATAIRE (PRENEUR)', 108, startY + 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.text(tenantName, 108, startY + 9.0);

      if (resolvedTenantSig) {
        try {
          doc.addImage(resolvedTenantSig, getImgFormat(resolvedTenantSig), 108, startY + 10.0, 48, 11.5);
        } catch (err) {
          console.warn('Could not render tenant signature image on PDF:', err);
          doc.setFont('times', 'italic');
          doc.setFontSize(11);
          doc.setTextColor(30, 58, 138);
          doc.text(tenantName, 110, startY + 17.5);
        }
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(tenantName, 110, startY + 17.5);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(5, 150, 105);
      doc.text('Signature electronique certifiee LocaTrust', 111, startY + 26.0);
      doc.setFillColor(5, 150, 105);
      doc.circle(108.5, startY + 25.0, 1.2, 'F');

      // Sceau circulaire officiel type tampon de certification LocaTrust
      const sealCenterX = 105;
      const sealCenterY = startY + 46.5;

      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.85);
      doc.circle(sealCenterX, sealCenterY, 16.5, 'S');

      doc.setLineWidth(0.35);
      doc.circle(sealCenterX, sealCenterY, 14.6, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.0);
      doc.setTextColor(180, 83, 9);
      doc.text('RÉPUBLIQUE DE CÔTE D\'IVOIRE', sealCenterX, sealCenterY - 9.0, { align: 'center' });

      doc.setFontSize(4.8);
      doc.setTextColor(217, 119, 6);
      doc.text('★   ★   ★', sealCenterX, sealCenterY - 5.8, { align: 'center' });

      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      doc.text('LOCATRUST', sealCenterX, sealCenterY - 1.0, { align: 'center' });

      doc.setFontSize(5.2);
      doc.setTextColor(180, 83, 9);
      doc.text(isProfessional ? 'BAIL PROFESSIONNEL AUDCG' : 'BAIL D\'HABITATION CONFORME', sealCenterX, sealCenterY + 3.2, { align: 'center' });

      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.text(isProfessional ? 'OHADA AUDCG & LOI N° 2025-221' : 'LOI N° 2019-576 & LOI 2025-221', sealCenterX, sealCenterY + 6.8, { align: 'center' });

      doc.setFontSize(4.6);
      doc.setTextColor(180, 83, 9);
      doc.text(isProfessional ? 'COMMERCE • SÉCURITÉ JURIDIQUE' : 'ABIDJAN • SÉCURITÉ JURIDIQUE', sealCenterX, sealCenterY + 10.5, { align: 'center' });
    };

    const sigBlockStartY = Math.min(Math.max(curY + 1.5, 211), 220);
    renderSignaturesAndSealBlock(sigBlockStartY);

    // Extraction, nettoyage et dédoublonnage des conditions particulières pour pagination (2 à 3 pages dynamiques)
    const parseRuleLines = (raw?: string | string[]): string[] => {
      if (!raw) return [];
      const lines = Array.isArray(raw) ? raw : raw.split('\n');
      const seen = new Set<string>();
      const result: string[] = [];
      for (const item of lines) {
        if (typeof item !== 'string') continue;
        const cleaned = item.trim().replace(/^[\d\-•*.)]+\s*/, '');
        if (!cleaned || cleaned.length < 3) continue;
        const norm = cleaned.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        result.push(cleaned);
      }
      return result;
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

    // ========================================================================
    // PAGES SUPPLÉMENTAIRES (2 À 3 PAGES) : ANNEXE OFFICIELLE — CONDITIONS PARTICULIÈRES
    // ========================================================================
    if (hasCustomClauses) {
      addContinuationPage(`ANNEXE OFFICIELLE N° ${contractNumber}`);

      // Titre de l'Annexe
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('ANNEXE CONTRACTUELLE : CONDITIONS PARTICULIÈRES & RÈGLEMENTS CONVENUS', 15, curY);

      // Sous-titre explicatif & cadre juridique
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.setTextColor(71, 85, 105);
      const subNotice = isProfessional
        ? 'Faisant partie intégrante et indissociable du Bail Professionnel souscrit en application de l\'Acte Uniforme OHADA (AUDCG). Les stipulations ci-dessous sont arrêtées de bonne foi et lient les parties contractantes.'
        : 'Faisant partie intégrante et indissociable du Bail d\'Habitation conclu sous l\'empire de la Loi n° 2019-576 et de la Loi n° 2025-221. Les clauses particulières ci-dessous ont été convenues d\'un commun accord entre les parties.';
      curY = printWrapped(subNotice, 15, curY + 5, 180, 4.0) + 4;

      // Helper pour dessiner une section de règles avec saut de page automatique (supporte 2 à 3 pages sans écraser les écritures)
      const renderRulesSection = (
        title: string,
        rules: string[],
        badgeLabel: string,
        headerColor: [number, number, number] = [29, 78, 216]
      ) => {
        if (rules.length === 0) return;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        let totalLinesCount = 0;
        const parsedLines: string[][] = [];

        rules.forEach((rule) => {
          const cleanRule = rule.replace(/^\d+[\.\)\-]\s*/, '').trim();
          const wrapped = doc.splitTextToSize(`•  ${cleanRule}`, 170);
          parsedLines.push(wrapped);
          totalLinesCount += wrapped.length;
        });

        const sectionPadding = 8;
        const headerHeight = 8;
        const lineHeight = 4.6;
        const contentHeight = totalLinesCount * lineHeight;
        const boxHeight = headerHeight + contentHeight + sectionPadding;

        if (curY + boxHeight > 265) {
          addContinuationPage(`ANNEXE OFFICIELLE N° ${contractNumber}`);
        }

        // Dessin du container carte
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, curY, 180, boxHeight, 2, 2, 'FD');

        // Bandeau d'en-tête de la section (écriture en bleu conservée à 7.5pt)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
        doc.text(title, 20, curY + 6);

        // Badge à droite
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(badgeLabel, 190, curY + 6, { align: 'right' });

        // Ligne fine sous l'en-tête
        doc.setDrawColor(241, 245, 249);
        doc.line(20, curY + 8.2, 190, curY + 8.2);

        // Contenu des règles (taille augmentée à 8.2pt)
        let textY = curY + 13.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(30, 41, 59);

        parsedLines.forEach((lines) => {
          lines.forEach((lineText, idx) => {
            doc.text(lineText, idx === 0 ? 20 : 23, textY);
            textY += lineHeight;
          });
        });

        curY += boxHeight + 5;
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

      // Zone des Signatures et Paraphes en bas de l'Annexe (avec saut vers Page 3 si nécessaire)
      if (curY + 42 > 268) {
        addContinuationPage(`ANNEXE OFFICIELLE N° ${contractNumber}`);
      }
      const sigY = Math.max(curY + 4, 215);

      // Boîte gauche : Bailleur
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, sigY, 85, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(isAgency ? 'POUR LA SOCIÉTÉ IMMOBILIÈRE' : 'POUR LE BAILLEUR (PROPRIÉTAIRE)', 18, sigY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text('Mention : « Lu et approuvé sans réserve »', 18, sigY + 9.2);

      if (resolvedOwnerSig) {
        try {
          doc.addImage(resolvedOwnerSig, getImgFormat(resolvedOwnerSig), 18, sigY + 10.5, 45, 11);
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
      doc.setFontSize(6.2);
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
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text('Mention : « Lu et approuvé sans réserve »', 108, sigY + 9.2);

      if (resolvedTenantSig) {
        try {
          doc.addImage(resolvedTenantSig, getImgFormat(resolvedTenantSig), 108, sigY + 10.5, 45, 11);
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
      doc.setFontSize(6.2);
      doc.setTextColor(5, 150, 105);
      doc.text('Paraphe & Signature électronique certifiée', 111, sigY + 26);
      doc.setFillColor(5, 150, 105);
      doc.circle(108.5, sigY + 25.2, 1, 'F');

      // Tampon de conformité Annexe
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(180, 83, 9);
      doc.text('DOCUMENT OFFICIEL ET SCELLÉ NUMÉRIQUEMENT PAR LOCATRUST', 105, sigY + 34.5, { align: 'center' });
    }

    // Pagination dynamique sur l'ensemble des pages générées (1, 2 ou 3 pages)
    const finalTotalPages = doc.getNumberOfPages();
    for (let p = 1; p <= finalTotalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${p} / ${finalTotalPages} • LocaTrust Certifié — Contrat de bail officiel N° ${contractNumber}`,
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
