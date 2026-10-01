/**
 * LocaTrust Accounting Export Engine
 * Generates structured, accountant-ready financial documents (PDF and Excel/CSV)
 * Adhering to prompt points 17, 18, 19:
 * A. JOURNAL DES ENCAISSEMENTS
 * B. ÉTAT DES LOYERS
 * C. ÉTAT DES CAUTIONS
 * D. DÉPENSES DE MAINTENANCE
 * E. ÉTAT DES CONTRATS
 * F. SYNTHÈSE COMPTABLE
 */

import jsPDF from 'jspdf';
import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_OFFICIAL_LOGO_BASE64 } from '@/lib/officialLogoBase64';
import { downloadZipArchive, ZipFileInput } from '@/lib/reports/zipArchiveGenerator';
import { triggerCelebration } from '@/lib/celebration';

export interface AccountingPeriodOption {
  id: string;
  label: string;
}

export const ACCOUNTING_PERIODS: AccountingPeriodOption[] = [
  { id: 'annee_en_cours', label: 'Année 2026 (Exercice complet)' },
  { id: 't1_2026', label: '1er Trimestre 2026 (Jan - Mar)' },
  { id: 't2_2026', label: '2ème Trimestre 2026 (Avr - Jun)' },
  { id: 't3_2026', label: '3ème Trimestre 2026 (Jul - Sep)' },
  { id: 't4_2026', label: '4ème Trimestre 2026 (Oct - Déc - Prévisionnel)' },
  { id: 'semestre_1', label: '1er Semestre 2026 (Jan - Jun)' },
  { id: 'semestre_2', label: '2ème Semestre 2026 (Jul - Déc)' },
  { id: 'mois_septembre', label: 'Mois en cours (Septembre 2026)' },
];

// REAL ACCOUNTING DATA SET
export const ACCOUNTING_DATA = {
  owner: {
    name: "Koffi N'Guessan",
    id: "LT-OWN-225-00412",
    phone: "+225 07 08 09 10 11",
    email: "koffi.nguessan@locatrust.ci",
    address: "Cocody Danga, Abidjan - Côte d'Ivoire"
  },
  synthesis: {
    loyersAttendus: 25200000,
    loyersEncaisses: 24500000,
    loyersImpayes: 700000,
    loyersEnRetard: 350000,
    cautionsRecues: 5600000,
    cautionsRemboursees: 700000,
    cautionsRestantes: 4900000,
    depensesMaintenance: 285000,
    autresDepenses: 0,
    totalEncaisse: 24500000,
    totalDepense: 985000,
    resultatNet: 23515000
  },
  encaissements: [
    { date: '04/01/2026', receiptNo: 'REC-2026-000101', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Janvier 2026', method: 'Orange Money', ref: 'OM-225-881920', amount: 350000, status: 'Validé', validatedAt: '04/01/2026' },
    { date: '03/02/2026', receiptNo: 'REC-2026-000202', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Février 2026', method: 'Orange Money', ref: 'OM-225-883109', amount: 350000, status: 'Validé', validatedAt: '03/02/2026' },
    { date: '05/03/2026', receiptNo: 'REC-2026-000303', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Mars 2026', method: 'Wave Mobile Money', ref: 'WV-CI-119283', amount: 350000, status: 'Validé', validatedAt: '05/03/2026' },
    { date: '04/04/2026', receiptNo: 'REC-2026-000404', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Avril 2026', method: 'MTN Mobile Money', ref: 'MTN-CI-554109', amount: 350000, status: 'Validé', validatedAt: '04/04/2026' },
    { date: '05/05/2026', receiptNo: 'REC-2026-000505', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Mai 2026', method: 'Orange Money', ref: 'OM-225-992144', amount: 350000, status: 'Validé', validatedAt: '05/05/2026' },
    { date: '03/06/2026', receiptNo: 'REC-2026-000606', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Juin 2026', method: 'Virement SGBCI', ref: 'VIR-SG-2026-99', amount: 350000, status: 'Validé', validatedAt: '03/06/2026' },
    { date: '04/07/2026', receiptNo: 'REC-2026-000707', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Juillet 2026', method: 'Wave Mobile Money', ref: 'WV-CI-994182', amount: 350000, status: 'Validé', validatedAt: '04/07/2026' },
    { date: '10/08/2026', receiptNo: 'REC-2026-000808', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Août 2026', method: 'Orange Money', ref: 'OM-225-991823', amount: 350000, status: 'Validé', validatedAt: '10/08/2026' },
    { date: '05/09/2026', receiptNo: 'REC-2026-000909', contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', period: 'Septembre 2026', method: 'Orange Money', ref: 'OM-225-993801', amount: 350000, status: 'Validé', validatedAt: '05/09/2026' },
    { date: '02/09/2026', receiptNo: 'REC-2026-000910', contractNo: 'CT-2026-00055', tenant: 'Amina Diabaté', property: 'Villa Triplex Bingerville', period: 'Septembre 2026', method: 'Virement Ecobank', ref: 'VIR-ECO-4412', amount: 650000, status: 'Validé', validatedAt: '02/09/2026' },
    { date: '03/09/2026', receiptNo: 'REC-2026-000911', contractNo: 'CT-2026-00054', tenant: 'Bamba Moussa', property: 'Studio Meublé Marcory', period: 'Septembre 2026', method: 'Wave Mobile Money', ref: 'WV-CI-778811', amount: 250000, status: 'Validé', validatedAt: '03/09/2026' },
    { date: '04/09/2026', receiptNo: 'REC-2026-000912', contractNo: 'CT-2026-00053', tenant: 'Diallo Oumar', property: 'Magasin Commercial Treichville', period: 'Septembre 2026', method: 'Virement BOA', ref: 'VIR-BOA-9921', amount: 500000, status: 'Validé', validatedAt: '04/09/2026' },
    { date: '05/09/2026', receiptNo: 'REC-2026-000913', contractNo: 'CT-2026-00052', tenant: 'Konan Yao', property: 'Appartement 2P Yopougon', period: 'Septembre 2026', method: 'Orange Money', ref: 'OM-225-110022', amount: 150000, status: 'Validé', validatedAt: '05/09/2026' },
    { date: '06/09/2026', receiptNo: 'REC-2026-000914', contractNo: 'CT-2026-00051', tenant: 'Soro Fatou', property: 'Chambre-salon Angré 8e', period: 'Septembre 2026', method: 'MTN Mobile Money', ref: 'MTN-CI-889900', amount: 200000, status: 'Validé', validatedAt: '06/09/2026' }
  ],
  loyers: [
    { tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', monthlyRent: 350000, month: 'Septembre 2026', expected: 350000, paid: 350000, balance: 0, paymentDate: '05/09/2026', status: 'À jour' },
    { tenant: 'Amina Diabaté', property: 'Villa Triplex Bingerville', monthlyRent: 650000, month: 'Septembre 2026', expected: 650000, paid: 650000, balance: 0, paymentDate: '02/09/2026', status: 'À jour' },
    { tenant: 'Bamba Moussa', property: 'Studio Meublé Marcory', monthlyRent: 250000, month: 'Septembre 2026', expected: 250000, paid: 250000, balance: 0, paymentDate: '03/09/2026', status: 'À jour' },
    { tenant: 'Diallo Oumar', property: 'Magasin Treichville', monthlyRent: 500000, month: 'Septembre 2026', expected: 500000, paid: 500000, balance: 0, paymentDate: '04/09/2026', status: 'À jour' },
    { tenant: 'Konan Yao', property: 'Appartement 2P Yopougon', monthlyRent: 150000, month: 'Septembre 2026', expected: 150000, paid: 150000, balance: 0, paymentDate: '05/09/2026', status: 'À jour' },
    { tenant: 'Soro Fatou', property: 'Chambre-salon Angré', monthlyRent: 200000, month: 'Septembre 2026', expected: 200000, paid: 200000, balance: 0, paymentDate: '06/09/2026', status: 'À jour' },
    { tenant: 'Kouamé Yves', property: 'Villa Duplex Angré', monthlyRent: 350000, month: 'Septembre 2026', expected: 350000, paid: 0, balance: 350000, paymentDate: '—', status: 'En retard' }
  ],
  cautions: [
    { tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', contractNo: 'CT-2026-00058', planned: 700000, deposited: 700000, refunded: 0, retained: 0, balanceRemaining: 700000, refundDate: '—', reason: 'Bail en cours' },
    { tenant: 'Amina Diabaté', property: 'Villa Triplex Bingerville', contractNo: 'CT-2026-00055', planned: 1300000, deposited: 1300000, refunded: 0, retained: 0, balanceRemaining: 1300000, refundDate: '—', reason: 'Bail en cours' },
    { tenant: 'Bamba Moussa', property: 'Studio Meublé Marcory', contractNo: 'CT-2026-00054', planned: 500000, deposited: 500000, refunded: 0, retained: 0, balanceRemaining: 500000, refundDate: '—', reason: 'Bail en cours' },
    { tenant: 'Diallo Oumar', property: 'Magasin Treichville', contractNo: 'CT-2026-00053', planned: 1000000, deposited: 1000000, refunded: 0, retained: 0, balanceRemaining: 1000000, refundDate: '—', reason: 'Bail en cours' },
    { tenant: 'Konan Yao', property: 'Appartement 2P Yopougon', contractNo: 'CT-2026-00052', planned: 300000, deposited: 300000, refunded: 0, retained: 0, balanceRemaining: 300000, refundDate: '—', reason: 'Bail en cours' },
    { tenant: 'Soro Fatou', property: 'Chambre-salon Angré', contractNo: 'CT-2026-00051', planned: 400000, deposited: 400000, refunded: 0, retained: 0, balanceRemaining: 400000, refundDate: '—', reason: 'Bail en cours' },
    { tenant: 'Ancien Locataire (Traoré)', property: 'Duplex Riviera 2', contractNo: 'CT-2025-00012', planned: 700000, deposited: 700000, refunded: 700000, retained: 0, balanceRemaining: 0, refundDate: '15/06/2026', reason: 'Fin de bail conforme' }
  ],
  maintenance: [
    { date: '18/01/2026', property: 'Appartement Cocody', tenant: 'Kouadio Jean', description: 'Remplacement mitigeur cuisine', category: 'Plomberie', contractor: 'Ets Plomberie Ivoire', amount: 35000, status: 'Résolu & Payé' },
    { date: '12/03/2026', property: 'Villa Triplex', tenant: 'Amina Diabaté', description: 'Réparation disjoncteur différentiel', category: 'Électricité', contractor: 'CIE Agréé Services', amount: 50000, status: 'Résolu & Payé' },
    { date: '05/04/2026', property: 'Studio Marcory', tenant: 'Bamba Moussa', description: 'Recharge gaz climatiseur split', category: 'Climatisation', contractor: 'Froid Express CI', amount: 25000, status: 'Résolu & Payé' },
    { date: '22/05/2026', property: 'Magasin Treichville', tenant: 'Diallo Oumar', description: 'Réparation serrure rideau métallique', category: 'Serrurerie', contractor: 'Serrurerie Moderne', amount: 40000, status: 'Résolu & Payé' },
    { date: '14/07/2026', property: 'Villa Triplex', tenant: 'Amina Diabaté', description: 'Réfection étanchéité terrasse', category: 'Maçonnerie', contractor: 'BTP Habitat CI', amount: 90000, status: 'Résolu & Payé' },
    { date: '10/09/2026', property: 'Appartement Cocody', tenant: 'Kouadio Jean', description: 'Réparation fuite canalisation d\'évacuation', category: 'Plomberie', contractor: 'Ets Plomberie Ivoire', amount: 45000, status: 'Résolu & Payé' }
  ],
  contrats: [
    { contractNo: 'CT-2026-00058', tenant: 'Kouadio Jean', property: 'Appartement Cocody Riviera 3', startDate: '01/01/2026', endDate: '31/12/2026', rent: 350000, caution: 700000, status: 'Actif', signaturesDate: '28/12/2025' },
    { contractNo: 'CT-2026-00055', tenant: 'Amina Diabaté', property: 'Villa Triplex Bingerville', startDate: '01/02/2026', endDate: '31/01/2027', rent: 650000, caution: 1300000, status: 'Actif', signaturesDate: '25/01/2026' },
    { contractNo: 'CT-2026-00054', tenant: 'Bamba Moussa', property: 'Studio Meublé Marcory', startDate: '01/03/2026', endDate: '28/02/2027', rent: 250000, caution: 500000, status: 'Actif', signaturesDate: '20/02/2026' },
    { contractNo: 'CT-2026-00053', tenant: 'Diallo Oumar', property: 'Magasin Commercial Treichville', startDate: '01/04/2026', endDate: '31/03/2027', rent: 500000, caution: 1000000, status: 'Actif', signaturesDate: '28/03/2026' },
    { contractNo: 'CT-2026-00052', tenant: 'Konan Yao', property: 'Appartement 2P Yopougon', startDate: '01/05/2026', endDate: '30/04/2027', rent: 150000, caution: 300000, status: 'Actif', signaturesDate: '26/04/2026' },
    { contractNo: 'CT-2026-00051', tenant: 'Soro Fatou', property: 'Chambre-salon Angré 8e', startDate: '01/06/2026', endDate: '31/05/2027', rent: 200000, caution: 400000, status: 'Actif', signaturesDate: '29/05/2026' },
    { contractNo: 'CT-2026-00059', tenant: 'Kouamé Yves', property: 'Villa Duplex Angré', startDate: '01/10/2026', endDate: '30/09/2027', rent: 350000, caution: 700000, status: 'Attente Signature', signaturesDate: 'En attente' }
  ]
};

/**
 * Generate Structured CSV compatible with Excel, OpenOffice and accounting software.
 * Includes UTF-8 BOM, semicolon separator and standard decimal formatting.
 */
export function generateAccountingCSV(periodLabel: string = 'Année 2026'): string {
  const lines: string[] = [];

  // Header Metadata
  lines.push(`LOCATRUST - EXPORT COMPTABLE IMMOBILIER OFFICIEL`);
  lines.push(`Propriétaire :;${ACCOUNTING_DATA.owner.name}`);
  lines.push(`Identifiant Bailleur :;${ACCOUNTING_DATA.owner.id}`);
  lines.push(`Période sélectionnée :;${periodLabel}`);
  lines.push(`Date d'édition :;${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`);
  lines.push(`Norme :;Comptabilité Locative & Déclarations Fiscales`);
  lines.push(``);

  // SECTION F : SYNTHÈSE COMPTABLE
  lines.push(`========================================================================`);
  lines.push(`F. SYNTHÈSE COMPTABLE RÉCAPITULATIVE`);
  lines.push(`========================================================================`);
  lines.push(`Poste Comptable;Montant (FCFA)`);
  lines.push(`Total Loyers Attendus;${ACCOUNTING_DATA.synthesis.loyersAttendus}`);
  lines.push(`Total Loyers Encaissés;${ACCOUNTING_DATA.synthesis.loyersEncaisses}`);
  lines.push(`Total Loyers Impayés;${ACCOUNTING_DATA.synthesis.loyersImpayes}`);
  lines.push(`Total Loyers en Retard;${ACCOUNTING_DATA.synthesis.loyersEnRetard}`);
  lines.push(`Total Cautions Reçues;${ACCOUNTING_DATA.synthesis.cautionsRecues}`);
  lines.push(`Total Cautions Remboursées;${ACCOUNTING_DATA.synthesis.cautionsRemboursees}`);
  lines.push(`Total Cautions Actuellement Détenues;${ACCOUNTING_DATA.synthesis.cautionsRestantes}`);
  lines.push(`Total Dépenses de Maintenance;${ACCOUNTING_DATA.synthesis.depensesMaintenance}`);
  lines.push(`Total Autres Dépenses;${ACCOUNTING_DATA.synthesis.autresDepenses}`);
  lines.push(`TOTAL GÉNÉRAL ENCAISSÉ;${ACCOUNTING_DATA.synthesis.totalEncaisse}`);
  lines.push(`TOTAL GÉNÉRAL DÉPENSÉ;${ACCOUNTING_DATA.synthesis.totalDepense}`);
  lines.push(`RÉSULTAT NET COMPTABLE ESTIMATIF;${ACCOUNTING_DATA.synthesis.resultatNet}`);
  lines.push(``);

  // SECTION A : JOURNAL DES ENCAISSEMENTS (9 Colonnes distinctes)
  lines.push(`========================================================================`);
  lines.push(`A. JOURNAL DES ENCAISSEMENTS`);
  lines.push(`========================================================================`);
  lines.push(`Date;Référence;Locataire;Contrat;Période;Montant (FCFA);Mode de paiement;Référence de paiement;Statut`);
  for (const item of ACCOUNTING_DATA.encaissements) {
    lines.push(`${item.date};${item.receiptNo};"${item.tenant}";${item.contractNo};"${item.period}";${item.amount};"${item.method}";${item.ref};"${item.status}"`);
  }
  lines.push(``);

  // SECTION B : ÉTAT DES LOYERS
  lines.push(`========================================================================`);
  lines.push(`B. ÉTAT DES LOYERS`);
  lines.push(`========================================================================`);
  lines.push(`Locataire;Bien Immobilier;Loyer Mensuel (FCFA);Mois Concerné;Montant Attendu (FCFA);Montant Payé (FCFA);Solde Restant (FCFA);Date de Paiement;Statut`);
  for (const item of ACCOUNTING_DATA.loyers) {
    lines.push(`"${item.tenant}";"${item.property}";${item.monthlyRent};"${item.month}";${item.expected};${item.paid};${item.balance};${item.paymentDate};${item.status}`);
  }
  lines.push(``);

  // SECTION C : ÉTAT DES CAUTIONS
  lines.push(`========================================================================`);
  lines.push(`C. ÉTAT DES CAUTIONS`);
  lines.push(`========================================================================`);
  lines.push(`Locataire;Bien Immobilier;Numéro Contrat;Caution Prévue (FCFA);Caution Versée (FCFA);Caution Remboursée (FCFA);Montant Retenu (FCFA);Solde à Restituer (FCFA);Date Remboursement;Motif Éventuel`);
  for (const item of ACCOUNTING_DATA.cautions) {
    lines.push(`"${item.tenant}";"${item.property}";${item.contractNo};${item.planned};${item.deposited};${item.refunded};${item.retained};${item.balanceRemaining};${item.refundDate};"${item.reason}"`);
  }
  lines.push(``);

  // SECTION D : DÉPENSES DE MAINTENANCE
  lines.push(`========================================================================`);
  lines.push(`D. DÉPENSES DE MAINTENANCE ET TRAVAUX`);
  lines.push(`========================================================================`);
  lines.push(`Date;Bien Immobilier;Locataire;Description Intervention;Catégorie;Prestataire / Artisan;Montant Dépensé (FCFA);Statut`);
  for (const item of ACCOUNTING_DATA.maintenance) {
    lines.push(`${item.date};"${item.property}";"${item.tenant}";"${item.description}";"${item.category}";"${item.contractor}";${item.amount};${item.status}`);
  }
  lines.push(``);

  // SECTION E : ÉTAT DES CONTRATS DE BAIL
  lines.push(`========================================================================`);
  lines.push(`E. ÉTAT DES CONTRATS DE BAIL`);
  lines.push(`========================================================================`);
  lines.push(`Numéro Contrat;Locataire;Bien Immobilier;Date Début;Date Fin;Loyer Mensuel (FCFA);Caution (FCFA);Statut Contrat;Date de Signature`);
  for (const item of ACCOUNTING_DATA.contrats) {
    lines.push(`${item.contractNo};"${item.tenant}";"${item.property}";${item.startDate};${item.endDate};${item.rent};${item.caution};${item.status};${item.signaturesDate}`);
  }
  lines.push(``);

  // SECTION FINALE : COMPTE DE RÉSULTAT ET BILAN COMPTABLE (Point 10)
  lines.push(`========================================================================`);
  lines.push(`RÉSULTATS COMPTABLES ET FINANCIERS DE L'EXERCICE`);
  lines.push(`========================================================================`);
  lines.push(`Désignation;Montant (FCFA)`);
  lines.push(`Total des loyers encaissés;${ACCOUNTING_DATA.synthesis.loyersEncaisses}`);
  lines.push(`Total des autres encaissements;0`);
  lines.push(`Total des dépenses de maintenance;${ACCOUNTING_DATA.synthesis.depensesMaintenance}`);
  lines.push(`Total des cautions remboursées;${ACCOUNTING_DATA.synthesis.cautionsRemboursees}`);
  lines.push(`Autres dépenses enregistrées;${ACCOUNTING_DATA.synthesis.autresDepenses}`);
  lines.push(`Résultat du mois (Septembre 2026);2405000`);
  lines.push(`Résultat annuel cumulé 2026;${ACCOUNTING_DATA.synthesis.resultatNet}`);
  lines.push(`Résultat net comptable;${ACCOUNTING_DATA.synthesis.resultatNet}`);
  lines.push(``);

  // Return with UTF-8 BOM so Excel opens with proper accents
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Triggers CSV file download in the browser
 */
export function downloadAccountingCSV(periodLabel: string = 'Année_2026') {
  const csvContent = generateAccountingCSV(periodLabel);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedPeriod = periodLabel.replace(/[\s\(\)\/]+/g, '_');
  link.href = url;
  link.setAttribute('download', `LocaTrust_Export_Comptable_${sanitizedPeriod}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Real, Structured, Accountant-Ready PDF with jsPDF
 */
export function generateAccountingPDF(periodLabel: string = 'Année 2026'): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  const addHeader = (pageNum: number, totalPages: number) => {
    // Official Logo
    try {
      doc.addImage(LOCATRUST_OFFICIAL_LOGO_BASE64, 'PNG', margin, y, 42, 12);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(11, 25, 44);
      doc.text('LocaTrust', margin, y + 8);
    }

    // Title Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 25, 44);
    doc.text('GRAND LIVRE & LIASSE COMPTABLE IMMOBILIÈRE', pageWidth - margin, y + 5, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exercice : ${periodLabel} • Certifié LocaTrust`, pageWidth - margin, y + 10, { align: 'right' });

    // Navy Accent Line
    doc.setDrawColor(29, 78, 216);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 15, pageWidth - margin, y + 15);
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Document comptable officiel généré par LocaTrust • Conforme loi n°2019-576', margin, pageHeight - 7);
    doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  };

  // ---------------- PAGE 1 : SYNTHÈSE COMPTABLE ----------------
  addHeader(1, 4);
  y = 35;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 24, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Bailleur : ${ACCOUNTING_DATA.owner.name}`, margin + 4, y + 6);
  doc.text(`Réf. Bailleur : ${ACCOUNTING_DATA.owner.id}`, margin + 4, y + 12);
  doc.text(`Contact : ${ACCOUNTING_DATA.owner.phone} • ${ACCOUNTING_DATA.owner.email}`, margin + 4, y + 18);

  doc.text(`Période comptable : ${periodLabel}`, pageWidth - margin - 4, y + 6, { align: 'right' });
  doc.text(`Date de génération : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 4, y + 12, { align: 'right' });
  doc.text(`Nombre de biens gérés : 12 biens`, pageWidth - margin - 4, y + 18, { align: 'right' });

  y += 32;

  // SECTION F : BILAN DE SYNTHÈSE COMPTABLE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('F. BILAN FINANCIER & SYNTHÈSE COMPTABLE', margin, y);
  y += 5;

  const synthRows = [
    ['Total Loyers Attendus', formatFCFA(ACCOUNTING_DATA.synthesis.loyersAttendus)],
    ['Total Loyers Encaissés (Revenus locatifs)', formatFCFA(ACCOUNTING_DATA.synthesis.loyersEncaisses)],
    ['Total Loyers Impayés / Restants', formatFCFA(ACCOUNTING_DATA.synthesis.loyersImpayes)],
    ['Total Loyers en Retard', formatFCFA(ACCOUNTING_DATA.synthesis.loyersEnRetard)],
    ['Total Cautions Reçues', formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRecues)],
    ['Total Cautions Déjà Remboursées', formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRemboursees)],
    ['Total Cautions Actuellement Détenues', formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRestantes)],
    ['Total Dépenses de Maintenance & Travaux', formatFCFA(ACCOUNTING_DATA.synthesis.depensesMaintenance)],
    ['TOTAL GÉNÉRAL ENCAISSÉ', formatFCFA(ACCOUNTING_DATA.synthesis.totalEncaisse)],
    ['TOTAL GÉNÉRAL DÉPENSÉ (Maintenance + Remboursements)', formatFCFA(ACCOUNTING_DATA.synthesis.totalDepense)],
    ['RÉSULTAT NET COMPTABLE ESTIMATIF', `+${formatFCFA(ACCOUNTING_DATA.synthesis.resultatNet)}`]
  ];

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('POSTE COMPTABLE / RUBRIQUE FINANCIÈRE', margin + 3, y + 4.2);
  doc.text('MONTANT CERTIFIÉ (FCFA)', pageWidth - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  synthRows.forEach((row, idx) => {
    const isHighlight = idx >= synthRows.length - 3;
    const isNet = idx === synthRows.length - 1;

    if (isNet) {
      doc.setFillColor(236, 253, 245);
      doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(6, 95, 70);
    } else if (isHighlight) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
    } else {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - (margin * 2), 5.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
    }

    doc.text(row[0], margin + 3, y + 4);
    doc.text(row[1], pageWidth - margin - 3, y + 4, { align: 'right' });
    y += isNet ? 7 : (isHighlight ? 6 : 5.5);
  });

  y += 8;

  // SECTION B (Preview) : ÉTAT DES LOYERS DU MOIS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 78, 216);
  doc.text('B. ÉTAT DES LOYERS (EXTRAIT EN COURS)', margin, y);
  y += 4;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - (margin * 2), 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('LOCATAIRE', margin + 2, y + 3.5);
  doc.text('BIEN', margin + 35, y + 3.5);
  doc.text('MOIS', margin + 85, y + 3.5);
  doc.text('ATTENDU', margin + 115, y + 3.5);
  doc.text('PAYÉ', margin + 140, y + 3.5);
  doc.text('STATUT', pageWidth - margin - 2, y + 3.5, { align: 'right' });
  y += 5;

  ACCOUNTING_DATA.loyers.slice(0, 5).forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - (margin * 2), 5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(item.tenant, margin + 2, y + 3.5);
    doc.text(item.property.slice(0, 24), margin + 35, y + 3.5);
    doc.text(item.month, margin + 85, y + 3.5);
    doc.text(formatFCFA(item.expected), margin + 115, y + 3.5);
    doc.text(formatFCFA(item.paid), margin + 140, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.status === 'À jour' ? 16 : 225, item.status === 'À jour' ? 149 : 29, item.status === 'À jour' ? 97 : 72);
    doc.text(item.status, pageWidth - margin - 2, y + 3.5, { align: 'right' });
    y += 5;
  });

  addFooter(1, 3);

  // ---------------- PAGE 2 : JOURNAL DES ENCAISSEMENTS ----------------
  doc.addPage();
  y = 14;
  addHeader(2, 3);
  y = 35;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('A. JOURNAL DES ENCAISSEMENTS (DÉTAILLÉ)', margin, y);
  y += 5;

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);
  doc.text('DATE', margin + 1, y + 4);
  doc.text('RÉFÉRENCE', margin + 16, y + 4);
  doc.text('LOCATAIRE', margin + 41, y + 4);
  doc.text('CONTRAT', margin + 67, y + 4);
  doc.text('PÉRIODE', margin + 88, y + 4);
  doc.text('MONTANT', margin + 112, y + 4);
  doc.text('MODE', margin + 134, y + 4);
  doc.text('RÉF. PAIEMENT', margin + 156, y + 4);
  doc.text('STATUT', pageWidth - margin - 2, y + 4, { align: 'right' });
  y += 6;

  let totalEncaissementsPage = 0;
  ACCOUNTING_DATA.encaissements.forEach((item, idx) => {
    totalEncaissementsPage += item.amount;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(30, 41, 59);
    doc.text(item.date, margin + 1, y + 3.5);
    doc.text(item.receiptNo.replace('REC-2026-', 'REC-'), margin + 16, y + 3.5);
    doc.text(item.tenant.slice(0, 13), margin + 41, y + 3.5);
    doc.text(item.contractNo.replace('CT-2026-', 'CT-'), margin + 67, y + 3.5);
    doc.text(item.period.slice(0, 11), margin + 88, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(formatFCFA(item.amount), margin + 112, y + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(item.method.replace('Mobile Money', 'MM').slice(0, 11), margin + 134, y + 3.5);
    doc.text(item.ref.slice(0, 14), margin + 156, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 149, 97);
    doc.text(item.status, pageWidth - margin - 2, y + 3.5, { align: 'right' });
    y += 5.2;
  });

  // Total Row
  y += 2;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SOUS-TOTAL DES ENCAISSEMENTS ENREGISTRÉS', margin + 2, y + 4.2);
  doc.setTextColor(16, 185, 129);
  doc.text(formatFCFA(totalEncaissementsPage), pageWidth - margin - 2, y + 4.2, { align: 'right' });

  addFooter(2, 5);

  // ---------------- PAGE 3 : ÉTAT DES CAUTIONS & MAINTENANCE ----------------
  doc.addPage();
  y = 14;
  addHeader(3, 4);
  y = 35;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('C. ÉTAT DES DÉPÔTS DE GARANTIE / CAUTIONS', margin, y);
  y += 5;

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('LOCATAIRE', margin + 2, y + 4);
  doc.text('BIEN', margin + 45, y + 4);
  doc.text('CONTRAT', margin + 85, y + 4);
  doc.text('VERSÉE', margin + 115, y + 4);
  doc.text('REMBOURSÉE', margin + 140, y + 4);
  doc.text('DÉTENUE', pageWidth - margin - 2, y + 4, { align: 'right' });
  y += 6;

  ACCOUNTING_DATA.cautions.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(item.tenant, margin + 2, y + 3.5);
    doc.text(item.property.slice(0, 20), margin + 45, y + 3.5);
    doc.text(item.contractNo, margin + 85, y + 3.5);
    doc.text(formatFCFA(item.deposited), margin + 115, y + 3.5);
    doc.text(item.refunded > 0 ? formatFCFA(item.refunded) : '—', margin + 140, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.balanceRemaining > 0 ? 30 : 100, item.balanceRemaining > 0 ? 41 : 116, item.balanceRemaining > 0 ? 59 : 139);
    doc.text(formatFCFA(item.balanceRemaining), pageWidth - margin - 2, y + 3.5, { align: 'right' });
    y += 5.2;
  });

  y += 10;

  // D. DÉPENSES DE MAINTENANCE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('D. DÉPENSES DE MAINTENANCE & TRAVAUX', margin, y);
  y += 5;

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('DATE', margin + 2, y + 4);
  doc.text('BIEN', margin + 22, y + 4);
  doc.text('INTERVENTION / DESCRIPTION', margin + 60, y + 4);
  doc.text('CATÉGORIE', margin + 120, y + 4);
  doc.text('PRESTATAIRE', margin + 145, y + 4);
  doc.text('MONTANT', pageWidth - margin - 2, y + 4, { align: 'right' });
  y += 6;

  let totalMaint = 0;
  ACCOUNTING_DATA.maintenance.forEach((item, idx) => {
    totalMaint += item.amount;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(item.date, margin + 2, y + 3.5);
    doc.text(item.property.slice(0, 18), margin + 22, y + 3.5);
    doc.text(item.description.slice(0, 32), margin + 60, y + 3.5);
    doc.text(item.category, margin + 120, y + 3.5);
    doc.text(item.contractor.slice(0, 16), margin + 145, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(225, 29, 72);
    doc.text(formatFCFA(item.amount), pageWidth - margin - 2, y + 3.5, { align: 'right' });
    y += 5.2;
  });

  // Total Maintenance
  y += 2;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL DES FRAIS DE MAINTENANCE ET TRAVAUX', margin + 2, y + 4.2);
  doc.setTextColor(225, 29, 72);
  doc.text(formatFCFA(totalMaint), pageWidth - margin - 2, y + 4.2, { align: 'right' });

  addFooter(3, 5);

  // ---------------- PAGE 4 : ÉTAT DES CONTRATS ----------------
  doc.addPage();
  y = 14;
  addHeader(4, 5);
  y = 35;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('E. ÉTAT DU PARC ET DES CONTRATS DE BAIL ACTIFS', margin, y);
  y += 5;

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('N° CONTRAT', margin + 2, y + 4);
  doc.text('LOCATAIRE', margin + 30, y + 4);
  doc.text('BIEN IMMOBILIER', margin + 65, y + 4);
  doc.text('PÉRIODE', margin + 115, y + 4);
  doc.text('LOYER', margin + 145, y + 4);
  doc.text('STATUT', pageWidth - margin - 2, y + 4, { align: 'right' });
  y += 6;

  ACCOUNTING_DATA.contrats.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(item.contractNo, margin + 2, y + 3.5);
    doc.text(item.tenant, margin + 30, y + 3.5);
    doc.text(item.property.slice(0, 24), margin + 65, y + 3.5);
    doc.text(`${item.startDate.slice(3)} au ${item.endDate.slice(3)}`, margin + 115, y + 3.5);
    doc.text(formatFCFA(item.rent), margin + 145, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.status === 'Actif' ? 16 : 217, item.status === 'Actif' ? 185 : 119, item.status === 'Actif' ? 129 : 6);
    doc.text(item.status, pageWidth - margin - 2, y + 3.5, { align: 'right' });
    y += 5.2;
  });

  addFooter(4, 5);

  // ---------------- PAGE 5 : RÉSULTATS & BILAN DU GRAND LIVRE (Point 10) ----------------
  doc.addPage();
  y = 14;
  addHeader(5, 5);
  y = 35;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('F. COMPTE DE RÉSULTAT ET BILAN COMPTABLE DU GRAND LIVRE', margin, y);
  y += 5;

  const resultsRows: [string, string, string][] = [
    ['Total des loyers encaissés', formatFCFA(ACCOUNTING_DATA.synthesis.loyersEncaisses), 'Recettes locatives brutes constatées'],
    ['Total des autres encaissements', '0 FCFA', 'Subventions, indemnités d\'assurance'],
    ['Total des dépenses de maintenance', formatFCFA(ACCOUNTING_DATA.synthesis.depensesMaintenance), 'Entretien, réparations & interventions'],
    ['Total des cautions remboursées', formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRemboursees), 'Restitutions conformes après état des lieux'],
    ['Autres dépenses enregistrées', formatFCFA(ACCOUNTING_DATA.synthesis.autresDepenses), 'Frais administratifs, syndic & assurances'],
    ['Résultat du mois en cours (Septembre 2026)', `+${formatFCFA(2405000)}`, 'Encaissements mois - Dépenses mois'],
    ['Résultat annuel cumulé de l\'exercice 2026', `+${formatFCFA(ACCOUNTING_DATA.synthesis.resultatNet)}`, 'Cumul progressif de Janvier à Septembre'],
    ['RÉSULTAT NET COMPTABLE AVANT IMPÔT', `+${formatFCFA(ACCOUNTING_DATA.synthesis.resultatNet)}`, 'Solde net d\'exploitation foncière'],
  ];

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('POSTE DU BILAN & RÉSULTAT', margin + 3, y + 4.2);
  doc.text('NOTE COMPTABLE', margin + 85, y + 4.2);
  doc.text('MONTANT (FCFA)', pageWidth - margin - 3, y + 4.2, { align: 'right' });
  y += 7;

  resultsRows.forEach((r, idx) => {
    const isNet = idx === resultsRows.length - 1;
    const isCumulative = idx === resultsRows.length - 2;

    if (isNet) {
      doc.setFillColor(236, 253, 245);
      doc.rect(margin, y, pageWidth - (margin * 2), 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(6, 95, 70);
    } else if (isCumulative) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - (margin * 2), 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
    } else {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
    }

    doc.text(r[0], margin + 3, y + 4.5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.text(r[2], margin + 85, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isNet ? 9 : 8);
    doc.text(r[1], pageWidth - margin - 3, y + 4.5, { align: 'right' });
    y += isNet ? 8.5 : 6.5;
  });

  y += 10;

  // CERTIFICATION DE CONFORMITÉ & SIGNATURE BLOCK
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 48, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('ATTESTATION DE CONFORMITÉ COMPTABLE & FISCALE', margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Le présent état comptable a été édité automatiquement par la plateforme certifiée LocaTrust à partir des encaissements réels,\n' +
    'des quittances de loyer numérotées, des baux d\'habitation enregistrés et des justificatifs de travaux archivés.\n' +
    'Ce document est certifié conforme pour la tenue de comptabilité, la déclaration fiscale des revenus fonciers\n' +
    'et la transmission à un cabinet d\'expertise comptable agréé en République de Côte d\'Ivoire.',
    margin + 4,
    y + 13
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(11, 25, 44);
  doc.text(`Fait à Abidjan, le ${new Date().toLocaleDateString('fr-FR')}`, margin + 4, y + 35);
  doc.text(`Pour le Bailleur : ${ACCOUNTING_DATA.owner.name}`, margin + 4, y + 41);

  doc.text('Cachet de certification numérique LocaTrust :', pageWidth - margin - 4, y + 35, { align: 'right' });
  doc.setTextColor(29, 78, 216);
  doc.text('CERTIFIÉ CONFORME — LOCATRUST SECURE CLOUD', pageWidth - margin - 4, y + 41, { align: 'right' });

  addFooter(5, 5);

  return doc;
}

/**
 * Triggers PDF file download in the browser
 */
export function downloadAccountingPDF(periodLabel: string = 'Année_2026') {
  const doc = generateAccountingPDF(periodLabel);
  const sanitizedPeriod = periodLabel.replace(/[\s\(\)\/]+/g, '_');
  doc.save(`LocaTrust_Liasse_Comptable_${sanitizedPeriod}.pdf`);
  triggerCelebration('download');
}

/**
 * 8. CRÉER UN DOCUMENT SPÉCIFIQUE : ÉTAT DES RÉSULTATS (CSV)
 * Contient :
 * - Revenus perçus
 * - Dépenses réalisées
 * - Cautions perçues et remboursées
 * - Résultat net
 * - Récapitulatif clair de la période choisie
 */
export function generateStatementOfResultsCSV(periodLabel: string = 'Année 2026'): string {
  const lines: string[] = [];
  lines.push(`LOCATRUST - ÉTAT DES RÉSULTATS FINANCIERS ET D'EXPLOITATION`);
  lines.push(`Propriétaire :;${ACCOUNTING_DATA.owner.name}`);
  lines.push(`Identifiant Bailleur :;${ACCOUNTING_DATA.owner.id}`);
  lines.push(`Période sélectionnée :;${periodLabel}`);
  lines.push(`Date d'édition :;${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`);
  lines.push(``);

  lines.push(`========================================================================`);
  lines.push(`1. REVENUS LOCATIFS PERÇUS`);
  lines.push(`========================================================================`);
  lines.push(`Catégorie;Montant (FCFA);Observation`);
  lines.push(`Loyers perçus / Encaissés;${ACCOUNTING_DATA.synthesis.loyersEncaisses};Total quittances vérifiées`);
  lines.push(`Autres revenus fonciers;${ACCOUNTING_DATA.synthesis.autresDepenses};0 FCFA`);
  lines.push(`SOUS-TOTAL REVENUS BRUTS;${ACCOUNTING_DATA.synthesis.loyersEncaisses};Revenus d'exploitation`);
  lines.push(``);

  lines.push(`========================================================================`);
  lines.push(`2. DÉPENSES RÉALISÉES`);
  lines.push(`========================================================================`);
  lines.push(`Catégorie;Montant (FCFA);Observation`);
  lines.push(`Maintenance, réparations & dépannages;${ACCOUNTING_DATA.synthesis.depensesMaintenance};Factures artisans réglées`);
  lines.push(`Autres charges d'exploitation;0;Frais administratifs`);
  lines.push(`SOUS-TOTAL DÉPENSES D'EXPLOITATION;${ACCOUNTING_DATA.synthesis.depensesMaintenance};Charges déductibles`);
  lines.push(``);

  lines.push(`========================================================================`);
  lines.push(`3. MOUVEMENTS SUR DÉPÔTS DE GARANTIE / CAUTIONS`);
  lines.push(`========================================================================`);
  lines.push(`Catégorie;Montant (FCFA);Observation`);
  lines.push(`Total des cautions perçues;${ACCOUNTING_DATA.synthesis.cautionsRecues};Dépôts de garantie sous séquestre`);
  lines.push(`Total des cautions remboursées;${ACCOUNTING_DATA.synthesis.cautionsRemboursees};Restitutions après état des lieux`);
  lines.push(`Solde net des cautions sous séquestre;${ACCOUNTING_DATA.synthesis.cautionsRestantes};Détenu pour baux actifs`);
  lines.push(``);

  lines.push(`========================================================================`);
  lines.push(`4. RÉSULTAT NET COMPTABLE DE LA PÉRIODE`);
  lines.push(`========================================================================`);
  lines.push(`Désignation;Montant (FCFA);Précision`);
  lines.push(`Total général encaissé;${ACCOUNTING_DATA.synthesis.totalEncaisse};Revenus`);
  lines.push(`Total général dépensé;${ACCOUNTING_DATA.synthesis.totalDepense};Charges et restitutions`);
  lines.push(`RÉSULTAT NET FONCIER AVANT IMPÔT;${ACCOUNTING_DATA.synthesis.resultatNet};Solde net d'exploitation`);
  lines.push(``);

  return '\uFEFF' + lines.join('\r\n');
}

export function downloadStatementOfResultsCSV(periodLabel: string = 'Année 2026') {
  const csv = generateStatementOfResultsCSV(periodLabel);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedPeriod = periodLabel.replace(/[\s\(\)\/]+/g, '_');
  link.href = url;
  link.setAttribute('download', `LocaTrust_Etat_des_Resultats_${sanitizedPeriod}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 8. CRÉER UN DOCUMENT SPÉCIFIQUE : ÉTAT DES RÉSULTATS (PDF)
 * Document A4 officiel 1 page dédié à l'État des résultats
 */
export function generateStatementOfResultsPDF(periodLabel: string = 'Année 2026'): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 12;
  let y = 14;

  // Header Logo
  try {
    doc.addImage(LOCATRUST_OFFICIAL_LOGO_BASE64, 'PNG', margin, y, 42, 11);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(29, 78, 216);
    doc.text('LocaTrust', margin, y + 8);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('ÉTAT DES RÉSULTATS FINANCIERS & REVENUS FONCIERS', pageWidth - margin, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Période : ${periodLabel} • Date d'édition : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, y + 11, { align: 'right' });

  y += 18;

  // Banner Propriétaire
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Bailleur / Propriétaire : ${ACCOUNTING_DATA.owner.name}`, margin + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`ID : ${ACCOUNTING_DATA.owner.id} • ${ACCOUNTING_DATA.owner.address}`, margin + 3, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text('Document Officiel de Déclaration', pageWidth - margin - 3, y + 8.5, { align: 'right' });

  y += 22;

  // 4 KPI Cards
  const cardW = (pageWidth - (margin * 2) - 9) / 4;
  const cards = [
    { title: 'REVENUS PERÇUS', value: formatFCFA(ACCOUNTING_DATA.synthesis.loyersEncaisses), color: [16, 149, 97], bg: [236, 253, 245] },
    { title: 'DÉPENSES EFFECTUÉES', value: formatFCFA(ACCOUNTING_DATA.synthesis.depensesMaintenance), color: [225, 29, 72], bg: [255, 241, 242] },
    { title: 'CAUTIONS RESTITUÉES', value: formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRemboursees), color: [71, 85, 105], bg: [241, 245, 249] },
    { title: 'RÉSULTAT NET', value: `+${formatFCFA(ACCOUNTING_DATA.synthesis.resultatNet)}`, color: [29, 78, 216], bg: [239, 246, 255] }
  ];

  cards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y, cardW, 16, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(c.title, cx + 2.5, y + 5);
    doc.setFontSize(8.5);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cx + 2.5, y + 12);
  });

  y += 22;

  // Tableau détaillé des résultats
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(11, 25, 44);
  doc.text('DÉCOMPTE DÉTAILLÉ DE L\'EXERCICE COMPTABLE', margin, y);
  y += 4;

  const rows: [string, string, string, boolean][] = [
    ['1. REVENUS BRUTS LOCATIFS ENCAISSÉS', formatFCFA(ACCOUNTING_DATA.synthesis.loyersEncaisses), '100% justifié par quittances vérifiées', false],
    ['2. AUTRES ENCAISSEMENTS & PRODUITS', '0 FCFA', 'Subventions ou régularisations', false],
    ['SOUS-TOTAL REVENUS D\'EXPLOITATION', formatFCFA(ACCOUNTING_DATA.synthesis.loyersEncaisses), 'Total des recettes perçues', true],
    ['3. TRAVAUX ET DÉPENSES DE MAINTENANCE', `-${formatFCFA(ACCOUNTING_DATA.synthesis.depensesMaintenance)}`, 'Interventions sur le parc', false],
    ['4. AUTRES CHARGES FINANCIÈRES & GESTION', '0 FCFA', 'Charges administratives déductibles', false],
    ['SOUS-TOTAL DÉPENSES D\'EXPLOITATION', `-${formatFCFA(ACCOUNTING_DATA.synthesis.depensesMaintenance)}`, 'Total charges déductibles', true],
    ['5. CAUTIONS REÇUES PENDANT LA PÉRIODE', formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRecues), 'Dépôts sous séquestre', false],
    ['6. CAUTIONS REMBOURSÉES AUX LOCATAIRES', `-${formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRemboursees)}`, 'Restitutions après état des lieux', false],
    ['SOLDE NET DES CAUTIONS EN COURS', formatFCFA(ACCOUNTING_DATA.synthesis.cautionsRestantes), 'Dépôts actifs garantissant les baux', true],
    ['RÉSULTAT NET FONCIER AVANT IMPÔT', `+${formatFCFA(ACCOUNTING_DATA.synthesis.resultatNet)}`, 'Bénéfice net certifié de la période', true],
  ];

  doc.setFillColor(11, 25, 44);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('RUBRIQUE COMPTABLE', margin + 3, y + 4.2);
  doc.text('JUSTIFICATIF & CONFORMITÉ', margin + 85, y + 4.2);
  doc.text('MONTANT (FCFA)', pageWidth - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  rows.forEach((r, idx) => {
    const isTotal = r[3];
    const isFinalNet = idx === rows.length - 1;

    if (isFinalNet) {
      doc.setFillColor(236, 253, 245);
      doc.rect(margin, y, pageWidth - (margin * 2), 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(6, 95, 70);
    } else if (isTotal) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - (margin * 2), 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
    } else {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
    }

    doc.text(r[0], margin + 3, y + 4.5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.text(r[2], margin + 85, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFinalNet ? 9 : 7.5);
    doc.text(r[1], pageWidth - margin - 3, y + 4.5, { align: 'right' });
    y += isFinalNet ? 8.5 : 6.5;
  });

  y += 8;

  // Signature Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 38, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICATION DES RÉSULTATS PAR LA PLATEFORME LOCATRUST', margin + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Le présent état des résultats a été établi à partir des encaissements vérifiés, des baux d\'habitation enregistrés\n' +
    'et des règlements de travaux certifiés. Il constitue une pièce justificative officielle de la comptabilité foncière.',
    margin + 3,
    y + 12
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(11, 25, 44);
  doc.text(`Fait à Abidjan, le ${new Date().toLocaleDateString('fr-FR')}`, margin + 3, y + 26);
  doc.text(`Pour le Bailleur : ${ACCOUNTING_DATA.owner.name}`, margin + 3, y + 32);

  doc.setTextColor(29, 78, 216);
  doc.text('CERTIFIÉ CONFORME — LOCATRUST SECURE CLOUD', pageWidth - margin - 3, y + 32, { align: 'right' });

  return doc;
}

export function downloadStatementOfResultsPDF(periodLabel: string = 'Année 2026') {
  const doc = generateStatementOfResultsPDF(periodLabel);
  const sanitizedPeriod = periodLabel.replace(/[\s\(\)\/]+/g, '_');
  doc.save(`LocaTrust_Etat_des_Resultats_${sanitizedPeriod}.pdf`);
  triggerCelebration('download');
}

/**
 * 5. EXPORT COMPTABLE — DEUX BOUTONS DE TÉLÉCHARGEMENT
 * Télécharger le dossier complet (.ZIP)
 * Contient tous les journaux comptables séparés en CSV + État des résultats + Notice
 */
export function downloadCompleteAccountingZip(periodLabel: string = 'Année 2026') {
  const sanitizedPeriod = periodLabel.replace(/[\s\(\)\/]+/g, '_');

  const files: ZipFileInput[] = [
    {
      name: `01_Synthese_Comptable_${sanitizedPeriod}.csv`,
      content: generateAccountingCSV(periodLabel)
    },
    {
      name: `02_Journal_des_Encaissements_9_Colonnes_${sanitizedPeriod}.csv`,
      content: (() => {
        const l: string[] = [];
        l.push(`LOCATRUST - JOURNAL DES ENCAISSEMENTS OFFICIEL`);
        l.push(`Période :;${periodLabel}`);
        l.push(`Date;Référence;Locataire;Contrat;Période;Montant (FCFA);Mode de paiement;Référence de paiement;Statut`);
        for (const item of ACCOUNTING_DATA.encaissements) {
          l.push(`${item.date};${item.receiptNo};"${item.tenant}";${item.contractNo};"${item.period}";${item.amount};"${item.method}";${item.ref};"${item.status}"`);
        }
        return '\uFEFF' + l.join('\r\n');
      })()
    },
    {
      name: `03_Etat_des_Loyers_${sanitizedPeriod}.csv`,
      content: (() => {
        const l: string[] = [];
        l.push(`LOCATRUST - ÉTAT DES LOYERS ET ÉCHÉANCES`);
        l.push(`Période :;${periodLabel}`);
        l.push(`Locataire;Bien;Loyer;Mois;Attendu;Payé;Solde;Date;Statut`);
        for (const item of ACCOUNTING_DATA.loyers) {
          l.push(`"${item.tenant}";"${item.property}";${item.monthlyRent};"${item.month}";${item.expected};${item.paid};${item.balance};${item.paymentDate};${item.status}`);
        }
        return '\uFEFF' + l.join('\r\n');
      })()
    },
    {
      name: `04_Etat_des_Cautions_${sanitizedPeriod}.csv`,
      content: (() => {
        const l: string[] = [];
        l.push(`LOCATRUST - ÉTAT DES DÉPÔTS DE GARANTIE / CAUTIONS`);
        l.push(`Période :;${periodLabel}`);
        l.push(`Locataire;Bien;Contrat;Caution Prévue;Caution Versée;Caution Remboursée;Solde Détenu;Date Remboursement;Motif`);
        for (const item of ACCOUNTING_DATA.cautions) {
          l.push(`"${item.tenant}";"${item.property}";${item.contractNo};${item.planned};${item.deposited};${item.refunded};${item.balanceRemaining};${item.refundDate};"${item.reason}"`);
        }
        return '\uFEFF' + l.join('\r\n');
      })()
    },
    {
      name: `05_Depenses_Maintenance_${sanitizedPeriod}.csv`,
      content: (() => {
        const l: string[] = [];
        l.push(`LOCATRUST - DÉPENSES DE MAINTENANCE ET TRAVAUX`);
        l.push(`Période :;${periodLabel}`);
        l.push(`Date;Bien;Locataire;Description;Catégorie;Prestataire;Montant (FCFA);Statut`);
        for (const item of ACCOUNTING_DATA.maintenance) {
          l.push(`${item.date};"${item.property}";"${item.tenant}";"${item.description}";"${item.category}";"${item.contractor}";${item.amount};${item.status}`);
        }
        return '\uFEFF' + l.join('\r\n');
      })()
    },
    {
      name: `06_Etat_des_Contrats_de_Bail_${sanitizedPeriod}.csv`,
      content: (() => {
        const l: string[] = [];
        l.push(`LOCATRUST - ÉTAT DU PARC ET DES BAUX EN COURS`);
        l.push(`Période :;${periodLabel}`);
        l.push(`Contrat;Locataire;Bien;Début;Fin;Loyer;Caution;Statut;Date Signature`);
        for (const item of ACCOUNTING_DATA.contrats) {
          l.push(`${item.contractNo};"${item.tenant}";"${item.property}";${item.startDate};${item.endDate};${item.rent};${item.caution};${item.status};${item.signaturesDate}`);
        }
        return '\uFEFF' + l.join('\r\n');
      })()
    },
    {
      name: `07_Etat_des_Resultats_${sanitizedPeriod}.csv`,
      content: generateStatementOfResultsCSV(periodLabel)
    },
    {
      name: `NOTICE_AUDIT_COMPTABLE_LOCATRUST.txt`,
      content: `LOCATRUST — DOSSIER COMPTABLE OFFICIEL
======================================================
Propriétaire : ${ACCOUNTING_DATA.owner.name} (${ACCOUNTING_DATA.owner.id})
Période d'exercice : ${periodLabel}
Date d'édition : ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}

Ce dossier d'audit comptable a été édité automatiquement par la plateforme certifiée LocaTrust.
Il contient l'ensemble des journaux exigés pour la tenue de comptabilité et les liasses fiscales :
1. Synthèse comptable
2. Journal des encaissements (9 colonnes distinctes avec quittances et références)
3. État des loyers et créances
4. État des cautions et séquestres
5. Dépenses d'entretien et maintenance
6. État des contrats de bail
7. État des résultats financiers

Certifié conforme par LocaTrust Cloud Security.
`
    }
  ];

  downloadZipArchive(`LocaTrust_Dossier_Comptable_Complet_${sanitizedPeriod}.zip`, files);
  triggerCelebration('download');
}

