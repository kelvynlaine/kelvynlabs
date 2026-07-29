"use client";

import { Clock, CreditCard, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { creerSessionPaiement } from "@/app/(client)/formations/[slug]/acheter/actions";
import { Button } from "@/components/ui/button";

export function BoutonAchat({
  slug,
  paiementActif,
  dejaConnecte,
}: {
  slug: string;
  paiementActif: boolean;
  dejaConnecte: boolean;
}) {
  const [enCours, demarrer] = useTransition();

  /* --- Stripe pas encore branché : on le dit franchement ------------------ */
  if (!paiementActif) {
    return (
      <div className="space-y-2">
        <Button size="lg" className="w-full" disabled>
          <Clock className="size-4" />
          Achat à venir
        </Button>
        <p className="text-muted-foreground text-xs">
          Le paiement en ligne n&apos;est pas encore ouvert pour cette
          formation. Revenez bientôt.
        </p>
      </div>
    );
  }

  function acheter() {
    demarrer(async () => {
      // En cas de succès, l'action redirige vers Stripe : rien ne revient ici.
      const resultat = await creerSessionPaiement(slug);
      if (resultat && !resultat.ok) {
        toast.error(resultat.erreur ?? "Impossible d'ouvrir le paiement.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" onClick={acheter} disabled={enCours}>
        {enCours ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CreditCard className="size-4" />
        )}
        Acheter cette formation
      </Button>

      {dejaConnecte ? (
        <p className="text-muted-foreground text-xs">
          Vous êtes déjà identifié sur cet appareil, mais cette formation
          n&apos;est pas incluse dans vos achats.
        </p>
      ) : null}
    </div>
  );
}
