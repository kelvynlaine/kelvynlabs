import "server-only";

import type { Client } from "@libsql/client";

import { migrationsEmbarquees } from "@/lib/db/migrations.generees";

/**
 * Application du schéma AU DÉMARRAGE DE L'APPLICATION, sans intervention.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE — lisez ceci avant de le supprimer.
 *
 * Les migrations étaient lancées par `npm start`. Beaucoup d'hébergements
 * managés — Hostinger Node.js en fait partie — imposent leur propre commande
 * de démarrage et ne l'exécutent jamais. Résultat observé en production : le
 * déploiement passait au vert, l'accueil s'affichait, et toutes les pages
 * touchant la base renvoyaient 500 sur une base sans la moindre table.
 *
 * Une migration déclenchée par l'application elle-même ne peut pas être
 * court-circuitée par la plateforme, quelle que soit sa commande de démarrage.
 * C'est la seule garantie qui tienne quand on ne contrôle pas l'hôte.
 *
 * Le SQL est EMBARQUÉ (voir `migrations.generees.ts`) : aucune lecture disque,
 * donc rien qui puisse casser la compilation du runtime Edge ni dépendre de la
 * présence du dossier `drizzle/` à côté du serveur compilé.
 */

/** Table de suivi propre à l'application, distincte de celle de drizzle-kit. */
const TABLE_SUIVI = "__migrations_kelvynlabs";

/**
 * Lit les migrations déjà appliquées par drizzle-kit sur une base existante.
 *
 * Sans cette lecture, une base créée avant ce mécanisme (développement local,
 * VPS déjà en service) verrait le migrateur tenter de recréer ses tables et
 * échouer sur « table already exists ». On reconnaît ce qui a déjà été appliqué
 * à l'horodatage, que drizzle-kit stocke dans `created_at`.
 */
async function horodatagesDejaAppliquesParDrizzle(client: Client): Promise<Set<number>> {
  const existe = await client.execute(
    `SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
  );

  if (Number(existe.rows[0]?.n ?? 0) === 0) return new Set();

  const lignes = await client.execute(`SELECT created_at FROM __drizzle_migrations`);

  return new Set(lignes.rows.map((ligne) => Number(ligne.created_at)));
}

async function tagsDejaAppliques(client: Client): Promise<Set<string>> {
  const lignes = await client.execute(`SELECT tag FROM ${TABLE_SUIVI}`);
  return new Set(lignes.rows.map((ligne) => String(ligne.tag)));
}

/**
 * Applique les migrations manquantes. Idempotent, sûr à rappeler.
 *
 * Chaque migration est jouée dans UNE transaction qui inclut son propre
 * marquage : soit la migration et sa trace passent ensemble, soit rien ne
 * passe. Une base à moitié migrée — le cas qui coûte le plus cher à réparer —
 * devient impossible.
 */
export async function appliquerMigrations(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS ${TABLE_SUIVI} (
       tag text PRIMARY KEY NOT NULL,
       applique_le integer NOT NULL
     )`,
  );

  const [deja, heritees] = await Promise.all([
    tagsDejaAppliques(client),
    horodatagesDejaAppliquesParDrizzle(client),
  ]);

  for (const migration of migrationsEmbarquees) {
    if (deja.has(migration.tag)) continue;

    const marquage = {
      sql: `INSERT OR IGNORE INTO ${TABLE_SUIVI} (tag, applique_le) VALUES (?, ?)`,
      args: [migration.tag, migration.quand],
    };

    // Déjà appliquée par drizzle-kit : on enregistre la trace sans rejouer le
    // SQL, qui échouerait sur des tables existantes.
    if (heritees.has(migration.quand)) {
      await client.execute(marquage);
      continue;
    }

    try {
      await client.batch(
        [...migration.instructions.map((sql) => ({ sql, args: [] })), marquage],
        "write",
      );
    } catch (erreur) {
      // Deux processus peuvent démarrer en même temps et migrer en parallèle.
      // Le perdant échoue ; si le gagnant a bien enregistré la migration, il
      // n'y a rien à réparer.
      const apres = await tagsDejaAppliques(client);
      if (apres.has(migration.tag)) continue;

      throw new Error(`Migration « ${migration.tag} » échouée`, { cause: erreur });
    }
  }
}
