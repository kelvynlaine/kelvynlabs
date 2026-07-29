import Link from "next/link";
import { Eye, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Bandeau affiché à l'administrateur lorsqu'il consulte du contenu non publié.
 *
 * Il n'y a pas de « page d'aperçu » séparée : l'admin consulte les VRAIES
 * pages du site, et y voit les brouillons parce que checkAccess() lui accorde
 * ce droit. Ce bandeau est donc là pour dissiper l'ambiguïté — sans lui,
 * l'admin pourrait croire qu'un brouillon est déjà en ligne.
 */
export function BandeauApercu({
  lienEdition,
  estBrouillon,
  quoi,
}: {
  lienEdition: string;
  estBrouillon: boolean;
  quoi: "formation" | "leçon";
}) {
  return (
    <div className="border-warning/30 bg-warning/10 mx-auto mb-8 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <p className="flex items-start gap-2 text-sm">
        <Eye className="text-warning mt-0.5 size-4 shrink-0" />
        <span>
          Vous voyez cette page en tant qu&apos;administrateur.
          {estBrouillon ? (
            <span className="text-muted-foreground">
              {" "}
              Cette {quoi} est en <strong>brouillon</strong> : elle
              n&apos;apparaît pas pour les visiteurs.
            </span>
          ) : (
            <span className="text-muted-foreground">
              {" "}
              Elle est publiée et visible de tous.
            </span>
          )}
        </span>
      </p>

      <Button variant="outline" size="sm" asChild>
        <Link href={lienEdition}>
          <PenLine className="size-3.5" />
          Éditer
        </Link>
      </Button>
    </div>
  );
}
