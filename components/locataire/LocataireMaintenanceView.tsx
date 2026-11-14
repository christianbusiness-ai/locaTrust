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
  MessageSquare,
  Calendar
} from 'lucide-react';
import { MaintenanceTicket } from '@/types/database.types';
import { getMaintenanceTickets, createMaintenanceTicket, getContracts, resolvePropertyCity } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { TicketsListSkeleton } from '@/components/common/SkeletonLoader';
import { TopProgressBar } from '@/components/common/TopProgressBar';
import { supabase } from '@/src/lib/supabase';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { formatFCFA } from '@/lib/utils';

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
  const [tenantReplyText, setTenantReplyText] = useState<{ [ticketId: string]: string }>({});
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);

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

      // Helper de fusion sécurisée pour ne jamais écraser les réponses du bailleur
      const mergeTicket = (existing: any, incoming: any) => {
        const existingNotes = Array.isArray(existing.notes) ? existing.notes : [];
        const incomingNotes = Array.isArray(incoming.notes) ? incoming.notes : [];
        const notesMap = new Map<string, any>();
        existingNotes.forEach((n: any) => notesMap.set(String(n.id || n.content), n));
        incomingNotes.forEach((n: any) => notesMap.set(String(n.id || n.content), n));
        const mergedNotes = Array.from(notesMap.values());

        return {
          ...existing,
          ...incoming,
          status: incoming.status || existing.status,
          scheduledDate: incoming.scheduledDate || existing.scheduledDate,
          notes: mergedNotes.length > 0 ? mergedNotes : (existingNotes.length > 0 ? existingNotes : incomingNotes),
          rentDeductionRequest: incoming.rentDeductionRequest || existing.rentDeductionRequest
        };
      };

      // 2. Synchronisation depuis le serveur central /api/sync
      try {
        const syncRes = await fetch(`/api/sync?userId=${user.id}`);
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (Array.isArray(syncJson?.data?.maintenance)) {
            syncJson.data.maintenance.forEach((m: any) => {
              const existingIdx = list.findIndex((x: any) => x.id === m.id || (m.ticketNumber && x.ticketNumber === m.ticketNumber));
              if (existingIdx === -1) {
                list.push(m);
              } else {
                list[existingIdx] = mergeTicket(list[existingIdx], m);
              }
            });
          }
        }
      } catch {}

      // 3. Récupération & fusion directe depuis les notifications Supabase de maintenance
      try {
        const { data: maintNotifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('category', 'maintenance')
          .order('created_at', { ascending: false });

        if (maintNotifs && maintNotifs.length > 0) {
          maintNotifs.forEach((n: any) => {
            let meta: any = {};
            if (typeof n.metadata === 'string') {
              try { meta = JSON.parse(n.metadata); } catch {}
            } else if (n.metadata) {
              meta = n.metadata;
            } else if (n.payload) {
              meta = n.payload;
            }
            const tId = meta.ticketId || meta.ticket_id || n.id;
            const tNum = meta.ticketNumber;
            const existingIdx = list.findIndex((x: any) => (tId && x.id === tId) || (tNum && x.ticketNumber === tNum));
            const incomingNotes = Array.isArray(meta.notes) ? meta.notes : [];

            if (existingIdx !== -1) {
              list[existingIdx] = mergeTicket(list[existingIdx], {
                status: meta.status,
                scheduledDate: meta.scheduledDate,
                notes: incomingNotes
              });
            } else if (tId) {
              list.push({
                id: tId,
                ticketNumber: tNum || `TCK-2026-${String(tId).slice(0, 4).toUpperCase()}`,
                propertyTitle: meta.propertyTitle || 'Logement',
                propertyAddress: meta.propertyAddress || '',
                category: meta.category || 'Général',
                status: meta.status || 'Nouveau',
                description: meta.description || n.description || '',
                notes: incomingNotes,
                photos: Array.isArray(meta.photos) ? meta.photos : [],
                scheduledDate: meta.scheduledDate || '',
                createdAt: n.created_at ? new Date(n.created_at).toLocaleDateString('fr-FR') : 'Date récente',
                created_at: n.created_at || new Date().toISOString()
              });
            }
          });
        }
      } catch {}

      // 4. Cache local réactif de secours
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('locatrust_maintenance_tickets');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: any) => {
                const existingIdx = list.findIndex((x: any) => x.id === p.id || (p.ticketNumber && x.ticketNumber === p.ticketNumber));
                if (existingIdx === -1) {
                  list.push(p);
                } else {
                  list[existingIdx] = mergeTicket(list[existingIdx], p);
                }
              });
            }
          }
        } catch {}
      }

      // 5. Réconciliation directe avec les dépenses & accords de déduction (Scénarios A, B, C)
      try {
        let expenseList: any[] = [];
        if (typeof window !== 'undefined') {
          const rawExpenses = localStorage.getItem('locatrust_property_expenses');
          if (rawExpenses) {
            try { expenseList = JSON.parse(rawExpenses); } catch {}
          }
        }
        if (expenseList.length === 0 && user?.id) {
          try {
            const { data: dbExp } = await supabase
              .from('property_expenses')
              .select('*')
              .or(`tenant_id.eq.${user.id},title.ilike.%${user?.user_metadata?.full_name || 'Christian'}%`);
            if (dbExp && dbExp.length > 0) expenseList = dbExp;
          } catch {}
        }

        if (Array.isArray(expenseList)) {
          expenseList.forEach((exp: any) => {
            const expTicketNum = (exp.title || '').match(/TCK-[A-Z0-9-]+/i)?.[0];
            const targetTicket = list.find((t: any) =>
              (exp.ticket_id && (t.id === exp.ticket_id || t.ticketNumber === exp.ticket_id)) ||
              (expTicketNum && (t.ticketNumber === expTicketNum || t.id === expTicketNum || (t.id && t.id.includes(expTicketNum))))
            );
            if (targetTicket) {
              const noteText =
                exp.scenario === 'C'
                  ? `Accord officiel du bailleur pour réparation : Vous êtes expressément autorisé(e) à faire réaliser la réparation pour un montant de ${formatFCFA(exp.amount)}. Ce montant sera déduit de votre loyer conformément au Scénario C.`
                  : exp.scenario === 'B'
                  ? `Décision du bailleur : La réparation avancée de ${formatFCFA(exp.amount)} est à la charge locative conformément au contrat de bail (Scénario B). Un remboursement ou plan d'apurement sera convenu.`
                  : `Prise en charge par le bailleur : La réparation de ${formatFCFA(exp.amount)} est intégralement prise en charge par le propriétaire (Scénario A). Aucun frais pour le locataire.`;

              const hasNote = Array.isArray(targetTicket.notes) && targetTicket.notes.some((n: any) => n.content && n.content.includes(formatFCFA(exp.amount)));
              if (!hasNote) {
                targetTicket.notes = [
                  ...(Array.isArray(targetTicket.notes) ? targetTicket.notes : []),
                  {
                    id: `note-exp-${exp.id}`,
                    author: 'Propriétaire (Accord officiel)',
                    content: noteText,
                    date: exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('fr-FR') : 'Récemment',
                    isInternal: false
                  }
                ];
              }

              if (targetTicket.status === 'Nouveau' || targetTicket.status === 'En attente') {
                targetTicket.status = 'En cours';
              }

              if (exp.scenario === 'C') {
                targetTicket.rentDeductionRequest = {
                  status: 'approuve',
                  amountSpent: exp.amount,
                  deductionMonth: 'Prochain loyer'
                };
              }
            }
          });
        }
      } catch {}

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
    const handleUpdate = () => fetchTickets(true);
    window.addEventListener('locatrust:maintenance-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const handleOpenTicket = (e: any) => {
      const tId = e?.detail?.ticketId || (e?.detail?.ticket && e.detail.ticket.id);
      if (tId) {
        setHighlightedTicketId(tId);
        setTimeout(() => {
          const el = document.getElementById(`tenant-ticket-${tId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
        setTimeout(() => setHighlightedTicketId(null), 5000);
      }
    };
    window.addEventListener('locatrust:open_maintenance_ticket', handleOpenTicket);

    // Si un ticket a été ciblé récemment (ex: clic sur la bannière)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('locatrust_selected_maintenance_ticket');
      if (stored) {
        setTimeout(() => handleOpenTicket({ detail: { ticketId: stored } }), 200);
      }
    }

    return () => {
      window.removeEventListener('locatrust:maintenance-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('locatrust:open_maintenance_ticket', handleOpenTicket);
    };
  }, [user]);

  const handleTenantSendReply = async (ticket: any) => {
    const text = (tenantReplyText[ticket.id] || '').trim();
    if (!text || !ticket) return;

    const now = new Date();
    const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const tenantAuthorName = user?.user_metadata?.full_name || (user as any)?.name || 'Locataire (Vous)';

    const newNote = {
      id: `n-${Date.now()}`,
      author: tenantAuthorName,
      content: text,
      date: dateStr,
      isInternal: false
    };

    const currentNotes = Array.isArray(ticket.notes) ? ticket.notes : [];
    const updatedNotes = [...currentNotes, newNote];

    const updatedTicket = {
      ...ticket,
      notes: updatedNotes
    };

    // 1. Mise à jour instantanée de l'interface
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updatedTicket : t)));
    setTenantReplyText((prev) => ({ ...prev, [ticket.id]: '' }));

    // 2. Cache local réactif
    try {
      const raw = localStorage.getItem('locatrust_maintenance_tickets');
      const curList = raw ? JSON.parse(raw) : [];
      const nextList = curList.map((t: any) => (t.id === ticket.id ? updatedTicket : t));
      localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(nextList));
    } catch {}

    // 3. Inscription Supabase
    try {
      const richDesc = JSON.stringify({
        description: updatedTicket.description,
        category: updatedTicket.category,
        notes: updatedNotes,
        scheduledDate: updatedTicket.scheduledDate,
        rentDeductionRequest: updatedTicket.rentDeductionRequest
      });
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket.id)) {
        await supabase
          .from('maintenance_tickets')
          .update({
            description: richDesc,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticket.id);
      }

      // Mettre à jour la notification du locataire dans Supabase
      if (user?.id) {
        const { data: locNotifs } = await supabase
          .from('notifications')
          .select('id, metadata, payload')
          .eq('user_id', user.id)
          .eq('category', 'maintenance');

        if (locNotifs && locNotifs.length > 0) {
          for (const on of locNotifs) {
            const meta = typeof on.metadata === 'string' ? JSON.parse(on.metadata) : (on.metadata || on.payload || {});
            if (meta.ticketId === ticket.id || meta.ticket_id === ticket.id || on.id === ticket.id) {
              const nextMeta = { ...meta, notes: updatedNotes };
              await supabase
                .from('notifications')
                .update({
                  metadata: JSON.stringify(nextMeta),
                  payload: nextMeta
                })
                .eq('id', on.id);
            }
          }
        }
      }
    } catch {}

    // 4. Notification officielle pour le bailleur
    let targetOwnerId = ticket.owner_id || ticket.ownerId;
    if (!targetOwnerId) {
      const matchCnt = userContracts.find(c => c.id === ticket.contract_id || c.property_id === ticket.property_id);
      targetOwnerId = matchCnt?.owner_id || matchCnt?.property?.owner_id || matchCnt?.agency_id;
    }
    if (targetOwnerId) {
      try {
        await pushGlobalNotification({
          title: '💬 Réponse du locataire pour un incident',
          description: `${tenantAuthorName} a répondu pour « ${ticket.propertyTitle} » : "${text}"`,
          category: 'maintenance',
          targetRole: 'proprietaire',
          targetUserId: targetOwnerId,
          targetTab: 'maintenance',
          payload: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            propertyTitle: ticket.propertyTitle,
            category: ticket.category,
            notes: updatedNotes
          }
        });
      } catch {}
    }

    // 5. Broadcast WebSocket multi-écrans
    try {
      await broadcastLiveEvent('MAINTENANCE_TICKET_UPDATED', {
        ticket: updatedTicket,
        actorId: user?.id,
        targetUserId: targetOwnerId
      });
    } catch {}

    // 6. Synchronisation centrale
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_maintenance_ticket',
          ticketId: ticket.id,
          status: ticket.status,
          notes: updatedNotes,
          scheduledDate: ticket.scheduledDate,
          description: ticket.description,
          rentDeductionRequest: ticket.rentDeductionRequest,
          notificationTitle: '💬 Réponse du locataire concernant un incident',
          notificationDescription: `${tenantAuthorName} : "${text}"`,
          ownerId: targetOwnerId,
          tenantId: user?.id
        })
      });
    } catch {}

    window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated', { detail: updatedTicket }));
  };

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
      const finalPropAddress = resolvePropertyCity(
        finalPropTitle,
        realPropAddress,
        chosenContract?.property?.city,
        chosenContract?.property?.commune
      );

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

      // 4. Synchronisation avec le serveur central /api/sync
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_maintenance_ticket',
            ticket: ticketItem
          })
        });
      } catch {}

      // 5. Diffusion WebSocket temps réel multi-écrans (Desktop bailleur ↔ Mobile locataire)
      try {
        await broadcastLiveEvent('MAINTENANCE_TICKET_CREATED', {
          actorId: user?.id,
          targetUserId: ownerId,
          propertyId: propId,
          data: { ticket: ticketItem }
        });
      } catch {}

      // 6. Événement local pour synchronisation multi-onglets
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
              id={`tenant-ticket-${ticket.id}`}
              className={`bg-white rounded-3xl border p-6 shadow-sm flex flex-col gap-4 transition-all duration-300 ${
                highlightedTicketId === ticket.id
                  ? 'border-amber-500 ring-4 ring-amber-400/50 shadow-xl scale-[1.01]'
                  : 'border-slate-200'
              }`}
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

              {/* Accord officiel de réparation avec déduction de loyer (Scénario C) */}
              {ticket.rentDeductionRequest?.status === 'approuve' && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 text-xs text-emerald-950 flex flex-col gap-2 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2 text-emerald-800 font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="uppercase tracking-wider text-[11px]">Accord officiel du bailleur — Déduction autorisée sur loyer</span>
                  </div>
                  <p className="font-semibold text-slate-800 leading-relaxed">
                    Votre bailleur vous autorise expressément à faire effectuer la réparation pour un montant de{' '}
                    <strong className="text-emerald-900 font-black">{formatFCFA(ticket.rentDeductionRequest.amountSpent)}</strong>.
                    Ce montant sera automatiquement compensé et déduit de votre prochain loyer conformément au Scénario C.
                  </p>
                </div>
              )}

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

              {/* Artisan intervention planifiée */}
              {ticket.scheduledDate && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    📅 <strong>Intervention d'artisan programmée :</strong> {ticket.scheduledDate}
                  </span>
                </div>
              )}

              {/* Historique des échanges & Réponses du bailleur */}
              {((Array.isArray(ticket.notes) && ticket.notes.filter((n: any) => !n.isInternal).length > 0) || (Array.isArray(ticket.responses) && ticket.responses.length > 0)) && (
                <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Historique des échanges & Réponses
                  </span>
                  <div className="flex flex-col gap-2">
                    {/* Notes non-internes du ticket */}
                    {Array.isArray(ticket.notes) && ticket.notes.filter((n: any) => !n.isInternal).map((note: any) => {
                      const isFromOwner = note.author && (
                        note.author.toLowerCase().includes('propriétaire') ||
                        note.author.toLowerCase().includes('bailleur') ||
                        note.author.toLowerCase().includes('agence')
                      );
                      return (
                        <div
                          key={note.id}
                          className={`p-3.5 rounded-2xl text-xs flex flex-col gap-1 border ${
                            isFromOwner
                              ? 'bg-blue-50/90 border-blue-200 text-slate-800'
                              : 'bg-slate-50 border-slate-200 text-slate-800 self-end max-w-[90%]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`font-black ${isFromOwner ? 'text-blue-950' : 'text-slate-900'}`}>
                              {note.author}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">{note.date}</span>
                          </div>
                          <p className="text-slate-800 font-medium leading-relaxed">{note.content}</p>
                        </div>
                      );
                    })}

                    {/* Responses legacy */}
                    {Array.isArray(ticket.responses) && ticket.responses.map((resp: any) => (
                      <div key={resp.id} className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs flex flex-col gap-1">
                        <span className="font-black text-blue-950">{resp.author?.full_name || 'Bailleur'}</span>
                        <p className="text-slate-800 font-medium">{resp.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Champ réponse pour le locataire */}
              {ticket.status !== 'Résolu' && ticket.status !== 'Fermé' && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={tenantReplyText[ticket.id] || ''}
                    onChange={(e) => setTenantReplyText({ ...tenantReplyText, [ticket.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleTenantSendReply(ticket)}
                    placeholder="Répondre au bailleur..."
                    className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleTenantSendReply(ticket)}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Répondre</span>
                  </button>
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
