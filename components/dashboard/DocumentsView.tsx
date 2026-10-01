'use client';

import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Search,
  Download,
  Eye,
  Building2,
  User,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  X,
  ExternalLink
} from 'lucide-react';
import { MOCK_CONTRACTS } from '@/lib/mock/data';
import { triggerCelebration } from '@/lib/celebration';

interface TenantDocumentRow {
  id: string;
  tenant_name: string;
  tenant_avatar: string;
  tenant_phone: string;
  property_title: string;
  property_address: string;
  contract_number: string;
  contract_date: string;
  documents_count: number;
  documents: {
    title: string;
    type: 'contrat' | 'cni' | 'etat_des_lieux' | 'avenant' | 'assurance';
    date: string;
    file_name: string;
  }[];
}

const MOCK_DOCS_LIST: TenantDocumentRow[] = [
  {
    id: 'doc_row_1',
    tenant_name: "Koffi N'Guessan",
    tenant_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 07 08 09 10 11',
    property_title: 'Appartement 3 pièces Cocody Riviera 3',
    property_address: 'Cocody Riviera 3, Abidjan',
    contract_number: 'LT-2026-CI-000492',
    contract_date: '01/01/2026',
    documents_count: 4,
    documents: [
      { title: 'Contrat de bail certifié conforme', type: 'contrat', date: '01/01/2026', file_name: 'Contrat_Bail_LT-2026-CI-000492.pdf' },
      { title: 'Pièce d\'identité locataire (CNI)', type: 'cni', date: '01/01/2026', file_name: 'CNI_Koffi_NGuessan.pdf' },
      { title: 'État des lieux d\'entrée contradictoire', type: 'etat_des_lieux', date: '01/01/2026', file_name: 'Etat_Des_Lieux_Entree_000492.pdf' },
      { title: 'Attestation d\'assurance habitation', type: 'assurance', date: '05/01/2026', file_name: 'Assurance_Habitation_2026.pdf' }
    ]
  },
  {
    id: 'doc_row_2',
    tenant_name: 'Amina Diabaté',
    tenant_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 05 55 66 77 88',
    property_title: 'Villa 4 pièces Riviera M\'Badon',
    property_address: 'Riviera M\'Badon, Cocody',
    contract_number: 'LT-2026-CI-000508',
    contract_date: '01/05/2026',
    documents_count: 3,
    documents: [
      { title: 'Contrat de bail notifié', type: 'contrat', date: '01/05/2026', file_name: 'Contrat_Bail_LT-2026-CI-000508.pdf' },
      { title: 'Pièce d\'identité (Passeport/CNI)', type: 'cni', date: '01/05/2026', file_name: 'Passeport_Amina_Diabate.pdf' },
      { title: 'État des lieux d\'entrée', type: 'etat_des_lieux', date: '02/05/2026', file_name: 'Etat_Des_Lieux_Villa_Mbadon.pdf' }
    ]
  },
  {
    id: 'doc_row_3',
    tenant_name: 'Kouadio Jean',
    tenant_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    tenant_phone: '+225 05 67 89 45 12',
    property_title: 'Studio meublé Marcory Zone 4',
    property_address: 'Marcory Zone 4, Abidjan',
    contract_number: 'LT-2026-CI-000512',
    contract_date: '01/08/2026',
    documents_count: 4,
    documents: [
      { title: 'Contrat de bail d\'habitation', type: 'contrat', date: '01/08/2026', file_name: 'Contrat_Bail_Studio_000512.pdf' },
      { title: 'Avenant n°1 au contrat', type: 'avenant', date: '15/08/2026', file_name: 'Avenant_1_Climatiseur.pdf' },
      { title: 'Pièce d\'identité nationale', type: 'cni', date: '01/08/2026', file_name: 'CNI_Kouadio_Jean.pdf' },
      { title: 'État des lieux d\'entrée et inventaire', type: 'etat_des_lieux', date: '01/08/2026', file_name: 'Inventaire_Meuble_Marcory.pdf' }
    ]
  }
];

interface DocumentsViewProps {
  onOpenContractDetail?: (contractNumber: string) => void;
  onOpenReceipts?: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  onOpenContractDetail,
  onOpenReceipts
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantRow, setSelectedTenantRow] = useState<TenantDocumentRow | null>(null);

  const filteredRows = MOCK_DOCS_LIST.filter(
    (row) =>
      row.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.property_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.contract_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Gestion Documentaire
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-extrabold border border-blue-200 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-blue-600" />
              Archives & Contrats
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consultez les contrats de bail, avenants, états des lieux et pièces d'identité classés par locataire et par bien.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher locataire, bien, contrat..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Compact Rows Table (Locataire | Bien | Contrat | Documents | Actions) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Dossiers Documentaires par Locataire ({filteredRows.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Affichage compact et optimisé de l'historique administratif.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="p-4">Locataire</th>
                <th className="p-4">Bien Immobilier</th>
                <th className="p-4">Contrat de Bail</th>
                <th className="p-4">Documents Rattachés</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  
                  {/* Locataire */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={row.tenant_avatar}
                        alt={row.tenant_name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900">{row.tenant_name}</span>
                        <span className="text-[11px] text-slate-500">{row.tenant_phone}</span>
                      </div>
                    </div>
                  </td>

                  {/* Bien */}
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{row.property_title}</span>
                      <span className="text-[11px] text-slate-500">{row.property_address}</span>
                    </div>
                  </td>

                  {/* Contrat */}
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-blue-700">{row.contract_number}</span>
                      <span className="text-[10px] text-slate-400">Signé le {row.contract_date}</span>
                    </div>
                  </td>

                  {/* Documents rattachés */}
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[10px] flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {row.documents_count} fichier(s)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Bail, CNI, État des lieux...)
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTenantRow(row)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm flex items-center gap-1 transition-all active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Voir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenReceipts) onOpenReceipts();
                          else alert(`Ouverture des reçus pour ${row.tenant_name}`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <span>Voir les reçus</span>
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VOIR LES DOCUMENTS D'UN LOCATAIRE */}
      {selectedTenantRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 font-sans">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                  <Folder className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Documents — {selectedTenantRow.tenant_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedTenantRow.property_title} • {selectedTenantRow.contract_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTenantRow(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto">
              {selectedTenantRow.documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 hover:bg-white transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold text-slate-900 text-xs truncate">
                        {doc.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        {doc.file_name} • Ajouté le {doc.date}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        triggerCelebration('download');
                        alert(`Téléchargement sécurisé de : ${doc.file_name}`);
                      }}
                      className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedTenantRow(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={() => {
                  const cntNum = selectedTenantRow.contract_number;
                  setSelectedTenantRow(null);
                  if (onOpenContractDetail) onOpenContractDetail(cntNum);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-sm flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ouvrir le contrat complet</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
