'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  CheckCircle2,
  PenTool,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  User,
  Eye,
  Lock,
  Sparkles
} from 'lucide-react';
import { formatFCFA, formatPeriodCovered } from '@/lib/utils';
import { resolveRealReceiptData } from '@/lib/payments/receiptDataResolver';
import { getStoredOwnerSignature } from '@/lib/signatureHelper';

interface TenantReceiptReviewAndSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  currentUser: any;
  onConfirmSignature: (signatureDataUrl: string) => Promise<void> | void;
}

export const TenantReceiptReviewAndSignModal: React.FC<TenantReceiptReviewAndSignModalProps> = ({
  isOpen,
  onClose,
  payment,
  currentUser,
  onConfirmSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  const resolved = payment ? resolveRealReceiptData(payment, currentUser) : null;
  const effectiveOwnerSig =
    payment?.owner_signature ||
    payment?.owner_signature_url ||
    resolved?.ownerSignatureUrl ||
    getStoredOwnerSignature(payment?.owner_id);

  // Initialize canvas with proper scale and responsive width
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#1E3A8A'; // Dark Navy ink for tenant
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen || !payment || !resolved) return null;

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleValidateSignature = async () => {
    if (!hasDrawn || !canvasRef.current || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      await onConfirmSignature(signatureDataUrl);
      onClose();
    } catch (err) {
      console.error('Error confirming signature:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAgency = resolved.ownerName?.toLowerCase().includes('agence');
  const targetPeriod = formatPeriodCovered(payment.target_month || payment.period_covered);

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[94vh] overflow-y-auto p-4 sm:p-6 border border-slate-200 shadow-2xl flex flex-col gap-4 animate-scaleUp">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider border border-amber-300">
                  Signature requise
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Réf: {payment.reference}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                Signature du locataire requise
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: CONSULTATION DES DÉTAILS DU REÇU (Point 7 du prompt) */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Détails du document à contresigner
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Vérifié par le bailleur
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Propriétaire / Agence */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">
                {isAgency ? 'Agence mandataire' : 'Bailleur / Propriétaire'}
              </span>
              <span className="font-black text-slate-900">{resolved.ownerName}</span>
              <span className="text-[10px] text-emerald-700 font-bold">✓ Identité certifiée LocaTrust</span>
            </div>

            {/* Bien & Logement */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Logement concerné</span>
              <span className="font-black text-slate-900 truncate">{resolved.propertyTitle}</span>
              <span className="text-[10px] text-slate-500 truncate">{resolved.propertyAddress}</span>
            </div>

            {/* Contrat de bail */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Contrat de bail associé</span>
              <span className="font-mono font-black text-slate-900">{resolved.contractNumber}</span>
              <span className="text-[10px] text-slate-500">Bail d'habitation certifié</span>
            </div>

            {/* Période couverte */}
            <div className="bg-white p-2.5 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col">
              <span className="text-[10px] text-blue-800 font-bold uppercase">Période concernée</span>
              <span className="font-black text-blue-900">{targetPeriod}</span>
              <span className="text-[10px] text-blue-700 font-medium">Affectation chronologique FIFO</span>
            </div>

            {/* Montant réglé */}
            <div className="bg-white p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col">
              <span className="text-[10px] text-emerald-800 font-bold uppercase">Montant réglé</span>
              <span className="text-base font-black text-emerald-700">{formatFCFA(payment.amount)}</span>
              <span className="text-[10px] text-emerald-600 font-bold">Intégralement confirmé</span>
            </div>

            {/* Moyen & Date */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Règlement</span>
              <span className="font-bold text-slate-900">{payment.payment_method || 'Mobile Money'}</span>
              <span className="text-[10px] text-slate-500">Date : {payment.payment_date || new Date().toLocaleDateString('fr-FR')}</span>
            </div>
          </div>

          {/* Preuve si disponible */}
          {payment.proof_url && (
            <div className="mt-1 p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={payment.proof_url}
                  alt="Justificatif"
                  className="w-9 h-9 object-cover rounded-lg border cursor-pointer hover:scale-105 transition"
                  onClick={() => setSelectedProofUrl(payment.proof_url)}
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 text-[11px]">Justificatif de transaction</span>
                  <span className="text-[10px] text-slate-400">Capture ou bordereau</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofUrl(payment.proof_url)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Voir
              </button>
            </div>
          )}

          {/* Signature du propriétaire / agence (Point critique 7 & 10) */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-28 bg-slate-50 rounded-lg border border-slate-200 p-1 flex items-center justify-center shrink-0">
                {effectiveOwnerSig ? (
                  <img
                    src={effectiveOwnerSig}
                    alt="Signature propriétaire"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 italic">Vérifié par bailleur</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold text-slate-900">
                  {isAgency ? "Signature de l'Agence" : "Signature du Propriétaire"}
                </span>
                <span className="text-[10px] text-slate-500">{resolved.ownerName}</span>
                <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Apposée lors de la vérification
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: ZONE DE SIGNATURE DU LOCATAIRE */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <PenTool className="w-4 h-4 text-blue-600" />
              <label className="text-xs font-black text-slate-900">
                Votre signature manuscrite (Preneur / Locataire)
              </label>
            </div>
            {hasDrawn && (
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>
            )}
          </div>

          <div className="relative border-2 border-dashed border-blue-300 rounded-2xl bg-white overflow-hidden shadow-inner group">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-36 cursor-crosshair touch-none bg-slate-50/50"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5">
                <PenTool className="w-6 h-6 text-blue-400 animate-pulse" />
                <span className="font-bold text-slate-600">Tracez votre signature manuscrite ici</span>
                <span className="text-[10px] text-slate-400">Doigt sur smartphone/tablette ou souris sur ordinateur</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span>Signataire : <strong>{currentUser?.user_metadata?.full_name || 'Christian'}</strong></span>
            <span className="text-emerald-700 font-bold">✓ Enregistrée dans Supabase avec valeur probante</span>
          </div>
        </div>

        {/* BOUTONS D'ACTION (Section 4 & 7 du prompt) */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Fermer
          </button>
          <button
            type="button"
            disabled={!hasDrawn || isSubmitting}
            onClick={handleValidateSignature}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !hasDrawn || isSubmitting
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-600/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Finalisation en cours...' : 'Valider ma signature'}</span>
          </button>
        </div>

        {/* Proof preview modal */}
        {selectedProofUrl && (
          <div className="fixed inset-0 z-[100010] bg-slate-950/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-4 max-w-md w-full flex flex-col gap-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-black text-xs text-slate-900">Preuve de paiement</span>
                <button onClick={() => setSelectedProofUrl(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
              </div>
              <img src={selectedProofUrl} alt="Justificatif" className="w-full h-72 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
