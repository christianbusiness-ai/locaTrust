'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  KeyRound,
  RotateCcw,
  Copy,
  Check,
  UserPlus
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { UserRole } from '@/types/database.types';
import { triggerCelebration } from '@/lib/celebration';
import { saveActiveUser } from '@/lib/authStore';
import {
  signInWithCredentialAnd2FA,
  verify2FAChallenge,
  resend2FAChallenge,
  TwoFactorChallenge
} from '@/lib/supabase/services';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
  onSuccessLogin: (role: UserRole, user: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onOpenRegister,
  onSuccessLogin
}) => {
  // Step: 'credentials' (Step 1) | '2fa' (Step 2) | 'success'
  const [step, setStep] = useState<'credentials' | '2fa' | 'success'>('credentials');

  // Form Fields
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA State
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallenge | null>(null);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccountNotFound, setIsAccountNotFound] = useState(false);

  // OTP inputs references for auto-focus
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state on modal open/close
  useEffect(() => {
    if (isOpen) {
      setStep('credentials');
      setCredential('');
      setPassword('');
      setErrorMessage(null);
      setIsAccountNotFound(false);
      setLoading(false);
      setOtpCode(['', '', '', '', '', '']);
      setTimer(60);
      setCanResend(false);
    }
  }, [isOpen]);

  // Timer for 2FA countdown
  useEffect(() => {
    let interval: any;
    if (step === '2fa' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isOpen) return null;

  // Clean error translation helper
  const translateAuthError = (rawErr: string): { text: string; notFound: boolean } => {
    const lower = (rawErr || '').toLowerCase();
    if (
      lower.includes('invalid login credentials') ||
      lower.includes('invalid_grant') ||
      lower.includes('user not found') ||
      lower.includes('credentials') ||
      lower.includes('identifiants incorrects')
    ) {
      return {
        text: "Identifiants incorrects ou aucun compte n'a encore été créé avec ces informations.",
        notFound: true
      };
    }
    if (lower.includes('email not confirmed')) {
      return {
        text: "Veuillez confirmer votre adresse email avant de vous connecter.",
        notFound: false
      };
    }
    if (lower.includes('too many requests') || lower.includes('rate limit')) {
      return {
        text: "Trop de tentatives de connexion. Veuillez patienter un instant.",
        notFound: false
      };
    }
    return {
      text: rawErr || "Identifiants incorrects ou compte non trouvé.",
      notFound: false
    };
  };

  // Handle Step 1: Direct Credentials Submission with Supabase
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsAccountNotFound(false);

    if (!credential.trim()) {
      setErrorMessage('Veuillez saisir votre adresse email.');
      return;
    }
    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const emailToAuth = credential.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

      if (error) {
        setLoading(false);
        const lower = error.message.toLowerCase();
        if (lower.includes('email not confirmed')) {
          setErrorMessage('Veuillez confirmer votre adresse email avant de vous connecter. Redirection...');
          setTimeout(() => {
            window.location.href = `/verify-email?email=${encodeURIComponent(emailToAuth)}`;
          }, 1500);
          return;
        }
        if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
          setErrorMessage('Email ou mot de passe incorrect.');
          setIsAccountNotFound(true);
          return;
        }
        setErrorMessage(error.message || 'Identifiants incorrects ou compte non trouvé.');
        return;
      }

      if (data?.user) {
        // Récupérer le profil réel depuis la table profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        const userRole = (profile?.account_type as UserRole) || (data.user.user_metadata?.account_type as UserRole) || 'locataire';

        saveActiveUser({
          id: data.user.id,
          role: userRole,
          full_name: profile?.full_name || data.user.user_metadata?.full_name || 'Utilisateur LocaTrust',
          email: data.user.email,
          phone: profile?.phone || data.user.user_metadata?.phone || '',
          avatar_url: profile?.avatar_url || '',
          verification_status: profile?.verification_status || 'non_verifie',
          created_at: profile?.created_at || data.user.created_at || new Date().toISOString()
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('locatrust_account_created', 'true');
          localStorage.setItem('locatrust_is_demo', 'false');
          localStorage.setItem('locatrust_registered_role', userRole);
        }

        setLoading(false);
        triggerCelebration('success');
        onSuccessLogin(userRole, profile || data.user);
        onClose();
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la tentative de connexion.');
      setLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpCode];
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtpCode(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const cleanDigit = value.replace(/\D/g, '');
    const newOtp = [...otpCode];
    newOtp[index] = cleanDigit;
    setOtpCode(newOtp);

    if (cleanDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace in OTP
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle Step 2: 2FA Code Verification
  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const fullCode = otpCode.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Veuillez saisir les 6 chiffres du code de sécurité.');
      return;
    }

    if (!twoFactorChallenge?.user_id) {
      setErrorMessage('Session de validation expirée. Veuillez vous reconnecter.');
      return;
    }

    setLoading(true);

    try {
      const verifyRes = await verify2FAChallenge(twoFactorChallenge.user_id, fullCode);

      if (!verifyRes.success || !verifyRes.user) {
        setErrorMessage(verifyRes.error || 'Code de sécurité 2FA incorrect ou expiré.');
        setLoading(false);
        return;
      }

      const verifiedUser = verifyRes.user;
      const userRole: UserRole = (verifiedUser.role as UserRole) || 'proprietaire';

      saveActiveUser({
        id: verifiedUser.id,
        role: userRole,
        full_name: verifiedUser.full_name || 'Utilisateur LocaTrust',
        email: verifiedUser.email,
        phone: verifiedUser.phone || '',
        avatar_url: verifiedUser.avatar_url || '',
        verification_status: verifiedUser.verification_status || 'non_verifie',
        created_at: verifiedUser.created_at || new Date().toISOString()
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('locatrust_account_created', 'true');
        localStorage.setItem('locatrust_is_demo', 'false');
        localStorage.setItem('locatrust_registered_role', userRole);
      }

      setStep('success');
      setLoading(false);
      triggerCelebration('success');

      setTimeout(() => {
        onSuccessLogin(userRole, verifiedUser);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la validation 2FA.');
      setLoading(false);
    }
  };

  // Resend 2FA code
  const handleResendCode = async () => {
    if (!canResend || !twoFactorChallenge?.user_id) return;
    setLoading(true);
    setErrorMessage(null);

    const res = await resend2FAChallenge(twoFactorChallenge.user_id);
    setLoading(false);

    if (res.success && res.challenge) {
      setTwoFactorChallenge(res.challenge);
      setTimer(60);
      setCanResend(false);
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } else {
      setErrorMessage(res.error || 'Impossible de renvoyer le code.');
    }
  };

  // Helper to auto-fill generated OTP for instant demo testing
  const handleAutoFillCode = () => {
    if (twoFactorChallenge?.code) {
      const digits = twoFactorChallenge.code.split('');
      setOtpCode(digits);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full max-w-[390px] mx-auto my-auto max-h-[90vh] flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Compact Header */}
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <Logo size="sm" variant="light" showSubtitle={false} />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Sécurisé 2FA
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* STEP 1 : IDENTIFIANTS PRINCIPAUX */}
        {/* ================================================================= */}
        {step === 'credentials' && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1">
            <div className="text-center mb-3 sm:mb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-1.5 shadow-xs border border-blue-100">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Accéder à mon Espace
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 max-w-xs mx-auto">
                Connectez-vous avec vos informations de compte.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col gap-1.5 animate-in fade-in">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                  <span className="leading-snug text-[11px] sm:text-xs">{errorMessage}</span>
                </div>
                {isAccountNotFound && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRegister();
                    }}
                    className="mt-1 w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Créer mon compte maintenant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleCredentialsSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                  Email, Téléphone ou N° CNI / RCCM
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    placeholder="Ex: christian@gmail.com ou 0700000000"
                    className="w-full pl-8 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:text-slate-400"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Votre identifiant certifié lors de l'inscription.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700">
                    Mot de passe
                  </label>
                  <a
                    href="/forgot-password"
                    onClick={(e) => {
                      e.preventDefault();
                      onClose();
                      window.location.href = '/forgot-password';
                    }}
                    className="text-[10px] text-blue-600 font-semibold cursor-pointer hover:underline"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-8 pr-9 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:text-slate-400"
                  />
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Continuer vers la vérification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Switch to Register */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 text-center">
              <p className="text-[11px] sm:text-xs text-slate-600">
                Vous n'avez pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Créer un compte certifié
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2 : DOUBLE AUTHENTIFICATION (2FA OBLIGATOIRE) */}
        {/* ================================================================= */}
        {step === '2fa' && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => setStep('credentials')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>

            <div className="text-center mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-1.5 border border-amber-200">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Vérification en Deux Étapes
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                Saisissez le code à 6 chiffres pour sécuriser votre accès.
              </p>
            </div>

            {/* Destination Masquée */}
            <div className="mb-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                Destinataire certifié
              </div>
              <div className="text-xs font-bold text-slate-800 truncate">
                {twoFactorChallenge?.masked_email || ''} {twoFactorChallenge?.masked_phone ? `• ${twoFactorChallenge.masked_phone}` : ''}
              </div>
            </div>

            {/* Code généré auto-fill helper */}
            {twoFactorChallenge?.code && (
              <div className="mb-3 p-2 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-blue-950">Code de sécurité :</div>
                    <div className="text-xs sm:text-sm font-black tracking-wider text-blue-700">
                      {twoFactorChallenge.code}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFillCode}
                  className="px-2 py-1 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center gap-1 transition-all shadow-2xs"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Inséré !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Remplir</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="mb-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-1.5 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                <span className="text-[11px]">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerify2FA} className="space-y-3">
              <div>
                <label className="block text-center text-[11px] font-bold text-slate-700 mb-1.5">
                  Entrez le code à 6 chiffres
                </label>
                <div className="flex justify-center gap-1 sm:gap-1.5">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-8 h-10 sm:w-10 sm:h-11 text-center text-base sm:text-lg font-black rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 focus:outline-none transition-all bg-white"
                    />
                  ))}
                </div>
              </div>

              {/* Countdown & Resend */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 pt-0.5">
                <span>
                  {timer > 0 ? (
                    `Valide encore ${timer}s`
                  ) : (
                    <span className="text-amber-600 font-semibold">Expiré</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={!canResend || loading}
                  onClick={handleResendCode}
                  className="text-blue-600 font-bold hover:underline disabled:opacity-40 disabled:no-underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Renvoyer</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.join('').length !== 6}
                className="w-full py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Valider et Accéder</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3 : SUCCÈS & CONNEXION CONFIRMÉE */}
        {/* ================================================================= */}
        {step === 'success' && (
          <div className="p-5 sm:p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-2.5 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Connexion Réussie !
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Authentification validée. Chargement de votre espace sécurisé...
            </p>
            <div className="mt-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
