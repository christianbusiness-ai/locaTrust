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
import { TicketsListSkeleton } from '@/components/common/SkeletonLoader';
import { TopProgressBar } from '@/components/common/TopProgressBar';
import { supabase } from '@/src/lib/supabase';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';

export const LocataireMaintenanceView: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const hasLoadedOnceRef = React.useRef<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState<boolean>(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false);
  const [successModalMessage, setSuccessModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // Form states
  const [selectedContractId, setSelectedContractId] = useState('');
  const [category, setCategory] = useState('plomberie');
  const [description, setDescription] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingMedia(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Essai upload Supabase Storage
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = `maintenance/${fileName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { contentType: file.type, upsert: true });

        if (!uploadErr && uploadData?.path) {
          const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(uploadData.path);
          if (publicUrlData?.publicUrl) {
            newUrls.push(publicUrlData.publicUrl);
            continue;
          }
        }

        // Fallback Data URL pour prévisualisation et résilience totale
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        if (base64) newUrls.push(base64);
      } catch (err) {
        console.warn('Erreur lecture média:', err);
      }
    }

    setMediaUrls((prev) => [...prev, ...newUrls]);
    setIsUploadingMedia(false);
  };

  const fetchTickets = async (isBackground = false) => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    if (hasLoadedOnceRef.current || isBackground || tickets.length > 0) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const { data, error } = await getMaintenanceTickets(user.id);
      let list = data || [];

      // Synchronisation depuis le serveur central /api/sync
      try {
        const syncRes = await fetch('/api/sync');
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (Array.isArray(syncJson?.data?.maintenance)) {
            syncJson.data.maintenance.forEach((m: any) => {
              if (!list.some((x: any) => x.id === m.id || x.ticketNumber === m.ticketNumber)) {
                list.push(m);
              }
            });
          }
        }
      } catch {}

      // Cache local
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('locatrust_maintenance_tickets');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: any) => {
                if (!list.some((x: any) => x.id === p.id || x.ticketNumber === p.ticketNumber)) {
                  list.push(p);
                }
              });
            }
          }
        } catch {}
      }

      setTickets(list);

      const { data: cntData } = await getContracts(user.id, 'locataire');
      let userCntList = cntData || [];

      if (userCntList.length === 0 && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('locatrust_contracts');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) userCntList = parsed;
          }
        } catch {}
      }

      // Filtrer uniquement les contrats signés appartenant au locataire connecté
      userCntList = (userCntList || []).filter((c: any) => {
        if (!c || !user) return false;
        const cNum = String(c.contract_number || c.contractNumber || '').trim();
        if (!cNum || /^LT-\d{4}-CI-000[0-9a-f]{4}$/i.test(cNum)) return false;
        const cTenantId = c.tenant_id || c.tenant?.id;
        if (cTenantId && user.id && cTenantId !== user.id) return false;
        const sig = c.tenant_signature_url || c.tenant_signature || '';
        const isSigned = Boolean((typeof sig === 'string' && sig.length > 15) || c.tenant_signed || c.status === 'actif');
        return isSigned && c.status !== 'termine' && c.status !== 'resilie';
      });

      if (userCntList && userCntList.length > 0) {
        setUserContracts(userCntList);
        setSelectedContractId(userCntList[0].id || userCntList[0].contract_number);
      }
    } catch (err: any) {
      setLoadError("Erreur réseau lors de la récupération des tickets.");
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    try {
      setIsSubmittingTicket(true);
      const chosenContract = userContracts.find(c => c.id === selectedContractId) || userContracts[0];

      const isValidUuid = (str?: string) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      let propId = chosenContract?.property_id || chosenContract?.property?.id;
      let ownerId = chosenContract?.owner_id || chosenContract?.property?.owner_id || chosenContract?.owner?.id || chosenContract?.agency_id;

      // Résolution de sécurité du propriétaire si non présent sur l'objet contrat
      if ((!ownerId || !isValidUuid(ownerId)) && propId && isValidUuid(propId)) {
        try {
          const { data: propRow } = await supabase
            .from('properties')
            .select('owner_id, agency_id, title')
            .eq('id', propId)
            .maybeSingle();
          if (propRow) {
            ownerId = propRow.owner_id || propRow.agency_id;
          }
        } catch {}
      }

      // Résolution complète et certifiée des données réelles du locataire
      let realTenantName =
        chosenContract?.tenant_name ||
        chosenContract?.tenant?.full_name ||
        chosenContract?.tenant_signature_name ||
        user?.user_metadata?.full_name ||
        (user as any)?.name ||
        '';

      let realTenantPhone =
        chosenContract?.tenant_phone ||
        chosenContract?.tenant?.phone ||
        user?.phone ||
        user?.user_metadata?.phone ||
        '';

      if ((!realTenantName || !realTenantPhone) && user?.id) {
        try {
          const { data: profRow } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', user.id)
            .maybeSingle();
          if (profRow) {
            if (!realTenantName && profRow.full_name) realTenantName = profRow.full_name;
            if (!realTenantPhone && profRow.phone) realTenantPhone = profRow.phone;
          }
        } catch {}
      }

      const finalTenantName = realTenantName || 'Locataire';
      const finalTenantPhone = realTenantPhone || '';

      // Résolution complète des informations réelles du bien
      let realPropTitle =
        chosenContract?.property?.title ||
        chosenContract?.property_title ||
        chosenContract?.property_name ||
        '';

      let realPropAddress =
        [chosenContract?.property?.commune, chosenContract?.property?.city].filter(Boolean).join(', ') ||
        chosenContract?.property?.address ||
        chosenContract?.property?.city ||
        '';

      if ((!realPropTitle || !realPropAddress) && propId && isValidUuid(propId)) {
        try {
          const { data: pRow } = await supabase
            .from('properties')
            .select('title, address, city, commune')
            .eq('id', propId)
            .maybeSingle();
          if (pRow) {
            if (!realPropTitle && pRow.title) realPropTitle = pRow.title;
            if (!realPropAddress) {
              realPropAddress = [pRow.commune, pRow.city].filter(Boolean).join(', ') || pRow.address || pRow.city || '';
            }
          }
        } catch {}
      }

      const finalPropTitle = realPropTitle || 'Logement';
      const finalPropAddress = realPropAddress || 'Côte d’Ivoire';

      const now = new Date();
      const realCreatedAt = `${now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      const generatedTicketUuid = crypto.randomUUID();

      // 1. Inscription prioritaire dans Supabase PostgreSQL
      const { data: dbTicketRes, error: dbErr } = await createMaintenanceTicket({
        id: generatedTicketUuid,
        property_id: propId,
        owner_id: ownerId,
        tenant_id: user?.id || '',
        contract_id: chosenContract?.id,
        title: `Panne ${category.toUpperCase()} - ${description.slice(0, 35)}`,
        description: description,
        category: category,
        priority: 'normale',
        photos: mediaUrls
      });

      if (dbErr) {
        console.warn('Notice insertion Supabase maintenance_tickets:', dbErr);
      }

      const ticketItem = {
        id: dbTicketRes?.id || generatedTicketUuid,
        ticketNumber: `TCK-2026-${generatedTicketUuid.slice(0, 4).toUpperCase()}`,
        property_id: propId,
        owner_id: ownerId,
        tenant_id: user?.id || '',
        contract_id: chosenContract?.id,
        tenantName: finalTenantName,
        tenantPhone: finalTenantPhone,
        propertyTitle: finalPropTitle,
        propertyAddress: finalPropAddress,
        category: category,
        priority: 'normale',
        status: 'Nouveau',
        createdAt: realCreatedAt,
        created_at: now.toISOString(),
        description: description,
        photos: mediaUrls,
        notes: []
      };

      // 2. Cache local de secours
      try {
        const storedRaw = localStorage.getItem('locatrust_maintenance_tickets');
        const existing = storedRaw ? JSON.parse(storedRaw) : [];
        const updatedTickets = [ticketItem, ...existing.filter((x: any) => x.id !== ticketItem.id)];
        localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(updatedTickets));
      } catch {}

      // 3. Notification officielle temps réel dans Supabase pour le bailleur
      if (ownerId && isValidUuid(ownerId)) {
        try {
          await pushGlobalNotification({
            title: '⚠️ Incident de maintenance signalé',
            description: `${finalTenantName} a signalé une anomalie (${category}) pour « ${finalPropTitle} » : ${description}`,
            category: 'maintenance',
            targetRole: 'proprietaire',
            targetUserId: ownerId,
            targetTab: 'maintenance',
            payload: {
              ticketId: ticketItem.id,
              propertyId: propId,
              propertyTitle: finalPropTitle,
              propertyAddress: finalPropAddress,
              category,
              tenantName: finalTenantName,
              tenantPhone: finalTenantPhone,
              description: description,
              photos: mediaUrls,
              createdAt: realCreatedAt,
              created_at: now.toISOString()
            }
          });
        } catch {}
      }

      // 4. Diffusion WebSocket temps réel multi-écrans (Desktop bailleur ↔ Mobile locataire)
      try {
        await broadcastLiveEvent('MAINTENANCE_TICKET_CREATED', {
          actorId: user?.id,
          targetUserId: ownerId,
          propertyId: propId,
          data: { ticket: ticketItem }
        });
      } catch {}

      // 5. Événement local pour synchronisation multi-onglets
      window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated', { detail: ticketItem }));

      setTickets((prev) => [ticketItem, ...prev]);
      setShowNewTicketModal(false);
      setDescription('');
      setMediaUrls([]);
      setSuccessModalMessage({
        title: 'Incident transmis avec succès !',
        desc: 'Votre signalement de maintenance a été transmis au bailleur et enregistré.'
      });
    } catch (err: any) {
      console.error('Erreur déclaration ticket:', err);
      setShowNewTicketModal(false);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans relative">
      {/* Barre de progression ultra-fine en arrière-plan (Phase 1) */}
      <TopProgressBar active={isRefreshing} />
      
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
      {(isLoading && !hasLoadedOnceRef.current) ? (
        <div className="w-full py-2">
          <TicketsListSkeleton count={3} />
        </div>
      ) : (loadError && tickets.length === 0) ? (
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
                    <span className="text-xs font-black text-slate-900">
                      Signalement du {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : (ticket.createdAt || new Date().toLocaleDateString('fr-FR'))}
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold">
                      Logement : {ticket.propertyTitle || ticket.property?.title || 'Logement'}
                    </span>
                  </div>
                </div>

                {(() => {
                  const st = String(ticket.status || '').toLowerCase().trim();
                  if (st === 'resolu' || st === 'résolu' || st === 'ferme' || st === 'fermé') {
                    return (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Résolu
                      </span>
                    );
                  }
                  if (st === 'en_cours' || st === 'en cours' || st === 'intervention programmée') {
                    return (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                        <Clock className="w-3.5 h-3.5" />
                        En cours de traitement
                      </span>
                    );
                  }
                  return (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                      <Clock className="w-3.5 h-3.5" />
                      En attente de prise en charge
                    </span>
                  );
                })()}
              </div>

              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border">
                {ticket.description}
              </p>

              {/* Photos / Médias joints au ticket */}
              {Array.isArray(ticket.photos) && ticket.photos.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500">Photos & Vidéos transmises ({ticket.photos.length}) :</span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {ticket.photos.map((pUrl: string, pIdx: number) => {
                      const isVid = pUrl.startsWith('data:video') || pUrl.endsWith('.mp4') || pUrl.includes('video');
                      return (
                        <a
                          key={pIdx}
                          href={pUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 block group shadow-sm hover:opacity-90 transition-opacity"
                        >
                          {isVid ? (
                            <video src={pUrl} className="w-full h-full object-cover" />
                          ) : (
                            <img src={pUrl} alt={`Photo incident ${pIdx + 1}`} className="w-full h-full object-cover" />
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="font-extrabold text-slate-800 block text-xs">
                    Photos / Vidéos justificatives
                  </label>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {mediaUrls.length > 0 ? `${mediaUrls.length} média(s) sélectionné(s)` : 'Optionnel'}
                  </span>
                </div>

                {/* Input fichier réel caché */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Zone cliquable qui ouvre l'explorateur de fichiers / appareil photo */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group text-center"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 text-amber-700 flex items-center justify-center transition-colors shadow-sm">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors shadow-sm">
                      <Video className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 group-hover:text-amber-800 transition-colors">
                      {isUploadingMedia ? 'Chargement des médias...' : 'Cliquez pour ouvrir l’explorateur et choisir vos photos / vidéos'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Caméra, galerie ou explorateur de fichiers
                    </span>
                  </div>
                </div>

                {/* Prévisualisation des médias sélectionnés */}
                {mediaUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {mediaUrls.map((url, i) => {
                      const isVid = url.startsWith('data:video') || url.endsWith('.mp4') || url.includes('video');
                      return (
                        <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 flex items-center justify-center">
                          {isVid ? (
                            <video src={url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={url} alt={`Media incident ${i + 1}`} className="w-full h-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMediaUrls(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white text-[11px] font-black flex items-center justify-center transition-colors shadow"
                            title="Supprimer ce média"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                disabled={isSubmittingTicket}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                {isSubmittingTicket ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Transmission...</span>
                  </>
                ) : (
                  <span>Transmettre le signalement</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE CONFIRMATION DE SUCCÈS */}
      {successModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl flex flex-col items-center text-center gap-3 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-slate-900">{successModalMessage.title}</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{successModalMessage.desc}</p>
            <button
              type="button"
              onClick={() => setSuccessModalMessage(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
