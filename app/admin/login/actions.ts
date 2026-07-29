"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { connecter, deconnecter } from "@/lib/auth";

const schemaConnexion = z.object({
  email: z.email("Adresse email invalide"),
  motDePasse: z.string().min(1, "Mot de passe requis"),
  /**
   * Destination après connexion. Validée pour n'accepter qu'un chemin interne :
   * sans ça, `?suivant=https://site-malveillant.tld` transformerait la page de
   * connexion en redirecteur ouvert, très pratique pour du hameçonnage.
   */
  suivant: z
    .string()
    .optional()
    .transform((valeur) =>
      valeur && valeur.startsWith("/") && !valeur.startsWith("//")
        ? valeur
        : "/admin",
    ),
});

export type EtatConnexion = { erreur?: string };

export async function connexionAdmin(
  _etatPrecedent: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  const parsed = schemaConnexion.safeParse({
    email: formData.get("email"),
    motDePasse: formData.get("motDePasse"),
    suivant: formData.get("suivant") ?? undefined,
  });

  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { email, motDePasse, suivant } = parsed.data;

  const resultat = await connecter(email, motDePasse);
  if (!resultat.ok) return { erreur: resultat.erreur };

  // redirect() lève une exception de contrôle de flux : elle doit rester hors
  // de tout try/catch, sinon Next la traite comme une véritable erreur.
  redirect(suivant);
}

export async function deconnexionAdmin() {
  await deconnecter();
  redirect("/admin/login");
}
