'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Building2,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Phone,
  Mail,
  FileText,
  MapPin,
  Crown,
  KeyRound,
  Check,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { triggerCelebration } from '@/lib/celebration';
import {
  isSingleAdminRegistered,
  getSingleAdminInfo,
  registerSingleAdmin,
  registerUserAccount,
  saveActiveUser,
  RegisterUserData
} from '@/lib/authStore';
import { signUpUser, sendEmailOtp, verifyEmailOtp } from '@/lib/supabase/services';
import { IVORIAN_CITIES } from '@/lib/legalAnalysisEngine';


interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRegister: (role: UserRole) => void;
}

type RegistrationStep = 'choose_role' | 'fill_form' | 'email_verification' | 'admin_setup' | 'success';

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccessRegister
}) => {
  // Navigation State
  const [step, setStep] = useState<RegistrationStep>('choose_role');
  const [selectedRole, setSelectedRole] = useState<'locataire' | 'proprietaire' | 'agence' | null>(null);

  // Admin Single-Registration State
  const [adminAlreadyRegistered, setAdminAlreadyRegistered] = useState(false);
  const [existingAdminInfo, setExistingAdminInfo] = useState<any>(null);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields - General Users
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    cniNumber: '',
    city: 'Abidjan',
    commune: '',
    profession: 'Salarié(e)',
    // Agence specific
    agencyName: '',
    managerName: '',
    rccmNumber: '',
    licenseNumber: '',
    agencyAddress: '',
    // Document upload simulation
    documentFileName: '',
    cniFrontFile: null as File | null,
    cniBackFile: null as File | null,
    termsAccepted: false
  });


  // Form Fields - Single Super Admin Setup
  const [adminFormData, setAdminFormData] = useState({
    name: 'Super Administrateur LocaTrust',
    email: 'admin@locatrust.ci',
    phone: '+225 27 20 00 00 00',
    password: '',
    confirmPassword: '',
    masterToken: ''
  });

  // Errors & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRoleSummary, setCreatedRoleSummary] = useState<string>('');

  // Email OTP Verification State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState<number>(30);
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<RegisterUserData | null>(null);
  const [pendingAuthUserId, setPendingAuthUserId] = useState<string | undefined>(undefined);

  const otp0Ref = useRef<HTMLInputElement>(null);
  const otp1Ref = useRef<HTMLInputElement>(null);
  const otp2Ref = useRef<HTMLInputElement>(null);
  const otp3Ref = useRef<HTMLInputElement>(null);
  const otp4Ref = useRef<HTMLInputElement>(null);
  const otp5Ref = useRef<HTMLInputElement>(null);
  const otpInputRefs = [otp0Ref, otp1Ref, otp2Ref, otp3Ref, otp4Ref, otp5Ref];

  // OTP Countdown Timer
  useEffect(() => {
    let timer: any;
    if (step === 'email_verification' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendCountdown]);

  // Check admin registration status whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const isRegistered = isSingleAdminRegistered();
      setAdminAlreadyRegistered(isRegistered);
      if (isRegistered) {
        setExistingAdminInfo(getSingleAdminInfo());
      }
      setStep('choose_role');
      setSelectedRole(null);
      setErrorMessage(null);
      setCodeError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleSelectRoleAndProceed = () => {
    if (!selectedRole) {
      setErrorMessage('Veuillez sélectionner votre profil (Locataire, Propriétaire ou Agence) avant de continuer.');
      return;
    }
    setErrorMessage(null);
    setStep('fill_form');
  };

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedRole) return;

    // Validations
    if (!formData.name.trim() && selectedRole !== 'agence') {
      setErrorMessage('Veuillez renseigner votre nom complet.');
      return;
    }
    if (selectedRole === 'agence' && !formData.agencyName.trim()) {
      setErrorMessage('Veuillez renseigner la raison sociale de votre agence.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 8) {
      setErrorMessage('Veuillez entrer un numéro de téléphone valide (+225 XX XX XX XX XX).');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Veuillez entrer une adresse email valide.');
      return;
    }
    if (formData.password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!formData.termsAccepted) {
      setErrorMessage('Veuillez accepter les conditions d\'utilisation et la certification sur l\'honneur.');
      return;
    }

    const payload: RegisterUserData = {
      role: selectedRole,
      name: selectedRole === 'agence' ? formData.agencyName : formData.name,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      cniOrRccm: selectedRole === 'agence' ? formData.rccmNumber : formData.cniNumber,
      city: formData.city,
      commune: formData.commune,
      profession: formData.profession,
      agencyName: formData.agencyName,
      managerName: formData.managerName,
      rccmNumber: formData.rccmNumber,
      licenseNumber: formData.licenseNumber,
      documentFileName: formData.documentFileName || (selectedRole === 'agence' ? 'Extrait_RCCM_Officiel.pdf' : 'CNI_Recto_Verso.jpg'),
      password: formData.password
    };

    setOtpDigits(['', '', '', '', '', '']);
    setResendCountdown(30);
    setCodeError(null);
    setPendingPayload(payload);
    setIsSendingEmail(true);

    // 1. Déclenchement de l'inscription Supabase Auth
    signUpUser({
      email: payload.email,
      password: payload.password,
      full_name: payload.name,
      role: payload.role,
      phone: payload.phone,
      cni_number: payload.cniOrRccm
    }).then(({ data: authData, error: authError }) => {
      if (authError) {
        console.warn('Supabase signup notice:', authError);
      }
      if (authData?.user?.id) {
        setPendingAuthUserId(authData.user.id);
      }
    }).catch((err) => {
      console.warn('Supabase signup error:', err);
    });

    // 2. Envoi réel du code OTP à 6 chiffres par la base de données vers la boîte mail
    sendEmailOtp(payload.email)
      .then(({ data: otpData, error: otpError }) => {
        if (otpError) {
          console.warn('Notice envoi OTP Supabase:', otpError);
        }
      })
      .catch((err) => {
        console.warn('Erreur envoi OTP Supabase:', err);
      })
      .finally(() => {
        setIsSendingEmail(false);
        // Basculement vers l'étape de validation email par code
        setStep('email_verification');
        setTimeout(() => {
          otp0Ref.current?.focus();
        }, 150);
      });
  };

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);
    setCodeError(null);

    if (clean && index < 5) {
      otpInputRefs[index + 1]?.current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1]?.current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const nextDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        nextDigits[i] = pasted[i];
      }
      setOtpDigits(nextDigits);
      setCodeError(null);
      const focusIndex = Math.min(pasted.length, 5);
      otpInputRefs[focusIndex]?.current?.focus();
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    setResendCountdown(30);
    setCodeError(null);

    const targetEmail = pendingPayload?.email || formData.email;
    if (targetEmail) {
      try {
        await sendEmailOtp(targetEmail);
      } catch (err) {
        console.warn('Erreur renvoi OTP Supabase:', err);
      }
    }
  };

  const handleVerifyEmailCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCodeError(null);

    const enteredCode = otpDigits.join('').trim();
    if (enteredCode.length < 6) {
      setCodeError('Veuillez saisir les 6 chiffres du code de validation.');
      return;
    }

    if (!pendingPayload || !selectedRole) return;
    setIsVerifyingCode(true);

    // 1. Validation du code OTP directement par la base de données Supabase Auth
    const otpValidation = await verifyEmailOtp(formData.email, enteredCode);
    if (!otpValidation.success) {
      setCodeError(
        otpValidation.error?.message ||
        'Code de validation incorrect ou expiré. Veuillez vérifier votre boîte mail ou cliquer sur Renvoyer un code.'
      );
      setIsVerifyingCode(false);
      return;
    }

    // 2. Enregistrement du compte utilisateur dans le store local
    const result = registerUserAccount({
      ...pendingPayload,
      id: otpValidation.data?.user?.id || pendingAuthUserId
    });

    if (!result.success) {
      setCodeError(result.error || 'Erreur lors de la création du compte.');
      setIsVerifyingCode(false);
      return;
    }

    // Le compte créé est initialement sans badge vérifié tant que l'administrateur n'a pas validé
    if (result.user) {
      result.user.verification_status = 'en_attente';
      saveActiveUser(result.user);
    }

    localStorage.setItem('locatrust_registered_role', selectedRole);
    localStorage.setItem('locatrust_account_created', 'true');
    localStorage.setItem('locatrust_is_demo', 'false');

    triggerCelebration('success');
    setIsVerifyingCode(false);

    // Redirection directe vers le tableau de bord / profil du rôle sans écran blanc d'attente
    onSuccessRegister(selectedRole);
    onClose();
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (adminAlreadyRegistered) {
      setErrorMessage('Le compte Super Administrateur unique a déjà été créé. L\'accès est fermé.');
      return;
    }

    if (!adminFormData.name.trim() || !adminFormData.email.trim() || !adminFormData.phone.trim()) {
      setErrorMessage('Tous les champs administratifs sont obligatoires.');
      return;
    }
    if (adminFormData.password.length < 8) {
      setErrorMessage('Le mot de passe administrateur doit comporter au moins 8 caractères.');
      return;
    }
    if (adminFormData.password !== adminFormData.confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    // Inscription Supabase Admin
    await signUpUser({
      email: adminFormData.email,
      password: adminFormData.password,
      full_name: adminFormData.name,
      role: 'admin',
      phone: adminFormData.phone
    });

    const result = registerSingleAdmin({
      name: adminFormData.name,
      email: adminFormData.email,
      phone: adminFormData.phone,
      password: adminFormData.password,
      token: adminFormData.masterToken
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Échec de la configuration Super Admin.');
      return;
    }

    // Single admin successfully created and LOCKED
    setAdminAlreadyRegistered(true);
    triggerCelebration('success');
    setCreatedRoleSummary('Super Administrateur Unique LocaTrust (Accès désormais verrouillé)');
    setStep('success');

    setTimeout(() => {
      onSuccessRegister('admin');
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col relative">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {step === 'admin_setup'
                    ? 'Initialisation Super Administrateur'
                    : 'Créer un Compte LocaTrust'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
                  Loi CI 2019-576
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Plateforme certifiée de gestion locative et séquestre sécurisé en Côte d'Ivoire
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ÉTAPE 1 : QUESTION & SÉLECTION DU RÔLE (Demande précise de l'audio)    */}
        {/* ===================================================================== */}
        {step === 'choose_role' && (
          <div className="p-6 sm:p-8 flex flex-col gap-6 animate-fadeIn">
            
            {/* Phrase posant la question demandée */}
            <div className="text-center flex flex-col gap-2">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-widest">
                Étape 1 sur 2 • Profil d'Utilisateur
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                « Êtes-vous un locataire, un propriétaire ou une agence ? »
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Sélectionnez la case correspondant à votre statut pour charger automatiquement le formulaire d'inscription adapté.
              </p>
            </div>

            {/* 3 Petites Cases / Cartes de sélection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Option 1 : Locataire */}
              <div
                onClick={() => setSelectedRole('locataire')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 group ${
                  selectedRole === 'locataire'
                    ? 'border-blue-600 bg-blue-50/70 ring-4 ring-blue-500/10 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  {/* Case à cocher / Radio */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedRole === 'locataire'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {selectedRole === 'locataire' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-slate-900 text-sm">Locataire</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Je cherche un bien, signe mon bail certifié, paie mes loyers et sécurise ma caution.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Cautions garanties par séquestre</span>
                </div>
              </div>

              {/* Option 2 : Propriétaire */}
              <div
                onClick={() => setSelectedRole('proprietaire')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 group ${
                  selectedRole === 'proprietaire'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-4 ring-emerald-500/10 shadow-md'
                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  {/* Case à cocher / Radio */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedRole === 'proprietaire'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {selectedRole === 'proprietaire' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-slate-900 text-sm">Propriétaire</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Je loue mes logements, génère des baux conformes et automatise mes quittances.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Publication directe après KYC</span>
                </div>
              </div>

              {/* Option 3 : Agence */}
              <div
                onClick={() => setSelectedRole('agence')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 group ${
                  selectedRole === 'agence'
                    ? 'border-purple-600 bg-purple-50/70 ring-4 ring-purple-500/10 shadow-md'
                    : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  {/* Case à cocher / Radio */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedRole === 'agence'
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {selectedRole === 'agence' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-slate-900 text-sm">Agence Immobilière</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Société ou cabinet gérant un portefeuille multi-mandats avec équipe et certification RCCM.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-purple-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Exports comptables & mandats</span>
                </div>
              </div>

            </div>

            {/* Bouton de validation pour continuer */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSelectRoleAndProceed}
                disabled={!selectedRole}
                className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                  selectedRole
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/25'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Valider et Continuer l'Inscription</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* ÉTAPE 2 : FORMULAIRE D'INSCRIPTION DÉDIÉ AU RÔLE CHOISI               */}
        {/* ===================================================================== */}
        {step === 'fill_form' && selectedRole && (
          <form onSubmit={handleGeneralSubmit} className="p-6 sm:p-8 flex flex-col gap-5 animate-fadeIn">
            
            {/* Header avec retour en arrière */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStep('choose_role');
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Changer de rôle</span>
              </button>

              <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide ${
                selectedRole === 'locataire'
                  ? 'bg-blue-100 text-blue-900'
                  : selectedRole === 'proprietaire'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-purple-100 text-purple-900'
              }`}>
                Formulaire {selectedRole === 'locataire' ? 'Locataire' : selectedRole === 'proprietaire' ? 'Propriétaire' : 'Agence'}
              </span>
            </div>

            {/* Champs Généraux & Spécifiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Si Agence : Raison sociale + Nom gérant */}
              {selectedRole === 'agence' ? (
                <>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700">Raison Sociale de l'Agence *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Immobilière du Golf Abidjan SARL"
                      value={formData.agencyName}
                      onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Nom & Prénoms du Gérant / Représentant *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Kouamé N'Guessan"
                      value={formData.managerName}
                      onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Numéro de Registre de Commerce (RCCM) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: CI-ABJ-2024-B-11928"
                      value={formData.rccmNumber}
                      onChange={(e) => setFormData({ ...formData, rccmNumber: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Numéro d'Agrément Immobilier / Licence</label>
                    <input
                      type="text"
                      placeholder="Ex: AGR-MCLU-2023-0492"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>Ville du Siège Social *</span>
                      <span className="text-[10px] text-purple-600 font-semibold">Toutes villes acceptées</span>
                    </label>
                    <input
                      type="text"
                      list="register-cities"
                      required
                      placeholder="Ex: Abidjan, Bouaké, San-Pédro..."
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Commune du Siège Social *</label>
                    <input
                      type="text"
                      list="register-communes"
                      required
                      placeholder="Ex: Plateau, Cocody, Commerce, Zone 4..."
                      value={formData.commune}
                      onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </>
              ) : (
                /* Si Locataire ou Propriétaire */
                <>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700">Nom & Prénoms complets *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Bailleur Partenaire ou LocaTrust Utilisateur"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Numéro de Pièce d'Identité (CNI / Passeport) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: CI-002894129"
                      value={formData.cniNumber}
                      onChange={(e) => setFormData({ ...formData, cniNumber: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {selectedRole === 'locataire' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-slate-700">Situation Professionnelle</label>
                      <select
                        value={formData.profession}
                        onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="Salarié(e) CDI">Salarié(e) CDI</option>
                        <option value="Fonctionnaire État">Fonctionnaire de l'État</option>
                        <option value="Entrepreneur / Commerçant">Entrepreneur / Commerçant</option>
                        <option value="Profession libérale">Profession libérale</option>
                        <option value="Étudiant(e)">Étudiant(e)</option>
                      </select>
                    </div>
                  )}

                  {/* VILLE & COMMUNE POUR TOUS LES UTILISATEURS */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>Ville de Résidence *</span>
                      <span className="text-[10px] text-blue-600 font-semibold">Toutes villes acceptées</span>
                    </label>
                    <input
                      type="text"
                      list="register-cities"
                      required
                      placeholder="Ex: Abidjan, Bouaké, Yamoussoukro, Korhogo..."
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Commune de Résidence *</label>
                    <input
                      type="text"
                      list="register-communes"
                      required
                      placeholder="Ex: Cocody, Yopougon, Air France, Koko..."
                      value={formData.commune}
                      onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </>
              )}


              {/* Coordonnées : Email et Téléphone */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Numéro de Téléphone (Mobile Money) *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="+225 07 00 00 00 00"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Adresse Email Officielle *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="exemple@email.ci"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Mot de passe & Confirmation */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Mot de Passe Sécurisé *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 caractères"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Confirmer le Mot de Passe *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Répétez le mot de passe"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

            </div>

            {/* Document Upload Zone */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-2">
              <Upload className="w-6 h-6 text-slate-400" />
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-xs">
                  {selectedRole === 'agence' ? 'Extrait RCCM ou Agrément' : 'Pièce d\'Identité (CNI / Passeport)'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {formData.documentFileName || 'Format JPG, PNG ou PDF (max 10 Mo) — Vérification KYC officielle'}
                </span>
              </div>
              <label className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer shadow-sm transition-all">
                <span>{formData.documentFileName ? 'Changer de fichier' : 'Sélectionner un fichier'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFormData({ ...formData, documentFileName: f.name });
                    }
                  }}
                />
              </label>
            </div>

            {/* Acceptation des conditions */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
              <input
                type="checkbox"
                required
                checked={formData.termsAccepted}
                onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Je certifie sur l'honneur l'exactitude de mes informations et accepte les CGU de LocaTrust ainsi que la conformité au cadre légal ivoirien de la loi n° 2019-576.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Annuler
              </button>
              
              <button
                type="submit"
                disabled={isSendingEmail}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Envoi du code par la base de données...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Créer mon Compte {selectedRole === 'locataire' ? 'Locataire' : selectedRole === 'proprietaire' ? 'Propriétaire' : 'Agence'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Datalists pour suggestions des Villes et Communes de Côte d'Ivoire */}
            <datalist id="register-cities">

              {IVORIAN_CITIES.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>

            <datalist id="register-communes">
              {(IVORIAN_CITIES.find(c => c.name.toLowerCase() === (formData.city || '').toLowerCase())?.communes ||
                IVORIAN_CITIES[0].communes
              ).map((communeName) => (
                <option key={communeName} value={communeName} />
              ))}
            </datalist>

          </form>
        )}

        {/* ===================================================================== */}
        {/* ÉTAPE VÉRIFICATION DE L'EMAIL PAR CODE (OTP 6 CHIFFRES)              */}
        {/* ===================================================================== */}
        {step === 'email_verification' && (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-6 animate-fadeIn">
            
            {/* Icône enveloppe & sécurité */}
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-md">
                <Mail className="w-8 h-8" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow">
                <Check className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Titre & Explication */}
            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Vérification de votre adresse email
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Un code officiel de validation à 6 chiffres a été expédié par la base de données vers <strong>{formData.email}</strong>. Saisissez-le ci-dessous pour confirmer votre email et activer votre compte.
              </p>
            </div>

            {/* Notification envoi réel par la base de données */}
            <div className="w-full max-w-sm p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-center gap-3 shadow-sm text-left">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-blue-900">Code expédié par la base de données</span>
                <span className="text-[11px] text-blue-800 leading-tight mt-0.5">
                  Vérifiez votre boîte de réception (et le dossier Spams / Courriers indésirables).
                </span>
              </div>
            </div>

            {/* Message d'erreur de code */}
            {codeError && (
              <div className="w-full max-w-sm p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 text-left animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{codeError}</span>
              </div>
            )}

            {/* Grille des 6 chiffres OTP */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 my-1">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={otpInputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={index === 0 ? handleOtpPaste : undefined}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/20 transition-all shadow-sm"
                />
              ))}
            </div>

            {/* Bouton de validation du code */}
            <div className="w-full max-w-sm flex flex-col gap-3">
              <button
                type="button"
                disabled={isVerifyingCode || otpDigits.join('').length < 6}
                onClick={() => handleVerifyEmailCode()}
                className={`w-full py-3.5 px-4 rounded-xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                  otpDigits.join('').length === 6 && !isVerifyingCode
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                    : 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                }`}
              >
                {isVerifyingCode ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validation du code par la base de données...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmer et Activer mon Compte</span>
                  </>
                )}
              </button>

              {/* Renvoyer le code ou modifier email */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCodeError(null);
                    setStep('fill_form');
                  }}
                  className="text-slate-500 hover:text-blue-600 font-bold flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Modifier l'email</span>
                </button>

                <button
                  type="button"
                  disabled={resendCountdown > 0}
                  onClick={handleResendCode}
                  className={`font-black flex items-center gap-1 transition-colors ${
                    resendCountdown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-blue-600 hover:text-blue-700 hover:underline'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {resendCountdown > 0 ? `Renvoyer le code (${resendCountdown}s)` : 'Renvoyer un code'}
                  </span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* ÉTAPE SPÉCIALE : INSCRIPTION SUPER ADMINISTRATEUR UNIQUE             */}
        {/* ===================================================================== */}
        {step === 'admin_setup' && (
          <div className="p-6 sm:p-8 flex flex-col gap-6 animate-fadeIn">
            
            {/* Si un administrateur est DÉJÀ enregistré : LA PARTIE EST FERMÉE */}
            {adminAlreadyRegistered ? (
              <div className="py-8 px-6 rounded-3xl bg-amber-50 border-2 border-amber-200 text-amber-950 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-inner">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="flex flex-col gap-1 max-w-md">
                  <h3 className="text-lg font-black text-amber-950">
                    Inscription Administrateur Verrouillée & Fermée
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Conformément aux règles de sécurité de LocaTrust, <strong>un seul Super Administrateur</strong> est autorisé sur cette instance. Le compte unique a déjà été configuré et sécurisé.
                  </p>
                </div>

                {existingAdminInfo && (
                  <div className="w-full max-w-sm p-3.5 bg-white rounded-2xl border border-amber-200 text-left text-xs flex flex-col gap-1 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-amber-700">Administrateur en fonction :</span>
                    <span className="font-black text-slate-900">{existingAdminInfo.name}</span>
                    <span className="text-slate-500">{existingAdminInfo.email} • {existingAdminInfo.phone}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('choose_role')}
                    className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                  >
                    Retour à l'inscription publique
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSuccessRegister('admin');
                      onClose();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-md transition-all"
                  >
                    Accéder à la Console Admin
                  </button>
                </div>
              </div>
            ) : (
              /* Si pas encore enregistré : FORMULAIRE D'INITIALISATION UNIQUE */
              <form onSubmit={handleAdminSubmit} className="flex flex-col gap-5">
                
                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-200 text-purple-950">
                  <Crown className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                  <div className="flex flex-col text-xs">
                    <span className="font-black">Configuration de l'Administrateur Unique</span>
                    <span className="text-[11px] text-purple-800 leading-relaxed mt-0.5">
                      ⚠️ <strong>Règle stricte</strong> : Cette opération est unique et définitive. Dès la validation de ce compte, le formulaire d'inscription administrateur sera <strong>définitivement fermé</strong> et verrouillé pour tout nouvel utilisateur.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700">Nom du Super Administrateur *</label>
                    <input
                      type="text"
                      required
                      value={adminFormData.name}
                      onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Email Officiel Super Admin *</label>
                    <input
                      type="email"
                      required
                      value={adminFormData.email}
                      onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Téléphone Sécurisé *</label>
                    <input
                      type="tel"
                      required
                      value={adminFormData.phone}
                      onChange={(e) => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700">Code Master d'Initialisation (.env.local) *</label>
                    <input
                      type="text"
                      required
                      value={adminFormData.masterToken}
                      onChange={(e) => setAdminFormData({ ...adminFormData, masterToken: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Mot de Passe Administrateur *</label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 8 caractères"
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700">Confirmer le Mot de Passe *</label>
                    <input
                      type="password"
                      required
                      placeholder="Confirmation"
                      value={adminFormData.confirmPassword}
                      onChange={(e) => setAdminFormData({ ...adminFormData, confirmPassword: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep('choose_role')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                  >
                    Retour
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Créer et Verrouiller l'Administrateur Unique</span>
                  </button>
                </div>

              </form>
            )}

          </div>
        )}

        {/* ===================================================================== */}
        {/* ÉTAPE SUCCÈS & CÉLÉBRATION                                            */}
        {/* ===================================================================== */}
        {step === 'success' && (
          <div className="p-10 flex flex-col items-center justify-center text-center gap-4 animate-fadeIn">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-2xl font-black text-slate-900">
                🎉 Compte Créé avec Succès !
              </h3>
              <p className="text-sm font-bold text-blue-700">
                {createdRoleSummary}
              </p>
              <div className="p-3 my-2 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center gap-2.5 max-w-sm mx-auto text-left shadow-sm">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="leading-snug">
                  Statut : <strong>En attente de validation admin</strong>. Vos pièces justificatives seront examinées avant l'attribution du badge Vérifié.
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Redirection immédiate vers votre espace...
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
