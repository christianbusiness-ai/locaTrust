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
