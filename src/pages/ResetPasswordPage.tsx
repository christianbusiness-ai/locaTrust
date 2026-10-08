import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { Logo } from '@/components/common/Logo';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { triggerCelebration } from '@/lib/celebration';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { updatePassword, user } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vérifier si une session de récupération existe ou si un hash est présent
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Session existante ou URL hash
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Impossible de mettre à jour le mot de passe.');
      return;
    }

    triggerCelebration('success');
    setSuccess(true);
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2000);
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
            Nouveau mot de passe
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Définissez votre nouveau mot de passe sécurisé
          </p>
        </div>

        {/* Carte compacte et centrée */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80">
          {success ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900">Mot de passe réinitialisé !</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Votre nouveau mot de passe a été enregistré avec succès sur le serveur. Redirection vers votre tableau de bord...
              </p>
              <div className="pt-2">
                <Link
                  to="/dashboard"
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <span>Accéder à mon espace</span>
                  <ArrowRight className="w-4 h-4" />
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
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirmer le nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Retapez votre mot de passe"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
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
                        <span>Mise à jour en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>Enregistrer le mot de passe</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="text-xs font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Annuler et revenir à la connexion
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
