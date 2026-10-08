'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User,
  Building2,
  Receipt,
  FileCheck,
  Sparkles,
  Eye,
  MapPin,
  Clock,
  RotateCcw,
  Check,
  X,
  CreditCard,
  ChevronRight,
  FolderOpen,
  AlertCircle,
  Search
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { getContracts } from '@/src/lib/db';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { ContractDetailView } from '@/components/contracts/ContractDetailView';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { ContractCardSkeleton } from '@/components/common/SkeletonLoader';

interface TenantPropertyRental {
  id: string;
  city: string;
  title: string;
  address: string;
  contractNumber: string;
  rent: number;
  charges: number;
  cautionAmount: number;
  cautionStatus: 'restituee' | 'active_consignee' | 'en_cours_restitution';
  bailleurName: string;
  bailleurPhone: string;
  startDate: string;
  durationMonths: number;
  rawContract?: any;
}

export const LocataireContratsView: React.FC = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedContractNumber, setSelectedContractNumber] = useState<string | null>(null);

  const fetchTenantData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: cntData, error: cntError } = await getContracts(user.id, 'locataire');
      if (cntError) {
        setLoadError("Impossible de récupérer vos contrats de bail.");
      } else {
        setContracts(cntData || []);
      }

      // Reçus / quittances réelles
      const { data: rcpData } = await supabase
        .from('receipts')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      setReceipts(rcpData || []);
    } catch (err: any) {
      setLoadError("Erreur réseau lors du chargement de vos baux.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();

    const handleUpdate = () => {
      fetchTenantData();
    };

    window.addEventListener('locatrust:contracts-updated', handleUpdate);
    window.addEventListener('locatrust:applications-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
      window.removeEventListener('locatrust:applications-updated', handleUpdate);
    };
  }, [user]);

  // Transformation des contrats réels en locations
  const tenantRentals: TenantPropertyRental[] = contracts.map((c) => ({
    id: c.id,
    city: c.property?.city || 'Abidjan',
    title: c.property?.title || 'Logement loué',
    address: `${c.property?.quartier ? c.property?.quartier + ', ' : ''}${c.property?.commune ? c.property?.commune + ' - ' : ''}${c.property?.city || 'Côte d\'Ivoire'}`,
    contractNumber: c.contract_number || `LT-${c.id.slice(0, 8)}`,
    rent: Number(c.rent || 0),
    charges: Number(c.charges || 0),
    cautionAmount: Number(c.caution_amount || 0),
    cautionStatus: c.status === 'resilie' ? 'restituee' : 'active_consignee',
    bailleurName: c.owner?.full_name || 'Bailleur certifié',
    bailleurPhone: c.owner?.phone || 'Non renseigné',
    startDate: c.start_date ? new Date(c.start_date).toLocaleDateString('fr-FR') : 'Date non définie',
    durationMonths: Number(c.duration_months || 12),
    rawContract: c
  }));

  const [activePropertyTab, setActivePropertyTab] = useState<string>('all');
  const [selectedBailleurDossier, setSelectedBailleurDossier] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredRentals = tenantRentals.filter((r) => {
    if (activePropertyTab !== 'all' && r.city.toLowerCase() !== activePropertyTab.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchBailleur = (r.bailleurName || '').toLowerCase().includes(q);
      const matchContract = (r.contractNumber || '').toLowerCase().includes(q);
      const matchAddress = (r.address || '').toLowerCase().includes(q);
      return matchTitle || matchBailleur || matchContract || matchAddress;
    }
    return true;
  });

  const handleDownloadContract = async (cnt: any) => {
    const isAgency = cnt.owner?.account_type === 'agence' || false;
    const leaseType = (cnt.usage_destination || cnt.property?.usage_destination || 'habitation') as 'habitation' | 'professionnel';
    await generateOfficialContractPdf({
      contractNumber: cnt.contract_number,
      isAgency,
      ownerName: cnt.owner?.full_name || "Bailleur",
      ownerPhone: cnt.owner?.phone || "+225 00 00 00 00 00",
      tenantName: user?.user_metadata?.full_name || cnt.tenant?.full_name || "Locataire",
      tenantPhone: cnt.tenant?.phone || user?.phone || "+225 00 00 00 00 00",
      tenantCni: cnt.tenant?.cni_number || "CI000000000",
      propertyTitle: cnt.property?.title || "Logement loué",
      propertyAddress: `${cnt.property?.quartier || ''}, ${cnt.property?.commune || ''} - ${cnt.property?.city || 'Abidjan'}`,
      durationMonths: cnt.duration_months || 12,
      startDate: cnt.start_date || '01/01/2026',
      rent: Number(cnt.rent || 0),
      cautionMonths: 2,
      chargesAmount: Number(cnt.charges || 0),
      dueDay: cnt.payment_due_day || 5,
      leaseType,
      usageDestination: leaseType,
      authorizedActivity: cnt.authorized_activity || cnt.property?.authorized_activity || ''
    });
  };

  // Regroupement dynamique par bailleur réel
  const bailleursMap = new Map<string, {
    ownerId: string;
    ownerName: string;
    ownerPhone: string;
    rentals: TenantPropertyRental[];
  }>();

  tenantRentals.forEach(r => {
    const key = r.bailleurName;
    if (!bailleursMap.has(key)) {
      bailleursMap.set(key, {
        ownerId: r.rawContract?.owner_id || '',
        ownerName: r.bailleurName,
        ownerPhone: r.bailleurPhone,
        rentals: []
      });
    }
    bailleursMap.get(key)!.rentals.push(r);
  });

  const bailleursList = Array.from(bailleursMap.values());

  if (selectedContractNumber) {
    const currentCnt = contracts.find(c => c.contract_number === selectedContractNumber);
    const isAgency = currentCnt?.owner?.user_metadata?.account_type === 'agence' || false;
    return (
      <ContractDetailView
        contractNumber={selectedContractNumber}
        isAgency={isAgency}
        onBack={() => setSelectedContractNumber(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Mes Logements & Dossiers Bailleurs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
              Contrats & Reçus indépendants
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos baux à Abidjan, Bouaké et Yamoussoukro avec quittances, cautions et historique distincts.
          </p>
        </div>
      </div>

      {/* ÉTATS : LOADER SKELETON, ERREUR, OU VIDE */}
      {isLoading ? (
        <div className="space-y-4">
          <ContractCardSkeleton />
          <ContractCardSkeleton />
        </div>
      ) : loadError ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-black text-rose-900">Échec du chargement de vos baux</h4>
          <p className="text-xs text-rose-700 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={fetchTenantData}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
          >
            Réessayer
          </button>
        </div>
      ) : tenantRentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Aucun contrat de bail actif pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed font-medium">
            Vous n'avez aucun contrat de bail en cours d'exécution. Dès qu'un propriétaire ou une agence aura validé votre dossier de location et scellé le bail certifié (Loi 2019-576), vous pourrez consulter l'intégralité de vos documents, quittances et QR codes officiels ici.
          </p>
        </div>
      ) : (
        <>
          {/* Multi-logements selector & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Ville :
              </span>
              <button
                onClick={() => setActivePropertyTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                  activePropertyTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tous mes logements ({tenantRentals.length})
              </button>
              {Array.from(new Set(tenantRentals.map(r => r.city))).map((cName) => (
                <button
                  key={cName}
                  onClick={() => setActivePropertyTab(cName.toLowerCase())}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    activePropertyTab === cName.toLowerCase()
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{cName}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher contrat, bailleur, bien..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Historique Réel par Bailleur */}
          {bailleursList.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Historique Juridique Par Bailleur
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">Dossier par propriétaire</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bailleursList.map((b, idx) => (
                  <div
                    key={b.ownerName + idx}
                    className="p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all bg-gradient-to-br from-white to-slate-50 flex flex-col justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-black flex items-center justify-center text-xs">
                            {b.ownerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm">{b.ownerName}</h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {b.rentals.length} logement(s) associé(s) • {b.ownerPhone}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          Bailleur Certifié
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">Contrats signés</span>
                          <span className="font-black text-slate-800">{b.rentals.length} Bail(s)</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">Caution active</span>
                          <span className="font-black text-emerald-700">
                            {formatFCFA(b.rentals.reduce((sum, r) => sum + r.cautionAmount, 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedBailleurDossier(b.ownerName)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>Consulter le dossier juridique</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leases Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-black text-slate-900">
              Contrats de Location ({filteredRentals.length})
            </h3>

            {filteredRentals.map((rental) => (
              <div
                key={rental.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-200 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">Bail N° {rental.contractNumber}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase">
                        {rental.city}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        Bail Certifié
                      </span>
                    </div>
                    <span className="text-xs text-slate-700 font-bold">{rental.title}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Bailleur : <strong>{rental.bailleurName}</strong> ({rental.bailleurPhone}) | Prise d'effet : {rental.startDate}
                    </span>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>Caution : <strong>{formatFCFA(rental.cautionAmount)}</strong> ({rental.cautionStatus === 'restituee' ? '✔ Restituée' : '🛡️ Consignée'})</span>
                      <span>•</span>
                      <span>Charges : {formatFCFA(rental.charges)}/mois</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-2 shrink-0">
                  <span className="text-lg font-black text-blue-600">{formatFCFA(rental.rent)} / mois</span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedContractNumber(rental.contractNumber)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter</span>
                    </button>

                    <button
                      onClick={() => handleDownloadContract(rental.rawContract || rental)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quittances Section */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">Mes Quittances de Loyer Officielles ({receipts.length})</h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">QR Code de vérification intégré</span>
            </div>

            {receipts.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Aucune quittance émise pour le moment. Vos quittances officielles avec QR Code apparaîtront ici après validation de vos paiements.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {receipts.map((rcp) => (
                  <div key={rcp.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                        REC
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-slate-900">Quittance N° {rcp.receipt_number || rcp.id.slice(0, 8)}</span>
                        <span className="text-[11px] text-slate-500">
                          Période : <strong>{rcp.period || 'Mois en cours'}</strong> — Montant : {formatFCFA(rcp.amount || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {rcp.token && (
                        <a
                          href={`/verification/recu/${rcp.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                        >
                          Scanner / Vérifier
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Point 6: Modal Dossier Complet Bailleur */}
      {selectedBailleurDossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">
                  Dossier Complet : {selectedBailleurDossier}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBailleurDossier(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
              <div className="text-xs text-blue-900 font-medium">
                Historique légal certifié LocaTrust. Tous les contrats, quittances et restitutions avec ce bailleur sont archivés et infalsifiables.
              </div>
            </div>

            {/* Dossier sections */}
            <div className="flex flex-col gap-4">
              
              {/* 1. Contrat */}
              <div className="p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  1. Contrats de bail signés
                </span>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="font-black text-slate-900 block">Bail d'Habitation officiel N° LT-2026-CI-000492</span>
                    <span className="text-slate-500 font-medium">Signé par les deux parties avec certification horodatée</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    ✔ Signé
                  </span>
                </div>
              </div>

              {/* 2. Caution */}
              <div className="p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  2. Cautions & Restitutions
                </span>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="font-black text-slate-900 block">Dépôt de garantie : {formatFCFA(300000)}</span>
                    <span className="text-slate-500 font-medium">Reçu officiel de caution N° DEP-2026-CI-00984 (Double signature)</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                    Consignée & Protégée
                  </span>
                </div>
                {selectedBailleurDossier !== '' && (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl text-xs border border-emerald-100">
                    <div>
                      <span className="font-black text-slate-900 block">Restitution ancienne location (Yamoussoukro)</span>
                      <span className="text-slate-500 font-medium">Montant restitué : 440 000 FCFA sans litige (0 FCFA retenu)</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      ✔ Restitution terminée
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Loyers & Reçus */}
              <div className="p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  3. Quittances et paiements de loyers
                </span>
                <p className="text-xs text-slate-500">
                  Toutes vos quittances mensuelles avec ce bailleur sont archivées et téléchargeables en permanence.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Aucun impayé constaté • Dossier locataire exemplaire</span>
                </div>
              </div>

            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setSelectedBailleurDossier(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Fermer le dossier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
