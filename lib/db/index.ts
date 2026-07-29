import "server-only";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { cheminBaseDeDonnees } from "@/lib/chemins";
import * as schema from "@/lib/db/schema";

type Connexion = ReturnType<typeof creerConnexion>;

/**
 * Accès à la base, via libSQL.
 *
 * ⚠️ POURQUOI PAS better-sqlite3 — ne revenez pas en arrière sans lire ceci.
 *
 * `better-sqlite3` se compile à l'installation (node-gyp), ce qui exige Python
 * et une chaîne C++ sur la machine de build. L'hébergement Node.js managé de
 * Hostinger n'en a aucun : l'installation des dépendances échouait avec
 * « Could not find any Python installation to use ».
 *
 * `@libsql/client` livre des binaires DÉJÀ COMPILÉS pour chaque plateforme.
 * Rien à compiler, donc rien à installer sur l'hôte. Le dialecte SQL est
 * identique (libSQL est un fork de SQLite) : le schéma et les migrations n'ont
 * pas bougé d'une ligne.
 *
 * Bénéfice second, et c'est lui qui compte pour la suite : le MÊME code
 * fonctionne sur un fichier local et sur une base distante. Passer de l'un à
 * l'autre ne demande qu'une variable d'environnement.
 */
const cacheGlobal = globalThis as unknown as {
  __kelvynlabsDb?: Connexion;
  __kelvynlabsClient?: Client;
};

/**
 * Décrit où vivent les données.
 *
 *   · `DATABASE_URL` renseignée (`libsql://…`) → base DISTANTE. Indispensable
 *     sur un hébergement dont le disque est recréé à chaque déploiement.
 *   · sinon → fichier local sous `DOSSIER_DONNEES`, le mode par défaut.
 */
export function configurationBase(): {
  url: string;
  authToken?: string;
  distante: boolean;
} {
  const distante = process.env.DATABASE_URL?.trim();

  if (distante) {
    return {
      url: distante,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
      distante: true,
    };
  }

  const chemin = cheminBaseDeDonnees();
  mkdirSync(dirname(chemin), { recursive: true });

  return { url: `file:${chemin}`, distante: false };
}

function creerConnexion() {
  const config = configurationBase();

  const client = createClient({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  });

  cacheGlobal.__kelvynlabsClient = client;

  // SQLite n'applique PAS les clés étrangères par défaut. Sans cette ligne,
  // supprimer une formation laisserait ses chapitres orphelins.
  // Sur une base distante, le réglage est déjà géré côté serveur : on ignore
  // l'échec plutôt que d'empêcher le démarrage.
  client.execute("PRAGMA foreign_keys = ON").catch(() => {});

  if (!config.distante) {
    // WAL : les lectures ne bloquent plus l'écriture et inversement. Sans lui,
    // un seul upload en cours ferait attendre toutes les pages.
    client.execute("PRAGMA journal_mode = WAL").catch(() => {});
    client.execute("PRAGMA busy_timeout = 5000").catch(() => {});
  }

  return drizzle(client, { schema });
}

/**
 * Connexion réelle, ouverte PARESSEUSEMENT.
 *
 * ⚠️ L'ouverture ne doit pas avoir lieu à l'import du module : pendant
 * `next build`, Next évalue l'arbre des modules dans plusieurs workers
 * parallèles, et une ouverture au niveau du module faisait échouer le build
 * sur SQLITE_BUSY. En développement, le cache sur `globalThis` évite par
 * ailleurs d'ouvrir une connexion de plus à chaque rechargement à chaud.
 */
export function getDb(): Connexion {
  return (cacheGlobal.__kelvynlabsDb ??= creerConnexion());
}

/** Client libSQL brut — utile aux migrations et aux diagnostics. */
export function getClient(): Client {
  getDb();
  return cacheGlobal.__kelvynlabsClient!;
}

/**
 * `db` se manipule comme l'objet Drizzle habituel — `db.query.…`,
 * `db.insert(…)` — mais chaque accès traverse ce proxy, qui ouvre la connexion
 * au dernier moment.
 *
 * Les fonctions sont liées à la connexion réelle : sans ce `bind`, `this`
 * pointerait sur le proxy et les méthodes internes de Drizzle échoueraient.
 */
export const db = new Proxy({} as Connexion, {
  get(_cible, propriete) {
    const connexion = getDb();
    const valeur = connexion[propriete as keyof Connexion];
    return typeof valeur === "function" ? valeur.bind(connexion) : valeur;
  },
}) as Connexion;

export { schema };
