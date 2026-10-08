import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { KpiGridSkeleton, PriorityNotificationSkeleton } from '@/components/common/SkeletonLoader';
import {
  Building2,
  Users,
  Wallet,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
  CreditCard,
  Send,
  BarChart3,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  Info,
  ShieldAlert
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { Link } from 'react-router-dom';

interface ProprietaireDashboardViewProps {
  onNavigateTab: (tabId: string) => void;
  onOpenAddProperty: () => void;
  onOpenCreateContract?: () => void;
  onOpenConfirmPayment: () => void;
  onOpenSendReminder: () => void;
  onOpenAddPaymentAccount: () => void;
  onSelectContract: (id: string) => void;
  userRole?: 'proprietaire' | 'agence';
  userName?: string;
  isDemo?: boolean;
}

export const ProprietaireDashboardView: React.FC<ProprietaireDashboardViewProps> = ({
  onNavigateTab,
  onOpenAddProperty,
  onOpenCreateContract,
  onOpenConfirmPayment,
  onOpenSendReminder,
  onOpenAddPaymentAccount,
  onSelectContract,
  userRole = 'proprietaire',
  userName,
  isDemo = false
}) => {
  const { user, profile } = useAuth();
  const [selectedYear, setSelectedYear] = useState('2026');

  const [isLoading, setIsLoading] = useState<boolean>(!isDemo);
  const [realProps, setRealProps] = useState<any[]>([]);
  const [realContracts, setRealContracts] = useState<any[]>([]);
  const [realPayments, setRealPayments] = useState<any[]>([]);
  const [realApplications, setRealApplications] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (isDemo) return;
    setIsLoading(true);
    try {
      // 1. Biens immobiliers
      let pQuery = supabase.from('properties').select('*').is('deleted_at', null);
      if (user?.id) pQuery = pQuery.eq('owner_id', user.id);
      const { data: propsData } = await pQuery;
      setRealProps(propsData || []);

      // 2. Contrats actifs
      let cQuery = supabase.from('contracts').select('*, tenant:users!tenant_id(*)');
      if (user?.id) cQuery = cQuery.eq('owner_id', user.id);
      const { data: contractsData } = await cQuery;
      setRealContracts(contractsData || []);

      // 3. Règlements de loyers
      let pmQuery = supabase.from('rent_payments').select('*');
      if (user?.id) pmQuery = pmQuery.eq('owner_id', user.id);
      const { data: paymentsData } = await pmQuery;
      setRealPayments(paymentsData || []);

      // 4. Candidatures de location
      const { data: appsData } = await supabase.from('rental_applications').select('*');
      setRealApplications(appsData || []);
    } catch (err) {
      console.warn('Dashboard live fetch notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Écouteurs d'événements pour mise à jour instantanée sans forcer l'utilisateur à actualiser
    const handleLiveUpdate = () => {
      fetchDashboardData();
    };

    window.addEventListener('locatrust:properties-updated', handleLiveUpdate);
    window.addEventListener('locatrust:applications-updated', handleLiveUpdate);
    window.addEventListener('locatrust:payments-updated', handleLiveUpdate);
    window.addEventListener('locatrust:cautions_updated', handleLiveUpdate);

    return () => {
      window.removeEventListener('locatrust:properties-updated', handleLiveUpdate);
      window.removeEventListener('locatrust:applications-updated', handleLiveUpdate);
      window.removeEventListener('locatrust:payments-updated', handleLiveUpdate);
      window.removeEventListener('locatrust:cautions_updated', handleLiveUpdate);
    };
  }, [user, isDemo]);

  // Calculs dynamiques basés sur les données réelles
  const totalProps = isDemo ? 12 : realProps.length;
  const activeProps = isDemo ? 10 : realProps.filter(p => p.status === 'disponible' || p.status === 'loue').length;
  const inactiveProps = isDemo ? 2 : realProps.filter(p => p.status === 'desactive').length;

  const totalTenants = isDemo ? 7 : realContracts.filter(c => c.status === 'actif' || c.status === 'contrat_actif').length;

  // Calculs financiers réels
  const realExpectedRent = realProps.reduce((sum, p) => sum + (Number(p.rent) || 0), 0);
  const realCollectedRent = realPayments.filter(p => p.status === 'confirme').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const realLateRent = realPayments.filter(p => p.status === 'declare').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const rentMetrics = isDemo ? {
    expected: 2800000,
    collected: 2450000,
    late: 350000
  } : {
    expected: realExpectedRent,
    collected: realCollectedRent,
    late: realLateRent
  };

  const cautionMetrics = isDemo ? {
    expected: 5600000,
    held: 4900000
  } : {
    expected: realProps.reduce((sum, p) => sum + (Number(p.caution) || 0), 0),
    held: realContracts.reduce((sum, c) => sum + (Number(c.caution) || 0), 0)
  };

  const maintenanceMetrics = isDemo ? {
    month: 45000,
    year: 285000
  } : {
    month: 0,
    year: 0
  };

  // DONNÉES ANNUELLES 2026
  const annualData2026 = isDemo ? [
    { month: 'Janvier', expected: 2800000, collected: 2800000, late: 0, maintenance: 35000, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Février', expected: 2800000, collected: 2800000, late: 0, maintenance: 0, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Mars', expected: 2800000, collected: 2800000, late: 0, maintenance: 50000, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Avril', expected: 2800000, collected: 2800000, late: 0, maintenance: 25000, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Mai', expected: 2800000, collected: 2800000, late: 0, maintenance: 40000, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Juin', expected: 2800000, collected: 2800000, late: 0, maintenance: 0, cautionRefunded: 700000, otherExpenses: 0 },
    { month: 'Juillet', expected: 2800000, collected: 2800000, late: 0, maintenance: 90000, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Août', expected: 2800000, collected: 2450000, late: 350000, maintenance: 0, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Septembre', expected: 2800000, collected: 2450000, late: 350000, maintenance: 45000, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Octobre (prev.)', expected: 2800000, collected: 0, late: 0, maintenance: 0, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Novembre (prev.)', expected: 2800000, collected: 0, late: 0, maintenance: 0, cautionRefunded: 0, otherExpenses: 0 },
    { month: 'Décembre (prev.)', expected: 2800000, collected: 0, late: 0, maintenance: 0, cautionRefunded: 0, otherExpenses: 0 },
  ] : [];

  // Calculs totaux annuels
  const annualTotals = annualData2026.reduce(
    (acc, m) => {
      const totalIn = m.collected;
      const totalOut = m.maintenance + m.cautionRefunded + m.otherExpenses;
      const net = totalIn - totalOut;
      return {
        expected: acc.expected + m.expected,
        collected: acc.collected + m.collected,
        late: acc.late + m.late,
        maintenance: acc.maintenance + m.maintenance,
        cautionRefunded: acc.cautionRefunded + m.cautionRefunded,
        totalIn: acc.totalIn + totalIn,
        totalOut: acc.totalOut + totalOut,
        net: acc.net + net,
      };
    },
    { expected: 0, collected: 0, late: 0, maintenance: 0, cautionRefunded: 0, totalIn: 0, totalOut: 0, net: 0 }
  );

  const netMetrics = isDemo ? {
    month: 2405000,
    year: annualTotals.net
  } : {
    month: 0,
    year: 0
  };

  const isVerified = profile?.verification_status === 'verifie';

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* 1. TOP BANNER GREETING AVEC ACTIONS RAPIDES ÉPURÉES */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Bonjour, {userName || (userRole === 'agence' ? "Immobilière du Golf" : "Bailleur")}
            </h1>
            <span className="text-xl">👋</span>
            {isVerified && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bailleur Certifié par l'Admin</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Tableau de bord de gestion locative certifiée LocaTrust • Données temps réel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenAddProperty}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un bien</span>
          </button>
        </div>
      </div>


      {/* 1.B. NOTIFICATIONS PRIORITAIRES DASHBOARD DYNAMIQUES */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PriorityNotificationSkeleton />
          <PriorityNotificationSkeleton />
        </div>
      ) : (() => {
        // Demandes réelles en attente
        const pendingApps = realApplications.filter((a: any) => a.status === 'en_attente');
        // Paiements réels en attente
        const pendingPayments = realPayments.filter((p: any) => p.status === 'declare');

        if (pendingApps.length === 0 && pendingPayments.length === 0) return null;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingApps.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 rounded-2xl border border-blue-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col min-w-0 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 truncate">Nouvelle demande de location</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black uppercase">Nouveau</span>
                    </div>
                    <span className="text-[11px] text-slate-600 truncate">
                      <strong>{pendingApps[0].tenant_name || 'Candidat'}</strong> • {pendingApps[0].property_title || 'Bien immobilier'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateTab('applications')}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-all shrink-0 active:scale-95 flex items-center justify-center gap-1"
                >
                  <span>Consulter la demande</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {pendingPayments.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50/60 p-3.5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CreditCard className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col min-w-0 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 truncate">Paiement déclaré en attente</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase">À valider</span>
                    </div>
                    <span className="text-[11px] text-slate-600 truncate">
                      <strong>{pendingPayments[0].tenant?.full_name || 'Locataire'}</strong> • {formatFCFA(pendingPayments[0].amount || 0)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateTab('payments')}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all shrink-0 active:scale-95 flex items-center justify-center gap-1"
                >
                  <span>Vérifier dans Paiements</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 2. GRILLE DE CARTES KPI SIMPLIFIÉES, COMPACTES, DENSES ET CLIQUABLES (Points 1 à 7, 22) */}
      {isLoading ? (
        <KpiGridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        
        {/* CARTE 1 : BIENS IMMOBILIERS (Point 2 - Vision rapide : 12 / Actifs 10, Inactifs 2) */}
        <div
          onClick={() => onNavigateTab('properties')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
          title="Cliquez pour ouvrir le menu Biens immobiliers"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">BIENS IMMOBILIERS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900">{totalProps}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-600 font-medium">Actifs :</span>
              <strong className="text-emerald-700 font-black">{activeProps}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-600 font-medium">Inactifs :</span>
              <strong className="text-slate-600 font-black">{inactiveProps}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 2 : LOCATAIRES (Point 3 - Uniquement locataires actifs) */}
        <div
          onClick={() => onNavigateTab('tenants')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
          title="Cliquez pour ouvrir le menu Locataires"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-4.5 h-4.5" />
              </div>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">LOCATAIRES</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900">{totalTenants}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span className="text-emerald-900 font-bold">Locataires actifs :</span>
              <strong className="text-emerald-700 font-black">{totalTenants}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg text-slate-500">
              <span>Anciens locataires :</span>
              <span className="font-semibold text-slate-700">Archivés dans Historique</span>
            </div>
          </div>
        </div>

        {/* CARTE 3 : LOYERS (Point 4 - Attendu, Encaissé, Restant, En retard) */}
        <div
          onClick={() => onNavigateTab('payments')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
          title="Cliquez pour ouvrir Paiements et loyers"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Wallet className="w-4.5 h-4.5" />
              </div>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">LOYERS CE MOIS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-blue-700">{formatFCFA(rentMetrics.collected)}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-md">
              <span className="text-slate-500">Montant attendu :</span>
              <strong className="text-slate-900">{formatFCFA(rentMetrics.expected)}</strong>
            </div>
            <div className="flex items-center justify-between bg-emerald-50 px-2.5 py-1 rounded-md">
              <span className="text-emerald-900 font-bold">Montant encaissé :</span>
              <strong className="text-emerald-700 font-black">{formatFCFA(rentMetrics.collected)}</strong>
            </div>
            <div className="flex items-center justify-between bg-rose-50 px-2.5 py-1 rounded-md">
              <span className="text-rose-900 font-bold">Montant restant (retard) :</span>
              <strong className="text-rose-700 font-black">{formatFCFA(rentMetrics.late)}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 4 : CAUTIONS (Point 5 - Caution attendue, Caution détenue) */}
        <div
          onClick={() => onNavigateTab('guarantees')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-cyan-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
          title="Cliquez pour ouvrir Cautions"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">CAUTIONS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-cyan-800">{formatFCFA(cautionMetrics.held)}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-500">Caution attendue :</span>
              <strong className="text-slate-900">{formatFCFA(cautionMetrics.expected)}</strong>
            </div>
            <div className="flex items-center justify-between bg-cyan-50 px-2.5 py-1.5 rounded-lg border border-cyan-100">
              <span className="text-cyan-900 font-bold">Caution détenue :</span>
              <strong className="text-cyan-700 font-black">{formatFCFA(cautionMetrics.held)}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 5 : MAINTENANCE (Point 6 - Dépensé ce mois / Dépensé cette année) */}
        <div
          onClick={() => onNavigateTab('maintenance')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-orange-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
          title="Cliquez pour ouvrir Maintenance"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Wrench className="w-4.5 h-4.5" />
              </div>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">MAINTENANCE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-orange-700">{formatFCFA(maintenanceMetrics.month)}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-500">Montant dépensé ce mois :</span>
              <strong className="text-slate-900 font-black">{formatFCFA(maintenanceMetrics.month)}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-500">Montant dépensé cette année :</span>
              <strong className="text-slate-900 font-black">{formatFCFA(maintenanceMetrics.year)}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 6 : RÉSULTAT NET (Point 7 - Résultat net du mois / Résultat net de l'année) */}
        <div
          onClick={() => onNavigateTab('stats')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
          title="Cliquez pour ouvrir Rapport et statistiques"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">RÉSULTAT NET</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-emerald-700">+{formatFCFA(netMetrics.month)}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span className="text-emerald-900 font-bold">Résultat net du mois :</span>
              <strong className="text-emerald-700 font-black">+{formatFCFA(netMetrics.month)}</strong>
            </div>
            <div className="flex items-center justify-between bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
              <span className="text-blue-900 font-bold">Résultat net de l'année :</span>
              <strong className="text-blue-800 font-black">+{formatFCFA(netMetrics.year)}</strong>
            </div>
          </div>
        </div>
      </div>
      )}



      {/* 3. VUE ANNUELLE MOIS PAR MOIS (Point 16 - Janvier à Décembre avec calculs réels) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Statistiques Annuelles — Vue Mois par Mois</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px]">
                  Année 2026
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Calculs automatiques à partir des encaissements réels, retards et dépenses enregistrés
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Exercice :</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="2026">2026 (En cours)</option>
              <option value="2025">2025 (Clôturé)</option>
            </select>
          </div>
        </div>

        {/* Tableau Annuel Complet */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3.5">Mois</th>
                <th className="py-3 px-3.5">Loyers attendus</th>
                <th className="py-3 px-3.5">Loyers encaissés</th>
                <th className="py-3 px-3.5">Loyers en retard</th>
                <th className="py-3 px-3.5">Maintenance</th>
                <th className="py-3 px-3.5">Cautions remboursées</th>
                <th className="py-3 px-3.5">Total encaissé</th>
                <th className="py-3 px-3.5">Total dépensé</th>
                <th className="py-3 px-3.5 text-right font-black">Résultat net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {annualData2026.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Calendar className="w-8 h-8 text-slate-300" />
                      <span className="font-bold text-slate-600 text-xs">Aucune transaction enregistrée pour 2026</span>
                      <span className="text-[11px] text-slate-400">Vos encaissements de loyers et quittances validées généreront automatiquement ce tableau comptable.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                annualData2026.map((row, idx) => {
                  const totalIn = row.collected;
                  const totalOut = row.maintenance + row.cautionRefunded + row.otherExpenses;
                  const net = totalIn - totalOut;
                  const isCurrentMonth = row.month === 'Septembre';

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrentMonth ? 'bg-blue-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                        {isCurrentMonth && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                        <span>{row.month}</span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">{formatFCFA(row.expected)}</td>
                      <td className="py-3 px-3.5 font-bold text-emerald-700">
                        {row.collected > 0 ? formatFCFA(row.collected) : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-rose-600 font-bold">
                        {row.late > 0 ? formatFCFA(row.late) : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        {row.maintenance > 0 ? formatFCFA(row.maintenance) : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        {row.cautionRefunded > 0 ? formatFCFA(row.cautionRefunded) : '—'}
                      </td>
                      <td className="py-3 px-3.5 font-extrabold text-blue-700">
                        {totalIn > 0 ? formatFCFA(totalIn) : '—'}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-700">
                        {totalOut > 0 ? formatFCFA(totalOut) : '0 FCFA'}
                      </td>
                      <td className={`py-3 px-3.5 text-right font-black ${net > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {totalIn > 0 ? `+${formatFCFA(net)}` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                <td className="py-3.5 px-3.5 uppercase tracking-wider text-blue-900 font-black">
                  TOTAL ANNUEL
                </td>
                <td className="py-3.5 px-3.5 text-slate-700">{formatFCFA(annualTotals.expected)}</td>
                <td className="py-3.5 px-3.5 text-emerald-800">{formatFCFA(annualTotals.collected)}</td>
                <td className="py-3.5 px-3.5 text-rose-700">{formatFCFA(annualTotals.late)}</td>
                <td className="py-3.5 px-3.5 text-slate-700">{formatFCFA(annualTotals.maintenance)}</td>
                <td className="py-3.5 px-3.5 text-slate-700">{formatFCFA(annualTotals.cautionRefunded)}</td>
                <td className="py-3.5 px-3.5 text-blue-900">{formatFCFA(annualTotals.totalIn)}</td>
                <td className="py-3.5 px-3.5 text-slate-900">{formatFCFA(annualTotals.totalOut)}</td>
                <td className="py-3.5 px-3.5 text-right text-emerald-800 text-sm font-black">
                  +{formatFCFA(annualTotals.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. ACTIONS RAPIDES & DERNIÈRES NOTIFICATIONS LOCATIVES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Contrats récents réels */}
        {(() => {
          const realContracts = (() => {
            if (typeof window !== 'undefined') {
              try {
                const raw = localStorage.getItem('locatrust_contracts');
                if (raw) {
                  const list = JSON.parse(raw);
                  if (Array.isArray(list)) return list;
                }
              } catch (e) {}
            }
            return [];
          })();

          return (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-black text-slate-900">Contrats récents & Signatures</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('contracts')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Tous les contrats</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {realContracts.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-bold text-slate-700">Aucun contrat enregistré</span>
                    <span className="text-[11px] text-slate-400">Vos baux certifiés conformes Loi 2019-576 apparaîtront ici.</span>
                  </div>
                ) : (
                  realContracts.slice(0, 3).map((ct: any, idx: number) => (
                    <div
                      key={ct.id || idx}
                      onClick={() => onSelectContract(ct.id || ct.contract_number)}
                      className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-xs">
                          <span className="font-extrabold text-slate-900">{ct.tenant_name || 'Locataire'} • {ct.property_title || 'Bien'}</span>
                          <span className="text-[10px] text-emerald-700 font-bold">{ct.contract_number || 'Bail certifié'} • {ct.status || 'Actif'}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* Demandes réelles de location */}
        {(() => {
          const realApps = (() => {
            if (typeof window !== 'undefined') {
              try {
                const raw = localStorage.getItem('locatrust_rental_applications');
                if (raw) {
                  const list = JSON.parse(raw);
                  if (Array.isArray(list)) return list;
                }
              } catch (e) {}
            }
            return [];
          })();

          return (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-black text-slate-900">Demandes de location reçues</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('applications')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Voir les candidatures ({realApps.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {realApps.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <Users className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-bold text-slate-700">Aucune candidature reçue</span>
                    <span className="text-[11px] text-slate-400">Les candidatures envoyées par les locataires apparaîtront ici.</span>
                  </div>
                ) : (
                  realApps.slice(0, 3).map((dem: any, idx: number) => (
                    <div
                      key={dem.id || idx}
                      onClick={() => onNavigateTab('applications')}
                      className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900">{dem.tenant_name || 'Candidat'}</span>
                        <span className="text-[11px] text-slate-500">{dem.property_title || 'Logement'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                          {dem.status === 'en_attente' ? 'En attente' : dem.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

      </div>

    </div>
  );
};
