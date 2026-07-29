"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { majFormation } from "@/app/admin/(protege)/formations/actions";
import { TeleverseurImage } from "@/components/admin/televerseur-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ETAT_INITIAL } from "@/lib/actions";
import type { Formation } from "@/lib/db/schema";
import { slugifier } from "@/lib/slug";

export function FormulaireFormation({ formation }: { formation: Formation }) {
  const [etat, action, enCours] = useActionState(majFormation, ETAT_INITIAL);
  const [slug, setSlug] = useState(formation.slug);
  const [slugTouche, setSlugTouche] = useState(false);

  useEffect(() => {
    if (etat.ok) toast.success("Formation enregistrée.");
    else if (etat.erreur) toast.error(etat.erreur);
  }, [etat]);

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="id" value={formation.id} />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="titre">Titre</Label>
          <Input
            id="titre"
            name="titre"
            defaultValue={formation.titre}
            required
            maxLength={200}
            onChange={(evenement) => {
              // Le slug suit le titre tant que l'utilisateur ne l'a pas édité
              // lui-même : modifier l'URL d'une formation déjà publiée casserait
              // les liens existants, ce doit être un geste délibéré.
              if (!slugTouche) setSlug(slugifier(evenement.target.value));
            }}
          />
          {etat.champs?.titre ? (
            <p className="text-destructive text-sm">{etat.champs.titre}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Adresse de la page</Label>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground shrink-0 font-mono text-sm">
              /formations/
            </span>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(evenement) => {
                setSlugTouche(true);
                setSlug(evenement.target.value);
              }}
              required
              maxLength={80}
              className="font-mono"
            />
          </div>
          {etat.champs?.slug ? (
            <p className="text-destructive text-sm">{etat.champs.slug}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Minuscules, chiffres et tirets uniquement.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="descriptionCourte">Résumé</Label>
          <Textarea
            id="descriptionCourte"
            name="descriptionCourte"
            defaultValue={formation.descriptionCourte ?? ""}
            maxLength={280}
            rows={2}
            placeholder="Une phrase affichée sur la carte du catalogue."
          />
          {etat.champs?.descriptionCourte ? (
            <p className="text-destructive text-sm">{etat.champs.descriptionCourte}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description complète</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={formation.description ?? ""}
            maxLength={5000}
            rows={8}
            placeholder="À qui s'adresse cette formation, ce qu'on y apprend, les prérequis…"
          />
        </div>
      </div>

      <aside className="space-y-6">
        <TeleverseurImage
          nom="imageCouverture"
          valeurInitiale={formation.imageCouverture}
          formationId={formation.id}
        />

        <div className="space-y-2">
          <Label htmlFor="prixEuros">Prix</Label>
          <div className="flex items-center gap-2">
            <Input
              id="prixEuros"
              name="prixEuros"
              defaultValue={
                formation.prixCents ? (formation.prixCents / 100).toFixed(2) : ""
              }
              inputMode="decimal"
              placeholder="0"
            />
            <span className="text-muted-foreground text-sm">€</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Laissez vide pour une formation gratuite. Le paiement n&apos;est pas
            encore branché — ce champ est enregistré pour la future intégration
            Stripe.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={enCours}>
          {enCours ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Enregistrer
        </Button>
      </aside>
    </form>
  );
}
