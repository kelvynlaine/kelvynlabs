"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Écran d'erreur du site public.
 *
 * ⚠️ On n'affiche JAMAIS `error.message` : en production, Next remplace les
 * messages d'erreur serveur par un identifiant précisément pour ne pas
 * divulguer de détail d'implémentation. Réafficher le message annulerait cette
 * protection en développement, et n'apporterait rien au visiteur.
 *
 * Le `digest` est affiché en revanche : c'est un identifiant opaque qui permet
 * de retrouver l'erreur correspondante dans les logs du serveur.
 */
export default function ErreurClient({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Trace côté navigateur, utile en développement. En production, l'erreur
    // complète est déjà journalisée côté serveur.
    console.error(error);
  }, [error]);

  return (
    <main id="contenu-principal" className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-28 text-center sm:px-6">
      <TriangleAlert className="text-warning size-10" />

      <h1 className="mt-6 text-4xl">Une erreur est survenue</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        Cette page n&apos;a pas pu être affichée. Réessayez dans un instant — si
        le problème persiste, il vient de notre côté.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCw className="size-4" />
          Réessayer
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Retour au catalogue</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground mt-8 font-mono text-xs">
          Référence : {error.digest}
        </p>
      ) : null}
    </main>
  );
}
