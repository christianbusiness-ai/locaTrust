'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  CheckCircle2,
  PenTool,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { triggerCelebration } from '@/lib/celebration';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSignature: (signatureDataUrl: string) => void;
  signerName: string;
  signerRole: 'proprietaire' | 'locataire';
  documentTitle: string;
  documentNumber: string;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onConfirmSignature,
  signerName,
  signerRole,
  documentTitle,
  documentNumber,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [tempSignatureUrl, setTempSignatureUrl] = useState<string | null>(null);
  const [isConfirmStep, setIsConfirmStep] = useState(false);

  // Initialize canvas with proper scale and responsive width
  useEffect(() => {
    if (!isOpen || isConfirmStep) return;

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
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0F172A'; // Dark slate natural ink
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, isConfirmStep]);

  if (!isOpen) return null;

  // Coordinate helper supporting mouse and touch events
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
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleValidateSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    setTempSignatureUrl(dataUrl);
    setIsConfirmStep(true);
  };

  const handleFinalConfirm = () => {
    if (tempSignatureUrl) {
      onConfirmSignature(tempSignatureUrl);
      triggerCelebration('signature');
      handleCloseAll();
    }
  };

  const handleCloseAll = () => {
    setHasDrawn(false);
    setTempSignatureUrl(null);
    setIsConfirmStep(false);
    onClose();
  };

  // Vérification stricte d'identité : le bailleur ne signe pas pour le locataire et vice versa
  const currentRole = typeof window !== 'undefined' ? localStorage.getItem('locatrust_current_role') : null;
  const isUnauthorizedRole =
    (signerRole === 'locataire' && (currentRole === 'bailleur' || currentRole === 'agence' || currentRole === 'proprietaire')) ||
    (signerRole === 'proprietaire' && currentRole === 'locataire');

  return (
    <div className="fixed inset-0 z-[120000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
              <PenTool className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Signer le document</h3>
              <p className="text-xs text-slate-500">
                {documentTitle} • Réf : <span className="font-mono font-bold text-slate-700">{documentNumber}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseAll}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blocage strict de signature croisée non autorisée */}
        {isUnauthorizedRole ? (
          <div className="flex flex-col items-center text-center p-5 bg-rose-50 rounded-2xl border border-rose-200 gap-3 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-300">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-rose-900">
              Signature par procuration interdite
            </h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              Conformément aux normes juridiques et aux règles de certification LocaTrust,
              <strong>
                {currentRole === 'locataire'
                  ? ' le locataire ne peut pas signer à la place du bailleur.'
                  : ' le propriétaire ou l\'agence ne peut pas signer à la place du locataire.'}
              </strong>{' '}
              Chaque partie doit apposer elle-même sa signature manuscrite depuis sa propre session.
            </p>
            <button
              type="button"
              onClick={handleCloseAll}
              className="mt-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs shadow-md hover:bg-slate-800 transition-all"
            >
              Compris / Fermer
            </button>
          </div>
        ) : (
          /* Step 1: Draw signature */
          !isConfirmStep ? (
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Signataire : <strong>{signerName}</strong> ({signerRole === 'proprietaire' ? 'Propriétaire / Bailleur' : 'Locataire'})
                </span>
              </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span>✍️ Dessinez votre signature</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Doigt, stylet ou souris
                </span>
              </div>
              
              <p className="text-[11px] text-slate-500">
                Signez avec votre doigt ou votre souris dans la zone blanche ci-dessous.
              </p>

              {/* Responsive Canvas with Touch Support */}
              <div className="w-full h-52 sm:h-56 bg-white border-2 border-slate-300 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair touch-none select-none flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full block"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-300">
                    <PenTool className="w-8 h-8 opacity-40 mb-1" />
                    <span className="text-xs font-bold">Apposez votre signature manuscrite ici</span>
                  </div>
                )}
                {/* Guidelines baseline */}
                <div className="absolute bottom-8 left-6 right-6 border-b border-slate-200 border-dashed pointer-events-none" />
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={handleClear}
                disabled={!hasDrawn}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleValidateSignature}
                  disabled={!hasDrawn}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-md flex items-center gap-2 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider ma signature</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Verification Preview & Confirmation */
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col gap-1 text-xs">
              <span className="font-black text-emerald-900 flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Signature enregistrée
              </span>
              <p className="text-emerald-800 text-[11px]">
                Voulez-vous utiliser cette signature pour signer ce document ?
              </p>
            </div>

            {/* Signature Preview */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Aperçu de votre signature manuscrite
              </span>
              <div className="w-full h-36 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-3 shadow-inner">
                {tempSignatureUrl && (
                  <img
                    src={tempSignatureUrl}
                    alt="Signature manuscrite"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
              <div className="flex flex-col items-center text-center mt-1">
                <span className="text-xs font-black text-slate-900">{signerName}</span>
                <span className="text-[10px] text-slate-500">
                  Date de signature : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Final Confirmation Buttons */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsConfirmStep(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Recommencer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg flex items-center gap-2 transition-all active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmer la signature</span>
                </button>
              </div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};
