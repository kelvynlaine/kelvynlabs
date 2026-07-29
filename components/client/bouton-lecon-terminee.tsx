"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { basculerProgression } from "@/app/(client)/actions";
import { Button } from "@/components/ui/button";

/**
 * Case « leçon terminée ».
 *
 * L'état bascule immédiatement à l'écran, avant la réponse du serveur : cocher
 * une leçon doit être instantané. En cas d'échec on revient à l'état
 * précédent et on le dit — plutôt que de laisser croire à un enregistrement
 * qui n'a pas eu lieu.
 */
export function BoutonLeconTerminee({
  formationSlug,
  leconSlug,
  termineeInitial,
}: {
  formationSlug: string;
  leconSlug: string;
  termineeInitial: boolean;
}) {
  const [terminee, setTerminee] = useState(termineeInitial);
  const [enCours, demarrer] = useTransition();

  // Le serveur fait autorité : après revalidation, ou en revenant sur la page,
  // l'état affiché doit repartir de la valeur réelle.
  useEffect(() => setTerminee(termineeInitial), [termineeInitial]);

  function basculer() {
    const cible = !terminee;
    setTerminee(cible);

    demarrer(async () => {
      const resultat = await basculerProgression(formationSlug, leconSlug, cible);

      if (!resultat.ok) {
        setTerminee(!cible);
        toast.error(resultat.erreur ?? "Enregistrement impossible.");
      }
    });
  }

  return (
    <Button
      variant={terminee ? "default" : "outline"}
      size="lg"
      onClick={basculer}
      disabled={enCours}
      aria-pressed={terminee}
      className="w-full sm:w-auto"
    >
      {enCours ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <span
          className={`flex size-4 items-center justify-center rounded-full border-2 transition-colors ${
            terminee ? "border-current bg-current/20" : "border-current/40"
          }`}
          aria-hidden
        >
          {terminee ? <Check className="size-3" /> : null}
        </span>
      )}
      {terminee ? "Leçon terminée" : "Marquer comme terminée"}
    </Button>
  );
}
