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
  X
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { RentPayment, Deposit } from '@/types/database.types';
import { MOCK_RENT_PAYMENTS } from '@/lib/mock/data';
import { PaymentStatusBadge } from '@/components/common/PaymentStatusBadge';
import {
  declareCautionPayment,
  getStoredDeposits
} from '@/lib/cautionsStore';
import confetti from 'canvas-confetti';

export const LocatairePaiementsView: React.FC = () => {
  const [payments, setPayments] = useState<RentPayment[]>(MOCK_RENT_PAYMENTS);
  const [deposits, setDeposits] = useState<Deposit[]>(() => getStoredDeposits());

  // Modal States
  const [showDeclareModal, setShowDeclareModal] = useState<boolean>(false);
  const [showCautionModal, setShowCautionModal] = useState<boolean>(false);
  const [successModalMessage, setSuccessModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // Rent Form State
  const [targetMonth, setTargetMonth] = useState('2026-09-01');
  const [paymentType, setPaymentType] = useState<'loyer' | 'partiel' | 'autre'>('loyer');
  const [amount, setAmount] = useState<number>(475000);
  const [method, setMethod] = useState('Orange Money');
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  // Caution Form State (Point 8)
  const [cautionContractId, setCautionContractId] = useState('LT-2026-CI-000492');
  const [cautionAmount, setCautionAmount] = useState<number>(900000);
  const [cautionMethod, setCautionMethod] = useState('Wave CI');
  const [cautionReference, setCautionReference] = useState('WAVE-CI-99182301');

  useEffect(() => {
    const handleCautionsUpdated = () => {
      setDeposits(getStoredDeposits());
    };
    window.addEventListener('locatrust:cautions_updated', handleCautionsUpdated);
    return () => window.removeEventListener('locatrust:cautions_updated', handleCautionsUpdated);
  }, []);

  // Handle Rent Declaration
  const handleDeclarePayment = (e: React.FormEvent) => {
    e.preventDefault();
    // Référence obligatoire sauf si paiement en espèces
    if (method !== 'Espèces' && !reference.trim()) return;

    const newPayment: RentPayment = {
      id: `pmt_${Date.now()}`,
      contract_id: 'LT-2026-CI-000492',
      tenant_id: 'usr_tenant_1',
      owner_id: 'usr_owner_1',
      target_month: targetMonth,
      amount: amount,
      payment_date: new Date().toISOString().split('T')[0],
      reference: method === 'Espèces' ? `ESP-${Date.now()}` : reference,
      proof_url: proofUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      status: 'declare',
      created_at: new Date().toISOString()
    };

    setPayments((prev) => [newPayment, ...prev]);
    setShowDeclareModal(false);
    setReference('');
    setSuccessModalMessage({
      title: 'Paiement de loyer déclaré !',
      desc: 'Votre déclaration a été transmise à votre bailleur. La quittance officielle sera générée dès confirmation.'
    });
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Handle Caution Declaration (Point 8: "J'ai payé ma caution")
  const handleDeclareCaution = (e: React.FormEvent) => {
    e.preventDefault();
    // Référence obligatoire sauf si paiement en espèces
    if (cautionMethod !== 'Espèces' && !cautionReference.trim()) return;

    declareCautionPayment({
      contractId: cautionContractId,
      tenantId: 'usr_tenant_1',
      tenantName: "Koffi N'Guessan",
      amount: cautionAmount,
      reference: cautionMethod === 'Espèces' ? `ESP-${Date.now()}` : cautionReference,
      method: cautionMethod
    });

    setDeposits(getStoredDeposits());
    setShowCautionModal(false);
    setSuccessModalMessage({
      title: 'Caution signalée avec succès !',
      desc: `Votre règlement de garantie de ${formatFCFA(cautionAmount)} a été transmis à votre bailleur sous le statut "Caution à confirmer".`
    });
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  const myDeposit = deposits.find((d) => d.tenant_id === 'usr_tenant_1') || deposits[0];

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
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Historique de mes règlements de loyer</h3>
          <span className="text-xs text-slate-500">{payments.length} déclaration(s)</span>
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {payments.map((pmt) => (
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
                            contractNumber: pmt.contract_id || 'LT-2026-CI-000492',
                            contractToken: 'tok_cnt_ci2026_000123',
                            propertyTitle: 'Appartement 3 pièces Cocody Riviera 3',
                            propertyAddress: "Cocody Riviera 3, Abidjan - Côte d'Ivoire",
                            propertyReference: 'BIEN-000456',
                            propertyType: 'Appartement 3 pièces',
                            durationMonths: 12,
                            leaseStartDate: '01/10/2026',
                            leaseEndDate: '30/09/2027',
                            ownerName: "Koffi N'Guessan",
                            ownerCni: 'CI987654321',
                            ownerPhone: '05 05 43 21 00',
                            tenantName: "Koffi N'Guessan",
                            tenantCni: 'CI123456789',
                            tenantPhone: '07 00 12 34 56',
                            amount: pmt.amount,
                            periodCovered: pmt.target_month,
                            paymentDate: pmt.payment_date,
                            paymentMethod: 'Mobile Money',
                            transactionReference: pmt.reference
                          });
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-xs font-black inline-flex items-center gap-1 shadow-sm transition-all active:scale-95"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Télécharger Quittance</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">En attente bailleur</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
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
                <input
                  type="text"
                  readOnly
                  value="LT-2026-CI-000492 — Appartement 3 pièces Cocody Riviera"
                  className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 cursor-not-allowed"
                />
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
