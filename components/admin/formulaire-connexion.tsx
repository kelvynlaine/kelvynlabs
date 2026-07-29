"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useActionState } from "react";

import { connexionAdmin, type EtatConnexion } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ETAT_INITIAL: EtatConnexion = {};

export function FormulaireConnexion({ suivant }: { suivant: string }) {
  const [etat, action, enCours] = useActionState(connexionAdmin, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="suivant" value={suivant} />

      <div className="space-y-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="vous@kelvynlabs.fr"
          required
          disabled={enCours}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="motDePasse">Mot de passe</Label>
        <Input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          disabled={enCours}
        />
      </div>

      {etat.erreur ? (
        <p
          role="alert"
          className="text-destructive flex items-start gap-2 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {etat.erreur}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={enCours}>
        {enCours ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </Button>
    </form>
  );
}
