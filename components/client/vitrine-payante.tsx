import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, Lock, ShieldCheck } from "lucide-react";

import { BoutonAchat } from "@/components/client/bouton-achat";
import { formaterDuree } from "@/components/client/carte-formation";
import { EnteteSite } from "@/components/client/entete-site";
import { SommaireFormation } from "@/components/client/sommaire-formation";
import type { FormationComplete } from "@/lib/access";
import { formaterPrix } from "@/lib/stripe";

/**
 * Page d'une formation payante que le visiteur n'a pas achetée.
 *
 * Elle montre le programme complet — titres et durées — mais aucun contenu.
 * Renvoyer un 404 serait absurde commercialement : personne n'achète ce
 * qu'il ne peut pas voir.
 */
export function VitrinePayante({
  formation,
  paiementActif,
  dejaConnecte,
}: {
  formation: FormationComplete;
  /** Faux tant que Stripe n'est pas configuré : le bouton devient informatif. */
  paiementActif: boolean;
  dejaConnecte: boolean;
}) {
  const parcours = formation.chapitres.flatMap((chapitre) => chapitre.lecons);
  const duree = parcours.reduce((t, l) => t + (l.dureeEstimeeMin ?? 0), 0);
  const prix = formation.prixCents ?? 0;

  return (
    <>
      <EnteteSite />

      <main
        id="contenu-principal"
        className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
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
              {duree > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4" />
                  {formaterDuree(duree)} au total
                </span>
              ) : null}
            </div>

            {formation.description ? (
              <div className="contenu-lecon mt-10 border-t pt-10">
                <p className="whitespace-pre-line">{formation.description}</p>
              </div>
            ) : null}

            <section className="mt-12 border-t pt-10">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl">Programme</h2>
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Lock className="size-3.5" />
                  Contenu accessible après achat
                </span>
              </div>

              {/* Le sommaire est affiché sans lien cliquable : les leçons ne
                  sont pas encore accessibles, et un lien qui rebondit sur un
                  mur serait plus frustrant qu'informatif. */}
              <div className="pointer-events-none opacity-90">
                <SommaireFormation
                  formationSlug={formation.slug}
                  chapitres={formation.chapitres}
                  terminees={new Set()}
                />
              </div>
            </section>
          </div>

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
                <p className="font-heading text-4xl">
                  {formaterPrix(prix, formation.devise)}
                </p>
                <p className="text-muted-foreground text-sm">
                  Paiement unique · accès sans limite de durée
                </p>

                <BoutonAchat
                  slug={formation.slug}
                  paiementActif={paiementActif}
                  dejaConnecte={dejaConnecte}
                />

                {/*
                  Sortie de secours indispensable : un client qui a acheté
                  depuis un autre appareil arrive ici et voit un bouton
                  « Acheter ». Sans ce rappel, il paierait une seconde fois —
                  ou renoncerait en pensant avoir perdu son accès.
                  Inutile de l'afficher à quelqu'un déjà connecté : s'il voit
                  cette page, c'est qu'il n'a pas acheté CETTE formation.
                */}
                {!dejaConnecte && (
                  <p className="text-muted-foreground text-center text-xs">
                    Déjà acheté&nbsp;?{" "}
                    <Link
                      href="/connexion"
                      className="text-foreground underline underline-offset-4"
                    >
                      Connectez-vous
                    </Link>
                  </p>
                )}

                <ul className="text-muted-foreground space-y-2 border-t pt-4 text-xs">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    Paiement sécurisé par Stripe. Aucune donnée bancaire ne
                    transite par ce site.
                  </li>
                  <li className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 size-3.5 shrink-0" />
                    {parcours.length} leçon{parcours.length > 1 ? "s" : ""}
                    {duree > 0 ? ` · ${formaterDuree(duree)}` : ""}
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
