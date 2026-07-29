import type { Metadata } from "next";
import { desc } from "drizzle-orm";

import { BibliothequeMedias } from "@/components/admin/bibliotheque-medias";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { medias } from "@/lib/db/schema";
import { urlMedia } from "@/lib/stockage";

export const metadata: Metadata = {
  title: "Médias",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PageMedias() {
  await requireAdmin();

  const liste = await db.query.medias.findMany({
    orderBy: [desc(medias.creeLe)],
    limit: 200,
  });

  const avecUrl = liste.map((media) => ({
    id: media.id,
    url: urlMedia(media.chemin),
    nomOriginal: media.nomOriginal,
    largeur: media.largeur,
    hauteur: media.hauteur,
    tailleOctets: media.tailleOctets,
    creeLe: media.creeLe,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl">Bibliothèque de médias</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {liste.length === 0
            ? "Aucun média pour l'instant."
            : `${liste.length} image${liste.length > 1 ? "s" : ""} · réutilisables dans toutes vos leçons`}
        </p>
      </div>

      <BibliothequeMedias medias={avecUrl} />
    </div>
  );
}
