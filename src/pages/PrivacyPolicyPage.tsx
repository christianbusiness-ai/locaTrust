import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { ShieldCheck, ArrowLeft, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* En-tête */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12">
          {/* Badge & Titre */}
          <div className="flex items-center gap-2.5 text-blue-600 text-sm font-bold tracking-wide uppercase mb-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Protection des données & vie privée
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Politique de Confidentialité de LocaTrust
          </h1>
          <p className="text-sm text-slate-500 mb-8 pb-6 border-b border-slate-100">
            Dernière mise à jour : 27 Octobre 2026 • Conforme aux lois ivoiriennes sur la protection des données (Loi n° 2013-450) et aux standards internationaux de sécurité.
          </p>

          <div className="space-y-8 text-slate-700 leading-relaxed">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                1. Engagement et Objet
              </h2>
              <p>
                <strong>LocaTrust</strong> s'engage à protéger la vie privée et les données personnelles de l'ensemble de ses utilisateurs (propriétaires, bailleurs, locataires et agences immobilières). La présente Politique de Confidentialité décrit les types de données que nous collectons, la manière dont elles sont traitées et sécurisées, ainsi que les droits dont vous disposez.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                2. Données collectées
              </h2>
              <p className="mb-3">
                Dans le cadre de l'utilisation de la plateforme LocaTrust et de l'authentification (y compris via Google OAuth), nous pouvons collecter les données suivantes :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600">
                <li><strong>Données d'identification :</strong> nom, prénom, adresse e-mail, numéro de téléphone, photo de profil (via compte Google avec votre consentement).</li>
                <li><strong>Données contractuelles et locatives :</strong> informations sur les biens immobiliers gérés, contrats de baux certifiés, inventaires, quittances de loyer, états des lieux.</li>
                <li><strong>Données de vérification d'identité (KYC) :</strong> pièces d'identité officielles, registres de commerce (pour les agences et bailleurs vérifiés).</li>
                <li><strong>Données de connexion et d'usage :</strong> adresses IP de connexion, journaux d'activité sécurisés, jetons cryptographiques de vérification des QR Codes.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                3. Utilisation des données recueillies via Google (OAuth)
              </h2>
              <p className="mb-3">
                Lorsque vous choisissez de vous connecter à LocaTrust via Google (« Se connecter avec Google ») :
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-950 space-y-2">
                <p>• Nous demandons uniquement les permissions strictes : <code>email</code>, <code>profile</code> et <code>openid</code>.</p>
                <p>• Ces informations servent exclusivement à créer et authentifier votre session utilisateur sur LocaTrust de manière sécurisée.</p>
                <p>• <strong>Aucune donnée Google n'est vendue, partagée à des tiers publicitaires, ni exploitée à des fins de ciblage commercial.</strong></p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                4. Sécurité et Chiffrement des Contrats
              </h2>
              <p>
                Tous les documents générés (baux certifiés selon la Loi n° 2019-576 du Code de la Construction et de l'Habitat, quittances certifiées) sont scellés cryptographiquement et hébergés dans des centres de données sécurisés avec chiffrement en transit (TLS 1.3) et au repos (AES-256). L'accès aux dossiers est strictement restreint aux parties signataires.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                5. Vos droits (Accès, Rectification, Suppression)
              </h2>
              <p className="mb-3">
                Conformément à la réglementation sur la protection des données, vous disposez d'un droit permanent :
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
                <li>D'accès à l'ensemble des données personnelles associées à votre compte.</li>
                <li>De rectification des données inexactes ou incomplètes.</li>
                <li>De suppression définitive de votre compte et de vos données personnelles.</li>
                <li>D'exportation et de portabilité de vos documents contractuels et quittances.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                6. Contact et Délégué à la Protection des Données
              </h2>
              <p>
                Pour toute question relative à la protection de vos données ou pour exercer vos droits, vous pouvez contacter notre équipe à tout moment :
              </p>
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-1">
                <p><strong>Plateforme :</strong> LocaTrust</p>
                <p><strong>E-mail d'assistance :</strong> <a href="mailto:christianyaokoffi88@gmail.com" className="text-blue-600 hover:underline">christianyaokoffi88@gmail.com</a></p>
                <p><strong>Site web officiel :</strong> <a href="https://locatrust.site" className="text-blue-600 hover:underline">https://locatrust.site</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
