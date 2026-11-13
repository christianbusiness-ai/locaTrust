import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { getRentAccountingSummary } from '@/lib/dateSystem';

export interface MonthAccountingRecord {
  monthKey: string; // '2026-01', '2026-02', etc.
  monthName: string; // 'Janvier', 'Février', etc.
  year: number;
  expectedRent: number;
  collectedRent: number;
  lateRent: number;
  unpaidRent: number;
  otherIncome: number;
  maintenanceExpense: number;
  cautionReceived: number;
  cautionRefunded: number;
  otherExpenses: number;
  activeProperties: number;
  activeTenants: number;
  contractsActive: number;
  contractsSigned: number;
  agencyCommission?: number;
  netReversedToMandants?: number;
}

export interface PeriodSummary {
  periodLabel: string;
  expectedRent: number;
  collectedRent: number;
  lateRent: number;
  unpaidRent: number;
  recoveryRate: number;
  otherIncome: number;
  totalIncome: number;
  maintenanceExpense: number;
  cautionReceived: number;
  cautionRefunded: number;
  otherExpenses: number;
  totalExpenses: number;
  netResult: number;
  annualCumulativeResult: number;
  activeProperties: number;
  activeTenants: number;
  activeContracts: number;
  maintenanceTickets: number;
  monthlyBreakdown: MonthAccountingRecord[];
}

// Modèle mensuel standard initialisé à 0 (Aucune donnée fictive - Règle "SERVER IS THE SOURCE OF TRUTH")
function createEmptyYearRecords(targetYear: number): MonthAccountingRecord[] {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return monthNames.map((name, idx) => {
    const mNum = (idx + 1).toString().padStart(2, '0');
    return {
      monthKey: `${targetYear}-${mNum}`,
      monthName: name,
      year: targetYear,
      expectedRent: 0,
      collectedRent: 0,
      lateRent: 0,
      unpaidRent: 0,
      otherIncome: 0,
      maintenanceExpense: 0,
      cautionReceived: 0,
      cautionRefunded: 0,
      otherExpenses: 0,
      activeProperties: 0,
      activeTenants: 0,
      contractsActive: 0,
      contractsSigned: 0
    };
  });
}

const HISTORICAL_2026: MonthAccountingRecord[] = createEmptyYearRecords(2026);
const HISTORICAL_2025: MonthAccountingRecord[] = createEmptyYearRecords(2025);

const CURRENT_ACCOUNTING_YEAR_KEY = 'locatrust_current_accounting_year';
const REF_YEAR_KEY = 'locatrust_accounting_reference_year';
const ARCHIVED_YEARS_KEY = 'locatrust_accounting_archived_years';

const DEFAULT_CURRENT_YEAR = '2026';
const DEFAULT_ARCHIVED_YEARS = ['2025'];

// In-memory temporary viewing year (resets automatically on reload / new session) (Point 4 & 5 du prompt)
let inMemoryViewingYear: string | null = null;

export function getArchivedYears(): string[] {
  if (typeof window === 'undefined') return DEFAULT_ARCHIVED_YEARS;
  try {
    const raw = localStorage.getItem(ARCHIVED_YEARS_KEY);
    if (!raw) return DEFAULT_ARCHIVED_YEARS;
    const parsed = JSON.parse(raw);
    const valid = Array.isArray(parsed) ? parsed.filter((y: string) => Number(y) >= 2025) : [];
    return valid.length > 0 ? valid : DEFAULT_ARCHIVED_YEARS;
  } catch {
    return DEFAULT_ARCHIVED_YEARS;
  }
}

export function saveArchivedYears(years: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const filtered = (years || []).filter((y) => Number(y) >= 2025);
    localStorage.setItem(ARCHIVED_YEARS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to save archived years:', e);
  }
}

export function getCurrentAccountingYear(userId?: string): string {
  const realNowYear = String(new Date().getFullYear()); // '2026'
  if (typeof window === 'undefined') return realNowYear;
  try {
    if (userId) {
      const userStored = localStorage.getItem(`locatrust_${userId}_accounting_year`);
      if (userStored && Number(userStored) === Number(realNowYear)) return userStored;
    }
    const stored = localStorage.getItem(CURRENT_ACCOUNTING_YEAR_KEY) || localStorage.getItem(REF_YEAR_KEY);
    // Ne jamais forcer une année future (ex: 2027) par défaut à l'ouverture si nous sommes en 2026
    if (stored && Number(stored) === Number(realNowYear)) return stored;
    return realNowYear;
  } catch {
    return realNowYear;
  }
}

export function saveCurrentAccountingYear(year: string, userId?: string): { success: boolean; currentYear: string; archivedYears: string[] } {
  const cleanYear = year.trim();
  if (!cleanYear || isNaN(Number(cleanYear)) || Number(cleanYear) < 2026) {
    return { success: false, currentYear: getCurrentAccountingYear(userId), archivedYears: getArchivedYears() };
  }

  if (typeof window === 'undefined') {
    return { success: true, currentYear: cleanYear, archivedYears: DEFAULT_ARCHIVED_YEARS };
  }

  try {
    const previous = getCurrentAccountingYear(userId);
    let archived = getArchivedYears();

    if (previous !== cleanYear && Number(previous) >= 2026 && !archived.includes(previous)) {
      archived = [previous, ...archived.filter((y) => y !== cleanYear && Number(y) >= 2026)];
      saveArchivedYears(archived);
    } else {
      archived = archived.filter((y) => y !== cleanYear && Number(y) >= 2026);
      saveArchivedYears(archived);
    }

    if (userId) {
      localStorage.setItem(`locatrust_${userId}_accounting_year`, cleanYear);
    }
    localStorage.setItem(CURRENT_ACCOUNTING_YEAR_KEY, cleanYear);
    localStorage.setItem(REF_YEAR_KEY, cleanYear);

    // Maintien actif de la session de sécurité pour ne JAMAIS déconnecter l'utilisateur
    try {
      import('@/src/lib/sessionSecurity').then(({ recordUserActivity }) => {
        recordUserActivity();
      }).catch(() => {});
    } catch {}

    // Reset temporary viewing year so user is directly on the new current year
    inMemoryViewingYear = null;

    window.dispatchEvent(new CustomEvent('locatrust:year_changed', {
      detail: { year: cleanYear, isTemporary: false, currentYear: cleanYear, userId }
    }));

    return { success: true, currentYear: cleanYear, archivedYears: archived };
  } catch (e) {
    console.error('Failed to save current accounting year:', e);
    return { success: false, currentYear: cleanYear, archivedYears: getArchivedYears() };
  }
}

/**
 * Contexte temporaire de consultation d'une année archivée (Point 4 & 5 du prompt)
 * N'écrase jamais l'année comptable réelle.
 * Se réinitialise automatiquement au rechargement / nouvelle session.
 */
export function getSelectedViewingYear(): string | null {
  return inMemoryViewingYear;
}

export function setSelectedViewingYear(year: string | null): string {
  const current = getCurrentAccountingYear();
  if (!year || year === current || Number(year) < 2026) {
    inMemoryViewingYear = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('locatrust:year_changed', {
        detail: { year: current, isTemporary: false, currentYear: current }
      }));
    }
    return current;
  }

  inMemoryViewingYear = year;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('locatrust:year_changed', {
      detail: { year, isTemporary: true, currentYear: current }
    }));
  }
  return year;
}

export function getActiveReferenceYear(): string {
  // If user is currently consulting an archived year in this session, return it
  if (inMemoryViewingYear && Number(inMemoryViewingYear) >= 2026) {
    return inMemoryViewingYear;
  }
  return getCurrentAccountingYear();
}

// Backward-compatible alias for existing code
export function setActiveReferenceYear(year: string): { success: boolean; activeYear: string; archivedYears: string[] } {
  const res = saveCurrentAccountingYear(year);
  return { success: res.success, activeYear: res.currentYear, archivedYears: res.archivedYears };
}

export function getAvailableYears(): string[] {
  const current = getCurrentAccountingYear();
  const archived = getArchivedYears();
  const set = new Set([current, ...archived, '2027', '2026', '2025']);
  return Array.from(set)
    .filter((y) => Number(y) >= 2025)
    .sort((a, b) => Number(b) - Number(a));
}

// Générateur de structure comptable mensuelle pour toute année demandée (zéro montant fictif)
export function generateSyntheticYearRecords(targetYear: number): MonthAccountingRecord[] {
  return createEmptyYearRecords(targetYear);
}

export function getYearRecords(year: string = '2026', isDemo: boolean = false): MonthAccountingRecord[] {
  const targetYear = parseInt(year, 10) || 2026;
  return createEmptyYearRecords(targetYear);
}

// Liste des mois disponibles pour le filtre "Mois précédent"
export function getAvailableHistoricalMonths(year: string = '2026', isDemo: boolean = false): { key: string; label: string }[] {
  const records = getYearRecords(year, isDemo);
  // Retourne les mois disponibles dans l'ordre chronologique inverse
  return records
    .slice()
    .reverse()
    .map((r) => ({
      key: r.monthKey,
      label: `${r.monthName} ${r.year}`
    }));
}

// Calcul agrégé pour une liste de mois
function aggregateMonths(records: MonthAccountingRecord[], label: string, annualCumulativeTotal: number): PeriodSummary {
  const expectedRent = records.reduce((s, r) => s + r.expectedRent, 0);
  const collectedRent = records.reduce((s, r) => s + r.collectedRent, 0);
  const lateRent = records.reduce((s, r) => s + r.lateRent, 0);
  const unpaidRent = records.reduce((s, r) => s + r.unpaidRent, 0);
  const otherIncome = records.reduce((s, r) => s + r.otherIncome, 0);
  const maintenanceExpense = records.reduce((s, r) => s + r.maintenanceExpense, 0);
  const cautionReceived = records.reduce((s, r) => s + r.cautionReceived, 0);
  const cautionRefunded = records.reduce((s, r) => s + r.cautionRefunded, 0);
  const otherExpenses = records.reduce((s, r) => s + r.otherExpenses, 0);

  const totalIncome = collectedRent + otherIncome;
  const totalExpenses = maintenanceExpense + cautionRefunded + otherExpenses;
  const netResult = totalIncome - totalExpenses;
  const recoveryRate = expectedRent > 0 ? (collectedRent / expectedRent) * 100 : 100;

  const latest = records[records.length - 1] || {
    activeProperties: 0,
    activeTenants: 0,
    contractsActive: 0
  };

  const maintenanceTickets = records.filter((r) => r.maintenanceExpense > 0).length;

  return {
    periodLabel: label,
    expectedRent,
    collectedRent,
    lateRent,
    unpaidRent,
    recoveryRate: Math.round(recoveryRate * 10) / 10,
    otherIncome,
    totalIncome,
    maintenanceExpense,
    cautionReceived,
    cautionRefunded,
    otherExpenses,
    totalExpenses,
    netResult,
    annualCumulativeResult: annualCumulativeTotal,
    activeProperties: latest.activeProperties || 0,
    activeTenants: latest.activeTenants || 0,
    activeContracts: latest.contractsActive || 0,
    maintenanceTickets,
    monthlyBreakdown: records
  };
}

/**
 * Calculateur central officiel LocaTrust
 * Source unique de vérité pour Rapports, Dashboard et Exports
 */
export function calculatePeriodStats(params: {
  periodType: 'ce_mois' | 'mois_precedent' | 'trimestre' | 'annee';
  selectedYear?: string;
  selectedMonthKey?: string; // ex: '2026-08' pour mois précédent
  selectedQuarter?: 'T1' | 'T2' | 'T3' | 'T4';
  isDemo?: boolean;
}): PeriodSummary {
  const isDemo = Boolean(params.isDemo);
  const year = params.selectedYear || getActiveReferenceYear();
  const records = getYearRecords(year, isDemo);

  // Cumul annuel réel jusqu'à présent
  const annualTotalNet = records.reduce(
    (s, r) => s + (r.collectedRent + r.otherIncome - (r.maintenanceExpense + r.cautionRefunded + r.otherExpenses)),
    0
  );

  switch (params.periodType) {
    case 'ce_mois': {
      // Intégration directe des calculs d'arrière-plan issus de la base de données
      const liveSummary = getRentAccountingSummary();
      const currentMonth = records[records.length - 1];
      const monthLabel = liveSummary?.referenceMonth || `${currentMonth.monthName} ${year}`;

      if (liveSummary && liveSummary.totalExpectedRent > 0) {
        const liveRecord: MonthAccountingRecord = {
          ...currentMonth,
          expectedRent: liveSummary.totalExpectedRent,
          collectedRent: liveSummary.totalCollectedRent,
          lateRent: liveSummary.totalOverdueRent,
          unpaidRent: liveSummary.totalOverdueRent,
          contractsActive: liveSummary.activeContractsCount || currentMonth.contractsActive
        };
        return aggregateMonths([liveRecord], monthLabel, annualTotalNet);
      }

      return aggregateMonths([currentMonth], monthLabel, annualTotalNet);
    }

    case 'mois_precedent': {
      // Mois sélectionné dans l'historique ou avant-dernier mois par défaut
      const targetKey = params.selectedMonthKey || (records.length >= 2 ? records[records.length - 2].monthKey : records[0].monthKey);
      const targetMonth = records.find((r) => r.monthKey === targetKey) || records[0];
      const monthLabel = `${targetMonth.monthName} ${targetMonth.year}`;
      return aggregateMonths([targetMonth], monthLabel, annualTotalNet);
    }

    case 'trimestre': {
      const q = params.selectedQuarter || 'T3';
      let quarterMonths: MonthAccountingRecord[] = [];
      let label = `3ème Trimestre ${year} (Juil - Sep)`;

      if (q === 'T1') {
        quarterMonths = records.filter((r) => ['01', '02', '03'].includes(r.monthKey.split('-')[1]));
        label = `1er Trimestre ${year} (Jan - Mar)`;
      } else if (q === 'T2') {
        quarterMonths = records.filter((r) => ['04', '05', '06'].includes(r.monthKey.split('-')[1]));
        label = `2ème Trimestre ${year} (Avr - Juin)`;
      } else if (q === 'T3') {
        quarterMonths = records.filter((r) => ['07', '08', '09'].includes(r.monthKey.split('-')[1]));
        label = `3ème Trimestre ${year} (Juil - Sep)`;
      } else {
        quarterMonths = records.filter((r) => ['10', '11', '12'].includes(r.monthKey.split('-')[1]));
        label = `4ème Trimestre ${year} (Oct - Déc)`;
      }

      if (quarterMonths.length === 0) {
        quarterMonths = [records[records.length - 1]];
      }

      return aggregateMonths(quarterMonths, label, annualTotalNet);
    }

    case 'annee':
    default: {
      const label = `Exercice Annuel ${year} (Cumul réel)`;
      return aggregateMonths(records, label, annualTotalNet);
    }
  }
}
