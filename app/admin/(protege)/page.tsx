import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Layers, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { chapitres, lecons } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

// Le tableau de bord reflète l'état réel de la base : jamais de cache.
export const dynamic = "force-dynamic";

export default async function PageTableauDeBord() {
  const admin = await requireAdmin();

  const [toutesFormations, tousChapitres, toutesLecons] = await Promise.all([
    db.query.formations.findMany({
      columns: { id: true, titre: true, slug: true, statut: true, misAJourLe: true },
      orderBy: (t, { desc }) => [desc(t.misAJourLe)],
    }),
    db.select({ id: chapitres.id }).from(chapitres),
    db.select({ id: lecons.id, statut: lecons.statut }).from(lecons),
  ]);

  const publiees = toutesFormations.filter((f) => f.statut === "published").length;
  const leconsPubliees = toutesLecons.filter((l) => l.statut === "published").length;

  const cartes = [
    {
      titre: "Formations",
      valeur: toutesFormations.length,
      icone: BookOpen,
      detail: `${publiees} publiée${publiees > 1 ? "s" : ""} · ${toutesFormations.length - publiees} brouillon${toutesFormations.length - publiees > 1 ? "s" : ""}`,
    },
    {
      titre: "Chapitres",
      valeur: tousChapitres.length,
      icone: Layers,
      detail: "Toutes formations confondues",
    },
    {
      titre: "Leçons",
      valeur: toutesLecons.length,
      icone: FileText,
      detail: `${leconsPubliees} publiée${leconsPubliees > 1 ? "s" : ""}`,
    },
  ];

  const recentes = toutesFormations.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Tableau de bord</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Connecté en tant que{" "}
            <span className="text-foreground font-medium">{admin.email}</span>
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/formations">
            <Plus className="size-4" />
            Gérer les formations
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map(({ titre, valeur, icone: Icone, detail }) => (
          <Card key={titre} className="hover:border-brand-vivid/40 transition-colors">
            {/* CardHeader est une grille : l'icône doit passer par CardAction
                pour occuper la colonne de droite plutôt que la ligne suivante. */}
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {titre}
              </CardTitle>
              <CardAction>
                <Icone className="text-brand-text size-4" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-4xl">{valeur}</p>
              <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modifiées récemment</CardTitle>
          {toutesFormations.length > 0 ? (
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/formations">
                  Tout voir
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {recentes.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                Aucune formation pour l&apos;instant.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/admin/formations">
                  <Plus className="size-4" />
                  Créer la première
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {recentes.map((formation) => (
                <li key={formation.id}>
                  <Link
                    href={`/admin/formations/${formation.id}`}
                    className="hover:bg-secondary/50 -mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors"
                  >
                    <span className="truncate text-sm font-medium">
                      {formation.titre}
                    </span>
                    <Badge
                      variant={formation.statut === "published" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {formation.statut === "published" ? "Publiée" : "Brouillon"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
