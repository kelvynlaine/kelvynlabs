"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";

import { demanderLien, type EtatDemande } from "@/app/(client)/connexion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function BoutonEnvoyer() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Envoi en cours…" : "Recevoir mon lien de connexion"}
    </Button>
  );
}

export function FormulaireConnexion() {
  const [etat, action] = useActionState<EtatDemande, FormData>(demanderLien, {
    statut: "vierge",
  });

  if (etat.statut === "envoye") {
    return (
      <div
        className="border-border bg-muted/30 rounded-xl border p-6 text-center"
        // Le changement d'état doit être annoncé : sans cela, un lecteur
        // d'écran ne signale rien après l'envoi et l'utilisateur ignore que le
        // formulaire a abouti.
        role="status"
      >
        <MailCheck className="text-primary mx-auto mb-3 size-8" aria-hidden />
        <p className="font-medium">Vérifiez votre boîte mail</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Si un compte existe pour cette adresse, un lien de connexion vient d&apos;y
          être envoyé. Il est valable 20 minutes.
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          Rien reçu au bout de deux minutes ? Pensez à regarder dans les spams.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.fr"
          aria-describedby={etat.statut === "erreur" ? "erreur-connexion" : undefined}
          aria-invalid={etat.statut === "erreur"}
        />
        <p className="text-muted-foreground text-xs">
          Celle utilisée lors de votre achat.
        </p>
      </div>

      {etat.statut === "erreur" && (
        <p id="erreur-connexion" role="alert" className="text-destructive text-sm">
          {etat.message}
        </p>
      )}

      <BoutonEnvoyer />
    </form>
  );
}
