'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, Download, Send, Sparkles, X, ShieldCheck, FileCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export type ConfirmationType =
  | 'success'
  | 'download'
  | 'sent'
  | 'payment_validated'
  | 'caution_validated'
  | 'contract_sent'
  | 'reminder_sent'
  | 'avenant_initiated'
  | 'termination_initiated';

export interface ActionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: ConfirmationType;
  title: string;
  message: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  withCelebration?: boolean;
  autoCloseMs?: number;
}

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  isOpen,
  onClose,
  type = 'success',
  title,
  message,
  details,
  confirmText = 'OK, compris',
  cancelText,
  onConfirm,
  onCancel,
  withCelebration = false,
  autoCloseMs,
}) => {
  useEffect(() => {
    if (isOpen && withCelebration) {
      // Discrète célébration élégante (petites étoiles / confettis légers, non excessif)
      confetti({
        particleCount: 35,
        spread: 45,
        origin: { y: 0.6 },
        colors: ['#1D4ED8', '#F59E0B', '#10B981', '#60A5FA'],
        ticks: 200,
        gravity: 1.1,
        scalar: 0.8,
      });
    }
  }, [isOpen, withCelebration]);

  useEffect(() => {
    if (isOpen && autoCloseMs && autoCloseMs > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'download':
        return <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'sent':
      case 'contract_sent':
      case 'reminder_sent':
        return <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'payment_validated':
      case 'caution_validated':
        return <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'avenant_initiated':
      case 'termination_initiated':
        return <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  const getBadgeStyle = () => {
    switch (type) {
      case 'payment_validated':
      case 'caution_validated':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col items-center text-center gap-3.5 transform transition-all animate-scaleUp"
      >
        {/* Subtle decorative top accent line */}
        <div className="absolute top-0 inset-x-8 h-1 bg-gradient-to-r from-blue-600 via-amber-500 to-blue-600 rounded-full" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Pill */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm mt-1 shrink-0 ${getBadgeStyle()}`}>
          {getIcon()}
        </div>

        {/* Title & Message */}
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {message}
          </p>
          {details && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
              {details}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex items-center gap-2 mt-1">
          {cancelText && (
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all active:scale-95"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-extrabold text-xs shadow-md shadow-blue-600/25 transition-all active:scale-95"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
