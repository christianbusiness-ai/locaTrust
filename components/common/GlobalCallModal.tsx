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
    if (typeof window !== 'undefined') {
      try { delete (window as any).__locatrust_prefetched_stream; } catch {}
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

  // Démarrer spécifiquement la caméra physique (flux vidéo HD/standard) sans être bloqué par le micro
  const startVideoTrackDirectly = async (facing: 'user' | 'environment' = 'user'): Promise<MediaStreamTrack | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    setIsRequestingMedia(true);
    let vTrack: MediaStreamTrack | null = null;

    const attempts = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing } },
      { video: { facingMode: facing } },
      { video: true }
    ];

    for (const constraint of attempts) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia(constraint);
        if (vStream.getVideoTracks().length > 0) {
          vTrack = vStream.getVideoTracks()[0];
          break;
        }
      } catch (err) {
        console.warn('Tentative capture vidéo avec contrainte', constraint, err);
      }
    }

    setIsRequestingMedia(false);

    if (vTrack) {
      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream([vTrack]);
      } else {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          try { t.stop(); } catch {}
          localStreamRef.current?.removeTrack(t);
        });
        localStreamRef.current.addTrack(vTrack);
      }

      setHasRealCameraTrack(true);
      setCameraPermissionStatus('granted');
      setActiveCall((prev) => (prev ? { ...prev, isCamOff: false } : null));

      if (peerConnectionRef.current) {
        addTracksToPeerConnection(peerConnectionRef.current, localStreamRef.current);
      }

      syncVideoElements();
      const elById = document.getElementById("localVideo") as HTMLVideoElement | null;
      if (elById) {
        elById.srcObject = localStreamRef.current;
        elById.play().catch(() => {});
      }
      return vTrack;
    }
    return null;
  };

  // Démarrer spécifiquement le microphone sans bloquer la vidéo
  const startAudioTrackDirectly = async (): Promise<MediaStreamTrack | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    try {
      const aStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const aTrack = aStream.getAudioTracks()[0];
      if (aTrack) {
        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream([aTrack]);
        } else {
          localStreamRef.current.addTrack(aTrack);
        }
        audioStreamRef.current = aStream;
        setupAudioVolumeAnalysis(aStream);
        if (peerConnectionRef.current) {
          addTracksToPeerConnection(peerConnectionRef.current, localStreamRef.current);
        }
        return aTrack;
      }
    } catch (err) {
      console.warn('Microphone capture échouée:', err);
    }
    return null;
  };

  // Demande manuelle et directe d'accès à la caméra et au microphone
  const requestCameraPermissionManually = async (facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMediaErrorMessage("Votre navigateur ne supporte pas l'accès caméra (getUserMedia).");
      return null;
    }
    setIsRequestingMedia(true);
    setMediaErrorMessage('');
    setCameraPermissionStatus('requesting');

    // 1. Démarrer d'abord la vidéo
    const vTrack = await startVideoTrackDirectly(facingMode);
    // 2. Démarrer le micro si pas encore présent
    if (!audioStreamRef.current?.getAudioTracks().length && !localStreamRef.current?.getAudioTracks().length) {
      await startAudioTrackDirectly();
    }

    setIsRequestingMedia(false);

    if (vTrack && localStreamRef.current) {
      setCameraPermissionStatus('granted');
      setMediaErrorMessage('');
      return localStreamRef.current;
    }

    setCameraPermissionStatus('denied');
    setHasRealCameraTrack(false);
    setMediaErrorMessage("Impossible d'activer la caméra. Vérifiez les autorisations dans votre navigateur.");
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

  // Helper pour attacher et démarrer la lecture d'un flux vidéo sans blocage
  const attachStreamToVideo = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!el || !stream) return;
    try {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch {}
  };

  // Synchronisation systématique des flux vidéo avec les éléments <video> réels du DOM
  const syncVideoElements = () => {
    if (activeCall?.status === 'ringing') {
      if (localVideoRef.current && localStreamRef.current) {
        attachStreamToVideo(localVideoRef.current, localStreamRef.current);
      }
      return;
    }

    const mainVideo = isVideoSwapped ? localVideoRef.current : remoteVideoRef.current;
    const pipVideo = isVideoSwapped ? remoteVideoRef.current : localVideoRef.current;

    const mainStream = isVideoSwapped ? localStreamRef.current : remoteStreamRef.current;
    const pipStream = isVideoSwapped ? remoteStreamRef.current : localStreamRef.current;

    if (mainVideo && mainStream) {
      attachStreamToVideo(mainVideo, mainStream);
    }

    if (pipVideo && pipStream) {
      attachStreamToVideo(pipVideo, pipStream);
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

  // Timer pour la durée de l'appel connecté
  useEffect(() => {
    let timer: any = null;
    if (activeCall && activeCall.status === 'connected') {
      timer = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  // Décrochage automatique pour les tests après 8 secondes de sonnerie
  useEffect(() => {
    let ringingTimer: any = null;
    if (activeCall && activeCall.status === 'ringing' && activeCall.role === 'caller') {
      ringingTimer = setTimeout(() => {
        if (activeCallRef.current?.status === 'ringing') {
          stopRingtoneLoop();
          playChime('connected');
          setActiveCall((prev) => (prev ? { ...prev, status: 'connected', seconds: 0 } : null));
          syncVideoElements();
        }
      }, 8000);
    }
    return () => clearTimeout(ringingTimer);
  }, [activeCall?.status, activeCall?.role]);

  // Synchronisation continue des flux vidéo lors de l'apparition du modal ou permutation PiP
  useEffect(() => {
    if (activeCall && activeCall.callType === 'video') {
      const prefetched = (window as any).__locatrust_prefetched_stream as MediaStream | undefined;
      if (!localStreamRef.current && prefetched && prefetched.active && prefetched.getVideoTracks().length > 0) {
        localStreamRef.current = prefetched;
        setHasRealCameraTrack(true);
        setCameraPermissionStatus('granted');
        if (localVideoRef.current) {
          attachStreamToVideo(localVideoRef.current, prefetched);
        }
        if (peerConnectionRef.current) {
          addTracksToPeerConnection(peerConnectionRef.current, prefetched);
        }
        setupAudioVolumeAnalysis(prefetched);
        syncVideoElements();
      } else if (!localStreamRef.current && !isRequestingMedia) {
        requestCameraPermissionManually(activeCall.isFrontCam ? 'user' : 'environment');
      }

      syncVideoElements();
      const t1 = setTimeout(syncVideoElements, 80);
      const t2 = setTimeout(syncVideoElements, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [activeCall?.callType, activeCall?.status, isVideoSwapped, hasRealCameraTrack]);

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
        // En attente du correspondant : la vidéo affichée est la caméra réelle de l'appelant (comme WhatsApp)
        remoteStreamRef.current = null;
        setHasRemoteVideo(false);
      }

      // Capture micro et caméra réels (utilisation du flux direct ou demande directe)
      const streamSource = (e.detail as any)?.stream || (window as any).__locatrust_prefetched_stream;
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
            attachStreamToVideo(localVideoRef.current, stream);
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

    const handleMediaStreamReady = (e: any) => {
      const stream = e.detail?.stream;
      if (stream && stream.active) {
        localStreamRef.current = stream;
        setHasRealCameraTrack(stream.getVideoTracks().length > 0);
        setCameraPermissionStatus('granted');
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        if (peerConnectionRef.current) {
          addTracksToPeerConnection(peerConnectionRef.current, stream);
        }
        setupAudioVolumeAnalysis(stream);
        syncVideoElements();
      }
    };

    window.addEventListener('locatrust:call_event' as any, handleCallEvent);
    window.addEventListener('locatrust:initiate_call' as any, handleInitiateCall);
    window.addEventListener('locatrust:media_stream_ready' as any, handleMediaStreamReady);

    return () => {
      window.removeEventListener('locatrust:call_event' as any, handleCallEvent);
      window.removeEventListener('locatrust:initiate_call' as any, handleInitiateCall);
      window.removeEventListener('locatrust:media_stream_ready' as any, handleMediaStreamReady);
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
      remoteStreamRef.current = null;
      setHasRemoteVideo(false);
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

      {/* 3. ACTIVE VIDEO CALL MODAL (Conforme WhatsApp Web / Mobile) */}
      {activeCall && activeCall.callType === 'video' && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#0b0f19] border-0 sm:border sm:border-slate-800 sm:rounded-3xl w-full h-full sm:max-w-4xl sm:h-[88vh] sm:max-h-[750px] shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Top Bar Overlay */}
            <div className="absolute top-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent flex items-center justify-between z-30 shrink-0">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={activeCall.peerAvatar}
                  name={activeCall.peerName}
                  sizeClassName="w-10 h-10"
                />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-black text-white drop-shadow">{activeCall.peerName}</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold drop-shadow">
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

            {/* CAS 1 : PENDANT LA SONNERIE (Exactement comme WhatsApp : caméra réelle locale plein écran) */}
            {activeCall.status === 'ringing' ? (
              <div className="flex-1 min-h-0 relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center">
                {/* 1. Caméra réelle locale en plein écran */}
                <video
                  id="localVideo"
                  ref={(node) => {
                    localVideoRef.current = node;
                    attachStreamToVideo(node, localStreamRef.current);
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    (e.target as HTMLVideoElement).play().catch(() => {});
                  }}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${activeCall.isFrontCam ? 'scale-x-[-1]' : ''}`}
                />

                {/* 2. Header flottant avec nom et avatar du contact appelé */}
                <div className="absolute top-16 sm:top-20 inset-x-0 p-4 flex flex-col items-center text-center z-20">
                  <UserAvatar
                    src={activeCall.peerAvatar}
                    name={activeCall.peerName}
                    sizeClassName="w-20 h-20 sm:w-24 sm:h-24"
                    borderClassName="border-2 border-white/40 shadow-2xl mb-2.5"
                  />
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-lg">
                    {activeCall.peerName}
                  </h3>
                  {activeCall.propertyTitle && (
                    <span className="text-xs text-slate-200 drop-shadow mt-0.5 font-semibold">{activeCall.propertyTitle}</span>
                  )}
                  <div className="mt-3 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-xs font-bold text-emerald-400 flex items-center gap-2 shadow-xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>Appel en cours... Sonnerie...</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stopRingtoneLoop();
                      playChime('connected');
                      setActiveCall((prev) => (prev ? { ...prev, status: 'connected', seconds: 0 } : null));
                      syncVideoElements();
                    }}
                    className="mt-2 px-3.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/40 text-[11px] font-bold text-emerald-300 transition-all cursor-pointer shadow flex items-center gap-1.5"
                  >
                    <span>Connecter la visio de test</span>
                  </button>
                </div>

                {/* 3. Badge caméra HD en direct */}
                {hasRealCameraTrack && !activeCall.isCamOff && (
                  <div className="absolute bottom-24 sm:bottom-28 left-4 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur border border-white/20 text-xs font-bold text-emerald-400 flex items-center gap-2 shadow z-20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Votre caméra HD (En direct)</span>
                  </div>
                )}

                {/* Si la caméra est en cours d'autorisation ou bloquée */}
                {!hasRealCameraTrack && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3 bg-slate-950/85 backdrop-blur-md z-15">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                      <Camera className="w-8 h-8 animate-pulse" />
                    </div>
                    <p className="text-base font-black text-white">
                      Connexion à votre caméra physique...
                    </p>
                    <p className="text-xs text-slate-300 max-w-sm">
                      {mediaErrorMessage || "Autorisez l'accès à la caméra et au microphone pour démarrer la visio en direct."}
                    </p>
                    <button
                      type="button"
                      onClick={() => requestCameraPermissionManually(activeCall.isFrontCam ? 'user' : 'environment')}
                      disabled={isRequestingMedia}
                      className="mt-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/30 transition-all cursor-pointer z-30 disabled:opacity-50"
                    >
                      <Camera className="w-5 h-5" />
                      {isRequestingMedia ? "Activation..." : "Démarrer ma caméra maintenant"}
                    </button>
                  </div>
                )}

                {/* Caméra coupée manuellement */}
                {activeCall.isCamOff && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 z-15">
                    <UserAvatar
                      src={currentUserAvatar}
                      name={currentUserName}
                      sizeClassName="w-20 h-20"
                      borderClassName="border-2 border-white/20"
                    />
                    <span className="text-sm text-slate-300 font-bold">Votre caméra est coupée</span>
                  </div>
                )}
              </div>
            ) : (
              /* CAS 2 : APPEL CONNECTÉ (Vidéo du correspondant en grand + PiP en bas à droite comme WhatsApp) */
              <div className="flex-1 min-h-0 relative bg-slate-950 overflow-hidden flex items-center justify-center">
                {/* Main Video Viewport (Remote Contact by default, or Local User if Swapped) */}
                <video
                  ref={(node) => {
                    if (isVideoSwapped) {
                      localVideoRef.current = node;
                      attachStreamToVideo(node, localStreamRef.current);
                    } else {
                      remoteVideoRef.current = node;
                      attachStreamToVideo(node, remoteStreamRef.current);
                    }
                  }}
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

                {/* PiP Floating Window pour la caméra locale (Permutable au clic) */}
                <div
                  onClick={() => setIsVideoSwapped(!isVideoSwapped)}
                  className="absolute bottom-24 right-4 sm:bottom-28 sm:right-6 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl z-20 cursor-pointer bg-slate-900 transition-all hover:scale-105 active:scale-95 group"
                  title="Cliquez pour permuter la vue"
                >
                  <video
                    ref={(node) => {
                      if (isVideoSwapped) {
                        remoteVideoRef.current = node;
                        attachStreamToVideo(node, remoteStreamRef.current);
                      } else {
                        localVideoRef.current = node;
                        attachStreamToVideo(node, localStreamRef.current);
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={true}
                    onLoadedMetadata={(e) => {
                      (e.target as HTMLVideoElement).play().catch(() => {});
                    }}
                    className={`w-full h-full object-cover ${(!isVideoSwapped && activeCall.isFrontCam) ? 'scale-x-[-1]' : ''}`}
                  />

                  {/* Local Camera Off/Inactive State in PiP */}
                  {(!isVideoSwapped && (activeCall.isCamOff || !hasRealCameraTrack)) && (
                    <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-2 text-center gap-1.5 z-10">
                      <UserAvatar
                        src={currentUserAvatar}
                        name={currentUserName}
                        sizeClassName="w-10 h-10"
                        borderClassName="border border-white/20"
                      />
                      <span className="text-[9px] text-slate-300 font-bold leading-tight">
                        {activeCall.isCamOff ? 'Caméra coupée' : 'Caméra inactive'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startVideoTrackDirectly(activeCall.isFrontCam ? 'user' : 'environment');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-[10px] font-bold text-white shadow"
                      >
                        Activer
                      </button>
                    </div>
                  )}

                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[10px] font-bold text-white z-10">
                    {isVideoSwapped ? activeCall.peerName : 'Vous'}
                  </div>

                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold z-10">
                    Permuter
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar - TOUJOURS VISIBLE, FLOTTANTE EN BAS COMME WHATSAPP */}
            <div className="shrink-0 p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 flex items-center justify-center gap-4 sm:gap-6 z-30">
              <button
                type="button"
                onClick={() => {
                  const newMuted = !activeCall.isMuted;
                  // Couper réellement toutes les pistes audio sur tous les flux
                  const streams = [localStreamRef.current, audioStreamRef.current];
                  streams.forEach((s) => {
                    s?.getAudioTracks().forEach((t) => {
                      t.enabled = !newMuted;
                    });
                  });
                  // Couper au niveau des senders WebRTC
                  if (peerConnectionRef.current) {
                    peerConnectionRef.current.getSenders().forEach((sender) => {
                      if (sender.track && sender.track.kind === 'audio') {
                        sender.track.enabled = !newMuted;
                      }
                    });
                  }
                  if (newMuted) {
                    setAudioVolume(0);
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
                onClick={async () => {
                  if (!hasRealCameraTrack || !localStreamRef.current?.getVideoTracks().length) {
                    // Démarrer la caméra physique directement
                    await startVideoTrackDirectly(activeCall.isFrontCam ? 'user' : 'environment');
                    return;
                  }
                  const newCamOff = !activeCall.isCamOff;
                  localStreamRef.current?.getVideoTracks().forEach((t) => {
                    t.enabled = !newCamOff;
                  });
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

      {/* Élément audio pour la voix entrante du correspondant */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </>
  );
};
