import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";

import { VueLecon } from "@/components/contenu/vue-lecon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkLeconAccess } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lecons } from "@/lib/db/schema";
import { bunnyEstConfigure, getServerEnv } from "@/lib/env.server";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Aperçu",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Aperçu d'une leçon avant publication.
 *
 * Deux garanties tiennent cette page :
 *
 *   1. elle affiche le contenu via `VueLecon`, LE MÊME composant que les pages
 *      publiques de la Phase 3. « Aperçu » signifie donc littéralement « ce que
 *      verra le visiteur », pas une approximation qui dériverait avec le temps ;
 *
 *   2. elle passe par `checkLeconAccess()` comme n'importe quelle page client.
 *      Si l'admin voit un brouillon, ce n'est pas parce que cette page contourne
 *      la règle, c'est parce que checkAccess() accorde explicitement le mode
 *      aperçu aux administrateurs.
 */
export default async function PageApercuLecon({
  params,
}: {
  params: Promise<{ id: string; leconId: string }>;
}) {
  await requireAdmin();
  const { id: formationId, leconId } = await params;

  // On résout les slugs à partir des identifiants d'URL de l'admin, puis on
  // passe par le chemin d'accès public.
  const reference = await db.query.lecons.findFirst({
    where: eq(lecons.id, leconId),
    columns: { slug: true, formationId: true },
    with: { formation: { columns: { slug: true } } },
  });

  if (!reference || reference.formationId !== formationId) notFound();

  const acces = await checkLeconAccess(reference.formation.slug, reference.slug);
  if (!acces.autorise) notFound();

  const { lecon, ressources, formation, precedente, suivante } = acces.donnee;
  const cdnBunny = bunnyEstConfigure()
    ? getServerEnv().BUNNY_STREAM_CDN_HOSTNAME
    : undefined;

  return (
    <div className="space-y-8">
      <div className="border-warning/30 bg-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <p className="flex items-center gap-2 text-sm">
          <Eye className="text-warning size-4 shrink-0" />
          <span>
            Aperçu — rendu identique à celui du visiteur.
            {lecon.statut !== "published" ? (
              <span className="text-muted-foreground">
                {" "}
                Cette leçon est en brouillon : elle n&apos;est pas encore visible
                publiquement.
              </span>
            ) : null}
          </span>
        </p>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/formations/${formationId}/lecons/${leconId}`}>
            <ArrowLeft className="size-3.5" />
            Revenir à l&apos;édition
          </Link>
        </Button>
      </div>

      <div className="mx-auto max-w-3xl">
        <p className="text-muted-foreground mb-6 text-sm">
          {formation.titre}
          {lecon.statut !== "published" ? (
            <Badge variant="secondary" className="ml-2">
              Brouillon
            </Badge>
          ) : null}
        </p>

        <VueLecon lecon={lecon} ressources={ressources} cdnBunny={cdnBunny} />

        {/* Navigation précédente / suivante : la Phase 3 la reprendra sur les
            pages publiques, avec la barre latérale de progression. */}
        <nav className="border-border mt-12 flex items-center justify-between gap-4 border-t pt-6">
          {precedente ? (
            <Button variant="ghost" asChild>
              <Link
                href={`/admin/formations/${formationId}/lecons/${precedente.id}/apercu`}
              >
                <ArrowLeft className="size-4" />
                <span className="truncate">{precedente.titre}</span>
              </Link>
            </Button>
          ) : (
            <span />
          )}

          {suivante ? (
            <Button variant="ghost" asChild>
              <Link
                href={`/admin/formations/${formationId}/lecons/${suivante.id}/apercu`}
              >
                <span className="truncate">{suivante.titre}</span>
              </Link>
            </Button>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
