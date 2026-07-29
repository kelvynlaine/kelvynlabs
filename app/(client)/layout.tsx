import { PiedDePage } from "@/components/client/pied-de-page";

/**
 * Coquille du site public.
 *
 * L'en-tête n'est pas ici mais dans chaque page : le lecteur de leçon a besoin
 * d'un en-tête différent (titre de la formation, progression, accès au
 * sommaire sur mobile). Un en-tête unique imposerait des exceptions.
 */
export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      <PiedDePage />
    </div>
  );
}
