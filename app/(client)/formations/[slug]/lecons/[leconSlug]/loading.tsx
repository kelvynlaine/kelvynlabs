import { EnteteSite } from "@/components/client/entete-site";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChargementLecon() {
  return (
    <>
      <EnteteSite />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          </aside>

          <main id="contenu-principal" className="min-w-0">
            <Skeleton className="h-12 w-[min(28rem,95%)] sm:h-14" />
            <Skeleton className="mt-4 h-4 w-28" />
            {/* Réserve l'emplacement exact du lecteur vidéo : sans cette
                proportion, l'arrivée de l'iframe décalerait tout le texte. */}
            <Skeleton className="mt-8 aspect-video w-full rounded-xl" />
            <div className="mt-8 max-w-[68ch] space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-full" />
              ))}
              <Skeleton className="h-5 w-2/3" />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
