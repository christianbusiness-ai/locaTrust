'use client';

import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  History,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  FileText,
  Lock,
  ArrowRight,
  Download,
  Smartphone,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { MOCK_PROPERTIES } from '@/lib/mock/data';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';

interface SubscriptionInvoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  propertiesCount: number;
  paymentMethod: string;
  status: 'Payé' | 'En attente';
}

const INITIAL_INVOICES: SubscriptionInvoice[] = [
  {
    id: 'SUB-2026-009',
    date: '01/09/2026',
    period: 'Septembre 2026',
    amount: 2000,
    propertiesCount: 5,
    paymentMethod: 'Orange Money',
    status: 'Payé'
  },
  {
    id: 'SUB-2026-008',
    date: '01/08/2026',
    period: 'Août 2026',
    amount: 2000,
    propertiesCount: 4,
    paymentMethod: 'Wave CI',
    status: 'Payé'
  },
  {
    id: 'SUB-2026-007',
    date: '01/07/2026',
    period: 'Juillet 2026',
    amount: 500,
    propertiesCount: 1,
    paymentMethod: 'Wave CI',
    status: 'Payé'
  }
];

export const AbonnementView: React.FC = () => {
  // Count active properties managed by the landlord
  const activePropertiesCount = MOCK_PROPERTIES.filter((p) => p.status !== 'desactive').length || 5;

  // STRICT AUTOMATIC TIER CALCULATION (Point 9)
  // 1 property = 500 FCFA / month
  // 2 to 10 properties = 2 000 FCFA / month
  // 11 to 20 properties = 5 000 FCFA / month
  // 20+ properties = 10 000 FCFA / month
  const calculateSubscription = (count: number) => {
    if (count <= 1) {
      return {
        amount: 500,
        tierName: 'Formule 1 Bien'
      };
    }
    if (count <= 10) {
      return {
        amount: 2000,
        tierName: 'Formule Gestionnaire'
      };
    }
    if (count <= 20) {
      return {
        amount: 5000,
        tierName: 'Formule Multi-Propriétés'
      };
    }
    return {
      amount: 10000,
      tierName: 'Formule Grand Parc'
    };
  };

  const currentPlan = calculateSubscription(activePropertiesCount);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>(INITIAL_INVOICES);

  // Status state simulation (active vs expired)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'actif' | 'expire'>('actif');
  const [nextDueDate, setNextDueDate] = useState<string>('01 octobre 2026');

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'wave' | 'orange' | 'mtn' | 'card'>('wave');
  const [phoneNumber, setPhoneNumber] = useState('+225 07 48 92 11 00');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  // Generate and download subscription invoice PDF using jsPDF
  const handleDownloadInvoice = (inv: SubscriptionInvoice) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Header branding
    doc.setFillColor(11, 25, 44); // #0B192C
    doc.rect(0, 0, 210, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('LOCATRUST', 15, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(245, 158, 11);
    doc.text('PLATEFORME OFFICIELLE DE GESTION LOCATIVE CONFORME', 15, 25);
    doc.text('RÉPUBLIQUE DE CÔTE D\'IVOIRE', 15, 31);

    // Invoice Meta
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE ACQUITTÉE', 135, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Réf: ${inv.id}`, 135, 24);
    doc.text(`Date: ${inv.date}`, 135, 29);

    // Landlord / Client info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Facturé à :', 15, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text("M. Koffi N'Guessan", 15, 58);
    doc.text('Bailleur Propriétaire Certifié', 15, 63);
    doc.text('Abidjan, Côte d\'Ivoire', 15, 68);

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 80, 180, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text('DÉSIGNATION DU SERVICE', 20, 86.5);
    doc.text('PÉRIODE', 110, 86.5);
    doc.text('BIENS GÉRÉS', 140, 86.5);
    doc.text('TOTAL (FCFA)', 170, 86.5);

    // Line item
    doc.line(15, 90, 195, 90);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Abonnement SaaS LocaTrust Sérénité', 20, 99);
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Accès illimité baux, quittances & exports', 20, 104);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(inv.period, 110, 101);
    doc.text(`${inv.propertiesCount} bien(s)`, 145, 101);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formatFCFA(inv.amount)}`, 170, 101);

    doc.line(15, 112, 195, 112);

    // Totals Box
    doc.setFillColor(248, 250, 252);
    doc.rect(125, 120, 70, 32, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(125, 120, 70, 32, 'D');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total HT :', 130, 128);
    doc.text(`${formatFCFA(inv.amount)}`, 170, 128);

    doc.text('TVA (0% SaaS) :', 130, 135);
    doc.text('0 FCFA', 170, 135);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Total Payé :', 130, 145);
    doc.setTextColor(5, 150, 105); // Emerald
    doc.text(`${formatFCFA(inv.amount)}`, 165, 145);

    // Payment details stamp
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(15, 120, 100, 32, 3, 3, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RÈGLEMENT CONFIRMÉ', 22, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Moyen de paiement : ${inv.paymentMethod}`, 22, 135);
    doc.text(`Statut de la transaction : ACQUITTÉE`, 22, 140);
    doc.text(`Identifiant sécurisé : TXN-${inv.id}`, 22, 145);

    // Legal Footer
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Facture certifiée conforme aux exigences fiscales et numériques ivoiriennes.', 105, 278, { align: 'center' });

    doc.save(`Facture_LocaTrust_${inv.id}.pdf`);
  };

  // Handle online payment execution
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);

    setTimeout(() => {
      setIsProcessingPayment(false);
      const newInvoiceId = `SUB-2026-0${invoices.length + 10}`;
      const methodLabel =
        paymentProvider === 'wave'
          ? 'Wave CI'
          : paymentProvider === 'orange'
          ? 'Orange Money'
          : paymentProvider === 'mtn'
          ? 'MTN MoMo'
          : 'Carte Bancaire';

      const newInv: SubscriptionInvoice = {
        id: newInvoiceId,
        date: new Date().toLocaleDateString('fr-FR'),
        period: 'Octobre 2026',
        amount: currentPlan.amount,
        propertiesCount: activePropertiesCount,
        paymentMethod: methodLabel,
        status: 'Payé'
      };

      setInvoices([newInv, ...invoices]);
      setSubscriptionStatus('actif');
      setNextDueDate('01 novembre 2026');
      setIsPaymentModalOpen(false);
      setPaymentSuccessMsg(`Paiement de ${formatFCFA(currentPlan.amount)} confirmé via ${methodLabel}. Votre abonnement est actif.`);

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });

      setTimeout(() => setPaymentSuccessMsg(null), 5000);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      {/* Top Banner in Official LocaTrust Navy/Gold */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Abonnement SaaS LocaTrust
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-black border border-blue-200">
              Gestionnaire Bailleur
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Tarification unique calculée directement d'après le nombre réel de biens que vous gérez. Accès 100% complet à l'ensemble des fonctionnalités.
          </p>
        </div>

        {/* Status indicator button */}
        <div className="flex items-center gap-2.5">
          {subscriptionStatus === 'actif' ? (
            <span className="px-3.5 py-2 rounded-2xl bg-emerald-100 text-emerald-900 text-xs font-black border border-emerald-200 flex items-center gap-1.5 shadow-sm whitespace-nowrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Abonnement actif</span>
            </span>
          ) : (
            <span className="px-3.5 py-2 rounded-2xl bg-rose-100 text-rose-900 text-xs font-black border border-rose-200 flex items-center gap-1.5 shadow-sm whitespace-nowrap">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Abonnement Expiré</span>
            </span>
          )}

          <button
            onClick={() => setSubscriptionStatus((prev) => (prev === 'actif' ? 'expire' : 'actif'))}
            className="text-[11px] font-bold text-slate-500 hover:text-blue-700 underline px-1 transition-colors"
            title="Tester l'affichage d'un abonnement expiré"
          >
            ({subscriptionStatus === 'actif' ? 'Simuler expiration' : 'Simuler réactivation'})
          </button>
        </div>
      </div>

      {paymentSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{paymentSuccessMsg}</span>
        </div>
      )}

      {/* GESTION DE L'ABONNEMENT EXPIRÉ (Règles non destructives) */}
      {subscriptionStatus === 'expire' && (
        <div className="p-6 rounded-3xl bg-amber-50/90 border-2 border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-scaleUp shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-amber-950">
                Votre abonnement est actuellement arrivé à échéance
              </h4>
              <p className="text-xs text-amber-900 font-medium mt-1 leading-relaxed max-w-2xl">
                La création de nouveaux baux et l'émission de nouvelles quittances sont suspendues temporairement jusqu'au renouvellement.
              </p>
              <div className="mt-2 text-xs text-emerald-800 font-bold bg-white/80 border border-emerald-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Toutes vos données, contrats existants et l'accès de vos locataires à leurs quittances restent 100% préservés et consultables.</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 shrink-0 transition-all active:scale-95 whitespace-nowrap"
          >
            Renouveler ({formatFCFA(currentPlan.amount)} / mois)
          </button>
        </div>
      )}

      {/* CLEAN SAAS SUBSCRIPTION CARD (Clean, modern, no internal tier breakdown) */}
      <div className="bg-gradient-to-br from-[#0B192C] via-blue-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-blue-900/60 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-sm">
              Votre formule active
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              Abonnement actif
            </span>
          </div>

          <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Votre abonnement : {formatFCFA(currentPlan.amount)} / mois
          </h3>

          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Accès complet et illimité à l'ensemble des modules LocaTrust pour vos {activePropertiesCount} bien(s) en gestion active.
          </p>

          <div className="mt-2 p-3.5 rounded-2xl bg-blue-900/40 border border-blue-700/50 flex items-center gap-2.5 text-xs text-blue-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Tout inclus :</strong> Baux certifiés avec QR code, quittances avec signature numérique, séquestre des cautions, messagerie interactive et exports comptables.
            </span>
          </div>
        </div>

        {/* Subscription details box */}
        <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col gap-4 shrink-0 min-w-[280px]">
          <div>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Patrimoine géré
            </span>
            <span className="text-xl font-black text-white">{activePropertiesCount} bien(s) actif(s)</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Prochaine échéance
            </span>
            <span className="text-base font-black text-amber-300 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-4 h-4" />
              {nextDueDate}
            </span>
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md transition-all text-center active:scale-95 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Gérer le paiement</span>
            </button>
          </div>
        </div>
      </div>

      {/* TABLEAU DES FACTURES D'ABONNEMENT */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-black text-slate-900">
              Historique des factures d'abonnement LocaTrust
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-bold">Règlements SaaS certifiés</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Référence</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Période</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Montant</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center">Nombre de biens</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center">Statut</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600">{inv.date}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-blue-900">{inv.id}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-slate-900">{inv.period}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-black text-slate-900">{formatFCFA(inv.amount)}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-center font-bold text-slate-800">
                    {inv.propertiesCount} bien(s)
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-center">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-200 inline-flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{inv.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDownloadInvoice(inv)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-blue-700 hover:text-blue-900 font-extrabold text-xs transition-all border border-slate-200 hover:border-blue-200 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Facture PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAYMENT PROVIDER ADAPTER MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Règlement Abonnement LocaTrust</h3>
                  <p className="text-xs text-slate-500">Paiement sécurisé et instantané</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Formule active</span>
                <span className="text-sm font-black text-slate-900">{currentPlan.tierName} ({activePropertiesCount} biens)</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Montant</span>
                <span className="text-lg font-black text-blue-700">{formatFCFA(currentPlan.amount)}</span>
              </div>
            </div>

            {/* Providers Selection */}
            <div>
              <label className="text-xs font-black text-slate-700 block mb-2">
                Choisissez votre moyen de paiement
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentProvider('wave')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    paymentProvider === 'wave'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                    W
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Wave CI</span>
                    <span className="text-[10px] text-emerald-600 font-bold">0% de frais</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentProvider('orange')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    paymentProvider === 'orange'
                      ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                    OM
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Orange Money</span>
                    <span className="text-[10px] text-slate-500 font-bold">Instantané</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentProvider('mtn')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    paymentProvider === 'mtn'
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    M
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">MTN MoMo</span>
                    <span className="text-[10px] text-slate-500 font-bold">Instantané</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentProvider('card')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    paymentProvider === 'card'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Carte Bancaire</span>
                    <span className="text-[10px] text-slate-500 font-bold">Visa / Mastercard</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Provider Form Inputs */}
            <form onSubmit={handleConfirmPayment} className="flex flex-col gap-4">
              {paymentProvider !== 'card' ? (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Numéro de téléphone mobile
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none"
                    placeholder="+225 07 00 00 00 00"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Un prompt de confirmation sera envoyé sur votre téléphone.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Numéro de carte bancaire
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Expiration</label>
                      <input
                        type="text"
                        defaultValue="12/28"
                        className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">CVC</label>
                      <input
                        type="password"
                        defaultValue="888"
                        maxLength={4}
                        className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validation en cours...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Régler {formatFCFA(currentPlan.amount)}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
