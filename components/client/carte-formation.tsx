import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, ImageIcon } from "lucide-react";

import { BarreProgression } from "@/components/client/barre-progression";
import { Badge } from "@/components/ui/badge";

export type FormationCatalogue = {
  slug: string;
  titre: string;
  descriptionCourte: string | null;
  imageCouverture: string | null;
  nbLecons: number;
  dureeMinutes: number;
  prixCents: number | null;
  /** Pourcentage déjà parcouru par ce visiteur, ou null s'il n'a rien commencé. */
  pourcentage: number | null;
};

/** « 95 min » devient « 1 h 35 » : plus lisible dès qu'on dépasse l'heure. */
export function formaterDuree(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;

  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, "0")}`;
}

export function CarteFormation({ formation }: { formation: FormationCatalogue }) {
  const commencee = formation.pourcentage !== null && formation.pourcentage > 0;

  return (
    <li>
      <Link
        href={`/formations/${formation.slug}`}
        className="group border-border bg-card hover:border-brand-vivid/50 focus-visible:border-brand-vivid flex h-full flex-col overflow-hidden rounded-2xl border transition-colors"
      >
        <div className="bg-secondary relative aspect-[16/9] overflow-hidden">
          {formation.imageCouverture ? (
            <Image
              src={formation.imageCouverture}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            // Sans couverture, on affiche un aplat de marque plutôt qu'un vide :
            // une grille où certaines cartes ont une image et d'autres un trou
            // paraît cassée.
            <div className="from-brand/25 to-brand-vivid/10 flex size-full items-center justify-center bg-gradient-to-br">
              <ImageIcon className="text-brand-text/40 size-8" />
            </div>
          )}

          {commencee ? (
            <div className="absolute inset-x-0 bottom-0">
              <BarreProgression
                pourcentage={formation.pourcentage ?? 0}
                taille="fine"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-heading group-hover:text-brand-text text-xl leading-snug transition-colors">
            {formation.titre}
          </h3>

          {formation.descriptionCourte ? (
            <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
              {formation.descriptionCourte}
            </p>
          ) : null}

          <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs">
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              {formation.nbLecons} leçon{formation.nbLecons > 1 ? "s" : ""}
            </span>

            {formation.dureeMinutes > 0 ? (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {formaterDuree(formation.dureeMinutes)}
              </span>
            ) : null}

            {commencee ? (
              <Badge variant="secondary" className="ml-auto">
                {formation.pourcentage}&nbsp;%
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
