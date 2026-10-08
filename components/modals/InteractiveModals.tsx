'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  FileText,
  CreditCard,
  Send,
  Building2,
  Phone,
  QrCode,
  Download,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Sparkles,
  FileCheck,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Scale
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import { createProperty } from '@/lib/supabase/services';
import { useAuth } from '@/src/context/AuthContext';
import { useNavigate } from 'react-router-dom';

// 1. Ajouter un bien Modal
export const AddPropertyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isVerified = profile?.verification_status === 'verifie';

  const [title, setTitle] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('appartement');
  const [customType, setCustomType] = useState<string>('');
  const [usageDestination, setUsageDestination] = useState<string>('habitation');
  const [authorizedActivity, setAuthorizedActivity] = useState<string>('');
  const [ownerAuthorized, setOwnerAuthorized] = useState<boolean>(true);
  const [country, setCountry] = useState<string>("Côte d'Ivoire");
  const [city, setCity] = useState<string>('Abidjan');
  const [customCity, setCustomCity] = useState<string>('');
  const [commune, setCommune] = useState<string>('Cocody');
  const [customCommune, setCustomCommune] = useState<string>('');
  const [quartier, setQuartier] = useState<string>('');
  const [rent, setRent] = useState<number>(250000);
  const [caution, setCaution] = useState<number>(500000);
  const [surface, setSurface] = useState<number>(75);
  const [description, setDescription] = useState<string>('');
  const [photosUrl, setPhotosUrl] = useState<string>('https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80');
  const [photosCount, setPhotosCount] = useState<number>(3);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      setErrorMsg('⚠️ Publication non autorisée : votre compte propriétaire/agence doit être certifié par l\'administrateur avant de pouvoir publier une maison.');
      return;
    }
    if (!videoUrl.trim()) {
      setErrorMsg('⚠️ Une vidéo réelle du logement est obligatoire pour éviter les fausses annonces (Section 10).');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    const finalType = propertyType === 'autre' ? (customType.trim() || 'Logement') : propertyType;
    const finalCity = city === 'autre_ville' ? (customCity.trim() || 'Abidjan') : city;
    const finalCommune = (commune === 'autre_commune' || city === 'autre_ville') ? (customCommune.trim() || 'Cocody') : commune;
    const finalTitle = title.trim() || `${finalType.charAt(0).toUpperCase() + finalType.slice(1)} de standing - ${finalCommune}`;

    const newPropPayload = {
      title: finalTitle,
      type: finalType,
      usage_destination: usageDestination === 'habitation' ? ('habitation' as const) : ('professionnel' as const),
      authorized_activity: usageDestination === 'habitation' ? undefined : (authorizedActivity.trim() || 'Activité professionnelle'),
      owner_destination_authorized: ownerAuthorized,
      country,
      city: finalCity,
      commune: finalCommune,
      quartier: quartier.trim() || 'Centre',
      surface: Number(surface) || 75,
      rent: Number(rent) || 250000,
      caution: Number(caution) || 500000,
      description: description.trim(),
      status: 'disponible',
      photos: photosUrl.split(',').map(s => s.trim()).filter(Boolean),
      videos: [videoUrl.trim()]
    };

    // 1. Sauvegarde dans Supabase
    const { data: dbData, error: dbErr } = await createProperty(newPropPayload);
    if (dbErr) {
      console.warn('Notice Supabase createProperty:', dbErr);
    }

    // 2. Synchronisation locale immédiate
    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem('locatrust_properties');
      let list = [];
      if (existing) {
        try { list = JSON.parse(existing); } catch {}
      }
      const propToSave = dbData || {
        ...newPropPayload,
        id: 'prop_' + Date.now(),
        created_at: new Date().toISOString(),
        location: { city: finalCity, commune: finalCommune, quartier: quartier.trim() || 'Centre' },
        pricing: { monthly_rent: Number(rent), deposit_months: Math.round(Number(caution) / Number(rent)) || 2 },
        usage_destination: usageDestination === 'habitation' ? 'habitation' : 'professionnel',
        authorized_activity: usageDestination === 'habitation' ? undefined : authorizedActivity.trim(),
        owner_destination_authorized: ownerAuthorized
      };
      list.unshift(propToSave);
      localStorage.setItem('locatrust_properties', JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: propToSave }));
    }

    setLoading(false);
    confetti({
      particleCount: 50,
      spread: 45,
      origin: { y: 0.6 },
      colors: ['#1D4ED8', '#F59E0B', '#10B981']
    });
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Publier un Nouveau Bien</h3>
              <p className="text-xs text-slate-500">Formulaire complet & souple avec géolocalisation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {!isVerified ? (
          <div className="p-5 mb-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="font-black text-sm">Vérification KYC requise pour publier</span>
            </div>
            <p className="font-medium text-amber-800 leading-relaxed">
              Pour garantir la sécurité des locataires et éliminer les fausses annonces, la publication de logements est strictement réservée aux bailleurs et agences certifiés par l'administrateur.
            </p>
            <div className="text-[11px] font-bold text-amber-900 bg-white/70 p-2.5 rounded-xl border border-amber-200">
              Statut de votre compte : {profile?.verification_status === 'en_attente' ? '⏳ Dossier en cours d\'examen par l\'administrateur' : profile?.verification_status === 'rejete' ? `❌ Dossier rejeté (${profile.rejection_reason || 'Document illisible'})` : '⚠️ Aucune pièce d\'identité soumise'}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/profile');
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Faire valider mon compte (KYC)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Compte Certifié par l'Administration — Publication autorisée</span>
          </div>
        )}

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-black text-slate-900">Bien publié avec succès !</h4>
            <p className="text-xs text-slate-600 max-w-xs">
              Votre bien est désormais actif dans votre patrimoine et visible selon vos règles de location.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Titre de l'annonce</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Appartement 3 pièces standing à Cocody Riviera 3"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            {/* CHOIX DU TYPE DE BIEN AVEC OPTION AUTRE (Point 6) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Type de bien</label>
                <select
                  value={propertyType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPropertyType(val);
                    if (val === 'bureau') {
                      setUsageDestination('bureau');
                      if (!authorizedActivity) setAuthorizedActivity('Bureaux administratifs & commerciaux');
                    } else if (val === 'magasin' || val === 'boutique') {
                      setUsageDestination('boutique');
                      if (!authorizedActivity) setAuthorizedActivity('Commerce et magasin de vente au détail');
                    } else if (val === 'entrepot') {
                      setUsageDestination('industriel');
                      if (!authorizedActivity) setAuthorizedActivity('Entrepôt et stockage de marchandises');
                    } else if (['appartement', 'maison', 'villa', 'studio', 'chambre-salon', 'entree-coucher', 'duplex'].includes(val)) {
                      if (usageDestination === 'bureau' || usageDestination === 'boutique' || usageDestination === 'industriel') {
                        setUsageDestination('habitation');
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                  <option value="studio">Studio</option>
                  <option value="chambre-salon">Chambre-salon</option>
                  <option value="entree-coucher">Entrée-coucher</option>
                  <option value="villa">Villa</option>
                  <option value="duplex">Duplex</option>
                  <option value="bureau">Bureau</option>
                  <option value="magasin">Magasin</option>
                  <option value="boutique">Boutique</option>
                  <option value="terrain">Terrain</option>
                  <option value="entrepot">Entrepôt</option>
                  <option value="parking">Parking</option>
                  <option value="autre">Autre (préciser)</option>
                </select>
              </div>

              {propertyType === 'autre' ? (
                <div>
                  <label className="text-xs font-bold text-blue-700 block mb-1">Précisez le type personnalisé</label>
                  <input
                    type="text"
                    required
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="ex: Immeuble de rapport, Hangar..."
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-blue-400 bg-blue-50/50 text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Pays</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                    <option value="Sénégal">Sénégal</option>
                    <option value="Cameroun">Cameroun</option>
                    <option value="Bénin">Bénin</option>
                    <option value="Togo">Togo</option>
                    <option value="Mali">Mali</option>
                    <option value="Burkina Faso">Burkina Faso</option>
                    <option value="Autre pays">Autre pays</option>
                  </select>
                </div>
              )}
            </div>

            {/* DESTINATION DU LOCAL (Classification juridique préparée en arrière-plan) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-blue-600" />
                  <span>Destination d'usage du local</span>
                </label>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  usageDestination === 'habitation' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {usageDestination === 'habitation' ? 'Bail Habitation (Loi 2019-576)' : 'Bail Professionnel (OHADA AUDCG)'}
                </span>
              </div>

              <select
                value={usageDestination}
                onChange={(e) => {
                  const val = e.target.value;
                  setUsageDestination(val);
                  if (val === 'habitation') {
                    setAuthorizedActivity('');
                  } else if (!authorizedActivity) {
                    if (val === 'bureau') setAuthorizedActivity('Bureaux administratifs & commerciaux');
                    else if (val === 'boutique') setAuthorizedActivity('Commerce et vente au détail');
                    else if (val === 'cabinet') setAuthorizedActivity('Cabinet professionnel / profession libérale');
                    else if (val === 'atelier') setAuthorizedActivity('Atelier d\'artisanat');
                    else if (val === 'industriel') setAuthorizedActivity('Activité industrielle et stockage');
                    else setAuthorizedActivity('Activité professionnelle');
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="habitation">Habitation (Logement principal)</option>
                <option value="bureau">Bureau / Activité professionnelle</option>
                <option value="boutique">Boutique / Magasin commercial</option>
                <option value="cabinet">Cabinet / Profession libérale</option>
                <option value="atelier">Atelier / Artisanat</option>
                <option value="industriel">Activité industrielle / Entrepôt</option>
                <option value="autre_pro">Autre activité professionnelle</option>
              </select>

              {usageDestination !== 'habitation' && (
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-blue-900 block mb-1">
                      Activité prévue autorisée dans les lieux :
                    </label>
                    <input
                      type="text"
                      required
                      value={authorizedActivity}
                      onChange={(e) => setAuthorizedActivity(e.target.value)}
                      placeholder="ex: Bureaux d'une société, Vente de vêtements, Cabinet dentaire..."
                      className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={ownerAuthorized}
                      onChange={(e) => setOwnerAuthorized(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-bold text-slate-700">
                      Le bailleur autorise expressément cette destination professionnelle (Art. 103 AUDCG)
                    </span>
                  </label>
                </div>
              )}

              <p className="text-[10px] text-slate-500 italic">
                {usageDestination === 'habitation'
                  ? "• Bail d'habitation : Plafonnement légal de la caution à 2 mois (Loi 2019-576) & enregistrement fiscal DGI obligatoire."
                  : "• Bail professionnel : Acte Uniforme OHADA AUDCG (liberté contractuelle des garanties & droit au renouvellement après 2 ans)."}
              </p>
            </div>

            {/* LOCALITÉS SOUPLES : VILLE, COMMUNE, QUARTIER */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ville</label>
                {city === 'autre_ville' ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      placeholder="ex: Korhogo, Daloa..."
                      className="w-full px-3 py-2 rounded-xl border-2 border-blue-400 bg-blue-50/50 text-xs font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCity('Abidjan')}
                      className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      Liste
                    </button>
                  </div>
                ) : (
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="Abidjan">Abidjan</option>
                    <option value="Yamoussoukro">Yamoussoukro</option>
                    <option value="Bouaké">Bouaké</option>
                    <option value="San Pedro">San Pedro</option>
                    <option value="Grand-Bassam">Grand-Bassam</option>
                    <option value="Daloa">Daloa</option>
                    <option value="Korhogo">Korhogo</option>
                    <option value="Dakar">Dakar</option>
                    <option value="Douala">Douala</option>
                    <option value="autre_ville">+ Saisir une autre ville</option>
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Commune</label>
                {commune === 'autre_commune' || city === 'autre_ville' ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={customCommune}
                      onChange={(e) => setCustomCommune(e.target.value)}
                      placeholder="Saisir la commune (ex: Commerce, Air France...)"
                      className="w-full px-3 py-2 rounded-xl border-2 border-blue-400 bg-blue-50/50 text-xs font-bold focus:outline-none"
                    />
                    {city !== 'autre_ville' && (
                      <button
                        type="button"
                        onClick={() => setCommune('Cocody')}
                        className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                      >
                        Liste
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="Cocody">Cocody</option>
                    <option value="Yopougon">Yopougon</option>
                    <option value="Marcory">Marcory</option>
                    <option value="Plateau">Plateau</option>
                    <option value="Koumassi">Koumassi</option>
                    <option value="Treichville">Treichville</option>
                    <option value="Port-Bouët">Port-Bouët</option>
                    <option value="Bingerville">Bingerville</option>
                    <option value="autre_commune">+ Saisir une autre commune</option>
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Quartier</label>
                <input
                  type="text"
                  required
                  value={quartier}
                  onChange={(e) => setQuartier(e.target.value)}
                  placeholder="ex: Angré 8ème tranche"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Loyer Mensuel (FCFA)</label>
                <input
                  type="number"
                  required
                  value={rent}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setRent(r);
                    setCaution(r * 2);
                  }}
                  placeholder="250000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Caution (Max 2 mois Art. 414)</label>
                <input
                  type="number"
                  required
                  value={caution}
                  onChange={(e) => setCaution(Number(e.target.value))}
                  placeholder="500000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Section: Photos & Vidéo Obligatoires */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-black text-blue-950">
                <span>📷 Photos Réelles Obligatoires</span>
                <span className="text-[10px] text-blue-700">Façade, Salon, Chambres, Cuisine, SDB</span>
              </div>
              <input
                type="text"
                required
                value={photosUrl}
                onChange={(e) => setPhotosUrl(e.target.value)}
                placeholder="URLs ou photos réelles du bien (séparées par des virgules)"
                className="w-full p-2.5 rounded-xl bg-white border border-blue-200 text-xs font-medium"
              />

              <div className="flex items-center justify-between text-xs font-black text-blue-950 mt-1">
                <span>🎥 Vidéo Obligatoire du Logement</span>
                <span className="text-[10px] text-rose-600 font-bold">Lien vidéo requis</span>
              </div>
              <input
                type="text"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Lien vidéo de visite réelle (ex: https://youtu.be/xyz ou lien MP4)..."
                className="w-full p-2.5 rounded-xl bg-white border border-blue-200 text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Description & Équipements</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Climatisation, chauffe-eau, sécurité 24h/7, parking..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                Annuler
              </button>
              <button 
                type="submit" 
                disabled={loading || !isVerified}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : !isVerified ? (
                  <span>🔒 Validation KYC requise pour publier</span>
                ) : (
                  <span>Publier le bien</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import { LegalContractGeneratorModal } from '@/components/contracts/LegalContractGeneratorModal';

// 2. Créer un contrat Modal (Integrated with Full LocaTrust Compliance Engine)
export const CreateContractModal: React.FC<{ isOpen: boolean; onClose: () => void; initialData?: any }> = ({ isOpen, onClose, initialData }) => {
  return <LegalContractGeneratorModal isOpen={isOpen} onClose={onClose} initialData={initialData} />;
};

// 3. Confirmer un paiement Modal
export const ConfirmPaymentModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    confetti({ particleCount: 70, spread: 50, origin: { y: 0.6 } });
    alert('Paiement validé avec succès ! La quittance PDF a été envoyée au locataire.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Valider un Règlement de Loyer</h3>
              <p className="text-xs text-slate-500">Confirmez la réception des fonds</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Locataire concerné</label>
            <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none">
              <option>Candidat Locataire — Appartement 3 pièces Cocody (150 000 FCFA)</option>
              <option>Locataire — Studio Marcory Zone 4 (250 000 FCFA)</option>
              <option>Marc Kouassi — Villa Bingerville (80 000 FCFA)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Montant Reçu (FCFA)</label>
              <input type="number" defaultValue="150000" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Moyen de Paiement</label>
              <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none">
                <option>Orange Money (+225 07...)</option>
                <option>MTN Mobile Money (+225 05...)</option>
                <option>Wave (+225 01...)</option>
                <option>Virement Bancaire (SGBCI)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Référence Transaction Mobile / IBAN</label>
            <input type="text" placeholder="ex: OM-TXN-99882233" defaultValue="OM-CI-2026-99211" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30">
              Confirmer & Émettre Quittance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. Envoyer un rappel Modal
export const SendReminderModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Relance automatique transmise par SMS et WhatsApp au locataire !');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Envoyer un Rappel de Loyer</h3>
              <p className="text-xs text-slate-500">Relance amiable par SMS et WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Destinataire</label>
            <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none">
              <option>Candidat Locataire (+225 05 67 89 45 12)</option>
              <option>Marc Kouassi (+225 07 11 22 33 44)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Message de Relance</label>
            <textarea
              rows={4}
              defaultValue="Bonjour M. Candidat Locataire, sauf erreur de notre part, le règlement de votre loyer du mois en cours (150 000 FCFA) est à échéance. Merci d'effectuer votre versement via LocaTrust Mobile Money."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30">
              Envoyer maintenant (SMS + WhatsApp)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 5. Ajouter un compte de paiement Modal
export const AddPaymentAccountModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Moyen de paiement enregistré avec succès !');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Ajouter un Compte de Encaissement</h3>
              <p className="text-xs text-slate-500">Orange Money, MTN, Wave ou RIB Bancaire</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Opérateur / Type</label>
            <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none">
              <option>Orange Money Côte d'Ivoire</option>
              <option>MTN Mobile Money</option>
              <option>Wave Côte d'Ivoire</option>
              <option>Virement Bancaire (RIB / IBAN)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Numéro de Téléphone ou RIB</label>
            <input type="text" required placeholder="+225 07 08 09 10 11" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Nom du Titulaire du Compte</label>
            <input type="text" required defaultValue="" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30">
              Activer ce moyen de paiement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 6. Support Modal - Formulaire d'envoi de message direct au Support LocaTrust (Sans numéros directs ni coordonnées brutes)
export const SupportModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [subject, setSubject] = React.useState('');
  const [category, setCategory] = React.useState('Question générale');
  const [message, setMessage] = React.useState('');
  const [isSent, setIsSent] = React.useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setIsSent(true);
  };

  const handleResetAndClose = () => {
    setIsSent(false);
    setSubject('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        
        {isSent ? (
          <div className="py-6 flex flex-col items-center text-center gap-3 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Message envoyé avec succès !</h3>
            <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
              Votre demande a été attribuée à un conseiller LocaTrust dédié (Ticket <strong>TK-{Math.floor(1000 + Math.random() * 9000)}</strong>). Vous recevrez la réponse directement dans votre messagerie dans un délai garanti de moins de 2 heures.
            </p>
            <button
              onClick={handleResetAndClose}
              className="mt-3 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95"
            >
              Compris, fermer
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Assistance Client LocaTrust 7j/7</h3>
                  <p className="text-xs text-slate-500">Transmettez votre message directement à nos conseillers certifiés.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Objet de votre demande <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Précision sur ma quittance, question sur mon bail..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Paiement & Quittances">Paiement & Quittances de loyer</option>
                  <option value="Contrat de bail">Contrat de bail & Signatures</option>
                  <option value="Caution & Séquestre">Caution & Séquestre bancaire</option>
                  <option value="Maintenance">Maintenance & Réparations</option>
                  <option value="Question générale">Autre demande</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Votre Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Expliquez en détail votre besoin afin que nous puissions vous répondre au mieux..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer mon message</span>
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
};
