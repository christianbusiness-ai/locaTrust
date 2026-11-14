'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Building2,
  User,
  ArrowRight,
  TrendingDown,
  RotateCcw,
  Check,
  X,
  Eye,
  Calendar,
  Layers,
  HelpCircle,
  Paperclip,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import {
  PropertyExpense,
  ExpenseScenario,
  ExpenseValidationStatus,
  ExpenseCategory,
  ExpensePayer,
  ExpenseResponsible,
  ExpenseFilters,
  ExpenseFinancialSummary,
  getPropertyExpenses,
  createPropertyExpense,
  updateExpenseValidationStatus,
  recordExpenseReimbursement,
  authorizeRentCompensation,
  calculateExpensesFinancialSummary,
  generateExpenseNumber,
  syncExpenseDecisionToMaintenanceTicket
} from '@/lib/financial/expensesService';
import { resolvePropertyCity, getProperties as fetchDbProperties } from '@/src/lib/db';

interface ExpensesManagementViewProps {
  userRole?: 'proprietaire' | 'agence';
  mandantId?: string;
}

export const ExpensesManagementView: React.FC<ExpensesManagementViewProps> = ({
  userRole = 'proprietaire',
  mandantId
}) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<PropertyExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Filtres
  const [selectedScenario, setSelectedScenario] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedMandantId, setSelectedMandantId] = useState<string>(mandantId || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [selectedExpenseForReimbursement, setSelectedExpenseForReimbursement] = useState<PropertyExpense | null>(null);
  const [selectedExpenseForCompensation, setSelectedExpenseForCompensation] = useState<PropertyExpense | null>(null);
  const [selectedExpenseForRefusal, setSelectedExpenseForRefusal] = useState<PropertyExpense | null>(null);
  const [previewInvoiceUrl, setPreviewInvoiceUrl] = useState<string | null>(null);

  // Formulaire d'ajout de dépense
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('plomberie');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newPropertyId, setNewPropertyId] = useState<string>('');
  const [newContractId, setNewContractId] = useState<string>('');
  const [newTenantId, setNewTenantId] = useState<string>('');
  const [newPayer, setNewPayer] = useState<ExpensePayer>('proprietaire');
  const [newResponsible, setNewResponsible] = useState<ExpenseResponsible>('proprietaire');
  const [newScenario, setNewScenario] = useState<ExpenseScenario>('A');
  const [newDescription, setNewDescription] = useState('');
  const [newInvoiceRef, setNewInvoiceRef] = useState('');
  const [newInvoiceUrl, setNewInvoiceUrl] = useState('');
  const [newInvoiceFileName, setNewInvoiceFileName] = useState('');
  const [ticketIdLinked, setTicketIdLinked] = useState<string>('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Formulaire de remboursement (Scénario B)
  const [reimbursementAmount, setReimbursementAmount] = useState<string>('');
  const [reimbursementMethod, setReimbursementMethod] = useState<'wave' | 'orange_money' | 'mtn' | 'moov' | 'virement' | 'especes'>('wave');
  const [reimbursementRef, setReimbursementRef] = useState<string>('');

  // Formulaire de compensation (Scénario C)
  const [compensationMonth, setCompensationMonth] = useState<string>('');
  const [compensationAmount, setCompensationAmount] = useState<string>('');

  // Formulaire de refus
  const [refusalReason, setRefusalReason] = useState<string>('');

  // Gestionnaire de téléversement du justificatif (Cliquable et optionnel)
  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewInvoiceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setNewInvoiceUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveInvoiceFile = () => {
    setNewInvoiceUrl('');
    setNewInvoiceFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Charger les données initiales : CLOISONNEMENT STRICT PAR UTILISATEUR
  const loadExpensesData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // 1. Charger propriétés : UNIQUEMENT les propres biens de l'utilisateur connecté
      let myProps: any[] = [];
      try {
        const { data: dbProps } = await fetchDbProperties(user.id);
        if (Array.isArray(dbProps)) {
          myProps = dbProps.filter((p: any) =>
            p &&
            !p.deleted_at &&
            (p.owner_id === user.id || p.agency_id === user.id)
          );
        }
      } catch {}

      if (myProps.length === 0) {
        const { data: props } = await supabase
          .from('properties')
          .select('id, title, city, commune, address, owner_id, agency_id, deleted_at')
          .is('deleted_at', null)
          .or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`);
        if (props) {
          myProps = props.filter((p: any) => p && (p.owner_id === user.id || p.agency_id === user.id));
        }
      }

      // Si stockage local de secours, filtrer STRICTEMENT par l'utilisateur connecté
      if (typeof window !== 'undefined' && myProps.length === 0) {
        try {
          const stored = localStorage.getItem('locatrust_properties');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              myProps = parsed.filter((p: any) =>
                p &&
                !p.deleted_at &&
                (p.owner_id === user.id || p.agency_id === user.id)
              );
            }
          }
        } catch {}
      }

      // Dédoublonnage strict par identifiant
      const seenPropIds = new Set<string>();
      const strictlyMyProperties = myProps.filter((p) => {
        if (!p || !p.id || seenPropIds.has(p.id)) return false;
        seenPropIds.add(p.id);
        return true;
      });

      setProperties(strictlyMyProperties);

      // 2. Charger contrats de ses propres biens uniquement
      const propIdSet = new Set(strictlyMyProperties.map((p) => p.id));
      const { data: cnts } = await supabase
        .from('contracts')
        .select('id, contract_number, property_id, tenant_id, tenant_name, status, monthly_rent')
        .eq('status', 'actif');
      if (cnts) {
        const myContracts = cnts.filter((c) => propIdSet.has(c.property_id));
        setContracts(myContracts);
      }

      // 3. Charger dépenses
      const filters: ExpenseFilters = {};
      if (selectedMandantId && selectedMandantId !== 'all') filters.mandantId = selectedMandantId;
      const { data: expList } = await getPropertyExpenses(user.id, userRole, filters);

      // Auto-validation et synchronisation immédiate des décisions de déduction créées par le bailleur (ex: DEP-2026-E93L)
      if (userRole === 'proprietaire' || userRole === 'agence') {
        for (const exp of expList) {
          if (exp.scenario === 'C' && (exp.validation_status === 'EN_ATTENTE_VALIDATION' || exp.validation_status === 'APPROUVEE')) {
            if (exp.validation_status === 'EN_ATTENTE_VALIDATION') {
              exp.validation_status = 'APPROUVEE';
              exp.compensation_authorized = true;
              try {
                await updateExpenseValidationStatus(exp.id, 'APPROUVEE', { actorId: user?.id });
              } catch {}
            }
            try {
              await syncExpenseDecisionToMaintenanceTicket(exp);
            } catch {}
          }
        }
      }

      setExpenses(expList);
    } catch (e) {
      console.warn('Erreur chargement dépenses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpensesData();

    // Vérifier si une dépense doit être préremplie depuis la maintenance
    if (typeof window !== 'undefined') {
      try {
        const prefillRaw = localStorage.getItem('locatrust_prefill_expense');
        if (prefillRaw) {
          const prefill = JSON.parse(prefillRaw);
          setNewTitle(prefill.title || '');
          setNewCategory(prefill.category || 'plomberie');
          setNewPropertyId(prefill.property_id || '');
          setNewContractId(prefill.contract_id || '');
          setNewTenantId(prefill.tenant_id || '');
          setNewDescription(prefill.description || '');
          setTicketIdLinked(prefill.ticket_id || '');
          setNewPayer(prefill.payer || 'proprietaire');
          setNewResponsible(prefill.responsible || 'proprietaire');
          setNewScenario(prefill.scenario || 'A');
          setIsAddExpenseOpen(true);
          localStorage.removeItem('locatrust_prefill_expense');
        }
      } catch {}
    }

    const handleUpdate = () => loadExpensesData();
    window.addEventListener('locatrust:expenses-updated', handleUpdate);
    window.addEventListener('locatrust:compensations-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:expenses-updated', handleUpdate);
      window.removeEventListener('locatrust:compensations-updated', handleUpdate);
    };
  }, [user, userRole, selectedMandantId]);

  // Synchroniser automatiquement le Scénario dès que le payeur ou le responsable change
  useEffect(() => {
    if (newPayer === 'locataire' && newResponsible === 'proprietaire') {
      setNewScenario('C');
    } else if (newPayer === 'proprietaire' && newResponsible === 'locataire') {
      setNewScenario('B');
    } else {
      setNewScenario('A');
    }
  }, [newPayer, newResponsible]);

  // Synthèse financière calculée
  const summary: ExpenseFinancialSummary = useMemo(() => {
    return calculateExpensesFinancialSummary(expenses);
  }, [expenses]);

  // Filtrage dynamique des dépenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedScenario !== 'all' && e.scenario !== selectedScenario) return false;
      if (selectedStatus !== 'all' && e.validation_status !== selectedStatus) return false;
      if (selectedPropertyId !== 'all' && e.property_id !== selectedPropertyId) return false;
      if (selectedMandantId !== 'all' && e.owner_id !== selectedMandantId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (e.expense_number || '').toLowerCase();
        const tit = (e.title || '').toLowerCase();
        const prop = (e.property_title || '').toLowerCase();
        const ten = (e.tenant_name || '').toLowerCase();
        return num.includes(q) || tit.includes(q) || prop.includes(q) || ten.includes(q);
      }
      return true;
    });
  }, [expenses, selectedScenario, selectedStatus, selectedPropertyId, selectedMandantId, searchQuery]);

  // Création d'une nouvelle dépense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newTitle.trim() || !newAmount || !newPropertyId) return;

    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return;

    const matchedProp = properties.find((p) => p.id === newPropertyId);
    const matchedContract = contracts.find((c) => c.property_id === newPropertyId || c.id === newContractId);

    const isAgency = userRole === 'agence';
    const ownerId = isAgency ? (matchedProp?.owner_id || user.id) : user.id;
    const agencyId = isAgency ? user.id : undefined;

    await createPropertyExpense({
      expense_number: generateExpenseNumber(),
      property_id: newPropertyId,
      contract_id: matchedContract?.id || newContractId || undefined,
      ticket_id: ticketIdLinked || undefined,
      owner_id: ownerId,
      agency_id: agencyId,
      tenant_id: matchedContract?.tenant_id || newTenantId || undefined,
      category: newCategory,
      title: newTitle.trim(),
      description: newDescription.trim(),
      amount: amt,
      currency: 'XOF',
      payer: newPayer,
      responsible: newResponsible,
      scenario: newScenario,
      validation_status: (userRole === 'proprietaire' || userRole === 'agence') ? 'APPROUVEE' : (newPayer === 'locataire' ? 'EN_ATTENTE_VALIDATION' : 'APPROUVEE'),
      expense_date: new Date().toISOString().slice(0, 10),
      invoice_reference: newInvoiceRef.trim(),
      invoice_url: newInvoiceUrl.trim(),
      photos: [],
      property_title: matchedProp?.title || 'Logement',
      property_city: resolvePropertyCity(matchedProp?.title, matchedProp?.address, matchedProp?.city, matchedProp?.commune),
      tenant_name: matchedContract?.tenant_name || 'Locataire',
      amount_to_recover: newScenario === 'B' ? amt : 0,
      compensation_authorized: newScenario === 'C' ? true : false
    });

    setIsAddExpenseOpen(false);
    resetForm();
    loadExpensesData();
  };

  const resetForm = () => {
    setNewTitle('');
    setNewAmount('');
    setNewDescription('');
    setNewInvoiceRef('');
    setNewInvoiceUrl('');
    setNewInvoiceFileName('');
    setTicketIdLinked('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Traiter approbation
  const handleApprove = async (expense: PropertyExpense) => {
    await updateExpenseValidationStatus(expense.id, 'APPROUVEE', { actorId: user?.id });
    try {
      await syncExpenseDecisionToMaintenanceTicket({
        ...expense,
        validation_status: 'APPROUVEE',
        compensation_authorized: true
      });
    } catch {}
    loadExpensesData();
  };

  // Traiter demande d'informations
  const handleRequestInfo = async (expense: PropertyExpense) => {
    const text = prompt('Précisez les informations ou justificatifs complémentaires demandés au locataire :');
    if (!text || !text.trim()) return;
    await updateExpenseValidationStatus(expense.id, 'INFORMATIONS_DEMANDEES', {
      infoRequest: text.trim(),
      actorId: user?.id
    });
    loadExpensesData();
  };

  // Traiter refus motivé
  const handleConfirmRefusal = async () => {
    if (!selectedExpenseForRefusal || !refusalReason.trim()) return;
    await updateExpenseValidationStatus(selectedExpenseForRefusal.id, 'REFUSEE', {
      refusalReason: refusalReason.trim(),
      actorId: user?.id
    });
    setSelectedExpenseForRefusal(null);
    setRefusalReason('');
    loadExpensesData();
  };

  // Enregistrer remboursement (Scénario B)
  const handleConfirmReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseForReimbursement || !reimbursementAmount || !user?.id) return;
    const amt = parseFloat(reimbursementAmount);
    if (isNaN(amt) || amt <= 0) return;

    await recordExpenseReimbursement({
      expense_id: selectedExpenseForReimbursement.id,
      contract_id: selectedExpenseForReimbursement.contract_id,
      tenant_id: selectedExpenseForReimbursement.tenant_id || user.id,
      amount_paid: amt,
      payment_method: reimbursementMethod,
      transaction_reference: reimbursementRef.trim() || undefined,
      paid_at: new Date().toISOString(),
      recorded_by: user.id,
      notes: `Remboursement enregistré sur dépense ${selectedExpenseForReimbursement.expense_number}`
    });

    setSelectedExpenseForReimbursement(null);
    setReimbursementAmount('');
    setReimbursementRef('');
    loadExpensesData();
  };

  // Autoriser compensation sur loyer (Scénario C)
  const handleConfirmCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseForCompensation || !compensationAmount || !selectedExpenseForCompensation.contract_id || !user?.id) return;
    const amt = parseFloat(compensationAmount);
    if (isNaN(amt) || amt <= 0) return;

    await authorizeRentCompensation({
      expense_id: selectedExpenseForCompensation.id,
      contract_id: selectedExpenseForCompensation.contract_id,
      target_month: compensationMonth || new Date().toISOString().slice(0, 7),
      amount_deducted: amt,
      authorized_by: user.id,
      notes: `Déduction autorisée de ${formatFCFA(amt)} sur loyer pour réparation ${selectedExpenseForCompensation.title}`
    });

    setSelectedExpenseForCompensation(null);
    setCompensationAmount('');
    setCompensationMonth('');
    loadExpensesData();
  };

  const getStatusBadge = (status: ExpenseValidationStatus) => {
    switch (status) {
      case 'APPROUVEE':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approuvée
          </span>
        );
      case 'EN_ATTENTE_VALIDATION':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            En attente validation
          </span>
        );
      case 'INFORMATIONS_DEMANDEES':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 text-[11px] font-black flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />
            Infos demandées
          </span>
        );
      case 'REFUSEE':
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Refusée
          </span>
        );
      case 'COMPENSEE_PARTIELLEMENT':
        return (
          <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 text-[11px] font-black flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            Compensée partiel
          </span>
        );
      case 'COMPENSEE_TOTALEMENT':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Compensée totalement
          </span>
        );
      default:
        return null;
    }
  };

  const getScenarioBadge = (scenario: ExpenseScenario) => {
    switch (scenario) {
      case 'A':
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-black" title="Scénario A : Payé & pris en charge par le propriétaire (Revenu net réduit)">
            Scénario A (Propriétaire)
          </span>
        );
      case 'B':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black" title="Scénario B : Avancé par le propriétaire, à rembourser par le locataire">
            Scénario B (À récupérer)
          </span>
        );
      case 'C':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-100 border border-blue-300 text-blue-900 text-[10px] font-black" title="Scénario C : Avancé par le locataire avec déduction autorisée sur le loyer">
            Scénario C (Déduction loyer)
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full animate-fadeIn font-sans">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-blue-300 shadow-inner">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Dépenses & Interventions</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                {userRole === 'agence' ? 'Gestion Mandats' : 'Espace Propriétaire'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
              Suivi professionnel des travaux, réparations, remboursements et déductions compensées sur les loyers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsAddExpenseOpen(true);
          }}
          className="relative z-10 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Dépense</span>
        </button>
      </div>

      {/* 2. Cartes KPIs Synthèse Financière (Scénarios A, B, C) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Scénario A (Pris en charge bailleur) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Scénario A &bull; Pris en charge
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-slate-900">
              {formatFCFA(summary.totalPaidByOwner)}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Dépenses directes bailleur déduites de la rentabilité nette.
            </p>
          </div>
        </div>

        {/* KPI 2 : Scénario B (À récupérer auprès du locataire) */}
        <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Scénario B &bull; À Recouvrer
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-amber-900">
              {formatFCFA(summary.balanceRemainingToRecover)}
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              Remboursé : {formatFCFA(summary.totalRecoveredFromTenants)} / {formatFCFA(summary.totalToRecoverFromTenants)}
            </p>
          </div>
        </div>

        {/* KPI 3 : Scénario C (Compensations de loyer autorisées) */}
        <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Scénario C &bull; Déductions Loyer
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-blue-900">
              {formatFCFA(summary.totalCompensationsAuthorized)}
            </div>
            <p className="text-[11px] text-blue-700 font-medium mt-1">
              Imputé : {formatFCFA(summary.totalCompensationsApplied)} &bull; Reliquat : {formatFCFA(summary.compensationsBalanceRemaining)}
            </p>
          </div>
        </div>

        {/* KPI 4 : En attente d'approbation */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Validation & Conformité
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-slate-900">
              {summary.pendingValidationCount} en attente
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.approvedCount} approuvées &bull; {summary.refusedCount} refusées
            </p>
          </div>
        </div>
      </div>

      {/* 3. Barre de recherche et filtres */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Recherche textuelle */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par référence, titre, bien ou locataire..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:bg-white transition-all"
          />
        </div>

        {/* Filtres déroulants */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtre Scénario */}
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          >
            <option value="all">Tous scénarios</option>
            <option value="A">Scénario A (Propriétaire)</option>
            <option value="B">Scénario B (Remboursement locataire)</option>
            <option value="C">Scénario C (Déduction loyer)</option>
          </select>

          {/* Filtre Statut */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          >
            <option value="all">Tous statuts</option>
            <option value="EN_ATTENTE_VALIDATION">En attente validation</option>
            <option value="INFORMATIONS_DEMANDEES">Infos demandées</option>
            <option value="APPROUVEE">Approuvée</option>
            <option value="REFUSEE">Refusée</option>
            <option value="COMPENSEE_PARTIELLEMENT">Compensée partiel</option>
            <option value="COMPENSEE_TOTALEMENT">Compensée total</option>
          </select>

          {/* Filtre Bien */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 max-w-[180px] truncate"
          >
            <option value="all">Tous les biens</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Tableau principal des dépenses */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="p-4">Référence & Titre</th>
                <th className="p-4">Bien & Ville</th>
                <th className="p-4">Scénario & Payeur</th>
                <th className="p-4 text-right">Montant</th>
                <th className="p-4 text-center">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredExpenses.map((expense) => {
                const isScenarioA = expense.scenario === 'A';
                const isScenarioB = expense.scenario === 'B';
                const isScenarioC = expense.scenario === 'C';

                return (
                  <tr key={expense.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Référence & Titre */}
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                            {expense.expense_number}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 mt-1">{expense.title}</span>
                        <span className="text-[11px] text-slate-500 line-clamp-1">{expense.description}</span>
                        {expense.invoice_reference && (
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Facture : <strong>{expense.invoice_reference}</strong>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Bien & Ville */}
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{expense.property_title || 'Logement'}</span>
                        <span className="text-[11px] text-slate-500">{expense.property_city || 'Abidjan'}</span>
                        {expense.tenant_name && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />
                            {expense.tenant_name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Scénario & Payeur */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {getScenarioBadge(expense.scenario)}
                        <span className="text-[11px] text-slate-500">
                          Avancé par : <strong className="text-slate-800 capitalize">{expense.payer}</strong>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Charge légale : <strong className="text-slate-800 capitalize">{expense.responsible}</strong>
                        </span>
                      </div>
                    </td>

                    {/* Montant & Solde */}
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-slate-900">{formatFCFA(expense.amount)}</span>
                        {isScenarioB && (
                          <span className="text-[10px] font-bold text-amber-700">
                            Reste à recouvrer : {formatFCFA(expense.recovery_balance)}
                          </span>
                        )}
                        {isScenarioC && (
                          <span className="text-[10px] font-bold text-blue-700">
                            Compensé : {formatFCFA(expense.compensation_total_applied)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getStatusBadge(expense.validation_status)}
                        {expense.refusal_reason && (
                          <span className="text-[10px] text-rose-600 font-medium max-w-[140px] truncate" title={expense.refusal_reason}>
                            Motif : {expense.refusal_reason}
                          </span>
                        )}
                        {expense.info_requested_text && (
                          <span className="text-[10px] text-blue-600 font-medium max-w-[140px] truncate" title={expense.info_requested_text}>
                            Demandé : {expense.info_requested_text}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions Contextuelles */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Approbation pour les dépenses en attente */}
                        {(expense.validation_status === 'EN_ATTENTE_VALIDATION' || expense.validation_status === 'INFORMATIONS_DEMANDEES') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(expense)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-sm transition-all"
                              title="Valider la dépense"
                            >
                              <Check className="w-3 h-3" />
                              <span>Valider</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRequestInfo(expense)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all"
                              title="Demander des précisions"
                            >
                              Infos
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedExpenseForRefusal(expense)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-all"
                              title="Refuser avec motif"
                            >
                              Refuser
                            </button>
                          </>
                        )}

                        {/* Action Scénario B : Enregistrer un remboursement locataire */}
                        {isScenarioB && expense.recovery_balance > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExpenseForReimbursement(expense);
                              setReimbursementAmount(String(expense.recovery_balance));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] shadow-sm transition-all flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Remboursement</span>
                          </button>
                        )}

                        {/* Action Scénario C : Imputer compensation sur loyer */}
                        {isScenarioC && expense.validation_status === 'APPROUVEE' && expense.compensation_balance > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExpenseForCompensation(expense);
                              setCompensationAmount(String(expense.compensation_balance));
                              setCompensationMonth(new Date().toISOString().slice(0, 7));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] shadow-sm transition-all flex items-center gap-1"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Compenser sur loyer</span>
                          </button>
                        )}

                        {/* Visualisation Facture / Justificatif */}
                        {expense.invoice_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewInvoiceUrl(expense.invoice_url || null)}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Voir la facture"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                    Aucune dépense trouvée pour les critères sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODALE : NOUVELLE DÉPENSE */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Enregistrer une dépense</h3>
                  <p className="text-xs text-slate-500 font-medium">Réparations, plomberie, travaux et déductions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="flex flex-col gap-4 mt-4 text-xs font-semibold">
              {/* Titre & Catégorie */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Titre de l'intervention *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Réparation fuite robinet cuisine"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Catégorie *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    <option value="plomberie">Plomberie & Robinetterie</option>
                    <option value="electricite">Électricité & Éclairage</option>
                    <option value="toiture_maconnerie">Toiture & Gros œuvre</option>
                    <option value="serrurerie">Serrurerie & Portes</option>
                    <option value="peinture">Peinture & Finitions</option>
                    <option value="parties_communes">Parties Communes</option>
                    <option value="autre">Autre intervention</option>
                  </select>
                </div>
              </div>

              {/* Bien concerné & Montant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Bien concerné *</label>
                  <select
                    required
                    value={newPropertyId}
                    onChange={(e) => setNewPropertyId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    <option value="">Sélectionner un de vos biens ({properties.length} disponible{properties.length > 1 ? 's' : ''})</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.city || p.commune || 'Abidjan'})
                      </option>
                    ))}
                  </select>
                  {properties.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-medium mt-1">
                      Aucun bien associé à votre compte. Veuillez d'abord ajouter un logement.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Montant réel (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="Ex: 15000"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              </div>

              {/* Payeur & Responsable (Définit automatiquement le scénario A, B ou C) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200">
                <div>
                  <label className="text-blue-900 block mb-1">Qui a payé / avancé les fonds ?</label>
                  <select
                    value={newPayer}
                    onChange={(e) => setNewPayer(e.target.value as ExpensePayer)}
                    className="w-full p-2 rounded-xl bg-white border border-blue-200 text-xs font-bold text-blue-900"
                  >
                    <option value="proprietaire">Le Propriétaire / Bailleur</option>
                    <option value="agence">L'Agence Immobilière</option>
                    <option value="locataire">Le Locataire (Avance)</option>
                  </select>
                </div>
                <div>
                  <label className="text-blue-900 block mb-1">Qui est légalement responsable du coût ?</label>
                  <select
                    value={newResponsible}
                    onChange={(e) => setNewResponsible(e.target.value as ExpenseResponsible)}
                    className="w-full p-2 rounded-xl bg-white border border-blue-200 text-xs font-bold text-blue-900"
                  >
                    <option value="proprietaire">Le Propriétaire (Art. 428 - Gros œuvre)</option>
                    <option value="locataire">Le Locataire (Réparations locatives)</option>
                    <option value="copropriete">La Copropriété</option>
                  </select>
                </div>
              </div>

              {/* Explication du Scénario détecté */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                <strong>Scénario appliqué : </strong>
                {newScenario === 'A' && 'Scénario A — Le propriétaire prend en charge la dépense (impact net sur sa rentabilité).'}
                {newScenario === 'B' && 'Scénario B — Le propriétaire avance les fonds, le locataire devra rembourser séparément.'}
                {newScenario === 'C' && 'Scénario C — Le locataire avance les fonds et pourra déduire le montant sur son prochain loyer.'}
              </div>

              {/* Numéro de facture & Justificatif cliquable (Optionnel) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="text-slate-700 block mb-1">
                    Numéro de facture / Bon <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={newInvoiceRef}
                    onChange={(e) => setNewInvoiceRef(e.target.value)}
                    placeholder="Ex: FAC-2026-089"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">
                    Justificatif / Facture <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleInvoiceFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />

                  {!newInvoiceUrl ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-dashed border-slate-300 hover:border-blue-400 text-xs font-bold text-slate-600 hover:text-blue-700 flex items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      <span>Cliquez pour choisir un justificatif</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        {newInvoiceUrl.startsWith('data:image') ? (
                          <img src={newInvoiceUrl} alt="Miniature facture" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-blue-300" />
                        ) : (
                          <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                        )}
                        <span className="truncate font-semibold text-[11px]" title={newInvoiceFileName || 'Justificatif sélectionné'}>
                          {newInvoiceFileName || 'Fichier justificatif joint'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoiceUrl(newInvoiceUrl)}
                          className="p-1 rounded-lg hover:bg-blue-100 text-blue-700 transition-colors"
                          title="Aperçu"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveInvoiceFile}
                          className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors"
                          title="Supprimer le justificatif"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-slate-700 block mb-1">Description détaillée</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Détails des travaux effectués..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/30"
                >
                  Enregistrer la dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODALE : ENREGISTRER REMBOURSEMENT LOCATAIRE (SCÉNARIO B) */}
      {selectedExpenseForReimbursement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Enregistrer un remboursement</h3>
                <p className="text-xs text-slate-500 font-medium">Scénario B &bull; Récupération sur dépense locative</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseForReimbursement(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReimbursement} className="flex flex-col gap-4 mt-4 text-xs font-semibold">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <div>Dépense : <strong>{selectedExpenseForReimbursement.title}</strong></div>
                <div>Solde restant à récupérer : <strong>{formatFCFA(selectedExpenseForReimbursement.recovery_balance)}</strong></div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Montant remboursé (FCFA) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedExpenseForReimbursement.recovery_balance}
                  value={reimbursementAmount}
                  onChange={(e) => setReimbursementAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Mode de règlement</label>
                <select
                  value={reimbursementMethod}
                  onChange={(e) => setReimbursementMethod(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                >
                  <option value="wave">Wave Mobile Money</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="moov">Moov Money</option>
                  <option value="especes">Espèces avec reçu</option>
                  <option value="virement">Virement bancaire</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Référence transaction / reçu</label>
                <input
                  type="text"
                  value={reimbursementRef}
                  onChange={(e) => setReimbursementRef(e.target.value)}
                  placeholder="Ex: TXN-WAVE-987456"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedExpenseForReimbursement(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md"
                >
                  Confirmer le remboursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODALE : AUTORISER COMPENSATION SUR LOYER (SCÉNARIO C) */}
      {selectedExpenseForCompensation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Autoriser la compensation sur loyer</h3>
                <p className="text-xs text-slate-500 font-medium">Scénario C &bull; Déduction sans modifier le loyer contractuel</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseForCompensation(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCompensation} className="flex flex-col gap-4 mt-4 text-xs font-semibold">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                <div>Réparation : <strong>{selectedExpenseForCompensation.title}</strong></div>
                <div>Montant avancé par le locataire : <strong>{formatFCFA(selectedExpenseForCompensation.amount)}</strong></div>
                <div>Reste à compenser : <strong>{formatFCFA(selectedExpenseForCompensation.compensation_balance)}</strong></div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Mois cible d'imputation *</label>
                <input
                  type="month"
                  required
                  value={compensationMonth}
                  onChange={(e) => setCompensationMonth(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Montant à déduire sur ce mois (FCFA) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedExpenseForCompensation.compensation_balance}
                  value={compensationAmount}
                  onChange={(e) => setCompensationAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Si le montant de la réparation dépasse le loyer, le reliquat sera déduit sur le mois suivant.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedExpenseForCompensation(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-600/30"
                >
                  Autoriser la déduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODALE : REFUS MOTIVÉ */}
      {selectedExpenseForRefusal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-rose-950">Refuser la demande de déduction</h3>
              <button
                type="button"
                onClick={() => setSelectedExpenseForRefusal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 mt-4 text-xs font-semibold">
              <p className="text-slate-600">
                Indiquez le motif légal ou contractuel du refus qui sera notifié au locataire :
              </p>
              <textarea
                rows={3}
                required
                value={refusalReason}
                onChange={(e) => setRefusalReason(e.target.value)}
                placeholder="Ex: Réparation locative incombant légalement au locataire (Art. 428 Loi 2019-576) sans accord préalable du bailleur."
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedExpenseForRefusal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRefusal}
                  disabled={!refusalReason.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black shadow-md shadow-rose-600/30"
                >
                  Confirmer le refus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. APERÇU FACTURE */}
      {previewInvoiceUrl && (
        <div
          onClick={() => setPreviewInvoiceUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <img src={previewInvoiceUrl} alt="Facture Justificatif" className="w-full h-auto object-contain max-h-[80vh] rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};

