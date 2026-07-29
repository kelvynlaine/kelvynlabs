/**
 * Application des migrations, exécutée AVANT le démarrage du serveur.
 *
 * Pourquoi un script séparé, et en JavaScript brut :
 *
 *   1. Les migrations lisent le disque (`node:fs`, `node:path`). Tant qu'elles
 *      étaient déclenchées depuis `instrumentation.ts`, les deux bundlers de
 *      Next les tiraient dans la compilation du runtime EDGE — où ces modules
 *      n'existent pas. Turbopack échouait en tentant de parser un fichier
 *      LICENSE de libSQL, webpack sur « Reading from node:fs is not handled ».
 *      Sortir les migrations du graphe de l'application supprime les deux.
 *
 *   2. En `.mjs` et sans TypeScript : l'image de production n'embarque pas
 *      tsx. Ce script doit tourner avec le seul `node` disponible sur l'hôte.
 *
 * Il est idempotent : Drizzle tient un journal des migrations déjà appliquées.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

function configuration() {
  const distante = process.env.DATABASE_URL?.trim();

  if (distante) {
    return {
      url: distante,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
      description: "base distante",
    };
  }

  const dossier = resolve(process.env.DOSSIER_DONNEES?.trim() || ".data");
  const chemin = join(dossier, "kelvynlabs.db");
  mkdirSync(dirname(chemin), { recursive: true });

  return { url: `file:${chemin}`, description: `fichier local ${chemin}` };
}

async function principal() {
  const dossierMigrations = join(process.cwd(), "drizzle");

  if (!existsSync(dossierMigrations)) {
    console.error(
      `✗ Dossier de migrations introuvable : ${dossierMigrations}\n` +
        `  Vérifiez qu'il est bien déployé avec l'application.`,
    );
    process.exit(1);
  }

  const config = configuration();
  console.log(`→ Migrations sur ${config.description}`);

  const client = createClient({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  });

  await migrate(drizzle(client), { migrationsFolder: dossierMigrations });
  client.close();

  console.log("✓ Base à jour");
}

principal().catch((erreur) => {
  console.error("✗ Migration échouée :", erreur);
  process.exit(1);
});
