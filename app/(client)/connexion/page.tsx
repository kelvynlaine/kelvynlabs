import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormulaireConnexion } from "@/app/(client)/connexion/formulaire";
import { EnteteSite } from "@/components/client/entete-site";
import { getStudentCourant } from "@/lib/etudiant";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Accédez aux formations que vous avez achetées.",
  // Une page de connexion n'a rien à faire dans les résultats de recherche.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PageConnexion() {
  // Déjà connecté : l'envoyer sur ses formations plutôt que lui redemander son
  // adresse. Le cas arrive dès qu'on garde le lien en favori.
  if (await getStudentCourant()) redirect("/mes-formations");

  return (
    <>
      <EnteteSite />

      <main id="contenu" className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl tracking-tight">Se connecter</h1>
        <p className="text-muted-foreground mt-3 mb-8 leading-relaxed">
          Aucun mot de passe : indiquez votre adresse, nous vous envoyons un lien
          qui vous connecte en un clic.
        </p>

        <FormulaireConnexion />
      </main>
    </>
  );
}
