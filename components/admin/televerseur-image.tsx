"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export type MediaTeleverse = {
  id: string;
  url: string;
  largeur: number | null;
  hauteur: number | null;
  nomOriginal: string | null;
};

/**
 * Envoi d'une image vers le serveur.
 *
 * L'upload passe par /api/admin/upload, jamais directement vers le stockage :
 * c'est le serveur qui valide le type réel, la taille et la signature binaire
 * du fichier, puis choisit lui-même son nom de destination.
 */
export async function televerserImage(
  fichier: File,
  contexte?: { formationId?: string; leconId?: string },
): Promise<MediaTeleverse> {
  const donnees = new FormData();
  donnees.set("bucket", "medias");
  donnees.set("fichier", fichier);
  if (contexte?.formationId) donnees.set("formationId", contexte.formationId);
  if (contexte?.leconId) donnees.set("leconId", contexte.leconId);

  const reponse = await fetch("/api/admin/upload", {
    method: "POST",
    body: donnees,
  });

  const charge = await reponse.json();
  if (!reponse.ok) throw new Error(charge?.erreur ?? "Envoi échoué");

  return charge.media as MediaTeleverse;
}

/**
 * Champ d'image de couverture.
 *
 * La valeur retenue est l'URL, stockée dans un input caché : le formulaire
 * parent l'enregistre comme n'importe quel autre champ texte.
 */
export function TeleverseurImage({
  nom,
  valeurInitiale,
  formationId,
  label = "Image de couverture",
}: {
  nom: string;
  valeurInitiale: string | null;
  formationId?: string;
  label?: string;
}) {
  const [url, setUrl] = useState(valeurInitiale ?? "");
  const [enCours, setEnCours] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  async function surSelection(fichier: File | undefined) {
    if (!fichier) return;

    setEnCours(true);
    try {
      const media = await televerserImage(fichier, { formationId });
      setUrl(media.url);
      toast.success("Image envoyée.");
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Envoi échoué");
    } finally {
      setEnCours(false);
      // Réinitialiser permet de re-sélectionner le même fichier après un échec.
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input type="hidden" name={nom} value={url} />

      {url ? (
        <div className="group relative overflow-hidden rounded-xl border">
          <div className="bg-secondary relative aspect-video">
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          </div>
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => champFichier.current?.click()}
              disabled={enCours}
            >
              Remplacer
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="size-8"
              aria-label="Retirer l'image"
              onClick={() => setUrl("")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => champFichier.current?.click()}
          disabled={enCours}
          className="border-border hover:border-brand-vivid/50 hover:bg-secondary/40 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
        >
          {enCours ? (
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          ) : (
            <ImagePlus className="text-muted-foreground size-6" />
          )}
          <span className="text-muted-foreground text-sm">
            {enCours ? "Envoi en cours…" : "Choisir une image"}
          </span>
          <span className="text-muted-foreground text-xs">
            JPG, PNG, WebP ou AVIF · 10 Mo maximum
          </span>
        </button>
      )}

      <input
        ref={champFichier}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(evenement) => surSelection(evenement.target.files?.[0])}
      />
    </div>
  );
}
