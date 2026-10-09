// lib/themeHelper.ts
// Gestion dynamique du thème et des couleurs d'ambiance de LocaTrust

export interface AccentTheme {
  id: string;
  label: string;
  hex: string;
  hoverHex: string;
  lightHex: string;
  ringHex: string;
  bgClass: string;
  description: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'blue',
    label: 'Bleu Océan',
    hex: '#1E40AF',
    hoverHex: '#1D4ED8',
    lightHex: '#EFF6FF',
    ringHex: '#3B82F6',
    bgClass: 'bg-blue-600',
    description: 'Thème institutionnel officiel LocaTrust'
  },
  {
    id: 'emerald',
    label: 'Émeraude Banco',
    hex: '#059669',
    hoverHex: '#047857',
    lightHex: '#ECFDF5',
    ringHex: '#10B981',
    bgClass: 'bg-emerald-600',
    description: 'Ton éco-responsable et apaisant'
  },
  {
    id: 'amber',
    label: 'Ambre Savane',
    hex: '#D97706',
    hoverHex: '#B45309',
    lightHex: '#FFFBEB',
    ringHex: '#F59E0B',
    bgClass: 'bg-amber-600',
    description: 'Ton chaleureux et dynamique'
  },
  {
    id: 'indigo',
    label: 'Indigo Prestige',
    hex: '#4F46E5',
    hoverHex: '#4338CA',
    lightHex: '#EEF2FF',
    ringHex: '#6366F1',
    bgClass: 'bg-indigo-600',
    description: 'Design premium haute distinction'
  }
];

export function applyAccentTheme(themeId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const theme = ACCENT_THEMES.find((t) => t.id === themeId) || ACCENT_THEMES[0];

  // 1. Sauvegarder dans localStorage
  try {
    localStorage.setItem('locatrust_accent_color', theme.id);
    localStorage.setItem('locatrust_accent_color_hex', theme.hex);
  } catch (err) {
    console.warn('Impossible de sauvegarder le thème dans le localStorage', err);
  }

  // 2. Mettre à jour les variables CSS sur le root
  document.documentElement.style.setProperty('--primary-accent', theme.hex);
  document.documentElement.style.setProperty('--primary-accent-hover', theme.hoverHex);
  document.documentElement.style.setProperty('--primary-accent-light', theme.lightHex);
  document.documentElement.style.setProperty('--primary-accent-ring', theme.ringHex);

  // 3. Injecter ou mettre à jour la balise <style id="locatrust-theme-accent">
  let styleEl = document.getElementById('locatrust-theme-accent') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'locatrust-theme-accent';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    :root {
      --primary-accent: ${theme.hex};
      --primary-accent-hover: ${theme.hoverHex};
      --primary-accent-light: ${theme.lightHex};
      --primary-accent-ring: ${theme.ringHex};
    }

    /* Remplacement dynamique universel des éléments clés du thème */
    .bg-blue-600 {
      background-color: ${theme.hex} !important;
    }
    .hover\\:bg-blue-700:hover {
      background-color: ${theme.hoverHex} !important;
    }
    .text-blue-600, .text-blue-700 {
      color: ${theme.hex} !important;
    }
    .border-blue-600, .border-blue-500 {
      border-color: ${theme.hex} !important;
    }
    .ring-blue-500, .focus\\:ring-blue-500:focus {
      --tw-ring-color: ${theme.ringHex} !important;
    }
    .bg-blue-50 {
      background-color: ${theme.lightHex} !important;
    }
    .from-blue-600 {
      --tw-gradient-from: ${theme.hex} var(--tw-gradient-from-position, 0%) !important;
      --tw-gradient-to: rgb(255 255 255 / 0) var(--tw-gradient-to-position, 100%) !important;
      --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
    }
    .selection\\:bg-blue-600::selection {
      background-color: ${theme.hex} !important;
    }
  `;

  // 4. Émettre un événement personnalisé pour notifier l'UI si nécessaire
  window.dispatchEvent(
    new CustomEvent('locatrust:accent-color-changed', {
      detail: { themeId: theme.id, theme }
    })
  );
}

export function initAccentTheme(): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem('locatrust_accent_color') || 'blue';
    applyAccentTheme(saved);
  } catch (err) {
    applyAccentTheme('blue');
  }
}
