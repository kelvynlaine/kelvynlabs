import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, PartyPopper } from "lucide-react";

import { BandeauApercu } from "@/components/client/bandeau-apercu";
import { BarreProgression } from "@/components/client/barre-progression";
import { BoutonLeconTerminee } from "@/components/client/bouton-lecon-terminee";
import { EnteteSite } from "@/components/client/entete-site";
import { SommaireFormation } from "@/components/client/sommaire-formation";
import { SommaireMobile } from "@/components/client/sommaire-mobile";
import { VueLecon } from "@/components/contenu/vue-lecon";
import { Button } from "@/components/ui/button";
import { checkLeconAccess } from "@/lib/access";
import { bunnyEstConfigure, getServerEnv } from "@/lib/env.server";
import { getProgressionFormation } from "@/lib/progression";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; leconSlug: string }>;
}): Promise<Metadata> {
  const { slug, leconSlug } = await params;
  const acces = await checkLeconAccess(slug, leconSlug);

  if (!acces.autorise) return { title: "Leçon introuvable" };

  const { lecon, formation } = acces.donnee;
  const publiee =
    lecon.statut === "published" && formation.statut === "published";

  return {
    title: `${lecon.titre} · ${formation.titre}`,
    robots: publiee ? undefined : { index: false, follow: false },
  };
}

export default async function PageLecon({
  params,
}: {
  params: Promise<{ slug: string; leconSlug: string }>;
}) {
  const { slug, leconSlug } = await params;

  // Contrôle d'accès unique. L'accès à la leçon dérive de celui de sa
  // formation : un futur paywall posé sur la formation protégera cette page
  // sans modification ici.
  const acces = await checkLeconAccess(slug, leconSlug);

  if (!acces.autorise) {
    // Formation payante non achetée : on renvoie vers la vitrine, où le
    // visiteur voit ce qu'il achète. Un 404 lui laisserait croire que la
    // leçon n'existe pas.
    if (acces.raison === "paiement_requis") redirect(`/formations/${slug}`);
    notFound();
  }

  const { donnee, apercuAdmin } = acces;
  const { lecon, ressources, formation, precedente, suivante } = donnee;

  const parcours = formation.chapitres.flatMap((chapitre) => chapitre.lecons);
  const progression = await getProgressionFormation(parcours.map((l) => l.id));

  const cdnBunny = bunnyEstConfigure()
    ? getServerEnv().BUNNY_STREAM_CDN_HOSTNAME
    : undefined;

  const termineeCourante = progression.terminees.has(lecon.id);
  const toutTermine =
    progression.nbTotal > 0 && progression.nbTerminees === progression.nbTotal;

  const sommaire = (
    <SommaireFormation
      formationSlug={formation.slug}
      chapitres={formation.chapitres}
      terminees={progression.terminees}
      leconCouranteId={lecon.id}
      compact
    />
  );

  const resumeProgression = `${progression.nbTerminees} sur ${progression.nbTotal} leçons terminées`;

  return (
    <>
      <EnteteSite>
        <div className="ml-2 flex min-w-0 items-center gap-3">
          <SommaireMobile titre={formation.titre} progression={resumeProgression}>
            {sommaire}
          </SommaireMobile>

          <Link
            href={`/formations/${formation.slug}`}
            className="text-muted-foreground hover:text-foreground hidden truncate text-sm transition-colors sm:block"
          >
            {formation.titre}
          </Link>
        </div>
      </EnteteSite>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {apercuAdmin ? (
          <BandeauApercu
            lienEdition={`/admin/formations/${formation.id}/lecons/${lecon.id}`}
            estBrouillon={lecon.statut !== "published"}
            quoi="leçon"
          />
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-12">
          {/* --- Barre latérale, écrans larges uniquement ------------------- */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
              <Link
                href={`/formations/${formation.slug}`}
                className="hover:text-brand-text font-heading text-lg leading-snug transition-colors"
              >
                {formation.titre}
              </Link>

              <div className="mt-4 mb-6 space-y-2">
                <BarreProgression
                  pourcentage={progression.pourcentage}
                  etiquette={resumeProgression}
                />
                <p className="text-muted-foreground text-xs">
                  {progression.nbTerminees}/{progression.nbTotal} leçons ·{" "}
                  {progression.pourcentage}&nbsp;%
                </p>
              </div>

              {sommaire}
            </div>
          </aside>

          {/* --- Leçon ------------------------------------------------------ */}
          <main id="contenu-principal" className="min-w-0">
            <VueLecon lecon={lecon} ressources={ressources} cdnBunny={cdnBunny} />

            <div className="border-border mt-12 border-t pt-8">
              <BoutonLeconTerminee
                formationSlug={formation.slug}
                leconSlug={lecon.slug}
                termineeInitial={termineeCourante}
              />

              {toutTermine ? (
                <div className="border-success/30 bg-success/10 mt-6 flex items-start gap-3 rounded-xl border p-4">
                  <PartyPopper className="text-success mt-0.5 size-5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Formation terminée</p>
                    <p className="text-muted-foreground mt-0.5">
                      Vous avez parcouru les {progression.nbTotal} leçons de
                      cette formation.{" "}
                      <Link
                        href="/"
                        className="text-brand-text underline underline-offset-4"
                      >
                        Découvrir les autres formations
                      </Link>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* --- Navigation ---------------------------------------------- */}
            <nav
              aria-label="Navigation entre les leçons"
              className="border-border mt-8 grid gap-3 border-t pt-8 sm:grid-cols-2"
            >
              {precedente ? (
                <Button
                  variant="outline"
                  asChild
                  className="h-auto justify-start py-3 text-left"
                >
                  <Link
                    href={`/formations/${formation.slug}/lecons/${precedente.slug}`}
                  >
                    <ArrowLeft className="size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="text-muted-foreground block text-xs">
                        Précédente
                      </span>
                      <span className="block truncate text-sm font-medium">
                        {precedente.titre}
                      </span>
                    </span>
                  </Link>
                </Button>
              ) : (
                <span />
              )}

              {suivante ? (
                <Button
                  asChild
                  className="h-auto justify-end py-3 text-right sm:col-start-2"
                >
                  <Link
                    href={`/formations/${formation.slug}/lecons/${suivante.slug}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs opacity-80">Suivante</span>
                      <span className="block truncate text-sm font-medium">
                        {suivante.titre}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  asChild
                  className="h-auto justify-end py-3 text-right sm:col-start-2"
                >
                  <Link href={`/formations/${formation.slug}`}>
                    <span className="min-w-0">
                      <span className="text-muted-foreground block text-xs">
                        Dernière leçon
                      </span>
                      <span className="block truncate text-sm font-medium">
                        Retour au programme
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </Button>
              )}
            </nav>
          </main>
        </div>
      </div>
    </>
  );
}
