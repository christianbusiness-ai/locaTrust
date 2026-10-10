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
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatFCFA } from '@/lib/utils';
import { LOCATRUST_QR_CODE_DATA_URL } from '@/lib/qrCodeData';
import { SignatureModal } from '@/components/common/SignatureModal';
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
  downloadQuittancePdfFromAttachment
} from '@/lib/messagingStore';
import { generateOfficialContractPdf } from '@/lib/contractPdfGenerator';
import { generateRestitutionReceiptPDF } from '@/lib/payments/restitutionReceiptPdfGenerator';
import { useAuth } from '@/src/context/AuthContext';

interface MessagerieViewProps {
  userRole?: 'proprietaire' | 'locataire' | 'agence';
}

export const MessagerieView: React.FC<MessagerieViewProps> = ({ userRole = 'proprietaire' }) => {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || (userRole === 'locataire' ? 'usr_tenant' : userRole === 'agence' ? 'usr_agency' : 'usr_owner');

  const roleContacts = React.useMemo(() => {
    const list: ChatContact[] = [
      {
        id: 'usr_support',
        name: 'Support LocaTrust',
        phone: '+225 25 20 00 11 22',
        role: 'Assistance Client 24/7',
        propertyTitle: 'Support Technique & Juridique',
        avatar: '',
        online: true
      }
    ];

    if (typeof window !== 'undefined') {
      try {
        const appsRaw = localStorage.getItem('locatrust_rental_applications');
        if (appsRaw) {
          const apps = JSON.parse(appsRaw);
          if (Array.isArray(apps)) {
            apps.forEach((app: any) => {
              if (userRole === 'locataire') {
                const ownerName = app.owner_name || 'Bailleur Propriétaire';
                if (!list.some((c) => c.name === ownerName)) {
                  list.push({
                    id: `owner_${app.property_id || app.id}`,
                    name: ownerName,
                    phone: app.owner_phone || '+225 07 00 00 00 00',
                    role: 'Propriétaire Bailleur',
                    propertyTitle: app.property_title || 'Logement',
                    avatar: app.owner_avatar || '',
                    online: true
                  });
                }
              } else {
                if (app.tenant_name && !list.some((c) => c.id === `tenant_${app.id}`)) {
                  list.push({
                    id: `tenant_${app.id}`,
                    name: app.tenant_name,
                    phone: app.tenant_phone || '+225 05 00 00 00 00',
                    role: 'Candidat Locataire',
                    propertyTitle: app.property_title || 'Bien immobilier',
                    avatar: app.tenant_avatar || '',
                    online: true
                  });
                }
              }
            });
          }
        }
      } catch (e) {}
    }

    return list;
  }, [userRole]);

  const [selectedContactId, setSelectedContactId] = useState<string>(() => roleContacts[0]?.id || 'usr_tenant_1');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingQuittance, setPreviewingQuittance] = useState<ChatQuittanceAttachment | null>(null);
  const [previewingContract, setPreviewingContract] = useState<ChatContractAttachment | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

  // Sync selectedContactId if role contacts change
  useEffect(() => {
    if (!roleContacts.some((c) => c.id === selectedContactId)) {
      setSelectedContactId(roleContacts[0]?.id || 'usr_tenant_1');
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const activeAudioCallRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Load stored messages
  const refreshMessages = () => {
    const list = getStoredMessages();
    setMessages(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    refreshMessages();

    const handleMessagesUpdated = () => {
      refreshMessages();
    };

    window.addEventListener('locatrust:messages_updated', handleMessagesUpdated);
    return () => {
      window.removeEventListener('locatrust:messages_updated', handleMessagesUpdated);
    };
  }, []);

  // Scroll to bottom on message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedContactId, isTyping]);

  const activeContact = roleContacts.find((c) => c.id === selectedContactId) || roleContacts[0];

  // Marquer immédiatement les messages du contact actif comme lus
  useEffect(() => {
    if (activeContact?.id && currentUserId) {
      markMessagesAsRead(activeContact.id, currentUserId);
    }
  }, [activeContact?.id, currentUserId, messages.length]);

  // Filter messages between current user and active contact
  const currentConversationMessages = (Array.isArray(messages) ? messages : []).filter(
    (m) =>
      (m.sender_id === currentUserId && m.receiver_id === activeContact.id) ||
      (m.sender_id === activeContact.id && m.receiver_id === currentUserId)
  );

  // Filter contacts by search
  const filteredContacts = roleContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase())
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

  // Audio Call Handlers (Appel Vocal Réel avec Microphone)
  const handleStartAudioCall = async () => {
    setActiveAudioCall({ seconds: 0, isMuted: false, isSpeaker: false });
    playCallChime('connected');

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        setupAudioVolumeAnalysis(stream);
      }
    } catch (err) {
      console.warn('Microphone stream access notice:', err);
    }
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
      const allMsgs = getStoredMessages();
      const callMsg: ChatMessage = {
        id: `call_${Date.now()}`,
        sender_id: currentUserId,
        receiver_id: activeContact.id,
        text: `📞 Appel vocal terminé (${durationStr})`,
        created_at: new Date().toISOString()
      };
      saveStoredMessages([...allMsgs, callMsg]);
      refreshMessages();
    }
    setActiveAudioCall(null);
    setShowMobileChat(true);
  };

  const animationIntervalRef = useRef<any>(null);

  // Helper to create live simulated remote video stream with contact avatar & realistic movement
  const createSimulatedRemoteVideoStream = (userName: string, avatarUrl?: string): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (avatarUrl) {
      img.src = avatarUrl;
    }

    const renderFrame = () => {
      if (!ctx) return;
      frame++;
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Subtle ambient room lighting shift
      const ambientLight = Math.sin(frame * 0.03) * 0.05;
      ctx.fillStyle = `rgba(30, 58, 138, ${0.15 + ambientLight})`;
      ctx.fillRect(0, 0, 640, 480);

      // Center position
      const cx = 320;
      const cy = 210 + Math.sin(frame * 0.04) * 4; // Gentle breathing motion

      // Outer glowing pulsing ring
      const pulseScale = 1 + Math.sin(frame * 0.06) * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, 95 * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#3b82f6';
      ctx.stroke();

      // Avatar circle clipping & drawing
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 75, 0, Math.PI * 2);
      ctx.clip();

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - 75, cy - 75, 150, 150);
      } else {
        // Fallback stylish avatar silhouette
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(cx - 75, cy - 75, 150, 150);
        ctx.beginPath();
        ctx.arc(cx, cy - 15, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + 55, 45, Math.PI, 0, false);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.restore();

      // Live video audio indicator bars
      const barCount = 7;
      const startX = cx - 45;
      for (let i = 0; i < barCount; i++) {
        const h = 10 + Math.abs(Math.sin((frame * 0.1) + i * 0.8)) * 22;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(startX + i * 14, 335 - h / 2, 6, h);
      }

      // Name label banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.roundRect ? ctx.roundRect(cx - 130, 365, 260, 32, 16) : ctx.fillRect(cx - 130, 365, 260, 32);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(userName, cx, 386);

      // "En direct • 60 FPS" badge at top
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.roundRect ? ctx.roundRect(20, 20, 150, 26, 13) : ctx.fillRect(20, 20, 150, 26);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(34, 33, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('HD 1080p • EN DIRECT', 44, 37);
    };

    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
    }
    animationIntervalRef.current = setInterval(renderFrame, 40);
    renderFrame();
    return canvas.captureStream(30);
  };

  // Video Call Handlers (Activer Réellement la Caméra Physique + Flux HD Deux Parties)
  const handleStartVideoCall = async () => {
    setActiveVideoCall({ seconds: 0, isMuted: false, isCamOff: false, isFrontCam: true });
    setIsVideoSwapped(false);
    setCameraError(null);
    playCallChime('connected');

    let localStream: MediaStream | null = null;

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        // Tentative 1 : Caméra avant mobile + micro
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: true
          });
        } catch {
          // Tentative 2 : Caméra générale + micro
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            });
          } catch {
            // Tentative 3 : Caméra seule
            localStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      }
    } catch (err: any) {
      console.warn('Physical camera access error:', err);
      setCameraError('Autorisation caméra requise pour afficher votre flux en direct.');
    }

    localStreamRef.current = localStream;
    if (localStream) {
      setupAudioVolumeAnalysis(localStream);
    }

    // Flux vidéo distant HD représentant le bailleur ou locataire en temps réel
    const remoteStream = createSimulatedRemoteVideoStream(activeContact.name, activeContact.avatar);
    remoteStreamRef.current = remoteStream;
  };

  // Toggle Front/Rear Camera (Particulièrement utile sur smartphone)
  const handleFlipCamera = async () => {
    if (!activeVideoCall) return;
    const nextFacingMode = !activeVideoCall.isFrontCam;
    setActiveVideoCall((prev) => (prev ? { ...prev, isFrontCam: nextFacingMode } : null));

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => track.stop());
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacingMode ? 'user' : 'environment' },
          audio: !activeVideoCall.isMuted
        });
        localStreamRef.current = newStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
          localVideoRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Could not switch camera facing mode:', err);
    }
  };

  // Toggle Microphone
  const handleToggleMute = () => {
    if (!activeVideoCall) return;
    const newMuted = !activeVideoCall.isMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }
    setActiveVideoCall({ ...activeVideoCall, isMuted: newMuted });
  };

  // Toggle Camera
  const handleToggleCam = () => {
    if (!activeVideoCall) return;
    const newCamOff = !activeVideoCall.isCamOff;
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !newCamOff;
      });
    }
    setActiveVideoCall({ ...activeVideoCall, isCamOff: newCamOff });
  };

  // Hang Up Video Call (Sécurisé sans rechargement ni fermeture de page)
  const handleEndVideoCall = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    playCallChime('hangup');
    cleanupAudioAnalysis();

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      try {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      remoteStreamRef.current = null;
    }
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (activeVideoCall && activeVideoCall.seconds > 0) {
      const mins = Math.floor(activeVideoCall.seconds / 60);
      const secs = activeVideoCall.seconds % 60;
      const durationStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
      const allMsgs = getStoredMessages();
      const callMsg: ChatMessage = {
        id: `call_${Date.now()}`,
        sender_id: currentUserId,
        receiver_id: activeContact.id,
        text: `📹 Appel vidéo terminé (${durationStr})`,
        created_at: new Date().toISOString()
      };
      saveStoredMessages([...allMsgs, callMsg]);
      refreshMessages();
    }
    setActiveVideoCall(null);
    setShowMobileChat(true);
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

      // Auto reply from contact
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        sendChatMessage(activeContact.id, currentUserId, "Photo bien reçue ! Je l'examine dès maintenant.");
        refreshMessages();
      }, 1500);
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

      // Auto reply
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        sendChatMessage(activeContact.id, currentUserId, `Document "${file.name}" bien reçu et versé au dossier.`);
        refreshMessages();
      }, 1500);
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

    // Réponse automatique courtoise
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      sendChatMessage(activeContact.id, currentUserId, "Message audio bien reçu, je l'écoute à l'instant !");
      refreshMessages();
    }, 1500);
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

  // Handle Send Message (with interactive reply)
  const handleSendMessage = () => {
    if (!inputMessage.trim() || !activeContact) return;

    const sentText = inputMessage.trim();
    sendChatMessage(currentUserId, activeContact.id, sentText);
    setInputMessage('');
    refreshMessages();

    // Réponse d'accueil de l'assistance Support LocaTrust
    if (activeContact.id === 'usr_support') {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        sendChatMessage(
          activeContact.id,
          currentUserId,
          "Bonjour ! Notre équipe d'assistance et support juridique LocaTrust a bien pris en compte votre message. Nous vous répondrons dans les plus brefs délais."
        );
        refreshMessages();
      }, 1000);
    }
  };

  // Confirm Signature for either contract or receipt
  const handleConfirmSignature = (signatureDataUrl: string) => {
    if (!signingTarget) return;

    const currentAll = getStoredMessages();

    if (signingTarget.type === 'contract' && signingTarget.contract) {
      const targetNum = signingTarget.contract.contractNumber;
      const updatedMessages = currentAll.map((msg) => {
        if (msg.contract && msg.contract.contractNumber === targetNum) {
          return {
            ...msg,
            contract: {
              ...msg.contract,
              tenantSigned: true,
              ownerSigned: true
            }
          };
        }
        return msg;
      });

      saveStoredMessages(updatedMessages);

      // Post confirmation notification message in conversation
      sendChatMessage(
        activeContact.id,
        'usr_owner_1',
        `✍️ Le bail d'habitation N° ${targetNum} a été officiellement signé avec succès. Le document est désormais certifié conforme Loi n° 2019-576.`
      );

      if (previewingContract && previewingContract.contractNumber === targetNum) {
        setPreviewingContract({
          ...previewingContract,
          tenantSigned: true,
          ownerSigned: true
        });
      }
    } else if (signingTarget.type === 'quittance' && signingTarget.quittance) {
      const targetRef = signingTarget.quittance.receiptNumber;
      const updatedMessages = currentAll.map((msg) => {
        if (msg.quittance && msg.quittance.receiptNumber === targetRef) {
          return {
            ...msg,
            quittance: {
              ...msg.quittance,
              tenantSignatureUrl: signatureDataUrl
            }
          };
        }
        return msg;
      });

      saveStoredMessages(updatedMessages);

      sendChatMessage(
        activeContact.id,
        'usr_owner_1',
        `✓ Reçu N° ${targetRef} validé et contresigné par le locataire.`
      );

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
            {filteredContacts.map((contact) => {
              const isSelected = selectedContactId === contact.id;
              const contactMsgs = (messages || []).filter(
                (m) =>
                  (m.sender_id === currentUserId && m.receiver_id === contact.id) ||
                  (m.sender_id === contact.id && m.receiver_id === currentUserId) ||
                  (m.sender_id === 'usr_owner_1' && m.receiver_id === contact.id) ||
                  (m.sender_id === contact.id && m.receiver_id === 'usr_owner_1')
              );
              const lastMsg = contactMsgs[contactMsgs.length - 1];

              // Nombre de messages non lus spécifiquement reçus de ce contact
              const contactUnreadCount = (messages || []).filter(
                (m) => m.sender_id === contact.id && m.status !== 'read'
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
                  <div className="relative shrink-0">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                    />
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    )}
                  </div>

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
                        {lastMsg ? lastMsg.text : 'Démarrer la conversation...'}
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
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Thread (Scrollable independently) */}
        <div
          className={`${
            showMobileChat ? 'flex' : 'hidden md:flex'
          } flex-1 flex flex-col bg-slate-100/70 dark:bg-slate-900 h-full min-w-0`}
        >
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

              <div className="relative shrink-0">
                <img
                  src={activeContact.avatar}
                  alt={activeContact.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-600/40"
                />
                {activeContact.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                )}
              </div>

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
          <div className="flex-1 p-4 sm:p-6 flex flex-col gap-3.5 overflow-y-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
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
                    <div className="whitespace-pre-line text-xs">{m.text}</div>

                    {/* Media / File Attachment (Point 6) */}
                    {m.attachment && (
                      <div className="mt-2 rounded-xl overflow-hidden">
                        {m.attachment.type === 'image' && (
                          <div className="flex flex-col gap-1">
                            <img
                              src={m.attachment.url}
                              alt={m.attachment.name || 'Photo'}
                              className="rounded-xl max-h-64 max-w-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => window.open(m.attachment!.url, '_blank')}
                            />
                            {m.attachment.size && (
                              <span className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'} font-mono`}>
                                {m.attachment.name} • {m.attachment.size}
                              </span>
                            )}
                          </div>
                        )}

                        {m.attachment.type === 'document' && (
                          <a
                            href={m.attachment.url}
                            download={m.attachment.name || 'document'}
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
                              <span className="text-xs font-bold truncate">{m.attachment.name || 'Document joint'}</span>
                              <span className={`text-[10px] font-mono ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                {m.attachment.size || 'Fichier PDF'}
                              </span>
                            </div>
                            <Download className="w-4 h-4 shrink-0" />
                          </a>
                        )}

                        {m.attachment.type === 'audio' && (
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
                            <audio controls src={m.attachment.url} className="h-8 max-w-[200px] sm:max-w-[240px]" />
                            {m.attachment.duration && (
                              <span className={`text-[10px] font-mono shrink-0 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                {m.attachment.duration}s
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quittance Attachment Card */}
                    {m.quittance && (
                      <div className="mt-3 bg-white text-slate-900 rounded-2xl p-4 border border-slate-200 shadow-md flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                              <Receipt className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900">
                                Quittance de Loyer Certifiée
                              </span>
                              <span className="text-[10px] text-blue-600 font-mono font-bold">
                                N° {m.quittance.receiptNumber}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Validée
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Montant :</span>
                            <span className="font-black text-blue-700">{formatFCFA(m.quittance.amount)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Période :</span>
                            <span className="font-bold text-slate-800">{m.quittance.periodCovered}</span>
                          </div>
                        </div>

                        {/* 3 Actions for Quittance: Consulter / Valider / Télécharger */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewingQuittance(m.quittance!)}
                            className="py-2 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                            title="Consulter le reçu"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">Consulter</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSigningTarget({
                                type: 'quittance',
                                quittance: m.quittance,
                                role: userRole === 'locataire' ? 'locataire' : 'proprietaire'
                              });
                              setIsSignatureModalOpen(true);
                            }}
                            className={`py-2 px-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 ${
                              m.quittance.tenantSignatureUrl
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                            title="Valider / Contresigner"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{m.quittance.tenantSignatureUrl ? 'Validé ✓' : 'Valider'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadQuittancePdfFromAttachment(m.quittance!)}
                            className="py-2 px-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                            title="Télécharger la quittance PDF"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Télécharger</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Contract Attachment Card */}
                    {m.contract && (
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
                                N° {m.contract.contractNumber}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                              m.contract.ownerSigned && m.contract.tenantSigned
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {m.contract.ownerSigned && m.contract.tenantSigned ? 'Certifié & Signé' : 'En attente signature'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-900">{m.contract.propertyTitle}</span>
                          <span className="text-slate-500 text-[10px]">{m.contract.propertyAddress}</span>
                          <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                            <span>Loyer : <strong>{formatFCFA(m.contract.rentAmount)}</strong></span>
                            <span>Caution : <strong>{formatFCFA(m.contract.cautionAmount)}</strong></span>
                          </div>
                        </div>

                        {/* 3 Actions for Contract: Consulter / Signer / Télécharger */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewingContract(m.contract!)}
                            className="py-2 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                            title="Consulter les clauses du contrat"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">Consulter</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (m.contract!.tenantSigned && m.contract!.ownerSigned) {
                                alert("Ce contrat de bail est déjà entièrement signé et certifié.");
                              } else {
                                setSigningTarget({
                                  type: 'contract',
                                  contract: m.contract,
                                  role: userRole === 'locataire' ? 'locataire' : 'proprietaire'
                                });
                                setIsSignatureModalOpen(true);
                              }
                            }}
                            className={`py-2 px-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 ${
                              m.contract!.tenantSigned && m.contract!.ownerSigned
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title="Signer électroniquement"
                          >
                            <PenTool className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {m.contract!.tenantSigned && m.contract!.ownerSigned ? 'Signé ✓' : 'Signer'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await generateOfficialContractPdf({
                                contractNumber: m.contract!.contractNumber,
                                isAgency: userRole === 'agence',
                                ownerName: m.contract!.ownerName,
                                tenantName: m.contract!.tenantName,
                                propertyTitle: m.contract!.propertyTitle,
                                propertyAddress: m.contract!.propertyAddress,
                                durationMonths: m.contract!.durationMonths,
                                startDate: m.contract!.startDate,
                                rent: m.contract!.rentAmount,
                                cautionMonths: 2,
                                chargesAmount: 5000,
                                dueDay: 5,
                                leaseType: (m.contract as any)?.usage_destination || 'habitation',
                                usageDestination: (m.contract as any)?.usage_destination || 'habitation',
                                authorizedActivity: (m.contract as any)?.authorized_activity || ''
                              });
                            }}
                            className="py-2 px-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                            title="Télécharger l'exemplaire officiel PDF"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Télécharger</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Restitution de Caution Card (Point 2) */}
                    {m.restitution && (
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
                                N° {m.restitution.receiptNumber}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Caution restituée
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <p className="font-semibold text-slate-800 leading-relaxed">
                            Votre caution concernant le contrat <strong className="text-blue-700 font-mono">{m.restitution.contractNumber}</strong> a été restituée.
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-medium">Montant restitué :</span>
                            <span className="font-black text-emerald-700 text-xs">{formatFCFA(m.restitution.amountRestituted)}</span>
                          </div>
                          {m.restitution.deductionAmount > 0 && (
                            <div className="flex items-center justify-between text-[10px] text-amber-800">
                              <span>Retenue appliquée : {formatFCFA(m.restitution.deductionAmount)}</span>
                              <span className="italic truncate max-w-[160px]">{m.restitution.deductionReason}</span>
                            </div>
                          )}
                        </div>

                        {/* Action: Voir le reçu */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleDownloadRestitutionPdf(m.restitution!)}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Voir le reçu</span>
                          </button>
                        </div>
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
                                  propertyAddress: 'Cocody Riviera 3, Abidjan',
                                  rentAmount: 75000,
                                  cautionAmount: 150000,
                                  durationMonths: 12,
                                  startDate: '01/10/2026',
                                  ownerName: user?.user_metadata?.full_name || "Bailleur",
                                  tenantName: activeContact.name,
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
                    {activeContact.name} écrit...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

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
                  await generateOfficialContractPdf({
                    contractNumber: previewingContract.contractNumber,
                    isAgency: userRole === 'agence',
                    ownerName: previewingContract.ownerName,
                    tenantName: previewingContract.tenantName,
                    propertyTitle: previewingContract.propertyTitle,
                    propertyAddress: previewingContract.propertyAddress,
                    durationMonths: previewingContract.durationMonths,
                    startDate: previewingContract.startDate,
                    rent: previewingContract.rentAmount,
                    cautionMonths: 2,
                    chargesAmount: 5000,
                    dueDay: 5,
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
            : (activeContact.name || "Locataire")
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

      {/* MODAL: AUDIO CALL (Point 8 & Voix Réelle) */}
      {activeAudioCall && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-8 shadow-2xl flex flex-col items-center text-center text-white relative">
            <div className="relative mb-4">
              <img
                src={activeContact.avatar}
                alt={activeContact.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500/50 shadow-2xl shadow-emerald-500/20"
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow" />
            </div>

            <h3 className="text-xl font-black text-white">{activeContact.name}</h3>
            <span className="text-xs text-slate-400 mt-1">{activeContact.propertyTitle}</span>

            <div className="mt-3 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-emerald-400 font-mono text-xs font-black flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {Math.floor(activeAudioCall.seconds / 60).toString().padStart(2, '0')}:
                {(activeAudioCall.seconds % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-[10px] text-slate-300 font-medium">Appel Vocal Sécurisé</span>
            </div>

            {/* Live Audio Equalizer Waveform */}
            <div className="flex items-center gap-1.5 my-6 h-14">
              {[25, 55, 40, 85, 70, 95, 75, 45, 80, 35, 65].map((baseH, i) => {
                const dynamicVol = activeAudioCall.isMuted
                  ? 0
                  : Math.max(18, (audioVolume * 1.4) + Math.sin((activeAudioCall.seconds * 4) + i) * 16);
                const finalH = Math.min(54, Math.max(8, (baseH * (dynamicVol / 100))));
                return (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-150 ${
                      activeAudioCall.isMuted ? 'bg-slate-700' : 'bg-emerald-400 shadow-sm shadow-emerald-400/30'
                    }`}
                    style={{ height: `${finalH}px` }}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2 mb-4">
              {activeAudioCall.isMuted ? (
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  <MicOff className="w-3.5 h-3.5" /> Votre micro est coupé
                </span>
              ) : audioVolume > 15 ? (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Voix en direct détectée
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">Parlez dans votre microphone...</span>
              )}
            </div>

            <div className="flex items-center justify-center gap-5 w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  const newMuted = !activeAudioCall.isMuted;
                  if (audioStreamRef.current) {
                    audioStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
                  }
                  setActiveAudioCall({ ...activeAudioCall, isMuted: newMuted });
                }}
                className={`p-4 rounded-full transition-all active:scale-95 shadow-md ${
                  activeAudioCall.isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title={activeAudioCall.isMuted ? 'Réactiver le micro' : 'Couper le micro'}
              >
                {activeAudioCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEndAudioCall(e);
                }}
                className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 transition-all active:scale-95 cursor-pointer z-30"
                title="Raccrocher"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={() => setActiveAudioCall({ ...activeAudioCall, isSpeaker: !activeAudioCall.isSpeaker })}
                className={`p-4 rounded-full transition-all active:scale-95 shadow-md ${
                  activeAudioCall.isSpeaker ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Haut-parleur"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIDEO CALL (Caméra Réelle Deux Parties + PiP Interactif) */}
      {activeVideoCall && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full h-[88vh] max-h-[620px] min-h-[440px] shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Top Bar Overlay */}
            <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={activeContact.avatar}
                  alt={activeContact.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow shrink-0"
                />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-black text-white">{activeContact.name}</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Appel vidéo HD chiffré LocaTrust
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white font-mono text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {Math.floor(activeVideoCall.seconds / 60).toString().padStart(2, '0')}:
                    {(activeVideoCall.seconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>

            {/* Camera Notification Notice if permission issue */}
            {cameraError && (
              <div className="absolute top-16 inset-x-4 z-30 p-2.5 rounded-xl bg-amber-500/90 text-slate-950 text-xs font-bold text-center backdrop-blur-sm shadow-lg flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Main Video Viewport (Remote Contact by default, or Local User if Swapped) */}
            <div className="flex-1 w-full h-full bg-slate-950 flex items-center justify-center relative overflow-hidden">
              {!isVideoSwapped ? (
                /* Vue Principale : Contact Distant (Bailleur ou Locataire en direct) */
                <video
                  ref={(node) => {
                    remoteVideoRef.current = node;
                    if (node && remoteStreamRef.current && node.srcObject !== remoteStreamRef.current) {
                      node.srcObject = remoteStreamRef.current;
                      node.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  controls={false}
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Vue Principale inversée : Caméra Physique de l'utilisateur */
                activeVideoCall.isCamOff ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400 animate-fadeIn p-6 text-center">
                    <CameraOff className="w-16 h-16 text-rose-500" />
                    <span className="text-sm font-bold text-slate-200">Votre caméra est désactivée</span>
                    <span className="text-xs text-slate-500">Cliquez sur « Activer caméra » pour réactiver votre flux</span>
                  </div>
                ) : (
                  <video
                    ref={(node) => {
                      localVideoRef.current = node;
                      if (node && localStreamRef.current && node.srcObject !== localStreamRef.current) {
                        node.srcObject = localStreamRef.current;
                        node.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    controls={false}
                    style={{ transform: activeVideoCall.isFrontCam ? 'scaleX(-1)' : 'none' }}
                    className="w-full h-full object-cover"
                  />
                )
              )}

              {/* PiP Viewport (Small overlay in corner) — Cliquer pour permuter */}
              <div
                onClick={() => setIsVideoSwapped(!isVideoSwapped)}
                className="absolute bottom-4 right-4 w-32 h-44 sm:w-36 sm:h-48 rounded-2xl bg-slate-900/90 backdrop-blur-sm border-2 border-slate-700/80 shadow-2xl overflow-hidden cursor-pointer group hover:border-blue-500 transition-all z-20"
                title="Cliquer pour permuter l'affichage"
              >
                {!isVideoSwapped ? (
                  /* PiP : Caméra Physique de l'utilisateur en temps réel */
                  activeVideoCall.isCamOff ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-slate-400 bg-slate-950">
                      <CameraOff className="w-6 h-6 text-rose-400 mb-1" />
                      <span className="text-[10px] font-bold">Caméra coupée</span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full">
                      <video
                        ref={(node) => {
                          localVideoRef.current = node;
                          if (node && localStreamRef.current && node.srcObject !== localStreamRef.current) {
                            node.srcObject = localStreamRef.current;
                            node.play().catch(() => {});
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        controls={false}
                        style={{ transform: activeVideoCall.isFrontCam ? 'scaleX(-1)' : 'none' }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-bold text-emerald-400 flex items-center gap-1 shadow">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Vous (En direct)</span>
                      </div>
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                        <FlipHorizontal className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </div>
                  )
                ) : (
                  /* PiP : Contact Distant */
                  <div className="relative w-full h-full">
                    <video
                      ref={(node) => {
                        remoteVideoRef.current = node;
                        if (node && remoteStreamRef.current && node.srcObject !== remoteStreamRef.current) {
                          node.srcObject = remoteStreamRef.current;
                          node.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      controls={false}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-bold text-blue-400 flex items-center gap-1 shadow">
                      <span>{activeContact.name.split(' ')[0]}</span>
                    </div>
                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                      <FlipHorizontal className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Controls — Toujours visibles et interactifs */}
            <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 flex items-center justify-center gap-2 sm:gap-4 z-30 shrink-0">
              {/* 1. Bouton Couper/Réactiver le micro */}
              <button
                type="button"
                onClick={handleToggleMute}
                className={`p-3 sm:px-3.5 sm:py-2.5 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-md ${
                  activeVideoCall.isMuted
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={activeVideoCall.isMuted ? 'Réactiver le microphone' : 'Couper le microphone'}
              >
                {activeVideoCall.isMuted ? (
                  <MicOff className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
                <span className="hidden md:inline">
                  {activeVideoCall.isMuted ? 'Micro coupé' : 'Micro actif'}
                </span>
              </button>

              {/* 2. Bouton Éteindre/Réactiver la caméra */}
              <button
                type="button"
                onClick={handleToggleCam}
                className={`p-3 sm:px-3.5 sm:py-2.5 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-md ${
                  activeVideoCall.isCamOff
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={activeVideoCall.isCamOff ? 'Réactiver la caméra' : 'Éteindre la caméra'}
              >
                {activeVideoCall.isCamOff ? (
                  <CameraOff className="w-4 h-4 text-white" />
                ) : (
                  <Camera className="w-4 h-4 text-blue-400" />
                )}
                <span className="hidden md:inline">
                  {activeVideoCall.isCamOff ? 'Caméra coupée' : 'Caméra active'}
                </span>
              </button>

              {/* 3. Bouton Retourner la caméra (Avant/Arrière sur mobile) */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="p-3 sm:px-3.5 sm:py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-md"
                title="Basculer caméra avant / arrière"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">
                  {activeVideoCall.isFrontCam ? 'Cam. Arrière' : 'Cam. Avant'}
                </span>
              </button>

              {/* 4. Bouton Inverser l'affichage (Swap PiP & Main) */}
              <button
                type="button"
                onClick={() => setIsVideoSwapped(!isVideoSwapped)}
                className={`p-3 sm:px-3.5 sm:py-2.5 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-md ${
                  isVideoSwapped
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Inverser les vues principale et miniature"
              >
                <FlipHorizontal className="w-4 h-4 text-cyan-400" />
                <span className="hidden md:inline">Inverser la vue</span>
              </button>

              {/* 5. Bouton Raccrocher */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEndVideoCall(e);
                }}
                className="px-5 py-2.5 sm:px-6 sm:py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-xl shadow-red-600/40 transition-all active:scale-95 flex items-center gap-2 cursor-pointer z-30"
                title="Terminer l'appel vidéo"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Raccrocher</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
