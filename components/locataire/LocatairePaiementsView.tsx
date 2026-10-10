'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Receipt,
  Upload,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Building2,
  FileCheck,
  Check,
  X,
  Search
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { RentPayment } from '@/types/database.types';
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge';
import { getRentPayments, createRentPayment, getContracts } from '@/src/lib/db';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import confetti from 'canvas-confetti';
import { TableRowsSkeleton } from '@/components/common/SkeletonLoader';

export const LocatairePaiementsView: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal States
  const [showDeclareModal, setShowDeclareModal] = useState<boolean>(false);
  const [showCautionModal, setShowCautionModal] = useState<boolean>(false);
  const [successModalMessage, setSuccessModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // Rent Form State
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState('2026-10-01');
  const [paymentType, setPaymentType] = useState<'loyer' | 'partiel' | 'autre'>('loyer');
  const [amount, setAmount] = useState<number>(150000);
  const [method, setMethod] = useState('Wave CI');
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  // Caution Form State
  const [cautionContractId, setCautionContractId] = useState('');
  const [cautionAmount, setCautionAmount] = useState<number>(300000);
  const [cautionMethod, setCautionMethod] = useState('Wave CI');
  const [cautionReference, setCautionReference] = useState('');

  const fetchPaymentsData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Paiements de loyers
      const { data: pmtData, error: pmtErr } = await getRentPayments(user.id);
      if (pmtErr) {
        setLoadError("Impossible de charger l'historique des paiements.");
      } else {
        setPayments(pmtData || []);
      }

      // 2. Cautions
      const { data: ctnData } = await supabase
        .from('cautions')
        .select('*')
        .eq('tenant_id', user.id);
      setDeposits(ctnData || []);

      // 3. Contrats actifs pour le formulaire
      const { data: cntData } = await getContracts(user.id, 'locataire');
      if (cntData && cntData.length > 0) {
        setUserContracts(cntData);
        setSelectedContractId(cntData[0].id);
        setCautionContractId(cntData[0].id);
        if (cntData[0].rent) setAmount(Number(cntData[0].rent));
        if (cntData[0].caution_amount) setCautionAmount(Number(cntData[0].caution_amount));
      }
    } catch (err: any) {
      setLoadError("Erreur réseau lors de la récupération des données financières.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();

    const handleUpdate = () => {
      fetchPaymentsData();
    };

    window.addEventListener('locatrust:payments-updated', handleUpdate);
    window.addEventListener('locatrust:cautions_updated', handleUpdate);
    return () => {
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:cautions_updated', handleUpdate);
    };
  }, [user]);

  // Handle Rent Declaration
  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method !== 'Espèces' && !reference.trim()) return;

    const chosenContract = userContracts.find(c => c.id === selectedContractId) || userContracts[0];

    const newPaymentData = {
      contract_id: chosenContract?.id || null,
      tenant_id: user?.id,
      owner_id: chosenContract?.owner_id || null,
      target_month: targetMonth,
      amount: amount,
      payment_date: new Date().toISOString().split('T')[0],
      reference: method === 'Espèces' ? `ESP-${Date.now().toString().slice(-6)}` : reference,
      payment_method: method,
      proof_url: proofUrl || null,
      status: 'declare'
    };

    const { data, error } = await createRentPayment(newPaymentData);
    if (!error && data) {
      setPayments((prev) => [data, ...prev]);
    } else {
      setPayments((prev) => [{ ...newPaymentData, id: `pmt_${Date.now()}` }, ...prev]);
    }

    setShowDeclareModal(false);
    setReference('');
    setSuccessModalMessage({
      title: 'Paiement de loyer déclaré !',
      desc: 'Votre déclaration a été transmise à votre bailleur. La quittance officielle sera générée dès confirmation.'
    });
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Handle Caution Declaration
  const handleDeclareCaution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cautionMethod !== 'Espèces' && !cautionReference.trim()) return;

    const chosenContract = userContracts.find(c => c.id === cautionContractId) || userContracts[0];

    const cautionData = {
      contract_id: chosenContract?.id || null,
      tenant_id: user?.id,
      owner_id: chosenContract?.owner_id || null,
      amount_requested: cautionAmount,
      amount_paid: cautionAmount,
      status: 'declare',
      declared_reference: cautionReference || (cautionMethod === 'Espèces' ? 'ESP-CAUTION' : 'REF-CAUTION'),
      declared_at: new Date().toISOString()
    };

    const { data } = await supabase.from('cautions').insert(cautionData).select().single();
    if (data) {
      setDeposits((prev) => [data, ...prev]);
    }

    setShowCautionModal(false);
    setCautionReference('');
    setSuccessModalMessage({
      title: 'Paiement de caution signalé !',
      desc: `Votre règlement de garantie de ${formatFCFA(cautionAmount)} a été notifié à votre bailleur sous le statut "Caution à confirmer".`
    });
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  const myDeposit = deposits[0];

  const filteredPayments = payments.filter((pmt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchRef = (pmt.reference || '').toLowerCase().includes(q);
    const matchMonth = (pmt.target_month || '').toLowerCase().includes(q);
    const matchAmount = String(pmt.amount || '').includes(q);
    return matchRef || matchMonth || matchAmount;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Mes Paiements & Cautions
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-extrabold">
              Espace Locataire
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Déclarez vos règlements de loyer et signalez le paiement de votre caution de garantie en toute conformité.
          </p>
        </div>

        {/* Action Buttons: Loyer & Caution */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCautionModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95"
            title="Signaler au bailleur que vous avez réglé votre dépôt de garantie"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>J'ai payé ma caution</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeclareModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Déclarer un loyer</span>
          </button>
        </div>
      </div>

      {/* Point 8: Dépôt de Garantie (Statut Visuel Clair) */}
      {myDeposit && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Dépôt de garantie contractuel ({myDeposit.contract_id})
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {formatFCFA(myDeposit.amount_paid)}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  / {formatFCFA(myDeposit.amount_requested)} exigés
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {myDeposit.property?.title || 'Logement loué'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unified Status Badge */}
            <PaymentStatusBadge status={myDeposit.status} />

            {myDeposit.status !== 'paye_complet' && (
              <button
                type="button"
                onClick={() => setShowCautionModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
              >
                Mettre à jour
              </button>
            )}
          </div>
        </div>
      )}

      {/* Declarations History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Historique de mes règlements de loyer</h3>
            <span className="text-xs text-slate-500">{filteredPayments.length} déclaration(s)</span>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher réf, mois, montant..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">Type de Paiement</th>
                <th className="p-4">Mois Affecté</th>
                <th className="p-4">Montant Versé</th>
                <th className="p-4">Référence</th>
                <th className="p-4">Date</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Quittance</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableRowsSkeleton rows={4} cols={7} />
            ) : loadError ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="p-6 bg-rose-50 dark:bg-rose-950/20 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                    <h4 className="text-sm font-black text-rose-900 dark:text-rose-200">Erreur de chargement</h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{loadError}</p>
                    <button
                      type="button"
                      onClick={fetchPaymentsData}
                      className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
                    >
                      Réessayer
                    </button>
                  </td>
                </tr>
              </tbody>
            ) : filteredPayments.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                      <h4 className="text-base font-black text-slate-800 dark:text-white">
                        {searchQuery ? "Aucun règlement correspondant trouvé" : "Aucun paiement de loyer enregistré"}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                        {searchQuery
                          ? "Aucun paiement ne correspond à votre recherche. Vérifiez la référence ou le mois."
                          : "Vous n'avez pas encore déclaré de règlement. Cliquez sur « Déclarer un loyer » pour enregistrer votre premier versement par Wave, Orange Money ou MTN."}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          onClick={() => setShowDeclareModal(true)}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                        >
                          Déclarer un loyer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredPayments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold">
                        Loyer mensuel
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{pmt.target_month}</td>
                    <td className="p-4 font-black text-emerald-600 text-sm">{formatFCFA(pmt.amount)}</td>
                    <td className="p-4">
                      <span className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                        {pmt.reference}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{pmt.payment_date}</td>
                    <td className="p-4">
                      <PaymentStatusBadge status={pmt.status} />
                    </td>
                    <td className="p-4 text-right">
                      {pmt.status === 'confirme' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const { generateOfficialReceiptPDF } = await import('@/lib/payments/officialReceiptPdfGenerator');
                            await generateOfficialReceiptPDF({
                              receiptNumber: pmt.reference,
                              contractNumber: pmt.contract?.contract_number || pmt.contract_id || 'LT-CONTRAT',
                              contractToken: pmt.contract?.token || 'tok_receipt',
                              propertyTitle: pmt.contract?.property?.title || 'Logement loué',
                              propertyAddress: pmt.contract?.property?.commune || 'Abidjan',
                              propertyReference: 'BIEN-REF',
                              propertyType: 'Logement',
                              durationMonths: 12,
                              leaseStartDate: pmt.contract?.start_date || '01/01/2026',
                              leaseEndDate: '31/12/2026',
                              ownerName: pmt.contract?.owner?.full_name || 'Bailleur',
                              ownerCni: 'CI0000000',
                              ownerPhone: pmt.contract?.owner?.phone || '',
                              tenantName: user?.user_metadata?.full_name || 'Locataire',
                              tenantCni: 'CI0000000',
                              tenantPhone: user?.phone || '',
                              amount: pmt.amount,
                              periodCovered: pmt.target_month,
                              paymentDate: pmt.payment_date,
                              paymentMethod: pmt.payment_method || 'Mobile Money',
                              transactionReference: pmt.reference
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-xs font-black inline-flex items-center gap-1 shadow-sm transition-all active:scale-95"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Télécharger Quittance</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">En attente validation</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>


      {/* MODAL 1: SIGNALER LE PAIEMENT DE LA CAUTION (Point 8) */}
      {showCautionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleDeclareCaution}
            className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 animate-scaleUp text-xs"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">Signaler le paiement de ma caution</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCautionModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              Cette déclaration est immédiatement notifiée à votre bailleur / agence sous le statut <strong>Caution à confirmer</strong>.
            </div>

            <div className="flex flex-col gap-3 font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Contrat de bail associé</label>
                {userContracts.length === 0 ? (
                  <input
                    type="text"
                    readOnly
                    value="Aucun contrat de bail actif enregistré"
                    className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={cautionContractId}
                    onChange={(e) => setCautionContractId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    {userContracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.contract_number || c.id.slice(0, 8)} — {c.property?.title || 'Logement loué'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Montant de la caution (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={cautionAmount}
                    onChange={(e) => setCautionAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-black text-blue-700"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Mode de règlement</label>
                  <select
                    value={cautionMethod}
                    onChange={(e) => { setCautionMethod(e.target.value); if (e.target.value === 'Espèces') setCautionReference(''); }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    <option value="Wave CI">Wave CI</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN Mobile Money">MTN MoMo</option>
                    <option value="Moov Money">Moov Money</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">💵 Espèces (cash)</option>
                  </select>
                </div>
              </div>

              {cautionMethod !== 'Espèces' && (
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Référence Transaction</label>
                  <input
                    type="text"
                    required
                    value={cautionReference}
                    onChange={(e) => setCautionReference(e.target.value)}
                    placeholder="Ex: WAVE-CI-99182301"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                </div>
              )}
              {cautionMethod === 'Espèces' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  💵 Paiement en espèces — aucune référence de transaction requise.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowCautionModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-md transition-all active:scale-95"
              >
                Confirmer la déclaration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: DÉCLARATION DE PAIEMENT DE LOYER */}
      {showDeclareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleDeclarePayment}
            className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 animate-scaleUp text-xs"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Déclarer un Règlement de Loyer</h3>
              <button type="button" onClick={() => setShowDeclareModal(false)} className="text-slate-400 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Type de Paiement (Différenciation nette)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('loyer')}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      paymentType === 'loyer' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Loyer complet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('partiel')}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      paymentType === 'partiel' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Paiement partiel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('autre')}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      paymentType === 'autre' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Autre frais
                  </button>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Contrat de bail associé</label>
                {userContracts.length === 0 ? (
                  <input
                    type="text"
                    readOnly
                    value="Aucun contrat de bail actif enregistré"
                    className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={selectedContractId}
                    onChange={(e) => {
                      setSelectedContractId(e.target.value);
                      const found = userContracts.find(c => c.id === e.target.value);
                      if (found?.rent) setAmount(Number(found.rent));
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    {userContracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.contract_number || c.id.slice(0, 8)} — {c.property?.title || 'Logement loué'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Mois Cible</label>
                <select
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="Septembre 2026">Septembre 2026</option>
                  <option value="Octobre 2026">Octobre 2026</option>
                  <option value="Novembre 2026">Novembre 2026</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Montant Payé (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Moyen utilisé</label>
                  <select
                    value={method}
                    onChange={(e) => { setMethod(e.target.value); if (e.target.value === 'Espèces') setReference(''); }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Wave">Wave CI</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">💵 Espèces (cash)</option>
                  </select>
                </div>
              </div>

              {method !== 'Espèces' && (
                <div>
                  <label className="font-extrabold text-slate-800 block mb-1">Référence Transaction</label>
                  <input
                    type="text"
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex: OM-CI-2026-99182301"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                </div>
              )}
              {method === 'Espèces' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  💵 Paiement en espèces — aucune référence de transaction requise.
                </div>
              )}

              {/* Justificatif / Preuve de Paiement Réelle (depuis galerie ou appareil) */}
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  Reçu / Preuve de paiement (Galerie ou Explorateur)
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    id="payment-proof-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setProofUrl(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {!proofUrl ? (
                    <label
                      htmlFor="payment-proof-upload"
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center"
                    >
                      <Upload className="w-5 h-5 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700">Sélectionner un reçu réel</span>
                      <span className="text-[10px] text-slate-400">Capture Mobile Money ou bordereau de virement (JPG, PNG)</span>
                    </label>
                  ) : (
                    <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={proofUrl} alt="Justificatif" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-800">Preuve réelle attachée</span>
                          <span className="text-[10px] text-emerald-600 font-bold">✓ Prête pour transmission au bailleur</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProofUrl('')}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold"
                        title="Supprimer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowDeclareModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black shadow-md hover:bg-emerald-500"
              >
                Soumettre la déclaration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMATION / FEEDBACK MODAL (Point 33: centered, LocaTrust white/blue) */}
      {successModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl flex flex-col items-center text-center gap-3 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">{successModalMessage.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{successModalMessage.desc}</p>
            <button
              type="button"
              onClick={() => setSuccessModalMessage(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
