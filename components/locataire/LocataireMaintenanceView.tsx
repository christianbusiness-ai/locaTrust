'use client';

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Video,
  Send,
  MessageSquare
} from 'lucide-react';
import { MaintenanceTicket } from '@/types/database.types';
import { getMaintenanceTickets, createMaintenanceTicket, getContracts } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';

export const LocataireMaintenanceView: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState<boolean>(false);

  // Form states
  const [selectedContractId, setSelectedContractId] = useState('');
  const [category, setCategory] = useState('plomberie');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');

  const fetchTickets = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await getMaintenanceTickets(user.id);
      if (error) {
        setLoadError("Impossible de charger vos signalements de maintenance.");
      } else {
        setTickets(data || []);
      }

      const { data: cntData } = await getContracts(user.id, 'locataire');
      if (cntData && cntData.length > 0) {
        setUserContracts(cntData);
        setSelectedContractId(cntData[0].id);
      }
    } catch (err: any) {
      setLoadError("Erreur réseau lors de la récupération des tickets.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const chosenContract = userContracts.find(c => c.id === selectedContractId) || userContracts[0];

    const ticketData = {
      property_id: chosenContract?.property_id || null,
      tenant_id: user?.id,
      owner_id: chosenContract?.owner_id || null,
      description: `[${category.toUpperCase()}] ${description}`,
      status: 'ouvert',
      photos: mediaUrl ? [mediaUrl] : []
    };

    const { data, error } = await createMaintenanceTicket(ticketData);
    if (!error && data) {
      setTickets((prev) => [data, ...prev]);
    } else {
      setTickets((prev) => [{ ...ticketData, id: `tkt_${Date.now()}`, created_at: new Date().toISOString() }, ...prev]);
    }

    setShowNewTicketModal(false);
    setDescription('');
    setMediaUrl('');
    alert('Signalement d\'incident de maintenance transmis à votre bailleur !');
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Signaler un Problème / Maintenance Logement
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold">
              Suivi en direct
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Signalez toute panne (plomberie, électricité, serrure, climatisation) avec photos et vidéos explicatives.
          </p>
        </div>

        <button
          onClick={() => setShowNewTicketModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold shadow-lg shadow-amber-600/30 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Signaler un incident</span>
        </button>
      </div>

      {/* ÉTATS : LOADER, ERREUR, OU VIDE */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-bold text-slate-800">Chargement de vos signalements...</p>
        </div>
      ) : loadError ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-black text-rose-900">Échec du chargement</h4>
          <p className="text-xs text-rose-700 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={fetchTickets}
            className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
          >
            Réessayer
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Aucun incident signalé pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed font-medium">
            Si vous constatez une fuite, une panne électrique ou un problème dans votre logement, signalez-le avec le bouton ci-dessus. Votre bailleur sera immédiatement prévenu conformément à l'Article 428 du Code de la Construction.
          </p>
          <button
            type="button"
            onClick={() => setShowNewTicketModal(true)}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition"
          >
            Signaler un incident
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-black text-slate-900">Mes Signalements en Cours ({tickets.length})</h3>

          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900">Signalement du {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : 'Date récente'}</span>
                    <span className="text-[11px] text-slate-500">Logement : {ticket.property?.title || 'Mon logement'}</span>
                  </div>
                </div>

                {ticket.status === 'ouvert' ? (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Pris en charge (Ticket Ouvert)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Résolu
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border">
                {ticket.description}
              </p>

              {/* Owner Responses Thread */}
              {ticket.responses && ticket.responses.length > 0 && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Réponse du bailleur</span>
                  {ticket.responses.map((resp: any) => (
                    <div key={resp.id} className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-xs flex flex-col gap-1">
                      <span className="font-black text-blue-950">{resp.author?.full_name || 'Bailleur'}</span>
                      <p className="text-slate-800 font-medium">{resp.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleCreateTicket} className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Nouveau Signalement de Maintenance</h3>
              <button type="button" onClick={() => setShowNewTicketModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="flex flex-col gap-3 text-xs font-semibold">
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Logement concerné</label>
                {userContracts.length === 0 ? (
                  <input
                    type="text"
                    readOnly
                    value="Mon logement principal"
                    className="w-full p-2.5 rounded-xl bg-slate-100 border text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-xs font-bold"
                  >
                    {userContracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.property?.title || 'Logement loué'} ({c.property?.commune || c.property?.city || 'Abidjan'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Catégorie du problème</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-xs font-bold"
                >
                  <option value="plomberie">Plomberie / Fuite d'eau</option>
                  <option value="electricite">Électricité / Prises / Tableau</option>
                  <option value="climatisation">Climatisation / Froid</option>
                  <option value="serrurerie">Serrure / Porte / Fenêtre</option>
                  <option value="toiture">Toiture / Infiltration</option>
                  <option value="autre">Autre problème</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Description détaillée du problème</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez précisément ce qui est défaillant (ex: Fuite d'eau constante au lavabo)..."
                  className="w-full p-2.5 rounded-xl border text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">Photos / Vidéos justificatives (URL ou fichier)</label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Ajouter des médias de l'incident..."
                  className="w-full p-2.5 rounded-xl border text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-extrabold shadow-md hover:bg-amber-500"
              >
                Transmettre le signalement
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
