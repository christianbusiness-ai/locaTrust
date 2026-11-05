'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  CheckCheck,
  Check,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ChevronLeft,
  LifeBuoy,
  RefreshCw,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import {
  ChatMessage,
  getAdminStoredMessages,
  getAdminUnreadCountForClient,
  markAdminClientMessagesAsRead,
  sendChatMessage,
  isValidUuid
} from '@/lib/messagingStore';
import { supabase } from '@/src/lib/supabase';

export interface AdminChatClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: 'locataire' | 'proprietaire' | 'agence' | 'user';
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'en_attente' | 'resolu';
}

interface AdminDirectChatViewProps {
  onTotalUnreadChange?: (count: number) => void;
}

export const AdminDirectChatView: React.FC<AdminDirectChatViewProps> = ({ onTotalUnreadChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'pending' | 'resolved'>('all');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  // 1. Charger les profils réels pour enrichir les noms et numéros des clients
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data } = await supabase.from('profiles').select('id, full_name, phone, email, account_type, role');
        if (data && Array.isArray(data)) {
          const map: Record<string, any> = {};
          data.forEach(p => {
            if (p?.id) map[p.id] = p;
          });
          setProfilesMap(map);
        }
      } catch {}
    };
    fetchProfiles();
  }, []);

  // 2. Synchronisation et écoute temps réel des messages
  const reloadMessages = () => {
    const all = getAdminStoredMessages();
    setMessages(all);

    // Règle impérative : Si l'admin est ACTUELLEMENT dans la discussion avec un client,
    // marquer tout nouveau message de ce client comme vu et lu immédiatement (le compteur reste à 0)
    const currentActiveClient = selectedClientIdRef.current;
    if (currentActiveClient) {
      const hasUnread = all.some(
        m => m && m.sender_id === currentActiveClient && !m.read && !m.is_read && m.status !== 'read'
      );
      if (hasUnread) {
        markAdminClientMessagesAsRead(currentActiveClient);
      }
    }
  };

  useEffect(() => {
    reloadMessages();

    const handleUpdate = () => {
      reloadMessages();
    };

    window.addEventListener('locatrust:messages_updated', handleUpdate);
    window.addEventListener('locatrust:messages-updated', handleUpdate);
    window.addEventListener('locatrust:support_tickets_updated', handleUpdate);

    return () => {
      window.removeEventListener('locatrust:messages_updated', handleUpdate);
      window.removeEventListener('locatrust:messages-updated', handleUpdate);
      window.removeEventListener('locatrust:support_tickets_updated', handleUpdate);
    };
  }, []);

  // 3. Déduire la liste consolidée des clients à partir des messages et des tickets support
  const clientsList = useMemo<AdminChatClient[]>(() => {
    const clientsMap = new Map<string, AdminChatClient>();
    const adminTargetIds = new Set(['usr_support', 'admin_user', 'admin']);
    try {
      const lastAuthId = localStorage.getItem('locatrust_last_auth_user_id');
      if (lastAuthId) adminTargetIds.add(lastAuthId);
    } catch {}

    // A. Analyser tous les messages pour identifier les clients ayant échangé avec le support
    messages.forEach(m => {
      if (!m || !m.sender_id || !m.receiver_id) return;
      const otherId = adminTargetIds.has(m.sender_id) ? m.receiver_id : m.sender_id;
      if (!otherId || adminTargetIds.has(otherId)) return;

      const profile = profilesMap[otherId];
      const clientUnread = getAdminUnreadCountForClient(otherId);

      const existing = clientsMap.get(otherId);
      const msgDate = m.created_at ? new Date(m.created_at).getTime() : 0;
      const existingDate = existing?.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;

      if (!existing || msgDate >= existingDate) {
        clientsMap.set(otherId, {
          id: otherId,
          name: profile?.full_name || (m as any).sender_name || (existing?.name) || (otherId.includes('owner') ? 'Propriétaire Bailleur' : otherId.includes('agency') ? 'Agence Partenaire' : 'Locataire Demandeur'),
          phone: profile?.phone || (existing?.phone) || '+225 07 00 00 00 00',
          email: profile?.email || (existing?.email) || `${otherId.slice(0, 8)}@locatrust.ci`,
          role: profile?.account_type || (otherId.includes('owner') ? 'proprietaire' : otherId.includes('agency') ? 'agence' : 'locataire'),
          lastMessage: m.text || (m.quittance ? 'Quittance émise' : m.contract ? 'Contrat de bail' : 'Message direct'),
          lastMessageAt: m.created_at || new Date().toISOString(),
          unreadCount: clientUnread,
          status: clientUnread > 0 ? 'en_attente' : (existing?.status || 'resolu')
        });
      }
    });

    // B. Analyser les tickets d'assistance créés dans locatrust_support_tickets
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_support_tickets');
        if (raw) {
          const tickets = JSON.parse(raw);
          if (Array.isArray(tickets)) {
            tickets.forEach((t: any) => {
              const senderId = t.sender_id || t.user_id;
              if (!senderId || adminTargetIds.has(senderId)) return;
              const profile = profilesMap[senderId];
              const clientUnread = getAdminUnreadCountForClient(senderId);

              if (!clientsMap.has(senderId)) {
                clientsMap.set(senderId, {
                  id: senderId,
                  name: t.sender_name || profile?.full_name || 'Utilisateur LocaTrust',
                  phone: t.sender_phone || profile?.phone || '+225 07 00 00 00 00',
                  email: t.sender_email || profile?.email || `${senderId}@locatrust.ci`,
                  role: t.sender_role || profile?.account_type || 'locataire',
                  lastMessage: t.message || t.subject || 'Demande d\'assistance',
                  lastMessageAt: t.created_at || new Date().toISOString(),
                  unreadCount: clientUnread,
                  status: (t.status === 'resolu' && clientUnread === 0) ? 'resolu' : 'en_attente'
                });
              }
            });
          }
        }
      } catch {}
    }

    // Trier : les clients avec messages non lus en priorité, puis par date décroissante
    return Array.from(clientsMap.values()).sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [messages, profilesMap]);

  // 4. Filtrage de la liste des clients selon la recherche et le statut
  const filteredClients = useMemo(() => {
    return clientsList.filter(c => {
      if (filter === 'unread' && c.unreadCount === 0) return false;
      if (filter === 'pending' && c.status !== 'en_attente') return false;
      if (filter === 'resolved' && c.status !== 'resolu') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [clientsList, filter, searchQuery]);

  // Client actuellement sélectionné
  const activeClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clientsList.find(c => c.id === selectedClientId) || null;
  }, [clientsList, selectedClientId]);

  // Messages de la conversation avec le client sélectionné
  const conversationMessages = useMemo(() => {
    if (!selectedClientId) return [];
    const adminTargetIds = new Set(['usr_support', 'admin_user', 'admin']);
    try {
      const lastAuthId = localStorage.getItem('locatrust_last_auth_user_id');
      if (lastAuthId) adminTargetIds.add(lastAuthId);
    } catch {}

    return messages.filter(
      m =>
        (m.sender_id === selectedClientId && adminTargetIds.has(m.receiver_id)) ||
        (adminTargetIds.has(m.sender_id) && m.receiver_id === selectedClientId)
    );
  }, [messages, selectedClientId]);

  // Auto-scroll vers le bas dès qu'un message arrive ou que la discussion change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages.length, selectedClientId]);

  // 5. Sélection d'un client : TOUS les messages du client sont immédiatement considérés comme vus et lus
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setMobileView('chat');
    // Marquer immédiatement tous les messages de cette conversation comme vus et lus
    markAdminClientMessagesAsRead(clientId);
    reloadMessages();
  };

  // 6. Envoi de réponse officielle administrateur
  const handleSendReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedClientId || !replyText.trim() || isSending) return;

    setIsSending(true);
    const textToSend = replyText.trim();
    setReplyText('');

    try {
      sendChatMessage('usr_support', selectedClientId, textToSend);

      // Mettre à jour le ticket support correspondant si présent
      try {
        const raw = localStorage.getItem('locatrust_support_tickets');
        if (raw) {
          const tickets = JSON.parse(raw);
          if (Array.isArray(tickets)) {
            const updated = tickets.map((t: any) =>
              (t.sender_id === selectedClientId || t.user_id === selectedClientId)
                ? { ...t, status: 'resolu', admin_reply: textToSend }
                : t
            );
            localStorage.setItem('locatrust_support_tickets', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('locatrust:support_tickets_updated'));
          }
        }
      } catch {}

      reloadMessages();
    } catch (err) {
      console.warn('Erreur envoi réponse admin:', err);
    } finally {
      setIsSending(false);
    }
  };

  // 7. Marquer la conversation comme résolue manuellement
  const handleMarkResolved = () => {
    if (!selectedClientId) return;
    try {
      const raw = localStorage.getItem('locatrust_support_tickets');
      if (raw) {
        const tickets = JSON.parse(raw);
        if (Array.isArray(tickets)) {
          const updated = tickets.map((t: any) =>
            (t.sender_id === selectedClientId || t.user_id === selectedClientId)
              ? { ...t, status: 'resolu' }
              : t
          );
          localStorage.setItem('locatrust_support_tickets', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('locatrust:support_tickets_updated'));
        }
      }
    } catch {}
    markAdminClientMessagesAsRead(selectedClientId);
    reloadMessages();
  };

  const quickReplyChips = [
    "Bonjour, votre demande a bien été examinée et validée par l'administration LocaTrust.",
    "Conformément à l'Art. 414 de la Loi 2019-576, le dépôt de garantie est strictement plafonné à 2 mois.",
    "Conformément à l'Art. 428 de la Loi 2019-576, les grosses réparations (toiture, clos et couvert) incombent au bailleur.",
    "Votre quittance certifiée avec QR Code officiel est disponible au téléchargement dans votre espace.",
    "Votre identité CNI a été certifiée conforme par nos services administratifs."
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[780px] font-sans">
      
      {/* HEADER DE LA CONSOLE CHAT */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>Chat en Direct — Assistance & Support LocaTrust</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                En ligne 24/7
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Échangez en direct avec les locataires, bailleurs et agences. Suivi temps réel des dossiers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={reloadMessages}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
          title="Actualiser les messages"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* CORPS PRINCIPAL : 2 COLONNES (LISTE CLIENTS GAUCHE + DISCUSSION ACTIVE DROITE) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* COLONNE GAUCHE : LISTE DES CLIENTS */}
        <div className={`w-full lg:w-[380px] shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/40 ${
          mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Recherche & Filtres */}
          <div className="p-3.5 border-b border-slate-200/80 flex flex-col gap-2.5 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un client, téléphone..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-slate-100 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Tous ({clientsList.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filter === 'unread' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Non vus ({clientsList.filter(c => c.unreadCount > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                En attente
              </button>
              <button
                type="button"
                onClick={() => setFilter('resolved')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filter === 'resolved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Résolus
              </button>
            </div>
          </div>

          {/* Liste déroulante des conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredClients.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                <LifeBuoy className="w-8 h-8 opacity-40" />
                <p className="text-xs font-bold">Aucune conversation trouvée</p>
                <span className="text-[11px] text-slate-400">Les nouveaux messages clients apparaîtront ici.</span>
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedClientId === client.id;
                const roleBadgeClass =
                  client.role === 'proprietaire'
                    ? 'bg-blue-100 text-blue-800'
                    : client.role === 'agence'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800';

                return (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client.id)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:bg-slate-100/80 ${
                      isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'bg-white'
                    }`}
                  >
                    {/* Avatar avec initiales */}
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm ${roleBadgeClass}`}>
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    {/* Infos Client */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-extrabold text-slate-900 text-xs truncate">
                          {client.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {client.lastMessageAt ? new Date(client.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${roleBadgeClass}`}>
                          {client.role === 'proprietaire' ? 'Bailleur' : client.role === 'agence' ? 'Agence' : 'Locataire'}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">{client.phone}</span>
                      </div>

                      <p className="text-[11px] text-slate-600 truncate leading-snug">
                        {client.lastMessage}
                      </p>
                    </div>

                    {/* COMPTEUR INDIVIDUEL DU CLIENT (Affiché seulement si > 0, disparaît une fois la conversation ouverte) */}
                    {client.unreadCount > 0 && (
                      <div className="shrink-0 flex items-center justify-center">
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                          {client.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLONNE DROITE : DISCUSSION EN DIRECT */}
        <div className={`flex-1 flex flex-col bg-white ${
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        }`}>
          {activeClient ? (
            <>
              {/* En-tête de la discussion active */}
              <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  {/* Bouton retour mobile */}
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 lg:hidden"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-sm">
                    {activeClient.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-sm">{activeClient.name}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                        {activeClient.role === 'proprietaire' ? 'Propriétaire' : activeClient.role === 'agence' ? 'Agence' : 'Locataire'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{activeClient.phone}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{activeClient.email}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkResolved}
                    className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Clôturer / Résolu</span>
                  </button>
                </div>
              </div>

              {/* Fil de la discussion (Messages en direct) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3 bg-slate-50/30">
                {conversationMessages.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400 my-auto">
                    <MessageSquare className="w-10 h-10 opacity-30" />
                    <p className="text-xs font-bold text-slate-600">Début de la conversation avec {activeClient.name}</p>
                    <span className="text-[11px] text-slate-400">Écrivez une réponse ci-dessous pour démarrer l'assistance.</span>
                  </div>
                ) : (
                  conversationMessages.map((msg) => {
                    const isAdmin = msg.sender_id === 'usr_support' || msg.sender_id === 'admin_user';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                          isAdmin
                            ? 'self-end bg-indigo-600 text-white rounded-br-none'
                            : 'self-start bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] font-black ${isAdmin ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {isAdmin ? 'Support Officiel LocaTrust' : activeClient.name}
                          </span>
                          <span className={`text-[9px] ${isAdmin ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                        <div className="flex items-center justify-end gap-1 mt-1">
                          {isAdmin && (
                            <span className="text-[9px] text-indigo-200 flex items-center gap-0.5">
                              <span>Envoyé</span>
                              <CheckCheck className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Puces de réponses types juridiques rapides */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] font-black uppercase text-indigo-700 shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Réponses rapides :</span>
                </span>
                {quickReplyChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyText(chip)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors"
                  >
                    {chip.slice(0, 42)}...
                  </button>
                ))}
              </div>

              {/* Formulaire d'envoi du message */}
              <form onSubmit={handleSendReply} className="p-3 sm:p-4 border-t border-slate-200 flex items-center gap-2 bg-white">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Répondre à ${activeClient.name} (ex: information juridique, validation, etc.)...`}
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all active:scale-95 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSending ? 'Envoi...' : 'Envoyer'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-800">
                Sélectionnez une discussion client
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Cliquez sur une conversation dans la liste de gauche pour lire les échanges, répondre en direct et certifier les demandes.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

