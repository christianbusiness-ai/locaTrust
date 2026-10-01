import React from 'react';

export type PaymentStatusType =
  | 'paye_complet'
  | 'caution_recue'
  | 'caution_a_confirmer'
  | 'caution_partielle'
  | 'paye_partiel'
  | 'reserve_en_garantie'
  | 'en_attente'
  | 'declare'
  | 'confirme'
  | 'refuse'
  | 'restitue_total'
  | 'restitue_partiel';

interface PaymentStatusBadgeProps {
  status: PaymentStatusType | string;
  customText?: string;
  className?: string;
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  customText,
  className = ''
}) => {
  let label = customText || '';
  let colorStyles = '';
  let dotColor = '';

  switch (status) {
    case 'paye_complet':
    case 'caution_recue':
    case 'confirme':
      label = label || (status === 'caution_recue' ? 'Caution reçue' : 'PAYÉ AU COMPLET');
      colorStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      dotColor = 'bg-emerald-500';
      break;

    case 'caution_a_confirmer':
      label = label || 'Caution à confirmer';
      colorStyles = 'bg-amber-50 text-amber-800 border-amber-300';
      dotColor = 'bg-amber-500 animate-pulse';
      break;

    case 'paye_partiel':
    case 'caution_partielle':
      label = label || 'Caution partielle';
      colorStyles = 'bg-amber-50 text-amber-800 border-amber-200';
      dotColor = 'bg-amber-500';
      break;

    case 'reserve_en_garantie':
    case 'conserve':
      label = label || 'Réservé en garantie';
      colorStyles = 'bg-blue-50 text-blue-800 border-blue-200';
      dotColor = 'bg-blue-600';
      break;

    case 'en_attente':
    case 'declare':
      label = label || 'Paiement en attente';
      colorStyles = 'bg-amber-50 text-amber-800 border-amber-200';
      dotColor = 'bg-amber-500';
      break;

    case 'refuse':
      label = label || 'Paiement refusé';
      colorStyles = 'bg-rose-50 text-rose-800 border-rose-200';
      dotColor = 'bg-rose-500';
      break;

    case 'restitue_total':
      label = label || 'Caution restituée (100 %)';
      colorStyles = 'bg-emerald-100 text-emerald-900 border-emerald-300';
      dotColor = 'bg-emerald-600';
      break;

    case 'restitue_partiel':
      label = label || 'Restituée avec retenue';
      colorStyles = 'bg-amber-100 text-amber-900 border-amber-300';
      dotColor = 'bg-amber-600';
      break;

    case 'impute_loyers':
      label = label || 'Imputée sur loyers (Préavis)';
      colorStyles = 'bg-purple-100 text-purple-900 border-purple-300';
      dotColor = 'bg-purple-600';
      break;

    default:
      label = label || status;
      colorStyles = 'bg-slate-100 text-slate-800 border-slate-200';
      dotColor = 'bg-slate-500';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide border whitespace-nowrap shadow-xs ${colorStyles} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
};
