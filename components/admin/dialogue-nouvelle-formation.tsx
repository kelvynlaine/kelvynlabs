"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { creerFormation } from "@/app/admin/(protege)/formations/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETAT_INITIAL } from "@/lib/actions";

/**
 * Création d'une formation.
 *
 * Volontairement minimal : un titre suffit. Le slug est dérivé automatiquement
 * et tout le reste s'édite ensuite dans l'éditeur — demander dix champs avant
 * de pouvoir commencer à écrire décourage plus qu'autre chose.
 */
export function DialogueNouvelleFormation() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState(creerFormation, ETAT_INITIAL);

  // L'action redirige en cas de succès ; on ne referme donc que si elle a
  // échoué et que l'utilisateur corrige.
  useEffect(() => {
    if (etat.ok) setOuvert(false);
  }, [etat.ok]);

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nouvelle formation
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Nouvelle formation</DialogTitle>
            <DialogDescription>
              Donnez-lui un titre pour commencer. Vous pourrez tout ajuster
              ensuite.
            </DialogDescription>
          </DialogHeader>

          <div className="my-6 space-y-2">
            <Label htmlFor="titre">Titre</Label>
            <Input
              id="titre"
              name="titre"
              placeholder="Ex. Créer son entreprise de A à Z"
              required
              maxLength={200}
              autoFocus
              disabled={enCours}
            />
            {etat.erreur ? (
              <p role="alert" className="text-destructive text-sm">
                {etat.erreur}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOuvert(false)}
              disabled={enCours}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={enCours}>
              {enCours ? <Loader2 className="size-4 animate-spin" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
