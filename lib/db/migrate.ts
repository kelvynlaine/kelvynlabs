import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "@/lib/db";

/**
 * Applique les migrations en attente au démarrage de l'application.
 *
 * Pourquoi au démarrage plutôt qu'au déploiement : la base est un fichier
 * local sur le VPS. Un `docker compose up` avec une nouvelle image doit
 * suffire — sans étape manuelle à ne pas oublier, qui finirait par l'être.
 *
 * Drizzle tient un journal des migrations déjà appliquées : réexécuter cette
 * fonction est sans effet si tout est à jour.
 */
let dejaFait = false;

export function appliquerMigrations(): void {
  if (dejaFait) return;

  const dossier = join(process.cwd(), "drizzle");

  if (!existsSync(dossier)) {
    // En mode standalone Docker, le dossier doit avoir été copié dans l'image.
    // Échouer bruyamment ici vaut mieux que de servir une base vide.
    throw new Error(
      `Dossier de migrations introuvable : ${dossier}. ` +
        `Vérifiez qu'il est bien copié dans l'image Docker.`,
    );
  }

  migrate(db, { migrationsFolder: dossier });
  dejaFait = true;
}
