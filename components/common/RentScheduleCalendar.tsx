'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  CreditCard,
  FileText,
  Smartphone,
  Info,
  Sparkles
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import {
  getDeviceDateFormatted,
  getDeviceDate,
  calculateContractDueDetails,
  checkAndTriggerRentDueAlerts,
  ContractDueDetails
} from '@/lib/dateSystem';

interface RentScheduleCalendarProps {
  userRole?: 'proprietaire' | 'locataire' | 'agence';
  onDeclarePayment?: (contractId: string, month: string, amount: number) => void;
  onOpenQuittance?: (contractNumber: string) => void;
}

export const RentScheduleCalendar: React.FC<RentScheduleCalendarProps> = ({
  userRole = 'locataire',
  onDeclarePayment,
  onOpenQuittance
}) => {
  const [deviceTimeStr, setDeviceTimeStr] = useState<string>('');
  const [dueItems, setDueItems] = useState<ContractDueDetails[]>([]);
  const [currentMonthOffset, setCurrentMonthOffset] = useState<number>(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshSchedule = () => {
    setDeviceTimeStr(getDeviceDateFormatted('full'));
    // Déclenchement automatique des alertes J-3
    const results = checkAndTriggerRentDueAlerts();
    setDueItems(results);
  };

  useEffect(() => {
    refreshSchedule();
    // Rafraîchissement chaque minute pour garder l'horloge système parfaitement synchrone
    const timer = setInterval(() => {
      setDeviceTimeStr(getDeviceDateFormatted('full'));
    }, 30000);

    const handleUpdate = () => refreshSchedule();
    window.addEventListener('locatrust:payments-updated', handleUpdate);
    window.addEventListener('locatrust:contracts-updated', handleUpdate);
    window.addEventListener('locatrust:notifications-updated', handleUpdate);

    return () => {
      clearInterval(timer);
      window.removeEventListener('locatrust:payments-updated', handleUpdate);
      window.removeEventListener('locatrust:contracts-updated', handleUpdate);
      window.removeEventListener('locatrust:notifications-updated', handleUpdate);
    };
  }, []);

  const handleManualReminder = (item: ContractDueDetails) => {
    setActionNotice(`Rappel officiel J-${item.daysRemaining} transmis avec succès à ${item.tenantName} pour l'échéance du ${item.nextDueDateFormatted}.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const selectedMonthDate = new Date();
  selectedMonthDate.setMonth(selectedMonthDate.getMonth() + currentMonthOffset);
  const displayedMonthName = selectedMonthDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col gap-5 font-sans">
      
      {/* Top Banner: Horloge Réelle Système */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-slate-900 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
            <CalendarIcon className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold tracking-tight">Calendrier & Échéancier Réel</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Synchronisé avec votre appareil
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Horodatage exact : <strong className="text-white">{deviceTimeStr}</strong>
            </p>
          </div>
        </div>

        {/* Navigation Mois Prévisionnel */}
        <div className="flex items-center gap-1.5 self-end sm:self-center bg-white/10 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setCurrentMonthOffset((prev) => prev - 1)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all"
            title="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black capitalize px-2 min-w-[120px] text-center text-amber-300">
            {displayedMonthName}
          </span>
          <button
            onClick={() => setCurrentMonthOffset((prev) => prev + 1)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all"
            title="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Info Explicative Loi & Alertes J-3 */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-700 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <strong className="text-slate-900">Calcul dynamique des échéances par contrat :</strong> Chaque contrat possède sa propre date de signature réelle (ex: 16 ou 17 du mois). LocaTrust calcule automatiquement la prochaine échéance et déclenche une <strong>alerte proactive à J-3</strong> (3 jours avant l'échéance) pour garantir le respect des délais.
        </div>
      </div>

      {/* Liste des Échéances par Contrat */}
      <div className="flex flex-col gap-3">
        {dueItems.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
            Aucun contrat de location actif détecté pour le moment.
          </div>
        ) : (
          dueItems.map((item) => {
            const isDueSoon = item.status === 'due_soon_3_days';
            const isDueToday = item.status === 'due_today';
            const isOverdue = item.status === 'overdue';
            const isPaid = item.status === 'paid';

            return (
              <div
                key={item.contractId}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDueSoon
                    ? 'border-amber-300 bg-amber-50/40 shadow-sm'
                    : isDueToday
                    ? 'border-rose-400 bg-rose-50/50 shadow-md ring-2 ring-rose-400/20'
                    : isOverdue
                    ? 'border-rose-300 bg-rose-50/30'
                    : isPaid
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50/60'
                }`}
              >
                {/* Left: Info contrat et bien */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-700'
                        : isDueSoon
                        ? 'bg-amber-100 text-amber-800'
                        : isDueToday || isOverdue
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isPaid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isDueSoon || isDueToday ? (
                      <Clock className="w-5 h-5 animate-pulse text-amber-700" />
                    ) : (
                      <CalendarIcon className="w-5 h-5 text-blue-600" />
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {item.propertyTitle}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                        {item.contractNumber}
                      </span>
                    </div>

                    <div className="text-slate-500 text-[11px] flex items-center gap-3 flex-wrap">
                      <span>Bailleur : <strong className="text-slate-700">{item.ownerName}</strong></span>
                      <span>•</span>
                      <span>Locataire : <strong className="text-slate-700">{item.tenantName}</strong></span>
                      <span>•</span>
                      <span>Prise d'effet / Signature : <strong className="text-slate-700">{item.signedDate}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-500 font-medium">Loyer mensuel :</span>
                      <span className="font-black text-slate-900 text-xs">
                        {formatFCFA(item.rentAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Échéance & Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-end md:self-center">
                  
                  {/* Badge de Statut Échéance */}
                  <div className="text-right flex flex-col items-start sm:items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Prochaine Échéance
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {item.nextDueDateFormatted}
                    </span>

                    {isPaid ? (
                      <span className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Loyer à jour
                      </span>
                    ) : isDueToday ? (
                      <span className="mt-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center gap-1 animate-bounce shadow-sm">
                        🔔 Exigible aujourd'hui
                      </span>
                    ) : isDueSoon ? (
                      <span className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm">
                        ⏳ Dans {item.daysRemaining} jour{item.daysRemaining > 1 ? 's' : ''} (Alerte active)
                      </span>
                    ) : isOverdue ? (
                      <span className="mt-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black">
                        ⚠️ En retard de {item.overdueDays} jour{item.overdueDays > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="mt-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                        Dans {item.daysRemaining} jours
                      </span>
                    )}
                  </div>

                  {/* Boutons d'Action selon le rôle */}
                  {userRole === 'locataire' ? (
                    <button
                      onClick={() => {
                        if (onDeclarePayment) {
                          onDeclarePayment(item.contractId, item.targetMonthKey, item.rentAmount);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Régler ce loyer</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleManualReminder(item)}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Rappeler (J-{item.daysRemaining})</span>
                    </button>
                  )}

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
