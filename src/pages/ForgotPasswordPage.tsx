import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Logo } from '@/components/common/Logo';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Veuillez renseigner une adresse email valide.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message || "Impossible d'envoyer l'email de réinitialisation.");
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
        
        {/* En-tête centré */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 flex justify-center">
            <Logo size="md" align="center" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Mot de passe oublié
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Recevez un lien sécurisé pour réinitialiser votre accès
          </p>
        </div>

        {/* Carte compacte et centrée */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80">
          
          {sent ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900">Email envoyé avec succès !</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Si un compte existe pour <strong className="text-slate-900">{email}</strong>, un lien sécurisé vient d'y être expédié.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour à la connexion</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Adresse email du compte
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] disabled:bg-blue-400 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Envoi en cours...</span>
                      </>
                    ) : (
                      <span>Envoyer le lien de réinitialisation</span>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
                <Link to="/login" className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour à la connexion</span>
                </Link>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
