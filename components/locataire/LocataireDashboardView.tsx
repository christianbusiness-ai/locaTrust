import React, { useState, useEffect } from 'react';
import {
  Home,
  FileText,
  CreditCard,
  Receipt,
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Send,
  Plus,
  Eye,
  Heart,
  Loader2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';

interface LocataireDashboardViewProps {
  onNavigateTab: (tabId: string) => void;
  onOpenDeclarePaymentModal: () => void;
  onOpenReportIssueModal: () => void;
}

export const LocataireDashboardView: React.FC<LocataireDashboardViewProps> = ({
  onNavigateTab,
  onOpenDeclarePaymentModal,
  onOpenReportIssueModal,
}) => {
  const { user, profile } = useAuth();
  const [activeContract, setActiveContract] = useState<any>(null);
  const [lastPayment, setLastPayment] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active contract
      let contractQuery = supabase
        .from('contracts')
        .select('*, property:properties(*)')
        .order('created_at', { ascending: false });

      if (user?.id) {
        contractQuery = contractQuery.eq('tenant_id', user.id);
      }

      const { data: contractsData, error: cErr } = await contractQuery;
      if (cErr) throw cErr;

      const currentContract = contractsData && contractsData.length > 0 ? contractsData[0] : null;
      setActiveContract(currentContract);

      // Fetch latest payment
      let paymentQuery = supabase
        .from('rent_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (user?.id) {
        paymentQuery = paymentQuery.eq('tenant_id', user.id);
      }

      const { data: paymentsData, error: pErr } = await paymentQuery;
      if (!pErr && paymentsData && paymentsData.length > 0) {
        setLastPayment(paymentsData[0]);
      } else {
        setLastPayment(null);
      }
    } catch (err: any) {
      console.error('Erreur chargement tableau de bord locataire:', err);
      setError('Impossible de charger les données de votre espace locataire.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const firstName = profile?.full_name 
    ? profile.full_name.split(' ')[0] 
    : (user?.email ? user.email.split('@')[0] : 'Locataire');

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Bonjour {firstName}</span>
            <span className="text-xl">👋</span>
          </h2>
          <p className="text-xs text-slate-500">
            Espace locataire sécurisé — Retrouvez vos baux, reçus de loyer et demandes.
          </p>
        </div>

        <button
          onClick={onOpenDeclarePaymentModal}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all active:scale-95 shrink-0"
        >
          <CreditCard className="w-4 h-4" />
          <span>J'ai effectué un paiement</span>
        </button>
      </div>

      {/* STATE 1: LOADER */}
      {loading && (
        <div className="p-16 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">Chargement de votre espace locataire...</p>
        </div>
      )}

      {/* STATE 2: ERROR */}
      {error && !loading && (
        <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            <span className="text-xs font-bold">{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* STATE 3: EMPTY STATE (No active contract) */}
      {!loading && !error && !activeContract && (
        <div className="flex flex-col gap-6">
          <div className="p-12 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Home className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-black text-slate-900">Aucun contrat de location actif</h3>
              <p className="text-xs text-slate-500 mt-1">
                Vous n'avez pas encore de bail enregistré sur votre compte. Parcourez nos annonces certifiées pour trouver votre prochain logement.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('feed')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              <span>Explorer les offres disponibles</span>
            </button>
          </div>

          {/* Quick Actions Bar even without contract */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Besoin d'assistance ?</span>
                <span className="text-[11px] text-slate-500">Contactez le support ou déclarez un incident</span>
              </div>
            </div>
            <button
              onClick={onOpenReportIssueModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold rounded-xl transition-all"
            >
              Signaler un incident
            </button>
          </div>
        </div>
      )}

      {/* WITH ACTIVE CONTRACT */}
      {!loading && !error && activeContract && (
        <>
          {/* 4 Tenant KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Logement Actuel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500">Logement Actuel</span>
                  <span className="text-base font-black text-slate-900 mt-1 truncate max-w-[160px]">
                    {activeContract.property?.title || 'Logement conventionné'}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-extrabold">Bail Actif</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5" />
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('contracts')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
              >
                <span>Consulter mon contrat</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Card 2: Loyer Mensuel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500">Loyer Mensuel</span>
                  <span className="text-xl font-black text-slate-900 mt-1">
                    {formatFCFA(activeContract.rent || 0)}
                  </span>
                  <span className="text-[11px] text-slate-400">Échéance le 5 de chaque mois</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <button
                onClick={onOpenDeclarePaymentModal}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
              >
                <span>Déclarer un règlement</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Card 3: Dernier Règlement */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500">Dernière Quittance</span>
                  <span className="text-xl font-black text-emerald-600 mt-1">
                    {lastPayment ? formatFCFA(lastPayment.amount) : 'À jour'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {lastPayment?.reference ? `Ref: ${lastPayment.reference}` : 'Quittances disponibles'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('receipts')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
              >
                <span>Télécharger ma quittance</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Card 4: Caution Versée */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500">Dépôt de Garantie</span>
                  <span className="text-xl font-black text-slate-900 mt-1">
                    {formatFCFA(activeContract.caution || 0)}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-extrabold">Conservé en sécurité</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('guarantees')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
              >
                <span>Détails de la caution</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

          {/* Middle Section: Contrat Actuel & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Cols: Contrat & Bailleur info */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Mon Bail de Location Sécurisé</h3>
                    <span className="text-xs text-slate-500">Bail d'habitation conforme à la loi n°2019-576</span>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full">
                    Contrat Signé & Enregistré
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {activeContract.property?.photos?.[0] ? (
                      <img
                        src={activeContract.property.photos[0]}
                        alt="Mon logement"
                        className="w-16 h-16 rounded-xl object-cover border"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Home className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex flex-col text-xs">
                      <span className="font-extrabold text-slate-900 text-sm">{activeContract.property?.title || 'Logement conventionné'}</span>
                      <span className="text-slate-500">Bailleur: <strong>Propriétaire Certifié</strong></span>
                      <span className="text-slate-500">Durée: <strong>{activeContract.duration_months || 12} mois</strong> (Preavis {activeContract.notice_period_days || 90} jours)</span>
                    </div>
                  </div>

                  <div className="flex flex-col text-right text-xs">
                    <span className="font-black text-blue-600 text-base">{formatFCFA(activeContract.rent || 0)} / mois</span>
                    <span className="text-slate-400 text-[10px]">Charges incluses: {formatFCFA(activeContract.charges || 0)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right 4 Cols: Actions Rapides Locataire */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-black text-slate-900">Actions Locataire</h3>

                <button
                  onClick={onOpenDeclarePaymentModal}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 flex items-center gap-3 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-slate-900">Déclarer un paiement</span>
                    <span className="text-[11px] text-slate-500">Transmettre ma référence</span>
                  </div>
                </button>

                <button
                  onClick={onOpenReportIssueModal}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 flex items-center gap-3 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-slate-900">Signaler un problème</span>
                    <span className="text-[11px] text-slate-500">Demande de maintenance</span>
                  </div>
                </button>

                <button
                  onClick={() => onNavigateTab('feed')}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 flex items-center gap-3 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Home className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-slate-900">Chercher un nouveau bien</span>
                    <span className="text-[11px] text-slate-500">Consulter le fil d'annonces</span>
                  </div>
                </button>
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
};
