import { supabase } from '@/src/lib/supabase';
import { MonthAccountingRecord, PeriodSummary } from '@/lib/reports/accountingHistoryStore';

export interface RealAccountingSynthesis {
  loyersAttendus: number;
  loyersEncaisses: number;
  loyersImpayes: number;
  loyersEnRetard: number;
  cautionsRecues: number;
  cautionsRemboursees: number;
  cautionsRestantes: number;
  depensesMaintenance: number;
  autresDepenses: number;
  totalEncaisse: number;
  totalDepense: number;
  resultatNet: number;
  tauxRecouvrement: number;
}

export interface RealAccountingDataset {
  ownerName: string;
  owner?: {
    name: string;
    id: string;
    phone: string;
    email: string;
    address: string;
  };
  synthesis: RealAccountingSynthesis;
  encaissements: any[];
  loyers: any[];
  cautions: any[];
  maintenance: any[];
  contrats: any[];
  activePropertiesCount: number;
  activeTenantsCount: number;
  activeContractsCount: number;
  monthlyBreakdown: MonthAccountingRecord[];
  extraStats: {
    pendingSignaturesCount: number;
    expiringSoonCount: number;
    expiredCount: number;
    terminatedCount: number;
    reservedCount: number;
    finContratCount: number;
    disabledCount: number;
    cautionsRetenues: number;
    resolvedTicketsRatio: number;
    totalTickets: number;
  };
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Cache mémoire ultrarapide pour fluidité instantanée
const accountingCache = new Map<string, { data: RealAccountingDataset; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 secondes

export function invalidateAccountingCache() {
  accountingCache.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('locatrust:payments-updated', invalidateAccountingCache);
  window.addEventListener('locatrust:contracts-updated', invalidateAccountingCache);
  window.addEventListener('locatrust:properties-updated', invalidateAccountingCache);
}

export async function fetchRealAccountingData(userId?: string, targetYear: string = '2026'): Promise<RealAccountingDataset> {
  const currentYearNum = parseInt(targetYear, 10) || new Date().getFullYear();
  const cacheKey = `${userId || 'anonymous'}_${targetYear}`;

  const cached = accountingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // 1. Préparation des requêtes parallèles optimisées
    let pQuery = supabase.from('properties').select('*').is('deleted_at', null);
    if (userId) pQuery = pQuery.eq('owner_id', userId);

    let cQuery = supabase.from('contracts').select('*, property:properties(*), tenant:users!tenant_id(*)');
    if (userId) cQuery = cQuery.eq('owner_id', userId);

    let pmQuery = supabase.from('rent_payments').select('*, property:properties(*), tenant:users!tenant_id(*)');
    if (userId) pmQuery = pmQuery.eq('owner_id', userId);

    let cauQuery = supabase.from('cautions').select('*, property:properties(*), tenant:users!tenant_id(*)');
    if (userId) cauQuery = cauQuery.eq('owner_id', userId);

    let mQuery = supabase.from('maintenance_tickets').select('*, property:properties(*)');
    if (userId) mQuery = mQuery.eq('owner_id', userId);

    let profQuery = userId 
      ? supabase.from('users').select('*').eq('id', userId).maybeSingle()
      : Promise.resolve({ data: null });

    // 2. Exécution ultra-rapide en parallèle via Promise.all
    const [
      { data: ownerProfile },
      { data: properties },
      { data: contracts },
      { data: payments },
      { data: cautions },
      { data: tickets }
    ] = await Promise.all([
      profQuery,
      pQuery,
      cQuery,
      pmQuery,
      cauQuery,
      mQuery
    ]);

    const realProps = properties || [];
    const realContracts = contracts || [];
    const realPayments = payments || [];
    const realCautions = cautions || [];
    const realTickets = tickets || [];

    // Calculs réels dynamiques
    const loyersEncaisses = realPayments
      .filter((p) => p.status === 'valide' || p.status === 'paye')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const loyersEnRetard = realPayments
      .filter((p) => p.status === 'en_retard' || p.status === 'impaye')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const activeContracts = realContracts.filter((c) => c.status === 'actif' || c.status === 'signe' || c.status === 'contrat_actif');
    const monthlyRentExpected = activeContracts.reduce((s, c) => s + (Number(c.rent || c.property?.rent) || 0), 0);
    const loyersAttendus = monthlyRentExpected > 0 ? monthlyRentExpected * 12 : loyersEncaisses;

    const cautionsRecues = realCautions.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0);
    const cautionsRemboursees = realCautions.reduce((s, c) => s + (Number(c.amount_restituted) || 0), 0);
    const cautionsRestantes = Math.max(0, cautionsRecues - cautionsRemboursees);

    const depensesMaintenance = realTickets.reduce((s, t) => s + (Number(t.cost || t.amount) || 0), 0);
    const totalEncaisse = loyersEncaisses;
    const totalDepense = depensesMaintenance + cautionsRemboursees;
    const resultatNet = totalEncaisse - totalDepense;
    const tauxRecouvrement = loyersAttendus > 0 ? Math.round((loyersEncaisses / loyersAttendus) * 100) : 0;

    // Tableau mensuel réel
    const monthlyBreakdown: MonthAccountingRecord[] = MONTH_NAMES.map((mName, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const monthKey = `${currentYearNum}-${monthNum}`;

      // Paiements reçus ce mois précis
      const monthPayments = realPayments.filter((p) => {
        const d = p.payment_date || p.created_at;
        return d && d.startsWith(monthKey) && (p.status === 'valide' || p.status === 'paye');
      });
      const monthCollected = monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      // Maintenance ce mois
      const monthTickets = realTickets.filter((t) => {
        const d = t.created_at;
        return d && d.startsWith(monthKey);
      });
      const monthMaint = monthTickets.reduce((s, t) => s + (Number(t.cost || t.amount) || 0), 0);

      return {
        monthKey,
        monthName: mName,
        year: currentYearNum,
        expectedRent: monthlyRentExpected,
        collectedRent: monthCollected,
        lateRent: 0,
        unpaidRent: 0,
        otherIncome: 0,
        maintenanceExpense: monthMaint,
        cautionReceived: 0,
        cautionRefunded: 0,
        otherExpenses: 0,
        activeProperties: realProps.length,
        activeTenants: activeContracts.length,
        contractsActive: activeContracts.length,
        contractsSigned: 0
      };
    });

    const mappedEncaissements = realPayments.map((p, idx) => ({
      date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
      receiptNo: p.receipt_number || `REC-${currentYearNum}-${String(idx + 1).padStart(6, '0')}`,
      contractNo: p.contract_id || '—',
      tenant: p.tenant?.full_name || 'Locataire',
      property: p.property?.title || 'Bien immobilier',
      period: p.period || 'Mois en cours',
      method: p.payment_method || 'Mobile Money',
      ref: p.reference || `REF-${idx}`,
      amount: Number(p.amount) || 0,
      status: p.status === 'valide' ? 'Validé' : 'En attente',
      validatedAt: p.validated_at ? new Date(p.validated_at).toLocaleDateString('fr-FR') : '—'
    }));

    const mappedLoyers = realContracts.map((c) => ({
      tenant: c.tenant?.full_name || 'Locataire',
      property: c.property?.title || 'Bien immobilier',
      monthlyRent: Number(c.rent || c.property?.rent) || 0,
      month: 'Mois en cours',
      expected: Number(c.rent || c.property?.rent) || 0,
      paid: Number(c.rent || c.property?.rent) || 0,
      balance: 0,
      paymentDate: '—',
      status: 'À jour'
    }));

    const mappedCautions = realCautions.map((cau) => ({
      tenant: cau.tenant?.full_name || 'Locataire',
      property: cau.property?.title || 'Bien immobilier',
      contractNo: cau.contract_id || '—',
      planned: Number(cau.amount_requested) || 0,
      deposited: Number(cau.amount_paid) || 0,
      refunded: Number(cau.amount_restituted) || 0,
      retained: Number(cau.deduction_amount) || 0,
      balanceRemaining: Math.max(0, (Number(cau.amount_paid) || 0) - (Number(cau.amount_restituted) || 0)),
      refundDate: cau.restituted_at ? new Date(cau.restituted_at).toLocaleDateString('fr-FR') : '—',
      reason: cau.restitution_status === 'restitue_total' ? 'Restitution totale' : 'Bail en cours'
    }));

    const mappedMaintenance = realTickets.map((t) => ({
      date: t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '—',
      property: t.property?.title || 'Bien immobilier',
      tenant: 'Locataire',
      description: t.title || t.description || 'Intervention',
      category: t.category || 'Maintenance',
      contractor: t.artisan_name || 'Prestataire',
      amount: Number(t.cost || t.amount) || 0,
      status: t.status === 'resolu' ? 'Résolu & Payé' : 'En cours'
    }));

    const mappedContrats = realContracts.map((c) => ({
      contractNo: c.contract_number || c.id || '—',
      tenant: c.tenant?.full_name || 'Locataire',
      property: c.property?.title || 'Bien immobilier',
      startDate: c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—',
      endDate: '—',
      rent: Number(c.rent || c.property?.rent) || 0,
      caution: Number(c.caution || c.property?.caution) || 0,
      status: c.status === 'actif' || c.status === 'contrat_actif' ? 'Actif' : 'En attente',
      signaturesDate: '—'
    }));

    const ownerName = ownerProfile?.full_name || 'Mon Compte';
    const owner = {
      name: ownerName,
      id: ownerProfile?.id ? `LT-${ownerProfile.id.slice(0, 8).toUpperCase()}` : 'LT-PRO-001',
      phone: ownerProfile?.phone || '+225 -- -- -- --',
      email: ownerProfile?.email || 'contact@locatrust.ci',
      address: ownerProfile?.address || 'Abidjan, Côte d\'Ivoire'
    };

    // Statistiques complémentaires 100% réelles issues de la base
    const pendingSignaturesCount = realContracts.filter(
      (c) => c.status === 'en_attente' || c.status === 'en_attente_signature'
    ).length;

    const now = new Date();
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const expiringSoonCount = realContracts.filter((c) => {
      if (!c.end_date) return false;
      const d = new Date(c.end_date);
      return d > now && d <= sixtyDaysLater;
    }).length;

    const expiredCount = realContracts.filter(
      (c) => c.status === 'expire' || c.status === 'archive'
    ).length;

    const terminatedCount = realContracts.filter(
      (c) => c.status === 'resilie' || c.status === 'annule'
    ).length;

    const reservedCount = realProps.filter(
      (p) => p.status === 'reserve' || p.status === 'en_cours'
    ).length;

    const finContratCount = expiringSoonCount;

    const disabledCount = realProps.filter(
      (p) => p.status === 'desactive' || p.is_archived
    ).length;

    const cautionsRetenues = realCautions.reduce(
      (s, c) => s + (Number(c.deduction_amount) || 0),
      0
    );

    const resolvedTickets = realTickets.filter(
      (t) => t.status === 'resolu' || t.status === 'cloture' || t.status === 'termine'
    ).length;

    const resolvedTicketsRatio = realTickets.length > 0 
      ? Math.round((resolvedTickets / realTickets.length) * 100) 
      : 0;

    const result: RealAccountingDataset = {
      ownerName,
      owner,
      synthesis: {
        loyersAttendus,
        loyersEncaisses,
        loyersImpayes: 0,
        loyersEnRetard,
        cautionsRecues,
        cautionsRemboursees,
        cautionsRestantes,
        depensesMaintenance,
        autresDepenses: 0,
        totalEncaisse,
        totalDepense,
        resultatNet,
        tauxRecouvrement
      },
      encaissements: mappedEncaissements,
      loyers: mappedLoyers,
      cautions: mappedCautions,
      maintenance: mappedMaintenance,
      contrats: mappedContrats,
      activePropertiesCount: realProps.length,
      activeTenantsCount: activeContracts.length,
      activeContractsCount: activeContracts.length,
      monthlyBreakdown,
      extraStats: {
        pendingSignaturesCount,
        expiringSoonCount,
        expiredCount,
        terminatedCount,
        reservedCount,
        finContratCount,
        disabledCount,
        cautionsRetenues,
        resolvedTicketsRatio,
        totalTickets: realTickets.length
      }
    };

    accountingCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.warn('Real accounting fetch error:', err);
    return {
      ownerName: 'Mon Compte',
      synthesis: {
        loyersAttendus: 0,
        loyersEncaisses: 0,
        loyersImpayes: 0,
        loyersEnRetard: 0,
        cautionsRecues: 0,
        cautionsRemboursees: 0,
        cautionsRestantes: 0,
        depensesMaintenance: 0,
        autresDepenses: 0,
        totalEncaisse: 0,
        totalDepense: 0,
        resultatNet: 0,
        tauxRecouvrement: 0
      },
      encaissements: [],
      loyers: [],
      cautions: [],
      maintenance: [],
      contrats: [],
      activePropertiesCount: 0,
      activeTenantsCount: 0,
      activeContractsCount: 0,
      monthlyBreakdown: [],
      extraStats: {
        pendingSignaturesCount: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
        terminatedCount: 0,
        reservedCount: 0,
        finContratCount: 0,
        disabledCount: 0,
        cautionsRetenues: 0,
        resolvedTicketsRatio: 0,
        totalTickets: 0
      }
    };
  }
}
