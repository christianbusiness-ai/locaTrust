# GEMINI.md — Guide Complet & Documentation Technique de LocaTrust

Ce document constitue la référence exhaustive du projet **LocaTrust**. Il présente la raison d'être de l'application, l'ensemble des fonctionnalités implémentées, l'arborescence des fichiers, les technologies utilisées, les choix architecturaux et de design, ainsi que les instructions impératives pour tout futur modèle d'IA intervenant sur ce codebase.

---

## 1. Ce que l'application fait

**LocaTrust** est un **SaaS de gestion locative immobilière de référence en Afrique**, conçu spécifiquement pour répondre aux réalités économiques et juridiques de l'espace francophone africain, avec une conformité stricte et native à la **Loi ivoirienne n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et de l'Habitat** et aux **Actes Uniformes de l'OHADA (notamment l'AUDCG pour les baux professionnels)**.

### Problématiques résolues par LocaTrust :
1. **Sécurisation des baux et conformité légale** : Fin des contrats informels rédigés sur papier libre ou comportant des clauses illégales (ex: cautions excessives de 4 à 6 mois pourtant strictement plafonnées à 2 mois par l'Art. 414 de la Loi 2019-576, transferts illégaux des réparations de toiture ou de gros œuvre au preneur).
2. **Dictée vocale et reformulation juridique par IA** : Permet aux propriétaires et bailleurs, quel que soit leur niveau de maîtrise du français ou du droit, de dicter leurs exigences à l'oral avec leurs propres mots. LocaTrust transcrit la voix en temps réel, sépare automatiquement les obligations (Bailleur, Preneur, Logement/Copropriété), identifie les clauses abusives, cite les articles de loi et reformule le tout en clauses juridiques élégantes et opposables.
3. **Gestion transparente des candidatures et fin des doubles signatures** : Gestion de listes d'attente multi-candidats sur un même bien, verrouillage automatique du logement dès la finalisation d'un contrat, et refus automatique avec notification courtoise pour les candidats non retenus.
4. **Authentification des documents par QR Code officiel** : Tous les contrats de bail et quittances de loyer générés par LocaTrust intègrent un QR Code dynamique de vérification publique garantissant l'inviolabilité du document.
5. **Fluidification des paiements en monnaie électronique** : Intégration des modes de paiement locaux dominants (Wave, Orange Money, MTN Moov) en mode déclaratif/confirmé pour les loyers, et passerelles sécurisées pour les abonnements.

---

## 2. Toutes les fonctionnalités implémentées

### A. Espace Propriétaire & Bailleur Indépendant
* **Tableau de bord financier en temps réel** : Suivi des loyers encaissés, loyers en retard, cautions consignées, taux d'occupation et métriques de rentabilité.
* **Gestion du parc immobilier** : Création de biens, fiches détaillées, localisation géographique (Abidjan, Bouaké, Yamoussoukro, etc.), mise en corbeille et restauration sécurisée.
* **Demandes de location & Multi-candidatures (`DemandesView.tsx`)** :
  * Affichage de plusieurs candidats pour un même bien (ex: Appartement A à Cocody).
  * Consultation du dossier de candidature certifié (pièce d'identité CNI/Passeport, quittances antérieures, contrat de travail).
  * Sélection d'un candidat retenu et mise en attente automatique des autres.
  * **Workflow de signature & finalisation verrouillé** :
    * *Avant signature locataire* : Le bouton « Finaliser le contrat » est présent mais **désactivé / non cliquable** (`disabled`, grisé). Il est techniquement impossible de finaliser le bail avant le consentement effectif du preneur.
    * *Action de signature locataire* : Possibilité pour le locataire d'apposer sa signature manuscrite certifiée et de la valider.
    * *Après validation locataire* : Le bouton « Finaliser le contrat » devient **automatiquement actif, bleuté et animé** (`animate-pulse`).
    * *Après clic sur « Finaliser le contrat »* : Le contrat passe au statut `contrat_actif`, le bouton « Contrat » précédent est verrouillé (`Contrat (Scellé)`), un bouton vert **« Télécharger le contrat »** apparaît à côté, et **toutes les autres demandes sur le même bien sont automatiquement rejetées** avec statut `Refusé (Logement déjà pris)`, leur bouton Contrat étant désactivé.
    * Notification automatique envoyée aux candidats refusés : *"Le logement demandé est déjà pris et n'est plus disponible."*
* **Générateur de Contrat de Bail Certifié 41-Points (`LegalContractGeneratorModal.tsx`)** :
  * 3 zones indépendantes : Conditions Propriétaire, Demandes Locataire, Règles du Logement & Copropriété.
  * **Dictée vocale par microphone en temps réel** : Chaque zone dispose de son micro dédié avec stream continu, conservation des transcripts intermédiaires et commit sans fuite entre les sections.
  * **Assistant IA d'Analyse, Classement & Reformulation Juridique** :
    * Reclassement automatique des obligations dans la section appropriée.
    * Détection des clauses non conformes (Art. 414 caution, Art. 428 grosses réparations, Art. 430 droit de visite).
    * Reformulation professionnelle des expressions familières en français juridique normé.
    * Affichage d'un rapport d'audit exhaustif avec articles de loi cités et option de rétablissement du texte brut.
  * Signatures manuscrites numériques pour les deux parties (`SignatureModal.tsx`).
  * Vérification de conformité en temps réel (0 clause bloquante exigée pour exporter).
* **Gestion des Cautions & Séquestre (`CautionsView.tsx`)** :
  * Suivi des dépôts de garantie consignés.
  * Calculateur officiel de retenues en fin de bail (factures CIE/SODECI impayées, réparations locatives justifiées).
  * Génération de reçus officiels de restitution de caution avec QR Code.
* **Paiements & Quittances (`PaiementsView.tsx`, `ReceiptsQuittancesView.tsx`)** :
  * Validation des déclarations de loyers locataires en 1 clic.
  * Émission automatique de quittances officielles téléchargeables en PDF avec token unique.
* **Gestion des Incidents & Maintenance (`MaintenanceView.tsx`)** :
  * Déclaration de sinistres/pannes, affectation d'artisans locaux, suivi des coûts et résolution.
* **Abonnement SaaS Bailleur (`AbonnementView.tsx`)** :
  * Tarification proportionnelle au parc actif (500 FCFA/mois pour 1 bien, 2 000 FCFA pour 2-10 biens, 5 000 FCFA pour 11-20 biens, 10 000 FCFA au-delà).
  * Intégration Stripe (cartes bancaires) et passerelles Mobile Money.

### B. Espace Locataire (`LocataireContratsView.tsx`, `LocatairePaiementsView.tsx`)
* **Consultation et téléchargement des contrats finalisés** : Le preneur peut à tout moment télécharger son bail officiel au format PDF.
* **Historique complet par bailleur** : Dossier juridique classé par propriétaire (Bailleur A, Bailleur B) avec suivi des cautions actives/restituées et quittances associées.
* **Déclaration de paiement de loyer** : Saisie simple du paiement effectué par Mobile Money ou virement avec référence de transaction.
* **Bibliothèque de quittances certifiées** : Accès garanti et illimité à tous les reçus avec QR Code, indépendant de l'état d'abonnement du propriétaire.
* **Espace de signature locataire** : Consultation des clauses, signature manuscrite certifiée et validation de consentement contractuel.

### C. Espace Agence Immobilière
* **Gestion multi-mandats** : Vue agrégée par propriétaire mandant, répartition des lots, génération de baux avec en-tête d'agence agréée, suivi des commissions de gérance.

### D. Espace Administrateur & Modération (`AdminView.tsx`)
* **Vérification d'identité (KYC)** : Approbation des CNI et registres du commerce (RCCM) pour l'attribution des badges "Vérifié".
* **Modération des annonces** : Respect des encadrements légaux et détection de fraudes.

### E. Système de Vérification Publique QR Code
* Pages publiques `/verify/contrat/[token]` et `/verification/recu/[token]` : Tout tiers (banque, employeur, autorité administrative) peut scanner le QR Code du document papier ou PDF pour authentifier instantanément la validité du bail ou de la quittance sur les registres certifiés de LocaTrust.

---

## 3. Structure des fichiers

```
locatrust/
├── app/                                # Next.js App Router & Routes publiques
│   ├── (admin)/                        # Espace Administration & Modération
│   ├── (agence)/                       # Espace Agences immobilières
│   ├── (locataire)/                    # Espace Locataire (baux, quittances, paiements)
│   ├── (proprietaire)/                 # Espace Propriétaire / Bailleur
│   ├── verification/                   # Pages publiques de scan QR Code (/recu/[token], etc.)
│   ├── verify/                         # Pages publiques de scan contrat (/contrat/[token])
│   ├── layout.tsx                      # Layout racine
│   └── page.tsx                        # Page d'accueil / Démo interactive
│
├── components/                         # Composants React modulaires
│   ├── common/                         # Composants génériques réutilisables
│   │   ├── ErrorBoundary.tsx           # Gestion des exceptions d'affichage
│   │   ├── Logo.tsx                    # Identité visuelle LocaTrust
│   │   ├── RoleSwitcher.tsx            # Basculeur instantané de rôles (Démo & Évaluation)
│   │   └── SignatureModal.tsx          # Modal interactif de signature manuscrite numérique
│   │
│   ├── contracts/                      # Moteur contractuel et légal
│   │   ├── ContractDetailView.tsx      # Vue détaillée et scellée d'un bail
│   │   └── LegalContractGeneratorModal.tsx # Formulaire 41 points, dictée vocale, analyse IA
│   │
│   ├── dashboard/                      # Vues du tableau de bord Propriétaire / Agence
│   │   ├── AbonnementView.tsx          # Gestion des formules SaaS LocaTrust
│   │   ├── CautionsView.tsx            # Suivi des dépôts de garantie & restitutions
│   │   ├── DemandesView.tsx            # Gestion des candidatures, signatures & finalisation
│   │   ├── HistoriqueView.tsx          # Historique chronologique des transactions
│   │   ├── MaintenanceView.tsx         # Gestion des incidents et tickets artisans
│   │   ├── MessagerieView.tsx          # Messagerie instantanée bailleur-locataire
│   │   ├── PaiementsView.tsx           # Validation et suivi des loyers déclarés
│   │   ├── PropertiesListView.tsx      # Gestion du parc immobilier (biens, corbeille)
│   │   ├── ReceiptsQuittancesView.tsx  # Registre officiel des quittances délivrées
│   │   └── TenantsListView.tsx         # Répertoire des locataires en place
│   │
│   ├── layout/                         # Éléments structurels
│   │   ├── Header.tsx                  # En-tête avec cloche de notifications et profil
│   │   └── Sidebar.tsx                 # Navigation latérale contextuelle par rôle
│   │
│   └── locataire/                      # Vues spécifiques de l'espace Locataire
│       ├── LocataireContratsView.tsx   # Mes baux, téléchargement PDF, dossiers bailleurs
│       └── LocatairePaiementsView.tsx  # Déclaration de loyer & quittances locataire
│
├── lib/                                # Logique métier, moteurs légaux et utilitaires
│   ├── legalAnalysisEngine.ts          # Moteur d'audit légal (Loi 2019-576 & OHADA)
│   │                                   # + Fonction reorganizeAndReformulateClauses()
│   ├── contractPdfGenerator.ts         # Générateur de contrat de bail PDF officiel
│   ├── waitingListNotifications.ts     # Moteur de rejet et notification des listes d'attente
│   ├── verificationRegistry.ts         # Registre cryptographique des tokens QR Code
│   ├── messagingStore.ts               # Stockage et événements de messagerie temps réel
│   ├── signatureHelper.ts              # Traitement des signatures manuscrites certifiées
│   ├── celebration.ts                  # Animations de succès (confettis canvas)
│   ├── utils.ts                        # Formatage monétaire (FCFA), dates, helpers
│   ├── qrCode.ts & qrCodeData.ts       # Génération et embedding des QR Codes
│   └── mock/                           # Données de démonstration cohérentes
│       └── data.ts                     # MOCK_APPLICATIONS, MOCK_CONTRACTS, MOCK_PROPERTIES
│
├── types/                              # Définitions TypeScript globales
│   └── index.ts                        # Interfaces User, Property, Lease, Payment, Ticket
│
├── ARCHITECTURE.md                     # Règles d'architecture, RLS et hiérarchie des normes
├── package.json                        # Dépendances et scripts npm
├── tailwind.config.js                  # Thème, couleurs, typographies et ombres
└── tsconfig.json                       # Configuration stricte TypeScript
```

---

## 4. Technologies utilisées

| Composant | Technologie | Justification |
|---|---|---|
| **Framework Web** | React 18 / Next.js (App Router) & Vite | Rendu ultra-rapide, compatibilité hybride SPA/SSR, navigation fluide. |
| **Langage** | TypeScript (Mode Strict) | Typage robuste des états juridiques, des entités financières et des contrats. |
| **Styles & Design** | Tailwind CSS + Vanilla CSS | Design sur mesure, zéro composant générique terne, animations micro-interactives. |
| **Icônes** | Lucide React | Iconographie moderne, cohérente et légère. |
| **Génération PDF** | jsPDF & html2canvas | Génération vectorielle côté client de documents haute résolution avec polices officielles et pagination dynamique. |
| **Codes QR** | qrcode / SVG Data URL | Encodage de tokens de vérification scannables hors ligne ou en ligne. |
| **Reconnaissance Vocale** | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) | Dictée vocale native au navigateur avec traitement asynchrone des flux intermédiaires. |
| **Persistance des données** | LocalStorage + CustomEvents (`locatrust:*`) / Supabase PostgreSQL | Persistance réactive en local pour les tests et démos, avec synchronisation inter-onglets et support natif de Supabase RLS. |
| **Animations festives** | canvas-confetti | Célébration visuelle lors de la finalisation des signatures et des baux. |

---

## 5. Décisions de design et ergonomie (UI/UX)

1. **Aesthétique "Fintech Africaine Moderne"** :
   - Palette de couleurs harmonieuse inspirée des meilleures fintechs (Bleu institutionnel `#1E40AF`, Émeraude de validation `#059669`, Ambre pour les attentes `#D97706`, Ardoise sombre `#0F172A`).
   - Typographie soignée, badges de statut arrondis, micro-animations au survol et retour visuel immédiat sur chaque action.
2. **Accessibilité pour bailleurs non spécialistes** :
   - Les bailleurs n'ont pas besoin de connaître les articles du Code de la Construction : ils peuvent parler naturellement au micro, et l'application se charge de la catégorisation et de la mise en conformité juridique.
3. **Prévention absolue des erreurs contractuelles** :
   - Désactivation préventive des boutons non éligibles (`disabled` avec infobulle claire) plutôt que de générer des messages d'erreur frustrants après coup.
   - Impossibilité absolue de finaliser un contrat sans la signature effective du locataire.
   - Impossibilité absolue de générer deux contrats concurrents sur un même logement.
4. **Visibilité et téléchargement universel** :
   - Le bouton « Télécharger le contrat » est accessible aussi bien pour le bailleur (dans `DemandesView`) que pour le locataire (dans `LocataireContratsView`), garantissant l'égalité d'accès aux preuves juridiques.

---

## 6. Instructions impératives pour un futur modèle IA

Tout futur modèle d'IA (Gemini, Claude, GPT, etc.) travaillant sur ce projet **DOIT STRICTEMENT RESPECTER** les règles suivantes :

### Règle 1 : Préservation du périmètre & Non-régression
* Ne modifiez **jamais** les fonctionnalités existantes non concernées par la demande de l'utilisateur.
* Ne supprimez pas les imports, les types ou les fonctions utilitaires pré-existantes.
* Vérifiez toujours la compilation sans erreur avec `npm run build` (sur Windows : `cmd.exe /c npm run build`).

### Règle 2 : Workflow Contractuel & Gestion des Demandes
* **Avant signature locataire** : Le bouton « Finaliser le contrat » doit **toujours rester visible mais désactivé (`disabled`)**. N'autorisez jamais un contournement permettant au bailleur de clore un bail unilatéralement.
* **Après signature locataire** : Le bouton « Finaliser le contrat » devient actif.
* **Après finalisation** :
  * Le logement passe en statut occupé / loué (`contrat_actif`).
  * Les autres demandes sur le même bien basculent impérativement à `refusee` avec la notification officielle : *"Le logement demandé est déjà pris et n'est plus disponible."*
  * Le bouton « Contrat » des candidats refusés doit être **désactivé et non cliquable**.
  * Le bouton « Télécharger le contrat » doit être disponible pour le bailleur et le locataire.

### Règle 3 : Moteur de Dictée Vocale (`LegalContractGeneratorModal.tsx`)
* N'utilisez **jamais** `recognition.abort()` lors de l'arrêt normal du micro, car cela détruit le buffer audio en cours. Utilisez `recognition.stop()` et commitez immédiatement tout texte présent dans `pendingInterimRef`.
* Chaque bouton micro est strictement lié à sa propre zone (`owner`, `tenant`, `property`). Ne permettez aucun mélange de flux audio d'une zone vers une autre.

### Règle 4 : Conformité Juridique Ivoirienne & OHADA (`lib/legalAnalysisEngine.ts`)
* Toute clause financière doit respecter l'**Article 414 de la Loi n° 2019-576** : le dépôt de garantie ne peut en aucun cas dépasser **deux (2) mois de loyer hors charges**.
* Toute clause de réparations doit respecter l'**Article 428 de la Loi n° 2019-576** et l'**Article 106 de l'AUDCG OHADA** : les grosses réparations (clos, couvert, toiture, structure) incombent d'ordre public au bailleur.
* Toute clause de visite doit respecter l'**Article 430 de la Loi n° 2019-576** : préavis écrit d'au moins 48 heures obligatoire.
* Conservez toujours l'intention réelle du bailleur en la traduisant en termes juridiques formels.

### Règle 5 : Persistance & Événements
* Toute mise à jour de candidature dans le `localStorage` (`locatrust_rental_applications`) doit être accompagnée de l'émission de l'événement personnalisé `window.dispatchEvent(new CustomEvent('locatrust:applications-updated', ...))` pour garantir la synchronisation instantanée de toutes les vues.
* Tout contrat finalisé doit également être inscrit dans `locatrust_contracts` afin d'être immédiatement visible et téléchargeable depuis l'espace Locataire.
