import { formatFCFA, formatDateFr } from '@/lib/utils';
import { RentPayment } from '@/types/database.types';

export function generateReceiptPDF(payment: RentPayment): string {
  const content = `
    QUITTANCE DE LOYER — LOCATRUST
    -------------------------------------------
    N° Quittance : Q-2026-${payment.id.slice(0, 6).toUpperCase()}
    Date d'émission : ${formatDateFr(payment.created_at)}
    
    Bailleur : ${payment.contract?.owner?.full_name || 'Aicha Diallo'}
    Locataire : ${payment.tenant?.full_name || "Koffi N'Guessan"}
    Bien loué : ${payment.contract?.property?.title || 'Appartement 3 pièces à Cocody Riviera'}
    
    Période : ${payment.target_month}
    Loyer mensuel : ${formatFCFA(payment.amount)}
    Référence paiement : ${payment.reference} (Virement / Mobile Money)
    Statut : PAYÉ ET CONFIRMÉ PAR LE BAILLEUR
    
    Authentification QR Code :
    [QR CODE SECURITE LOCATRUST : https://locatrust.ci/verify/receipt?id=${payment.id}]
  `;
  return content;
}
