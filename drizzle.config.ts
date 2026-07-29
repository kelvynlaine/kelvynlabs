import { defineConfig } from "drizzle-kit";

/**
 * Configuration drizzle-kit — utilisée uniquement en développement, pour
 * GÉNÉRER les fichiers SQL de migration depuis `lib/db/schema.ts`.
 *
 * Les migrations sont APPLIQUÉES au démarrage de l'application
 * (`lib/db/migrate.ts`), pas par cet outil : en production, il n'y a ni
 * drizzle-kit ni accès à ce fichier.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DOSSIER_DONNEES
      ? `${process.env.DOSSIER_DONNEES}/kelvynlabs.db`
      : ".data/kelvynlabs.db",
  },
  strict: true,
  verbose: true,
});
