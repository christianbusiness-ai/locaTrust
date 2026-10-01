'use client';

import React, { useState } from 'react';
import { MOCK_RENT_PAYMENTS, MOCK_USERS, MOCK_CONTRACTS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { formatFCFA, formatDateFr } from '@/lib/utils';
import { CreditCard, PlusCircle, CheckCircle2, Clock, Upload, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function TenantPaiementsPage() {
  const [payments, setPayments] = useState(MOCK_RENT_PAYMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('475000');
  const [targetMonth, setTargetMonth] = useState('2026-09-01');
  const [reference, setReference] = useState('OM-CI-99482103');
  const [isSuccess, setIsSuccess] = useState(false);

  const currentUser = MOCK_USERS.locataire;

  const handleDeclare = (e: React.FormEvent) => {
    e.preventDefault();
    const newPayment = {
      id: `pmt_${Date.now()}`,
      contract_id: 'cnt_1',
      tenant_id: currentUser.id,
      owner_id: 'usr_owner_1',
      target_month: targetMonth,
      amount: Number(amount),
      payment_date: new Date().toISOString().split('T')[0],
      reference: reference,
      status: 'declare' as const,
      created_at: new Date().toISOString(),
      contract: MOCK_CONTRACTS[0],
      tenant: currentUser,
    };
    setPayments([newPayment, ...payments]);
    setIsSuccess(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RoleSwitcher currentRole="locataire" onRoleChange={() => {}} />
      <Header currentUser={currentUser} />

      <div className="max-w-7xl w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        <Sidebar currentRole="locataire" />

        <main className="flex-1 flex flex-col gap-6">
          <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-extrabold text-slate-900">Mes Déclarations de Loyer</h2>
                <p className="text-xs text-slate-500">
                  Flux déclaratif sécurisé : enregistrez votre référence de virement ou Mobile Money pour validation par votre bailleur.
                </p>
              </div>
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="font-bold">
              <PlusCircle className="w-4 h-4" />
              <span>Déclarer un paiement</span>
            </Button>
          </div>

          {/* Payments History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-card">
            <div className="px-6 py-4 border-b border-slate-100 font-bold text-slate-900 text-sm">
              Historique des déclarations
            </div>
            <div className="divide-y divide-slate-100">
              {payments.map((pmt) => (
                <div key={pmt.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      pmt.status === 'confirme' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {pmt.status === 'confirme' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">Loyer {pmt.target_month}</span>
                      <span className="text-xs text-slate-400">Réf: {pmt.reference} • {formatDateFr(pmt.payment_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-extrabold text-slate-900 text-sm">{formatFCFA(pmt.amount)}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      pmt.status === 'confirme' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {pmt.status === 'confirme' ? 'Confirmé' : 'En attente bailleur'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Declaration */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
                <h3 className="font-bold text-slate-900 text-lg border-b pb-3">Déclarer un paiement de loyer</h3>

                {isSuccess ? (
                  <div className="flex flex-col items-center gap-3 text-center p-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    <h4 className="font-bold text-slate-900">Déclaration transmise !</h4>
                    <p className="text-xs text-slate-500">
                      Votre bailleur a été notifié et validera la réception de votre virement.
                    </p>
                    <Button onClick={() => { setIsSuccess(false); setIsModalOpen(false); }} className="w-full mt-2">
                      Fermer
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleDeclare} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Mois concerné</label>
                      <input
                        type="month"
                        value="2026-09"
                        onChange={(e) => setTargetMonth(`${e.target.value}-01`)}
                        className="p-2.5 bg-slate-50 border rounded-xl text-xs"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Montant versé (FCFA)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="p-2.5 bg-slate-50 border rounded-xl text-xs font-bold"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Référence Mobile Money / Virement</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="p-2.5 bg-slate-50 border rounded-xl text-xs"
                        placeholder="ex: OM-CI-88291039"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 text-blue-900 rounded-xl text-xs">
                      <Upload className="w-4 h-4 text-brand-600" />
                      <span>Ajouter un justificatif / capture d'écran</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Annuler</Button>
                      <Button type="submit" variant="primary" className="flex-1 font-bold">Transmettre</Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
