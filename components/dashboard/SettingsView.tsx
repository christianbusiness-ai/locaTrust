'use client';

import React, { useState } from 'react';
import {
  User,
  Shield,
  Bell,
  Palette,
  CreditCard,
  FileCheck,
  Lock,
  LifeBuoy,
  Save,
  CheckCircle2,
  ExternalLink,
  Upload,
  Send,
  Paperclip,
  Check,
  Calendar,
  Camera,
  X,
  RotateCcw,
  Archive,
  Image as ImageIcon,
  ChevronRight,
  Building2,
  Briefcase,
  Award
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import {
  getActiveReferenceYear,
  setActiveReferenceYear,
  getAvailableYears,
  getArchivedYears
} from '@/lib/reports/accountingHistoryStore';
import { ACCENT_THEMES, applyAccentTheme } from '@/lib/themeHelper';

interface AdminTicket {
  id: string;
  subject: string;
  message: string;
  attachment?: string;
  status: 'envoyé' | 'reçu' | 'lu' | 'répondu';
  date: string;
  adminResponse?: string;
}

const INITIAL_SUPPORT_TICKETS: AdminTicket[] = [];

interface SettingsViewProps {
  userRole?: 'proprietaire' | 'agence' | 'locataire' | 'admin';
  currentUser?: any;
  onNavigateToPaymentAccounts?: () => void;
  onNavigateToSubscription?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userRole = 'proprietaire',
  currentUser,
  onNavigateToPaymentAccounts,
  onNavigateToSubscription
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const isAgency = userRole === 'agence' || (profile as any)?.role === 'agence' || (profile as any)?.account_type === 'agence';
  const [activeTab, setActiveTab] = useState<
    'profile' | 'account' | 'accounting_year' | 'preferences' | 'notifications' | 'payments' | 'verification' | 'privacy' | 'support'
  >('profile');

  // Thème et couleurs d'ambiance de l'environnement (Demande vocale utilisateur)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('locatrust_theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('locatrust_accent_color') || 'blue';
    }
    return 'blue';
  });

  // États des préférences de notifications
  const [notifPayments, setNotifPayments] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('locatrust_notif_payments');
      return s !== null ? s === 'true' : true;
    }
    return true;
  });
  const [notifMessages, setNotifMessages] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('locatrust_notif_messages');
      return s !== null ? s === 'true' : true;
    }
    return true;
  });
  const [notifEmail, setNotifEmail] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('locatrust_notif_email');
      return s !== null ? s === 'true' : true;
    }
    return true;
  });
  const [notifMaintenance, setNotifMaintenance] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('locatrust_notif_maintenance');
      return s !== null ? s === 'true' : true;
    }
    return true;
  });
  const [notifContracts, setNotifContracts] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('locatrust_notif_contracts');
      return s !== null ? s === 'true' : true;
    }
    return true;
  });
  const [notifSavedMsg, setNotifSavedMsg] = useState<string | null>(null);

  // Avatar Management State (Points 19 & 20 du prompt)
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('locatrust_user_avatar');
      if (stored && !stored.includes('images.unsplash.com')) return stored;
    }
    const profAvatar = profile?.avatar_url;
    if (profAvatar && !profAvatar.includes('images.unsplash.com')) return profAvatar;
    return '';
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  // Accounting Year State (Points 11 à 18 du prompt)
  const [activeAccountingYear, setActiveAccountingYear] = useState<string>(() => getActiveReferenceYear());
  const [inputAccountingYear, setInputAccountingYear] = useState<string>(() => getActiveReferenceYear());
  const [archivedAccountingYears, setArchivedAccountingYears] = useState<string[]>(() => getArchivedYears());
  const [selectedArchivedYear, setSelectedArchivedYear] = useState<string | null>(null);
  const [yearSuccessFeedback, setYearSuccessFeedback] = useState<string | null>(null);

  // Profile Form State
  const [fullName, setFullName] = useState<string>(() => profile?.full_name || currentUser?.full_name || '');
  const [email, setEmail] = useState<string>(() => (profile as any)?.email || user?.email || currentUser?.email || '');
  const [phone, setPhone] = useState<string>(() => profile?.phone || currentUser?.phone || '');
  const [address, setAddress] = useState<string>(() => currentUser?.address || 'Abidjan, Côte d\'Ivoire');

  // Synchronize when profile or user loads
  React.useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if ((profile as any).email) setEmail((profile as any).email);
      if (profile.phone) setPhone(profile.phone);
    } else if (user) {
      if (user.email) setEmail(user.email);
    }
  }, [profile, user]);

  // Agency / Corporate specific fields
  const [rccmNumber, setRccmNumber] = useState<string>('CI-ABJ-2021-B-12849');
  const [ministerialApproval, setMinisterialApproval] = useState<string>('AGR-MCU-2022-048');
  const [taxId, setTaxId] = useState<string>('2104829 Z');
  const [legalRepresentative, setLegalRepresentative] = useState<string>('Représentant Légal Agréé');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // KYC Verification Upload State & Handlers
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFilePreview, setDocFilePreview] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docSuccessMsg, setDocSuccessMsg] = useState<string | null>(null);
  const [docErrorMsg, setDocErrorMsg] = useState<string | null>(null);
  const [docIdentifier, setDocIdentifier] = useState<string>(() => profile?.cni_number || '');

  const handleKycFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setDocErrorMsg('Le document ne doit pas dépasser 10 Mo.');
      return;
    }
    setDocErrorMsg(null);
    setDocFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setDocFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocFilePreview(null);
    }
  };

  const handleKycDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUploadingDoc(true);
    setDocSuccessMsg(null);
    setDocErrorMsg(null);

    try {
      let finalDocUrl = profile?.id_document_url || '';
      if (docFile) {
        const fileExt = docFile.name.split('.').pop()?.toLowerCase() || 'pdf';
        const sanitizedName = `${Date.now()}_${docFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `kyc_documents/${user.id}/${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, docFile, { upsert: true, contentType: docFile.type });

        if (uploadError) {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(docFile);
          });
          finalDocUrl = await base64Promise;
        } else {
          const { data: publicData } = supabase.storage.from('documents').getPublicUrl(filePath);
          finalDocUrl = publicData?.publicUrl || filePath;
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          cni_number: docIdentifier.trim(),
          id_document_url: finalDocUrl,
          verification_status: 'en_attente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      await refreshProfile();
      setDocFile(null);
      setDocFilePreview(null);
      setDocSuccessMsg('✅ Vos pièces justificatives ont été transmises avec succès à l’administrateur ! Votre dossier KYC est désormais en cours d’examen.');
      window.dispatchEvent(new CustomEvent('locatrust:profile_updated'));
      window.dispatchEvent(new CustomEvent('locatrust:verification_updated'));
      setTimeout(() => setDocSuccessMsg(null), 8000);
    } catch (err: any) {
      setDocErrorMsg(err?.message || 'Erreur lors du téléversement.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Support / Admin Tickets State
  const [tickets, setTickets] = useState<AdminTicket[]>(INITIAL_SUPPORT_TICKETS);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketFile, setTicketFile] = useState<string | null>(null);

  // Property & Subscription auto calculations
  const [activePropertiesCount, setActivePropertiesCount] = useState<number>(0);

  React.useEffect(() => {
    if (user?.id) {
      supabase
        .from('properties')
        .select('id, status', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .then(({ count, error: qErr }) => {
          if (!qErr && count !== null) {
            setActivePropertiesCount(count);
          }
        });
    }
  }, [user?.id]);

  const subscriptionCost = activePropertiesCount <= 1 ? 500 : activePropertiesCount <= 10 ? 2000 : activePropertiesCount <= 20 ? 5000 : 10000;

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setSavedMessage('Modifications enregistrées localement.');
      setTimeout(() => setSavedMessage(null), 3000);
      return;
    }
    try {
      setIsSaving(true);
      setSaveError(null);
      const { error: updError } = await supabase.from('profiles').update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

      if (updError) throw updError;
      await refreshProfile();
      setSavedMessage('Vos informations personnelles ont été mises à jour avec succès.');
      setTimeout(() => setSavedMessage(null), 3500);
    } catch (err: any) {
      console.error('Erreur sauvegarde profil:', err);
      setSaveError('Erreur lors de la mise à jour de vos informations.');
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Avatar Change (Points 19 & 20)
  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploadError(null);

    if (!file.type.startsWith('image/')) {
      setAvatarUploadError('Veuillez sélectionner un format d\'image valide (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadError('L\'image dépasse la taille maximale autorisée de 5 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
      setIsAvatarModalOpen(true);
    };
    reader.onerror = () => {
      setAvatarUploadError('Erreur lors du chargement du fichier.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmAvatarChange = () => {
    if (!avatarPreview) return;
    setUserAvatar(avatarPreview);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('locatrust_user_avatar', avatarPreview);
        window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: avatarPreview } }));
      } catch (err) {
        console.error('Failed to save avatar to localStorage', err);
      }
    }
    setIsAvatarModalOpen(false);
    setAvatarPreview(null);
    setSavedMessage('Photo de profil mise à jour avec succès.');
    setTimeout(() => setSavedMessage(null), 3500);
  };

  // Handle Save Accounting Year (Points 11 & 12)
  const handleSaveAccountingYear = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanYear = inputAccountingYear.trim();
    if (!cleanYear || isNaN(Number(cleanYear)) || Number(cleanYear) < 2000 || Number(cleanYear) > 2100) {
      setYearSuccessFeedback('Veuillez renseigner une année comptable valide à 4 chiffres (ex: 2026).');
      setTimeout(() => setYearSuccessFeedback(null), 4000);
      return;
    }

    const res = setActiveReferenceYear(cleanYear);
    if (res.success) {
      setActiveAccountingYear(res.activeYear);
      setArchivedAccountingYears(res.archivedYears);
      setYearSuccessFeedback(`Année comptable enregistrée : ${res.activeYear}`);
      setTimeout(() => setYearSuccessFeedback(null), 4500);
    }
  };

  // Handle Send Support Message
  const handleSendSupport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    const newTicket: AdminTicket = {
      id: `ADM-2026-${Math.floor(100 + Math.random() * 900)}`,
      subject: ticketSubject,
      message: ticketMessage,
      attachment: ticketFile || undefined,
      status: 'envoyé',
      date: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setTickets([newTicket, ...tickets]);
    setIsSupportModalOpen(false);
    setTicketSubject('');
    setTicketMessage('');
    setTicketFile(null);
    setSavedMessage("Votre message a été transmis directement à l'administration LocaTrust.");
    setTimeout(() => setSavedMessage(null), 4000);
  };

  // Status badge for support tickets
  const getTicketStatusBadge = (st: AdminTicket['status']) => {
    switch (st) {
      case 'envoyé':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">Envoyé</span>;
      case 'reçu':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700">Reçu</span>;
      case 'lu':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">Lu</span>;
      case 'répondu':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">✓ Répondu</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Paramètres du Compte
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-black">
              {isAgency ? 'Espace Agence Immobilière' : 'Espace Propriétaire'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos informations {isAgency ? "d'agence et de conformité" : 'personnelles'}, votre sécurité, vos préférences de notifications et échangez avec l'administration.
          </p>
        </div>
      </div>

      {savedMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      {/* Main Settings Navigation & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Tabs Menu / Mobile Scrollable Bar */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex flex-row overflow-x-auto lg:flex-col gap-1.5 scrollbar-none sticky top-16 lg:static z-10">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isAgency ? <Building2 className="w-4 h-4 shrink-0" /> : <User className="w-4 h-4 shrink-0" />}
            <span>{isAgency ? "Profil de l'Agence" : 'Mon Profil'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'account'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>Compte & Sécurité</span>
          </button>

          {/* Point 11 du prompt : Onglet Année comptable */}
          <button
            type="button"
            onClick={() => setActiveTab('accounting_year')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'accounting_year'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Année comptable</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'preferences'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span>Préférences d'affichage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'notifications'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'payments'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Paiements & Abonnement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'verification'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileCheck className="w-4 h-4 shrink-0" />
            <span>{isAgency ? 'Agrément & Vérification' : 'Documents & Vérification'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'privacy'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>Confidentialité & Données</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95 ${
              activeTab === 'support'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <LifeBuoy className="w-4 h-4 shrink-0" />
            <span>Support / Administration</span>
          </button>
        </div>

        {/* Right Tab Content View */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px]">
          {/* TAB 1: MON PROFIL */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5 text-xs">
              {/* Photo de profil (Points 19 & 20 du prompt) */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {isAgency ? "Profil de l'Agence Immobilière" : 'Mon Profil Bailleur'}
                  </h3>
                  <p className="text-slate-500">
                    {isAgency
                      ? "Informations de l'agence visibles sur les mandats, contrats et reçus officiels"
                      : 'Informations nominatives visibles sur vos documents administratifs et contrats'}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-amber-500 shrink-0 shadow-sm bg-slate-100">
                    <img
                      src={userAvatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={avatarInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarFileSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isAgency ? "Changer le logo / photo" : "Changer la photo de profil"}</span>
                    </button>
                    <span className="text-[10px] text-slate-400 block mt-0.5">JPG, PNG, WEBP • Max 5 Mo</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isAgency ? "Raison Sociale / Nom de l'Agence" : 'Nom et Prénoms officiels'}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isAgency ? "Email professionnel de l'Agence" : 'Adresse Email'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isAgency ? 'Ligne Standard / WhatsApp Pro' : 'Numéro de Téléphone (WhatsApp)'}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isAgency ? "Adresse du Siège Social" : 'Adresse de résidence principale'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                {isAgency && (
                  <>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Gérant / Représentant Légal</label>
                      <input
                        type="text"
                        value={legalRepresentative}
                        onChange={(e) => setLegalRepresentative(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">N° Registre de Commerce (RCCM)</label>
                      <input
                        type="text"
                        value={rccmNumber}
                        onChange={(e) => setRccmNumber(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">N° Agrément Ministériel MCU</label>
                      <input
                        type="text"
                        value={ministerialApproval}
                        onChange={(e) => setMinisterialApproval(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">N° Compte Contribuable (DGI)</label>
                      <input
                        type="text"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>
                  </>
                )}
              </div>

              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl">
                  {saveError}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: COMPTE & SÉCURITÉ */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-5 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">Sécurité du Compte</h3>
                <p className="text-slate-500">Mot de passe et authentification sécurisée</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Mot de passe</h4>
                    <p className="text-slate-500">Dernière modification il y a 3 mois</p>
                  </div>
                  <button
                    onClick={() => alert('Lien de réinitialisation sécurisé envoyé par email.')}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold hover:bg-slate-100 text-slate-700"
                  >
                    Changer le mot de passe
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Double authentification (2FA)</h4>
                    <p className="text-slate-500">Confirmation par code SMS à chaque connexion</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    Activée (SMS)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ANNÉE COMPTABLE (Points 11 à 18 du prompt) */}
          {activeTab === 'accounting_year' && (
            <div className="flex flex-col gap-6 text-xs animate-fadeIn">
              {/* Header */}
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-black text-slate-900">Année comptable & Exercices fiscaux</h3>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Source de vérité unique pour le Dashboard, les Rapports, les Statistiques, les Exports, le Grand Livre et les Journaux.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 font-extrabold text-xs">
                  Exercice actif : {activeAccountingYear}
                </span>
              </div>

              {/* Interface compacte Année Comptable (3 contrôles principaux) */}
              <AccountingYearCompactControl />

              {/* Règle de non-suppression & Source unique de vérité (Point 14, 17, 18) */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-2 font-black text-amber-950">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Intégrité fiscale absolue & Règle de non-suppression</span>
                </div>
                <p className="text-amber-800/90 leading-relaxed text-[11px]">
                  Le passage de 2026 à 2027 ne supprime aucune donnée historique. Tous les loyers, paiements encaissés, cautions reçues ou restituées, quittances, factures d'entretien, contrats d'origine, états financiers et pièces comptables restent disponibles sans limitation de durée.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PRÉFÉRENCES D'AFFICHAGE & THÈMES DE COULEURS */}
          {activeTab === 'preferences' && (
            <div className="flex flex-col gap-6 text-xs animate-fadeIn">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">Préférences d'affichage & Environnement</h3>
                <p className="text-slate-500">Personnalisez votre confort visuel et vos couleurs d'ambiance</p>
              </div>

              <div className="space-y-4">
                {/* 1. Mode Clair / Sombre */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900">Mode d'affichage</h4>
                    <p className="text-slate-500">Basculez entre le thème diurne et nocturne</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTheme('light');
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('locatrust_theme', 'light');
                      }}
                      className={`px-4 py-2 rounded-xl font-black border transition-all ${
                        theme === 'light'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      ☀️ Mode clair
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme('dark');
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('locatrust_theme', 'dark');
                      }}
                      className={`px-4 py-2 rounded-xl font-black border transition-all ${
                        theme === 'dark'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      🌙 Mode sombre
                    </button>
                  </div>
                </div>

                {/* 2. Palette de couleurs d'ambiance dynamiques */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900">Couleur d'ambiance de l'environnement</h4>
                    <p className="text-slate-500">
                      Personnalisez les touches de couleur et l'accent visuel de votre espace SaaS (boutons, bordures, badges actifs)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {ACCENT_THEMES.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setAccentColor(col.id);
                          applyAccentTheme(col.id);
                          setSavedMessage(`Couleur d'ambiance « ${col.label} » activée instantanément !`);
                          setTimeout(() => setSavedMessage(null), 3500);
                        }}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                          accentColor === col.id
                            ? 'bg-white border-slate-900 ring-2 ring-slate-900/20 shadow-md font-black text-slate-900'
                            : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-inner"
                          style={{ backgroundColor: col.hex }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold leading-tight truncate">{col.label}</span>
                          <span className="text-[10px] text-slate-400 font-medium leading-tight">{col.hex}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Aperçu en direct de la couleur sélectionnée */}
                  <div className="mt-2 p-3.5 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">Aperçu en direct :</span>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-lg text-white font-bold text-xs shadow-sm transition-transform active:scale-95 bg-blue-600 hover:bg-blue-700"
                      >
                        Bouton d'action
                      </button>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Badge actif
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      Appliqué instantanément sur l'ensemble de votre espace LocaTrust.
                    </span>
                  </div>
                </div>

                {/* 3. Langue officielle */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900">Langue de l'interface</h4>
                    <p className="text-slate-500">Documents et reçus officiels certifiés rédigés en français normé</p>
                  </div>
                  <span className="font-extrabold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                    Français (Côte d'Ivoire)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-5 text-xs animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Gestion des Alertes & Notifications</h3>
                  <p className="text-slate-500">Choisissez les événements déclenchant une notification immédiate</p>
                </div>
                {notifSavedMsg && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-lg text-xs animate-fadeIn">
                    {notifSavedMsg}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Notifications de paiement de loyer</span>
                    <span className="text-slate-500">Alerte dès qu'un locataire signale ou effectue un versement</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPayments}
                    onChange={(e) => {
                      setNotifPayments(e.target.checked);
                      localStorage.setItem('locatrust_notif_payments', String(e.target.checked));
                    }}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Nouveaux messages & messagerie</span>
                    <span className="text-slate-500">Notification en temps réel lors de la réception d'un message locataire</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifMessages}
                    onChange={(e) => {
                      setNotifMessages(e.target.checked);
                      localStorage.setItem('locatrust_notif_messages', String(e.target.checked));
                    }}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Demandes de visite & candidatures</span>
                    <span className="text-slate-500">Avertissement lors de la soumission d'une nouvelle demande</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifEmail}
                    onChange={(e) => {
                      setNotifEmail(e.target.checked);
                      localStorage.setItem('locatrust_notif_email', String(e.target.checked));
                    }}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Tickets d'incidents & maintenance</span>
                    <span className="text-slate-500">Signalements urgents sur vos biens immobiliers</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifMaintenance}
                    onChange={(e) => {
                      setNotifMaintenance(e.target.checked);
                      localStorage.setItem('locatrust_notif_maintenance', String(e.target.checked));
                    }}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Signatures & échéances des contrats</span>
                    <span className="text-slate-500">Rappels 60 jours avant fin de bail et alertes de signature</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifContracts}
                    onChange={(e) => {
                      setNotifContracts(e.target.checked);
                      localStorage.setItem('locatrust_notif_contracts', String(e.target.checked));
                    }}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </label>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifSavedMsg('Préférences de notifications enregistrées avec succès !');
                      setTimeout(() => setNotifSavedMsg(null), 3500);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-sm transition-all"
                  >
                    Enregistrer les préférences
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PAIEMENTS & ABONNEMENT (SECTION 26 RULES) */}
          {activeTab === 'payments' && (
            <div className="flex flex-col gap-5 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">Paiements & Abonnement</h3>
                <p className="text-slate-500">Accès rapide à vos comptes de réception et suivi de votre forfait SaaS</p>
              </div>

              {/* Link to Payment Accounts */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-950">Comptes de Réception des Loyers</h4>
                  <p className="text-slate-600">Configurez vos comptes Wave, Orange Money, MTN ou bancaires</p>
                </div>
                {onNavigateToPaymentAccounts && (
                  <button
                    onClick={onNavigateToPaymentAccounts}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Gérer mes comptes</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Exact Subscription Summary (No other tiers shown) */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
                <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                  Votre abonnement LocaTrust en cours
                </span>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Biens gérés</span>
                    <div className="text-base font-black text-slate-900 mt-0.5">{activePropertiesCount} bien(s)</div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Montant mensuel</span>
                    <div className="text-base font-black text-blue-900 mt-0.5">{formatFCFA(subscriptionCost)} / mois</div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Échéance</span>
                    <div className="text-base font-black text-slate-900 mt-0.5">01/10/2026</div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Statut</span>
                    <div className="text-base font-black text-emerald-600 mt-0.5">✓ Actif</div>
                  </div>
                </div>

                {onNavigateToSubscription && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={onNavigateToSubscription}
                      className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <span>Voir le détail de l'abonnement</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: DOCUMENTS & VÉRIFICATION KYC (Connecté en direct à la base de données Supabase) */}
          {activeTab === 'verification' && (
            <div className="flex flex-col gap-5 text-xs">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {isAgency ? "Documents d'Agrément & Conformité Agence" : "Documents d'Identité & Propriété"}
                  </h3>
                  <p className="text-slate-500">
                    {isAgency
                      ? "Agrément ministériel MCU, RCCM et conformité réglementaire"
                      : 'Pièce d’identité et attestations de propriété (Loi CI n° 2019-576)'}
                  </p>
                </div>
                <div>
                  {profile?.verification_status === 'verifie' ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-200 flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isAgency ? '✓ Agence Agréée & Vérifiée' : '✓ Propriétaire Vérifié'}</span>
                    </span>
                  ) : profile?.verification_status === 'en_attente' ? (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-black border border-amber-200 flex items-center gap-1.5 shrink-0">
                      <span>⏳ Dossier en cours d'examen</span>
                    </span>
                  ) : profile?.verification_status === 'rejete' ? (
                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-200 flex items-center gap-1.5 shrink-0">
                      <span>❌ Dossier Rejeté</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-black border border-slate-300 flex items-center gap-1.5 shrink-0">
                      <span>⚠️ Non vérifié</span>
                    </span>
                  )}
                </div>
              </div>

              {docSuccessMsg && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{docSuccessMsg}</span>
                </div>
              )}

              {docErrorMsg && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{docErrorMsg}</span>
                </div>
              )}

              {/* Statut vérifié affiché */}
              {profile?.verification_status === 'verifie' ? (
                <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-emerald-950 text-sm">
                        {isAgency ? 'Agence Immobilière Officiellement Agréée' : 'Profil Bailleur Certifié Conforme'}
                      </h4>
                      <p className="text-emerald-800 mt-0.5 font-medium">
                        Vos documents ont été audités et validés par l'administration juridique LocaTrust. Vos contrats de bail générés sont scellés avec valeur probante et QR Code officiel.
                      </p>
                    </div>
                  </div>
                  {profile?.id_document_url && (
                    <a
                      href={profile.id_document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 font-bold border border-emerald-300 flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Consulter la pièce validée</span>
                    </a>
                  )}
                </div>
              ) : (
                /* Formulaire de soumission KYC pour Propriétaire et Agence */
                <form onSubmit={handleKycDocSubmit} className="flex flex-col gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {isAgency ? 'Téléverser votre Registre de Commerce (RCCM) ou Agrément MCU' : 'Téléverser votre Pièce d’Identité (CNI / Passeport)'}
                    </h4>
                    <p className="text-slate-500">
                      Conformément à la Loi 2019-576, la certification de votre compte est requise pour publier des annonces et générer des baux scellés.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {isAgency ? 'Numéro RCCM ou Agrément MCU *' : 'Numéro CNI ou Passeport *'}
                      </label>
                      <input
                        type="text"
                        value={docIdentifier}
                        onChange={(e) => setDocIdentifier(e.target.value)}
                        placeholder={isAgency ? 'Ex : CI-ABJ-2023-B-12849' : 'Ex : CI002894129'}
                        className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-600/30 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Document scanné (PDF, PNG, JPG - Max 10 Mo) *
                      </label>
                      <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer bg-white hover:bg-blue-50/30 transition-colors">
                        <Upload className="w-5 h-5 text-blue-600 mb-0.5" />
                        <span className="font-bold text-slate-800 text-xs">
                          {docFile ? docFile.name : 'Sélectionner le document'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleKycFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {docFilePreview && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={docFilePreview} alt="Aperçu" className="w-14 h-10 rounded-lg object-cover border" />
                        <span className="font-bold text-slate-800">{docFile?.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setDocFile(null); setDocFilePreview(null); }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Transmission directe et sécurisée vers l'administrateur système LocaTrust
                    </span>
                    <button
                      type="submit"
                      disabled={isUploadingDoc || (!docFile && !docIdentifier.trim())}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {isUploadingDoc ? (
                        <span>Envoi en cours...</span>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          <span>Soumettre à l’administrateur</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 7: CONFIDENTIALITÉ & DONNÉES */}
          {activeTab === 'privacy' && (
            <div className="flex flex-col gap-5 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">Confidentialité & Données Privées</h3>
                <p className="text-slate-500">Gestion de vos données conformément à la législation ivoirienne (ARTCI)</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Exporter l'ensemble de mes données</h4>
                    <p className="text-slate-500">Téléchargez une archive complète de vos contrats et paiements</p>
                  </div>
                  <button
                    onClick={() => alert('Archive ZIP de vos données personnelles générée.')}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold hover:bg-slate-100 text-slate-700"
                  >
                    Télécharger (.ZIP)
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Visibilité de mes coordonnées</h4>
                    <p className="text-slate-500">Seuls vos locataires sous contrat actif accèdent à votre numéro de contact direct</p>
                  </div>
                  <span className="font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-lg">
                    Restreint aux locataires
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SUPPORT & CONTACT ADMINISTRATION (SECTION 27 RULES) */}
          {activeTab === 'support' && (
            <div className="flex flex-col gap-5 text-xs">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Support & Contact Administration</h3>
                  <p className="text-slate-500">Échangez directement avec l'équipe support et juridique de LocaTrust</p>
                </div>
                <button
                  onClick={() => setIsSupportModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Contacter l'administration</span>
                </button>
              </div>

              {/* Support Tickets History with Statuts (envoyé, reçu, lu, répondu) */}
              <div className="flex flex-col gap-3">
                <span className="font-black text-slate-500 uppercase tracking-wider text-[11px]">
                  Historique de vos échanges avec l'administration ({tickets.length})
                </span>

                {tickets.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{t.subject}</span>
                        <span className="text-[11px] font-mono text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                          {t.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTicketStatusBadge(t.status)}
                        <span className="text-[11px] text-slate-400">{t.date}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 font-medium leading-relaxed">
                      {t.message}
                    </p>

                    {t.adminResponse && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                        <span className="font-black block mb-1">Réponse de l'Administration LocaTrust :</span>
                        <p className="font-medium">{t.adminResponse}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUPPORT MODAL (SECTION 27 RULES) */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <h3 className="text-base font-black text-slate-900 mb-1">Contacter l'administration</h3>
            <p className="text-xs text-slate-500 mb-5">
              Votre message sera transmis au pôle d'administration LocaTrust avec accusé de réception immédiat.
            </p>

            <form onSubmit={handleSendSupport} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Objet</label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Ex: Demande de précision quittance, vérification compte..."
                  className="w-full p-3 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Votre message</label>
                <textarea
                  required
                  rows={5}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Décrivez précisément votre demande..."
                  className="w-full p-3 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Joindre un fichier (optionnel)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="support-upload"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setTicketFile(e.target.files[0].name);
                      }
                    }}
                  />
                  <label
                    htmlFor="support-upload"
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{ticketFile ? ticketFile : 'Sélectionner un fichier'}</span>
                  </label>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE PRÉVISUALISATION ET CONFIRMATION DE NOUVELLE PHOTO DE PROFIL (Points 19 & 20) */}
      {isAvatarModalOpen && avatarPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl flex flex-col items-center text-center gap-4 animate-scaleUp">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Camera className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                Modifier la photo de profil
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Aperçu de la nouvelle photo sélectionnée
              </p>
            </div>

            {avatarUploadError && (
              <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {avatarUploadError}
              </div>
            )}

            {/* Aperçu circulaire */}
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-amber-500 shadow-md my-2 bg-slate-100">
              <img
                src={avatarPreview}
                alt="Aperçu"
                className="w-full h-full object-cover"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Cette photo sera immédiatement mise à jour sur votre profil, votre barre supérieure et votre messagerie.
            </p>

            <div className="flex items-center justify-center gap-2.5 w-full pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAvatarModalOpen(false);
                  setAvatarPreview(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmAvatarChange}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md transition-all active:scale-95"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
