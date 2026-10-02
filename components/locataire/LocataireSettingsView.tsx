'use client';

import React, { useState } from 'react';
import {
  Settings,
  Bell,
  Lock,
  Shield,
  Smartphone,
  Mail,
  CheckCircle2,
  Globe,
  Key,
  Download,
  AlertTriangle,
  Save,
  MessageSquare
} from 'lucide-react';

export const LocataireSettingsView: React.FC = () => {
  const [notificationSettings, setNotificationSettings] = useState({
    whatsappRentReminder: true,
    whatsappReceiptIssued: true,
    whatsappMaintenance: true,
    smsPaymentConfirmed: true,
    smsUrgentNotice: true,
    emailMonthlyStatement: true,
    emailContractCopies: true,
  });

  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!passwordState.currentPassword) {
      setPasswordError('Veuillez saisir votre mot de passe actuel.');
      return;
    }
    if (passwordState.newPassword.length < 6) {
      setPasswordError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPasswordSuccess(true);
    setPasswordState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setTimeout(() => setPasswordSuccess(false), 3500);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* 1. Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Paramètres du Compte Locataire
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configurez vos préférences d'alertes, la sécurité de votre compte et la confidentialité de vos données.
            </p>
          </div>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Vos préférences ont été enregistrées avec succès.</span>
        </div>
      )}

      {/* 2. Notifications & Alertes WhatsApp / SMS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Bell className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Canaux de Réception des Alertes
          </h3>
        </div>

        <form onSubmit={handleSaveNotifications} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* WhatsApp */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-900">Alertes WhatsApp Instantanées</span>
              </div>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Rappels d'échéance de loyer (J-5 et J-1)</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.whatsappRentReminder}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsappRentReminder: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Quittance de loyer disponible au format PDF</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.whatsappReceiptIssued}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsappReceiptIssued: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Suivi des demandes d'intervention maintenance</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.whatsappMaintenance}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsappMaintenance: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>

            {/* SMS & Email */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-900">SMS & Notifications Email</span>
              </div>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Confirmation par SMS dès encaissement</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.smsPaymentConfirmed}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, smsPaymentConfirmed: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Alertes SMS critiques et convocations</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.smsUrgentNotice}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, smsUrgentNotice: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Copie certifiée des contrats et quittances par Email</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.emailContractCopies}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, emailContractCopies: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>

          </div>

          <div className="flex justify-end mt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer mes préférences d'alertes</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Sécurité & Mot de passe */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Sécurité du Compte & Mot de Passe
            </h3>
          </div>
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Compte Protégé
          </span>
        </div>

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Votre mot de passe a été mis à jour avec succès.</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={passwordState.currentPassword}
              onChange={(e) => setPasswordState({ ...passwordState, currentPassword: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={passwordState.newPassword}
              onChange={(e) => setPasswordState({ ...passwordState, newPassword: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Confirmer nouveau mot de passe</label>
            <input
              type="password"
              value={passwordState.confirmPassword}
              onChange={(e) => setPasswordState({ ...passwordState, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>Modifier mon mot de passe</span>
            </button>
          </div>
        </form>

        {/* 2FA Toggle */}
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">Double Authentification (2FA)</span>
              <span className="text-[11px] text-slate-600">Recommandé : validation par code SMS à chaque nouvelle connexion.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              twoFactorEnabled
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {twoFactorEnabled ? 'Activé (Sécurisé)' : 'Désactivé'}
          </button>
        </div>
      </div>

      {/* 4. Données & Export Dossier */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">
            Export Intégral de mon Historique Locatif
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Téléchargez l'ensemble de vos quittances, contrats et certificats sous format ZIP sécurisé.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('Génération de l\'archive ZIP certifiée en cours...')}
          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all flex items-center gap-2 shrink-0 active:scale-95"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Exporter mes données</span>
        </button>
      </div>

    </div>
  );
};
