import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { Logo } from '@/components/common/Logo';
import { Mail, CheckCircle2, AlertCircle, Loader2, Clock, ArrowLeft } from 'lucide-react';
import { triggerCelebration } from '@/lib/celebration';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp, user } = useAuth();

  const emailParam = searchParams.get('email') || user?.email || '';
  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  // Si l'utilisateur est déjà authentifié et validé côté serveur
  useEffect(() => {
    if (user) {
      triggerCelebration('success');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Compte à rebours 60 secondes pour renvoyer le code
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);
    setError(null);

    // Auto-focus vers le chiffre suivant
    if (clean && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const lastFilled = Math.min(pasted.length - 1, 5);
    inputsRef.current[lastFilled]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const token = otpDigits.join('');
    if (token.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code reçu par email.');
      return;
    }

    if (!email.trim()) {
      setError('Adresse email introuvable. Veuillez réessayer.');
      return;
    }

    setLoading(true);
    const result = await verifyOtp(email.trim(), token);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Code invalide ou expiré. Veuillez vérifier ou renvoyer un code.');
      return;
    }

    // Célébration visuelle festive
    triggerCelebration();

    // Redirection directe vers la page profil
    setTimeout(() => {
      navigate('/profile', { replace: true });
    }, 1200);
  };

  const handleResend = async () => {
    if (!canResend || resending || !email.trim()) return;

    setError(null);
    setResending(true);
    const result = await resendOtp(email.trim());
    setResending(false);

    if (!result.success) {
      setError(result.error || 'Impossible de renvoyer le code pour le moment.');
      return;
    }

    setResendSuccess(true);
    setCountdown(60);
    setCanResend(false);
    setTimeout(() => setResendSuccess(false), 5000);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-[440px] mx-auto flex flex-col items-center">
        
        {/* En-tête centré */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 flex justify-center">
            <Logo size="md" align="center" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Vérification de votre compte
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Saisissez le code à 6 chiffres envoyé à votre adresse
          </p>
        </div>

        {/* Carte compacte et centrée */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 text-center">
          
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-inner">
            <Mail className="w-7 h-7" />
          </div>

          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto mb-5">
            Un code officiel a été envoyé à <strong className="text-slate-900">{email || 'votre adresse email'}</strong>.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 text-left animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 text-left animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Nouveau code envoyé avec succès !</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            {/* Grille des 6 chiffres */}
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-2" onPaste={handlePaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl font-black rounded-xl border transition-all ${
                    digit
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-600/30`}
                />
              ))}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || otpDigits.join('').length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vérification du code...</span>
                  </>
                ) : (
                  <span>Confirmer et Activer mon Compte</span>
                )}
              </button>
            </div>
          </form>

          {/* Section Renvoi avec compte à rebours 60s */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-2">
            <span className="text-xs text-slate-500">Vous n'avez pas reçu le code ?</span>
            
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-xs font-black text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
              >
                {resending ? 'Envoi en cours...' : 'Renvoyer un nouveau code'}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Renvoyer dans {countdown}s</span>
              </div>
            )}

            <div className="mt-2">
              <Link to="/login" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowLeft className="w-3 h-3" />
                <span>Retour à la connexion</span>
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
