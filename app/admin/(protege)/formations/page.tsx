import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { DialogueNouvelleFormation } from "@/components/admin/dialogue-nouvelle-formation";
import { ListeFormations } from "@/components/admin/liste-formations";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formations, lecons } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Formations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PageFormations() {
  await requireAdmin();

  const [liste, toutesLecons] = await Promise.all([
    db.query.formations.findMany({ orderBy: [asc(formations.ordre)] }),
    db.select({ formationId: lecons.formationId, statut: lecons.statut }).from(lecons),
  ]);

  const compteur = new Map<string, { total: number; publiees: number }>();
  for (const lecon of toutesLecons) {
    const actuel = compteur.get(lecon.formationId) ?? { total: 0, publiees: 0 };
    actuel.total += 1;
    if (lecon.statut === "published") actuel.publiees += 1;
    compteur.set(lecon.formationId, actuel);
  }

  const formationsAvecStats = liste.map((formation) => ({
    ...formation,
    nbLecons: compteur.get(formation.id)?.total ?? 0,
    nbLeconsPubliees: compteur.get(formation.id)?.publiees ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Formations</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {liste.length === 0
              ? "Aucune formation pour l'instant."
              : `${liste.length} formation${liste.length > 1 ? "s" : ""} · glissez pour réordonner le catalogue`}
          </p>
        </div>
        <DialogueNouvelleFormation />
      </div>

      <ListeFormations formations={formationsAvecStats} />
    </div>
  );
}
