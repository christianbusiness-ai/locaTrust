'use client';

import React, { useState } from 'react';
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
  FolderOpen
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { MOCK_CONTRACTS, MOCK_RECEIPTS } from '@/lib/mock/data';
import { ContractDetailView } from '@/components/contracts/ContractDetailView';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';

interface TenantPropertyRental {
  id: string;
  city: 'Abidjan' | 'Bouaké' | 'Yamoussoukro';
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
}

export const LocataireContratsView: React.FC = () => {
  const [contracts] = useState(MOCK_CONTRACTS);
  const [receipts] = useState(MOCK_RECEIPTS);
  const [selectedContractNumber, setSelectedContractNumber] = useState<string | null>(null);

  // Point 7: Multi-logements pour un même locataire (Abidjan, Bouaké, Yamoussoukro)
  const [tenantRentals] = useState<TenantPropertyRental[]>([
    {
      id: 'rent_abidjan',
      city: 'Abidjan',
      title: 'Appartement 3 pièces Cocody Riviera 3',
      address: 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire',
      contractNumber: 'LT-2026-CI-000492',
      rent: 150000,
      charges: 10000,
      cautionAmount: 300000,
      cautionStatus: 'active_consignee',
      bailleurName: 'Koffi Traoré',
      bailleurPhone: '+225 07 45 89 12 00',
      startDate: '01/01/2026',
      durationMonths: 12
    },
    {
      id: 'rent_bouake',
      city: 'Bouaké',
      title: 'Appartement 2 pièces Quartier Commerce',
      address: 'Avenue Reine Pokou, Commerce - Bouaké',
      contractNumber: 'LT-2026-CI-000511',
      rent: 95000,
      charges: 5000,
      cautionAmount: 190000,
      cautionStatus: 'active_consignee',
      bailleurName: 'Aïcha Diallo',
      bailleurPhone: '+225 01 22 33 44 55',
      startDate: '01/03/2026',
      durationMonths: 12
    },
    {
      id: 'rent_yamoussoukro',
      city: 'Yamoussoukro',
      title: 'Appartement 4 pièces Quartier Millionnaire',
      address: 'Résidence des Ministres, Quartier Millionnaire - Yamoussoukro',
      contractNumber: 'LT-2026-CI-000388',
      rent: 220000,
      charges: 15000,
      cautionAmount: 440000,
      cautionStatus: 'restituee',
      bailleurName: 'Koffi Traoré',
      bailleurPhone: '+225 07 45 89 12 00',
      startDate: '01/01/2025',
      durationMonths: 12
    }
  ]);

  const [activePropertyTab, setActivePropertyTab] = useState<string>('all');
  const [selectedBailleurDossier, setSelectedBailleurDossier] = useState<string | null>(null);

  const filteredRentals = tenantRentals.filter(
    r => activePropertyTab === 'all' || r.city.toLowerCase() === activePropertyTab.toLowerCase()
  );

  const handleDownloadContract = async (cnt: (typeof MOCK_CONTRACTS)[0]) => {
    const isAgency = cnt.owner?.user_metadata?.account_type === 'agence' || false;
    await generateOfficialContractPdf({
      contractNumber: cnt.contract_number,
      isAgency,
      ownerName: cnt.owner?.full_name || "Koffi N'Guessan",
      ownerPhone: cnt.owner?.phone || "+225 07 89 45 12 34",
      tenantName: cnt.tenant?.full_name || "Kouadio Jean",
      tenantPhone: cnt.tenant?.phone || "+225 05 67 89 45 12",
      tenantCni: "CI002894129",
      propertyTitle: cnt.property?.title || "Appartement 3 pièces",
      propertyAddress: `${cnt.property?.location.quartier}, ${cnt.property?.location.commune} - ${cnt.property?.location.city}`,
      durationMonths: cnt.duration_months || 12,
      startDate: '01/01/2026',
      rent: cnt.rent,
      cautionMonths: 2,
      chargesAmount: cnt.charges || 25000,
      dueDay: cnt.payment_due_day || 5
    });
  };

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

      {/* Point 7: Multi-logements selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Sélectionner un logement (Baux indépendants) :
        </span>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            onClick={() => setActivePropertyTab('abidjan')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activePropertyTab === 'abidjan'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Abidjan (Cocody)</span>
          </button>
          <button
            onClick={() => setActivePropertyTab('bouake')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activePropertyTab === 'bouake'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Bouaké (Commerce)</span>
          </button>
          <button
            onClick={() => setActivePropertyTab('yamoussoukro')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activePropertyTab === 'yamoussoukro'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Yamoussoukro (Millionnaire)</span>
          </button>
        </div>
      </div>

      {/* Point 6: Historique Complet par Bailleur (Bailleur A, Bailleur B) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black text-slate-900">
              Historique Complet Par Bailleur (Point 6 du SaaS)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">Dossier juridique par propriétaire</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Bailleur A: Koffi Traoré */}
          <div className="p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all bg-gradient-to-br from-white to-slate-50 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-black flex items-center justify-center text-xs">
                    KT
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Bailleur A : Koffi Traoré</h4>
                    <span className="text-[11px] text-slate-500 font-medium">2 logements loués (Abidjan & Yamoussoukro)</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                  Actif
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Contrats signés</span>
                  <span className="font-black text-slate-800">2 Baux Certifiés</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Caution & Restitution</span>
                  <span className="font-black text-emerald-700">1 Restituée • 1 Active</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Loyers payés</span>
                  <span className="font-black text-slate-800">18 mois à jour</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Quittances QR Code</span>
                  <span className="font-black text-blue-700">18 Reçus téléchargeables</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBailleurDossier('Koffi Traoré')}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Consulter l'historique complet (Bailleur A)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Bailleur B: Aïcha Diallo */}
          <div className="p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all bg-gradient-to-br from-white to-slate-50 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-800 font-black flex items-center justify-center text-xs">
                    AD
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Bailleur B : Aïcha Diallo</h4>
                    <span className="text-[11px] text-slate-500 font-medium">1 logement loué (Bouaké)</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                  Actif
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Contrats signés</span>
                  <span className="font-black text-slate-800">1 Bail Certifié</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Caution</span>
                  <span className="font-black text-blue-700">190 000 FCFA consignée</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Loyers payés</span>
                  <span className="font-black text-slate-800">6 mois à jour</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block">Quittances QR Code</span>
                  <span className="font-black text-blue-700">6 Reçus officiels</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBailleurDossier('Aïcha Diallo')}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Consulter l'historique complet (Bailleur B)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Leases Section (Indépendants par logement) */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-black text-slate-900">
          Contrats de Location Indépendants ({filteredRentals.length})
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
                    Bail d'Habitation
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
                  <span>Consulter le contrat</span>
                </button>

                <button
                  onClick={() => {
                    const mockCnt = contracts[0];
                    handleDownloadContract(mockCnt);
                  }}
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
            <h3 className="text-sm font-black text-slate-900">Mes Quittances de Loyer Officielles</h3>
          </div>
          <span className="text-xs text-slate-500 font-bold">QR Code de vérification intégré</span>
        </div>

        <div className="divide-y divide-slate-100">
          {receipts.map((rcp, idx) => (
            <div key={rcp.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                  REC
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-slate-900">Quittance N° REC-2026-00098{idx + 1}</span>
                  <span className="text-[11px] text-slate-500">
                    Loyer : <strong>{idx === 0 ? 'Août 2026 (Cocody)' : 'Juillet 2026 (Bouaké)'}</strong> — Montant : {formatFCFA(idx === 0 ? 150000 : 95000)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/verification/recu/${idx === 0 ? 'tok_rec_2026_000987' : 'tok_rec_2026_000988'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                >
                  Scanner / Vérifier
                </a>

                <button
                  onClick={async () => {
                    const { generateOfficialReceiptPDF } = await import('@/lib/payments/officialReceiptPdfGenerator');
                    await generateOfficialReceiptPDF({
                      receiptNumber: `REC-2026-00098${idx + 1}`,
                      contractNumber: idx === 0 ? 'LT-2026-CI-000492' : 'LT-2026-CI-000511',
                      contractToken: idx === 0 ? 'tok_rec_2026_000987' : 'tok_rec_2026_000988',
                      propertyTitle: idx === 0 ? 'Appartement 3 pièces Cocody Riviera 3' : 'Appartement 2 pièces Commerce Bouaké',
                      propertyAddress: idx === 0 ? 'Cocody Riviera 3, Abidjan - Côte d\'Ivoire' : 'Avenue Reine Pokou, Bouaké',
                      propertyReference: `BIEN-000${idx + 456}`,
                      propertyType: idx === 0 ? 'Appartement 3 pièces' : 'Appartement 2 pièces',
                      durationMonths: 12,
                      leaseStartDate: '01/01/2026',
                      leaseEndDate: '31/12/2026',
                      ownerName: idx === 0 ? "Koffi Traoré" : "Aïcha Diallo",
                      ownerCni: 'CI987654321',
                      ownerPhone: '05 05 43 21 00',
                      tenantName: 'Koffi N\'Guessan',
                      tenantCni: 'CI123456789',
                      tenantPhone: '07 00 12 34 56',
                      amount: idx === 0 ? 150000 : 95000,
                      periodCovered: idx === 0 ? 'Août 2026' : 'Juillet 2026',
                      paymentDate: idx === 0 ? '05/08/2026' : '04/07/2026',
                      paymentMethod: 'Mobile Money',
                      transactionReference: `MM2026090512345${idx + 1}`,
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger Quittance (PDF)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                {selectedBailleurDossier === 'Koffi Traoré' && (
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
