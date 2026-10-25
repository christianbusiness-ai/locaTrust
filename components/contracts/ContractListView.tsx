'use client';

import {
  FileText,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  Plus,
  AlertTriangle,
  Send,
  MessageCircle,
  Bell,
  Download,
  RefreshCw,
  FileCheck,
  Eye,
  Loader2,
  ShieldCheck,
  ExternalLink,
  X
} from 'lucide-react';

import { LegalContractGeneratorModal } from '@/components/contracts/LegalContractGeneratorModal';
import { ActionConfirmationModal } from '@/components/common/ActionConfirmationModal';
import { sendContractReminderToTenant } from '@/lib/messagingStore';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { KpiGridSkeleton } from '@/components/common/SkeletonLoader';
import { collectProofDossierData, generateOfficialProofDossierPdf } from '@/lib/proofDossierPdfGenerator';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { formatFCFA } from '@/lib/utils';
import {
  getContractExpiryDetails,
  acceptContractRenewal,
  refuseContractRenewal
} from '@/lib/contractRenewalManager';

interface ContractListViewProps {
  onSelectContract?: (contractNumber: string) => void;
  onCreateContract?: () => void;
}

export const ContractListView: React.FC<ContractListViewProps> = ({
  onSelectContract,
  onCreateContract,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLocalCreateOpen, setIsLocalCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [generatingDossierId, setGeneratingDossierId] = useState<string | null>(null);

  // Modal « Action Renouvellement » (Accepter / Refuser)
  const [renewalActionModal, setRenewalActionModal] = useState<{
    isOpen: boolean;
    type: 'accept' | 'refuse';
    contract: any;
    durationMonths?: number;
    reason?: string;
  } | null>(null);

  // Modal « Votre dossier de preuve est prêt »
  const [proofReadyModal, setProofReadyModal] = useState<{
    isOpen: boolean;
    proofId: string;
    contractNumber: string;
    token: string;
    sha256Hash: string;
    data: any;
  } | null>(null);

  // Modal « Republier le logement »
  const [republishModal, setRepublishModal] = useState<{
    isOpen: boolean;
    contract: any;
    propertyTitle: string;
  } | null>(null);

  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const itemsPerPage = 6;

  const handleCreateClick = () => {
    setIsLocalCreateOpen(true);
    if (onCreateContract) {
      onCreateContract();
    }
  };

  const handleRelance = (
    contractId: string,
    tenantName: string,
    phone: string,
    bien: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    // Envoi réel dans la messagerie interne LocaTrust du locataire
    const targetContract = (contracts || []).find((c) => c.id === contractId);
    const targetTenantId = (targetContract as any)?.tenant_id || (targetContract as any)?.tenant?.id || 'usr_support';
    sendContractReminderToTenant(targetTenantId, contractId, tenantName, bien);

    setConfirmationModal({
      isOpen: true,
      title: 'Relance transmise dans la messagerie du locataire',
      message: `La relance pour la signature du contrat ${contractId} a été transmise avec succès dans la boîte interne LocaTrust de ${tenantName}.`,
      details: `Bien concerné : ${bien} • Téléphone : ${phone} • Un rappel de courtoisie SMS a également été préparé.`
    });
  };

  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContracts = async () => {
    setLoading(true);
    try {
      let query = supabase.from('contracts').select('*, property:properties(*)').order('created_at', { ascending: false });
      if (user?.id) {
        query = query.or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        // Enriched with tenant profiles
        const tenantIds = Array.from(new Set(data.map((c: any) => c.tenant_id).filter(Boolean)));
        const profilesMap = new Map<string, any>();
        if (tenantIds.length > 0) {
          try {
            const { data: profs } = await supabase.from('profiles').select('id, full_name, phone, email, avatar_url').in('id', tenantIds);
            if (profs) profs.forEach((p: any) => profilesMap.set(p.id, p));
          } catch {}
        }
        const mapped = data.map((c: any) => {
          const tenantProf = profilesMap.get(c.tenant_id) || c.tenant;
          return {
            id: c.contract_number || c.id || 'CT-2026-0001',
            locataire: tenantProf?.full_name || c.tenant_name || 'Locataire',
            role: 'Locataire',
            avatar: tenantProf?.avatar_url || c.tenant_avatar || '',
            bien: c.property?.title || c.property_title || 'Bien immobilier',
            quartier: `${c.property?.commune || ''} ${c.property?.city || 'Abidjan'}`,
            periode: c.periode || `${new Date(c.created_at || Date.now()).toLocaleDateString('fr-FR')} - ${new Date(Date.now() + 365*24*3600*1000).toLocaleDateString('fr-FR')}`,
          statut:
            c.status === 'actif' || c.status === 'signe'
              ? 'Actif'
              : c.status === 'en_attente'
              ? 'En attente signature locataire'
              : c.status === 'termine' || c.status === 'cloture' || c.status === 'resilie'
              ? 'Terminé'
              : c.status === 'fin_contrat'
              ? 'Fin bientôt'
              : 'Actif',
          dateSignature: c.signature_date ? `Signé le ${new Date(c.signature_date).toLocaleDateString('fr-FR')}` : 'En cours',
          bailleurSigne: Boolean(c.owner_signed ?? c.owner_signature ?? true),
          locataireSigne: Boolean(c.tenant_signed ?? c.tenant_signature),
          telephone: c.tenant?.phone || c.tenant_phone || '+225 07 00 00 00 00',
          raw: c
        };
      });
        setContracts(mapped);
        setLoading(false);
        return;
      }

      // Si base vide, vérifier si un contrat a été créé localement dans cette session
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('locatrust_contracts');
        if (raw) {
          const list = JSON.parse(raw);
          const myList = Array.isArray(list) ? list.filter((c: any) => !user?.id || c.owner_id === user.id || c.agency_id === user.id) : [];
          if (myList.length > 0) {
            const mapped = myList.map((c: any) => ({
              id: c.contract_number || c.id || 'CT-2026-0001',
              locataire: c.tenant_name || 'Locataire',
              role: 'Locataire',
              avatar: c.tenant_avatar || '',
              bien: c.property_title || 'Bien immobilier',
              quartier: c.property_address || c.property_city || 'Abidjan',
              periode: c.periode || `${new Date().toLocaleDateString('fr-FR')} - ${new Date(Date.now() + 365*24*3600*1000).toLocaleDateString('fr-FR')}`,
              statut:
                c.status === 'actif' || c.status === 'signe'
                  ? 'Actif'
                  : c.status === 'en_attente'
                  ? 'En attente signature locataire'
                  : c.status === 'termine' || c.status === 'cloture' || c.status === 'resilie'
                  ? 'Terminé'
                  : c.status === 'fin_contrat'
                  ? 'Fin bientôt'
                  : 'Actif',
              dateSignature: c.signature_date ? `Signé le ${new Date(c.signature_date).toLocaleDateString('fr-FR')}` : 'En cours',
              bailleurSigne: Boolean(c.owner_signature || true),
              locataireSigne: Boolean(c.tenant_signature),
              telephone: c.tenant_phone || '+225 07 00 00 00 00',
              raw: c
            }));
            setContracts(mapped);
            setLoading(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Contracts read error:', e);
    }
    setContracts([]);
    setLoading(false);
  };

  // Génération officielle du Dossier de preuve pour les contrats terminés (Section 4 & 5)
  const handleGenerateProofDossier = async (c: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGeneratingDossierId(c.id);

    try {
      const rawContract = c.raw || {
        contract_number: c.id,
        id: c.id,
        tenant_name: c.locataire,
        property_title: c.bien,
        property_address: c.quartier,
        status: 'termine'
      };

      const dossierData = await collectProofDossierData(rawContract);
      await generateOfficialProofDossierPdf(dossierData);

      setProofReadyModal({
        isOpen: true,
        proofId: dossierData.proofId,
        contractNumber: dossierData.contractNumber,
        token: dossierData.token,
        sha256Hash: dossierData.sha256Hash,
        data: dossierData
      });
    } catch (err: any) {
      console.error('Error generating proof dossier:', err);
      alert('Impossible de générer le dossier de preuve : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setGeneratingDossierId(null);
    }
  };

  // Téléchargement copie du contrat terminé
  const handleDownloadTerminatedContract = async (c: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const rawContract = c.raw || {};
      const leaseType = (rawContract.usage_destination || 'habitation') as 'habitation' | 'professionnel';
      await generateOfficialContractPdf({
        contractNumber: c.id,
        isAgency: false,
        ownerName: user?.user_metadata?.full_name || 'Propriétaire Bailleur',
        ownerPhone: user?.phone || '+225 07 00 00 00 00',
        ownerEmail: user?.email || 'bailleur@locatrust.ci',
        tenantName: c.locataire,
        tenantPhone: c.telephone,
        tenantEmail: rawContract.tenant_email || 'locataire@locatrust.ci',
        propertyTitle: c.bien,
        propertyAddress: c.quartier,
        rent: Number(rawContract.monthly_rent || rawContract.rent || 30000),
        durationMonths: Number(rawContract.duration_months || 12),
        startDate: rawContract.start_date || '01/01/2026',
        dueDay: 5,
        leaseType,
        usageDestination: leaseType
      });
    } catch (e) {
      console.error('Download contract error:', e);
    }
  };

  // Confirmation Option A — Republier le logement
  const confirmRepublishProperty = async () => {
    if (!republishModal?.contract) return;
    const c = republishModal.contract;
    const propId = c.raw?.property_id || c.raw?.property?.id;
    const propTitle = c.bien || c.raw?.property_title;

    try {
      if (propId) {
        await supabase.from('properties').update({ status: 'disponible' }).eq('id', propId);
      }

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('locatrust_properties');
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => {
              if (
                (propId && (p.id === propId || p._id === propId)) ||
                (propTitle && p.title && p.title.toLowerCase().includes(propTitle.toLowerCase()))
              ) {
                return { ...p, status: 'disponible', is_published: true };
              }
              return p;
            });
            localStorage.setItem('locatrust_properties', JSON.stringify(updated));
          }
        }
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
      }

      setRepublishModal(null);
      setConfirmationModal({
        isOpen: true,
        title: 'Logement republié avec succès',
        message: `Le logement "${propTitle}" est désormais disponible pour de futures candidatures.`,
        details: `L'ancien contrat N° ${c.id} reste scellé et archivé définitivement dans votre historique. Une nouvelle période de location est créée.`
      });
    } catch (err) {
      console.error('Error republishing property:', err);
    }
  };

  // Option B — Conserver non publié
  const confirmKeepUnpublished = () => {
    const c = republishModal?.contract;
    const propTitle = republishModal?.propertyTitle || 'Logement';
    setRepublishModal(null);
    setConfirmationModal({
      isOpen: true,
      title: 'Logement conservé non publié',
      message: `Le logement "${propTitle}" est conservé comme non disponible / en entretien.`,
      details: `L'ancien contrat N° ${c?.id || ''} reste archivé et scellé. Vous pourrez republier ce bien à tout moment depuis la rubrique Mes Biens.`
    });
  };

  // Action Propriétaire : Accepter le renouvellement du bail (+12 mois)
  const confirmAcceptRenewal = async () => {
    if (!renewalActionModal?.contract) return;
    const c = renewalActionModal.contract;
    const duration = renewalActionModal.durationMonths || 12;

    const res = await acceptContractRenewal({
      contract: c.raw || c,
      durationMonths: duration
    });

    setRenewalActionModal(null);
    setConfirmationModal({
      isOpen: true,
      title: 'Renouvellement validé avec succès',
      message: `Le contrat N° ${c.id} a été prolongé jusqu'au ${res.newEndDateStr}.`,
      details: `Le contrat poursuit son cours normalement jusqu'à sa nouvelle date de fin. Une notification officielle a été transmise au locataire.`,
      withCelebration: true
    });
    loadContracts();
  };

  // Action Propriétaire : Refuser le renouvellement du bail
  const confirmRefuseRenewal = async () => {
    if (!renewalActionModal?.contract) return;
    const c = renewalActionModal.contract;
    const reason = renewalActionModal.reason || "Non-reconduction du bail à son terme convenu";

    await refuseContractRenewal({
      contract: c.raw || c,
      reason
    });

    setRenewalActionModal(null);
    setConfirmationModal({
      isOpen: true,
      title: 'Non-renouvellement enregistré',
      message: `Le refus de renouvellement pour le contrat N° ${c.id} a été notifié au preneur.`,
      details: `Le contrat prendra fin à sa date d'échéance. À terme, le dossier de preuve officiel et les options de republication seront activés.`
    });
    loadContracts();
  };

  React.useEffect(() => {
    loadContracts();
    const handleUpdate = () => loadContracts();
    window.addEventListener('locatrust:contracts-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user]);

  const activeContractsCount = contracts.filter((c) => c.statut === 'Actif' || c.statut === 'Signé').length;
  const pendingSignatureCount = contracts.filter((c) => c.statut === 'En attente signature locataire').length;
  const finBientotCount = contracts.filter((c) => c.statut === 'Fin bientôt' || c.statut === 'Fin de contrat').length;
  const terminesCount = contracts.filter((c) => c.statut === 'Terminé').length;

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.locataire.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.quartier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'actif' && (c.statut === 'Actif' || c.statut === 'Signé')) ||
      (selectedStatus === 'attente_signature' && c.statut === 'En attente signature locataire') ||
      (selectedStatus === 'fin' && (c.statut === 'Fin bientôt' || c.statut === 'Fin de contrat')) ||
      (selectedStatus === 'termine' && c.statut === 'Terminé');
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const paginatedContracts = filteredContracts.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Gestion des contrats</h2>
          <p className="text-xs text-slate-500 mt-0.5">Consultez et suivez l'ensemble des contrats de location enregistrés.</p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold shrink-0">
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Génération liée aux Demandes de location</span>
        </div>
      </div>

      {/* Alert banner: Tenant pending signature */}
      {pendingSignatureCount > 0 && (() => {
        const pendingContract = contracts.find((c) => c.statut === 'En attente signature locataire');
        if (!pendingContract) return null;
        return (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
                    Action Requise
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {pendingSignatureCount} contrat en attente de signature du locataire
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Le contrat <strong>{pendingContract.id}</strong> ({pendingContract.locataire}) est en attente. Le locataire n'a pas encore apposé sa signature pour officialiser le bail.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                onClick={() => handleRelance(pendingContract.id, pendingContract.locataire, pendingContract.telephone, pendingContract.bien)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Relancer le locataire</span>
              </button>
              <button
                onClick={() => onSelectContract?.(pendingContract.id)}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                Consulter contrat
              </button>
            </div>
          </div>
        );
      })()}

      {/* Summary KPI Cards (Compact, pixel-perfect, and clickable status filters) */}
      {loading ? (
        <KpiGridSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1 : Contrats actifs */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'actif' ? 'all' : 'actif')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              selectedStatus === 'actif'
                ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-slate-900 leading-none">{activeContractsCount}</span>
              <span className="text-xs font-semibold text-slate-500 mt-1">Contrats actifs</span>
            </div>
          </div>

          {/* KPI 2 : En attente signature locataire */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'attente_signature' ? 'all' : 'attente_signature')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              selectedStatus === 'attente_signature'
                ? 'bg-orange-50 border-orange-500 shadow-md ring-2 ring-orange-500/20'
                : 'bg-white border-slate-200 shadow-sm hover:border-orange-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-slate-900 leading-none">{pendingSignatureCount}</span>
                {pendingSignatureCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-100 text-orange-700">À relancer</span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-500 mt-1">Attente sign. locataire</span>
            </div>
          </div>

          {/* KPI 3 : En fin de contrat */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'fin' ? 'all' : 'fin')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              selectedStatus === 'fin'
                ? 'bg-amber-50/70 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 shadow-sm hover:border-amber-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-slate-900 leading-none">{finBientotCount}</span>
              <span className="text-xs font-semibold text-slate-500 mt-1">En fin de contrat</span>
            </div>
          </div>

          {/* KPI 4 : Contrats terminés */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'termine' ? 'all' : 'termine')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              selectedStatus === 'termine'
                ? 'bg-emerald-50/70 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 shadow-sm hover:border-emerald-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-slate-900 leading-none">{terminesCount}</span>
              <span className="text-xs font-semibold text-slate-500 mt-1">Contrats terminés</span>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters Controls (Exact match user screenshot) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:flex-1 relative">
          <input
            type="text"
            placeholder="Rechercher un locataire, contrat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50/70 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus:outline-none appearance-none pr-8 cursor-pointer shadow-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="attente_signature">⚠️ Attente signature locataire ({pendingSignatureCount})</option>
              <option value="actif">Actif</option>
              <option value="fin">Fin bientôt</option>
              <option value="termine">Terminé</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          <button className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm shrink-0 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Période</span>
          </button>

          <button className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm shrink-0 transition-colors">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filtres</span>
          </button>
        </div>
      </div>

      {/* Table of Contracts (Matching Screenshot Header & Badges) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5">CONTRAT</th>
                <th className="py-4 px-5">LOCATAIRE</th>
                <th className="py-4 px-5">BIEN</th>
                <th className="py-4 px-5">PÉRIODE</th>
                <th className="py-4 px-5">STATUT</th>
                <th className="py-4 px-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-black text-slate-800">Aucun contrat de bail enregistré</h4>
                      <p className="text-xs text-slate-500 text-center leading-relaxed">
                        Les contrats de bail certifiés sont générés exclusivement depuis l'onglet <strong>Demandes de location</strong> lorsqu'une candidature est acceptée et validée par la signature du locataire.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedContracts.map((c) => {
                  const isTermine =
                    c.statut === 'Terminé' ||
                    c.raw?.status === 'termine' ||
                    c.raw?.status === 'cloture' ||
                    c.raw?.status === 'resilie';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectContract?.(c.id)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors group ${
                        c.statut === 'En attente signature locataire'
                          ? 'bg-amber-50/20'
                          : isTermine
                          ? 'bg-slate-50/50 hover:bg-slate-100/70'
                          : ''
                      }`}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              c.statut === 'En attente signature locataire'
                                ? 'bg-amber-100 text-amber-700'
                                : isTermine
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-blue-100/70 text-blue-600'
                            }`}
                          >
                            {isTermine ? <FileCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors text-xs">
                              {c.id}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">{c.dateSignature}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                            alt={c.locataire}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 text-xs">{c.locataire}</span>
                            <span className="text-[10px] text-slate-400">{c.role}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{c.bien}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{c.quartier}</span>
                        </div>
                      </td>

                      <td className="py-4 px-5 font-semibold text-slate-600 text-xs">{c.periode}</td>

                      <td className="py-4 px-5">
                        {isTermine ? (
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            Contrat terminé
                          </span>
                        ) : c.statut === 'En attente signature locataire' ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              Attente sign. locataire
                            </span>
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Bailleur a signé
                            </span>
                          </div>
                        ) : c.raw?.renewal_status === 'demande' ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <RefreshCw className="w-3 h-3 text-amber-700 animate-spin" />
                              Renouvellement demandé
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Durée : {c.raw?.renewal_duration_requested || 12} mois
                            </span>
                          </div>
                        ) : c.raw?.renewal_status === 'accepte' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Bail renouvelé (+12 mois)
                          </span>
                        ) : c.raw?.renewal_status === 'refuse' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-300">
                            <X className="w-3 h-3 text-rose-600" />
                            Non renouvelé (Fin proche)
                          </span>
                        ) : (
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-extrabold inline-block ${
                              c.statut === 'Actif'
                                ? 'bg-emerald-100 text-emerald-700'
                                : c.statut === 'Fin bientôt'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.statut}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isTermine ? (
                            <>
                              {/* 1. BOUTON OBLIGATOIRE DU DOSSIER DE PREUVE (Exigence 1, 4, 23) */}
                              <button
                                onClick={(e) => handleGenerateProofDossier(c, e)}
                                disabled={generatingDossierId === c.id}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-60 shrink-0"
                                title="Obtenir le dossier de preuve officiel récapitulatif certifié avec QR Code"
                              >
                                {generatingDossierId === c.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Génération...</span>
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-3.5 h-3.5 text-blue-200" />
                                    <span>📄 Obtenir mon dossier de preuve</span>
                                  </>
                                )}
                              </button>

                              {/* 2. REPUBLIER LE LOGEMENT (Exigence 3) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRepublishModal({ isOpen: true, contract: c, propertyTitle: c.bien });
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95 shrink-0"
                                title="Republier le logement pour une nouvelle période locative indépendante"
                              >
                                <RefreshCw className="w-3 h-3 text-emerald-600" />
                                <span className="hidden lg:inline">Republier</span>
                              </button>

                              {/* 3. TÉLÉCHARGER LE CONTRAT SCELLÉ */}
                              <button
                                onClick={(e) => handleDownloadTerminatedContract(c, e)}
                                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
                                title="Télécharger la copie scellée du contrat"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* 4. VOIR DÉTAILS */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectContract?.(c.id);
                                }}
                                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                                title="Consulter les détails du contrat clos"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : c.raw?.renewal_status === 'demande' ? (
                            <>
                              {/* BOUTON ACCEPTER LE RENOUVELLEMENT (Audio utilisateur) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenewalActionModal({
                                    isOpen: true,
                                    type: 'accept',
                                    contract: c,
                                    durationMonths: Number(c.raw?.renewal_duration_requested || 12)
                                  });
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0"
                                title="Accepter le renouvellement du bail (+12 mois)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Accepter</span>
                              </button>

                              {/* BOUTON REFUSER LE RENOUVELLEMENT (Audio utilisateur) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenewalActionModal({
                                    isOpen: true,
                                    type: 'refuse',
                                    contract: c,
                                    reason: 'Non-reconduction du bail à son terme convenu'
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0"
                                title="Refuser le renouvellement (le bail prendra fin à sa date d'échéance)"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Refuser</span>
                              </button>
                            </>
                          ) : c.statut === 'En attente signature locataire' ? (
                            <button
                              onClick={(e) => handleRelance(c.id, c.locataire, c.telephone, c.bien, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                              title="Relancer le locataire directement dans sa messagerie interne LocaTrust"
                            >
                              <Send className="w-3 h-3 text-blue-600" />
                              <span>Relancer le locataire</span>
                            </button>
                          ) : null}

                          {!isTermine && (
                            <button className="p-1 rounded-full text-slate-400 group-hover:text-blue-600 transition-all">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION ENTIÈREMENT FONCTIONNELLE (Point 5) */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Affichage {filteredContracts.length === 0 ? 0 : startIndex + 1} à {Math.min(startIndex + itemsPerPage, filteredContracts.length)} sur {filteredContracts.length} contrats
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                validCurrentPage === 1
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Page précédente"
            >
              &laquo; Précédent
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              const isActive = validCurrentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                validCurrentPage === totalPages
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Page suivante"
            >
              Suivant &raquo;
            </button>
          </div>
        </div>
      </div>

      {/* MODAL « VOTRE DOSSIER DE PREUVE EST PRÊT » (Section 17 & 18) */}
      {proofReadyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Votre dossier de preuve est prêt</h3>
                  <p className="text-xs text-slate-500">Document certifié conforme à la clôture du bail</p>
                </div>
              </div>
              <button
                onClick={() => setProofReadyModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Numéro de dossier :</span>
                <span className="font-mono font-black text-blue-600">{proofReadyModal.proofId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Contrat associé :</span>
                <span className="font-bold text-slate-800">{proofReadyModal.contractNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Statut :</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                  CONTRAT TERMINÉ & SCELLÉ
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Empreinte SHA-256 :</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]" title={proofReadyModal.sha256Hash}>
                  {proofReadyModal.sha256Hash}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
              <strong>Notice légale :</strong> Ce document est un dossier récapitulatif généré à partir des données enregistrées dans LocaTrust. Il ne remplace pas le contrat de bail signé.
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                onClick={async () => {
                  if (proofReadyModal.data) {
                    await generateOfficialProofDossierPdf(proofReadyModal.data);
                  }
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le dossier PDF</span>
              </button>

              <a
                href={`/verify/dossier/${proofReadyModal.token}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tester QR</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL « REPUBLIER LE LOGEMENT » (Section 3) */}
      {republishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Gestion du logement après la fin du bail</h3>
                <p className="text-xs text-slate-500">Bien : {republishModal.propertyTitle}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-emerald-950 text-xs leading-relaxed space-y-2">
              <p>
                <strong>La fin du contrat ne supprime pas le logement.</strong> Vous pouvez décider du sort de ce bien immobilier :
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>
                  <strong>Option A — Republier le logement :</strong> Le logement redevient disponible pour de futurs candidats et ouvre une <em>nouvelle période de location indépendante</em>.
                </li>
                <li>
                  <strong>Option B — Conserver non publié :</strong> Le logement est maintenu hors ligne (travaux, rénovations ou convenance personnelle).
                </li>
              </ul>
              <p className="text-[11px] text-slate-500 pt-1">
                ⚠️ L'ancien contrat N° {republishModal.contract?.id} reste définitivement archivé et scellé dans l'historique sans modification rétroactive.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={confirmRepublishProperty}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Option A — Republier le logement (Disponible)</span>
              </button>

              <button
                onClick={confirmKeepUnpublished}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Option B — Conserver non publié (Non disponible)
              </button>

              <button
                onClick={() => setRepublishModal(null)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL « TRAITER LE RENOUVELLEMENT DE BAIL » (Audio utilisateur) */}
      {renewalActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  renewalActionModal.type === 'accept'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                {renewalActionModal.type === 'accept' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <X className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {renewalActionModal.type === 'accept'
                    ? 'Valider le renouvellement du bail'
                    : 'Refuser le renouvellement du bail'}
                </h3>
                <p className="text-xs text-slate-500">Contrat N° {renewalActionModal.contract?.id}</p>
              </div>
            </div>

            {renewalActionModal.type === 'accept' ? (
              <div className="flex flex-col gap-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  En acceptant, le contrat poursuit son chemin normalement jusqu'à la nouvelle date de fin. Le bailleur et le preneur recevront une confirmation officielle.
                </p>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                  <label className="text-slate-500 font-bold text-[11px]">Durée de prolongation :</label>
                  <select
                    value={renewalActionModal.durationMonths || 12}
                    onChange={(e) =>
                      setRenewalActionModal({
                        ...renewalActionModal,
                        durationMonths: Number(e.target.value)
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value={12}>+ 12 mois (1 an supplémentaire)</option>
                    <option value={24}>+ 24 mois (2 ans supplémentaires)</option>
                    <option value={36}>+ 36 mois (3 ans supplémentaires)</option>
                    <option value={6}>+ 6 mois (Période courte)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs leading-relaxed">
                  <strong>Conséquence :</strong> Le contrat ne sera pas reconduit et prendra fin définitivement à sa date d'échéance. À terme, le dossier de preuve officiel sera disponible et vous pourrez choisir de republier ou non le logement.
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-500 font-bold text-[11px]">Motif du non-renouvellement :</label>
                  <input
                    type="text"
                    value={renewalActionModal.reason || ''}
                    onChange={(e) =>
                      setRenewalActionModal({
                        ...renewalActionModal,
                        reason: e.target.value
                      })
                    }
                    placeholder="Ex: Reprise pour convenance personnelle, vente, travaux..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={
                  renewalActionModal.type === 'accept'
                    ? confirmAcceptRenewal
                    : confirmRefuseRenewal
                }
                className={`w-full py-3 px-4 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 ${
                  renewalActionModal.type === 'accept'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {renewalActionModal.type === 'accept' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmer le renouvellement (+{renewalActionModal.durationMonths || 12} mois)</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Confirmer le non-renouvellement</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setRenewalActionModal(null)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION CONFIRMATION MODAL (Point 4) */}
      {confirmationModal && (
        <ActionConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          type="reminder_sent"
          title={confirmationModal.title}
          message={confirmationModal.message}
          details={confirmationModal.details}
          withCelebration={true}
          confirmText="D'accord"
        />
      )}

      {/* LOCAL LEGAL CONTRACT GENERATOR MODAL */}
      {isLocalCreateOpen && (
        <LegalContractGeneratorModal
          isOpen={true}
          onClose={() => setIsLocalCreateOpen(false)}
        />
      )}

    </div>
  );
};
export default ContractListView;
