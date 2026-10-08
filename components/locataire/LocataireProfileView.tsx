'use client';

import React, { useState, useEffect } from 'react';
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
  Camera,
  Briefcase,
  FileText,
  Upload,
  Eye,
  FileCheck,
  Lock,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import confetti from 'canvas-confetti';

export const LocataireProfileView: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: 'Abidjan',
    commune: '',
    profession: '',
    cniNumber: '',
  });

  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // États KYC & Document d'identité
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docSuccessMsg, setDocSuccessMsg] = useState<string | null>(null);
  const [docErrorMsg, setDocErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: user?.email || '',
        phone: profile.phone || '',
        city: profile.city || 'Abidjan',
        commune: profile.commune || '',
        profession: profile.profession || '',
        cniNumber: profile.cni_number || '',
      });
      setAvatarUrl(profile.avatar_url || '');
    } else if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
      }));
    }
  }, [profile, user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Fallback Base64 direct pour affichage immédiat
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          setAvatarUrl(base64);
          await supabase.from('profiles').update({ avatar_url: base64 }).eq('id', user.id);
          refreshProfile();
          window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: base64 } }));
        };
        reader.readAsDataURL(file);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        setAvatarUrl(publicUrl);
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
        refreshProfile();
        window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: publicUrl } }));
      }
    } catch (err: any) {
      console.warn('Notice avatar upload:', err?.message);
    }
  };

  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setDocErrorMsg('Le document ne doit pas dépasser 10 Mo.');
      return;
    }

    setDocErrorMsg(null);
    setSelectedDocFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setDocPreviewUrl(null);
    }
  };

  const handleKycDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedDocFile && !formData.cniNumber.trim() && !profile?.id_document_url) {
      setDocErrorMsg('Veuillez sélectionner un fichier (CNI / Passeport) et renseigner votre numéro de pièce.');
      return;
    }

    setIsUploadingDoc(true);
    setDocErrorMsg(null);
    setDocSuccessMsg(null);

    try {
      let finalDocUrl = profile?.id_document_url || '';

      if (selectedDocFile) {
        const fileExt = selectedDocFile.name.split('.').pop()?.toLowerCase() || 'pdf';
        const sanitizedName = `${Date.now()}_${selectedDocFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `kyc_documents/${user.id}/${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, selectedDocFile, {
            upsert: true,
            contentType: selectedDocFile.type,
          });

        if (uploadError) {
          // Fallback Base64 direct pour garantir l'enregistrement fiable
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(selectedDocFile);
          });
          finalDocUrl = await base64Promise;
        } else {
          const { data: publicData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

          finalDocUrl = publicData?.publicUrl || filePath;
        }
      }

      // Enregistrement dans Supabase table profiles avec statut 'en_attente'
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          cni_number: formData.cniNumber.trim(),
          id_document_url: finalDocUrl,
          verification_status: 'en_attente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSelectedDocFile(null);
      setDocPreviewUrl(null);
      setDocSuccessMsg('✅ Votre pièce d’identité a été transmise avec succès à l’administrateur ! Votre dossier KYC est désormais en cours d’examen.');

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Synchronisation inter-composants
      window.dispatchEvent(new CustomEvent('locatrust:profile_updated'));
      window.dispatchEvent(new CustomEvent('locatrust:verification_updated'));

      setTimeout(() => setDocSuccessMsg(null), 8000);
    } catch (err: any) {
      console.error('Erreur téléversement KYC:', err);
      setDocErrorMsg(err?.message || 'Erreur lors du téléversement du document.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setErrorMessage(null);
    setIsSaved(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName.trim(),
          phone: formData.phone.trim(),
          city: formData.city.trim(),
          commune: formData.commune.trim(),
          profession: formData.profession.trim(),
          cni_number: formData.cniNumber.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        setErrorMessage(error.message || 'Impossible de mettre à jour le profil.');
      } else {
        await refreshProfile();
        setIsSaved(true);
        window.dispatchEvent(new CustomEvent('locatrust:profile_updated'));
        setTimeout(() => setIsSaved(false), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const isVerified = profile?.verification_status === 'verifie';
  const isPending = profile?.verification_status === 'en_attente';
  const isRejected = profile?.verification_status === 'rejete';

  const creationDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      })
    : "Date d'inscription récente";

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12 font-sans">
      
      {/* 1. Header Banner Profile (Responsive Desktop & Mobile) */}
      <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left w-full sm:w-auto">
          
          {/* Avatar avec initiales réelles si aucune photo chargée */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={formData.fullName}
                className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-cover ring-4 ring-blue-600/20 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md ring-4 ring-blue-50">
                {formData.fullName
                  ? formData.fullName.charAt(0).toUpperCase()
                  : user?.email?.charAt(0).toUpperCase() || 'L'}
              </div>
            )}

            <label className="absolute bottom-1 right-1 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg transition-transform active:scale-90">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words">
                {formData.fullName || 'christian'}
              </h2>
              {/* Badge officiel attribué après validation administrative */}
              {isVerified && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Locataire Certifié</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Membre locataire LocaTrust • Inscrit en {creationDate}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 mt-1 text-xs text-slate-600 font-semibold flex-wrap">
              {formData.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{formData.phone}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 truncate max-w-full">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{formData.email || user?.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{formData.commune ? `${formData.commune}, ${formData.city}` : formData.city || 'Côte d\'Ivoire'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Statut administratif officiel */}
        <div className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center shrink-0 w-full md:w-auto border ${
          isVerified
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : isPending
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : isRejected
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
            Vérification Administrative
          </span>
          <span className="text-sm font-black mt-1 capitalize flex items-center gap-1.5">
            {isVerified ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Dossier Validé</span>
              </>
            ) : isPending ? (
              <>
                <Clock className="w-4 h-4 text-amber-600" />
                <span>En Attente D'examen</span>
              </>
            ) : isRejected ? (
              <>
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Dossier Rejeté</span>
              </>
            ) : (
              <span>Non vérifié</span>
            )}
          </span>
          <span className="text-[11px] font-bold opacity-70 mt-0.5">
            Loi CI n° 2019-576
          </span>
        </div>
      </div>

      {/* 2. SECTION DÉDIÉE : TÉLÉVERSEMENT & CERTIFICATION KYC (Demande directe du client) */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isVerified
                ? 'bg-emerald-100 text-emerald-700'
                : isPending
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Pièce d’Identité & Certification KYC
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Conforme aux exigences d’authentification de la Loi CI n° 2019-576
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto">
            {isVerified ? (
              <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Compte Officiellement Certifié</span>
              </span>
            ) : isPending ? (
              <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Examen en cours par l’administrateur</span>
              </span>
            ) : isRejected ? (
              <span className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Pièce à renouveler</span>
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-xs font-black flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>Non soumis</span>
              </span>
            )}
          </div>
        </div>

        {/* Retours visuels succès ou erreur */}
        {docSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 shadow-sm animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{docSuccessMsg}</span>
          </div>
        )}

        {docErrorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{docErrorMsg}</span>
          </div>
        )}

        {/* Message d'information contextuel selon le statut */}
        {isVerified ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                  Félicitations ! Votre profil est certifié conforme
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                  Votre pièce d’identité a été validée par nos juristes modérateurs. Vos candidatures bénéficient du statut prioritaire certifié auprès des propriétaires et bailleurs.
                </p>
                {formData.cniNumber && (
                  <p className="text-[11px] font-mono font-bold text-emerald-900 mt-1">
                    N° CNI enregistré : {formData.cniNumber}
                  </p>
                )}
              </div>
            </div>

            {profile?.id_document_url && (
              <a
                href={profile.id_document_url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 flex items-center gap-2 shrink-0 shadow-sm transition-all"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-700" />
                <span>Consulter ma pièce validée</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleKycDocSubmit} className="flex flex-col gap-4">
            {isPending && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <strong className="block font-black">Document transmis à l’administrateur</strong>
                  Votre pièce d’identité est actuellement dans la file d’attente de vérification de l’administrateur. Vous recevrez instantanément votre badge dès son approbation. Vous pouvez renvoyer une nouvelle version ci-dessous si nécessaire.
                </div>
              </div>
            )}

            {isRejected && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900">
                  <strong className="block font-black">Dossier rejeté par l’administrateur</strong>
                  Motif : {profile?.rejection_reason || 'Document illisible, tronqué ou expiré'}. Veuillez fournir une pièce d'identité en cours de validité.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro officiel CNI / Passeport / Attestation *
                </label>
                <input
                  type="text"
                  value={formData.cniNumber}
                  onChange={(e) => setFormData({ ...formData, cniNumber: e.target.value })}
                  placeholder="Ex : CI002894129 ou N° Passeport"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Numéro figurant sur la pièce d'identité ivoirienne (ONECI) ou passeport.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Téléverser la pièce d'identité (Recto-Verso ou PDF) *
                </label>
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition-colors">
                  <Upload className="w-6 h-6 text-blue-600 mb-1" />
                  <span className="text-xs font-bold text-slate-800">
                    {selectedDocFile ? selectedDocFile.name : 'Choisir un fichier (PNG, JPG, PDF)'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    {selectedDocFile
                      ? `${(selectedDocFile.size / 1024).toFixed(0)} Ko sélectionné`
                      : 'Glissez-déposez ou cliquez ici (Max 10 Mo)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleDocFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Aperçu de l'image sélectionnée */}
            {docPreviewUrl && (
              <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={docPreviewUrl}
                    alt="Aperçu CNI"
                    className="w-16 h-12 rounded-xl object-cover border border-slate-300 shadow-sm"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px] sm:max-w-xs">
                      {selectedDocFile?.name}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      ✓ Image prête à être transmise
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDocFile(null);
                    setDocPreviewUrl(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Pièce déjà existante enregistrée */}
            {profile?.id_document_url && !selectedDocFile && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-700">
                    Une pièce d'identité est actuellement enregistrée sur votre compte.
                  </span>
                </div>
                <a
                  href={profile.id_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Voir le document</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Transmission chiffrée SSL & sécurisée directement vers l’administrateur</span>
              </span>

              <button
                type="submit"
                disabled={isUploadingDoc || (!selectedDocFile && !formData.cniNumber.trim())}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
              >
                {isUploadingDoc ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Envoi du document à l’administrateur...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Soumettre ma pièce d’identité pour certification</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 3. Messages de retour pour le formulaire profil */}
      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Vos informations réelles ont été enregistrées avec succès dans la base de données !</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4. Formulaire des données réelles du locataire */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Identité & Informations Personnelles
              </h3>
            </div>
            {isVerified ? (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Dossier Certifié
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Pièce d'identité à valider
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom et prénoms *</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adresse email</label>
              <input
                type="email"
                disabled
                value={formData.email}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de Téléphone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+225 07 12 34 56 78"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° CNI ou Passeport</label>
              <input
                type="text"
                value={formData.cniNumber}
                onChange={(e) => setFormData({ ...formData, cniNumber: e.target.value })}
                placeholder="Ex : CI002894129"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Profession / Activité</label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                placeholder="Ex : Enseignant, Commerçant, Salarié"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ville de résidence</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Commune / Quartier</label>
              <input
                type="text"
                value={formData.commune}
                onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                placeholder="Ex : Cocody Angré 8e tranche"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:bg-blue-400 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement dans la base de données...</span>
                </>
              ) : (
                <span>Mettre à jour mon profil</span>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};
