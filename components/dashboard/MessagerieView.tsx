import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Paperclip,
  Search,
  CheckCheck,
  Check,
  Phone,
  Video,
  FileText,
  Download,
  Eye,
  Receipt,
  Building2,
  ShieldCheck,
  X,
  MoreVertical,
  Mic,
  Smile,
  ChevronLeft,
  AlertTriangle,
  PenTool,
  CheckCircle2,
  FileSignature,
  PhoneOff,
  MicOff,
  Volume2,
  Square,
  Play,
  Pause,
  Trash2,
  Camera,
  CameraOff,
  RotateCcw,
  FlipHorizontal,
  Maximize2,
  Minimize2,
  Radio,
  Sparkles,
  RefreshCw,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatFCFA } from '@/lib/utils';
import { UserAvatar } from '@/components/common/UserAvatar';
import { SignatureModal } from '@/components/common/SignatureModal';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import {
  ChatMessage,
  ChatContact,
  ChatQuittanceAttachment,
  ChatContractAttachment,
  ChatRestitutionAttachment,
  CHAT_CONTACTS,
  OWNER_CHAT_CONTACTS,
  TENANT_CHAT_CONTACTS,
  AGENCY_CHAT_CONTACTS,
  getStoredMessages,
  saveStoredMessages,
  sendChatMessage,
  markMessagesAsRead,
  markAllMessagesAsReadForUser,
  getUnreadMessagesCountForUser,
  downloadQuittancePdfFromAttachment,
  sendRealChatMessage,
  fetchSupabaseMessages,
  fetchSupabaseConversationsWithProfiles,
  isValidUuid,
  updateDeclarationMessageStatus
} from '@/lib/messagingStore';
import { confirmCautionReceipt, sendCautionReceiptToTenant, signCautionReceipt, getStoredDeposits } from '@/lib/cautionsStore';
import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { generateRestitutionReceiptPDF } from '@/lib/payments/restitutionReceiptPdfGenerator';
import { useAuth } from '@/src/context/AuthContext';
import {
  resolveContractParties,
  persistOwnerSignature,
  persistTenantSignature
} from '@/lib/contractPartyResolver';
import { getDefaultRealisticAvatar } from '@/lib/avatarHelper';

interface MessagerieViewProps {
  userRole?: 'proprietaire' | 'locataire' | 'agence';
}

export const MessagerieView: React.FC<MessagerieViewProps> = ({ userRole = 'proprietaire' }) => {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || '';

  const myAliases = React.useMemo(() => {
    const s = new Set<string>();
    if (user?.id) s.add(user.id);
    if (user?.email) s.add(user.email.toLowerCase());
    if (profile?.id) s.add(profile.id);
    if (currentUserId) s.add(currentUserId);
    return s;
  }, [user?.id, user?.email, profile?.id, currentUserId]);

  const [dbContacts, setDbContacts] = useState<ChatContact[]>([]);

  const roleContacts = React.useMemo(() => {
    const list: ChatContact[] = [];

    // Intégrer les contacts réels chargés directement depuis Supabase
    if (dbContacts && dbContacts.length > 0) {
      dbContacts.forEach((dc) => {
        if (!list.some((existing) => existing.id === dc.id)) {
          list.push(dc);
        }
      });
    }

    if (typeof window !== 'undefined') {
      try {
        const appsRaw = localStorage.getItem('locatrust_rental_applications');
        let apps: any[] = [];
        if (appsRaw) {
          try { apps = JSON.parse(appsRaw); } catch {}
        }
        if (Array.isArray(apps)) {
          apps.forEach((app: any) => {
            // Ignorer strictement les démos fictives
            if (
              !app ||
              app.id === 'app_demo_1' ||
              app.id === 'app_demo_2' ||
              app.tenant_name === 'Kouassi Jean-Philippe' ||
              app.tenant_name === 'Awa Touré'
            ) {
              return;
            }

            if (userRole === 'locataire') {
              // Vérifier si cette candidature concerne le locataire connecté
              const isMyApplication =
                !user?.id ||
                myAliases.has(app.tenant_id) ||
                app.tenant_id === 'usr_tenant' ||
                (user?.email && app.tenant_email?.toLowerCase() === user.email.toLowerCase());

              if (!isMyApplication) return;

              const ownerName = app.agency_name || app.owner_name || (app.owner as any)?.full_name || 'Bailleur Propriétaire';
              const ownerId = app.agency_id || app.owner_id || `owner_${app.property_id || app.id}`;
              const ownerRole = app.agency_name || app.is_agency || (app.owner as any)?.account_type === 'agence' ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur';
              const isAgencyRole = Boolean(app.agency_name || app.is_agency || (app.owner as any)?.account_type === 'agence' || ownerId.includes('agency'));
              let ownerAvatar =
                (app.owner_avatar && !app.owner_avatar.includes('ui-avatars.com') ? app.owner_avatar : null) ||
                ((app.owner as any)?.avatar_url && !(app.owner as any).avatar_url.includes('ui-avatars.com') ? (app.owner as any).avatar_url : null) ||
                (typeof window !== 'undefined' ? localStorage.getItem(`locatrust_user_avatar_${ownerId}`) : null) ||
                (typeof window !== 'undefined' && isAgencyRole ? localStorage.getItem('locatrust_agency_avatar') || localStorage.getItem('locatrust_user_avatar_usr_agency') : null) ||
                (typeof window !== 'undefined' && !isAgencyRole ? localStorage.getItem('locatrust_owner_avatar') || localStorage.getItem('locatrust_user_avatar_usr_owner') : null) ||
                getDefaultRealisticAvatar(ownerName, ownerRole);

              if (!list.some((c) => c.id === ownerId || c.name.toLowerCase() === ownerName.toLowerCase())) {
                list.push({
                  id: ownerId,
                  name: ownerName,
                  phone: app.owner_phone || '+225 07 00 00 00 00',
                  role: ownerRole,
                  propertyTitle: app.property_title || 'Logement',
                  avatar: ownerAvatar,
                  online: true
                });
              }
            } else {
              // Propriétaire ou Agence : uniquement les candidatures de ses propres biens
              const isMyPropertyApplication =
                !user?.id ||
                myAliases.has(app.owner_id) ||
                myAliases.has(app.agency_id) ||
                app.owner_id === 'usr_owner' ||
                app.agency_id === 'usr_agency';

              if (!isMyPropertyApplication) return;

              const tenantId = app.tenant_id || `tenant_${app.id}`;
              const tenantName = (app.tenant_name || '').trim();

              // Ne jamais créer de contact générique fictif "Candidat Locataire"
              if (
                !tenantName ||
                tenantName.toLowerCase().includes('candidat') ||
                tenantName.toLowerCase() === 'locataire candidat' ||
                tenantName.toLowerCase() === 'candidat locataire'
              ) {
                return;
              }

              const tenantAvatar =
                (app.tenant_avatar && !app.tenant_avatar.includes('ui-avatars.com') ? app.tenant_avatar : null) ||
                (typeof window !== 'undefined' ? localStorage.getItem(`locatrust_user_avatar_${tenantId}`) : null) ||
                getDefaultRealisticAvatar(tenantName, 'locataire');

              if (!list.some((c) => c.id === tenantId || c.name.toLowerCase() === tenantName.toLowerCase())) {
                list.push({
                  id: tenantId,
                  name: tenantName,
                  phone: app.tenant_phone || '+225 05 00 00 00 00',
                  role: 'Locataire',
                  propertyTitle: app.property_title || 'Bien immobilier',
                  avatar: tenantAvatar,
                  online: true
                });
              }
            }
          });
        }

        // Intégration dynamique depuis l'historique des messages réels
        const storedMsgs = getStoredMessages();
        storedMsgs.forEach((m) => {
          // L'utilisateur connecté doit obligatoirement être impliqué (expéditeur ou destinataire)
          const involvesMe = myAliases.has(m.sender_id) || myAliases.has(m.receiver_id);
          if (!involvesMe) return;

          const otherId = myAliases.has(m.sender_id) ? m.receiver_id : m.sender_id;

          if (
            otherId &&
            !myAliases.has(otherId) &&
            otherId !== 'usr_owner_1' &&
            otherId !== 'usr_tenant_1' &&
            otherId !== 'usr_candidate' &&
            !otherId.startsWith('candidate_')
          ) {
            const matchingApp = apps.find(
              (a: any) => a.tenant_id === otherId || a.owner_id === otherId || `tenant_${a.id}` === otherId
            );

            let contactName = matchingApp
              ? (userRole === 'locataire' ? matchingApp.owner_name : matchingApp.tenant_name)
              : undefined;

            let contractObj = m.contract;
            let quittanceObj = m.quittance;
            if ((!contractObj || !quittanceObj) && typeof m.text === 'string' && (m.text.includes('"contract"') || m.text.includes('"quittance"') || m.text.includes('"ownerName"'))) {
              try {
                let p = JSON.parse(m.text.trim());
                if (Array.isArray(p)) p = p[0];
                if (p?.contract) contractObj = p.contract;
                if (p?.quittance) quittanceObj = p.quittance;
              } catch {}
            }

            if (!contactName && contractObj) {
              contactName = userRole === 'locataire' ? contractObj.ownerName : contractObj.tenantName;
            }

            if (!contactName && quittanceObj) {
              contactName = userRole === 'locataire' ? quittanceObj.ownerName : quittanceObj.tenantName;
            }

            if (!contactName) {
              const savedContactRaw = localStorage.getItem(`locatrust_contact_${otherId}`);
              if (savedContactRaw) {
                try { contactName = JSON.parse(savedContactRaw).name; } catch {}
              }
            }

            // Ne jamais inventer de nom générique fictif "Locataire Candidat"
            if (
              !contactName ||
              contactName.toLowerCase().includes('candidat') ||
              contactName.toLowerCase() === 'locataire candidat' ||
              contactName.toLowerCase() === 'candidat locataire'
            ) {
              return;
            }

            // Ne pas recréer de doublon si ce nom existe déjà dans la liste
            if (list.some((c) => c.name.toLowerCase() === contactName!.toLowerCase())) {
              return;
            }

            // S'il s'agit d'un identifiant générique (usr_owner / usr_agency) ou sans nom précis,
            // et qu'on a déjà un contact bailleur/agence réel dans la liste, ne surtout pas créer de doublon
            const hasExistingNamedParty = list.some(
              (c) => c.id !== 'usr_support' && c.name.toLowerCase() !== 'bailleur propriétaire'
            );

            if (
              (otherId === 'usr_owner' || otherId === 'usr_agency' || contactName.toLowerCase() === 'bailleur propriétaire') &&
              hasExistingNamedParty
            ) {
              return;
            }

            const isAgencyRole = contactName.toLowerCase().includes('agence') || otherId.includes('agency');
            const contactRole = userRole === 'locataire' ? (isAgencyRole ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur') : 'Locataire';
            let contactAvatar =
              (matchingApp?.tenant_avatar && !matchingApp.tenant_avatar.includes('ui-avatars.com') ? matchingApp.tenant_avatar : null) ||
              (matchingApp?.owner_avatar && !matchingApp.owner_avatar.includes('ui-avatars.com') ? matchingApp.owner_avatar : null) ||
              (typeof window !== 'undefined' ? localStorage.getItem(`locatrust_user_avatar_${otherId}`) : null) ||
              (typeof window !== 'undefined' && isAgencyRole ? localStorage.getItem('locatrust_agency_avatar') || localStorage.getItem('locatrust_user_avatar_usr_agency') : null) ||
              (typeof window !== 'undefined' && !isAgencyRole && otherId.includes('owner') ? localStorage.getItem('locatrust_owner_avatar') || localStorage.getItem('locatrust_user_avatar_usr_owner') : null) ||
              (typeof window !== 'undefined' && otherId.includes('tenant') ? localStorage.getItem('locatrust_tenant_avatar') || localStorage.getItem('locatrust_user_avatar_usr_tenant') : null) ||
              getDefaultRealisticAvatar(contactName, contactRole);

            if (!list.some((c) => c.id === otherId || c.name.toLowerCase() === contactName!.toLowerCase())) {
              list.push({
                id: otherId,
                name: contactName,
                phone: matchingApp?.tenant_phone || matchingApp?.owner_phone || '+225 07 00 00 00 00',
                role: contactRole,
                propertyTitle: matchingApp?.property_title || contractObj?.propertyTitle || 'Échange direct',
                avatar: contactAvatar,
                online: true
              });
            }
          }
        });

        // Nettoyer automatiquement les contacts génériques en doublon stockés localement
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('locatrust_contact_usr_owner');
            localStorage.removeItem('locatrust_contact_usr_agency');
          } catch {}
        }

        // Charger tout contact directement sauvegardé suite à un message ou une candidature
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('locatrust_contact_')) {
            try {
              const rawContact = localStorage.getItem(key);
              if (rawContact) {
                const c = JSON.parse(rawContact);
                if (!c || typeof c !== 'object') continue;
                const isGenericOwner = c.name === 'Bailleur Propriétaire' || c.id === 'usr_owner' || c.id === 'usr_agency';
                const hasRealOwner = list.some((existing) => existing && existing.id !== 'usr_support' && (existing.name || '').toLowerCase() !== 'bailleur propriétaire');
                if (isGenericOwner && hasRealOwner) continue;

                if (c && c.id && !myAliases.has(c.id) && !list.some((existing) => existing && (existing.id === c.id || (existing.name || '').toLowerCase() === (c.name || '').toLowerCase()))) {
                  const safeAvatar =
                    c.avatar && !c.avatar.includes('ui-avatars.com')
                      ? c.avatar
                      : getDefaultRealisticAvatar(c.name || 'Contact', c.role);
                  list.push({
                    ...c,
                    name: c.name || 'Contact',
                    avatar: safeAvatar
                  });
                }
              }
            } catch {}
          }
        }
      } catch (e) {}
    }

    // Déduplication finale et garantie d'avatar réaliste
    const uniqueContacts: ChatContact[] = [];
    const seenNames = new Set<string>();
    const hasNamedOwner = list.some(
      (c) => c && c.id !== 'usr_support' && (c.name || '').toLowerCase() !== 'bailleur propriétaire' && (c.name || '').toLowerCase() !== 'locataire candidat'
    );

    const myStoredAvatar = typeof window !== 'undefined' ? localStorage.getItem('locatrust_user_avatar') : null;

    for (const c of list) {
      if (!c || !c.id) continue;
      const lower = (c.name || '').trim().toLowerCase();

      // Ignorer tout contact candidat fictif
      if (
        lower === 'locataire candidat' ||
        lower === 'candidat locataire' ||
        lower.includes('candidat') ||
        c.id === 'usr_candidate' ||
        c.id.startsWith('candidate_')
      ) {
        continue;
      }

      // Supprimer le doublon générique "Bailleur Propriétaire" s'il existe déjà un vrai contact propriétaire/agence
      if (hasNamedOwner && (lower === 'bailleur propriétaire' || c.id === 'usr_owner' || c.id === 'usr_agency')) {
        continue;
      }

      if (seenNames.has(lower)) continue;
      seenNames.add(lower);

      const isMe = c.id === currentUserId || myAliases.has(c.id);
      let finalAvatar = c.avatar;

      // Si ce n'est pas moi et que l'avatar est identique à mon propre avatar, le réinitialiser
      if (!isMe && myStoredAvatar && finalAvatar === myStoredAvatar) {
        finalAvatar = null;
      }

      if (!finalAvatar || finalAvatar.includes('ui-avatars.com') || finalAvatar.trim().length <= 5) {
        finalAvatar =
          (typeof window !== 'undefined' ? localStorage.getItem(`locatrust_user_avatar_${c.id}`) : null) ||
          getDefaultRealisticAvatar(c.name, c.role);
      }

      if (!isMe && myStoredAvatar && finalAvatar === myStoredAvatar) {
        finalAvatar = getDefaultRealisticAvatar(c.name, c.role);
      }

      uniqueContacts.push({
        ...c,
        avatar: finalAvatar
      });
    }

    return uniqueContacts;
  }, [userRole, currentUserId, user?.id, user?.email, dbContacts]);

  const [selectedContactId, setSelectedContactId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const active = localStorage.getItem('locatrust_active_chat_contact');
      if (active) return active;
    }
    return roleContacts[0]?.id || '';
  });
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingQuittance, setPreviewingQuittance] = useState<ChatQuittanceAttachment | null>(null);
  const [previewingContract, setPreviewingContract] = useState<ChatContractAttachment | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('locatrust_active_chat_contact'));
    }
    return false;
  });

  // Écouter l'événement d'ouverture immédiate d'un chat (desktop et mobile)
  useEffect(() => {
    const handleOpenChat = (e: any) => {
      const contactId = e.detail?.contactId;
      if (contactId) {
        setSelectedContactId(contactId);
        setShowMobileChat(true);
      }
    };
    window.addEventListener('locatrust:open_chat', handleOpenChat);
    return () => window.removeEventListener('locatrust:open_chat', handleOpenChat);
  }, []);

  // Sync selectedContactId if role contacts change
  useEffect(() => {
    if (!roleContacts.some((c) => c.id === selectedContactId)) {
      if (typeof window !== 'undefined') {
        const active = localStorage.getItem('locatrust_active_chat_contact');
        if (active && roleContacts.some((c) => c.id === active)) {
          setSelectedContactId(active);
          return;
        }
      }
      setSelectedContactId(roleContacts[0]?.id || 'usr_support');
    }
  }, [roleContacts, selectedContactId]);

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [signingTarget, setSigningTarget] = useState<{
    type: 'contract' | 'quittance';
    contract?: ChatContractAttachment;
    quittance?: ChatQuittanceAttachment;
    role: 'proprietaire' | 'locataire';
  } | null>(null);

  // Calls States (Point 6 & Appels Réels Vidéo/Audio)
  const [activeAudioCall, setActiveAudioCall] = useState<{ seconds: number; isMuted: boolean; isSpeaker: boolean } | null>(null);
  const [activeVideoCall, setActiveVideoCall] = useState<{ seconds: number; isMuted: boolean; isCamOff: boolean; isFrontCam: boolean } | null>(null);
  const [isVideoSwapped, setIsVideoSwapped] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const activeAudioCallRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File Upload Refs (Point 6)
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Voice Note Recorder States (Point 6)
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [micPermissionModal, setMicPermissionModal] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const [showScrollDownBtn, setShowScrollDownBtn] = useState<boolean>(false);
  const prevContactIdRef = useRef<string>(selectedContactId);
  const prevMessagesCountRef = useRef<number>(0);

  // Load stored messages
  const refreshMessages = () => {
    const list = getStoredMessages();
    const cleanList = Array.isArray(list) ? list : [];
    setMessages([...cleanList]);
  };

  const handleChatScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    // L'utilisateur est en bas s'il est à moins de 80px du bas
    const isBottom = scrollHeight - scrollTop - clientHeight < 80;
    isAtBottomRef.current = isBottom;
    setShowScrollDownBtn(!isBottom);
  };

  const scrollToBottom = (smooth = true) => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      isAtBottomRef.current = true;
      setShowScrollDownBtn(false);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    refreshMessages();

    // Charger les messages et conversations réels depuis Supabase dès l'ouverture
    if (currentUserId) {
      fetchSupabaseMessages(currentUserId).then((newMsgs) => {
        if (newMsgs && newMsgs.length > 0) {
          refreshMessages();
        }
      }).catch(() => {});

      fetchSupabaseConversationsWithProfiles(currentUserId).then((realContacts) => {
        if (realContacts && realContacts.length > 0) {
          setDbContacts(realContacts);
        }
      }).catch(() => {});
    }

    const handleMessagesUpdated = (e?: any) => {
      const incoming = e?.detail?.data;
      if (incoming && incoming.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      }
      refreshMessages();
      if (currentUserId) {
        fetchSupabaseMessages(currentUserId).then(() => refreshMessages()).catch(() => {});
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'locatrust_chat_messages_v4' ||
        e.key === 'locatrust_tenant_receipts_v2' ||
        e.key === 'locatrust_rental_applications' ||
        e.key === 'locatrust_contracts'
      ) {
        refreshMessages();
      }
    };

    window.addEventListener('locatrust:messages_updated', handleMessagesUpdated);
    window.addEventListener('locatrust:messages-updated', handleMessagesUpdated);
    window.addEventListener('locatrust:receipts_updated', handleMessagesUpdated);
    window.addEventListener('storage', handleStorage);

    // Souscription Realtime Supabase aux nouveaux messages instantanés
    const realtimeChatChannel = supabase
      .channel(`realtime_chat_${currentUserId || 'global'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          if (currentUserId) {
            fetchSupabaseMessages(currentUserId).then((updated) => {
              if (updated && updated.length > 0) refreshMessages();
            }).catch(() => {});
          }
        }
      )
      .subscribe();

    // Polling doux de synchronisation automatique sans perturber le scroll
    const heartbeat = setInterval(() => {
      refreshMessages();
      if (currentUserId) {
        fetchSupabaseMessages(currentUserId).then(() => refreshMessages()).catch(() => {});
      }
    }, 4000);

    return () => {
      window.removeEventListener('locatrust:messages_updated', handleMessagesUpdated);
      window.removeEventListener('locatrust:messages-updated', handleMessagesUpdated);
      window.removeEventListener('locatrust:receipts_updated', handleMessagesUpdated);
      window.removeEventListener('storage', handleStorage);
      clearInterval(heartbeat);
      realtimeChatChannel.unsubscribe();
    };
  }, [currentUserId]);

  // Défilement intelligent vers le bas : ne force JAMAIS le scroll si l'utilisateur est remonté pour lire
  useEffect(() => {
    const contactChanged = prevContactIdRef.current !== selectedContactId;
    prevContactIdRef.current = selectedContactId;

    const newMsgArrived = messages.length > prevMessagesCountRef.current;
    prevMessagesCountRef.current = messages.length;

    if (contactChanged) {
      isAtBottomRef.current = true;
      setTimeout(() => scrollToBottom(false), 50);
    } else if (isAtBottomRef.current || isTyping) {
      scrollToBottom(true);
    }
  }, [messages.length, selectedContactId, isTyping]);

  const activeContact = roleContacts.find((c) => c.id === selectedContactId) || roleContacts[0] || null;

  // Marquer immédiatement les messages du contact actif comme lus
  useEffect(() => {
    if (activeContact?.id && currentUserId) {
      markMessagesAsRead(activeContact.id, currentUserId);
    }
  }, [activeContact?.id, currentUserId, messages.length]);

  // Filter messages between current user and active contact with intelligent deduplication
  const currentConversationMessages = React.useMemo(() => {
    if (!activeContact?.id) return [];

    const contactAliases = new Set([
      activeContact.id,
      activeContact.name,
      activeContact.name?.toLowerCase(),
      `tenant_${activeContact.id}`,
      `owner_${activeContact.id}`
    ]);

    const raw = (Array.isArray(messages) ? messages : []).filter(
      (m) => {
        if (!activeContact?.id) return false;

        let msgContract = m.contract;
        let msgQuittance = m.quittance;
        if ((!msgContract || !msgQuittance) && typeof m.text === 'string' && (m.text.includes('"contract"') || m.text.includes('"quittance"') || m.text.includes('"ownerName"'))) {
          try {
            let p = JSON.parse(m.text.trim());
            if (Array.isArray(p)) p = p[0];
            if (p?.contract) msgContract = p.contract;
            if (p?.quittance) msgQuittance = p.quittance;
          } catch {}
        }

        const matchesContractParty =
          msgContract &&
          ((msgContract.ownerName && msgContract.ownerName.toLowerCase() === activeContact.name.toLowerCase()) ||
           (msgContract.propertyTitle && activeContact.propertyTitle && msgContract.propertyTitle === activeContact.propertyTitle));

        const matchesQuittanceParty =
          msgQuittance &&
          ((msgQuittance.ownerName && activeContact.name && msgQuittance.ownerName.toLowerCase().includes(activeContact.name.toLowerCase())) ||
           (msgQuittance.tenantName && activeContact.name && msgQuittance.tenantName.toLowerCase().includes(activeContact.name.toLowerCase())) ||
           (msgQuittance.propertyTitle && activeContact.propertyTitle && msgQuittance.propertyTitle === activeContact.propertyTitle));

        const sentByMeToContact =
          myAliases.has(m.sender_id) &&
          (contactAliases.has(m.receiver_id) || m.receiver_id === activeContact.id || matchesContractParty || matchesQuittanceParty);

        const sentByContactToMe =
          (contactAliases.has(m.sender_id) || m.sender_id === activeContact.id || matchesContractParty || matchesQuittanceParty) &&
          myAliases.has(m.receiver_id);

        return sentByMeToContact || sentByContactToMe;
      }
    );

    // Déduplication absolue par ID et empreinte (expéditeur + texte + minute)
    const seenIds = new Set<string>();
    const seenFPs = new Set<string>();
    const clean: ChatMessage[] = [];

    for (const m of raw) {
      if (!m) continue;
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);

      const minKey = m.created_at ? m.created_at.slice(0, 16) : '';
      const textTrim = (m.text || '').trim();
      const fp = `${m.sender_id}::${textTrim}::${minKey}`;

      if (textTrim && seenFPs.has(fp)) {
        continue;
      }
      if (textTrim) {
        seenFPs.add(fp);
      }
      clean.push(m);
    }

    return clean;
  }, [messages, activeContact?.id, activeContact?.name, activeContact?.propertyTitle, myAliases]);

  // Filter contacts by search
  const filteredContacts = roleContacts.filter(
    (c) =>
      c &&
      (((c.name || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
       ((c.propertyTitle || '').toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const totalUnread = getUnreadMessagesCountForUser(
    user ? { id: user.id, email: user.email, role: user.role || userRole } : { role: userRole }
  );

  // Call Timer Hooks (Point 6)
  useEffect(() => {
    let interval: any = null;
    if (activeAudioCall) {
      interval = setInterval(() => {
        setActiveAudioCall((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [Boolean(activeAudioCall)]);

  useEffect(() => {
    let interval: any = null;
    if (activeVideoCall) {
      interval = setInterval(() => {
        setActiveVideoCall((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [Boolean(activeVideoCall)]);

  // Play friendly chime via Web Audio API
  const playCallChime = (type: 'ring' | 'connected' | 'hangup') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'connected') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'hangup') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  const volumeAnimFrameRef = useRef<number | null>(null);

  // Setup real audio volume listener from microphone
  const setupAudioVolumeAnalysis = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      audioAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
        volumeAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('Audio analysis setup error:', e);
    }
  };

  const cleanupAudioAnalysis = () => {
    if (volumeAnimFrameRef.current) {
      cancelAnimationFrame(volumeAnimFrameRef.current);
      volumeAnimFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    audioAnalyserRef.current = null;
    setAudioVolume(0);
  };

  // Audio Call Handlers (Appel Vocal Réel avec Microphone via GlobalCallModal)
  const handleStartAudioCall = async () => {
    if (!activeContact) return;
    let prefetchedAudio: MediaStream | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        prefetchedAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      console.warn('Pré-capture audio au clic utilisateur:', err);
    }
    if (prefetchedAudio) {
      (window as any).__locatrust_prefetched_stream = prefetchedAudio;
    }
    window.dispatchEvent(
      new CustomEvent('locatrust:initiate_call', {
        detail: {
          type: 'audio',
          peerId: activeContact.id,
          peerName: activeContact.name || 'Contact',
          peerAvatar: activeContact.avatar,
          peerRole: activeContact.role,
          propertyTitle: activeContact.propertyTitle,
          stream: prefetchedAudio
        }
      })
    );
  };

  const handleEndAudioCall = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    playCallChime('hangup');
    cleanupAudioAnalysis();

    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      audioStreamRef.current = null;
    }

    if (activeAudioCall && activeAudioCall.seconds > 0) {
      const mins = Math.floor(activeAudioCall.seconds / 60);
      const secs = activeAudioCall.seconds % 60;
      const durationStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
      const text = `📞 Appel vocal terminé (${durationStr})`;
      if (activeContact?.id) {
        sendRealChatMessage(currentUserId, activeContact.id, text).catch(() => {});
      }
      refreshMessages();
    }
    setActiveAudioCall(null);
    setShowMobileChat(true);
  };

  // Video Call Handler (Appel Vidéo Réel avec Caméra Physique & Micro via GlobalCallModal)
  const handleStartVideoCall = async () => {
    if (!activeContact) return;
    let prefetchedVideo: MediaStream | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        prefetchedVideo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
      }
    } catch (err) {
      console.warn('Pré-capture combinée vidéo+audio au clic:', err);
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          prefetchedVideo = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch (errVideo) {
        console.warn('Pré-capture vidéo seule échouée:', errVideo);
      }
    }

    if (prefetchedVideo) {
      (window as any).__locatrust_prefetched_stream = prefetchedVideo;
    }

    window.dispatchEvent(
      new CustomEvent('locatrust:initiate_call', {
        detail: {
          type: 'video',
          peerId: activeContact.id,
          peerName: activeContact.name || 'Contact',
          peerAvatar: activeContact.avatar,
          peerRole: activeContact.role,
          propertyTitle: activeContact.propertyTitle,
          stream: prefetchedVideo
        }
      })
    );
  };

  // File Handlers: Image & Document (Point 6)
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const allMsgs = getStoredMessages();
      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        sender_id: currentUserId,
        receiver_id: activeContact.id,
        text: '📷 Photo transmise',
        attachment: {
          type: 'image',
          url: dataUrl,
          name: file.name,
          size: `${Math.round(file.size / 1024)} Ko`
        },
        created_at: new Date().toISOString()
      };
      saveStoredMessages([...allMsgs, newMsg]);
      refreshMessages();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const allMsgs = getStoredMessages();
      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        sender_id: currentUserId,
        receiver_id: activeContact.id,
        text: `📄 Document : ${file.name}`,
        attachment: {
          type: 'document',
          url: dataUrl,
          name: file.name,
          size: `${Math.round(file.size / 1024)} Ko`
        },
        created_at: new Date().toISOString()
      };
      saveStoredMessages([...allMsgs, newMsg]);
      refreshMessages();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Voice Note Recording (Point 6)
  const handleStartVoiceRecording = async () => {
    setMicPermissionModal(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setMicPermissionModal("L'enregistrement vocal n'est pas pris en charge par ce navigateur.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setAudioPreviewUrl(reader.result as string);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      // Fallback convivial avec modal explicatif d'accès au micro
      setMicPermissionModal("Accès au microphone requis. Veuillez autoriser votre micro dans le navigateur pour enregistrer une note vocale réelle.");
    }
  };

  const handleStopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      clearInterval(recordingTimerRef.current);
      setIsRecordingAudio(false);
    }
  };

  const handleCancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
    }
    clearInterval(recordingTimerRef.current);
    setIsRecordingAudio(false);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
  };

  const handleSendVoiceRecording = async () => {
    let finalAudioUrl = audioPreviewUrl;
    const duration = Math.max(1, recordingSeconds || 2);

    // Si l'enregistrement est encore en cours, arrêter proprement et attendre la conversion DataURL
    if (isRecordingAudio && mediaRecorderRef.current) {
      await new Promise<void>((resolve) => {
        const rec = mediaRecorderRef.current;
        if (!rec) {
          resolve();
          return;
        }
        rec.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              finalAudioUrl = reader.result as string;
            }
            resolve();
          };
          reader.readAsDataURL(audioBlob);
        };
        try {
          rec.stop();
          rec.stream.getTracks().forEach((t) => t.stop());
        } catch {
          resolve();
        }
        clearInterval(recordingTimerRef.current);
        setIsRecordingAudio(false);
      });
    }

    if (!finalAudioUrl && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      finalAudioUrl = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
    }

    if (!finalAudioUrl) return;

    const allMsgs = getStoredMessages();
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: activeContact.id,
      text: '🎙️ Note vocale',
      attachment: {
        type: 'audio',
        url: finalAudioUrl,
        name: `Vocal_${duration}s`,
        duration
      },
      created_at: new Date().toISOString()
    };
    saveStoredMessages([...allMsgs, newMsg]);
    refreshMessages();

    // Réinitialiser les états
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const handleDownloadRestitutionPdf = async (rest: ChatRestitutionAttachment) => {
    await generateRestitutionReceiptPDF({
      receiptNumber: rest.receiptNumber,
      contractNumber: rest.contractNumber,
      propertyTitle: rest.propertyTitle,
      propertyAddress: rest.propertyAddress,
      ownerName: rest.ownerName,
      ownerPhone: '+225 07 48 92 11 00',
      tenantName: rest.tenantName,
      tenantPhone: '+225 07 08 09 10 11',
      initialCautionAmount: rest.initialCautionAmount,
      amountRestituted: rest.amountRestituted,
      deductionAmount: rest.deductionAmount,
      deductionReason: rest.deductionReason,
      restitutionDate: rest.restitutionDate,
      paymentMethod: rest.restitutionMethod,
      transactionReference: `TXN-${rest.receiptNumber}`
    });
  };

  // Handle Send Message (persistance réelle et temps réel)
  const handleSendMessage = () => {
    if (!inputMessage.trim() || !activeContact) return;

    const sentText = inputMessage.trim();
    sendChatMessage(currentUserId, activeContact.id, sentText, {
      propertyTitle: activeContact.propertyTitle
    });
    sendRealChatMessage(currentUserId, activeContact.id, sentText, {
      propertyTitle: activeContact.propertyTitle
    }).catch((err) => {
      console.warn('Real chat message sync notice:', err);
    });
    setInputMessage('');
    refreshMessages();
  };

  // Confirm Signature for either contract or receipt
  const handleConfirmSignature = async (signatureDataUrl: string) => {
    if (!signingTarget) return;

    const currentAll = getStoredMessages();

    if (signingTarget.type === 'contract' && signingTarget.contract) {
      const targetNum = signingTarget.contract.contractNumber;
      const isTenant = signingTarget.role === 'locataire';
      const updatedMessages = currentAll.map((msg) => {
        if (msg.contract && msg.contract.contractNumber === targetNum) {
          return {
            ...msg,
            contract: {
              ...msg.contract,
              tenantSigned: true,
              ownerSigned: true,
              tenantSignatureUrl: isTenant ? signatureDataUrl : (msg.contract.tenantSignatureUrl || signatureDataUrl),
              ownerSignatureUrl: !isTenant ? signatureDataUrl : (msg.contract.ownerSignatureUrl || signatureDataUrl)
            }
          };
        }
        return msg;
      });

      if (isTenant) {
        persistTenantSignature(signatureDataUrl);
      } else {
        persistOwnerSignature(signatureDataUrl);
      }

      saveStoredMessages(updatedMessages);

      // Envoi du message réel de confirmation dans la conversation
      sendRealChatMessage(
        currentUserId,
        activeContact.id,
        `✍️ Le locataire a signé et validé le bail N° ${targetNum} avec succès. Le document est désormais scellé et certifié conforme Loi n° 2019-576.`
      ).catch(() => {});

      // Persistance réelle dans la table Supabase 'contracts'
      try {
        const { error: cErr } = await supabase
          .from('contracts')
          .update({
            tenant_signed: true,
            tenant_signed_at: new Date().toISOString(),
            tenant_signature: signatureDataUrl,
            status: 'actif'
          })
          .eq('contract_number', targetNum);
        if (cErr) {
          console.warn('Erreur mise à jour Supabase contract:', cErr.message);
        }
      } catch (e) {
        console.warn('Erreur mise à jour Supabase contract:', e);
      }

      // Persistance réelle dans la table Supabase 'rental_applications'
      try {
        const { error: aErr } = await supabase
          .from('rental_applications')
          .update({
            tenant_signed: true,
            tenant_signed_at: new Date().toISOString(),
            contract_finalized: true,
            status: 'contrat_actif'
          })
          .eq('contract_number', targetNum);
        if (aErr) {
          console.warn('Erreur mise à jour Supabase rental_applications:', aErr.message);
        }
      } catch (e) {
        console.warn('Erreur mise à jour Supabase rental_applications:', e);
      }

      // Insertion d'une vraie notification Supabase pour le bailleur/agence
      try {
        if (activeContact.id && isValidUuid(activeContact.id)) {
          await supabase.from('notifications').insert({
            user_id: activeContact.id,
            title: 'Bail signé par le locataire !',
            content: `${signingTarget.contract.tenantName} a signé et validé le bail N° ${targetNum}. Le document est officiellement scellé.`,
            type: 'contract_signed',
            read: false
          });
        }
      } catch (e) {
        console.warn('Erreur insertion notification Supabase:', e);
      }

      // Diffusion Supabase Realtime multi-écrans (Desktop ↔ Mobile ↔ Tablette)
      broadcastLiveEvent('CONTRACT_SIGNED_BY_TENANT', {
        actorId: currentUserId,
        targetUserId: activeContact.id,
        data: {
          contractNumber: targetNum,
          tenantSignatureUrl: signatureDataUrl
        }
      }).catch(() => {});

      // Mettre à jour locatrust_rental_applications en local
      try {
        const appsRaw = localStorage.getItem('locatrust_rental_applications');
        if (appsRaw) {
          const appsList = JSON.parse(appsRaw);
          if (Array.isArray(appsList)) {
            const updatedApps = appsList.map((a: any) => {
              if (
                a.contract_number === targetNum ||
                a.property_title === signingTarget.contract?.propertyTitle
              ) {
                return {
                  ...a,
                  status: 'contrat_actif' as const,
                  contract_finalized: true,
                  tenant_signed: true,
                  tenant_signed_at: new Date().toISOString(),
                  tenant_signature_url: signatureDataUrl
                };
              }
              return a;
            });
            localStorage.setItem('locatrust_rental_applications', JSON.stringify(updatedApps));
            window.dispatchEvent(
              new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } })
            );
          }
        }
      } catch (e) {
        console.warn('Erreur mise à jour candidatures post signature:', e);
      }

      // Mettre à jour locatrust_contracts en local
      try {
        const contractsRaw = localStorage.getItem('locatrust_contracts');
        if (contractsRaw) {
          const contractsList = JSON.parse(contractsRaw);
          if (Array.isArray(contractsList)) {
            const updatedContracts = contractsList.map((c: any) => {
              if (c.contract_number === targetNum) {
                return {
                  ...c,
                  status: 'actif',
                  tenant_signed: true,
                  tenant_signature_url: signatureDataUrl
                };
              }
              return c;
            });
            localStorage.setItem('locatrust_contracts', JSON.stringify(updatedContracts));
            window.dispatchEvent(
              new CustomEvent('locatrust:contracts-updated', { detail: { contracts: updatedContracts } })
            );
          }
        }
      } catch (e) {
        console.warn('Erreur mise à jour contrats post signature:', e);
      }

      // Notification officielle pour le bailleur
      pushGlobalNotification({
        title: 'Bail signé par le locataire !',
        description: `${signingTarget.contract.tenantName} a signé et validé le bail N° ${targetNum}. Le contrat est désormais téléchargeable.`,
        category: 'contrat',
        targetTab: 'applications'
      });

      if (previewingContract && previewingContract.contractNumber === targetNum) {
        setPreviewingContract({
          ...previewingContract,
          tenantSigned: true,
          ownerSigned: true
        });
      }
    } else if (signingTarget.type === 'quittance' && signingTarget.quittance) {
      const targetRef = signingTarget.quittance.receiptNumber || '';
      const cleanTargetRef = targetRef ? targetRef.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const isCaution = signingTarget.quittance.receiptType === 'caution' || targetRef.includes('CAUT');
      
      const updatedMessages = currentAll.map((msg) => {
        const q = msg.quittance;
        if (!q) return msg;
        const qCleanRef = q.receiptNumber ? q.receiptNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        const matches =
          q.receiptNumber === targetRef ||
          (cleanTargetRef && qCleanRef && (qCleanRef === cleanTargetRef || qCleanRef.includes(cleanTargetRef) || cleanTargetRef.includes(qCleanRef))) ||
          (msg.quittance.depositId && signingTarget.quittance?.depositId && msg.quittance.depositId.toLowerCase() === signingTarget.quittance.depositId.toLowerCase());

        if (matches) {
          return {
            ...msg,
            quittance: {
              ...q,
              tenantSignatureUrl: signatureDataUrl
            }
          };
        }
        return msg;
      });

      saveStoredMessages(updatedMessages);
      setMessages([...updatedMessages]);

      // Mettre à jour le message correspondant dans Supabase
      const matchedSignedMsg = updatedMessages.find(m => m.quittance?.receiptNumber === targetRef);
      if (matchedSignedMsg && isValidUuid(matchedSignedMsg.id)) {
        supabase.from('messages').update({
          content: JSON.stringify({
            type: 'quittance',
            text: matchedSignedMsg.text,
            quittance: matchedSignedMsg.quittance
          })
        }).eq('id', matchedSignedMsg.id).then();
      }

      // Si c'est un reçu de caution, mettre à jour cautionsStore et Supabase
      if (isCaution) {
        try {
          const allDeps = getStoredDeposits();
          const cleanDepId = signingTarget.quittance?.depositId ? signingTarget.quittance.depositId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
          const dep = allDeps.find((d) =>
            (signingTarget.quittance?.depositId && d.id.toLowerCase() === signingTarget.quittance.depositId.toLowerCase()) ||
            (cleanDepId && d.id && d.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanDepId) ||
            (targetRef && d.id && targetRef.toUpperCase().includes(d.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())) ||
            (signingTarget.quittance?.contractNumber && (d.contract_number === signingTarget.quittance.contractNumber || d.contract_id === signingTarget.quittance.contractNumber))
          );
          
          const depIdToSign = dep?.id || signingTarget.quittance.depositId || crypto.randomUUID();
          const fallbackDeposit = dep || {
            id: depIdToSign,
            contract_id: signingTarget.quittance.contractNumber || 'CNT-OFFICIAL',
            amount_requested: signingTarget.quittance.amount,
            amount_paid: signingTarget.quittance.amount,
            status: 'paye_complet',
            tenant_id: currentUserId,
            owner_id: activeContact.id,
            owner_signature: signingTarget.quittance.ownerSignatureUrl || 'SIG_OFFICIAL_OWNER_CERTIFIED',
            receipt_sent_to_tenant: true,
            property: {
              title: signingTarget.quittance.propertyTitle || 'Logement loué',
              address: signingTarget.quittance.propertyAddress || 'Abidjan'
            },
            tenant: {
              id: currentUserId,
              full_name: signingTarget.quittance.tenantName || 'christian'
            }
          } as any;

          signCautionReceipt(depIdToSign, 'tenant', signatureDataUrl, fallbackDeposit);
          
          const updateCautionPayload: any = {
            tenant_signature: signatureDataUrl,
            status: 'paye_complet',
            tenant_signed_at: new Date().toISOString()
          };

          if (isValidUuid(depIdToSign)) {
            supabase
              .from('cautions')
              .update(updateCautionPayload)
              .eq('id', depIdToSign)
              .then();
          } else if (isValidUuid(currentUserId)) {
            supabase
              .from('cautions')
              .update(updateCautionPayload)
              .eq('tenant_id', currentUserId)
              .then();
          }

          window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
        } catch {}

        pushGlobalNotification({
          title: 'Reçu de caution signé par le locataire !',
          description: `${signingTarget.quittance.tenantName} a signé son reçu de caution. Le document officiel est désormais scellé et téléchargeable.`,
          category: 'caution',
          targetTab: 'cautions'
        });

        broadcastLiveEvent('CAUTION_SIGNED_BY_TENANT', {
          depositId: signingTarget.quittance?.depositId,
          receiptNumber: targetRef,
          actorId: currentUserId,
          targetUserId: activeContact.id,
          contractId: signingTarget.quittance?.contractNumber,
          data: {
            receiptNumber: targetRef,
            tenantSignatureUrl: signatureDataUrl,
            depositId: signingTarget.quittance?.depositId
          }
        }).catch(() => {});
      }

      sendRealChatMessage(
        currentUserId,
        activeContact.id,
        `✍️ Le locataire a contresigné le reçu N° ${targetRef} avec succès. Le document est officiellement scellé et téléchargeable par les deux parties.`
      ).catch(() => {});

      if (previewingQuittance && previewingQuittance.receiptNumber === targetRef) {
        setPreviewingQuittance({
          ...previewingQuittance,
          tenantSignatureUrl: signatureDataUrl
        });
      }
    }

    setIsSignatureModalOpen(false);
    setSigningTarget(null);
    refreshMessages();

    // Celebratory confetti
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-fadeIn pb-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Messagerie Instantanée LocaTrust
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp Direct
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Échangez directement avec vos locataires et candidats : messages instantanés, quittances certifiées et suivi des échanges en temps réel.
          </p>
        </div>
      </div>

      {/* Main Dual-Column Scrollable Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col md:flex-row h-[680px] max-h-[calc(100vh-160px)] transition-colors">
        
        {/* LEFT COLUMN: Contact List (Scrollable independently) */}
        <div
          className={`${
            showMobileChat ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex-col bg-slate-50 dark:bg-slate-950/60 shrink-0 h-full`}
        >
          {/* Search Contacts Bar - Fixed Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>
            {totalUnread > 0 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    markAllMessagesAsReadForUser(currentUserId);
                    refreshMessages();
                  }}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Tout marquer comme lu</span>
                </button>
              </div>
            )}
          </div>

          {/* Contacts List - Scrollable */}
          <div className="flex-1 flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400 my-auto">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Aucune conversation</p>
                <p className="text-[11px] text-slate-400 mt-1">Vous n'avez encore reçu aucun message.</p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
              const isSelected = selectedContactId === contact.id;
              const contactAliases = new Set([
                contact.id,
                contact.name,
                `tenant_${contact.id}`,
                `owner_${contact.id}`
              ]);
              const contactMsgs = (messages || []).filter(
                (m) =>
                  (myAliases.has(m.sender_id) && (contactAliases.has(m.receiver_id) || m.receiver_id === contact.id || (contact.propertyTitle && m.contract?.propertyTitle === contact.propertyTitle))) ||
                  ((contactAliases.has(m.sender_id) || m.sender_id === contact.id || (contact.propertyTitle && m.contract?.propertyTitle === contact.propertyTitle)) && myAliases.has(m.receiver_id))
              );
              const lastMsg = contactMsgs[contactMsgs.length - 1];

              // Nombre de messages non lus spécifiquement reçus de ce contact
              const contactUnreadCount = (messages || []).filter(
                (m) =>
                  (contactAliases.has(m.sender_id) || m.sender_id === contact.id) &&
                  myAliases.has(m.receiver_id) &&
                  m.status !== 'read'
              ).length;

              return (
                <div
                  key={contact.id}
                  onClick={() => {
                    setSelectedContactId(contact.id);
                    setShowMobileChat(true);
                    markMessagesAsRead(contact.id, currentUserId);
                    refreshMessages();
                  }}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <UserAvatar
                    src={contact.avatar}
                    name={contact.name}
                    fallbackRole={contact.role}
                    sizeClassName="w-12 h-12"
                    isOnline={contact.online}
                    borderClassName="border-2 border-slate-200 dark:border-slate-700"
                  />

                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {contact.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {contact.online ? 'En ligne' : contact.lastSeen || 'Hier'}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 truncate">
                      {contact.propertyTitle}
                    </span>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate pr-2">
                        {lastMsg ? (() => {
                          const txt = (lastMsg.text || '').trim();
                          if (txt.startsWith('{') || txt.startsWith('[')) {
                            try {
                              let p = JSON.parse(txt);
                              if (Array.isArray(p) && p.length > 0) p = p[0];
                              if (p?.text) return p.text.split('\n')[0];
                            } catch {}
                          }
                          return txt.split('\n')[0] || 'Démarrer la conversation...';
                        })() : 'Démarrer la conversation...'}
                      </p>
                      {contactUnreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                          {contactUnreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Thread (Scrollable independently) */}
        <div
          className={`${
            showMobileChat ? 'flex' : 'hidden md:flex'
          } flex-1 flex flex-col bg-slate-100/70 dark:bg-slate-900 h-full min-w-0 relative`}
        >
          {!activeContact ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-inner">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white mb-1">Aucune conversation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Vous n'avez encore reçu aucun message.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header - Always visible at top */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
              {/* Back button on mobile */}
              <button
                type="button"
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <UserAvatar
                src={activeContact.avatar}
                name={activeContact.name}
                fallbackRole={activeContact.role}
                sizeClassName="w-10 h-10"
                isOnline={activeContact.online}
                borderClassName="border-2 border-blue-600/40"
              />

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {activeContact.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold shrink-0">
                    {activeContact.role}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                  {isTyping ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold animate-pulse">
                      écrit un message...
                    </span>
                  ) : activeContact.online ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> En ligne &bull; {activeContact.propertyTitle}
                    </span>
                  ) : (
                    <span>Vu {activeContact.lastSeen || 'récemment'}</span>
                  )}
                </span>
              </div>
            </div>

            {/* Quick Action Call Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleStartAudioCall}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
                title={`Lancer un appel vocal avec ${activeContact.name}`}
              >
                <Phone className="w-4 h-4 text-emerald-600" />
              </button>
              <button
                type="button"
                onClick={handleStartVideoCall}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
                title={`Lancer un appel vidéo avec ${activeContact.name}`}
              >
                <Video className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>

          {/* Messages Feed (Independent Scroll Container) */}
          <div
            ref={chatScrollContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 p-4 sm:p-6 flex flex-col gap-3.5 overflow-y-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]"
          >
            {currentConversationMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 flex items-center justify-center mb-2 shadow-sm">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Aucun message pour le moment</span>
                <span className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Écrivez votre message ci-dessous pour échanger avec {activeContact?.name || 'votre correspondant'}.
                </span>
              </div>
            ) : (
              <>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-1">
                  <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Aujourd'hui
                  </span>
                </div>
              </>
            )}

            {currentConversationMessages.map((m) => {
              const isMe = m.sender_id === currentUserId;
              const timeStr = new Date(m.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              });

              // Déballage intelligent du message si le texte est un JSON sérialisé
              let textToDisplay = m.text || '';
              let contractAttachment = m.contract;
              let quittanceAttachment = m.quittance;
              let restitutionAttachment = m.restitution;
              let fileAttachment = m.attachment;

              if (typeof textToDisplay === 'string' && (textToDisplay.trim().startsWith('{') || textToDisplay.trim().startsWith('['))) {
                try {
                  let parsed = JSON.parse(textToDisplay.trim());
                  if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
                  if (parsed && typeof parsed === 'object') {
                    if (parsed.text) textToDisplay = parsed.text;
                    if (parsed.contract) contractAttachment = contractAttachment || parsed.contract;
                    if (parsed.quittance) quittanceAttachment = quittanceAttachment || parsed.quittance;
                    if (parsed.restitution) restitutionAttachment = restitutionAttachment || parsed.restitution;
                    if (parsed.attachment) fileAttachment = fileAttachment || parsed.attachment;
                  }
                } catch (e) {}
              }

              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                    isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm transition-all ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-line text-xs break-words [overflow-wrap:anywhere]">{textToDisplay}</div>

                    {/* Media / File Attachment (Point 6) */}
                    {fileAttachment && (
                      <div className="mt-2 rounded-xl overflow-hidden">
                        {fileAttachment.type === 'image' && (
                          <div className="flex flex-col gap-1">
                            <img
                              src={fileAttachment.url}
                              alt={fileAttachment.name || 'Photo'}
                              className="rounded-xl max-h-64 max-w-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => window.open(fileAttachment!.url, '_blank')}
                            />
                            {fileAttachment.size && (
                              <span className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'} font-mono`}>
                                {fileAttachment.name} • {fileAttachment.size}
                              </span>
                            )}
                          </div>
                        )}

                        {fileAttachment.type === 'document' && (
                          <a
                            href={fileAttachment.url}
                            download={fileAttachment.name || 'document'}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors shadow-sm ${
                              isMe
                                ? 'bg-blue-700/60 border-blue-500 text-white hover:bg-blue-700'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isMe ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600'
                            }`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold truncate">{fileAttachment.name || 'Document joint'}</span>
                              <span className={`text-[10px] font-mono ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                {fileAttachment.size || 'Fichier PDF'}
                              </span>
                            </div>
                            <Download className="w-4 h-4 shrink-0" />
                          </a>
                        )}

                        {fileAttachment.type === 'audio' && (
                          <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                            isMe
                              ? 'bg-blue-700/60 border-blue-500 text-white'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isMe ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              <Volume2 className="w-4 h-4" />
                            </div>
                            <audio controls src={fileAttachment.url} className="h-8 max-w-[200px] sm:max-w-[240px]" />
                            {fileAttachment.duration && (
                              <span className={`text-[10px] font-mono shrink-0 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                {fileAttachment.duration}s
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quittance / Caution Attachment Card */}
                    {quittanceAttachment && (() => {
                      const isCaution = quittanceAttachment.receiptType === 'caution' || Boolean(quittanceAttachment.receiptNumber && quittanceAttachment.receiptNumber.includes('CAUT'));
                      const tenantSigned = Boolean(quittanceAttachment.tenantSignatureUrl);

                      return (
                        <div className={`mt-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-4 border shadow-md flex flex-col gap-3 ${
                          isCaution ? 'border-amber-300 dark:border-amber-700/60' : 'border-slate-200 dark:border-slate-700'
                        }`}>
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                                isCaution ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isCaution ? <ShieldCheck className="w-4 h-4 text-amber-600" /> : <Receipt className="w-4 h-4 text-blue-600" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-900 dark:text-white">
                                  {isCaution ? 'Reçu Officiel de Caution (Dépôt de Garantie)' : 'Quittance de Loyer Certifiée'}
                                </span>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                  N° {quittanceAttachment.receiptNumber}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {isCaution ? 'Loi 2019-576' : 'Validée'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Montant :</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400">{formatFCFA(quittanceAttachment.amount)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Nature :</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                {isCaution ? 'Garantie légale consignée' : quittanceAttachment.periodCovered}
                              </span>
                            </div>
                            <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px] font-semibold">
                              <span className="text-emerald-600">✅ Bailleur signé</span>
                              <span className={tenantSigned ? 'text-emerald-600' : 'text-amber-600 font-bold'}>
                                {tenantSigned ? '✅ Locataire signé' : '⏳ Locataire (À signer)'}
                              </span>
                            </div>
                          </div>

                          {/* 3 Actions: Consulter / Signer / Télécharger */}
                          <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 pt-1 w-full">
                            <button
                              type="button"
                              onClick={() => setPreviewingQuittance(quittanceAttachment!)}
                              className="py-2 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                              title="Consulter le reçu"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">Consulter</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (tenantSigned) return;
                                setSigningTarget({
                                  type: 'quittance',
                                  quittance: quittanceAttachment,
                                  role: userRole === 'locataire' ? 'locataire' : 'proprietaire'
                                });
                                setIsSignatureModalOpen(true);
                              }}
                              className={`py-2 px-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 ${
                                tenantSigned
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                              }`}
                              title={tenantSigned ? 'Reçu déjà contresigné' : 'Apposer votre signature manuscrite certifiée'}
                            >
                              {tenantSigned ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <PenTool className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{tenantSigned ? 'Signé ✓' : 'Signer le reçu'}</span>
                            </button>
                            {tenantSigned ? (
                              <button
                                type="button"
                                onClick={() => downloadQuittancePdfFromAttachment(quittanceAttachment!)}
                                className="py-2 px-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                                title="Télécharger le reçu PDF officiel scellé"
                              >
                                <Download className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Télécharger</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => alert("Le téléchargement de ce reçu officiel est verrouillé en attente de la signature du locataire.")}
                                className="py-2 px-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                title="Téléchargement bloqué en attente de la signature du locataire"
                              >
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Téléchargement bloqué</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Contract Attachment Card */}
                    {contractAttachment && (
                      <div className="mt-3 bg-white text-slate-900 rounded-2xl p-4 border border-slate-200 shadow-md flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                              <FileText className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900">
                                Contrat de Bail d'Habitation
                              </span>
                              <span className="text-[10px] text-purple-600 font-mono font-bold">
                                N° {contractAttachment.contractNumber}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                              contractAttachment.ownerSigned && contractAttachment.tenantSigned
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {contractAttachment.ownerSigned && contractAttachment.tenantSigned ? 'Certifié & Signé' : 'En attente signature'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-900">{contractAttachment.propertyTitle}</span>
                          <span className="text-slate-500 text-[10px]">{contractAttachment.propertyAddress}</span>
                          <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                            <span>Loyer : <strong>{formatFCFA(contractAttachment.rentAmount)}</strong></span>
                            <span>Caution : <strong>{formatFCFA(contractAttachment.cautionAmount)}</strong></span>
                          </div>
                        </div>

                        {/* 3 Actions for Contract: Consulter / Signer / Télécharger (100% responsive smartphone) */}
                        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 pt-1 w-full">
                          <button
                            type="button"
                            onClick={() => setPreviewingContract(contractAttachment!)}
                            className="py-2 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                            title="Consulter les clauses du contrat"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">Consulter</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (contractAttachment!.tenantSigned && contractAttachment!.ownerSigned) {
                                alert("Ce contrat de bail est déjà entièrement signé et certifié.");
                              } else {
                                setSigningTarget({
                                  type: 'contract',
                                  contract: contractAttachment,
                                  role: userRole === 'locataire' ? 'locataire' : 'proprietaire'
                                });
                                setIsSignatureModalOpen(true);
                              }
                            }}
                            className={`py-2 px-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 ${
                              contractAttachment!.tenantSigned && contractAttachment!.ownerSigned
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title="Signer électroniquement"
                          >
                            <PenTool className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {contractAttachment!.tenantSigned && contractAttachment!.ownerSigned ? 'Signé ✓' : 'Signer'}
                            </span>
                          </button>
                          {contractAttachment!.tenantSigned && contractAttachment!.ownerSigned ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const resolved = await resolveContractParties({
                                  currentProfile: profile,
                                  currentUser: user,
                                  ownerFallback: {
                                    name: contractAttachment!.ownerName,
                                    phone: (contractAttachment as any)?.ownerPhone || (contractAttachment as any)?.owner_phone,
                                    email: (contractAttachment as any)?.ownerEmail || (contractAttachment as any)?.owner_email,
                                    address: (contractAttachment as any)?.ownerAddress || (contractAttachment as any)?.owner_address,
                                    cni: (contractAttachment as any)?.ownerCni || (contractAttachment as any)?.owner_cni,
                                    signatureUrl: contractAttachment!.ownerSignatureUrl || (contractAttachment as any)?.owner_signature_url,
                                  },
                                  tenantFallback: {
                                    name: contractAttachment!.tenantName,
                                    phone: (contractAttachment as any)?.tenantPhone || (contractAttachment as any)?.tenant_phone,
                                    email: (contractAttachment as any)?.tenantEmail || (contractAttachment as any)?.tenant_email,
                                    address: (contractAttachment as any)?.tenantAddress || (contractAttachment as any)?.tenant_address,
                                    cni: (contractAttachment as any)?.tenantCni || (contractAttachment as any)?.tenant_cni,
                                    signatureUrl: contractAttachment!.tenantSignatureUrl || (contractAttachment as any)?.tenant_signature_url,
                                  }
                                });

                                await generateOfficialContractPdf({
                                  contractNumber: contractAttachment!.contractNumber,
                                  isAgency: userRole === 'agence',
                                  ownerName: resolved.owner.name,
                                  ownerPhone: resolved.owner.phone,
                                  ownerEmail: resolved.owner.email,
                                  ownerAddress: resolved.owner.address,
                                  ownerCni: resolved.owner.cni,
                                  tenantName: resolved.tenant.name,
                                  tenantPhone: resolved.tenant.phone,
                                  tenantEmail: resolved.tenant.email,
                                  tenantAddress: resolved.tenant.address,
                                  tenantCni: resolved.tenant.cni,
                                  propertyTitle: contractAttachment!.propertyTitle,
                                  propertyAddress: contractAttachment!.propertyAddress,
                                  surface: contractAttachment!.surface,
                                  rooms: contractAttachment!.rooms,
                                  bedrooms: contractAttachment!.bedrooms,
                                  bathrooms: contractAttachment!.bathrooms,
                                  equipments: contractAttachment!.equipments,
                                  amenities: contractAttachment!.equipments,
                                  propertyDescription: contractAttachment!.propertyDescription,
                                  durationMonths: contractAttachment!.durationMonths,
                                  startDate: contractAttachment!.startDate,
                                  rent: contractAttachment!.rentAmount,
                                  cautionMonths: 2,
                                  chargesAmount: 5000,
                                  dueDay: 5,
                                  ownerSignatureUrl: resolved.owner.signatureUrl || contractAttachment!.ownerSignatureUrl,
                                  tenantSignatureUrl: resolved.tenant.signatureUrl || contractAttachment!.tenantSignatureUrl,
                                  leaseType: (contractAttachment as any)?.usage_destination || 'habitation',
                                  usageDestination: (contractAttachment as any)?.usage_destination || 'habitation',
                                  authorizedActivity: (contractAttachment as any)?.authorized_activity || ''
                                });
                              }}
                              className="py-2 px-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                              title="Télécharger l'exemplaire officiel PDF certifié"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Télécharger</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  "Téléchargement bloqué : Le contrat officiel final ne peut pas être téléchargé tant que les deux parties (bailleur et locataire) n'ont pas apposé leur signature certifiée."
                                )
                              }
                              className="py-2 px-1.5 rounded-xl bg-slate-100 text-slate-400 text-[11px] font-bold flex items-center justify-center gap-1 border border-slate-200 cursor-not-allowed opacity-60"
                              title="Téléchargement bloqué : En attente de signature des deux parties"
                            >
                              <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">Bloqué</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Restitution de Caution Card (Point 2) */}
                    {restitutionAttachment && (
                      <div className="mt-3 bg-white text-slate-900 rounded-2xl p-4 border border-emerald-200 shadow-md flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900">
                                Restitution de Caution
                              </span>
                              <span className="text-[10px] text-emerald-700 font-mono font-bold">
                                N° {restitutionAttachment.receiptNumber}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Caution restituée
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <p className="font-semibold text-slate-800 leading-relaxed">
                            Votre caution concernant le contrat <strong className="text-blue-700 font-mono">{restitutionAttachment.contractNumber}</strong> a été restituée.
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-medium">Montant restitué :</span>
                            <span className="font-black text-emerald-700 text-xs">{formatFCFA(restitutionAttachment.amountRestituted)}</span>
                          </div>
                          {restitutionAttachment.deductionAmount > 0 && (
                            <div className="flex items-center justify-between text-[10px] text-amber-800">
                              <span>Retenue appliquée : {formatFCFA(restitutionAttachment.deductionAmount)}</span>
                              <span className="italic truncate max-w-[160px]">{restitutionAttachment.deductionReason}</span>
                            </div>
                          )}
                        </div>

                        {/* Action: Voir le reçu */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleDownloadRestitutionPdf(restitutionAttachment!)}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Voir le reçu</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Déclaration de Caution ou de Loyer Card (Point demandé dans l'audio) */}
                    {m.declaration && (
                      <div className="mt-3 bg-white text-slate-900 rounded-2xl p-4 border-2 border-blue-200 dark:border-blue-900 shadow-md flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                              {m.declaration.type === 'caution' ? (
                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                              ) : (
                                <CreditCard className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-wide">
                                {m.declaration.type === 'caution' ? 'Déclaration de Caution' : 'Déclaration de Loyer'}
                              </span>
                              <span className="text-[10px] text-blue-700 font-mono font-bold">
                                Contrat N° {m.declaration.contractNumber}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                              m.declaration.status === 'valide'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {m.declaration.status === 'valide' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Validé & Encaissé
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> À Confirmer
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Logement :</span>
                            <span className="font-bold text-slate-800 truncate max-w-[170px]">
                              {m.declaration.propertyTitle}
                            </span>
                          </div>
                          {m.declaration.month && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Mois / Période :</span>
                              <span className="font-bold text-slate-800">{m.declaration.month}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Règlement :</span>
                            <span className="font-semibold text-slate-700">
                              {m.declaration.paymentMethod} (Réf: {m.declaration.reference})
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-medium">Montant déclaré :</span>
                            <span className="font-black text-emerald-700 text-xs">
                              {formatFCFA(m.declaration.amount)}
                            </span>
                          </div>
                        </div>

                        {/* Actions : Le Bailleur peut vérifier & valider immédiatement */}
                        {m.declaration.status !== 'valide' ? (
                          userRole !== 'locataire' ? (
                            <button
                              type="button"
                              onClick={() => {
                                updateDeclarationMessageStatus(m.declaration!.declarationId, 'valide');
                                if (m.declaration!.type === 'caution') {
                                  confirmCautionReceipt(
                                    m.declaration!.declarationId,
                                    user?.user_metadata?.full_name || 'Bailleur'
                                  );
                                  sendCautionReceiptToTenant(m.declaration!.declarationId);
                                  window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
                                } else {
                                  window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
                                }
                                refreshMessages();
                                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Vérifier & Valider l'encaissement</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200 text-center font-bold">
                              ⏳ En attente de validation par votre bailleur
                            </span>
                          )
                        ) : (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Paiement validé & comptabilisé sur les registres</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Signature Reminder Card */}
                    {m.reminderContractNumber && (
                      <div className="mt-2.5 bg-amber-50 text-slate-900 rounded-2xl p-3.5 border-2 border-amber-300 shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Rappel officiel de signature électronique</span>
                        </div>
                        <p className="text-[11px] text-amber-950">
                          Le bailleur a certifié le contrat <strong>N° {m.reminderContractNumber}</strong>. Veuillez apposer votre signature pour valider votre entrée dans les lieux.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (m.contract) {
                              setPreviewingContract(m.contract);
                            } else {
                              setSigningTarget({
                                type: 'contract',
                                contract: {
                                  contractNumber: m.reminderContractNumber!,
                                  propertyTitle: activeContact.propertyTitle,
                                  propertyAddress: (activeContact as any)?.propertyAddress || 'Abidjan - Côte d\'Ivoire',
                                  rentAmount: 75000,
                                  cautionAmount: 150000,
                                  durationMonths: 12,
                                  startDate: '01/10/2026',
                                  ownerName: user?.user_metadata?.full_name || "Bailleur",
                                  tenantName: activeContact?.name || "Locataire",
                                  ownerSigned: true,
                                  tenantSigned: false
                                },
                                role: 'locataire'
                              });
                              setIsSignatureModalOpen(true);
                            }
                          }}
                          className="mt-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Signer le contrat maintenant &rarr;</span>
                        </button>
                      </div>
                    )}

                    {/* Timestamp & Double Checkmarks (WhatsApp style) */}
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMe ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      <span>{timeStr}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-sky-200" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="mr-auto items-start max-w-[70%]">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-slate-500 ml-1.5 font-medium">
                    {activeContact?.name || 'Votre correspondant'} écrit...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bouton flottant pour redescendre vers les derniers messages */}
          {showScrollDownBtn && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-24 right-6 px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-2xl flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 z-30 cursor-pointer border border-blue-400 animate-bounce"
            >
              <span>↓ Derniers messages</span>
            </button>
          )}

          {/* Hidden File Inputs for Image & Document (Point 6) */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelect}
          />
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
            className="hidden"
            onChange={handleDocFileSelect}
          />

          {/* Voice Recording Active Bar (Point 6) */}
          {isRecordingAudio ? (
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-red-50 dark:bg-red-950/40 flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-red-600 animate-ping shrink-0" />
                <span className="text-xs font-black text-red-700 dark:text-red-400">
                  Enregistrement : {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelVoiceRecording}
                  className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 active:scale-95"
                  title="Annuler l'enregistrement"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span className="hidden sm:inline">Annuler</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendVoiceRecording}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                  title="Envoyer la note vocale"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer ({recordingSeconds}s)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Input Box (Fixed at bottom) */
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                title="Joindre un document officiel (PDF, bail, quittance...)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                title="Envoyer une photo / capture"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Écrivez votre message..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />

              {inputMessage.trim() ? (
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="p-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center transition-all active:scale-95"
                  title="Envoyer"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartVoiceRecording}
                  className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center group active:scale-95"
                  title="Enregistrer une note vocale"
                >
                  <Mic className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>
          )}
          </>
        )}
        </div>
      </div>

      {/* MODAL 1: CONTRACT REVIEW & ELECTRONIC SIGNATURE (Centered Compact Card) */}
      {previewingContract && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-xs animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Bail d'Habitation Officiel LocaTrust
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-purple-700 font-bold text-xs">
                      N° {previewingContract.contractNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-extrabold border border-blue-200">
                      Loi n° 2019-576
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingContract(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Bien */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-blue-700">Bien loué</span>
                <strong className="text-slate-900">{previewingContract.propertyTitle}</strong>
                <span className="text-slate-500 text-[11px]">{previewingContract.propertyAddress}</span>
              </div>

              {/* Conditions financières */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-blue-700">Conditions financières</span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Loyer mensuel :</span>
                  <strong className="text-blue-700">{formatFCFA(previewingContract.rentAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dépôt de garantie :</span>
                  <strong className="text-amber-700">{formatFCFA(previewingContract.cautionAmount)}</strong>
                </div>
              </div>

              {/* Parties */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-blue-700">Bailleur</span>
                <strong className="text-slate-900">{previewingContract.ownerName}</strong>
                <span className="text-slate-500 text-[11px]">Propriétaire vérifié LocaTrust</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-blue-700">Preneur / Locataire</span>
                <strong className="text-slate-900">{previewingContract.tenantName}</strong>
                <span className="text-slate-500 text-[11px]">Dossier locatif complet</span>
              </div>
            </div>

            {/* Signatures Status Card */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col gap-2">
              <span className="text-xs font-black text-blue-900">
                Statut des signatures électroniques
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Signature Bailleur : Validée</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  {previewingContract.tenantSigned ? (
                    <span className="text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Signature Locataire : Signé
                    </span>
                  ) : (
                    <span className="text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Signature Locataire : En attente
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t">
              <button
                type="button"
                onClick={() => setPreviewingContract(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={async () => {
                  let surface = previewingContract.surface;
                  let rooms = previewingContract.rooms;
                  let bedrooms = previewingContract.bedrooms;
                  let bathrooms = previewingContract.bathrooms;
                  let equipments = previewingContract.equipments;
                  let propertyDescription = previewingContract.propertyDescription;

                  if (!surface) {
                    try {
                      const stored = localStorage.getItem('locatrust_properties');
                      if (stored) {
                        const parsedProps = JSON.parse(stored);
                        const match = parsedProps.find((p: any) =>
                          (previewingContract.propertyTitle && p.title && p.title.toLowerCase().includes(previewingContract.propertyTitle.toLowerCase())) ||
                          (previewingContract.propertyAddress && p.location && previewingContract.propertyAddress.toLowerCase().includes(p.location.toLowerCase()))
                        );
                        if (match) {
                          surface = match.surface;
                          rooms = match.rooms;
                          bedrooms = match.bedrooms;
                          bathrooms = match.bathrooms;
                          equipments = match.equipments;
                          propertyDescription = match.description;
                        }
                      }
                    } catch (e) {
                      console.warn('Property lookup error', e);
                    }
                  }

                  const resolved = await resolveContractParties({
                    currentProfile: profile,
                    currentUser: user,
                    ownerFallback: {
                      name: previewingContract.ownerName,
                      phone: (previewingContract as any)?.ownerPhone || (previewingContract as any)?.owner_phone,
                      email: (previewingContract as any)?.ownerEmail || (previewingContract as any)?.owner_email,
                      address: (previewingContract as any)?.ownerAddress || (previewingContract as any)?.owner_address,
                      cni: (previewingContract as any)?.ownerCni || (previewingContract as any)?.owner_cni,
                      signatureUrl: previewingContract.ownerSignatureUrl || (previewingContract as any)?.owner_signature_url,
                    },
                    tenantFallback: {
                      name: previewingContract.tenantName,
                      phone: (previewingContract as any)?.tenantPhone || (previewingContract as any)?.tenant_phone,
                      email: (previewingContract as any)?.tenantEmail || (previewingContract as any)?.tenant_email,
                      address: (previewingContract as any)?.tenantAddress || (previewingContract as any)?.tenant_address,
                      cni: (previewingContract as any)?.tenantCni || (previewingContract as any)?.tenant_cni,
                      signatureUrl: previewingContract.tenantSignatureUrl || (previewingContract as any)?.tenant_signature_url,
                    }
                  });

                  await generateOfficialContractPdf({
                    contractNumber: previewingContract.contractNumber,
                    isAgency: userRole === 'agence',
                    ownerName: resolved.owner.name,
                    ownerPhone: resolved.owner.phone,
                    ownerEmail: resolved.owner.email,
                    ownerAddress: resolved.owner.address,
                    ownerCni: resolved.owner.cni,
                    tenantName: resolved.tenant.name,
                    tenantPhone: resolved.tenant.phone,
                    tenantEmail: resolved.tenant.email,
                    tenantAddress: resolved.tenant.address,
                    tenantCni: resolved.tenant.cni,
                    propertyTitle: previewingContract.propertyTitle,
                    propertyAddress: previewingContract.propertyAddress,
                    surface,
                    rooms,
                    bedrooms,
                    bathrooms,
                    equipments,
                    amenities: equipments,
                    propertyDescription,
                    durationMonths: previewingContract.durationMonths,
                    startDate: previewingContract.startDate,
                    rent: previewingContract.rentAmount,
                    cautionMonths: 2,
                    chargesAmount: 5000,
                    dueDay: 5,
                    ownerSignatureUrl: resolved.owner.signatureUrl || previewingContract.ownerSignatureUrl,
                    tenantSignatureUrl: resolved.tenant.signatureUrl || previewingContract.tenantSignatureUrl,
                    leaseType: (previewingContract as any)?.usage_destination || 'habitation',
                    usageDestination: (previewingContract as any)?.usage_destination || 'habitation',
                    authorizedActivity: (previewingContract as any)?.authorized_activity || ''
                  });
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </button>

              {!previewingContract.tenantSigned ? (
                <button
                  type="button"
                  onClick={() => {
                    setSigningTarget({
                      type: 'contract',
                      contract: previewingContract,
                      role: 'locataire'
                    });
                    setIsSignatureModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Signer électroniquement ce bail</span>
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Contrat signé & validé
                </span>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: RECEIPT PREVIEW & VALIDATION (Centered Compact Card) */}
      {previewingQuittance && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-xs animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Quittance de Loyer Certifiée LocaTrust
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-blue-700 font-bold text-xs">
                      N° {previewingQuittance.receiptNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      Confirmé & Authentifié
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingQuittance(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Summary Details */}
            <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Locataire :</span>
                <span className="font-bold text-slate-900">{previewingQuittance.tenantName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Montant réglé :</span>
                <span className="font-black text-blue-700 text-sm">{formatFCFA(previewingQuittance.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Période couverte :</span>
                <span className="font-bold text-slate-800">{previewingQuittance.periodCovered}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Mode de paiement :</span>
                <span className="font-semibold text-slate-700">{previewingQuittance.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Réf. transaction :</span>
                <span className="font-mono font-bold text-slate-700">{previewingQuittance.transactionReference}</span>
              </div>
            </div>

            {/* QR Code Verification Preview */}
            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-sm">
                <img
                  src="/qr-code-locatrust.png"
                  alt="QR Code"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = LOCATRUST_QR_CODE_DATA_URL;
                  }}
                />
              </div>
              <div className="flex flex-col text-[10px] text-slate-600 leading-tight">
                <strong className="text-slate-900 font-bold">Vérification Sécurisée LocaTrust</strong>
                <span>Scannez ce QR code pour vérifier l'authenticité de cette quittance officielle.</span>
                <span className="text-blue-700 font-extrabold mt-0.5">locatrust.com/verify/recu/...</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPreviewingQuittance(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
              >
                Fermer
              </button>

              {!previewingQuittance.tenantSignatureUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setSigningTarget({
                      type: 'quittance',
                      quittance: previewingQuittance,
                      role: 'locataire'
                    });
                    setIsSignatureModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Signer le reçu</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => downloadQuittancePdfFromAttachment(previewingQuittance)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SIGNATURE MODAL (Reusable Component) */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setSigningTarget(null);
        }}
        onConfirmSignature={handleConfirmSignature}
        signerName={
          signingTarget?.role === 'proprietaire'
            ? (user?.user_metadata?.full_name || "Bailleur")
            : (activeContact?.name || "Locataire")
        }
        signerRole={signingTarget?.role || 'locataire'}
        documentTitle={
          signingTarget?.type === 'contract'
            ? "Contrat de Bail d'Habitation"
            : "Quittance Officielle de Loyer"
        }
        documentNumber={
          signingTarget?.contract?.contractNumber ||
          signingTarget?.quittance?.receiptNumber ||
          'LT-CI-2026'
        }
      />



      {/* MODAL: MICROPHONE PERMISSION / ERROR (Point 6 & Point 33) */}
      {micPermissionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <MicOff className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Autorisation Microphone</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {micPermissionModal}
            </p>
            <button
              type="button"
              onClick={() => setMicPermissionModal(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
