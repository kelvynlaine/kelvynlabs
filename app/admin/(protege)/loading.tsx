import { Skeleton } from "@/components/ui/skeleton";

/**
 * Attente commune à l'espace d'administration.
 *
 * Toutes ses pages sont `force-dynamic` et interrogent la base : ce squelette
 * évite l'impression de clic sans effet au changement de section.
 */
export default function ChargementAdmin() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
