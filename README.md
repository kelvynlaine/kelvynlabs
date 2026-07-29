# Kelvynlabs

Plateforme de formations en ligne mono-créateur : un espace d'administration
pour rédiger et structurer les formations, un espace client pour les consulter.

**État : Phases 1 à 5 terminées.** Voir la [Roadmap](#roadmap).

---

## Stack

| Rôle | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict | SSR, Server Actions, un seul déploiement |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) | Composants accessibles, entièrement personnalisables |
| Base de données | **libSQL** (SQLite) + Drizzle ORM | Fichier local ou base distante, même code. Binaires précompilés : aucune compilation au déploiement |
| Authentification | **Maison** : scrypt + sessions en base | Un seul compte à gérer ; pas de dépendance à un fournisseur |
| Stockage | **Disque du serveur** | Les fichiers vivent à côté de la base, sur le même volume |
| Éditeur | Tiptap (JSON en base) | Contenu re-rendable sans re-parser du balisage |
| Glisser-déposer | dnd-kit | Accessible au clavier, sans dépendance lourde |
| Validation | Zod | Toutes les entrées : formulaires, uploads, variables d'env |
| Déploiement | Docker sur VPS + Nginx | Vos données chez vous |

### Pourquoi pas Supabase

Le projet a démarré sur Supabase puis a migré. Supabase apportait quatre
choses ; voici ce qui les remplace :

| Besoin | Avant | Maintenant |
|---|---|---|
| Base de données | Postgres managé | Fichier SQLite sur le VPS |
| Authentification | Supabase Auth | Sessions maison (`lib/auth.ts`) |
| Stockage fichiers | Supabase Storage | Disque du serveur (`lib/stockage.ts`) |
| Sécurité d'accès | Policies RLS | `checkAccess()` — voir plus bas |

Le dernier point mérite une explication. La RLS existait parce que le
**navigateur** parlait directement à Supabase : il fallait une barrière dans la
base elle-même. Sans Supabase, le navigateur ne touche plus jamais la base ;
tout passe par le serveur Next.js. Le modèle de sécurité ne s'affaiblit pas, il
se **simplifie** : un seul point de contrôle au lieu de deux.

Contrepartie assumée : **il n'y a plus de second rempart.** Si une page oubliait
d'appeler `checkAccess()`, plus rien ne rattraperait l'erreur. D'où la règle
énoncée [plus bas](#la-règle-la-plus-importante-du-projet).

---

## Démarrage

**Prérequis :** Node.js ≥ 20 (testé sur 24). Rien d'autre — pas de compte à
créer, pas de base à provisionner.

```bash
npm install
npm run admin:creer -- vous@exemple.fr "un-mot-de-passe-long"
npm run dev
```

L'application démarre sur http://localhost:3000, l'administration sur
http://localhost:3000/admin.

La base est créée automatiquement au premier démarrage dans `.data/` (ignoré
par git). Les migrations s'appliquent seules — aucune commande à lancer.

Copiez `.env.example` vers `.env.local` seulement si vous voulez changer les
valeurs par défaut : **aucune variable n'est obligatoire.**

### Créer ou réinitialiser le compte admin

```bash
npm run admin:creer -- vous@exemple.fr "un-mot-de-passe-long"
```

Pour éviter de laisser le mot de passe dans l'historique du shell :

```bash
MOT_DE_PASSE='…' npm run admin:creer -- vous@exemple.fr
```

Relancer la commande sur un email existant **réinitialise** son mot de passe —
c'est aussi la procédure de récupération si vous l'oubliez.

---

## Vidéo : YouTube ou Bunny.net

Chaque leçon porte un champ `video_provider` (`youtube` | `bunny`). Le choix se
fait **leçon par leçon** ; `VIDEO_PROVIDER_DEFAULT` ne fixe que la valeur
proposée par défaut.

### YouTube non répertorié — configuration actuelle

Rien à configurer : collez l'URL d'une vidéo en mode *non répertorié*
(watch, youtu.be, embed ou Shorts — l'identifiant est extrait automatiquement).
La lecture passe par `youtube-nocookie.com`, sans cookie de suivi tant que le
visiteur n'a pas lancé la vidéo.

⚠️ **« Non répertorié » n'est pas « privé ».** L'URL, une fois connue, est
accessible à tous, hors de tout contrôle d'accès. Acceptable pour du contenu
gratuit, **incompatible avec un paywall Stripe.** Le jour où vous vendez une
formation, ses vidéos devront passer sur Bunny.

### Bunny.net Stream — pour le jour où vous vendez

1. [bunny.net](https://bunny.net) → **Stream** → nouvelle *Video Library*.
2. Relevez **Library ID**, **API Key** et **CDN Hostname** (`vz-xxxx.b-cdn.net`).
3. Renseignez les trois variables `BUNNY_*`.
4. Activez **Token Authentication** dans la library : c'est ce qui rend les URLs
   signables, donc réellement protégeables.

Ordre de grandeur : ~0,01 $/Go stocké par mois + ~0,005 $/Go de bande passante.

---

## ⚠️ Où vivent les données

Deux choses doivent survivre aux déploiements : la **base** et les **fichiers
uploadés**.

| Hébergement | Base | Fichiers |
|---|---|---|
| VPS avec volume Docker | fichier local (défaut) | disque du volume (défaut) |
| Hostinger Node.js managé | **`DATABASE_URL` distante obligatoire** | **stockage objet obligatoire** |

Sur un hébergement managé, le projet est reconstruit depuis git à chaque
déploiement : tout ce qui est écrit sur le disque de l'application disparaît.
Un fichier SQLite local y serait effacé à chaque mise en ligne, avec toutes les
formations. Le code ne peut pas le deviner — c'est à la configuration de le
dire.

## Déploiement sur VPS Hostinger

### 1. Préparer le serveur

```bash
ssh root@votre-ip
apt update && apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx sqlite3 git
mkdir -p /opt/kelvynlabs /opt/sauvegardes
git clone https://github.com/VOTRE-COMPTE/kelvynlabs.git /opt/kelvynlabs
```

### 2. Configurer

```bash
cd /opt/kelvynlabs
cp .env.example .env
# Renseignez NEXT_PUBLIC_SITE_URL="https://votre-domaine.fr"
```

### 3. Lancer

```bash
docker compose up -d --build
docker compose exec app node -e "console.log('ok')"   # vérifie que le conteneur tourne
```

Puis ouvrez **`https://votre-domaine.fr/admin/installation`** dans un navigateur
et créez le compte administrateur. La page se ferme définitivement dès qu'un
compte existe.

⚠️ **Faites-le tout de suite après le premier démarrage.** Tant qu'aucun compte
n'existe, cette page est accessible à qui connaît l'adresse du site — c'est le
seul moment où quelqu'un d'autre pourrait s'installer à votre place.

### 4. Nginx et HTTPS

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/kelvynlabs
# Remplacez votre-domaine.fr dans le fichier
ln -s /etc/nginx/sites-available/kelvynlabs /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d votre-domaine.fr -d www.votre-domaine.fr
```

⚠️ Le fichier Nginx fourni contient `client_max_body_size 100M`. Sans cette
directive, Nginx rejette tout envoi de plus d'1 Mo avec une erreur 413 opaque,
avant même que l'application ne la voie.

### 5. Déploiement automatique depuis GitHub

Le workflow `.github/workflows/deploiement.yml` vérifie (lint, types, build)
puis déploie par SSH. Renseignez ces secrets dans **Settings → Secrets and
variables → Actions** :

| Secret | Valeur |
|---|---|
| `VPS_HOTE` | IP ou domaine du VPS |
| `VPS_UTILISATEUR` | `root`, ou un utilisateur dédié |
| `VPS_CLE_SSH` | Clé privée SSH (la publique va dans `~/.ssh/authorized_keys`) |
| `VPS_PORT` | Optionnel, `22` par défaut |

Chaque déploiement lance une sauvegarde avant de toucher au code.

### 6. Sauvegardes

```bash
crontab -e
0 3 * * * cd /opt/kelvynlabs && DOSSIER_DONNEES=/var/lib/docker/volumes/kelvynlabs_donnees/_data ./scripts/sauvegarde.sh /opt/sauvegardes >> /var/log/kelvynlabs-sauvegarde.log 2>&1
```

Le script utilise `sqlite3 .backup` et **non** un `cp`. En mode WAL, une partie
des écritures récentes vit dans un fichier `-wal` séparé : une copie brute
produit une base silencieusement incohérente, ce qu'on ne découvre qu'au moment
de la restaurer. Chaque sauvegarde est vérifiée (`integrity_check`) juste après
sa création.

⚠️ Une sauvegarde sur le même disque que les données ne protège que des erreurs
humaines. Recopiez régulièrement `/opt/sauvegardes` ailleurs.

---

## Architecture

```
app/
  (client)/                    Site public
    page.tsx                   Catalogue
    actions.ts                 Marquage de progression
    formations/[slug]/         Page formation : sommaire, Commencer/Reprendre
      lecons/[leconSlug]/      Lecteur : vidéo, contenu, ressources, navigation
    not-found.tsx              404 publique
  api/
    fichiers/[...chemin]/      Sert les images (bucket public)
    ressources/[id]/           Sert les fichiers protégés — passe par checkAccess()
    admin/upload/              Réception des uploads (validation serveur)
    sante/                     Sonde de santé Docker
  admin/
    installation/              Création du premier compte, se ferme ensuite
    login/                     Connexion — hors de la coquille admin
    (protege)/                 Tout ce qui exige requireAdmin()
      page.tsx                 Tableau de bord
      formations/              Liste, éditeur, arborescence
        [id]/lecons/[leconId]/ Éditeur de leçon
      medias/                  Bibliothèque
components/
  ui/                          Primitives shadcn/ui
  admin/                       Composants d'administration
  client/                      Composants du site public
  editeur/                     Tiptap (extensions partagées écriture/lecture)
  contenu/                     Rendu partagé admin ↔ site public
lib/
  access.ts                    ⚠️ Contrôle d'accès — POINT D'ENTRÉE UNIQUE
  auth.ts                      Sessions administrateur
  mot-de-passe.ts              Hachage scrypt
  visiteur.ts                  Identité anonyme (cookie de progression)
  progression.ts               Calculs d'avancement
  stockage.ts                  Fichiers sur disque + validation
  chemins.ts                   Résolution de chemins + anti-traversée
  db/                          Schéma Drizzle, connexion, migrations
  ordre.ts                     Ordonnancement fractionnaire (glisser-déposer)
drizzle/                       Migrations SQL générées
scripts/                       Création d'admin, sauvegarde
deploy/                        Configuration Nginx
```

### L'aperçu n'est pas une page à part

Le bouton « Aperçu » de l'administration ouvre la **vraie page publique**.
L'administrateur y voit les brouillons parce que `checkAccess()` lui accorde ce
droit, pas parce qu'une page d'aperçu séparée contournerait la règle. Un
bandeau l'avertit de ce qu'il regarde.

C'est délibéré : une page d'aperçu distincte finit toujours par diverger de la
page réelle, et l'écart ne se découvre qu'après publication.

### Progression sans compte

Le suivi d'avancement repose sur un UUID aléatoire dans un cookie **httpOnly**,
inaccessible au JavaScript de la page. Trois conséquences :

- **Aucune donnée personnelle.** Le cookie ne contient ni email, ni empreinte
  de navigateur, ni identifiant publicitaire — seulement « ce navigateur a
  coché ces leçons ».
- **Le cookie n'est posé qu'au premier geste** qui en a besoin (cocher une
  leçon). Qui parcourt le catalogue sans rien cocher repart sans cookie. C'est
  ce qui permet de le qualifier de strictement fonctionnel, et donc de se
  passer d'une bannière de consentement.
- **Les écritures passent toutes par le serveur**, après `checkAccess()`. Si le
  navigateur pouvait écrire directement, n'importe qui pourrait réécrire la
  progression d'un autre visiteur en devinant son UUID — et enregistrer une
  progression sur une leçon non publiée permettrait de les énumérer.

La table `progressions` porte déjà une colonne `student_id`. Le jour où les
comptes clients arriveront, la reprise tiendra en une requête au moment de la
première connexion :

```sql
UPDATE progressions SET student_id = ? WHERE identifiant_client = ?;
```

Aucun visiteur ne perdra son avancement.

### La règle la plus importante du projet

**`lib/access.ts` est le seul endroit autorisé à décider si un visiteur peut
voir un contenu.**

- Interdit d'écrire `if (formation.statut === "published")` ailleurs.
- Toute page, route API ou server action servant du contenu à un client passe
  d'abord par `checkAccess()`, `checkLeconAccess()` ou `checkRessourceAccess()`.
- Cela vaut **aussi** pour ce qui ne rend pas de HTML : URL vidéo, fichier
  téléchargeable, marquage de progression. *Un paywall qui ne protège que les
  pages se contourne en appelant l'API directement.*

En V1 la fonction répond presque toujours « oui ». L'intérêt est ailleurs : le
jour où Stripe arrive, la logique de paiement s'écrit dans `evaluerAcces()` et
nulle part ailleurs. Les emplacements sont balisés `ÉTAPE STRIPE`.

Le mode aperçu découle de la même fonction : l'admin voit les brouillons parce
que `checkAccess()` le lui accorde explicitement, pas parce que la page
contourne la règle.

### Pourquoi libSQL et pas better-sqlite3

Le premier déploiement Hostinger a échoué :

```
gyp ERR! find Python  Could not find any Python installation to use
ERROR: Failed to install dependencies
```

`better-sqlite3` se compile à l'installation via node-gyp, ce qui exige Python
et une chaîne C++ sur la machine de build. L'hébergement Node.js managé de
Hostinger n'en a aucun.

`@libsql/client` livre des binaires **déjà compilés** pour chaque plateforme :
rien à construire, donc rien à installer sur l'hôte. libSQL étant un fork de
SQLite, le dialecte est identique — le schéma et les migrations n'ont pas
changé d'une ligne. Bénéfice second : le même code fonctionne sur un fichier
local et sur une base distante, au prix d'une variable d'environnement.

Deux conséquences dans la configuration :

- **Le build de production utilise webpack, pas Turbopack.**
  `node_modules/libsql/index.js` résout son binaire par un require dynamique —
  ``require(`@libsql/${target}`)`` — que Turbopack transforme en « context
  module » sur tout `node_modules/@libsql/`, jusqu'à tenter de parser les
  fichiers `LICENSE` comme du JavaScript. Le mode développement reste sur
  Turbopack, où le problème ne se pose pas.
- **Les migrations sont sorties de l'application** (`scripts/migrer.mjs`,
  lancé avant `next start`). Tant qu'elles étaient déclenchées depuis
  `instrumentation.ts`, les deux bundlers les tiraient dans la compilation du
  runtime Edge, où `node:fs` n'existe pas.

### Finitions (Phase 4)

Quelques décisions non évidentes prises pendant la passe de polissage :

- **La connexion SQLite s'ouvre paresseusement.** Elle l'était auparavant à
  l'import du module, ce qui faisait échouer `next build` sur `SQLITE_BUSY` :
  Next évalue l'arbre des modules dans plusieurs workers parallèles, qui
  réclamaient tous le même fichier. Désormais le build n'ouvre plus la base du
  tout, et ne crée plus le fichier par erreur au moment de compiler.
- **L'éditeur Tiptap est chargé à la demande.** Il représentait à lui seul un
  tiers du JavaScript de la page d'édition d'une leçon, retardant
  l'interactivité de champs qui n'en ont pas besoin. La page est passée de
  385 kB à 257 kB, et le titre ou le bouton d'enregistrement répondent
  immédiatement.
- **Des squelettes plutôt qu'une page blanche.** Toutes les pages sont rendues
  à la demande ; chaque segment a désormais son `loading.tsx`, calé sur la
  géométrie du contenu réel pour qu'aucun élément ne saute à l'arrivée des
  données.
- **Le site public n'affiche jamais `error.message`.** En production, Next
  masque déjà les messages serveur derrière un identifiant : les réafficher
  annulerait cette protection. L'administration, elle, les montre — savoir
  « base verrouillée » évite un aller-retour dans les logs.
- **Lien d'évitement.** Sans lui, un utilisateur au clavier devait traverser
  tout le sommaire d'une formation — plusieurs dizaines de liens — avant
  d'atteindre le contenu d'une leçon.
- **Image de partage générée par formation.** Contrainte du moteur de rendu :
  tout `<div>` à plusieurs enfants doit déclarer `display: flex`, et
  `{n} leçon{n > 1 ? "s" : ""}` compte pour trois enfants. Déclarer
  `openGraph.images` dans `generateMetadata`, même à `undefined`, désactive
  par ailleurs la convention de fichier — la page se retrouve alors sans
  aucune vignette.
- **Le plan du site s'appuie sur `listerFormationsVisibles()`**, la même
  fonction que le catalogue : une formation dépubliée en disparaît
  automatiquement. Une requête indépendante finirait par exposer des
  brouillons le jour où la règle de visibilité évoluerait.

### Sécurité — décisions structurantes

- **Mots de passe** : scrypt, N=2^16 r=8 p=2 (configuration recommandée par
  l'OWASP), sel aléatoire, comparaison à temps constant. Paramètres relus depuis
  l'empreinte, donc durcissables plus tard sans invalider l'existant.
- **Sessions** : la base ne stocke que le SHA-256 du jeton. Une fuite de la base
  ne permet pas de rejouer une session, et une session se révoque en supprimant
  une ligne — ce qu'un JWT auto-porteur ne permet pas.
- **Le middleware ne fait pas d'autorisation.** Il tourne sur le runtime Edge,
  où SQLite n'existe pas : il ne vérifie que la *présence* du cookie.
  L'autorisation réelle est faite par `requireAdmin()` dans chaque page et
  **chaque server action** — une server action est un endpoint HTTP public tant
  qu'elle ne se protège pas elle-même.
- **Uploads** : jamais d'écriture directe navigateur → disque. Le serveur
  valide le type MIME contre une liste blanche, la taille, **et la signature
  binaire réelle** du fichier (un exécutable renommé `.png` est rejeté). Le nom
  de destination est un UUID choisi par le serveur, jamais celui fourni.
- **SVG interdit à l'upload** : c'est un document XML pouvant embarquer du
  JavaScript, donc une XSS stockée servie depuis notre propre origine.
- **Anti-traversée de répertoire** : tout chemin est résolu puis vérifié comme
  restant à l'intérieur du dossier d'uploads. Sans cela, la route qui sert les
  fichiers serait une primitive de lecture arbitraire sur le disque.
- **Bucket `ressources` privé** : servi uniquement par `/api/ressources/[id]`,
  après `checkAccess()`, en `Content-Disposition: attachment`.
- **Progression : jamais d'identifiant venu du client.** L'UUID du visiteur
  est lu dans un cookie httpOnly, jamais dans les paramètres de la requête, et
  l'écriture passe par `checkAccess()`.
- **Rendu du contenu sans `dangerouslySetInnerHTML`** : le JSON Tiptap est
  parcouru et converti en éléments React. Seuls les types de nœuds explicitement
  listés produisent quelque chose ; la page ne peut pas rendre ce que le code ne
  sait pas construire.
- **Liens filtrés** : `javascript:` et `data:` sont rejetés à l'écriture *et* au
  rendu.
- **`server-only`** en tête des modules sensibles : le build échoue si un
  composant client les importe, même indirectement.
- **`suivant=` validé** sur la connexion : seuls les chemins internes sont
  acceptés, pour ne pas transformer la page en redirecteur ouvert.

### Écarts assumés par rapport au cahier des charges

- **`prixCents` (entier) plutôt que `prix`** — les arrondis flottants sur de la
  monnaie produisent des écarts de facturation.
- **`ordre` en flottant plutôt qu'entier** — permet d'insérer entre deux
  éléments lors d'un glisser-déposer en écrivant *une* ligne au lieu de
  réindexer toute la liste.
- **`lecons.formation_id` dénormalisé** — déductible via le chapitre, mais le
  stocker évite une jointure sur le chemin le plus fréquent et permet de
  garantir l'unicité d'un slug de leçon à l'échelle de la formation, condition
  nécessaire pour que l'URL soit routable sans ambiguïté.
- **`medias` enrichie** de `chemin`, `mime_type`, `taille_octets`,
  `nom_original`, `largeur`, `hauteur` — sans quoi la bibliothèque ne peut ni
  afficher ni supprimer proprement un fichier.
- **Duplication sans les ressources** — dupliquer une formation recopie
  chapitres et leçons, mais pas les fichiers téléchargeables : cela doublerait
  silencieusement l'espace disque à chaque duplication.

---

## Paiement Stripe

### Ce qui est en place

- **Stripe Checkout** — page de paiement hébergée par Stripe. Aucune donnée
  bancaire ne transite par Kelvynlabs, ce qui écarte l'essentiel des
  obligations PCI.
- **Webhook signé** — `/api/stripe/webhook` refuse toute requête dont la
  signature ne correspond pas. Sans cette vérification, n'importe qui pourrait
  poster un faux « paiement réussi » et s'offrir toutes les formations.
- **Enrollments** — un achat crée un `student` (depuis l'email fourni à
  Stripe) et un `enrollment` actif. Un remboursement le repasse en
  `rembourse`, ce qui referme l'accès immédiatement.
- **Vitrine** — une formation payante non achetée n'est pas un 404 : elle
  montre titre, description, prix et programme (titres et durées), jamais le
  contenu.

Le prix envoyé à Stripe est **relu en base**, jamais reçu du client : sans
cela, il suffirait de modifier la requête pour acheter une formation à
1 centime.

### ⚠️ Limite à connaître avant de vendre

Il n'existe pas encore de connexion par email. Après paiement, l'accès est
rattaché au **navigateur** par un cookie de session :

- effacer ses cookies fait perdre l'accès ;
- ouvrir la formation depuis un autre appareil ne fonctionne pas.

**L'achat n'est pas perdu** — l'enrollment est enregistré en base et rattaché
au client. Le jour où la connexion par email existera, ces clients
récupéreront leur accès sans intervention. Mais tant que cette limite tient,
prévenez vos acheteurs, ou n'activez le paiement qu'après avoir ajouté la
connexion.

### Configuration en mode test

Le webhook a besoin d'une **URL publique**. En local, on ne crée donc pas
d'endpoint dans le dashboard : on utilise le CLI Stripe, qui relaie les
événements vers la machine de développement.

```bash
brew install stripe/stripe-cli/stripe   # ou https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

La commande affiche un secret `whsec_…` : c'est celui à mettre dans
`.env.local`, avec la clé secrète de test (`sk_test_…`, Dashboard >
Développeurs > Clés API).

Déclencher un paiement de test :

```bash
stripe trigger checkout.session.completed
```

Ou, plus réaliste, en achetant depuis le site avec la carte de test
`4242 4242 4242 4242`, n'importe quelle date future et n'importe quel CVC.

### Passage en production

1. Créer l'endpoint dans le Dashboard (mode **Live**) :
   `https://votre-domaine.fr/api/stripe/webhook`
2. Sélectionner les événements :
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `charge.refunded`
3. Copier le secret de signature de CET endpoint — il diffère de celui du CLI.
4. Remplacer `sk_test_…` par `sk_live_…` et `whsec_…` par celui du dashboard.

⚠️ Vérifiez que `NEXT_PUBLIC_SITE_URL` pointe bien sur le domaine de
production : c'est lui qui construit les URLs de retour après paiement.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production |
| `npm run start` | Sert le build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run admin:creer -- <email> <mdp>` | Crée ou réinitialise le compte admin |
| `npm run db:generate` | Régénère les migrations après modification du schéma |
| `npm run db:studio` | Explorateur de base Drizzle |
| `npm run sauvegarde` | Sauvegarde vérifiée de la base et des fichiers |

Après toute modification de `lib/db/schema.ts`, lancez `npm run db:generate` et
commitez le fichier produit dans `drizzle/` : c'est lui qui sera appliqué en
production.

---

## Roadmap

| Phase | Contenu | État |
|---|---|---|
| **1 — Fondations** | Next.js, Tailwind, shadcn/ui, schéma, auth, `checkAccess()` | ✅ Terminée |
| **2 — CMS Admin** | CRUD formations/chapitres/leçons, Tiptap, uploads, glisser-déposer, bibliothèque, aperçu | ✅ Terminée |
| **3 — Espace client** | Catalogue, page formation, lecteur de leçon, progression anonyme par cookie | ✅ Terminée |
| **4 — Polish UI/UX** | États de chargement et d'erreur, accessibilité, performance, SEO, finitions responsive | ✅ Terminée |
| **5 — Paiement Stripe** | Checkout, webhook signé, enrollments, `checkAccess()` payant, vitrine | ✅ Terminée |

Prochaine étape naturelle : **la connexion par email** des clients, qui lèvera
la limite décrite ci-dessous.
