import "server-only";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { cheminBaseDeDonnees } from "@/lib/chemins";
import * as schema from "@/lib/db/schema";

/**
 * Connexion SQLite unique pour tout le processus.
 *
 * En développement, Next.js recharge les modules à chaque modification : sans
 * le cache sur `globalThis`, chaque rechargement ouvrirait une nouvelle
 * connexion et on épuiserait les descripteurs de fichiers en quelques minutes.
 */
const cacheGlobal = globalThis as unknown as {
  __kelvynlabsDb?: ReturnType<typeof creerConnexion>;
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

export const db = (cacheGlobal.__kelvynlabsDb ??= creerConnexion());

export { schema };
