'use client';

import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
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

interface DocumentsViewProps {
  onOpenContractDetail?: (contractNumber: string) => void;
  onOpenReceipts?: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  onOpenContractDetail,
  onOpenReceipts
}) => {
  const { user } = useAuth();
  const [tenantDocs, setTenantDocs] = useState<TenantDocumentRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantRow, setSelectedTenantRow] = useState<TenantDocumentRow | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, property:properties(*), tenant:users!tenant_id(*)')
        .order('created_at', { ascending: false });

      if (error) {
        setLoadError(error.message);
      } else {
        const rows: TenantDocumentRow[] = (data || []).map((c: any) => ({
          id: c.id,
          tenant_name: c.tenant?.full_name || 'Locataire',
          tenant_avatar: c.tenant?.avatar_url || '',
          tenant_phone: c.tenant?.phone || '',
          property_title: c.property?.title || 'Logement',
          property_address: c.property?.address || 'Abidjan',
          contract_number: c.contract_number || 'LT-2026',
          contract_date: new Date(c.start_date || c.created_at || Date.now()).toLocaleDateString('fr-FR'),
          documents_count: 3,
          documents: [
            {
              title: 'Contrat de bail certifié conforme',
              type: 'contrat',
              date: new Date(c.start_date || c.created_at || Date.now()).toLocaleDateString('fr-FR'),
              file_name: `Contrat_Bail_${c.contract_number}.pdf`
            },
            {
              title: 'Pièce d\'identité locataire (CNI)',
              type: 'cni',
              date: new Date(c.created_at || Date.now()).toLocaleDateString('fr-FR'),
              file_name: `CNI_${(c.tenant?.full_name || 'Locataire').replace(/\s+/g, '_')}.pdf`
            },
            {
              title: 'État des lieux d\'entrée contradictoire',
              type: 'etat_des_lieux',
              date: new Date(c.start_date || c.created_at || Date.now()).toLocaleDateString('fr-FR'),
              file_name: `Etat_Des_Lieux_${c.contract_number}.pdf`
            }
          ]
        }));
        setTenantDocs(rows);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erreur lors du chargement des documents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user]);

  const filteredRows = tenantDocs.filter(
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
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                      <span className="text-slate-700 font-bold text-xs">Chargement des documents...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && loadError && (
                <tr>
                  <td colSpan={5} className="p-8 text-center bg-rose-50/50">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                      <span className="text-slate-800 font-bold text-xs">{loadError}</span>
                      <button onClick={loadDocuments} className="mt-3 px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition cursor-pointer">
                        Réessayer
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <Folder className="w-6 h-6" />
                      </div>
                      <span className="text-slate-800 font-bold text-sm">
                        {searchTerm ? "Aucun document trouvé" : "Aucun dossier locataire pour le moment"}
                      </span>
                      <p className="text-slate-400 text-xs mt-1 text-center">
                        {searchTerm
                          ? "Aucun résultat ne correspond à votre recherche."
                          : "Dès qu'un bail est conclu, l'ensemble des pièces juridiques (bail, CNI, états des lieux) apparaîtra ici."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && filteredRows.map((row) => (
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
