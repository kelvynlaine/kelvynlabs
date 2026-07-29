import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { basculerPublicationFormation } from "@/app/admin/(protege)/formations/actions";
import { ArborescenceFormation } from "@/components/admin/arborescence-formation";
import { BoutonPublication } from "@/components/admin/bouton-publication";
import { FormulaireFormation } from "@/components/admin/formulaire-formation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { chapitres, formations, lecons } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, id),
    columns: { titre: true },
  });

  return {
    title: formation?.titre ?? "Formation",
    robots: { index: false, follow: false },
  };
}

export default async function PageEditionFormation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, id),
  });
  if (!formation) notFound();

  const [listeChapitres, listeLecons] = await Promise.all([
    db.query.chapitres.findMany({
      where: eq(chapitres.formationId, id),
      orderBy: [asc(chapitres.ordre)],
    }),
    db.query.lecons.findMany({
      where: eq(lecons.formationId, id),
      orderBy: [asc(lecons.ordre)],
      columns: {
        id: true,
        titre: true,
        slug: true,
        statut: true,
        dureeEstimeeMin: true,
        chapitreId: true,
        videoUrl: true,
      },
    }),
  ]);

  const arborescence = listeChapitres.map((chapitre) => ({
    id: chapitre.id,
    titre: chapitre.titre,
    description: chapitre.description,
    lecons: listeLecons
      .filter((lecon) => lecon.chapitreId === chapitre.id)
      .map(({ videoUrl, chapitreId: _chapitreId, ...reste }) => ({
        ...reste,
        aUneVideo: Boolean(videoUrl),
      })),
  }));

  const estPubliee = formation.statut === "published";

  // Première leçon dans l'ordre de lecture : point d'entrée de l'aperçu.
  const premiereLecon = arborescence.flatMap((chapitre) => chapitre.lecons)[0];

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link href="/admin/formations">
            <ArrowLeft className="size-4" />
            Formations
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl sm:text-4xl">{formation.titre}</h1>
              <Badge variant={estPubliee ? "default" : "secondary"}>
                {estPubliee ? "Publiée" : "Brouillon"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              /formations/{formation.slug}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* L'aperçu s'ouvre sur la première leçon et utilise les composants
                de rendu du site public : l'admin voit exactement ce que verra
                un visiteur, brouillons compris grâce au mode aperçu de
                checkAccess(). */}
            <Button variant="outline" asChild disabled={!premiereLecon}>
              {premiereLecon ? (
                <Link
                  href={`/admin/formations/${id}/lecons/${premiereLecon.id}/apercu`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Aperçu
                  <ExternalLink className="size-3.5" />
                </Link>
              ) : (
                <span>Aperçu</span>
              )}
            </Button>

            <BoutonPublication
              estPublie={estPubliee}
              action={async () => {
                "use server";
                return basculerPublicationFormation(formation.id);
              }}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="contenu">
        <TabsList>
          <TabsTrigger value="contenu">Contenu</TabsTrigger>
          <TabsTrigger value="reglages">Réglages</TabsTrigger>
        </TabsList>

        <TabsContent value="contenu" className="mt-6">
          <ArborescenceFormation formationId={formation.id} chapitres={arborescence} />
        </TabsContent>

        <TabsContent value="reglages" className="mt-6">
          <FormulaireFormation formation={formation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
