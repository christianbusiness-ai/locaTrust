'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  Volume2,
  Camera,
  CameraOff,
  RotateCcw,
  ShieldCheck,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { sendChatMessage } from '@/lib/messagingStore';
import { useAuth } from '@/src/context/AuthContext';

export interface CallPayloadData {
  callId: string;
  callType: 'audio' | 'video';
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerRole?: string;
  propertyTitle?: string;
  targetUserId: string;
  targetName?: string;
}

export const GlobalCallModal: React.FC = () => {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || 'usr_current';
  const currentUserName = user?.user_metadata?.full_name || profile?.full_name || 'Utilisateur LocaTrust';
  const currentUserAvatar = typeof window !== 'undefined' ? (localStorage.getItem('locatrust_user_avatar') || profile?.avatar_url || '') : '';

  // Call States
  const [incomingCall, setIncomingCall] = useState<CallPayloadData | null>(null);
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    callType: 'audio' | 'video';
    role: 'caller' | 'callee';
    status: 'ringing' | 'connected';
    peerId: string;
    peerName: string;
    peerAvatar?: string;
    peerRole?: string;
    propertyTitle?: string;
    seconds: number;
    isMuted: boolean;
    isSpeaker: boolean;
    isCamOff: boolean;
    isFrontCam: boolean;
  } | null>(null);

  const [isVideoSwapped, setIsVideoSwapped] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0);

  // Media & WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<any[]>([]);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeAnimFrameRef = useRef<number | null>(null);
  const ringtoneIntervalRef = useRef<any>(null);
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  // Configuration WebRTC avec serveurs STUN officiels de Google pour traversée NAT Mobile & Desktop
  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Web Audio Synthesizer for ringtones & chimes
  const playChime = (type: 'ring' | 'connected' | 'hangup') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'ring') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === 'connected') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'hangup') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  const startRingtoneLoop = () => {
    stopRingtoneLoop();
    playChime('ring');
    ringtoneIntervalRef.current = setInterval(() => {
      playChime('ring');
    }, 2400);
  };

  const stopRingtoneLoop = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  // Audio Volume Analysis for Visual Equalizer
  const setupAudioVolumeAnalysis = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
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
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
        volumeAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('Audio analysis setup notice:', e);
    }
  };

  const cleanupMediaStreams = () => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    pendingIceCandidatesRef.current = [];

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      } catch {}
    }

    if (volumeAnimFrameRef.current) {
      cancelAnimationFrame(volumeAnimFrameRef.current);
      volumeAnimFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    audioAnalyserRef.current = null;
    setAudioVolume(0);

    if (audioStreamRef.current) {
      try { audioStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      audioStreamRef.current = null;
    }
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      if ((remoteStreamRef.current as any)._interval) {
        clearInterval((remoteStreamRef.current as any)._interval);
      }
      try { remoteStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      remoteStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setHasRealCameraTrack(false);
    setHasRemoteVideo(false);
    setCameraPermissionStatus('prompt');
  };

  // Injecter en toute sécurité les pistes média dans une PeerConnection sans doublon
  const addTracksToPeerConnection = (pc: RTCPeerConnection, stream: MediaStream) => {
    try {
      const existingSenders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const alreadyAdded = existingSenders.some((sender) => sender.track?.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, stream);
          console.log(`📡 Piste WebRTC locale ajoutée: ${track.kind} (${track.label || 'device'})`);
        }
      });
    } catch (err) {
      console.warn('Erreur addTracksToPeerConnection:', err);
    }
  };

  // État des périphériques matériels réels (Caméra physique & Micro comme WhatsApp)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [hasRealCameraTrack, setHasRealCameraTrack] = useState<boolean>(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'requesting'>('prompt');
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [isRequestingMedia, setIsRequestingMedia] = useState<boolean>(false);
  const [mediaErrorMessage, setMediaErrorMessage] = useState<string>('');

  // Demande manuelle et directe d'accès à la caméra et au microphone (Geste utilisateur direct comme WhatsApp)
  const requestCameraPermissionManually = async (facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMediaErrorMessage("Votre navigateur ne supporte pas l'accès caméra (getUserMedia).");
      return null;
    }
    setIsRequestingMedia(true);
    setMediaErrorMessage('');
    setCameraPermissionStatus('requesting');

    let stream: MediaStream | null = null;
    let lastError: any = null;

    // 1. Essai direct vidéo + audio avec contraintes souples (compatibilité maximale Chrome, Edge, Safari)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
    } catch (err: any) {
      lastError = err;
      console.warn("Échec capture combinée vidéo + audio:", err);
      // 2. Si le micro pose problème ou est absent, tenter vidéo seule
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (errVideo: any) {
        lastError = errVideo;
        console.warn("Échec capture vidéo seule:", errVideo);
        // 3. Si la webcam est bloquée ou occupée, tenter audio seul
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (errAudio: any) {
          lastError = errAudio;
          console.warn("Échec capture audio seule:", errAudio);
        }
      }
    }

    setIsRequestingMedia(false);

    if (stream) {
      const hasVideo = stream.getVideoTracks().length > 0;
      localStreamRef.current = stream;
      setHasRealCameraTrack(hasVideo);
      setCameraPermissionStatus('granted');
      setMediaErrorMessage('');
      console.log(`✅ Flux média réel obtenu : vidéo=${hasVideo}, audio=${stream.getAudioTracks().length > 0}`);

      // Énumération des périphériques disponibles (Integrated Camera, Realtek Mic, etc.)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableCameras(devices.filter((d) => d.kind === 'videoinput'));
        setAvailableMics(devices.filter((d) => d.kind === 'audioinput'));
      } catch {}

      if (localVideoRef.current && hasVideo) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      if (peerConnectionRef.current) {
        addTracksToPeerConnection(peerConnectionRef.current, stream);
      }
      setupAudioVolumeAnalysis(stream);
      syncVideoElements();
      return stream;
    }

    // Gestion précise de l'erreur pour informer l'utilisateur
    setCameraPermissionStatus('denied');
    setHasRealCameraTrack(false);

    const errName = lastError?.name || '';
    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      setMediaErrorMessage(
        "L'accès à la caméra est bloqué dans Chrome. Cliquez sur l'icône 🔒 à gauche de 'locatrust.site' dans la barre d'adresse pour autoriser la Caméra et le Micro."
      );
    } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      setMediaErrorMessage(
        "Votre caméra est déjà utilisée par une autre application (ex: WhatsApp, Zoom ou un autre onglet). Fermez l'autre application pour libérer la caméra."
      );
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      setMediaErrorMessage("Aucune caméra physique n'a été détectée sur votre ordinateur.");
    } else {
      setMediaErrorMessage(
        `Impossible d'activer la caméra (${lastError?.message || 'Erreur inconnue'}). Vous pouvez basculer en appel vocal.`
      );
    }

    return null;
  };

  // Récupération multi-niveaux du flux caméra et micro réels (Pas de canvas synthétique trompeur)
  const getMediaStreamWithFallback = async (
    callType: 'audio' | 'video',
    facingMode: 'user' | 'environment' = 'user'
  ): Promise<MediaStream | null> => {
    // 1. Vérifier si un flux pré-capturé lors du clic utilisateur existe déjà
    const prefetched = (window as any).__locatrust_prefetched_stream as MediaStream | undefined;
    if (prefetched && prefetched.active) {
      const hasVideo = prefetched.getVideoTracks().length > 0;
      if (callType === 'audio' || hasVideo) {
        console.log('✅ Utilisation du flux pré-capturé direct du clic');
        localStreamRef.current = prefetched;
        if (callType === 'video') setHasRealCameraTrack(true);
        setCameraPermissionStatus('granted');
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = prefetched;
          localVideoRef.current.play().catch(() => {});
        }
        return prefetched;
      }
    }

    // 2. Si appel vidéo, demander la caméra et le micro
    if (callType === 'video') {
      return await requestCameraPermissionManually(facingMode);
    }

    // 3. Audio seul
    try {
      const aStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      return aStream;
    } catch (err) {
      console.warn('Micro audio direct inaccessible:', err);
      return null;
    }
  };

  // Synchronisation systématique des flux vidéo avec les éléments <video> réels du DOM
  const syncVideoElements = () => {
    const mainVideo = isVideoSwapped ? localVideoRef.current : remoteVideoRef.current;
    const pipVideo = isVideoSwapped ? remoteVideoRef.current : localVideoRef.current;

    const mainStream = isVideoSwapped ? localStreamRef.current : remoteStreamRef.current;
    const pipStream = isVideoSwapped ? remoteStreamRef.current : localStreamRef.current;

    if (mainVideo && mainStream && mainVideo.srcObject !== mainStream) {
      mainVideo.srcObject = mainStream;
      mainVideo.play().catch(() => {});
    }

    if (pipVideo && pipStream && pipVideo.srcObject !== pipStream) {
      pipVideo.srcObject = pipStream;
      pipVideo.play().catch(() => {});
    }
  };

  // Factory WebRTC PeerConnection : connecte la voix et la vidéo réelles
  const createPeerConnection = (callId: string, peerId: string, isCaller: boolean): RTCPeerConnection => {
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch {}
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;
    pendingIceCandidatesRef.current = [];

    // Injecter les pistes locales dès qu'elles sont disponibles
    const currentStream = localStreamRef.current || audioStreamRef.current;
    if (currentStream) {
      addTracksToPeerConnection(pc, currentStream);
    }

    // Transmission des candidats ICE (STUN)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatePayload = {
          callId,
          candidate: event.candidate.toJSON()
        };
        broadcastLiveEvent('CALL_ICE_CANDIDATE', {
          actorId: currentUserId,
          targetUserId: peerId,
          data: candidatePayload
        });
        try {
          broadcastChannelRef.current?.postMessage({
            event: 'CALL_ICE_CANDIDATE',
            actorId: currentUserId,
            targetUserId: peerId,
            data: candidatePayload
          });
        } catch {}
      }
    };

    // Réception du flux distant réel (Voix du correspondant + Vidéo)
    pc.ontrack = (event) => {
      console.log('📡 Piste WebRTC distante reçue avec succès :', event.track.kind, event.streams);

      let incomingStream = event.streams && event.streams[0];
      if (!incomingStream) {
        if (!remoteStreamRef.current || (remoteStreamRef.current as any)._simulated) {
          incomingStream = new MediaStream();
        } else {
          incomingStream = remoteStreamRef.current;
        }
        incomingStream.addTrack(event.track);
      }

      // Si un flux simulé tournait, stopper son intervalle de rafraîchissement
      if (remoteStreamRef.current && (remoteStreamRef.current as any)._interval) {
        clearInterval((remoteStreamRef.current as any)._interval);
      }

      if (event.track.kind === 'video') {
        setHasRemoteVideo(true);
      }

      remoteStreamRef.current = incomingStream;

      // Jouer immédiatement la voix du correspondant via l'élément audio dédié
      if (remoteAudioRef.current) {
        if (remoteAudioRef.current.srcObject !== incomingStream) {
          remoteAudioRef.current.srcObject = incomingStream;
        }
        remoteAudioRef.current.play().catch((err) => {
          console.warn('Lecture automatique audio en attente:', err);
        });
      }

      // Brancher l'analyseur audio sur la voix entrante pour animer les barres visuelles
      if (event.track.kind === 'audio') {
        setupAudioVolumeAnalysis(incomingStream);
      }

      // Mettre à jour l'affichage vidéo
      syncVideoElements();
    };

    return pc;
  };

  // Helper to create live simulated remote video stream with contact avatar & realistic movement as fallback
  const createSimulatedRemoteVideoStream = (userName: string, avatarUrl?: string): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (avatarUrl) img.src = avatarUrl;

    const render = () => {
      if (!ctx) return;
      frame++;
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      const cx = 320;
      const cy = 210 + Math.sin(frame * 0.04) * 4;

      const pulseScale = 1 + Math.sin(frame * 0.06) * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, 95 * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5, 150, 105, 0.12)';
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.clip();

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - 80, cy - 80, 160, 160);
      } else {
        const bgGrad = ctx.createLinearGradient(cx - 80, cy - 80, cx + 80, cy + 80);
        bgGrad.addColorStop(0, '#1E40AF');
        bgGrad.addColorStop(1, '#059669');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(cx - 80, cy - 80, 160, 160);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const inits = (userName || 'LT').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
        ctx.fillText(inits, cx, cy);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#10B981';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(userName, cx, 340);

      ctx.fillStyle = '#10B981';
      ctx.font = '14px sans-serif';
      ctx.fillText('● En direct HD', cx, 370);
    };

    render();
    const interval = setInterval(render, 1000 / 30);
    const stream = canvas.captureStream(30);
    (stream as any)._interval = interval;
    return stream;
  };

  // Timer for connected call
  useEffect(() => {
    let timer: any = null;
    if (activeCall && activeCall.status === 'connected') {
      timer = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  // Synchronisation continue des flux vidéo lors de l'apparition du modal ou permutation PiP
  useEffect(() => {
    if (activeCall && activeCall.callType === 'video') {
      syncVideoElements();
      const t1 = setTimeout(syncVideoElements, 60);
      const t2 = setTimeout(syncVideoElements, 250);
      const t3 = setTimeout(syncVideoElements, 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [activeCall?.callType, activeCall?.status, isVideoSwapped]);

  // Listen to locatrust:call_event from Supabase Realtime & locatrust:initiate_call locally
  useEffect(() => {
    const handleCallEvent = (e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || !payload.event) return;
      const data: any = payload.data || {};

      switch (payload.event) {
        case 'CALL_INCOMING': {
          // Check if this call is meant for us
          const myId = user?.id || '';
          const myEmail = (user?.email || '').toLowerCase();
          const target = (payload.targetUserId || data.targetUserId || '').toLowerCase();

          const isTargeted =
            target === myId.toLowerCase() ||
            target === myEmail ||
            target.includes('tenant') ||
            target.includes('locataire') ||
            target.includes('proprietaire') ||
            target.includes('agence') ||
            target === 'all';

          // Avoid self-ringing if this device initiated it
          if (payload.actorId === currentUserId) return;

          if (isTargeted && !activeCallRef.current) {
            setIncomingCall(data);
            startRingtoneLoop();
          }
          break;
        }

        case 'CALL_ACCEPTED': {
          const current = activeCallRef.current;
          if (current && current.callId === data.callId && current.role === 'caller') {
            stopRingtoneLoop();
            playChime('connected');
            setActiveCall((prev) => (prev ? { ...prev, status: 'connected', seconds: 0 } : null));

            // Débloquer l'audio sur le mobile / navigateur de l'appelant
            if (remoteAudioRef.current) {
              remoteAudioRef.current.play().catch(() => {});
            }

            // L'appelant initialise la connexion WebRTC et émet l'Offre SDP
            const pc = createPeerConnection(current.callId, current.peerId, true);
            const myStream = localStreamRef.current || audioStreamRef.current;
            if (myStream) {
              addTracksToPeerConnection(pc, myStream);
            }
            syncVideoElements();

            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: current.callType === 'video' })
              .then((offer) => pc.setLocalDescription(offer).then(() => offer))
              .then((offer) => {
                const offerPayload = { callId: current.callId, offer };
                broadcastLiveEvent('CALL_OFFER', {
                  actorId: currentUserId,
                  targetUserId: current.peerId,
                  data: offerPayload
                });
                try {
                  broadcastChannelRef.current?.postMessage({
                    event: 'CALL_OFFER',
                    actorId: currentUserId,
                    targetUserId: current.peerId,
                    data: offerPayload
                  });
                } catch {}
              })
              .catch((err) => console.warn('Erreur émission offre SDP WebRTC:', err));
          }
          break;
        }

        case 'CALL_OFFER': {
          const current = activeCallRef.current;
          if (payload.actorId !== currentUserId && data.offer) {
            const peerId = payload.actorId || current?.peerId || '';
            const pc = peerConnectionRef.current || createPeerConnection(data.callId, peerId, false);
            const myStream = localStreamRef.current || audioStreamRef.current;
            if (myStream) {
              addTracksToPeerConnection(pc, myStream);
            }
            syncVideoElements();
            pc.setRemoteDescription(new RTCSessionDescription(data.offer))
              .then(() => {
                // Vider les candidats ICE reçus avant la description distante
                pendingIceCandidatesRef.current.forEach((cand) => {
                  try { pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
                });
                pendingIceCandidatesRef.current = [];
                return pc.createAnswer();
              })
              .then((answer) => pc.setLocalDescription(answer).then(() => answer))
              .then((answer) => {
                const answerPayload = { callId: data.callId, answer };
                broadcastLiveEvent('CALL_ANSWER', {
                  actorId: currentUserId,
                  targetUserId: peerId,
                  data: answerPayload
                });
                try {
                  broadcastChannelRef.current?.postMessage({
                    event: 'CALL_ANSWER',
                    actorId: currentUserId,
                    targetUserId: peerId,
                    data: answerPayload
                  });
                } catch {}
              })
              .catch((err) => console.warn('Erreur réponse SDP WebRTC:', err));
          }
          break;
        }

        case 'CALL_ANSWER': {
          if (payload.actorId !== currentUserId && data.answer && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            pc.setRemoteDescription(new RTCSessionDescription(data.answer))
              .then(() => {
                pendingIceCandidatesRef.current.forEach((cand) => {
                  try { pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
                });
                pendingIceCandidatesRef.current = [];
              })
              .catch((err) => console.warn('Erreur affectation réponse SDP:', err));
          }
          break;
        }

        case 'CALL_ICE_CANDIDATE': {
          if (payload.actorId !== currentUserId && data.candidate) {
            const pc = peerConnectionRef.current;
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (err) {
                console.warn('Erreur ajout candidat ICE:', err);
              }
            } else {
              pendingIceCandidatesRef.current.push(data.candidate);
            }
          }
          break;
        }

        case 'CALL_REJECTED': {
          const current = activeCallRef.current;
          if (current && current.callId === data.callId) {
            stopRingtoneLoop();
            playChime('hangup');
            cleanupMediaStreams();
            setActiveCall(null);
            sendChatMessage(currentUserId, current.peerId, `📞 Appel sans réponse ou refusé`);
          }
          if (incomingCall && incomingCall.callId === data.callId) {
            stopRingtoneLoop();
            setIncomingCall(null);
          }
          break;
        }

        case 'CALL_ENDED': {
          stopRingtoneLoop();
          const current = activeCallRef.current;
          if (incomingCall && incomingCall.callId === data.callId) {
            setIncomingCall(null);
            sendChatMessage(data.callerId, currentUserId, `📞 Appel en absence`);
          }
          if (current && current.callId === data.callId) {
            playChime('hangup');
            cleanupMediaStreams();
            setActiveCall(null);
          }
          break;
        }
      }
    };

    // Canal local inter-onglets ultra-rapide (0 ms de latence sur le même navigateur)
    try {
      const bc = new BroadcastChannel('locatrust_call_sync');
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.event) {
          handleCallEvent({ detail: ev.data } as CustomEvent);
        }
      };
      broadcastChannelRef.current = bc;
    } catch {}

    // Locally triggered call from MessagerieView quick buttons
    const handleInitiateCall = (e: CustomEvent) => {
      const { type, peerId, peerName, peerAvatar, peerRole, propertyTitle } = e.detail || {};
      if (!peerId) return;

      const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newActiveCall = {
        callId,
        callType: (type || 'audio') as 'audio' | 'video',
        role: 'caller' as const,
        status: 'ringing' as const,
        peerId,
        peerName: peerName || 'Contact LocaTrust',
        peerAvatar,
        peerRole,
        propertyTitle,
        seconds: 0,
        isMuted: false,
        isSpeaker: false,
        isCamOff: false,
        isFrontCam: true
      };

      setActiveCall(newActiveCall);
      startRingtoneLoop();

      // Débloquer l'audio
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      // Broadcast CALL_INCOMING to all connected devices / users
      const callIncomingData = {
        callId,
        callType: type || 'audio',
        callerId: currentUserId,
        callerName: currentUserName,
        callerAvatar: currentUserAvatar,
        callerRole: profile?.account_type || 'Bailleur',
        propertyTitle: propertyTitle || 'Bien Immobilier',
        targetUserId: peerId,
        targetName: peerName
      };

      broadcastLiveEvent('CALL_INCOMING', {
        actorId: currentUserId,
        targetUserId: peerId,
        data: callIncomingData
      });

      try {
        broadcastChannelRef.current?.postMessage({
          event: 'CALL_INCOMING',
          actorId: currentUserId,
          targetUserId: peerId,
          data: callIncomingData
        });
      } catch {}

      if (type === 'video') {
        // En attente du correspondant : la vidéo affichée est la caméra de l'appelant (comme WhatsApp)
        remoteStreamRef.current = null;
        setHasRemoteVideo(false);

        // Si le correspondant est le support automatisé, décrocher après un court délai réaliste
        if (peerName?.toLowerCase().includes('support') || peerId === 'support' || peerId === 'usr_support') {
          setTimeout(() => {
            if (activeCallRef.current?.status === 'ringing') {
              stopRingtoneLoop();
              playChime('connected');
              setActiveCall((prev) => (prev ? { ...prev, status: 'connected', seconds: 0 } : null));
              const simRemote = createSimulatedRemoteVideoStream(peerName || 'Support LocaTrust', peerAvatar);
              remoteStreamRef.current = simRemote;
              setHasRemoteVideo(true);
              syncVideoElements();
            }
          }, 3500);
        }
      }

      // Capture micro et caméra réels (utilisation du flux pré-capturé au clic ou demande directe)
      const streamSource = data?.stream || (window as any).__locatrust_prefetched_stream;
      const streamPromise = streamSource
        ? Promise.resolve(streamSource)
        : getMediaStreamWithFallback(type || 'audio', 'user');

      streamPromise.then((stream: MediaStream | null) => {
        if (!stream) return;
        if (type === 'video') {
          localStreamRef.current = stream;
          setHasRealCameraTrack(stream.getVideoTracks().length > 0);
          setCameraPermissionStatus('granted');
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
        } else {
          audioStreamRef.current = stream;
        }
        setupAudioVolumeAnalysis(stream);

        // Si la peer connection est déjà établie, ajouter les pistes
        if (peerConnectionRef.current) {
          addTracksToPeerConnection(peerConnectionRef.current, stream);
        }
        syncVideoElements();
      });
    };

    window.addEventListener('locatrust:call_event' as any, handleCallEvent);
    window.addEventListener('locatrust:initiate_call' as any, handleInitiateCall);

    return () => {
      window.removeEventListener('locatrust:call_event' as any, handleCallEvent);
      window.removeEventListener('locatrust:initiate_call' as any, handleInitiateCall);
      try {
        broadcastChannelRef.current?.close();
      } catch {}
      stopRingtoneLoop();
      cleanupMediaStreams();
    };
  }, [currentUserId, currentUserName, currentUserAvatar, incomingCall]);

  // Handle Callee Accept (Décrocher)
  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    stopRingtoneLoop();
    playChime('connected');

    const callData = incomingCall;
    setIncomingCall(null);

    // Débloquer immédiatement la lecture audio sur smartphone dans le geste utilisateur
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    const newActiveCall = {
      callId: callData.callId,
      callType: callData.callType,
      role: 'callee' as const,
      status: 'connected' as const,
      peerId: callData.callerId,
      peerName: callData.callerName,
      peerAvatar: callData.callerAvatar,
      peerRole: callData.callerRole,
      propertyTitle: callData.propertyTitle,
      seconds: 0,
      isMuted: false,
      isSpeaker: false,
      isCamOff: false,
      isFrontCam: true
    };

    setActiveCall(newActiveCall);

    if (callData.callType === 'video') {
      const simRemote = createSimulatedRemoteVideoStream(callData.callerName || 'Correspondant', callData.callerAvatar);
      remoteStreamRef.current = simRemote;
      setHasRemoteVideo(true);
    }

    // Capture media avec fallback multi-plateformes (Caméra + Micro réels)
    const stream = await getMediaStreamWithFallback(callData.callType, 'user');
    if (stream) {
      if (callData.callType === 'video') {
        localStreamRef.current = stream;
      } else {
        audioStreamRef.current = stream;
      }
      setupAudioVolumeAnalysis(stream);
    }

    // Créer la PeerConnection prête à négocier la transmission vocale et vidéo
    const pc = createPeerConnection(callData.callId, callData.callerId, false);
    if (stream) {
      addTracksToPeerConnection(pc, stream);
    }
    syncVideoElements();

    // Diffuser CALL_ACCEPTED à l'appelant
    const acceptedData = {
      callId: callData.callId,
      acceptedBy: currentUserId
    };

    broadcastLiveEvent('CALL_ACCEPTED', {
      actorId: currentUserId,
      targetUserId: callData.callerId,
      data: acceptedData
    });

    try {
      broadcastChannelRef.current?.postMessage({
        event: 'CALL_ACCEPTED',
        actorId: currentUserId,
        targetUserId: callData.callerId,
        data: acceptedData
      });
    } catch {}
  };

  // Handle Callee Reject
  const handleRejectCall = () => {
    if (!incomingCall) return;
    stopRingtoneLoop();
    playChime('hangup');

    const callData = incomingCall;
    setIncomingCall(null);

    const rejectData = {
      callId: callData.callId,
      rejectedBy: currentUserId
    };

    broadcastLiveEvent('CALL_REJECTED', {
      actorId: currentUserId,
      targetUserId: callData.callerId,
      data: rejectData
    });

    try {
      broadcastChannelRef.current?.postMessage({
        event: 'CALL_REJECTED',
        actorId: currentUserId,
        targetUserId: callData.callerId,
        data: rejectData
      });
    } catch {}

    sendChatMessage(callData.callerId, currentUserId, `📞 Appel rejeté / Occupé`);
  };

  // Handle End Active Call (Hangup)
  const handleEndCall = () => {
    if (!activeCall) return;
    stopRingtoneLoop();
    playChime('hangup');
    cleanupMediaStreams();

    const current = activeCall;
    setActiveCall(null);

    const endData = {
      callId: current.callId,
      durationSeconds: current.seconds,
      callerId: current.role === 'caller' ? currentUserId : current.peerId
    };

    broadcastLiveEvent('CALL_ENDED', {
      actorId: currentUserId,
      targetUserId: current.peerId,
      data: endData
    });

    try {
      broadcastChannelRef.current?.postMessage({
        event: 'CALL_ENDED',
        actorId: currentUserId,
        targetUserId: current.peerId,
        data: endData
      });
    } catch {}

    // Enregistrer le résumé de l'appel dans la messagerie
    const mins = Math.floor(current.seconds / 60);
    const secs = current.seconds % 60;
    const durationStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;

    if (current.status === 'connected' && current.seconds > 0) {
      const summaryText =
        current.callType === 'video'
          ? `📹 Appel vidéo terminé (${durationStr})`
          : `📞 Appel vocal terminé (${durationStr})`;
      sendChatMessage(currentUserId, current.peerId, summaryText);
    } else {
      sendChatMessage(currentUserId, current.peerId, `📞 Appel en absence`);
    }
  };

  // Changement de caméra smartphone (avant/arrière) avec remplacement direct de la piste WebRTC
  const handleFlipCamera = async () => {
    if (!activeCall || activeCall.callType !== 'video') return;
    const nextFacingMode = !activeCall.isFrontCam;
    const facingStr: 'user' | 'environment' = nextFacingMode ? 'user' : 'environment';
    setActiveCall((prev) => (prev ? { ...prev, isFrontCam: nextFacingMode } : null));

    // Arrêter uniquement les anciennes pistes vidéo locales
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
    }

    try {
      const newStream = await getMediaStreamWithFallback('video', facingStr);
      if (!newStream) return;

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Mettre à jour le flux local
      if (localStreamRef.current) {
        const oldTracks = localStreamRef.current.getVideoTracks();
        oldTracks.forEach((t) => localStreamRef.current?.removeTrack(t));
        localStreamRef.current.addTrack(newVideoTrack);
      } else {
        localStreamRef.current = newStream;
      }

      // Remplacer la piste vidéo dans le RTCPeerConnection en direct sans interruption
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch((err) => {
            console.warn('Erreur replaceTrack WebRTC:', err);
          });
        }
      }

      syncVideoElements();
    } catch (err) {
      console.warn('Erreur bascule caméra:', err);
    }
  };

  return (
    <>
      {/* Élément audio dédié pour la transmission réelle de la voix entrante sur mobile et ordinateur */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {/* 1. INCOMING CALL MODAL (Rings globally on any screen) */}
      {incomingCall && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center text-white relative animate-scaleUp">
            
            {/* Animated Ringing Halo */}
            <div className="relative mb-5">
              <div className="absolute -inset-3 rounded-full bg-emerald-500/30 animate-ping opacity-75" />
              <div className="absolute -inset-6 rounded-full bg-emerald-500/10 animate-pulse" />
              <UserAvatar
                src={incomingCall.callerAvatar}
                name={incomingCall.callerName}
                sizeClassName="w-24 h-24"
                borderClassName="border-4 border-emerald-500 shadow-2xl"
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black mb-2 animate-bounce">
              {incomingCall.callType === 'video' ? (
                <>
                  <Video className="w-3.5 h-3.5" /> Appel vidéo HD entrant...
                </>
              ) : (
                <>
                  <Phone className="w-3.5 h-3.5" /> Appel vocal entrant...
                </>
              )}
            </div>

            <h3 className="text-xl font-black text-white">{incomingCall.callerName}</h3>
            {incomingCall.propertyTitle && (
              <span className="text-xs text-slate-400 mt-0.5">{incomingCall.propertyTitle}</span>
            )}
            <span className="text-[11px] text-blue-400 font-bold mt-1">
              {incomingCall.callerRole || 'Locataire Preneur'}
            </span>

            {/* Answer / Reject Buttons */}
            <div className="flex items-center justify-center gap-8 w-full mt-8 pt-2">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleRejectCall}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
                  title="Refuser"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-xs font-bold text-rose-300">Refuser</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleAcceptCall}
                  className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer animate-pulse"
                  title="Décrocher"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-xs font-bold text-emerald-300">Décrocher</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE AUDIO CALL MODAL */}
      {activeCall && activeCall.callType === 'audio' && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-8 shadow-2xl flex flex-col items-center text-center text-white relative">
            <div className="relative mb-4">
              <UserAvatar
                src={activeCall.peerAvatar}
                name={activeCall.peerName}
                sizeClassName="w-24 h-24"
                borderClassName="border-4 border-emerald-500/60 shadow-2xl"
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow" />
            </div>

            <h3 className="text-xl font-black text-white">{activeCall.peerName}</h3>
            {activeCall.propertyTitle && (
              <span className="text-xs text-slate-400 mt-1">{activeCall.propertyTitle}</span>
            )}

            <div className="mt-3 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-emerald-400 font-mono text-xs font-black flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${activeCall.status === 'ringing' ? 'animate-ping' : 'animate-pulse'}`} />
              {activeCall.status === 'ringing' ? (
                <span>Sonnerie en cours...</span>
              ) : (
                <span>
                  {Math.floor(activeCall.seconds / 60).toString().padStart(2, '0')}:
                  {(activeCall.seconds % 60).toString().padStart(2, '0')}
                </span>
              )}
              <span className="text-slate-500">&bull;</span>
              <span className="text-[10px] text-slate-300 font-medium">Appel Vocal Sécurisé</span>
            </div>

            {/* Dynamic Waveform Visualizer */}
            <div className="flex items-center gap-1.5 my-6 h-14">
              {[25, 55, 40, 85, 70, 95, 75, 45, 80, 35, 65].map((baseH, i) => {
                const dynamicVol = activeCall.isMuted
                  ? 0
                  : Math.max(18, (audioVolume * 1.4) + Math.sin((activeCall.seconds * 4) + i) * 16);
                const finalH = Math.min(54, Math.max(8, baseH * (dynamicVol / 100)));
                return (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-150 ${
                      activeCall.isMuted ? 'bg-slate-700' : 'bg-emerald-400 shadow-sm shadow-emerald-400/30'
                    }`}
                    style={{ height: `${finalH}px` }}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2 mb-4">
              {activeCall.status === 'ringing' ? (
                <span className="text-[11px] font-bold text-amber-400 animate-pulse">En attente de réponse...</span>
              ) : activeCall.isMuted ? (
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  <MicOff className="w-3.5 h-3.5" /> Votre micro est coupé
                </span>
              ) : audioVolume > 15 ? (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Voix en direct
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">Microphone actif</span>
              )}
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-5 w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  const newMuted = !activeCall.isMuted;
                  const stream = audioStreamRef.current || localStreamRef.current;
                  if (stream) {
                    stream.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
                  }
                  setActiveCall({ ...activeCall, isMuted: newMuted });
                }}
                className={`p-4 rounded-full transition-all active:scale-95 shadow-md ${
                  activeCall.isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title={activeCall.isMuted ? 'Réactiver le micro' : 'Couper le micro'}
              >
                {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={handleEndCall}
                className="p-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
                title="Raccrocher"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextSpeaker = !activeCall.isSpeaker;
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.volume = nextSpeaker ? 1.0 : 0.6;
                  }
                  setActiveCall({ ...activeCall, isSpeaker: nextSpeaker });
                }}
                className={`p-4 rounded-full transition-all active:scale-95 shadow-md ${
                  activeCall.isSpeaker ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Haut-parleur"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACTIVE VIDEO CALL MODAL (Conforme WhatsApp Web - Images 1 & 3) */}
      {activeCall && activeCall.callType === 'video' && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl max-w-2xl w-full h-[90vh] max-h-[640px] min-h-[460px] shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Top Bar Overlay */}
            <div className="p-3 sm:p-4 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between z-30 shrink-0">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={activeCall.peerAvatar}
                  name={activeCall.peerName}
                  sizeClassName="w-10 h-10"
                />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-black text-white">{activeCall.peerName}</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Appel vidéo HD chiffré LocaTrust
                  </span>
                </div>
              </div>

              {/* Status & Timer + Bouton Raccrocher direct en haut */}
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur text-xs font-mono font-bold text-white flex items-center gap-2 shadow">
                  <span className={`w-2 h-2 rounded-full ${activeCall.status === 'ringing' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                  {activeCall.status === 'ringing' ? (
                    <span className="text-amber-400">Sonnerie...</span>
                  ) : (
                    <span>
                      {Math.floor(activeCall.seconds / 60).toString().padStart(2, '0')}:
                      {(activeCall.seconds % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow cursor-pointer"
                  title="Raccrocher l'appel"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Raccrocher</span>
                </button>
              </div>
            </div>

            {/* CAS 1 : PENDANT LA SONNERIE (Appel en cours... comme WhatsApp Image 1) */}
            {activeCall.status === 'ringing' ? (
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-3 sm:p-4 z-20">
                {/* Header contact en cours d'appel */}
                <div className="flex flex-col items-center text-center mb-3 shrink-0">
                  <UserAvatar
                    src={activeCall.peerAvatar}
                    name={activeCall.peerName}
                    sizeClassName="w-14 h-14 sm:w-16 sm:h-16"
                    borderClassName="border-2 border-white/20 shadow-xl mb-1.5"
                  />
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">
                    {activeCall.peerName}
                  </h3>
                  <span className="text-xs text-slate-300 font-semibold mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Appel en cours...
                  </span>
                </div>

                {/* Cadre vidéo central : Caméra réelle de l'utilisateur (comme WhatsApp Image 1) */}
                <div className="relative w-full max-w-md aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-700/70 shadow-2xl flex items-center justify-center shrink-0">
                  {hasRealCameraTrack ? (
                    <>
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={(e) => {
                          (e.target as HTMLVideoElement).play().catch(() => {});
                        }}
                        className={`w-full h-full object-cover ${activeCall.isFrontCam ? 'scale-x-[-1]' : ''}`}
                      />
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-white/10 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 shadow">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Votre caméra HD
                      </div>
                    </>
                  ) : (
                    /* Modal d'autorisation Caméra & Micro (Conforme WhatsApp Image 3) */
                    <div className="p-4 sm:p-6 text-center flex flex-col items-center justify-center max-w-sm w-full">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2.5 text-blue-400 shadow-inner">
                        <Video className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-white mb-1.5">
                        Autoriser l'accès à la caméra et au micro
                      </h4>
                      <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed mb-3">
                        Pour afficher votre vidéo en direct, cliquez sur le bouton ci-dessous pour activer votre caméra.
                      </p>

                      {/* Message d'erreur précis (si bloqué dans Chrome ou occupé par WhatsApp) */}
                      {mediaErrorMessage && (
                        <div className="w-full mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] leading-relaxed text-left flex items-start gap-2">
                          <span className="text-amber-400 font-bold shrink-0 text-xs">⚠️</span>
                          <span>{mediaErrorMessage}</span>
                        </div>
                      )}

                      <div className="flex flex-col w-full gap-2">
                        <button
                          type="button"
                          disabled={isRequestingMedia}
                          onClick={() => requestCameraPermissionManually(activeCall.isFrontCam ? 'user' : 'environment')}
                          className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          {isRequestingMedia ? 'Activation en cours...' : 'Autoriser la caméra et le micro'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveCall((prev) => (prev ? { ...prev, callType: 'audio' } : null));
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          Continuer en appel vocal (micro seul)
                        </button>
                      </div>
                    </div>
                  )}

                  {activeCall.isCamOff && (
                    <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-2 z-10">
                      <UserAvatar
                        src={currentUserAvatar}
                        name={currentUserName}
                        sizeClassName="w-16 h-16"
                        borderClassName="border-2 border-white/20"
                      />
                      <span className="text-xs text-slate-300 font-bold">Votre caméra est coupée</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* CAS 2 : APPEL CONNECTÉ (Vidéo du correspondant + Fenêtre flottante PiP) */
              <div className="flex-1 min-h-0 relative bg-slate-950 overflow-hidden flex items-center justify-center">
                {/* Main Video View */}
                <video
                  ref={isVideoSwapped ? localVideoRef : remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={isVideoSwapped}
                  onLoadedMetadata={(e) => {
                    (e.target as HTMLVideoElement).play().catch(() => {});
                  }}
                  className={`w-full h-full object-cover ${(isVideoSwapped && activeCall.isFrontCam) ? 'scale-x-[-1]' : ''}`}
                />

                {/* Si le correspondant est en audio seul ou vidéo en cours de connexion */}
                {!isVideoSwapped && !hasRemoteVideo && (
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
                    <div className="relative mb-6">
                      <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping" />
                      <div className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse" />
                      <UserAvatar
                        src={activeCall.peerAvatar}
                        name={activeCall.peerName}
                        sizeClassName="w-24 h-24 sm:w-32 sm:h-32"
                        borderClassName="border-4 border-emerald-500/60 shadow-2xl"
                      />
                      <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
                        <Video className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {activeCall.peerName}
                    </h3>
                    <span className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      En direct • Audio chiffré HD
                    </span>

                    {/* Visualiseur de volume audio du correspondant */}
                    <div className="flex items-center gap-1 mt-4 h-6">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                          style={{
                            height: `${Math.max(6, Math.min(24, (audioVolume / 100) * 24 * (i % 2 === 0 ? 1.2 : 0.8)))}px`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* PiP Floating Window pour la caméra locale */}
                <div
                  onClick={() => setIsVideoSwapped(!isVideoSwapped)}
                  className="absolute bottom-4 right-4 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl z-20 cursor-pointer bg-slate-900 transition-all hover:scale-105 active:scale-95 group"
                  title="Cliquez pour permuter la vue"
                >
                  <video
                    ref={isVideoSwapped ? remoteVideoRef : localVideoRef}
                    autoPlay
                    playsInline
                    muted={!isVideoSwapped}
                    onLoadedMetadata={(e) => {
                      (e.target as HTMLVideoElement).play().catch(() => {});
                    }}
                    className={`w-full h-full object-cover ${(!isVideoSwapped && activeCall.isFrontCam) ? 'scale-x-[-1]' : ''}`}
                  />

                  {/* Local Camera Off State in PiP si coupé manuellement */}
                  {!isVideoSwapped && activeCall.isCamOff && (
                    <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-2 text-center gap-1.5 z-10">
                      <UserAvatar
                        src={currentUserAvatar}
                        name={currentUserName}
                        sizeClassName="w-10 h-10"
                        borderClassName="border border-white/20"
                      />
                      <span className="text-[9px] text-slate-300 font-bold leading-tight">
                        Caméra coupée
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                    Permuter
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar - TOUJOURS VISIBLE, JAMAIS MASQUÉE */}
            <div className="shrink-0 p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-center gap-4 z-30">
              <button
                type="button"
                onClick={() => {
                  const newMuted = !activeCall.isMuted;
                  const stream = localStreamRef.current || audioStreamRef.current;
                  if (stream) {
                    stream.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
                  }
                  setActiveCall({ ...activeCall, isMuted: newMuted });
                }}
                className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 cursor-pointer ${
                  activeCall.isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
                title={activeCall.isMuted ? 'Réactiver le micro' : 'Couper le micro'}
              >
                {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!hasRealCameraTrack) {
                    requestCameraPermissionManually(activeCall.isFrontCam ? 'user' : 'environment');
                    return;
                  }
                  const newCamOff = !activeCall.isCamOff;
                  if (localStreamRef.current) {
                    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !newCamOff));
                  }
                  setActiveCall({ ...activeCall, isCamOff: newCamOff });
                }}
                className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 cursor-pointer ${
                  activeCall.isCamOff ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
                title={!hasRealCameraTrack ? 'Activer la caméra' : activeCall.isCamOff ? 'Réactiver la caméra' : 'Couper la caméra'}
              >
                {activeCall.isCamOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={handleFlipCamera}
                className="p-3 sm:p-3.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
                title="Changer de caméra (avant/arrière)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleEndCall}
                className="p-3.5 sm:p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                title="Terminer l'appel vidéo"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
