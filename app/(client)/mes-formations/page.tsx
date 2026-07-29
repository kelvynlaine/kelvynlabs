import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LibraryBig } from "lucide-react";

import { CarteFormation } from "@/components/client/carte-formation";
import { EnteteSite } from "@/components/client/entete-site";
import { Button } from "@/components/ui/button";
import { listerFormationsDuClient } from "@/lib/access";
import { getStudentCourant } from "@/lib/etudiant";
import { getProgressionFormation } from "@/lib/progression";
import { urlMedia } from "@/lib/stockage";

export const metadata: Metadata = {
  title: "Mes formations",
  description: "Les formations auxquelles vous avez accès.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PageMesFormations() {
  const student = await getStudentCourant();
  if (!student) redirect("/connexion");

  // ⚠️ La liste vient de lib/access.ts, pas d'une requête écrite ici : c'est
  // lui qui décide de ce à quoi ce client a droit, et lui seul.
  const formations = await listerFormationsDuClient();

  const progressions = await Promise.all(
    formations.map((formation) => getProgressionFormation(formation.idsLecons)),
  );

  return (
    <>
      <EnteteSite />

      <main id="contenu" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="font-serif text-4xl tracking-tight">Mes formations</h1>
        <p className="text-muted-foreground mt-3 mb-10 leading-relaxed">
          Connecté avec {student.email}.
        </p>

        {formations.length === 0 ? (
          <div className="border-border rounded-2xl border border-dashed px-6 py-20 text-center">
            <LibraryBig className="text-muted-foreground mx-auto mb-4 size-8" aria-hidden />
            <p className="font-medium">Aucune formation pour l&apos;instant</p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
              Les formations que vous achetez apparaîtront ici, et resteront
              accessibles depuis n&apos;importe quel appareil.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/">Voir le catalogue</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((formation, index) => (
              <CarteFormation
                key={formation.id}
                index={index}
                formation={{
                  slug: formation.slug,
                  titre: formation.titre,
                  descriptionCourte: formation.descriptionCourte,
                  imageCouverture: formation.imageCouverture?.startsWith("/")
                    ? formation.imageCouverture
                    : formation.imageCouverture
                      ? urlMedia(formation.imageCouverture)
                      : null,
                  nbLecons: formation.nbLecons,
                  dureeMinutes: formation.dureeMinutes,
                  // Déjà acheté : afficher un prix ici n'aurait aucun sens.
                  prixCents: null,
                  pourcentage: progressions[index]?.pourcentage ?? 0,
                }}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
