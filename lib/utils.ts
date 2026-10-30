import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getQuotaPrice, type QuotaTierCode } from './quotaEngine';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFCFA(amount?: number | null): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  // Use plain ASCII space (\u0020) for thousands separator to avoid jsPDF non-breaking space glitches (e.g. 475 / 000)
  const formatted = Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

export function formatDateFr(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function calculateSubscriptionTier(activePropertiesCount: number): {
  tier: QuotaTierCode;
  price: number;
  label: string;
} {
  const quota = getQuotaPrice(activePropertiesCount);
  return {
    tier: quota.tier,
    price: quota.price,
    label: quota.label,
  };
}

export function sanitizeNumericInput(value: string | number): number {
  if (value === undefined || value === null) return 0;
  const str = String(value).trim();
  if (str === '') return 0;
  // Remove leading zeros before digits (e.g. "01" -> "1", "0025000" -> "25000", but keep "0" if alone)
  const cleaned = str.replace(/^0+(?=\d)/, '');
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Génère un numéro de contrat de bail strictement unique
 * Format officiel : LT-YYYY-CI-XXXXXX (ex: LT-2026-CI-849201)
 */
export function generateUniqueContractNumber(prefix = 'LT'): string {
  const year = new Date().getFullYear();
  const timeSlice = (Date.now() % 1000000).toString().padStart(6, '0');
  const rand = Math.floor(10 + Math.random() * 90).toString();
  return `${prefix}-${year}-CI-${timeSlice}${rand}`;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Formate proprement une période ou un mois de loyer en français normé
 * Exemples :
 * - "2026-10-01" -> "Octobre 2026"
 * - "2026-10" -> "Octobre 2026"
 * - "10/2026" -> "Octobre 2026"
 * - "Octobre 2026" -> "Octobre 2026"
 */
export function formatPeriodCovered(period: string | undefined | null): string {
  if (!period) return 'Mois en cours';
  const clean = String(period).trim();
  if (!clean) return 'Mois en cours';

  // Si contient plusieurs périodes séparées par virgule ou 'et'
  if (clean.includes(',') || clean.includes(' et ')) {
    const parts = clean.split(/,|\bet\b/).map(p => p.trim()).filter(Boolean);
    const formattedParts = parts.map(formatSinglePeriod);
    if (formattedParts.length === 1) return formattedParts[0];
    if (formattedParts.length > 1) {
      return `${formattedParts.slice(0, -1).join(', ')} et ${formattedParts[formattedParts.length - 1]}`;
    }
  }

  return formatSinglePeriod(clean);
}

function formatSinglePeriod(str: string): string {
  if (!str) return 'Mois en cours';
  const clean = str.trim();

  // Si contient déjà le nom d'un mois en français (ex: "Octobre 2026")
  const lower = clean.toLowerCase();
  for (let i = 0; i < MONTHS_FR.length; i++) {
    if (lower.includes(MONTHS_FR[i].toLowerCase())) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  // Format YYYY-MM-DD ou YYYY-MM
  const ymdMatch = clean.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = parseInt(ymdMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return `${MONTHS_FR[month - 1]} ${year}`;
    }
  }

  // Format DD/MM/YYYY ou MM/YYYY
  const dmyMatch = clean.match(/^(?:\d{1,2}\/)?(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const month = parseInt(dmyMatch[1], 10);
    const year = dmyMatch[2];
    if (month >= 1 && month <= 12) {
      return `${MONTHS_FR[month - 1]} ${year}`;
    }
  }

  // Tentative via objet Date
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return lbl.charAt(0).toUpperCase() + lbl.slice(1);
  }

  return clean;
}

