"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Écran d'erreur de l'administration.
 *
 * Contrairement au site public, on affiche ici le message d'erreur : l'admin
 * est le propriétaire de la plateforme, et savoir « base verrouillée » ou
 * « disque plein » lui évite un aller-retour dans les logs du serveur. En
 * production Next masque de toute façon les messages sensibles derrière un
 * digest.
 */
export default function ErreurAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border-destructive/30 bg-destructive/5 mx-auto max-w-xl rounded-2xl border p-8 text-center">
      <TriangleAlert className="text-destructive mx-auto size-8" />

      <h1 className="mt-5 text-2xl">Cette page n&apos;a pas pu être chargée</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        L&apos;opération a échoué. Si l&apos;erreur se répète, vérifiez que le
        dossier de données est accessible en écriture.
      </p>

      {error.message ? (
        <p className="bg-secondary text-muted-foreground mt-5 rounded-lg px-3 py-2 text-left font-mono text-xs break-all">
          {error.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCw className="size-4" />
          Réessayer
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Tableau de bord</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground mt-6 font-mono text-xs">
          Référence : {error.digest}
        </p>
      ) : null}
    </div>
  );
}
