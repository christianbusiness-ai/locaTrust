# ARCHITECTURE.md — SaaS LocaTrust

Ce document définit l'architecture technique, les principes de sécurité, et les conventions de code pour la plateforme de gestion locative **LocaTrust**.

---

## 1. Principes Fondamentaux

1. **RLS (Row Level Security) Active Dès la Création** :
   - Chaque table PostgreSQL possède des règles RLS définies nativement.
   - La fonction Helper unique `auth.user_role()` est la source de vérité pour évaluer le rôle de l'utilisateur (`locataire`, `proprietaire`, `agence`, `admin`).
   - Aucune logique de sécurité ne repose uniquement sur le filtrage côté client.

2. **Séparation Stricte des Flux Financiers** :
   - **Loyers (Déclaratif)** : Le locataire enregistre une déclaration de paiement (virement, dépôt Mobile Money). Le propriétaire confirme ou refuse. Aucune passerelle de paiement automatisée n'est connectée sur ce flux tant que les API directes P2P des opérateurs Mobile Money ne sont pas validées.
   - **Abonnement LocaTrust (Flux Réel)** : Flux automatisé via `lib/payments/` (Stripe / CinetPay). Gestion des webhooks signés et vérification serveur du palier selon le nombre de biens actifs.

3. **Activation Automatique & Badge "Vérifié"** :
   - L'inscription est validée dès la confirmation de l'adresse email.
   - Le badge **"Propriétaire vérifié"** / **"Locataire vérifié"** (CNI / RCCM) est un parcours asynchrone et optionnel qui n'empêche pas l'accès initial au compte.

4. **Visibilité des Biens Immobilisés** :
   - Les biens avec le statut `loue` ou `desactive` ou supprimés (`deleted_at is not null`) ne sont jamais renvoyés par les requêtes publiques du fil d'actualité ou de recherche.
   - La transition du statut d'un bien de `disponible` à `loue` s'effectue automatiquement par Trigger PostgreSQL lors de la signature d'un contrat.

5. **Accès Garanti aux Quittances pour le Locataire** :
   - L'accès du locataire à ses contrats, quittances et historiques de paiement n'est **jamais conditionné** au statut de l'abonnement LocaTrust du propriétaire.

---

## 2. Structure des Rôles & Espaces

| Rôle | Périmètre d'Accès | Route Protégée |
|---|---|---|
| **Locataire** | Favoris, demandes de visite/location, mes contrats, mes quittances, déclarations de loyer, tickets de maintenance, chat bailleur | `/(locataire)` |
| **Propriétaire** | Dashboard financier, gestion du parc (biens + corbeille), baux, suivi des cautions, validation des loyers, maintenance, mon abonnement | `/(proprietaire)` |
| **Agence** | Vue multi-propriétaires mandants, collaborateurs (gestionnaire, comptable), statistiques agrégées | `/(agence)` |
| **Admin** | Vue globale système, validation des pièces d'identité, modération des annonces, arbitrage des litiges de loyers, suivi du CA SaaS | `/(admin)` |

---

## 3. Stratégie de Paiement Abonnement (Strategy Pattern)

Le calcul de l'abonnement LocaTrust s'effectue côté serveur selon le barème suivant :
- **1 bien actif** : 500 FCFA / mois
- **2 à 10 biens actifs** : 2 000 FCFA / mois
- **11 à 20 biens actifs** : 5 000 FCFA / mois
- **Plus de 20 biens actifs** : 10 000 FCFA / mois

Les passerelles de paiement implémentent l'interface `PaymentGateway` (`stripe.gateway.ts` pour carte bancaire internationale, `cinetpay.gateway.ts` pour Mobile Money Orange/MTN/Moov/Wave).

---

## 4. Génération de Documents PDF & QR Code

Les quittances de loyer et contrats de bail sont générés sous forme de documents PDF téléchargeables comportant un QR Code unique de vérification d'authenticité.

---

## 5. Basculement Démo & Dual Engine (Mock / Supabase)

L'application intègre un mode Démo à chaud avec un composant `RoleSwitcher` permettant à tout évaluateur de basculer instantanément entre les vues Locataire, Propriétaire, Agence et Admin avec des données réalistes pré-chargées.
