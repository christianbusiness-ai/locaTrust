import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Wallet,
  AlertTriangle,
  Plus,
  ArrowRight,
  UserPlus,
  FileText,
  CreditCard,
  Send,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Briefcase,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';

interface AgenceDashboardViewProps {
  onNavigateTab: (tabId: string) => void;
  onOpenAddProperty: () => void;
  onOpenCreateContract?: () => void;
  onOpenConfirmPayment: () => void;
  onOpenInviteMember: () => void;
  onOpenAddOwner: () => void;
}

export const AgenceDashboardView: React.FC<AgenceDashboardViewProps> = ({
  onNavigateTab,
  onOpenAddProperty,
  onOpenCreateContract,
  onOpenConfirmPayment,
  onOpenInviteMember,
  onOpenAddOwner,
}) => {
  const { user, profile } = useAuth();
  const [totalProperties, setTotalProperties] = useState<number>(0);
  const [managedOwners, setManagedOwners] = useState<any[]>([]);
  const [totalCollectedRent, setTotalCollectedRent] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgencyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Properties count rattachés à cette agence
      let propsQuery = supabase
        .from('properties')
        .select('id', { count: 'exact', head: true });
      if (user?.id) {
        propsQuery = propsQuery.or(`agency_id.eq.${user.id},owner_id.eq.${user.id}`);
      }
      const { count: propsCount } = await propsQuery;
      setTotalProperties(propsCount || 0);

      // Mandats réels de l'agence (stockage local ou table)
      let agencyOwners: any[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('locatrust_agency_mandates');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              agencyOwners = parsed.filter((o: any) => o.id !== 'owner_101' && o.id !== 'owner_102' && o.id !== 'owner_103' && o.id !== 'owner_104');
            }
          }
        } catch (e) {
          agencyOwners = [];
        }
      }
      setManagedOwners(agencyOwners);

      // Total collected rent
      const { data: paymentsData, error: payErr } = await supabase
        .from('rent_payments')
        .select('amount, status');
      if (payErr) throw payErr;

      const sum = (paymentsData || [])
        .filter((p) => p.status === 'valide' || p.status === 'validé' || p.status === 'Payé')
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      setTotalCollectedRent(sum);
    } catch (err: any) {
      console.error('Erreur chargement données agence:', err);
      setError('Impossible de charger les données du portefeuille agence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencyData();
  }, [user?.id]);

  const agencyName = profile?.full_name || 'Agence Immobilière Agréée';

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {agencyName}
            </h2>
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-black uppercase">
              Agence Agréée
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Aperçu global de votre portefeuille multi-propriétaires et de votre équipe de gestion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddOwner}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold transition-all"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>Nouveau Propriétaire</span>
          </button>

          <button
            onClick={onOpenAddProperty}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter au mandat</span>
          </button>
        </div>
      </div>

      {/* STATE 1: LOADER */}
      {loading && (
        <div className="p-16 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">Chargement du tableau de bord agence...</p>
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
            onClick={fetchAgencyData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* Top 4 KPI Cards for Agency */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Parc Immobilier Géré */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500">Parc Immobilier Agence</span>
                <span className="text-2xl font-black text-slate-900 mt-1">{totalProperties} bien(s)</span>
                <span className="text-[11px] text-slate-400">Sous mandat actif</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('properties')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
            >
              <span>Gérer le parc immobilier</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Card 2: Propriétaires Mandants */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500">Propriétaires Mandants</span>
                <span className="text-2xl font-black text-slate-900 mt-1">{managedOwners.length} bailleur(s)</span>
                <span className="text-[11px] text-slate-400">Bailleurs sous contrat</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('owners')}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 group"
            >
              <span>Voir les propriétaires</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Card 3: Encaissé Global Agence */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500">Loyers Encaissés</span>
                <span className="text-xl font-black text-emerald-600 mt-1">{formatFCFA(totalCollectedRent)}</span>
                <span className="text-[11px] text-slate-400">Confirmés uniquement</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('payments')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
            >
              <span>Détails des encaissements</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Card 4: Équipe & Collaborateurs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500">Équipe Agence</span>
                <span className="text-2xl font-black text-slate-900 mt-1">Actif</span>
                <span className="text-[11px] text-slate-400">Gestionnaires & comptables</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('team')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
            >
              <span>Gérer l'équipe</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      )}

      {/* Middle Section: Mandats récents & Collaborateurs de garde */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left 8 Cols: Mandats récents */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Propriétaires Mandants sous Gestion</h3>
                  <span className="text-xs text-slate-500">Portefeuille agrégé de l'agence</span>
                </div>
                <button
                  onClick={() => onNavigateTab('owners')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Tous les bailleurs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* STATE 3: EMPTY STATE FOR OWNERS */}
              {managedOwners.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Aucun propriétaire sous mandat</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Ajoutez vos mandants pour rattacher leurs biens et suivre les encaissements locatifs en leur nom.
                  </p>
                  <button
                    onClick={onOpenAddOwner}
                    className="mt-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all"
                  >
                    Ajouter un propriétaire
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {managedOwners.map((owner) => (
                    <div key={owner.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                          {(owner.full_name || 'PR').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-extrabold text-slate-900">{owner.full_name || owner.email}</span>
                          <span className="text-[11px] text-slate-500">{owner.phone || 'Contact certifié'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                          Mandat Actif
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Quick Agency Actions & Subscription snapshot */}
          <div className="lg:col-span-4 flex flex-col gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <h3 className="text-sm font-black text-slate-900">Actions Agence</h3>

            <button
              onClick={onOpenAddOwner}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 flex items-center gap-3 text-left transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <UserPlus className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900">Ajouter un propriétaire</span>
                <span className="text-[11px] text-slate-500">Nouveau mandat de gestion</span>
              </div>
            </button>

            <button
              onClick={onOpenInviteMember}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 flex items-center gap-3 text-left transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900">Inviter un collaborateur</span>
                <span className="text-[11px] text-slate-500">Ajouter à l'équipe agence</span>
              </div>
            </button>

            <button
              onClick={onOpenAddProperty}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 flex items-center gap-3 text-left transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900">Ajouter un bien</span>
                <span className="text-[11px] text-slate-500">Entrée dans le parc agence</span>
              </div>
            </button>

          </div>

        </div>

      </div>
      )}

    </div>
  );
};
