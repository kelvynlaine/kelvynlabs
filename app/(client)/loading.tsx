import { EnteteSite } from "@/components/client/entete-site";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Écran d'attente du catalogue.
 *
 * Toutes les pages du site sont rendues à la demande (la progression dépend du
 * cookie du visiteur) : sans ce fichier, un démarrage à froid laisse une page
 * blanche pendant plusieurs centaines de millisecondes.
 *
 * Le squelette reprend la géométrie exacte du contenu réel — même hauteur de
 * titre, même grille — pour que l'arrivée du contenu ne provoque aucun saut.
 */
export default function ChargementCatalogue() {
  return (
    <>
      <EnteteSite />

      <main id="contenu-principal" className="mx-auto w-full max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24">
        <Skeleton className="h-14 w-[min(28rem,90%)] sm:h-16" />
        <Skeleton className="mt-6 h-6 w-[min(34rem,100%)]" />
        <Skeleton className="mt-2 h-6 w-[min(22rem,80%)]" />

        <ul
          className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Chargement du catalogue"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <li
              key={index}
              className="border-border overflow-hidden rounded-2xl border"
            >
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-4 h-3 w-28" />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
