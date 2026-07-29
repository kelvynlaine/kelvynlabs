import { EnteteSite } from "@/components/client/entete-site";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChargementFormation() {
  return (
    <>
      <EnteteSite />

      <main id="contenu-principal" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
          <div className="min-w-0 lg:order-1">
            <Skeleton className="h-12 w-[min(30rem,95%)] sm:h-14" />
            <Skeleton className="mt-4 h-6 w-[min(26rem,100%)]" />
            <Skeleton className="mt-6 h-4 w-56" />

            <div className="mt-12 space-y-3 border-t pt-10">
              <Skeleton className="h-8 w-40" />
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>

          <aside className="order-first lg:order-2">
            <div className="border-border overflow-hidden rounded-2xl border">
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="space-y-4 p-5">
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
