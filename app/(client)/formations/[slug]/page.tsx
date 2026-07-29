import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Clock, RotateCcw } from "lucide-react";

import { BandeauApercu } from "@/components/client/bandeau-apercu";
import { BarreProgression } from "@/components/client/barre-progression";
import { formaterDuree } from "@/components/client/carte-formation";
import { EnteteSite } from "@/components/client/entete-site";
import { SommaireFormation } from "@/components/client/sommaire-formation";
import { Button } from "@/components/ui/button";
import { VitrinePayante } from "@/components/client/vitrine-payante";
import { checkAccess, getVitrineFormation } from "@/lib/access";
import { stripeEstConfigure } from "@/lib/env.server";
import { getStudentCourant } from "@/lib/etudiant";
import { getProgressionFormation, prochaineLecon } from "@/lib/progression";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const acces = await checkAccess({ slug });

  // Une formation payante non achetée reste une page publique : son titre doit
  // apparaître dans l'onglet et dans les partages, sinon la vitrine
  // s'annoncerait elle-même comme « introuvable ».
  const formation = acces.autorise
    ? acces.donnee
    : await getVitrineFormation(slug);

  if (!formation) return { title: "Formation introuvable" };

  return {
    title: formation.titre,
    description: formation.descriptionCourte ?? siteConfig.description,
    openGraph: {
      type: "article",
      title: formation.titre,
      description: formation.descriptionCourte ?? siteConfig.description,
      // ⚠️ Pas de champ `images` ici : le renseigner — même à `undefined` —
      // désactive la convention de fichier `opengraph-image.tsx`, et la page
      // se retrouve alors sans aucune vignette de partage. On laisse donc Next
      // rattacher l'image générée tout seul.
    },
    // Un brouillon consulté par l'admin ne doit jamais entrer dans un index.
    robots:
      formation.statut === "published" ? undefined : { index: false, follow: false },
  };
}

export default async function PageFormation({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Contrôle d'accès unique — voir lib/access.ts. Cette page ne teste jamais
  // `statut` ni le paiement elle-même.
  const acces = await checkAccess({ slug });

  if (!acces.autorise) {
    // Formation payante non achetée : on montre la vitrine plutôt qu'un 404.
    // Renvoyer « introuvable » à un acheteur potentiel serait absurde.
    if (acces.raison === "paiement_requis") {
      const vitrine = await getVitrineFormation(slug);
      if (!vitrine) notFound();

      return (
        <VitrinePayante
          formation={vitrine}
          paiementActif={stripeEstConfigure()}
          dejaConnecte={(await getStudentCourant()) !== null}
        />
      );
    }

    notFound();
  }

  const { donnee: formation, apercuAdmin } = acces;

  const parcours = formation.chapitres.flatMap((chapitre) => chapitre.lecons);
  const progression = await getProgressionFormation(parcours.map((l) => l.id));

  const dureeTotaleMinutes = parcours.reduce(
    (total, lecon) => total + (lecon.dureeEstimeeMin ?? 0),
    0,
  );

  const suivante = prochaineLecon(parcours, progression.terminees);
  const commencee = progression.nbTerminees > 0;
  const terminee = parcours.length > 0 && suivante === null;

  // « Commencer » tant que rien n'est coché, « Reprendre » ensuite, et retour
  // à la première leçon quand tout est terminé — pour pouvoir relire.
  const cible = suivante ?? parcours[0];

  return (
    <>
      <EnteteSite />

      <main id="contenu-principal" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {apercuAdmin ? (
          <BandeauApercu
            lienEdition={`/admin/formations/${formation.id}`}
            estBrouillon={formation.statut !== "published"}
            quoi="formation"
          />
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
          {/* --- Colonne principale ---------------------------------------- */}
          <div className="min-w-0 lg:order-1">
            <h1 className="text-4xl leading-[1.1] sm:text-5xl">{formation.titre}</h1>

            {formation.descriptionCourte ? (
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                {formation.descriptionCourte}
              </p>
            ) : null}

            <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-4" />
                {parcours.length} leçon{parcours.length > 1 ? "s" : ""}
              </span>
              {dureeTotaleMinutes > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4" />
                  {formaterDuree(dureeTotaleMinutes)} au total
                </span>
              ) : null}
            </div>

            {formation.description ? (
              <div className="contenu-lecon mt-10 border-t pt-10">
                {/* La description longue est du texte simple saisi dans
                    l'admin : on préserve ses retours à la ligne sans
                    interpréter de balisage. */}
                <p className="whitespace-pre-line">{formation.description}</p>
              </div>
            ) : null}

            <section className="mt-12 border-t pt-10">
              <h2 className="mb-6 text-2xl">Programme</h2>

              {parcours.length === 0 ? (
                <p className="border-border text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">
                  Le programme de cette formation n&apos;est pas encore
                  disponible.
                </p>
              ) : (
                <SommaireFormation
                  formationSlug={formation.slug}
                  chapitres={formation.chapitres}
                  terminees={progression.terminees}
                />
              )}
            </section>
          </div>

          {/* --- Carte latérale --------------------------------------------- */}
          {/* En mobile elle passe AVANT le programme (order-first) : le bouton
              d'action doit rester à portée de pouce sans défiler. */}
          <aside className="order-first lg:order-2">
            <div className="border-border bg-card sticky top-24 overflow-hidden rounded-2xl border">
              {formation.imageCouverture ? (
                <div className="bg-secondary relative aspect-[16/9]">
                  <Image
                    src={formation.imageCouverture}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 380px"
                    className="object-cover"
                    priority
                  />
                </div>
              ) : null}

              <div className="space-y-4 p-5">
                {commencee ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">
                        {terminee ? "Formation terminée" : "Votre progression"}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {progression.nbTerminees}/{progression.nbTotal}
                      </span>
                    </div>
                    <BarreProgression
                      pourcentage={progression.pourcentage}
                      etiquette={`Progression : ${progression.pourcentage} %`}
                    />
                  </div>
                ) : null}

                {cible ? (
                  <Button size="lg" className="w-full" asChild>
                    <Link
                      href={`/formations/${formation.slug}/lecons/${cible.slug}`}
                    >
                      {terminee ? (
                        <>
                          <RotateCcw className="size-4" />
                          Revoir depuis le début
                        </>
                      ) : (
                        <>
                          {commencee ? "Reprendre" : "Commencer"}
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" className="w-full" disabled>
                    Bientôt disponible
                  </Button>
                )}

                {commencee && !terminee && suivante ? (
                  <p className="text-muted-foreground text-xs">
                    Prochaine leçon :{" "}
                    <span className="text-foreground">{suivante.titre}</span>
                  </p>
                ) : null}

                <p className="text-muted-foreground border-t pt-4 text-xs leading-relaxed">
                  Aucun compte n&apos;est nécessaire. Votre progression est
                  enregistrée sur cet appareil.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
