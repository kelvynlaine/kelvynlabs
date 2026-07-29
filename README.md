# Kelvynlabs

Plateforme de formations en ligne mono-créateur : un espace d'administration
pour rédiger et structurer les formations, un espace client pour les consulter.

**État : Phases 1 et 2 terminées.** Voir la [Roadmap](#roadmap).

---

## Stack

| Rôle | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict | SSR, Server Actions, un seul déploiement |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) | Composants accessibles, entièrement personnalisables |
| Base de données | **SQLite** + Drizzle ORM | Un fichier sur votre serveur. Zéro service externe, zéro abonnement |
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
  page.tsx                     Accueil publique (→ catalogue en Phase 3)
  api/
    fichiers/[...chemin]/      Sert les images (bucket public)
    ressources/[id]/           Sert les fichiers protégés — passe par checkAccess()
    admin/upload/              Réception des uploads (validation serveur)
    sante/                     Sonde de santé Docker
  admin/
    login/                     Connexion — hors de la coquille admin
    (protege)/                 Tout ce qui exige requireAdmin()
      page.tsx                 Tableau de bord
      formations/              Liste, éditeur, arborescence
        [id]/lecons/[leconId]/ Éditeur de leçon
                     apercu/   Aperçu avec les composants du site public
      medias/                  Bibliothèque
components/
  ui/                          Primitives shadcn/ui
  admin/                       Composants d'administration
  editeur/                     Tiptap (extensions partagées écriture/lecture)
  contenu/                     Rendu partagé admin ↔ site public
lib/
  access.ts                    ⚠️ Contrôle d'accès — POINT D'ENTRÉE UNIQUE
  auth.ts                      Sessions administrateur
  mot-de-passe.ts              Hachage scrypt
  stockage.ts                  Fichiers sur disque + validation
  chemins.ts                   Résolution de chemins + anti-traversée
  db/                          Schéma Drizzle, connexion, migrations
  ordre.ts                     Ordonnancement fractionnaire (glisser-déposer)
drizzle/                       Migrations SQL générées
scripts/                       Création d'admin, sauvegarde
deploy/                        Configuration Nginx
```

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
| **3 — Espace client** | Catalogue, page formation, lecteur de leçon, progression anonyme par cookie | ⏳ |
| **4 — Polish UI/UX** | Design system finalisé, animations, responsive complet | ⏳ |
| **5 — Préparation Stripe** | Branchement de `checkAccess()`, page « Achat à venir » — *structure uniquement* | ⏳ |

L'intégration réelle de Stripe fera l'objet d'une session dédiée.
