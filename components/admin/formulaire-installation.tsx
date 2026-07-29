"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useActionState } from "react";

import { creerPremierAdmin } from "@/app/admin/installation/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETAT_INITIAL } from "@/lib/actions";

export function FormulaireInstallation() {
  const [etat, action, enCours] = useActionState(creerPremierAdmin, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="vous@exemple.fr"
          required
          autoFocus
          disabled={enCours}
        />
        {etat.champs?.email ? (
          <p className="text-destructive text-sm">{etat.champs.email}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="motDePasse">Mot de passe</Label>
        <Input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          disabled={enCours}
        />
        <p className="text-muted-foreground text-xs">
          12 caractères minimum. C&apos;est le seul rempart devant votre espace
          d&apos;administration.
        </p>
        {etat.champs?.motDePasse ? (
          <p className="text-destructive text-sm">{etat.champs.motDePasse}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          disabled={enCours}
        />
        {etat.champs?.confirmation ? (
          <p className="text-destructive text-sm">{etat.champs.confirmation}</p>
        ) : null}
      </div>

      {etat.erreur && !etat.champs ? (
        <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {etat.erreur}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={enCours}>
        {enCours ? <Loader2 className="size-4 animate-spin" /> : null}
        Créer le compte
      </Button>
    </form>
  );
}
