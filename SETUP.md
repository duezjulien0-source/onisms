# 🚀 OniSMS — Guide d'installation complet (de zéro à production)

> **Pour qui ?** Ce guide s'adresse à quelqu'un qui n'a **rien d'installé** sur son PC et **aucun compte** sur les services nécessaires.
>
> **Combien de temps ?** ~2-3 heures la première fois.
>
> **Coût ?** ~$15-30 pour mettre du crédit chez 2-3 fournisseurs SMS. L'hébergement et la base de données sont **gratuits**.

---

## 📋 Ce que tu auras à la fin

Un SaaS appelé **OniSMS**, accessible via une URL `https://onisms-XXX.vercel.app`, qui te permet de :
- 🔁 Demander des numéros virtuels en France pour recevoir les codes Instagram/Threads
- ⚡ Cascade automatique sur 3 fournisseurs (HeroSMS, 5SIM, SMSPool)
- 💰 Suivi des coûts et des soldes
- 👥 Inviter des VAs avec budget plafond

---

## 🛠️ Prérequis matériels

- ✅ PC sous **Windows 10 ou 11**
- ✅ Connexion internet
- ✅ Une adresse email valide
- ✅ Une carte bancaire (pour charger du crédit chez les fournisseurs SMS — $5 à $10 par fournisseur suffit pour commencer)
- ✅ ~3h de temps libre

---

## Étape 1 — Créer les comptes en ligne (30 min)

### 1.1 — Compte GitHub
1. Va sur 👉 **https://github.com/signup**
2. Email, mot de passe, choisis un username (ex: `tonprenom123`)
3. Valide ton email via le lien reçu
4. Demande à **Julien** (celui qui t'envoie ce guide) de t'ajouter comme **collaborateur** sur son repo `onisms` (il a juste à mettre ton username GitHub)
5. Tu recevras un email d'invitation → clique **"Accept invitation"**

### 1.2 — Compte Supabase (base de données + auth)
1. Va sur 👉 **https://supabase.com/dashboard/sign-up**
2. Clique **"Continue with GitHub"** (ça lie ton compte GitHub à Supabase)
3. Une fois connecté, clique **"New Project"**
4. Remplis :
   - **Name** : `onisms`
   - **Database Password** : génère un mot de passe FORT → **NOTE-LE QUELQUE PART EN SÛR** (gestionnaire type Bitwarden, ou fichier texte chez toi)
   - **Region** : `Europe (Frankfurt)` (le plus rapide pour la France)
   - **Plan** : **Free**
5. Clique **"Create new project"** → attends ~2 min que ça soit prêt

### 1.3 — Compte Vercel (hébergement)
1. Va sur 👉 **https://vercel.com/signup**
2. **"Continue with GitHub"** → autorise
3. C'est tout pour l'instant, on reviendra à Vercel à l'étape 8

### 1.4 — Compte HeroSMS (facultatif mais recommandé — souvent moins cher)
1. Va sur 👉 **https://hero-sms.com**
2. Crée un compte avec ton email
3. Pour l'instant on a juste besoin d'avoir un compte, on reviendra plus tard

### 1.5 — Compte 5SIM (recommandé — fournisseur principal)
1. Va sur 👉 **https://5sim.net**
2. **Sign Up** → email + mot de passe
3. Valide ton email
4. Va dans **"Top up balance"** dans la sidebar gauche → recharge **$5 minimum** (CB, crypto, ou autre selon dispo)

### 1.6 — Compte SMSPool (recommandé — fallback)
1. Va sur 👉 **https://www.smspool.net/register**
2. Crée un compte
3. Recharge **$5 minimum**

> 💡 **Tu n'es pas obligé d'avoir les 3 fournisseurs dès le départ.** Tu peux commencer avec juste 5SIM, et ajouter HeroSMS/SMSPool plus tard.

---

## Étape 2 — Installer les outils sur ton PC (15 min)

### 2.1 — Node.js (moteur qui fait tourner le site)
**Option A — Via winget (recommandé, 1 commande)** :
1. Tape **Windows + R**, écris `cmd`, Entrée → fenêtre noire
2. Colle :
   ```
   winget install OpenJS.NodeJS.LTS
   ```
3. Valide les fenêtres Windows (UAC) qui apparaissent
4. Attends ~2 min

**Option B — Manuelle** :
1. Va sur 👉 https://nodejs.org/
2. Télécharge la version **"LTS"**
3. Double-clic sur l'installateur, Suivant-Suivant-Terminé

### 2.2 — VS Code (éditeur pour voir le code)
**Option A — winget** :
```
winget install Microsoft.VisualStudioCode
```

**Option B — manuelle** :
1. https://code.visualstudio.com/Download → version Windows
2. Installe

### 2.3 — Git (probablement déjà sur ton PC)
Vérifie en tapant `git --version` dans le cmd. Si ça affiche un numéro de version → OK. Sinon :
- https://git-scm.com/download/win → installe avec les options par défaut

### Vérification
Dans un cmd, tape les 3 commandes et vérifie qu'elles affichent un numéro de version :
```
node --version
npm --version
git --version
```

---

## Étape 3 — Récupérer le code (10 min)

### 3.1 — Cloner le projet
1. Crée un dossier sur ton PC où tu veux garder le projet, par exemple `C:\Users\TonNom\onisms`
2. Dans VS Code, ouvre le **Terminal** (menu **Terminal → New Terminal**)
3. Navigue vers ce dossier parent, puis colle :
   ```
   git clone https://github.com/duezjulien0-source/onisms.git
   cd onisms
   ```
4. Si Git te demande de t'authentifier, ouvre `https://github.com/login/device` et entre le code affiché

### 3.2 — Installer les dépendances du projet
Toujours dans le terminal :
```
npm install
```
→ Ça télécharge ~400 paquets. Compte **2-3 min**.

---

## Étape 4 — Configurer Supabase (20 min)

### 4.1 — Récupérer les clés API
1. Sur ton dashboard Supabase, projet `onisms`
2. ⚙️ **Project Settings** (en bas de la sidebar) → **API Keys**
3. Note ces 2 valeurs :
   - **Project URL** (ressemble à `https://xxxxxxx.supabase.co`)
   - **`anon` / `publishable` key** (commence par `sb_publishable_...` ou `eyJ...`)
4. ⚠️ **NE PARTAGE PAS** la `secret key` (`sb_secret_...`) — elle est sensible

### 4.2 — Lancer les 4 migrations SQL
Dans Supabase, clique sur **`</> SQL Editor`** dans la sidebar gauche → **"+ New query"**.

**Migration 1** — Colle ce SQL et clique **"Run"** :

```sql
-- Voir le fichier supabase/migrations/001_initial_schema.sql
-- (Ouvre-le dans VS Code, copie tout le contenu, colle ici, Run)
```

> 💡 **Plus simple** : ouvre les 4 fichiers du dossier `supabase/migrations/` dans VS Code, et copie-colle le contenu de chacun dans Supabase un par un (ils sont numérotés 001, 002, 003, 004 — fais-les **dans cet ordre**).

À chaque Run, tu dois voir **"Success. No rows returned"** ✅

### 4.3 — Configurer les URLs d'authentification
1. Toujours dans Supabase → **Authentication** dans la sidebar → **URL Configuration**
2. **Site URL** : pour l'instant `http://localhost:3000`
3. **Redirect URLs** : ajoute `http://localhost:3000/**` (on ajoutera l'URL Vercel à l'étape 8)
4. **Save**

---

## Étape 5 — Récupérer les clés API des fournisseurs SMS (15 min)

### 5.1 — Clé HeroSMS (si tu as un compte)
1. Connecte-toi sur https://hero-sms.com
2. **Profile** → cherche **"API Key"** (ou demande au support si pas visible)
3. Copie la clé (32 caractères hex)

### 5.2 — Clé 5SIM
1. Connecte-toi sur https://5sim.net/profile
2. Onglet **"Security and API"**
3. Section **"API key for 5SIM protocol"** (la nouvelle, longue, format JWT commençant par `eyJ...`)
4. Clique **"Copy"** pour copier la clé entière

### 5.3 — Clé SMSPool
1. Connecte-toi sur https://www.smspool.net/profile
2. Cherche la section **"API Key"**
3. Copie la clé (32 caractères)

---

## Étape 6 — Configurer .env.local (5 min)

1. Dans VS Code, ouvre ton dossier `onisms`
2. Crée un nouveau fichier appelé **exactement** `.env.local` (avec le point au début)
3. Colle ce contenu en remplaçant les valeurs par les tiennes :

```env
NEXT_PUBLIC_SUPABASE_URL=https://TON_PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TA_CLE

# Si tu veux activer l'invitation des VAs par email :
# (Va sur Supabase Settings > API Keys > Secret keys, copie sb_secret_xxx)
SUPABASE_SECRET_KEY=

# Fournisseurs SMS — colle les clés que tu as
HEROSMS_API_KEY=
FIVESIM_API_KEY=
SMSPOOL_API_KEY=

# Optionnels (pour plus tard)
SMS_ACTIVATE_API_KEY=
GETSMSCODE_API_KEY=
```

4. **Sauvegarde** (Ctrl+S)

> ⚠️ **Important** : `.env.local` est listé dans `.gitignore`, il ne sera **jamais** envoyé sur GitHub. Tes clés restent privées.

---

## Étape 7 — Tester en local (5 min)

Dans le terminal VS Code :
```
npm run dev
```

→ Tu dois voir : `✓ Ready in XXXms` et une URL `http://localhost:3000`

1. Ouvre **http://localhost:3000** dans ton navigateur
2. Tu vois la page d'accueil ONI → clique **"Créer un compte"**
3. Inscris-toi avec ton email principal
4. Va vérifier ta boîte mail, clique le lien de confirmation Supabase
5. Reviens et connecte-toi
6. Tu dois arriver sur ton dashboard 🎉

**Ton 1er compte est automatiquement Admin** (grâce à un trigger SQL). Si tu veux d'autres VAs plus tard, tu pourras les inviter depuis l'app.

### Si ça ne marche pas
- ✅ Vérifie que ton `.env.local` a bien les bonnes clés
- ✅ Vérifie que les 4 migrations SQL ont bien tourné
- ✅ Vérifie que Supabase autorise `http://localhost:3000` dans Redirect URLs
- ✅ Demande à **Julien** un coup de main

---

## Étape 8 — Déployer sur Vercel (20 min)

### 8.1 — Importer le projet
1. Va sur https://vercel.com/new
2. Clique **"Continue with GitHub"** si demandé → autorise
3. Trouve **`onisms`** dans la liste → **"Import"**

### 8.2 — Coller les variables d'environnement
1. Sur la page **"Configure Project"**, déplie **"Environment Variables"**
2. Clique **"Import .env"** OU **"Paste .env"** OU ajoute manuellement chaque variable
3. Colle exactement le contenu de ton fichier `.env.local`
4. ⚠️ Ajoute aussi `SUPABASE_SECRET_KEY` si tu veux l'invitation par email

### 8.3 — Déployer
1. Clique **"Deploy"** (gros bouton noir en bas)
2. Attends ~2-3 min
3. À la fin → confettis 🎉 → URL `https://onisms-XXX.vercel.app`

### 8.4 — Autoriser l'URL Vercel dans Supabase
1. Note ta nouvelle URL Vercel (ex: `https://onisms-tonnom.vercel.app`)
2. Va sur Supabase → **Authentication** → **URL Configuration**
3. **Site URL** : remplace `localhost` par ton URL Vercel
4. **Redirect URLs** : ajoute `https://onisms-tonnom.vercel.app/**`
5. Garde aussi `http://localhost:3000/**` pour pouvoir continuer à dev en local
6. **Save**

---

## Étape 9 — C'est prêt ! 🎉

Va sur ton URL Vercel et profite de ton OniSMS.

---

## 📚 Mode d'emploi rapide

### Demander un numéro
1. Sidebar → **"Mes numéros"**
2. Sélectionne Service, Pays, et laisse Fournisseur sur **"Auto"**
3. Clique **"Demander"**
4. Le numéro apparaît, copie-le, va sur Instagram, entre-le
5. Le code SMS arrive automatiquement (polling 5 sec)
6. Copie le code, colle sur Instagram
7. Clique **"Code utilisé — Clôturer"**

### Ajouter un VA
1. Sidebar → **"Mes VAs"**
2. **"+ Créer un compte VA"**
3. Choisis mode **"Créer avec mot de passe"** (plus rapide)
4. Email + budget initial → **"Créer"**
5. Copie les identifiants → envoie-les au VA via Signal/WhatsApp

### Suivre les soldes
La sidebar affiche le **solde total** des 3 fournisseurs en temps réel (refresh auto toutes les 30s). Cliques sur le bouton refresh au survol pour update instantanément.

---

## ❓ FAQ

**Q : Je reçois "Variables d'environnement manquantes"**
→ Vérifie que ton `.env.local` est bien à la racine du projet (pas dans un sous-dossier), et que tu as redémarré `npm run dev` après l'avoir modifié.

**Q : Le code SMS n'arrive jamais**
→ Normal, Instagram bloque environ 60-70% des numéros virtuels. Annule et retente. La cascade auto va essayer plusieurs fournisseurs.

**Q : Comment changer mon mot de passe ?**
→ Sur l'app → page d'accueil → "Mot de passe oublié" → suis les étapes par email.

**Q : Comment promouvoir un VA en Admin ?**
→ Va dans Supabase → SQL Editor → execute :
```sql
update profiles set role = 'admin' where email = 'email@duvavaquetu@veuxpromouvoir.com';
```

**Q : Mon repo Vercel est-il privé ?**
→ Oui par défaut, seul toi y as accès. Ton URL Vercel publique reste accessible à tous, mais ton dashboard Vercel est privé.

---

## 🆘 Besoin d'aide ?

Contacte **Julien** si tu bloques sur une étape. Il a fait la même installation et pourra t'aider.

---

## 🔗 Liens utiles

- 📦 **GitHub repo** : https://github.com/duezjulien0-source/onisms
- 🗄️ **Supabase docs** : https://supabase.com/docs
- 🚀 **Vercel docs** : https://vercel.com/docs
- 📞 **5SIM docs API** : https://5sim.net/docs
- 📞 **SMSPool docs API** : https://www.smspool.net/article/how-to-use-the-smspool-api-0dd6eadf4c

---

**Bonne chance, et bienvenue dans la team OniSMS** 🚀
