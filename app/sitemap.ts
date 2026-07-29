import type { MetadataRoute } from "next";
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { lecons } from "@/lib/db/schema";
import { listerFormationsVisibles } from "@/lib/access";
import { siteConfig } from "@/lib/site-config";

/**
 * Plan du site.
 *
 * Il s'appuie sur `listerFormationsVisibles()`, la même fonction que le
 * catalogue : une formation dépubliée disparaît donc automatiquement du plan,
 * sans qu'on ait à y penser. Écrire une requête indépendante ici finirait par
 * exposer des brouillons le jour où la règle de visibilité évoluerait.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;

  const entrees: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
  ];

  let formations: Awaited<ReturnType<typeof listerFormationsVisibles>> = [];

  try {
    formations = await listerFormationsVisibles();
  } catch {
    // Base indisponible : mieux vaut un plan minimal qu'une erreur 500, qui
    // pousserait les moteurs à retenter en boucle.
    return entrees;
  }

  for (const formation of formations) {
    entrees.push({
      url: `${base}/formations/${formation.slug}`,
      lastModified: formation.misAJourLe,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    const leconsPubliees = await db.query.lecons.findMany({
      where: eq(lecons.formationId, formation.id),
      orderBy: [asc(lecons.ordre)],
      columns: { slug: true, statut: true, misAJourLe: true },
    });

    for (const lecon of leconsPubliees) {
      if (lecon.statut !== "published") continue;

      entrees.push({
        url: `${base}/formations/${formation.slug}/lecons/${lecon.slug}`,
        lastModified: lecon.misAJourLe,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return entrees;
}
