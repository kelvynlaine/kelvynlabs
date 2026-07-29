"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { majLecon } from "@/app/admin/(protege)/formations/[id]/actions";
import { EditeurTiptap } from "@/components/editeur/editeur-tiptap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETAT_INITIAL } from "@/lib/actions";
import type { Lecon, ProviderVideo } from "@/lib/db/schema";
import { slugifier } from "@/lib/slug";

const AIDE_VIDEO: Record<ProviderVideo, string> = {
  youtube:
    "Collez l'URL de la vidéo (watch, youtu.be, embed ou Shorts) ou son identifiant.",
  bunny: "Collez le GUID de la vidéo, visible dans votre Stream Library Bunny.",
};

export function FormulaireLecon({
  lecon,
  formationId,
  providerParDefaut,
}: {
  lecon: Lecon;
  formationId: string;
  providerParDefaut: ProviderVideo;
}) {
  const [etat, action, enCours] = useActionState(majLecon, ETAT_INITIAL);
  const [slug, setSlug] = useState(lecon.slug);
  const [slugTouche, setSlugTouche] = useState(false);
  const [provider, setProvider] = useState<ProviderVideo | "">(
    lecon.videoProvider ?? "",
  );

  useEffect(() => {
    if (etat.ok) toast.success("Leçon enregistrée.");
    else if (etat.erreur) toast.error(etat.erreur);
  }, [etat]);

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="id" value={lecon.id} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre de la leçon</Label>
            <Input
              id="titre"
              name="titre"
              defaultValue={lecon.titre}
              required
              maxLength={200}
              onChange={(evenement) => {
                if (!slugTouche) setSlug(slugifier(evenement.target.value));
              }}
            />
            {etat.champs?.titre ? (
              <p className="text-destructive text-sm">{etat.champs.titre}</p>
            ) : null}
          </div>

          <EditeurTiptap
            nom="contenu"
            contenuInitial={lecon.contenu}
            leconId={lecon.id}
            formationId={formationId}
          />
        </div>

        <aside className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="slug">Adresse</Label>
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
              className="font-mono text-sm"
            />
            {etat.champs?.slug ? (
              <p className="text-destructive text-sm">{etat.champs.slug}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dureeEstimeeMin">Durée estimée</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dureeEstimeeMin"
                name="dureeEstimeeMin"
                defaultValue={lecon.dureeEstimeeMin ?? ""}
                inputMode="numeric"
                placeholder="12"
              />
              <span className="text-muted-foreground text-sm">min</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoProvider">Vidéo</Label>
            <select
              id="videoProvider"
              name="videoProvider"
              value={provider}
              onChange={(evenement) =>
                setProvider(evenement.target.value as ProviderVideo | "")
              }
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Aucune vidéo</option>
              <option value="youtube">YouTube (non répertoriée)</option>
              <option value="bunny">Bunny.net Stream</option>
            </select>

            {provider ? (
              <>
                <Input
                  name="videoUrl"
                  defaultValue={lecon.videoUrl ?? ""}
                  placeholder={
                    provider === "youtube"
                      ? "https://youtu.be/xxxxxxxxxxx"
                      : "GUID Bunny"
                  }
                  maxLength={500}
                  className="mt-2"
                />
                <p className="text-muted-foreground text-xs">{AIDE_VIDEO[provider]}</p>
                {etat.champs?.videoUrl ? (
                  <p className="text-destructive text-sm">{etat.champs.videoUrl}</p>
                ) : null}
              </>
            ) : (
              // Le champ reste présent mais vide : sans lui, retirer une vidéo
              // n'enverrait aucune valeur et l'ancienne resterait en base.
              <input type="hidden" name="videoUrl" value="" />
            )}
          </div>

          {provider === "youtube" ? (
            <p className="border-warning/30 bg-warning/10 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
              Une vidéo « non répertoriée » reste accessible à qui connaît son
              URL. Suffisant pour du contenu gratuit, mais à remplacer par Bunny
              le jour où cette formation devient payante.
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={enCours}>
            {enCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Enregistrer
          </Button>

          {providerParDefaut === "bunny" && !provider ? (
            <p className="text-muted-foreground text-xs">
              Provider par défaut configuré : Bunny.
            </p>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
