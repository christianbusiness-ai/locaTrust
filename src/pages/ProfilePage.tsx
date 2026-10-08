import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { Logo } from '@/components/common/Logo';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
  Calendar,
  LogOut,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  LayoutDashboard,
  ShieldAlert,
  UploadCloud,
  FileText,
  Download,
  Eye,
  Trash2,
  X,
  Camera
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Abidjan');
  const [commune, setCommune] = useState('');
  const [profession, setProfession] = useState('');
  const [cniNumber, setCniNumber] = useState('');

  // États pour le téléversement de documents (KYC / Pièces justificatives)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [docType, setDocType] = useState('cni');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Gestion de la photo de profil réelle
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('locatrust_user_avatar');
      if (stored && !stored.includes('images.unsplash.com')) return stored;
    }
    return '';
  });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setCity(profile.city || 'Abidjan');
      setCommune(profile.commune || '');
      setProfession(profile.profession || '');
      setCniNumber(profile.cni_number || '');
      if (profile.avatar_url && !profile.avatar_url.includes('images.unsplash.com')) {
        setAvatarUrl(profile.avatar_url);
      }
    } else if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.user_metadata?.phone || '');
    }
  }, [profile, user]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('La photo sélectionnée dépasse la taille limite de 5 Mo.');
      return;
    }
    setIsUploadingAvatar(true);
    setErrorMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setAvatarUrl(base64);
        localStorage.setItem('locatrust_user_avatar', base64);
        window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: base64 } }));

        await supabase.from('profiles').update({ avatar_url: base64, updated_at: new Date().toISOString() }).eq('id', user.id);
        await refreshProfile();
        setSuccessMsg('Votre photo de profil réelle a été enregistrée avec succès !');
        setTimeout(() => setSuccessMsg(null), 3000);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la mise à jour de la photo.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Le fichier sélectionné dépasse la taille limite de 10 Mo.');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFilePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!cniNumber.trim()) {
      setErrorMsg('Veuillez renseigner le numéro officiel de votre pièce (CNI, Passeport ou RCCM).');
      return;
    }
    if (!selectedFile && !profile?.id_document_url) {
      setErrorMsg('Veuillez sélectionner un fichier (photo ou PDF de la pièce) à téléverser.');
      return;
    }

    setIsUploadingDoc(true);
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let finalDocUrl = profile?.id_document_url || '';

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf';
        const sanitizedName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `${user.id}/${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('id_documents')
          .upload(filePath, selectedFile, {
            upsert: true,
            contentType: selectedFile.type,
          });

        if (uploadError) {
          throw new Error(`Échec du téléversement vers le stockage sécurisé : ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from('id_documents')
          .getPublicUrl(filePath);

        finalDocUrl = publicData?.publicUrl || filePath;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          cni_number: cniNumber.trim(),
          id_document_url: finalDocUrl,
          verification_status: 'en_attente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSelectedFile(null);
      setFilePreview(null);
      setSuccessMsg('✅ Votre document a été téléversé avec succès ! Votre dossier KYC est désormais en cours d\'examen par l\'administrateur.');
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Erreur téléversement document:', err);
      setErrorMsg(err?.message || 'Erreur lors du téléversement du document.');
    } finally {
      setIsUploadingDoc(false);
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          commune: commune.trim(),
          profession: profession.trim(),
          cni_number: cniNumber.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        setErrorMsg(error.message || 'Impossible de mettre à jour le profil.');
      } else {
        await refreshProfile();
        setSuccessMsg('Votre profil a été mis à jour avec succès dans la base de données !');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const isVerified = profile?.verification_status === 'verifie';
  const roleLabel =
    profile?.account_type === 'proprietaire'
      ? 'Bailleur Propriétaire'
      : profile?.account_type === 'agence'
      ? 'Agence Immobilière'
      : 'Locataire';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navigation supérieure */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black tracking-wider uppercase border border-blue-100">
              Espace Personnel
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Tableau de Bord</span>
            </Link>

            <button
              onClick={handleSignOut}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Carte d'en-tête Profil */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group shrink-0">
            {avatarUrl && !avatarUrl.includes('images.unsplash.com') ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Profil'}
                className="w-20 h-20 rounded-2xl object-cover shadow-md shrink-0 ring-4 ring-blue-50"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 ring-4 ring-blue-50 select-none">
                {fullName ? fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : user?.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-all border-2 border-white cursor-pointer active:scale-95"
              title="Changer ma photo de profil"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {fullName || 'Utilisateur LocaTrust'}
              </h1>
              {/* N'affiche le badge que si l'administrateur a réellement validé */}
              {isVerified ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Compte Certifié</span>
                </span>
              ) : null}
            </div>

            <p className="text-xs font-bold text-blue-600 mb-2">
              Profil {roleLabel} • Rôle système : {profile?.role || 'user'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.email}
              </span>
              {phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Inscrit le {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : 'Récent'}
              </span>
            </div>
          </div>
        </div>

        {/* Alertes retour */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 shadow-sm animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulaire d'édition du profil */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Informations du compte (Base de données)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Données réelles enregistrées dans la table sécurisée <code>profiles</code>
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom et prénoms *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adresse email (non modifiable)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 12 34 56 78"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ville de résidence
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Commune / Quartier
                </label>
                <input
                  type="text"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="Ex : Cocody, Angré"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Profession / Activité
                </label>
                <input
                  type="text"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Ex : Cadre bancaire, Commerçant..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:bg-blue-400 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <span>Enregistrer les coordonnées</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION VÉRIFICATION ADMINISTRATIVE KYC (Point clé Audio) */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-black text-slate-900">
                  Dossier de Vérification d'Identité (KYC Administrateur)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Conforme Loi n° 2019-576. La certification par l'administrateur débloque les publications et candidatures.
              </p>
            </div>

            {/* Badge de statut actuel */}
            <div className="self-start sm:self-auto">
              {profile?.verification_status === 'verifie' ? (
                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Dossier Officiellement Validé</span>
                </span>
              ) : profile?.verification_status === 'en_attente' ? (
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-black flex items-center gap-1.5 shadow-sm">
                  <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                  <span>Examen Administrateur en cours</span>
                </span>
              ) : profile?.verification_status === 'rejete' ? (
                <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-black flex items-center gap-1.5 shadow-sm">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Dossier Rejeté</span>
                </span>
              ) : (
                <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs font-black flex items-center gap-1.5 shadow-sm">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  <span>Non Vérifié (Action Requise)</span>
                </span>
              )}
            </div>
          </div>

          {/* RÈGLES DE SÉCURITÉ AFFICHÉES SELON LE RÔLE */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
              Droits d'accès liés à votre statut KYC :
            </h4>
            {profile?.account_type === 'locataire' ? (
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  {isVerified ? (
                    <span className="text-emerald-600 font-bold">✔</span>
                  ) : (
                    <span className="text-amber-600 font-bold">🔒</span>
                  )}
                  <span><strong>Demandes de location :</strong> {isVerified ? 'Débloquées (Vous pouvez postuler aux logements)' : 'Bloquées jusqu\'à validation de votre CNI par l\'administrateur'}</span>
                </li>
                <li className="flex items-center gap-2">
                  {isVerified ? (
                    <span className="text-emerald-600 font-bold">✔</span>
                  ) : (
                    <span className="text-amber-600 font-bold">🔒</span>
                  )}
                  <span><strong>Demandes de visite :</strong> {isVerified ? 'Débloquées (Vous pouvez réserver des visites)' : 'Bloquées jusqu\'à validation de votre CNI par l\'administrateur'}</span>
                </li>
              </ul>
            ) : (
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  {isVerified ? (
                    <span className="text-emerald-600 font-bold">✔</span>
                  ) : (
                    <span className="text-amber-600 font-bold">🔒</span>
                  )}
                  <span><strong>Publication d'annonces immobilières :</strong> {isVerified ? 'Débloquée (Vos biens sont visibles avec le badge Bailleur Certifié)' : 'Bloquée jusqu\'à validation de votre CNI/RCCM par l\'administrateur'}</span>
                </li>
                <li className="flex items-center gap-2">
                  {isVerified ? (
                    <span className="text-emerald-600 font-bold">✔</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">✔</span>
                  )}
                  <span><strong>Badge officiel de confiance :</strong> {isVerified ? 'Attribué et visible sur toutes vos annonces' : 'En attente de certification administrative'}</span>
                </li>
              </ul>
            )}
          </div>

          {/* MOTIF SI REJETÉ */}
          {profile?.verification_status === 'rejete' && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs">
              <span className="font-black flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Motif du rejet par l'administrateur :
              </span>
              <p className="font-semibold text-rose-800">
                {profile?.rejection_reason || 'Document fourni illisible ou non conforme aux normes officielles.'}
              </p>
              <p className="mt-1 text-[11px] text-rose-700">
                Veuillez renvoyer ci-dessous une photo nette de votre pièce d'identité officielle (CNI recto/verso ou Passeport).
              </p>
            </div>
          )}

          {/* SI DÉJÀ VÉRIFIÉ */}
          {profile?.verification_status === 'verifie' ? (
            <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-emerald-950">
                  Votre identité a été validée par l'administrateur LocaTrust
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Pièce d'identité N° <strong>{profile.cni_number || 'Certifiée'}</strong> enregistrée. Vos droits complets sont actifs et votre badge de confiance est affiché sur vos interactions.
                </p>
                {profile?.id_document_url && (
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={profile.id_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-emerald-800 border border-emerald-300 font-bold text-xs hover:bg-emerald-100 transition-colors shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Consulter ma pièce validée</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* FORMULAIRE DE SOUMISSION / TÉLÉVERSEMENT DU DOCUMENT KYC */
            <form onSubmit={handleUploadDocument} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type de document officiel *
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="cni">Carte Nationale d'Identité (CNI)</option>
                    <option value="passeport">Passeport Biométrique</option>
                    <option value="attestation">Attestation d'Identité ONECI</option>
                    {profile?.account_type === 'agence' && (
                      <option value="rccm">Registre du Commerce & Crédit Mobilier (RCCM)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro officiel de la pièce (CNI / Passeport / RCCM) *
                  </label>
                  <input
                    type="text"
                    required
                    value={cniNumber}
                    onChange={(e) => setCniNumber(e.target.value)}
                    placeholder="Ex: CI002948175 ou N° RCCM"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* ZONE DE TÉLÉVERSEMENT INTERACTIVE DU DOCUMENT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Photo ou scan de la pièce (Recto / Verso ou PDF) *</span>
                  <span className="text-[11px] font-medium text-slate-500">Max 10 Mo</span>
                </label>

                {/* Input caché */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Si aucun fichier sélectionné mais déjà un document en ligne */}
                {!selectedFile && profile?.id_document_url && (
                  <div className="mb-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-blue-900 font-bold">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Document actuellement archivé sur le serveur</span>
                    </div>
                    <a
                      href={profile.id_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Voir</span>
                    </a>
                  </div>
                )}

                {/* Si un fichier local vient d'être sélectionné */}
                {selectedFile ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-blue-300 ring-2 ring-blue-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Aperçu"
                          className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 block truncate">
                          {selectedFile.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold block">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} Mo &bull; {selectedFile.type || 'Fichier'}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          Prêt pour le téléversement
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors"
                      >
                        Changer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Supprimer la sélection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Zone de glisser-déposer / clic */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) {
                        const fakeEvent = {
                          target: { files: [droppedFile] }
                        } as any;
                        handleFileChange(fakeEvent);
                      }
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 sm:p-8 text-center bg-slate-50/50 hover:bg-blue-50/30 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block group-hover:text-blue-700">
                          Cliquez pour choisir un document ou glissez-le ici
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          Formats acceptés : JPG, PNG, WEBP ou PDF (CNI recto/verso ou Passeport)
                        </span>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shadow-xs">
                        Parcourir mes fichiers
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || isUploadingDoc}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:bg-blue-400 cursor-pointer"
                >
                  {isUploadingDoc || saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Téléversement du document en cours...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Téléverser et soumettre mon dossier KYC</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

      </main>
    </div>
  );
};
