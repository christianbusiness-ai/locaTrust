'use client';

import React, { useState } from 'react';
import { MOCK_RECEIPTS, MOCK_RENT_PAYMENTS, MOCK_USERS } from '@/lib/mock/data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { formatFCFA, formatDateFr } from '@/lib/utils';
import { generateReceiptPDF } from '@/lib/pdf/generator';
import { Receipt, Download, QrCode, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';

export default function QuittancesPage() {
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);

  const currentUser = MOCK_USERS.locataire;

  const handleDownload = (paymentId: string) => {
    const pmt = MOCK_RENT_PAYMENTS.find(p => p.id === paymentId) || MOCK_RENT_PAYMENTS[0];
    const pdfText = generateReceiptPDF(pmt);
    setSelectedPdf(pdfText);
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
                <Receipt className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-extrabold text-slate-900">Mes Quittances de Loyer</h2>
                <p className="text-xs text-slate-500">
                  Documents officiels avec QR Code d'authenticité, certifiés par LocaTrust.
                </p>
              </div>
            </div>
          </div>

          {/* Quittances List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_RENT_PAYMENTS.filter(p => p.status === 'confirme').map((pmt) => (
              <div
                key={pmt.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                      Quittance Loyer — {pmt.target_month}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {pmt.contract?.property?.title}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Émise le {formatDateFr(pmt.confirmed_at || pmt.created_at)}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Payé
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Montant :</span>
                  <span className="font-extrabold text-slate-900 text-sm">{formatFCFA(pmt.amount)}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    onClick={() => handleDownload(pmt.id)}
                    className="flex-1 text-xs font-bold py-2 bg-brand-500 hover:bg-brand-600"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger PDF</span>
                  </Button>
                  <button
                    onClick={() => handleDownload(pmt.id)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    title="Vérifier QR Code"
                  >
                    <QrCode className="w-5 h-5 text-brand-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal / Preview of PDF Text */}
          {selectedPdf && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-brand-600" />
                    Aperçu Quittance PDF (Certifiée QR)
                  </h3>
                  <button onClick={() => setSelectedPdf(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900">Certificat d'Authenticité</span>
                    <span className="text-[11px] text-slate-500">Scannez ce QR Code pour vérifier la quittance</span>
                  </div>
                  <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg p-1 flex items-center justify-center shadow-sm">
                    <img
                      src={LOCATRUST_QR_CODE_DATA_URL}
                      alt="QR Code Quittance LocaTrust"
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                </div>

                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                  {selectedPdf}
                </pre>
                <Button onClick={() => setSelectedPdf(null)} className="w-full font-bold">
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
