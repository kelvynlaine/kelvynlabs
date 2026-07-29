import Link from "next/link";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * En-tête du site public.
 *
 * Volontairement dépouillé : une plateforme de formation ne gagne rien à une
 * barre de navigation chargée. Le seul lien est le retour au catalogue.
 */
// `children` et non `enfants` : c'est le nom que React attend pour le contenu
// imbriqué. Le franciser casserait la syntaxe `<EnteteSite>…</EnteteSite>`.
export function EnteteSite({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Kelvynlabs — retour au catalogue">
          <Logo />
        </Link>

        {children}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
