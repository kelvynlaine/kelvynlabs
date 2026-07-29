"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { EtatAction } from "@/lib/actions";

/**
 * Bascule publié / brouillon.
 *
 * Partagé par les formations et les leçons : les deux ont un statut
 * indépendant, et les mêmes règles d'affichage.
 */
export function BoutonPublication({
  estPublie,
  action,
  libellePublier = "Publier",
  libelleDepublier = "Dépublier",
}: {
  estPublie: boolean;
  action: () => Promise<EtatAction>;
  libellePublier?: string;
  libelleDepublier?: string;
}) {
  const [enCours, demarrer] = useTransition();

  function basculer() {
    demarrer(async () => {
      const resultat = await action();
      if (resultat.ok) {
        toast.success(estPublie ? "Dépublié." : "Publié.");
      } else {
        toast.error(resultat.erreur ?? "Opération impossible.");
      }
    });
  }

  return (
    <Button
      variant={estPublie ? "outline" : "default"}
      onClick={basculer}
      disabled={enCours}
    >
      {enCours ? (
        <Loader2 className="size-4 animate-spin" />
      ) : estPublie ? (
        <EyeOff className="size-4" />
      ) : (
        <Eye className="size-4" />
      )}
      {estPublie ? libelleDepublier : libellePublier}
    </Button>
  );
}
