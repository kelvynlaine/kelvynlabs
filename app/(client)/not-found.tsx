import Link from "next/link";
import { Compass } from "lucide-react";

import { EnteteSite } from "@/components/client/entete-site";
import { Button } from "@/components/ui/button";

/**
 * Page 404 du site public.
 *
 * Affichée aussi bien pour une adresse inexistante que pour une formation non
 * publiée : `checkAccess()` répond « introuvable » plutôt que « non publiée »,
 * pour ne pas révéler qu'un brouillon occupe cette adresse.
 */
export default function Introuvable() {
  return (
    <>
      <EnteteSite />

      <main id="contenu-principal" className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-28 text-center sm:px-6">
        <Compass className="text-brand-text size-10" />
        <h1 className="mt-6 text-4xl">Page introuvable</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Cette adresse ne correspond à aucune formation. Elle a peut-être été
          renommée, ou n&apos;est plus disponible.
        </p>
        <Button className="mt-8" asChild>
          <Link href="/">Voir le catalogue</Link>
        </Button>
      </main>
    </>
  );
}
