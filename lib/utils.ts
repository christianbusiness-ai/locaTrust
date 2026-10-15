import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  tier: '1_bien' | '2_10_biens' | '11_20_biens' | '20plus_biens';
  price: number;
  label: string;
} {
  if (activePropertiesCount <= 1) {
    return { tier: '1_bien', price: 500, label: 'Starter (1 bien)' };
  } else if (activePropertiesCount <= 10) {
    return { tier: '2_10_biens', price: 2000, label: 'Standard (2 à 10 biens)' };
  } else if (activePropertiesCount <= 20) {
    return { tier: '11_20_biens', price: 5000, label: 'Pro (11 à 20 biens)' };
  } else {
    return { tier: '20plus_biens', price: 10000, label: 'Entreprise (20+ biens)' };
  }
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

