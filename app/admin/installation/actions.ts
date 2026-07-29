"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { erreurDeValidation, type EtatAction } from "@/lib/actions";
import { compterAdmins, connecter } from "@/lib/auth";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { hacherMotDePasse } from "@/lib/mot-de-passe";

/**
 * Création du tout premier compte administrateur.
 *
 * ⚠️ Cette action n'est utilisable QUE tant qu'aucun compte n'existe. La
 * vérification est refaite ici, et pas seulement dans la page : la page ne
 * protège pas l'action, qui est un endpoint HTTP à part entière. Sans ce
 * contrôle, n'importe qui pourrait s'ajouter comme administrateur à tout
 * moment en appelant l'action directement.
 */

const LONGUEUR_MIN = 12;

const schema = z
  .object({
    email: z.email("Adresse email invalide"),
    motDePasse: z
      .string()
      .min(
        LONGUEUR_MIN,
        `Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères`,
      )
      .max(200),
    confirmation: z.string(),
  })
  .refine((donnees) => donnees.motDePasse === donnees.confirmation, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirmation"],
  });

export async function creerPremierAdmin(
  _precedent: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  if ((await compterAdmins()) > 0) {
    return {
      ok: false,
      erreur:
        "Un compte administrateur existe déjà. Utilisez la page de connexion.",
    };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    motDePasse: formData.get("motDePasse"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) return erreurDeValidation(parsed.error);

  const email = parsed.data.email.trim().toLowerCase();
  const hash = await hacherMotDePasse(parsed.data.motDePasse);

  await db.insert(admins).values({ email, motDePasseHash: hash });

  // On enchaîne sur une connexion : l'administrateur arrive directement sur
  // son tableau de bord plutôt que de ressaisir ce qu'il vient de choisir.
  await connecter(email, parsed.data.motDePasse);

  redirect("/admin");
}
