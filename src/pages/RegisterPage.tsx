import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { Logo } from '@/components/common/Logo';
import { Lock, Mail, User, Phone, AlertCircle, Loader2, ArrowRight, ShieldCheck, Eye, EyeOff, Home, Building2, Briefcase, MapPin, Sparkles } from 'lucide-react';
import { triggerCelebration } from '@/lib/celebration';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, resendVerificationEmail } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [accountType, setAccountType] = useState<'locataire' | 'proprietaire' | 'agence'>('locataire');
  const [roleDetail, setRoleDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  // État de confirmation d'email
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations obligatoires
    if (!fullName.trim()) {
      setError('Veuillez renseigner votre nom complet.');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError('Veuillez renseigner une adresse email valide et existante (ex: contact@gmail.com).');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const result = await signUp({
      fullName,
      email,
      password,
      accountType,
      phone,
    });
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Une erreur est survenue lors de l'inscription.");
      return;
    }

    // Si confirmation d'email requise par le serveur
    if (result.emailConfirmationRequired) {
      setEmailSent(true);
      return;
    }

    // Succès avec session active : célébration et redirection vers /dashboard
    triggerCelebration('success');
    navigate('/dashboard', { replace: true });
  };

  if (emailSent) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans py-8">
        <div className="w-full max-w-[480px] mx-auto flex flex-col items-center">
          <div className="mb-4">
            <Logo size="md" align="center" />
          </div>

          <div className="w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto mb-4 shadow-sm animate-pulse">
              <Mail className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-2">
              Confirmez votre adresse email
            </h2>

            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Expédié via serveur SMTP sécurisé (Brevo)
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Un email contenant votre lien de confirmation sécurisé a été envoyé à l'adresse :
            </p>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl mb-4 font-mono font-bold text-xs text-blue-900 break-all">
              {email}
            </div>

            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Veuillez ouvrir cet email et cliquer sur le lien de confirmation pour activer votre compte. Si vous ne le voyez pas dans les 2 minutes, vérifiez votre dossier <strong>Spam / Courriers indésirables</strong>.
            </p>

            {resendMessage && (
              <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold animate-fadeIn">
                {resendMessage}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={resending}
                onClick={async () => {
                  setResending(true);
                  setResendMessage(null);
                  const res = await resendVerificationEmail(email);
                  setResending(false);
                  if (res.success) {
                    setResendMessage('✅ Un nouvel email de confirmation vient de vous être envoyé. Vérifiez également vos courriers indésirables.');
                  } else {
                    setResendMessage(res.error || "Erreur lors du renvoi de l'email.");
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <span>Renvoyer l'email de confirmation</span>
                )}
              </button>

              <Link
                to="/login"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <span>Accéder à la connexion</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans py-8">
      <div className="w-full max-w-[460px] mx-auto flex flex-col items-center">
        
        {/* En-tête centré */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3">
            <Logo size="md" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Créer un compte LocaTrust
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Gestion locative certifiée conforme à la loi ivoirienne n° 2019-576
          </p>
        </div>

        {/* Carte d'inscription compacte et centrée */}
        <div className="w-full bg-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80">
          
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type de compte avec bascule dynamique et stylisée */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Vous êtes :</span>
                <span className="text-[10px] font-black uppercase text-blue-600 tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  {accountType === 'proprietaire' ? 'Espace Bailleur' : accountType === 'agence' ? 'Espace Agence' : 'Espace Locataire'}
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'locataire', label: 'Locataire', icon: Home },
                  { id: 'proprietaire', label: 'Bailleur', icon: Building2 },
                  { id: 'agence', label: 'Agence', icon: Briefcase }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = accountType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAccountType(item.id as any)}
                      className={`py-2.5 px-2 rounded-2xl text-xs font-black border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? item.id === 'proprietaire'
                            ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-emerald-600 shadow-md shadow-emerald-600/25 scale-[1.02]'
                            : item.id === 'agence'
                            ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-600 shadow-md shadow-purple-600/25 scale-[1.02]'
                            : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-600 shadow-md shadow-blue-600/25 scale-[1.02]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bandeau d'explication dynamique qui s'anime au changement de rôle */}
              <div key={accountType} className="mt-2.5 animate-fadeIn">
                {accountType === 'proprietaire' && (
                  <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-left">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-900">Espace Bailleur Propriétaire</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[9px] font-black">
                          Loi 2019-576
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                        Gérez vos logements, rédigez vos baux avec dictée vocale IA et encaissez vos loyers en toute sécurité.
                      </p>
                    </div>
                  </div>
                )}

                {accountType === 'locataire' && (
                  <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-left">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Home className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-blue-900">Espace Candidat Locataire</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-200/80 text-blue-900 text-[9px] font-black">
                          Dossier Certifié
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-snug mt-0.5">
                        Postulez sans frais d'agence cachés, signez vos baux et téléchargez vos quittances officielles à QR Code.
                      </p>
                    </div>
                  </div>
                )}

                {accountType === 'agence' && (
                  <div className="p-3 bg-purple-50/90 border border-purple-200 rounded-2xl flex items-start gap-2.5 text-left">
                    <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-purple-900">Espace Agence Immobilière</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-200/80 text-purple-900 text-[9px] font-black">
                          Multi-Mandats
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-800 leading-snug mt-0.5">
                        Gestion centralisée des mandats, portefeuilles propriétaires, commissions et baux commerciaux AUDCG.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nom complet */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {accountType === 'agence' ? 'Nom du gérant / Responsable *' : 'Nom complet *'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={accountType === 'agence' ? 'Ex : Christian Yao (Directeur)' : 'Ex : Christian Yao'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Champ contextuel spécifique selon le rôle */}
            <div key={`detail-${accountType}`} className="animate-fadeIn">
              {accountType === 'proprietaire' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ville principale de vos biens (optionnel)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={roleDetail}
                      onChange={(e) => setRoleDetail(e.target.value)}
                      placeholder="Ex : Abidjan (Cocody, Marcory, Yopougon), Bouaké..."
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              {accountType === 'locataire' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Situation professionnelle (optionnel)
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-blue-600 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={roleDetail}
                      onChange={(e) => setRoleDetail(e.target.value)}
                      placeholder="Ex : Salarié du secteur privé, Fonctionnaire, Indépendant..."
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              {accountType === 'agence' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom commercial de l'agence ou N° Agrément *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-purple-600 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={roleDetail}
                      onChange={(e) => setRoleDetail(e.target.value)}
                      placeholder="Ex : Immobilière du Golf (RCCM CI-ABJ-2026-B-0192)"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adresse email *
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

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Téléphone (optionnel)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Mots de passe avec icône ŒIL (Show/Hide) pour éviter les fautes de frappe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mot de passe *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors focus:outline-none cursor-pointer"
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-blue-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmer *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors focus:outline-none cursor-pointer"
                    title={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 text-blue-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
                  accountType === 'proprietaire'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : accountType === 'agence'
                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Création du compte...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {accountType === 'proprietaire'
                        ? 'Continuer comme Bailleur Propriétaire'
                        : accountType === 'agence'
                        ? 'Continuer comme Agence Immobilière'
                        : 'Continuer comme Locataire'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500 border-t border-slate-100 pt-3.5">

            Vous avez déjà un compte ?{' '}
            <Link to="/login" className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
              Se connecter
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};
