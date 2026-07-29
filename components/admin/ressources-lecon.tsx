"use client";

import {
  Download,
  FileArchive,
  FileImage,
  FileText,
  FileType,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import { useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";

import { supprimerRessource } from "@/app/admin/(protege)/formations/[id]/actions";
import { DialogueConfirmation } from "@/components/admin/dialogue-confirmation";
import { Button } from "@/components/ui/button";
import type { Ressource } from "@/lib/db/schema";

const ICONES: Record<string, ComponentType<{ className?: string }>> = {
  pdf: FileText,
  doc: FileType,
  image: FileImage,
  archive: FileArchive,
  autre: Paperclip,
};

function formaterTaille(octets: number | null): string {
  if (!octets) return "";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Fichiers téléchargeables attachés à une leçon.
 *
 * Le lien de téléchargement pointe vers /api/ressources/[id], qui applique
 * checkAccess() — y compris ici, dans l'admin. C'est volontaire : une seule
 * route, une seule règle.
 */
export function RessourcesLecon({
  leconId,
  ressources,
}: {
  leconId: string;
  ressources: Ressource[];
}) {
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  async function envoyer(fichier: File | undefined) {
    if (!fichier) return;

    setEnvoiEnCours(true);
    try {
      const donnees = new FormData();
      donnees.set("bucket", "ressources");
      donnees.set("fichier", fichier);
      donnees.set("leconId", leconId);

      const reponse = await fetch("/api/admin/upload", {
        method: "POST",
        body: donnees,
      });
      const charge = await reponse.json();

      if (!reponse.ok) throw new Error(charge?.erreur ?? "Envoi échoué");

      toast.success("Ressource ajoutée.");
      // La liste vient du serveur : on recharge pour la voir apparaître.
      window.location.reload();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Envoi échoué");
    } finally {
      setEnvoiEnCours(false);
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Ressources téléchargeables</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => champFichier.current?.click()}
          disabled={envoiEnCours}
        >
          {envoiEnCours ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
          Ajouter un fichier
        </Button>
      </div>

      {ressources.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">
          Aucune ressource. PDF, documents, archives — 100 Mo maximum par fichier.
        </p>
      ) : (
        <ul className="space-y-2">
          {ressources.map((ressource) => {
            const Icone = ICONES[ressource.type] ?? Paperclip;

            return (
              <li
                key={ressource.id}
                className="bg-card border-border flex items-center gap-3 rounded-xl border p-3"
              >
                <Icone className="text-brand-text size-4 shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {ressource.nomFichier}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formaterTaille(ressource.tailleOctets)}
                  </p>
                </div>

                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={`/api/ressources/${ressource.id}`}
                    aria-label={`Télécharger ${ressource.nomFichier}`}
                  >
                    <Download className="size-4" />
                  </a>
                </Button>

                <DialogueConfirmation
                  declencheur={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${ressource.nomFichier}`}
                    >
                      <Trash2 className="text-muted-foreground size-4" />
                    </Button>
                  }
                  titre="Supprimer cette ressource ?"
                  description={
                    <>
                      <strong>{ressource.nomFichier}</strong> sera supprimé de la
                      leçon et effacé du disque.
                    </>
                  }
                  action={() => supprimerRessource(ressource.id)}
                  messageSucces="Ressource supprimée."
                />
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={champFichier}
        type="file"
        className="sr-only"
        onChange={(evenement) => envoyer(evenement.target.files?.[0])}
      />
    </section>
  );
}
