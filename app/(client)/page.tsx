import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { CarteFormation } from "@/components/client/carte-formation";
import { EnteteSite } from "@/components/client/entete-site";
import { listerFormationsVisibles } from "@/lib/access";
import { getProgressionFormation } from "@/lib/progression";
import { siteConfig } from "@/lib/site-config";
import { urlMedia } from "@/lib/stockage";

export const metadata: Metadata = {
  // `absolute` court-circuite le gabarit « %s · Kelvynlabs » défini dans le
  // layout racine : sans lui, l'accueil s'intitulerait « Kelvynlabs · Kelvynlabs ».
  title: { absolute: `${siteConfig.name} — ${siteConfig.tagline}` },
  description: siteConfig.description,
};

// La progression dépend du cookie du visiteur : le catalogue ne peut pas être
// mis en cache de façon statique.
export const dynamic = "force-dynamic";

export default async function PageCatalogue() {
  const formations = await listerFormationsVisibles();

  // Progression de CE visiteur pour chaque formation. Les requêtes partent
  // ensemble plutôt qu'en série : sans cela, dix formations feraient dix
  // allers-retours enchaînés.
  const progressions = await Promise.all(
    formations.map((formation) => getProgressionFormation(formation.idsLecons)),
  );

  const cartes = formations.map((formation, index) => ({
    slug: formation.slug,
    titre: formation.titre,
    descriptionCourte: formation.descriptionCourte,
    imageCouverture: formation.imageCouverture,
    nbLecons: formation.nbLecons,
    dureeMinutes: formation.dureeMinutes,
    prixCents: formation.prixCents,
    pourcentage: progressions[index]?.nbTerminees
      ? (progressions[index]?.pourcentage ?? 0)
      : null,
  }));

  return (
    <>
      <EnteteSite />

      <main className="relative overflow-hidden">
        <div
          aria-hidden
          className="bg-brand-vivid/12 pointer-events-none absolute top-[-28rem] left-1/2 size-[44rem] -translate-x-1/2 rounded-full blur-[140px]"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-8 sm:px-6 sm:pt-24">
          <h1 className="max-w-2xl text-5xl leading-[1.05] sm:text-6xl">
            <span className="text-gradient-brand">Apprendre sans bruit.</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
            {siteConfig.description}
          </p>
        </div>

        <section
          aria-labelledby="titre-catalogue"
          className="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6"
        >
          <h2 id="titre-catalogue" className="sr-only">
            Catalogue des formations
          </h2>

          {cartes.length === 0 ? (
            <div className="border-border rounded-2xl border border-dashed py-20 text-center">
              <BookOpen className="text-muted-foreground mx-auto size-8" />
              <p className="mt-4 font-medium">Aucune formation publiée</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                Les formations apparaîtront ici dès qu&apos;elles seront
                publiées. Revenez bientôt.
              </p>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cartes.map((formation) => (
                <CarteFormation
                  key={formation.slug}
                  formation={{
                    ...formation,
                    // Les couvertures sont stockées comme URL complète par
                    // l'admin ; on ne re-préfixe que les chemins bruts.
                    imageCouverture: formation.imageCouverture?.startsWith("/")
                      ? formation.imageCouverture
                      : formation.imageCouverture
                        ? urlMedia(formation.imageCouverture)
                        : null,
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
