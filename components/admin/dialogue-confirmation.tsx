"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EtatAction } from "@/lib/actions";

/**
 * Confirmation avant une action destructrice.
 *
 * Rendu obligatoire pour toute suppression : les suppressions en cascade de ce
 * projet emportent chapitres, leçons ET fichiers sur disque. Aucune corbeille,
 * aucun retour arrière — un clic malencontreux doit demander une confirmation.
 */
export function DialogueConfirmation({
  declencheur,
  titre,
  description,
  libelleConfirmation = "Supprimer",
  action,
  messageSucces,
}: {
  declencheur: ReactNode;
  titre: string;
  description: ReactNode;
  libelleConfirmation?: string;
  action: () => Promise<EtatAction>;
  messageSucces?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();

  function confirmer() {
    demarrer(async () => {
      const resultat = await action();

      if (resultat.ok) {
        if (messageSucces) toast.success(messageSucces);
        setOuvert(false);
      } else {
        toast.error(resultat.erreur ?? "L'opération a échoué.");
      }
    });
  }

  return (
    <>
      <span onClick={() => setOuvert(true)}>{declencheur}</span>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground text-sm">{description}</div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setOuvert(false)}
              disabled={enCours}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmer} disabled={enCours}>
              {enCours ? <Loader2 className="size-4 animate-spin" /> : null}
              {libelleConfirmation}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
