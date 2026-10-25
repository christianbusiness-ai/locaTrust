'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Sparkles,
  X,
  ExternalLink,
  Share2,
  Send,
  Info,
  DollarSign,
  Key,
  Home,
  UserCheck
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { formatFCFA } from '@/lib/utils';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { UserAvatar } from '@/components/common/UserAvatar';

export interface ExistingTenantData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  cniNumber?: string;
  avatarUrl?: string;
  verificationStatus: string;
}

export interface ExistingRentalData {
  tenant: ExistingTenantData;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  propertyCity: string;
  propertyCommune: string;
  propertyType: string;
  leaseType: 'habitation' | 'professionnel';
  entryDate: string;
  monthlyRent: number;
  chargesAmount: number;
  cautionAmount: number;
  paymentFrequency: 'mensuel' | 'trimestriel';
  dueDay: number;
  durationMonths: number;
  // Données historiques déclarées (Section 8 & 23)
  historicalCautionPaid?: number;
  historicalCautionDate?: string;
  historicalPaymentMethod?: string;
  historicalHasReceipts?: boolean;
  historicalNotes?: string;
}

interface AddExistingTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueToContract: (rentalData: ExistingRentalData) => void;
  isAgency?: boolean;
}

/**
 * Masque une adresse e-mail pour préserver la vie privée (Section 5)
 * Ex: christianyaokoffi88@gmail.com -> c***8@gmail.com
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '******';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masque un numéro de téléphone pour préserver la vie privée
 * Ex: 0500552141 -> 05•• •• 41
 */
function maskPhone(phone: string): string {
  if (!phone) return 'Non renseigné';
  const clean = phone.trim();
  if (clean.length < 6) return '••••••';
  return `${clean.slice(0, 3)} •• •• ${clean.slice(-2)}`;
}

export const AddExistingTenantModal: React.FC<AddExistingTenantModalProps> = ({
  isOpen,
  onClose,
  onContinueToContract,
  isAgency = false
}) => {
  const { user, profile } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [foundTenant, setFoundTenant] = useState<ExistingTenantData | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Properties list of current owner/agency
  const [properties, setProperties] = useState<any[]>([]);
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(false);

  // Form state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [leaseType, setLeaseType] = useState<'habitation' | 'professionnel'>('habitation');
  const [entryDate, setEntryDate] = useState<string>(() => {
    // Par défaut date du 1er du mois en cours
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [monthlyRent, setMonthlyRent] = useState<number>(150000);
  const [chargesAmount, setChargesAmount] = useState<number>(0);
  const [cautionAmount, setCautionAmount] = useState<number>(300000); // 2 mois par défaut (Loi 2019-576 Art. 414)
  const [paymentFrequency, setPaymentFrequency] = useState<'mensuel' | 'trimestriel'>('mensuel');
  const [dueDay, setDueDay] = useState<number>(5);
  const [durationMonths, setDurationMonths] = useState<number>(12);

  // Données historiques déclarées (Section 8 & 23)
  const [showHistoricalFields, setShowHistoricalFields] = useState(false);
  const [historicalCautionPaid, setHistoricalCautionPaid] = useState<number>(0);
  const [historicalCautionDate, setHistoricalCautionDate] = useState<string>('');
  const [historicalPaymentMethod, setHistoricalPaymentMethod] = useState<string>('Wave CI / Mobile Money');
  const [historicalHasReceipts, setHistoricalHasReceipts] = useState<boolean>(true);
  const [historicalNotes, setHistoricalNotes] = useState<string>('');

  // Invitation state (Section 17)
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [inviteeName, setInviteeName] = useState('');

  // Validation & conflict alerts
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Charger les biens appartenant strictement au propriétaire ou à l'agence connectée
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    async function fetchOwnerProperties() {
      setIsLoadingProps(true);
      try {
        // 1. Charger les propriétés de l'utilisateur
        const { data: propsData } = await supabase
          .from('properties')
          .select('*')
          .or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        // 2. Charger les contrats actifs pour détecter les logements occupés
        const { data: cntData } = await supabase
          .from('contracts')
          .select('id, contract_number, property_id, tenant_id, status, monthly_rent, caution_amount')
          .or(`owner_id.eq.${user.id},agency_id.eq.${user.id}`)
          .in('status', ['actif', 'contrat_actif']);

        setProperties(propsData || []);
        setActiveContracts(cntData || []);

        if (propsData && propsData.length > 0 && !selectedPropertyId) {
          // Présélectionner le premier bien
          const firstProp = propsData[0];
          setSelectedPropertyId(firstProp.id);
          if (firstProp.rent) setMonthlyRent(Number(firstProp.rent));
          if (firstProp.charges) setChargesAmount(Number(firstProp.charges));
          if (firstProp.caution) {
            setCautionAmount(Number(firstProp.caution));
          } else if (firstProp.rent) {
            setCautionAmount(Number(firstProp.rent) * 2);
          }
          if (firstProp.usage_destination === 'professionnel') {
            setLeaseType('professionnel');
          }
        }
      } catch (err) {
        console.warn('Erreur chargement biens propriétaire:', err);
      } finally {
        setIsLoadingProps(false);
      }
    }

    fetchOwnerProperties();
  }, [isOpen, user?.id]);

  // Détection du bien sélectionné
  const selectedProperty = useMemo(() => {
    return properties.find((p) => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  // Vérification de conflit sur le bien sélectionné (Section 20 & 21)
  const propertyConflict = useMemo(() => {
    if (!selectedPropertyId) return null;
    const existingContract = activeContracts.find(
      (c) => c.property_id === selectedPropertyId
    );
    if (!existingContract) return null;

    if (foundTenant && existingContract.tenant_id === foundTenant.id) {
      return {
        type: 'same_tenant',
        message: 'Ce locataire possède déjà un contrat actif pour ce logement.'
      };
    }

    return {
      type: 'different_tenant',
      message: 'Ce logement possède déjà un contrat actif avec un autre locataire. Vérifiez la situation avant d\'ajouter un nouveau locataire.'
    };
  }, [selectedPropertyId, activeContracts, foundTenant]);

  // Recalculer le loyer et la caution lors du changement de bien
  const handlePropertyChange = (propId: string) => {
    setSelectedPropertyId(propId);
    setFormError(null);
    const prop = properties.find((p) => p.id === propId);
    if (prop) {
      const rent = Number(prop.rent || prop.price || 150000);
      setMonthlyRent(rent);
      setChargesAmount(Number(prop.charges || 0));
      // Plafond légal 2 mois Art. 414 Loi 2019-576
      const caution = prop.caution ? Number(prop.caution) : rent * 2;
      setCautionAmount(caution);
      if (prop.usage_destination === 'professionnel') {
        setLeaseType('professionnel');
      }
    }
  };

  // RECHERCHE DU LOCATAIRE (Section 4)
  const handleSearchTenant = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Veuillez saisir un identifiant LocaTrust, une adresse e-mail ou un numéro de téléphone.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchAttempted(true);
    setFoundTenant(null);

    try {
      let sbQuery = supabase
        .from('profiles')
        .select('id, full_name, email, phone, cni_number, avatar_url, verification_status, account_type')
        .eq('account_type', 'locataire');

      // Détecter le type de recherche
      const isEmail = query.includes('@');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);

      if (isUuid) {
        sbQuery = sbQuery.eq('id', query);
      } else if (isEmail) {
        sbQuery = sbQuery.ilike('email', query.toLowerCase());
      } else {
        // Recherche par téléphone ou début d'identifiant
        const digitsOnly = query.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 8) {
          sbQuery = sbQuery.ilike('phone', `%${digitsOnly}%`);
        } else {
          sbQuery = sbQuery.or(`id.ilike.%${query}%,full_name.ilike.%${query}%`);
        }
      }

      const { data, error } = await sbQuery.limit(1).maybeSingle();

      if (error) {
        setSearchError('Erreur lors de la recherche. Veuillez vérifier votre saisie.');
        return;
      }

      if (!data) {
        // Aucun locataire trouvé -> Proposition d'invitation (Section 17)
        setFoundTenant(null);
        return;
      }

      // Locataire trouvé (Section 5)
      setFoundTenant({
        id: data.id,
        fullName: data.full_name || 'Locataire LocaTrust',
        email: data.email || '',
        phone: data.phone || '',
        cniNumber: data.cni_number || '',
        avatarUrl: data.avatar_url || '',
        verificationStatus: data.verification_status || 'non_verifie'
      });
    } catch (err: any) {
      setSearchError(err?.message || 'Erreur imprévue lors de la recherche.');
    } finally {
      setIsSearching(false);
    }
  };

  // Message d'invitation généré (Section 17)
  const invitationMessage = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://locatrust.ci';
    const registerUrl = `${origin}/register?role=locataire`;
    const ownerDisplayName = profile?.full_name || user?.user_metadata?.full_name || 'Votre bailleur';
    const propTitle = selectedProperty?.title || 'notre logement';

    return `Bonjour ${inviteeName.trim() || 'cher locataire'},\n\nDans le cadre de la gestion et de la sécurisation officielle de votre bail pour ${propTitle} sur la plateforme LocaTrust, merci de créer votre compte locataire gratuit en cliquant sur le lien suivant :\n${registerUrl}\n\nUne fois votre compte créé, transmettez-moi simplement votre e-mail ou votre identifiant LocaTrust afin que je puisse formaliser votre contrat officiel avec QR Code certifié.\n\nCordialement,\n${ownerDisplayName}`;
  }, [inviteeName, selectedProperty, profile, user]);

  const handleCopyInvitation = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(invitationMessage);
      setInvitationCopied(true);
      setTimeout(() => setInvitationCopied(false), 3000);
    }
  };

  // SOUMISSION ET REDIRECTION VERS LE CONTRAT (Sections 9, 10, 11)
  const handleContinueToContract = async () => {
    if (!foundTenant) {
      setFormError('Veuillez d\'abord rechercher et sélectionner un locataire existant.');
      return;
    }

    if (!selectedPropertyId) {
      setFormError('Veuillez sélectionner le bien immobilier concerné.');
      return;
    }

    if (propertyConflict && propertyConflict.type === 'different_tenant') {
      setFormError(propertyConflict.message);
      return;
    }

    if (monthlyRent <= 0) {
      setFormError('Veuillez renseigner un montant de loyer mensuel valide.');
      return;
    }

    // Validation conformité Loi 2019-576 Art. 414 : Caution plafonnée à 2 mois pour bail d'habitation
    if (leaseType === 'habitation' && cautionAmount > monthlyRent * 2) {
      setFormError(`Conformément à l'Article 414 de la Loi ivoirienne n° 2019-576, le dépôt de garantie pour un bail d'habitation est strictement plafonné à 2 mois de loyer (${formatFCFA(monthlyRent * 2)}).`);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const ownerDisplayName = profile?.full_name || user?.user_metadata?.full_name || (isAgency ? 'Agence Immobilière' : 'Bailleur Propriétaire');
    const propTitle = selectedProperty?.title || 'Bien immobilier';
    const propAddress = selectedProperty?.address || `${selectedProperty?.commune || ''} ${selectedProperty?.city || 'Abidjan'}`.trim();

    try {
      // 1. Enregistrement en base de données Supabase (table rental_applications)
      // pour inscrire la relation existante de manière sécurisée et persistante
      const appPayload: Record<string, any> = {
        property_id: selectedPropertyId,
        tenant_name: foundTenant.fullName,
        tenant_phone: foundTenant.phone,
        tenant_email: foundTenant.email,
        tenant_cni: foundTenant.cniNumber || '',
        tenant_avatar: foundTenant.avatarUrl || '',
        property_title: propTitle,
        property_address: propAddress,
        rent_amount: monthlyRent,
        caution_amount: cautionAmount,
        status: 'dossier_valide',
        dossier_status: 'complet',
        documents: {
          isExistingTenantImport: true,
          leaseType,
          entryDate,
          paymentFrequency,
          dueDay,
          durationMonths,
          historicalCautionPaid: showHistoricalFields ? historicalCautionPaid : undefined,
          historicalCautionDate: showHistoricalFields ? historicalCautionDate : undefined,
          historicalPaymentMethod: showHistoricalFields ? historicalPaymentMethod : undefined,
          historicalHasReceipts: showHistoricalFields ? historicalHasReceipts : undefined,
          historicalNotes: showHistoricalFields ? historicalNotes : undefined
        }
      };

      if (foundTenant.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(foundTenant.id)) {
        appPayload.tenant_id = foundTenant.id;
      }
      if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(user.id)) {
        if (profile?.account_type === 'agence' || isAgency) {
          appPayload.agency_id = user.id;
        } else {
          appPayload.owner_id = user.id;
        }
      }

      try {
        const { data: existingApp } = await supabase
          .from('rental_applications')
          .select('id')
          .eq('property_id', selectedPropertyId)
          .eq('tenant_id', foundTenant.id)
          .maybeSingle();

        if (existingApp?.id) {
          await supabase
            .from('rental_applications')
            .update(appPayload)
            .eq('id', existingApp.id);
        } else {
          await supabase
            .from('rental_applications')
            .insert([appPayload]);
        }
      } catch (dbErr) {
        console.warn('Persistance Supabase rental_applications notice:', dbErr);
      }

      // 2. Persistance de la notification dans la table Supabase 'notifications' (Section 15)
      try {
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: foundTenant.id,
          title: 'Nouvelle relation locative',
          message: `Le bailleur ${ownerDisplayName} souhaite vous associer au logement "${propTitle}" et prépare votre contrat de location officiel.`,
          description: `Le bailleur ${ownerDisplayName} souhaite vous associer au logement "${propTitle}" et prépare votre contrat de location officiel.`,
          category: 'contrat',
          type: 'contrat',
          is_read: false,
          read: false,
          data: {
            property_id: selectedPropertyId,
            owner_id: user?.id,
            targetTab: 'contrats'
          }
        }]);
      } catch (notifDbErr) {
        console.warn('Persistance notification Supabase notice:', notifDbErr);
      }

      // 3. Notification locale et broadcast Realtime
      const tenantNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: 'Nouvelle relation locative',
        description: `Le bailleur ${ownerDisplayName} souhaite vous associer au logement "${propTitle}" et prépare votre contrat de location officiel.`,
        timestamp: new Date().toISOString(),
        read: false,
        unread: true,
        category: 'contrat',
        targetTab: 'contrats',
        targetUserId: foundTenant.id,
        targetRole: 'locataire',
        senderUserId: user?.id,
        senderAvatar: profile?.avatar_url || user?.user_metadata?.avatar_url
      };

      if (typeof window !== 'undefined') {
        const rawNotifs = localStorage.getItem('locatrust_notifications');
        const existingNotifs = rawNotifs ? JSON.parse(rawNotifs) : [];
        localStorage.setItem(
          'locatrust_notifications',
          JSON.stringify([tenantNotif, ...(Array.isArray(existingNotifs) ? existingNotifs : [])])
        );
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
      }

      broadcastLiveEvent('NEW_NOTIFICATION', {
        targetUserId: foundTenant.id,
        notification: tenantNotif
      });

      // 4. Préparation des données d'importation locative pour préremplir le contrat
      const rentalData: ExistingRentalData = {
        tenant: foundTenant,
        propertyId: selectedPropertyId,
        propertyTitle: propTitle,
        propertyAddress: propAddress,
        propertyCity: selectedProperty?.city || 'Abidjan',
        propertyCommune: selectedProperty?.commune || 'Cocody',
        propertyType: selectedProperty?.type || 'appartement',
        leaseType,
        entryDate,
        monthlyRent,
        chargesAmount,
        cautionAmount,
        paymentFrequency,
        dueDay,
        durationMonths,
        historicalCautionPaid: showHistoricalFields ? historicalCautionPaid : undefined,
        historicalCautionDate: showHistoricalFields ? historicalCautionDate : undefined,
        historicalPaymentMethod: showHistoricalFields ? historicalPaymentMethod : undefined,
        historicalHasReceipts: showHistoricalFields ? historicalHasReceipts : undefined,
        historicalNotes: showHistoricalFields ? historicalNotes : undefined
      };

      // 5. Fermer ce modal et rediriger vers le workflow contractuel certifié existant
      onClose();
      onContinueToContract(rentalData);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl my-auto sm:my-6 max-h-[96vh] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col font-sans transition-all">
        
        {/* ============================================================== */}
        {/* 1. HEADER DU MODAL (Section 3)                                  */}
        {/* ============================================================== */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900 text-white flex items-center justify-between border-b border-blue-950/50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner shrink-0">
              <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  Ajouter un locataire existant
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-400/20 shrink-0">
                  {isAgency ? 'Espace Agence' : 'Espace Propriétaire'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-blue-200/80 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Ajoutez un locataire qui occupe déjà l'un de vos logements avant votre arrivée sur LocaTrust.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all shrink-0 ml-2"
            title="Fermer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* ============================================================== */}
        {/* 2. CORPS DU MODAL                                              */}
        {/* ============================================================== */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4 sm:space-y-6">

          {/* MESSAGE D'ALERTE D'ERREUR GLOBALE */}
          {formError && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{formError}</div>
              <button onClick={() => setFormError(null)} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* ÉTAPE 1 : RECHERCHE DU LOCATAIRE (Section 4 & 5)               */}
          {/* ============================================================== */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Identification du compte locataire
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Recherche sécurisée sans divulgation
              </span>
            </div>

            <form onSubmit={handleSearchTenant} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (searchError) setSearchError(null);
                  }}
                  placeholder="Saisir l'adresse e-mail, téléphone ou identifiant LocaTrust..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 shrink-0"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Rechercher le compte</span>
              </button>
            </form>

            {searchError && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{searchError}</span>
              </p>
            )}

            {/* CAS A : LOCATAIRE TROUVÉ (Section 5) */}
            {foundTenant && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-center gap-3.5">
                  <UserAvatar
                    avatarUrl={foundTenant.avatarUrl}
                    name={foundTenant.fullName}
                    size="lg"
                    role="locataire"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {foundTenant.fullName}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Compte vérifié
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>E-mail : <strong className="font-semibold text-slate-700 dark:text-slate-300">{maskEmail(foundTenant.email)}</strong></span>
                      <span>•</span>
                      <span>Tél : <strong className="font-semibold text-slate-700 dark:text-slate-300">{maskPhone(foundTenant.phone)}</strong></span>
                      <span>•</span>
                      <span className="text-[10px] font-mono text-slate-400">ID: {foundTenant.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    Locataire sélectionné
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFoundTenant(null);
                      setSearchQuery('');
                      setSearchAttempted(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Changer de locataire"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* CAS B : LOCATAIRE NON TROUVÉ -> INVITATION (Section 17) */}
            {!foundTenant && searchAttempted && !isSearching && (
              <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <h4 className="text-xs font-black">
                    Ce locataire ne possède pas encore de compte LocaTrust.
                  </h4>
                </div>

                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  Pour garantir la valeur juridique et la signature certifiée du contrat, votre locataire doit disposer de son propre compte LocaTrust (inscription gratuite en 1 minute). Vous pouvez lui transmettre une invitation dès maintenant :
                </p>

                <div className="pt-2 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={inviteeName}
                      onChange={(e) => setInviteeName(e.target.value)}
                      placeholder="Nom du locataire (ex: M. Kouamé)"
                      className="px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-semibold outline-none flex-1"
                    />

                    <button
                      type="button"
                      onClick={handleCopyInvitation}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0"
                    >
                      {invitationCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Message copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-blue-400" />
                          <span>Copier l'invitation</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(invitationMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Envoyer sur WhatsApp</span>
                    </a>
                  </div>

                  <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/80 dark:border-amber-800/40 text-[11px] text-slate-600 dark:text-slate-400 font-mono whitespace-pre-line leading-relaxed">
                    {invitationMessage}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* ÉTAPE 2 : SÉLECTION DU LOGEMENT & SITUATION LOCATIVE           */}
          {/* ============================================================== */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Logement concerné & Situation locative actuelle
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Bien du bailleur ou de l'agence
              </span>
            </div>

            {/* SÉLECTEUR DE BIEN */}
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Logement / Bien occupé par le locataire <span className="text-red-500">*</span>
              </label>

              {isLoadingProps ? (
                <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Chargement de votre parc immobilier...</span>
                </div>
              ) : properties.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                  Aucun bien immobilier enregistré dans votre compte. Veuillez d'abord créer un bien dans l'onglet « Biens » avant d'ajouter un locataire existant.
                </div>
              ) : (
                <select
                  value={selectedPropertyId}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                >
                  <option value="">-- Sélectionnez le logement concerné --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {p.commune ? `${p.commune}, ${p.city || 'Abidjan'}` : p.city || 'Abidjan'} ({formatFCFA(p.rent || 0)}/mois)
                    </option>
                  ))}
                </select>
              )}

              {/* DÉTECTION DE CONFLIT / OCCUPATION (Section 20 & 21) */}
              {propertyConflict && (
                <div className={`mt-2 p-3 rounded-xl text-xs flex items-start gap-2 ${
                  propertyConflict.type === 'different_tenant'
                    ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Attention :</strong> {propertyConflict.message}
                  </div>
                </div>
              )}
            </div>

            {/* GRILLE DES PARAMÈTRES LOCATIFS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              
              {/* Type de bail */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Type de bail
                </label>
                <select
                  value={leaseType}
                  onChange={(e) => setLeaseType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                >
                  <option value="habitation">Bail d'habitation (Résidentiel - Loi 2019-576)</option>
                  <option value="professionnel">Bail commercial / Pro (AUDCG OHADA)</option>
                </select>
              </div>

              {/* Date d'entrée effective */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Date d'entrée dans les lieux <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                />
              </div>

              {/* Durée du bail */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Durée contractuelle
                </label>
                <select
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                >
                  <option value={12}>1 an (12 mois) renouvelable</option>
                  <option value={24}>2 ans (24 mois)</option>
                  <option value={36}>3 ans (36 mois commercial)</option>
                </select>
              </div>

              {/* Loyer mensuel */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Loyer mensuel hors charges (FCFA) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={monthlyRent}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setMonthlyRent(r);
                    // Mettre à jour la caution suggérée si non personnalisée
                    if (leaseType === 'habitation') setCautionAmount(r * 2);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold outline-none"
                />
              </div>

              {/* Charges locatives */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Charges locatives mensuelles (FCFA)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={chargesAmount}
                  onChange={(e) => setChargesAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                />
              </div>

              {/* Montant de la caution */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Caution légale (FCFA) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                    Max 2 mois (Art. 414)
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={cautionAmount}
                  onChange={(e) => setCautionAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold outline-none"
                />
              </div>

              {/* Fréquence de règlement */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Périodicité de paiement
                </label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                >
                  <option value="mensuel">Mensuelle (terme à échoir)</option>
                  <option value="trimestriel">Trimestrielle</option>
                </select>
              </div>

              {/* Jour d'échéance */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Jour d'échéance du mois
                </label>
                <select
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                >
                  <option value={1}>1er du mois</option>
                  <option value={5}>Le 5 du mois (Recommandé)</option>
                  <option value={10}>Le 10 du mois</option>
                  <option value={15}>Le 15 du mois</option>
                </select>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* ÉTAPE 3 : INFORMATIONS HISTORIQUES DÉCLARÉES (Section 8 & 23)   */}
          {/* ============================================================== */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Antériorité & Données historiques (Facultatif)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoricalFields(!showHistoricalFields)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>{showHistoricalFields ? 'Masquer' : 'Renseigner l\'historique existant'}</span>
              </button>
            </div>

            {showHistoricalFields && (
              <div className="space-y-3 pt-2 animate-fadeIn">
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Transparence & Intégrité Fiscale (Section 23) :</strong> Les montants de caution ou paiements antérieurs renseignés ici sont enregistrés à titre <em>historique et déclaratif</em>. Ils figureront dans le dossier d'antériorité du locataire sans être confondus avec des transactions encaissées nativement sur LocaTrust.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      Caution déjà versée au bailleur (FCFA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={historicalCautionPaid}
                      onChange={(e) => setHistoricalCautionPaid(Number(e.target.value))}
                      placeholder="Ex: 300000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      Date de versement initial
                    </label>
                    <input
                      type="date"
                      value={historicalCautionDate}
                      onChange={(e) => setHistoricalCautionDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      Mode de règlement historique
                    </label>
                    <select
                      value={historicalPaymentMethod}
                      onChange={(e) => setHistoricalPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                    >
                      <option value="Espèces (cash)">Espèces (cash)</option>
                      <option value="Wave CI / Mobile Money">Wave CI / Mobile Money</option>
                      <option value="Orange Money">Orange Money</option>
                      <option value="MTN MoMo">MTN MoMo</option>
                      <option value="Virement Bancaire">Virement Bancaire</option>
                      <option value="Chèque">Chèque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Observations particulières (antériorité, états des lieux antérieurs, etc.)
                  </label>
                  <textarea
                    rows={2}
                    value={historicalNotes}
                    onChange={(e) => setHistoricalNotes(e.target.value)}
                    placeholder="Ex: Locataire déjà en place depuis 2 ans, paiements réguliers, quittances physiques délivrées jusqu'à ce jour..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-normal outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. FOOTER : BOUTON CONTINUER VERS LE CONTRAT (Section 9)       */}
        {/* ============================================================== */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {foundTenant ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 justify-center sm:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Locataire prêt à être associé à votre contrat</span>
              </span>
            ) : (
              <span className="truncate block">Recherchez le compte locataire pour continuer</span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-all w-24 sm:w-auto shrink-0 text-center"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={!foundTenant || !selectedPropertyId || (propertyConflict?.type === 'different_tenant') || isSaving}
              onClick={handleContinueToContract}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/30 text-center"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span className="truncate">Préparation en cours...</span>
                </>
              ) : (
                <>
                  <span className="truncate">Continuer vers le contrat</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
