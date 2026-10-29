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
  UserCheck,
  MapPin
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { formatFCFA } from '@/lib/utils';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { UserAvatar } from '@/components/common/UserAvatar';
import { IVORIAN_CITIES } from '@/lib/legalAnalysisEngine';
import { createProperty } from '@/lib/supabase/services';

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
  propertyRooms?: number;
  propertyBedrooms?: number;
  propertyBathrooms?: number;
  propertySurface?: number;
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

/**
 * Composant de saisie monétaire naturelle (Section 13, 14, 15, 16, 17)
 * Permet d'écrire naturellement sans être bloqué par le 0 initial.
 * Si la valeur est 0 et qu'on tape 1 -> devient 1 (et non 01).
 */
interface NaturalCurrencyInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

const NaturalCurrencyInput: React.FC<NaturalCurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  className = '',
  required = false,
  id
}) => {
  const [text, setText] = useState<string>(() => (value === 0 ? '0' : String(value)));

  useEffect(() => {
    const num = Number(text.replace(/\s/g, ''));
    if (!Number.isNaN(num) && num !== value) {
      setText(value === 0 ? '0' : String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (raw === '') {
      setText('');
      onChange(0);
      return;
    }

    const digits = raw.replace(/[^0-9]/g, '');

    if (digits === '') {
      setText('');
      onChange(0);
      return;
    }

    // Supprime les zéros surnuméraires en tête : '0' + '1' -> '1', '0' + '25000' -> '25000'
    const cleaned = digits.replace(/^0+(?=\d)/, '');
    const parsed = Number(cleaned);

    setText(cleaned);
    onChange(Number.isNaN(parsed) ? 0 : parsed);
  };

  const handleBlur = () => {
    if (text === '' || text.trim() === '') {
      setText('0');
      onChange(0);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      required={required}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};

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

  // Form state : INFORMATIONS DU LOGEMENT (Section 9 & 10 - saisie directe du logement)
  const [propertyTitle, setPropertyTitle] = useState('Logement 3 pièces');
  const [propertyType, setPropertyType] = useState('appartement');
  const [customPropertyType, setCustomPropertyType] = useState('');
  const [propertyCountry, setPropertyCountry] = useState("Côte d'Ivoire");
  const [propertyCity, setPropertyCity] = useState('Abidjan');
  const [propertyCommune, setPropertyCommune] = useState('Cocody');
  const [propertyQuartier, setPropertyQuartier] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyRooms, setPropertyRooms] = useState<number>(3);
  const [propertyBedrooms, setPropertyBedrooms] = useState<number>(2);
  const [propertyBathrooms, setPropertyBathrooms] = useState<number>(1);
  const [propertySurface, setPropertySurface] = useState<number>(75);

  // Form state : CONDITIONS DU BAIL (Section 11)
  const [leaseType, setLeaseType] = useState<'habitation' | 'professionnel'>('habitation');
  const [entryDate, setEntryDate] = useState<string>(() => {
    // Par défaut date du 1er du mois en cours
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [monthlyRent, setMonthlyRent] = useState<number>(25000);
  const [chargesAmount, setChargesAmount] = useState<number>(0);
  const [cautionAmount, setCautionAmount] = useState<number>(50000); // 2 mois par défaut (Loi 2019-576 Art. 414)
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

  // RECHERCHE DU LOCATAIRE (Section 2, 3, 4, 5, 6, 7)
  const handleSearchTenant = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Veuillez saisir un nom, prénom, e-mail, numéro de téléphone ou identifiant LocaTrust.');
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

      const isEmail = query.includes('@');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);

      if (isUuid) {
        sbQuery = sbQuery.eq('id', query);
      } else if (isEmail) {
        sbQuery = sbQuery.ilike('email', query.toLowerCase());
      } else {
        const digitsOnly = query.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 8) {
          sbQuery = sbQuery.or(`phone.ilike.%${digitsOnly}%,cni_number.ilike.%${query}%`);
        } else {
          // Découpage multi-tokens pour correspondre dans n'importe quel ordre
          // Ex: "Zouzoua laurence" retrouve le profil avec full_name "Laurence Zouzoua"
          const tokens = query.split(/\s+/).filter(Boolean);
          for (const token of tokens) {
            sbQuery = sbQuery.ilike('full_name', `%${token}%`);
          }
        }
      }

      const { data, error } = await sbQuery.limit(5);

      if (error) {
        console.error('Erreur technique recherche profil locataire:', error);
        setSearchError('Impossible d\'effectuer la recherche pour le moment. Veuillez réessayer.');
        return;
      }

      if (!data || data.length === 0) {
        // Aucun compte correspondant trouvé (Section 6)
        setFoundTenant(null);
        return;
      }

      // Locataire trouvé (Section 5 & 8)
      const matched = data[0];
      setFoundTenant({
        id: matched.id,
        fullName: matched.full_name || 'Locataire LocaTrust',
        email: matched.email || '',
        phone: matched.phone || '',
        cniNumber: matched.cni_number || '',
        avatarUrl: matched.avatar_url || '',
        verificationStatus: matched.verification_status || 'non_verifie'
      });
    } catch (err: any) {
      console.error('Exception imprévue lors de la recherche:', err);
      setSearchError('Impossible d\'effectuer la recherche pour le moment. Veuillez réessayer.');
    } finally {
      setIsSearching(false);
    }
  };

  // Message d'invitation généré (Section 17)
  const invitationMessage = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://locatrust.ci';
    const registerUrl = `${origin}/register?role=locataire`;
    const ownerDisplayName = profile?.full_name || user?.user_metadata?.full_name || (isAgency ? 'Votre agence immobilière' : 'Votre bailleur');
    const propTitle = propertyTitle.trim() || 'notre logement';

    return `Bonjour ${inviteeName.trim() || 'cher locataire'},\n\nDans le cadre de la gestion et de la sécurisation officielle de votre bail pour ${propTitle} sur la plateforme LocaTrust, merci de créer votre compte locataire gratuit en cliquant sur le lien suivant :\n${registerUrl}\n\nUne fois votre compte créé, transmettez-moi simplement votre e-mail ou votre identifiant LocaTrust afin que je puisse formaliser votre contrat officiel avec QR Code certifié.\n\nCordialement,\n${ownerDisplayName}`;
  }, [inviteeName, propertyTitle, profile, user, isAgency]);

  const handleCopyInvitation = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(invitationMessage);
      setInvitationCopied(true);
      setTimeout(() => setInvitationCopied(false), 3000);
    }
  };

  // SOUMISSION ET REDIRECTION VERS LE CONTRAT (Sections 9, 10, 11, 18, 19, 20, 21)
  const handleContinueToContract = async () => {
    if (!foundTenant) {
      setFormError('Veuillez d\'abord rechercher et sélectionner un locataire existant.');
      return;
    }

    const trimmedTitle = propertyTitle.trim();
    if (!trimmedTitle) {
      setFormError('Veuillez renseigner la désignation ou le nom du logement.');
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
    const finalPropertyType = propertyType === 'autre' ? (customPropertyType.trim() || 'Logement') : propertyType;
    const computedFullAddress = propertyAddress.trim() || `${propertyQuartier ? propertyQuartier.trim() + ', ' : ''}${propertyCommune}, ${propertyCity}`.trim();

    try {
      // 1. Enregistrement / Persistance réelle du logement en base de données Supabase
      const newPropertyId = crypto.randomUUID();
      const currentPublisherId = user?.id || profile?.id || 'owner_default';

      const propertyPayload = {
        id: newPropertyId,
        owner_id: currentPublisherId,
        agency_id: isAgency ? currentPublisherId : null,
        type: finalPropertyType,
        title: trimmedTitle,
        description: `Logement existant occupé par ${foundTenant.fullName} depuis le ${entryDate}`,
        country: propertyCountry.trim() || "Côte d'Ivoire",
        city: propertyCity.trim() || 'Abidjan',
        commune: propertyCommune.trim() || 'Cocody',
        quartier: propertyQuartier.trim() || 'Centre',
        address: computedFullAddress,
        surface: propertySurface > 0 ? propertySurface : null,
        rooms: propertyRooms > 0 ? propertyRooms : 1,
        bedrooms: propertyBedrooms >= 0 ? propertyBedrooms : 1,
        bathrooms: propertyBathrooms >= 0 ? propertyBathrooms : 1,
        rent: monthlyRent,
        caution: cautionAmount,
        charges: chargesAmount,
        status: 'loue', // Logement déjà occupé par le locataire existant
        usage_destination: leaseType,
        owner_name: ownerDisplayName,
        owner_phone: profile?.phone || user?.phone || ''
      };

      // Insertion en base Supabase (table properties)
      let savedPropertyId = newPropertyId;
      try {
        const { data: createdProp, error: propErr } = await createProperty(propertyPayload);
        if (createdProp && createdProp.id) {
          savedPropertyId = createdProp.id;
        } else if (propErr) {
          console.warn('Persistance Supabase properties notice:', propErr);
        }
      } catch (propDbErr) {
        console.warn('Erreur création bien Supabase:', propDbErr);
      }

      // Synchronisation immédiate dans locatrust_properties (localStorage + customEvent)
      if (typeof window !== 'undefined') {
        try {
          const rawProps = localStorage.getItem('locatrust_properties');
          const existingPropsList = rawProps ? JSON.parse(rawProps) : [];
          const completeLocalProp = {
            ...propertyPayload,
            id: savedPropertyId,
            created_at: new Date().toISOString(),
            owner: {
              id: currentPublisherId,
              full_name: ownerDisplayName,
              phone: profile?.phone || '',
              account_type: isAgency ? 'agence' : 'proprietaire'
            },
            location: {
              city: propertyCity,
              commune: propertyCommune,
              quartier: propertyQuartier || 'Centre'
            },
            pricing: {
              monthly_rent: monthlyRent,
              deposit_months: Math.round(cautionAmount / (monthlyRent || 1)) || 2
            }
          };
          localStorage.setItem('locatrust_properties', JSON.stringify([completeLocalProp, ...(Array.isArray(existingPropsList) ? existingPropsList : [])]));
          window.dispatchEvent(new CustomEvent('locatrust:properties_updated'));
        } catch (localErr) {
          console.warn('Erreur sync local properties:', localErr);
        }
      }

      // 2. Enregistrement en base de données Supabase (table rental_applications)
      const appPayload: Record<string, any> = {
        property_id: savedPropertyId,
        tenant_name: foundTenant.fullName,
        tenant_phone: foundTenant.phone,
        tenant_email: foundTenant.email,
        tenant_cni: foundTenant.cniNumber || '',
        tenant_avatar: foundTenant.avatarUrl || '',
        property_title: trimmedTitle,
        property_address: computedFullAddress,
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
        await supabase.from('rental_applications').insert([appPayload]);
      } catch (dbErr) {
        console.warn('Persistance Supabase rental_applications notice:', dbErr);
      }

      // 3. Persistance de la notification dans la table Supabase 'notifications' (Section 15)
      try {
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: foundTenant.id,
          title: 'Nouvelle relation locative',
          message: `Le bailleur ${ownerDisplayName} souhaite vous associer au logement "${trimmedTitle}" et prépare votre contrat de location officiel.`,
          description: `Le bailleur ${ownerDisplayName} souhaite vous associer au logement "${trimmedTitle}" et prépare votre contrat de location officiel.`,
          category: 'contrat',
          type: 'contrat',
          is_read: false,
          read: false,
          data: {
            property_id: savedPropertyId,
            owner_id: user?.id,
            targetTab: 'contrats'
          }
        }]);
      } catch (notifDbErr) {
        console.warn('Persistance notification Supabase notice:', notifDbErr);
      }

      // 4. Notification locale et broadcast Realtime
      const tenantNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: 'Nouvelle relation locative',
        description: `Le bailleur ${ownerDisplayName} souhaite vous associer au logement "${trimmedTitle}" et prépare votre contrat de location officiel.`,
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

      // 5. Préparation des données d'importation locative pour préremplir le contrat
      const rentalData: ExistingRentalData = {
        tenant: foundTenant,
        propertyId: savedPropertyId,
        propertyTitle: trimmedTitle,
        propertyAddress: computedFullAddress,
        propertyCity: propertyCity.trim() || 'Abidjan',
        propertyCommune: propertyCommune.trim() || 'Cocody',
        propertyType: finalPropertyType,
        propertyRooms,
        propertyBedrooms,
        propertyBathrooms,
        propertySurface,
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

      // 6. Fermer ce modal et rediriger vers le workflow contractuel certifié existant
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
                  placeholder="Saisir le nom complet (ex: Zouzoua Laurence), e-mail ou téléphone..."
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
                    Aucun compte LocaTrust correspondant n'a été trouvé.
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
          {/* ÉTAPE 2 : INFORMATIONS DU LOGEMENT & SITUATION LOCATIVE        */}
          {/* (Section 9 & 10 - Renseignement direct du logement existant)   */}
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
                Saisie directe du bien existant
              </span>
            </div>

            {/* A. CARACTÉRISTIQUES DU LOGEMENT DIRECTEMENT RENSEIGNABLES */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-400">
                <Home className="w-4 h-4" />
                <span>Caractéristiques du logement occupé</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Désignation du logement */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Désignation du logement / Référence <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={propertyTitle}
                    onChange={(e) => setPropertyTitle(e.target.value)}
                    placeholder="Ex: Appartement 3 pièces standing - Résidence Les Palmiers"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  />
                </div>

                {/* Type de bien */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Type de bien <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPropertyType(val);
                      if (val === 'bureau' || val === 'magasin' || val === 'boutique' || val === 'entrepot') {
                        setLeaseType('professionnel');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  >
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison</option>
                    <option value="studio">Studio</option>
                    <option value="villa">Villa</option>
                    <option value="duplex">Duplex</option>
                    <option value="chambre-salon">Chambre-salon</option>
                    <option value="entree-coucher">Entrée-coucher</option>
                    <option value="bureau">Bureau</option>
                    <option value="magasin">Magasin</option>
                    <option value="boutique">Boutique</option>
                    <option value="entrepot">Entrepôt</option>
                    <option value="autre">Autre (préciser)</option>
                  </select>
                </div>

                {propertyType === 'autre' && (
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-black text-blue-700 dark:text-blue-400 mb-1">
                      Précisez le type personnalisé <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customPropertyType}
                      onChange={(e) => setCustomPropertyType(e.target.value)}
                      placeholder="Ex: Hangar commercial, Local polyvalent..."
                      className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                    />
                  </div>
                )}

                {/* Ville */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Ville <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="ivorian-cities-list-add-tenant"
                    value={propertyCity}
                    onChange={(e) => setPropertyCity(e.target.value)}
                    placeholder="Ex: Abidjan, Bouaké, Yamoussoukro, Daloa..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                  <datalist id="ivorian-cities-list-add-tenant">
                    {IVORIAN_CITIES.map((c) => (
                      <option key={c.name} value={c.name} />
                    ))}
                  </datalist>
                </div>

                {/* Commune */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Commune <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={propertyCommune}
                    onChange={(e) => setPropertyCommune(e.target.value)}
                    placeholder="Ex: Cocody, Yopougon, Marcory..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>

                {/* Quartier */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Quartier
                  </label>
                  <input
                    type="text"
                    value={propertyQuartier}
                    onChange={(e) => setPropertyQuartier(e.target.value)}
                    placeholder="Ex: Angré 8e Tranche, Riviera 3..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>

                {/* Adresse précise */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Adresse précise / Situation
                  </label>
                  <input
                    type="text"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    placeholder="Ex: Rue L12, Immeuble Grace, Porte B3"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>

                {/* Surface */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Surface (m²)
                  </label>
                  <NaturalCurrencyInput
                    value={propertySurface}
                    onChange={setPropertySurface}
                    placeholder="75"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>

                {/* Pièces */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Nombre de pièces
                  </label>
                  <NaturalCurrencyInput
                    value={propertyRooms}
                    onChange={setPropertyRooms}
                    placeholder="3"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>

                {/* Chambres */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Chambres
                  </label>
                  <NaturalCurrencyInput
                    value={propertyBedrooms}
                    onChange={setPropertyBedrooms}
                    placeholder="2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>

                {/* Salles d'eau */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    Salles d'eau
                  </label>
                  <NaturalCurrencyInput
                    value={propertyBathrooms}
                    onChange={setPropertyBathrooms}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* B. PARAMÈTRES LOCATIFS & CHAMPS MONÉTAIRES NATURELS (Section 11, 13, 14, 15) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              
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

              {/* Loyer mensuel (Composant monétaire naturel) */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Loyer mensuel hors charges (FCFA) <span className="text-red-500">*</span>
                </label>
                <NaturalCurrencyInput
                  value={monthlyRent}
                  onChange={(r) => {
                    setMonthlyRent(r);
                    if (leaseType === 'habitation') setCautionAmount(r * 2);
                  }}
                  placeholder="25000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />
              </div>

              {/* Charges locatives (Composant monétaire naturel) */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Charges locatives mensuelles (FCFA)
                </label>
                <NaturalCurrencyInput
                  value={chargesAmount}
                  onChange={setChargesAmount}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />
              </div>

              {/* Montant de la caution (Composant monétaire naturel) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Caution légale (FCFA) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                    Max 2 mois (Art. 414)
                  </span>
                </div>
                <NaturalCurrencyInput
                  value={cautionAmount}
                  onChange={setCautionAmount}
                  placeholder="50000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
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
                    <NaturalCurrencyInput
                      value={historicalCautionPaid}
                      onChange={setHistoricalCautionPaid}
                      placeholder="300000"
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
              disabled={!foundTenant || !propertyTitle.trim() || isSaving}
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
