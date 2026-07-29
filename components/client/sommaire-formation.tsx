import Link from "next/link";
import { Check, Circle, Clock, PlayCircle, Video } from "lucide-react";

import { formaterDuree } from "@/components/client/carte-formation";
import { Badge } from "@/components/ui/badge";
import type { ChapitreAvecLecons } from "@/lib/access";
import { compterParChapitre } from "@/lib/progression";

/**
 * Sommaire d'une formation : chapitres et leçons, avec l'état d'avancement.
 *
 * Le même composant sert la page de la formation et la barre latérale du
 * lecteur (`compact`). Deux implémentations divergeraient au premier
 * ajustement, et l'apprenant perdrait ses repères en passant de l'une à
 * l'autre.
 */
export function SommaireFormation({
  formationSlug,
  chapitres,
  terminees,
  leconCouranteId,
  compact = false,
}: {
  formationSlug: string;
  chapitres: ChapitreAvecLecons[];
  terminees: Set<string>;
  leconCouranteId?: string;
  compact?: boolean;
}) {
  const parChapitre = compterParChapitre(chapitres, terminees);
  let numero = 0;

  return (
    <nav aria-label="Sommaire de la formation">
      <ol className={compact ? "space-y-5" : "space-y-8"}>
        {chapitres.map((chapitre, index) => {
          const compte = parChapitre.get(chapitre.id);
          const chapitreTermine =
            compte !== undefined && compte.total > 0 && compte.termine === compte.total;

          return (
            <li key={chapitre.id}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3
                  className={
                    compact
                      ? "text-foreground text-sm font-semibold"
                      : "font-heading text-xl"
                  }
                >
                  {compact ? null : (
                    <span className="text-muted-foreground mr-2 font-sans text-sm font-normal">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                  {chapitre.titre}
                </h3>

                {compte && compte.total > 0 ? (
                  <span
                    className={`ml-auto shrink-0 text-xs ${
                      chapitreTermine ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {compte.termine}/{compte.total}
                  </span>
                ) : null}
              </div>

              {!compact && chapitre.description ? (
                <p className="text-muted-foreground mb-3 text-sm">
                  {chapitre.description}
                </p>
              ) : null}

              <ul className={compact ? "space-y-0.5" : "space-y-1.5"}>
                {chapitre.lecons.map((lecon) => {
                  numero += 1;
                  const termine = terminees.has(lecon.id);
                  const courante = lecon.id === leconCouranteId;

                  return (
                    <li key={lecon.id}>
                      <Link
                        href={`/formations/${formationSlug}/lecons/${lecon.slug}`}
                        aria-current={courante ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-lg transition-colors ${
                          compact ? "px-2 py-1.5 text-sm" : "border-border border p-3"
                        } ${
                          courante
                            ? "bg-brand-subtle text-foreground"
                            : "hover:bg-secondary/60"
                        }`}
                      >
                        <span className="shrink-0" aria-hidden>
                          {termine ? (
                            <Check className="text-success size-4" />
                          ) : courante ? (
                            <PlayCircle className="text-brand-text size-4" />
                          ) : (
                            <Circle className="text-muted-foreground size-4" />
                          )}
                        </span>

                        {!compact ? (
                          <span className="text-muted-foreground w-6 shrink-0 text-xs tabular-nums">
                            {String(numero).padStart(2, "0")}
                          </span>
                        ) : null}

                        <span
                          className={`min-w-0 flex-1 truncate ${
                            termine && !courante ? "text-muted-foreground" : ""
                          }`}
                        >
                          {lecon.titre}
                          {/* L'état est déjà porté par l'icône, mais celle-ci
                              est décorative : ce texte le rend perceptible aux
                              lecteurs d'écran. */}
                          {termine ? (
                            <span className="sr-only"> — terminée</span>
                          ) : null}
                        </span>

                        <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                          {lecon.aUneVideo ? (
                            <Video className="size-3.5" aria-label="Contient une vidéo" />
                          ) : null}
                          {lecon.dureeEstimeeMin ? (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {formaterDuree(lecon.dureeEstimeeMin)}
                            </span>
                          ) : null}
                          {lecon.statut !== "published" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Brouillon
                            </Badge>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
