import "server-only";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { cheminBaseDeDonnees } from "@/lib/chemins";
import * as schema from "@/lib/db/schema";

type Connexion = ReturnType<typeof creerConnexion>;

/**
 * Connexion SQLite unique pour tout le processus, ouverte PARESSEUSEMENT.
 *
 * ⚠️ L'ouverture ne doit surtout pas avoir lieu à l'import du module. Pendant
 * `next build`, Next évalue l'arbre des modules dans plusieurs workers en
 * parallèle pour collecter les données de pages : une ouverture au niveau du
 * module faisait alors échouer le build sur SQLITE_BUSY, plusieurs processus
 * réclamant le même fichier en même temps.
 *
 * Avec le proxy ci-dessous, la connexion n'est créée qu'à la PREMIÈRE requête
 * réelle — donc à l'exécution, dans un seul processus. Le build n'ouvre plus
 * la base du tout, et le fichier n'est pas créé par erreur au moment de
 * compiler.
 */
const cacheGlobal = globalThis as unknown as {
  __kelvynlabsDb?: Connexion;
};

function creerConnexion() {
  const chemin = cheminBaseDeDonnees();
  mkdirSync(dirname(chemin), { recursive: true });

  const sqlite = new Database(chemin);

  // WAL : les lectures ne bloquent plus l'écriture et inversement. Sans lui,
  // un seul upload en cours suffirait à faire attendre toutes les pages.
  sqlite.pragma("journal_mode = WAL");

  // SQLite n'applique PAS les clés étrangères par défaut. Sans cette ligne,
  // supprimer une formation laisserait ses chapitres orphelins en base.
  sqlite.pragma("foreign_keys = ON");

  // Plutôt que d'échouer immédiatement sur « database is locked », on patiente.
  sqlite.pragma("busy_timeout = 5000");

  // Compromis durabilité/vitesse standard en mode WAL : sûr en cas de crash de
  // l'application, une perte n'est possible qu'en cas de coupure système brutale.
  sqlite.pragma("synchronous = NORMAL");

  return drizzle(sqlite, { schema });
}

/**
 * Connexion réelle. En développement, Next recharge les modules à chaque
 * modification : le cache sur `globalThis` évite d'ouvrir une connexion de
 * plus à chaque rechargement et d'épuiser les descripteurs de fichiers.
 */
export function getDb(): Connexion {
  return (cacheGlobal.__kelvynlabsDb ??= creerConnexion());
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
