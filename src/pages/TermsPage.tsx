import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { FileText, ArrowLeft, Scale, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const TermsPage: React.FC = () => {
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
            <Scale className="w-5 h-5 text-blue-600" />
            Cadre légal & d'utilisation
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Conditions Générales d'Utilisation (CGU)
          </h1>
          <p className="text-sm text-slate-500 mb-8 pb-6 border-b border-slate-100">
            Dernière mise à jour : 27 Octobre 2026 • Plateforme conforme à la Loi ivoirienne n° 2019-576 du Code de la Construction et de l'Habitat et aux Actes Uniformes de l'OHADA (AUDCG).
          </p>

          <div className="space-y-8 text-slate-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                1. Présentation de la Plateforme
              </h2>
              <p>
                <strong>LocaTrust</strong> est une solution logicielle (SaaS) dédiée à la gestion locative immobilière, à la certification de contrats de baux électroniques et à la sécurisation des relations entre bailleurs, agences et locataires en Côte d'Ivoire et dans l'espace OHADA.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                2. Conformité Juridique des Baux Électroniques
              </h2>
              <p className="mb-2">
                Les contrats générés sur LocaTrust intègrent un moteur de conformité stricte garantissant :
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
                <li>Le plafonnement d'ordre public de la caution à deux (2) mois de loyer hors charges conformément à l'<strong>Article 414 de la Loi n° 2019-576</strong>.</li>
                <li>L'imputation des grosses réparations au bailleur conformément à l'<strong>Article 428 de la Loi n° 2019-576</strong> et l'Article 106 de l'AUDCG OHADA.</li>
                <li>La valeur probante des signatures électroniques certifiées et des QR Codes de traçabilité publique.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                3. Comptes et Sécurité des Accès
              </h2>
              <p>
                L'utilisateur s'engage à fournir des informations exactes et sincères lors de son inscription, que celle-ci soit effectuée par formulaire standard ou via l'authentification Google OAuth. Chaque utilisateur est responsable de la confidentialité de ses identifiants et de l'activité sur son compte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                4. QR Codes et Registre Public d'Authenticité
              </h2>
              <p>
                Chaque contrat de bail scellé et chaque quittance de loyer délivrée sur la plateforme est associé à un jeton d'intégrité scannable via QR Code. Toute reproduction falsifiée ou altération d'un document original certifié engage la responsabilité civile et pénale de son auteur.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                5. Contact
              </h2>
              <p>
                Pour toute réclamation ou question relative aux présentes conditions, vous pouvez contacter notre service juridique à :  
                <a href="mailto:christianyaokoffi88@gmail.com" className="text-blue-600 font-semibold hover:underline ml-1">
                  christianyaokoffi88@gmail.com
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
