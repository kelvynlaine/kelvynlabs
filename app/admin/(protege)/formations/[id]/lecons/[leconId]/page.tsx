import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { basculerPublicationLecon } from "@/app/admin/(protege)/formations/[id]/actions";
import { BoutonPublication } from "@/components/admin/bouton-publication";
import { FormulaireLecon } from "@/components/admin/formulaire-lecon";
import { RessourcesLecon } from "@/components/admin/ressources-lecon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lecons, ressources } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leconId: string }>;
}): Promise<Metadata> {
  const { leconId } = await params;
  const lecon = await db.query.lecons.findFirst({
    where: eq(lecons.id, leconId),
    columns: { titre: true },
  });

  return {
    title: lecon?.titre ?? "Leçon",
    robots: { index: false, follow: false },
  };
}

export default async function PageEditionLecon({
  params,
}: {
  params: Promise<{ id: string; leconId: string }>;
}) {
  await requireAdmin();
  const { id: formationId, leconId } = await params;

  const lecon = await db.query.lecons.findFirst({
    where: eq(lecons.id, leconId),
    with: { formation: { columns: { titre: true, slug: true } } },
  });

  // On vérifie aussi que la leçon appartient bien à la formation de l'URL :
  // sans ce contrôle, /formations/A/lecons/<id-de-B> afficherait la leçon B
  // dans le contexte de A.
  if (!lecon || lecon.formationId !== formationId) notFound();

  const listeRessources = await db.query.ressources.findMany({
    where: eq(ressources.leconId, leconId),
    orderBy: [asc(ressources.ordre)],
  });

  const { formation, ...donneesLecon } = lecon;
  const estPubliee = lecon.statut === "published";

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link href={`/admin/formations/${formationId}`}>
            <ArrowLeft className="size-4" />
            {formation.titre}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl">{lecon.titre}</h1>
            <Badge variant={estPubliee ? "default" : "secondary"}>
              {estPubliee ? "Publiée" : "Brouillon"}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Ouvre la vraie page publique de la leçon : ce que l'admin voit
                est littéralement ce que verra le visiteur. */}
            <Button variant="outline" asChild>
              <Link
                href={`/formations/${formation.slug}/lecons/${lecon.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Aperçu
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>

            <BoutonPublication
              estPublie={estPubliee}
              action={async () => {
                "use server";
                return basculerPublicationLecon(lecon.id);
              }}
            />
          </div>
        </div>

        <p className="text-muted-foreground mt-2 text-sm">
          Le statut d&apos;une leçon est indépendant de celui de sa formation :
          les deux doivent être publiés pour qu&apos;un visiteur la voie.
        </p>
      </div>

      <FormulaireLecon
        lecon={donneesLecon}
        formationId={formationId}
        providerParDefaut={getServerEnv().VIDEO_PROVIDER_DEFAULT}
      />

      <RessourcesLecon leconId={lecon.id} ressources={listeRessources} />
    </div>
  );
}
