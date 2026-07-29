"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { EtatAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { medias } from "@/lib/db/schema";
import { supprimerFichier } from "@/lib/stockage";

/**
 * Supprime un média de la bibliothèque ET son fichier sur le disque.
 *
 * ⚠️ Aucune vérification des usages n'est faite : une image insérée dans une
 * leçon apparaîtra cassée après suppression. Retrouver les usages supposerait
 * de parcourir tous les documents Tiptap à chaque suppression — coûteux, et
 * jamais fiable à 100 %. On avertit clairement dans la confirmation plutôt que
 * de promettre une garantie qu'on ne peut pas tenir.
 */
export async function supprimerMedia(id: string): Promise<EtatAction> {
  await requireAdmin();

  const media = await db.query.medias.findFirst({ where: eq(medias.id, id) });
  if (!media) return { ok: false, erreur: "Média introuvable" };

  await db.delete(medias).where(eq(medias.id, id));
  await supprimerFichier(media.chemin);

  revalidatePath("/admin/medias");
  return { ok: true };
}
