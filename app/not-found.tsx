import Link from "next/link";
import { Compass } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

/**
 * 404 de dernier recours, pour les adresses qui ne tombent dans aucun segment
 * (donc hors du site public, qui a sa propre page dans `app/(client)/`).
 */
export default function Introuvable() {
  return (
    <main id="contenu-principal" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <Compass className="text-brand-text mt-10 size-9" />
      <h1 className="mt-6 text-4xl">Page introuvable</h1>
      <p className="text-muted-foreground mt-3 max-w-sm leading-relaxed">
        Cette adresse ne correspond à aucune page de la plateforme.
      </p>
      <Button className="mt-8" asChild>
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
