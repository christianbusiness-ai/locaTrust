'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Building2,
  Paperclip,
  Check,
  X,
  RotateCcw,
  Eye,
  Calendar,
  Send,
  HelpCircle
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import {
  PropertyExpense,
  ExpenseCategory,
  getPropertyExpenses,
  createPropertyExpense,
  generateExpenseNumber
} from '@/lib/financial/expensesService';
import { getContracts, resolvePropertyCity } from '@/src/lib/db';

export const LocataireExpensesView: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<PropertyExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isDeclareOpen, setIsDeclareOpen] = useState<boolean>(false);
  const [previewInvoiceUrl, setPreviewInvoiceUrl] = useState<string | null>(null);

  // Formulaire de déclaration
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('plomberie');
  const [amount, setAmount] = useState('');
  const [contractId, setContractId] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // 1. Charger les contrats actifs du locataire
      const { data: cnts } = await getContracts(user.id, false);
      if (cnts) {
        const active = cnts.filter((c: any) => c.status === 'actif' || c.status === 'contrat_actif');
        setContracts(active);
        if (active.length > 0 && !contractId) {
          setContractId(active[0].id);
        }
      }

      // 2. Charger les dépenses du locataire
      const { data: expList } = await getPropertyExpenses(user.id, 'locataire');
      setExpenses(expList);
    } catch (e) {
      console.warn('Erreur chargement dépenses locataire:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('locatrust:expenses-updated', handleUpdate);
    window.addEventListener('locatrust:compensations-updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:expenses-updated', handleUpdate);
      window.removeEventListener('locatrust:compensations-updated', handleUpdate);
    };
  }, [user]);

  const handleDeclareExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !title.trim() || !amount || !contractId) return;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    setSubmitting(true);
    try {
      const chosenContract = contracts.find((c) => c.id === contractId) || contracts[0];
      const propId = chosenContract?.property_id || chosenContract?.property?.id || '';
      const ownerId = chosenContract?.owner_id || chosenContract?.property?.owner_id || '';
      const agencyId = chosenContract?.agency_id || chosenContract?.property?.agency_id;

      await createPropertyExpense({
        expense_number: generateExpenseNumber(),
        property_id: propId,
        contract_id: chosenContract?.id,
        owner_id: ownerId,
        agency_id: agencyId,
        tenant_id: user.id,
        category: category,
        title: title.trim(),
        description: description.trim(),
        amount: amt,
        currency: 'XOF',
        payer: 'locataire',
        responsible: 'proprietaire',
        scenario: 'C',
        validation_status: 'EN_ATTENTE_VALIDATION',
        expense_date: new Date().toISOString().slice(0, 10),
        invoice_reference: invoiceRef.trim(),
        invoice_url: invoiceUrl.trim(),
        photos: [],
        property_title: chosenContract?.property?.title || 'Logement',
        property_city: resolvePropertyCity(chosenContract?.property?.title, chosenContract?.property?.address, chosenContract?.property?.city, chosenContract?.property?.commune),
        tenant_name: chosenContract?.tenant_name || user.user_metadata?.full_name || 'Locataire',
        amount_to_recover: 0,
        compensation_authorized: false
      });

      setIsDeclareOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.warn('Erreur déclaration débours:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setDescription('');
    setInvoiceRef('');
    setInvoiceUrl('');
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-6xl mx-auto w-full animate-fadeIn font-sans">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-blue-300 shadow-inner">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Mes Dépenses & Déductions</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                Espace Locataire
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
              Déclarez vos réparations avancées, suivez l’accord de votre bailleur et la compensation sur votre loyer.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsDeclareOpen(true);
          }}
          className="relative z-10 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Déclarer une réparation avancée</span>
        </button>
      </div>

      {/* 2. Règle légale de transparence financière */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-black text-blue-900 block mb-0.5">Comment fonctionne la déduction sur loyer (Scénario C) ?</span>
          <p className="leading-relaxed text-blue-800">
            Conformément à la Loi 2019-576, lorsque vous avancez des frais de réparation incombant au propriétaire avec son accord préalable :
            le loyer contractuel reste inchangé, la déduction est appliquée officiellement, et vous ne réglez que le solde restant. 
            Aucun impayé ne vous est attribué et votre quittance est délivrée intégralement une fois le solde versé.
          </p>
        </div>
      </div>

      {/* 3. Liste des dépenses déclarées */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
          Historique de vos dépenses & débours ({expenses.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expenses.map((expense) => {
            const isApproved = expense.validation_status === 'APPROUVEE' || expense.validation_status.startsWith('COMPENSEE');
            const isPending = expense.validation_status === 'EN_ATTENTE_VALIDATION';
            const isInfoNeeded = expense.validation_status === 'INFORMATIONS_DEMANDEES';
            const isRefused = expense.validation_status === 'REFUSEE';

            return (
              <div
                key={expense.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-4 hover:border-blue-300 transition-all"
              >
                {/* Entête de carte */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 w-fit">
                      {expense.expense_number}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1">{expense.title}</h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {expense.property_title} &bull; {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  {/* Badge statut */}
                  {isApproved && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Déduction accordée
                    </span>
                  )}
                  {isPending && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      En examen bailleur
                    </span>
                  )}
                  {isInfoNeeded && (
                    <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 text-[11px] font-black flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />
                      Infos demandées
                    </span>
                  )}
                  {isRefused && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Refusée
                    </span>
                  )}
                </div>

                {/* Description & Facture */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <p className="line-clamp-2">{expense.description}</p>
                  {expense.invoice_reference && (
                    <span className="text-[11px] text-slate-500 font-bold block mt-1">
                      Facture N° : {expense.invoice_reference}
                    </span>
                  )}
                </div>

                {/* Notifications & Demandes de précisions */}
                {isInfoNeeded && expense.info_requested_text && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
                    <strong>Message du propriétaire :</strong> {expense.info_requested_text}
                  </div>
                )}

                {/* Motif de refus */}
                {isRefused && expense.refusal_reason && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
                    <strong>Motif du refus :</strong> {expense.refusal_reason}
                  </div>
                )}

                {/* Synthèse financière de la déduction */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Montant avancé</span>
                    <span className="text-base font-black text-slate-900">{formatFCFA(expense.amount)}</span>
                  </div>

                  {isApproved && (
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Déduit sur loyer</span>
                      <span className="text-base font-black text-emerald-700">
                        {formatFCFA(expense.compensation_total_applied || expense.amount)}
                      </span>
                    </div>
                  )}

                  {expense.invoice_url && (
                    <button
                      type="button"
                      onClick={() => setPreviewInvoiceUrl(expense.invoice_url || null)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Voir facture</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {expenses.length === 0 && (
            <div className="col-span-full p-8 rounded-2xl bg-white border border-slate-200 text-center text-slate-400 text-xs">
              Aucune dépense ou réparation avancée déclarée pour le moment.
            </div>
          )}
        </div>
      </div>

      {/* 4. Modale : Déclarer une réparation avancée */}
      {isDeclareOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Déclarer un débours / Réparation</h3>
                  <p className="text-xs text-slate-500 font-medium">Demande de compensation sur loyer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeclareOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeclareExpense} className="flex flex-col gap-4 mt-4 text-xs font-semibold">
              <div>
                <label className="text-slate-700 block mb-1">Contrat de location concerné *</label>
                <select
                  required
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                >
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Bail N° {c.contract_number} &bull; {c.property?.title || 'Logement'} ({formatFCFA(c.monthly_rent)}/mois)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Titre de la réparation *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Remplacement robinet défectueux"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Catégorie *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    <option value="plomberie">Plomberie & Robinetterie</option>
                    <option value="electricite">Électricité & Éclairage</option>
                    <option value="toiture_maconnerie">Toiture & Gros œuvre</option>
                    <option value="serrurerie">Serrurerie & Verrous</option>
                    <option value="autre">Autre réparation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Montant payé au réparateur (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ex: 15000"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Numéro de la facture / Reçu</label>
                  <input
                    type="text"
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    placeholder="Ex: FAC-00123"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Lien ou URL du justificatif (photo de la facture)</label>
                <input
                  type="text"
                  value={invoiceUrl}
                  onChange={(e) => setInvoiceUrl(e.target.value)}
                  placeholder="https://... ou photo du reçu"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Description détaillée de la panne et des travaux</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Précisez la cause, l'accord préalable du bailleur et le détail des pièces..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeclareOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-600/30 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmettre au bailleur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Aperçu facture */}
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
