"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkLeconAccess } from "@/lib/access";
import type { EtatAction } from "@/lib/actions";
import { enregistrerProgression } from "@/lib/progression";
import { assurerIdentifiantVisiteur } from "@/lib/visiteur";

const schema = z.object({
  formationSlug: z.string().min(1).max(80),
  leconSlug: z.string().min(1).max(80),
  complete: z.boolean(),
});

/**
 * Marque une leçon comme terminée, ou annule ce marquage.
 *
 * ⚠️ Deux points structurants :
 *
 *   1. L'action passe par `checkLeconAccess()` AVANT d'écrire. Ce n'est pas
 *      une formalité : sans ce contrôle, l'endpoint accepterait n'importe quel
 *      couple de slugs et permettrait, en observant lesquels réussissent,
 *      d'énumérer les leçons non publiées. Le jour où une formation sera
 *      payante, ce même contrôle empêchera d'enregistrer une progression sur
 *      un contenu non acheté.
 *
 *   2. L'identifiant du visiteur vient du COOKIE, jamais des paramètres. Si le
 *      client pouvait l'envoyer, n'importe qui pourrait réécrire la
 *      progression d'un autre visiteur en devinant son UUID.
 */
export async function basculerProgression(
  formationSlug: string,
  leconSlug: string,
  complete: boolean,
): Promise<EtatAction> {
  const parsed = schema.safeParse({ formationSlug, leconSlug, complete });
  if (!parsed.success) return { ok: false, erreur: "Requête invalide" };

  const acces = await checkLeconAccess(parsed.data.formationSlug, parsed.data.leconSlug);
  if (!acces.autorise) {
    return { ok: false, erreur: "Leçon introuvable" };
  }

  const identifiant = await assurerIdentifiantVisiteur();
  await enregistrerProgression(identifiant, acces.donnee.lecon.id, parsed.data.complete);

  revalidatePath(`/formations/${parsed.data.formationSlug}`);
  revalidatePath(
    `/formations/${parsed.data.formationSlug}/lecons/${parsed.data.leconSlug}`,
  );

  return { ok: true };
}
