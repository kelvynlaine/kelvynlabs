"use client";

import { Check, Copy, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { supprimerMedia } from "@/app/admin/(protege)/medias/actions";
import { DialogueConfirmation } from "@/components/admin/dialogue-confirmation";
import { televerserImage } from "@/components/admin/televerseur-image";
import { Button } from "@/components/ui/button";

export type MediaListe = {
  id: string;
  url: string;
  nomOriginal: string | null;
  largeur: number | null;
  hauteur: number | null;
  tailleOctets: number | null;
  creeLe: Date;
};

function formaterTaille(octets: number | null): string {
  if (!octets) return "";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BibliothequeMedias({ medias }: { medias: MediaListe[] }) {
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  async function envoyer(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;

    setEnvoiEnCours(true);
    try {
      // Envois séquentiels : en parallèle, plusieurs gros fichiers saturent la
      // liaison montante et l'un d'eux finit par expirer.
      for (const fichier of Array.from(fichiers)) {
        await televerserImage(fichier);
      }
      toast.success(
        fichiers.length > 1 ? `${fichiers.length} images envoyées.` : "Image envoyée.",
      );
      window.location.reload();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Envoi échoué");
    } finally {
      setEnvoiEnCours(false);
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  async function copierUrl(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopie(id);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      toast.error("Copie impossible depuis ce navigateur.");
    }
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => champFichier.current?.click()} disabled={envoiEnCours}>
        {envoiEnCours ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Envoyer des images
      </Button>

      {medias.length === 0 ? (
        <div className="border-border rounded-2xl border border-dashed py-16 text-center">
          <ImageIcon className="text-muted-foreground mx-auto size-8" />
          <p className="mt-4 text-sm font-medium">Bibliothèque vide</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Les images envoyées depuis les formations et les leçons apparaissent
            aussi ici.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {medias.map((media) => (
            <li
              key={media.id}
              className="group bg-card border-border overflow-hidden rounded-xl border"
            >
              <div className="bg-secondary relative aspect-video">
                <Image
                  src={media.url}
                  alt={media.nomOriginal ?? ""}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />

                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-8"
                    aria-label="Copier l'adresse"
                    onClick={() => copierUrl(media.url, media.id)}
                  >
                    {copie === media.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>

                  <DialogueConfirmation
                    declencheur={
                      <Button
                        size="icon"
                        variant="destructive"
                        className="size-8"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    titre="Supprimer cette image ?"
                    description={
                      <>
                        Le fichier sera effacé du disque.{" "}
                        <strong>
                          Si cette image est utilisée dans une leçon, elle y
                          apparaîtra cassée
                        </strong>{" "}
                        — la bibliothèque ne suit pas les usages.
                      </>
                    }
                    action={() => supprimerMedia(media.id)}
                    messageSucces="Image supprimée."
                  />
                </div>
              </div>

              <div className="p-2">
                <p className="truncate text-xs font-medium">
                  {media.nomOriginal ?? "sans nom"}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {media.largeur && media.hauteur
                    ? `${media.largeur}×${media.hauteur} · `
                    : ""}
                  {formaterTaille(media.tailleOctets)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={champFichier}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(evenement) => envoyer(evenement.target.files)}
      />
    </div>
  );
}
