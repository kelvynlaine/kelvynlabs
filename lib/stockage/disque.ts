import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { resoudreCheminUpload } from "@/lib/chemins";

/**
 * Backend « disque local ».
 *
 * C'est le mode par défaut : les fichiers vivent à côté de la base, sous
 * `DOSSIER_DONNEES`. Parfait sur un VPS avec volume persistant.
 *
 * ⚠️ Inutilisable sur un hébergement dont le disque est recréé à chaque
 * déploiement : les fichiers y disparaîtraient à chaque mise en ligne. Voir le
 * backend S3 pour ces plateformes.
 */
export const backendDisque = {
  nom: "disque" as const,

  async ecrire(chemin: string, contenu: Buffer): Promise<void> {
    const destination = resoudreCheminUpload(chemin);
    if (!destination) throw new Error("Chemin de destination invalide");

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contenu);
  },

  async lire(chemin: string): Promise<Buffer | null> {
    const source = resoudreCheminUpload(chemin);
    if (!source) return null;

    try {
      return await readFile(source);
    } catch {
      return null;
    }
  },

  async supprimer(chemin: string): Promise<void> {
    const cible = resoudreCheminUpload(chemin);
    if (!cible) return;

    try {
      await unlink(cible);
    } catch {
      // Déjà absent : ce n'est pas une erreur du point de vue de l'appelant,
      // qui voulait simplement que le fichier ne soit plus là.
    }
  },
};
