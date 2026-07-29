import { Clock, Download, FileText } from "lucide-react";

import { RenduContenu, contenuEstVide } from "@/components/contenu/rendu-contenu";
import { LecteurVideo } from "@/components/contenu/lecteur-video";
import type { Lecon, Ressource } from "@/lib/db/schema";

/**
 * Corps d'une leçon tel que le visiteur le voit : vidéo, contenu, ressources.
 *
 * Composant PARTAGÉ entre l'aperçu de l'administration et les pages publiques
 * (Phase 3). Il ne contient aucune navigation ni barre latérale : celles-ci
 * relèvent de la page qui l'enveloppe, pas du contenu lui-même.
 */
export function VueLecon({
  lecon,
  ressources,
  cdnBunny,
}: {
  lecon: Lecon;
  ressources: Ressource[];
  cdnBunny?: string;
}) {
  const vide = contenuEstVide(lecon.contenu);

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl leading-tight sm:text-5xl">{lecon.titre}</h1>
        {lecon.dureeEstimeeMin ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Clock className="size-4" />
            {lecon.dureeEstimeeMin} minutes
          </p>
        ) : null}
      </header>

      {lecon.videoUrl && lecon.videoProvider ? (
        <LecteurVideo
          provider={lecon.videoProvider}
          videoUrl={lecon.videoUrl}
          titre={lecon.titre}
          cdnBunny={cdnBunny}
        />
      ) : null}

      {vide ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">
          Cette leçon n&apos;a pas encore de contenu.
        </p>
      ) : (
        <RenduContenu contenu={lecon.contenu} />
      )}

      {ressources.length > 0 ? (
        <section className="border-border max-w-[68ch] border-t pt-8">
          <h2 className="flex items-center gap-2 text-xl">
            <FileText className="text-brand-text size-5" />
            Ressources
          </h2>

          <ul className="mt-4 space-y-2">
            {ressources.map((ressource) => (
              <li key={ressource.id}>
                <a
                  href={`/api/ressources/${ressource.id}`}
                  className="bg-card border-border hover:border-brand-vivid/50 flex items-center gap-3 rounded-xl border p-3 transition-colors"
                >
                  <Download className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {ressource.nomFichier}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs uppercase">
                    {ressource.type}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
