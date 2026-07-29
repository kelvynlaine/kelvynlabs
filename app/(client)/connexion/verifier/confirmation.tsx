"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  confirmerConnexion,
  type EtatVerification,
} from "@/app/(client)/connexion/actions";
import { Button } from "@/components/ui/button";

function BoutonConfirmer() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Connexion…" : "Confirmer ma connexion"}
    </Button>
  );
}

/**
 * Bouton de confirmation du lien de connexion.
 *
 * ⚠️ La connexion se fait sur un POST, jamais sur la simple ouverture du lien.
 * Les passerelles antispam et les générateurs d'aperçu (Outlook/Defender,
 * Slack…) ouvrent les URL contenues dans les emails avant leur destinataire :
 * un jeton à usage unique consommé sur un GET serait grillé par un robot, et
 * le client verrait « lien déjà utilisé » sans avoir rien fait.
 */
export function Confirmation({ jeton }: { jeton: string }) {
  const [etat, action] = useActionState<EtatVerification | null, FormData>(
    confirmerConnexion,
    null,
  );

  if (etat?.statut === "erreur") {
    return (
      <div role="alert" className="space-y-4">
        <p className="text-destructive text-sm">{etat.message}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/connexion">Demander un nouveau lien</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="jeton" value={jeton} />
      <BoutonConfirmer />
    </form>
  );
}
