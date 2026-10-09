import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { Logo } from '@/components/common/Logo';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { Mail, Lock, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const { signIn, resendVerificationEmail } = useAuth();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Si l'utilisateur clique sur le lien email de réinitialisation de mot de passe ou validation d'email
  useEffect(() => {
    if (window.location.hash.includes('type=recovery') || (window.location.hash.includes('access_token') && window.location.hash.includes('recovery'))) {
      navigate('/reset-password' + window.location.hash, { replace: true });
    } else if (window.location.hash.includes('type=signup') || window.location.hash.includes('type=email_change')) {
      navigate('/dashboard' + window.location.hash, { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendMsg(null);
    setUnconfirmedEmail(null);

    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (!result.success) {
      if (result.emailNotConfirmed) {
        setUnconfirmedEmail(email.trim());
        setError("Votre adresse email n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception ou cliquer ci-dessous pour renvoyer le lien.");
        return;
      }
      setError(result.error || 'Email ou mot de passe incorrect.');
      return;
    }

    // Succès -> redirection directe vers le profil
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
        
        {/* En-tête centré avec Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 flex justify-center">
            <Logo size="md" align="center" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Accéder à mon Espace LocaTrust
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Connectez-vous avec vos identifiants sécurisés
          </p>
        </div>

        {/* Carte de connexion compacte et centrée */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80">
          
          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              {unconfirmedEmail && (
                <div className="mt-2.5 pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-rose-700 font-medium">Vous n'avez pas reçu le mail ?</span>
                  <button
                    type="button"
                    disabled={resending}
                    onClick={async () => {
                      setResending(true);
                      setResendMsg(null);
                      const res = await resendVerificationEmail(unconfirmedEmail);
                      setResending(false);
                      if (res.success) {
                        setResendMsg('✅ Un nouvel email de confirmation a été expédié à votre adresse !');
                      } else {
                        setResendMsg(res.error || "Erreur lors du renvoi.");
                      }
                    }}
                    className="text-xs font-black text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    {resending ? 'Envoi en cours...' : "Renvoyer l'email"}
                  </button>
                </div>
              )}
            </div>
          )}

          {resendMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-fadeIn">
              {resendMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre.email@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Mot de passe
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] disabled:bg-blue-400 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Séparateur élégant */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                ou continuer avec
              </span>
            </div>
          </div>

          {/* Bouton Connexion Google 1-clic */}
          <GoogleAuthButton
            label="Continuer avec Google"
            onError={(err) => setError(err)}
          />

          <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
            Pas encore de compte ?{' '}
            <Link to="/register" className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
              S'inscrire
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};
