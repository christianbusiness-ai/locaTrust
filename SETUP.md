# SETUP.md — Guide d'Installation et Configuration LocaTrust

Ce guide explique comment installer, exécuter localement et déployer l'application **LocaTrust**, ainsi que la procédure pour créer le premier compte administrateur.

---

## 1. Prérequis

- Node.js 18+ ou 20+ (ou 24+)
- npm / pnpm / yarn
- Compte Supabase (gratuit ou pro) pour la base de données PostgreSQL et Supabase Auth

---

## 2. Variables d'Environnement

Créez un fichier `.env.local` à la racine du projet avec les clés suivantes :

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Payment Gateways (Pour Abonnement SaaS LocaTrust uniquement)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CINETPAY_API_KEY=your-cinetpay-api-key
CINETPAY_SITE_ID=your-cinetpay-site-id

# Transactional Email / SMS (Optionnel)
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
```

---

## 3. Initialisation de la Base de Données Supabase

1. Connectez-vous à votre projet Supabase.
2. Allez dans l'éditeur SQL (**SQL Editor**).
3. Copiez-collez le contenu de `lib/supabase/schema.sql`.
4. Exécutez le script SQL pour créer l'ensemble des tables, les types ENUM, les fonctions RLS (`auth.user_role()`), les Triggers automatiques et les policies RLS.

---

## 4. Procédure de Création du Premier Compte Admin (Prompt 7)

Pour des raisons de sécurité, le rôle `admin` ne peut pas être sélectionné librement dans le formulaire d'inscription public.

### Méthode 1 : Via l'Éditeur SQL Supabase (Recommandé)
1. Inscrivez-vous sur l'application (`/inscription/proprietaire` ou `/inscription/locataire`) avec votre email administrateur (ex: `admin@locatrust.ci`).
2. Confirmez votre email.
3. Exécutez la requête SQL suivante dans Supabase :

```sql
UPDATE public.users
SET role = 'admin', verification_status = 'verifie'
WHERE email = 'admin@locatrust.ci';
```

### Méthode 2 : Mode Démo Intégré
En environnement de développement / démonstration, vous pouvez utiliser le composant de commutation de rôle (`RoleSwitcher`) affiché en haut à droite pour passer en mode Admin d'un simple clic sans configuration préalable.

---

## 5. Lancement de l'Application

```bash
# Installation des dépendances
npm install

# Lancement du serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:3000`.
