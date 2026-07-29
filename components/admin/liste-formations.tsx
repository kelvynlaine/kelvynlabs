"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  basculerPublicationFormation,
  dupliquerFormation,
  reordonnerFormations,
  supprimerFormation,
} from "@/app/admin/(protege)/formations/actions";
import { DialogueConfirmation } from "@/components/admin/dialogue-confirmation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Formation } from "@/lib/db/schema";

type FormationListee = Formation & { nbLecons: number; nbLeconsPubliees: number };

export function ListeFormations({ formations }: { formations: FormationListee[] }) {
  // `useOptimistic` fait suivre l'affichage immédiatement au glisser-déposer,
  // sans attendre l'aller-retour serveur : sans lui, la ligne « saute » à sa
  // position d'origine pendant quelques centaines de millisecondes.
  const [ordreOptimiste, setOrdreOptimiste] = useOptimistic(formations);
  const [, demarrer] = useTransition();

  const capteurs = useSensors(
    // Un seuil de 8 px évite qu'un simple clic sur le menu soit interprété
    // comme le début d'un glissement.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function auRelachement(evenement: DragEndEvent) {
    const { active, over } = evenement;
    if (!over || active.id === over.id) return;

    const depuis = ordreOptimiste.findIndex((f) => f.id === active.id);
    const vers = ordreOptimiste.findIndex((f) => f.id === over.id);
    if (depuis === -1 || vers === -1) return;

    const reordonne = arrayMove(ordreOptimiste, depuis, vers);

    demarrer(async () => {
      setOrdreOptimiste(reordonne);
      const resultat = await reordonnerFormations(reordonne.map((f) => f.id));
      if (!resultat.ok) toast.error(resultat.erreur ?? "Réordonnancement échoué.");
    });
  }

  if (formations.length === 0) {
    return (
      <div className="border-border rounded-2xl border border-dashed py-16 text-center">
        <FileText className="text-muted-foreground mx-auto size-8" />
        <p className="mt-4 text-sm font-medium">Aucune formation</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Créez votre première formation pour commencer.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      // Identifiant stable : évite une erreur d'hydratation sur les attributs
      // d'accessibilité générés par dnd-kit (cf. arborescence-formation.tsx).
      id="liste-formations"
      sensors={capteurs}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={auRelachement}
    >
      <SortableContext
        items={ordreOptimiste.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {ordreOptimiste.map((formation) => (
            <LigneFormation key={formation.id} formation={formation} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function LigneFormation({ formation }: { formation: FormationListee }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: formation.id });
  const [enCours, demarrer] = useTransition();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const estPubliee = formation.statut === "published";

  function basculer() {
    demarrer(async () => {
      const resultat = await basculerPublicationFormation(formation.id);
      if (resultat.ok) {
        toast.success(estPubliee ? "Formation dépubliée." : "Formation publiée.");
      } else {
        toast.error(resultat.erreur ?? "Opération impossible.");
      }
    });
  }

  function dupliquer() {
    demarrer(async () => {
      const resultat = await dupliquerFormation(formation.id);
      if (!resultat.ok) toast.error(resultat.erreur ?? "Duplication impossible.");
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-card border-border hover:border-brand-vivid/40 flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        isDragging ? "z-10 opacity-90 shadow-2xl" : ""
      } ${enCours ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none rounded p-1 active:cursor-grabbing"
        aria-label={`Réordonner ${formation.titre}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <Link
        href={`/admin/formations/${formation.id}`}
        className="min-w-0 flex-1 py-1"
      >
        <p className="truncate font-medium">{formation.titre}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          /{formation.slug} · {formation.nbLecons} leçon
          {formation.nbLecons > 1 ? "s" : ""}
          {formation.nbLecons > 0
            ? ` (${formation.nbLeconsPubliees} publiée${formation.nbLeconsPubliees > 1 ? "s" : ""})`
            : ""}
        </p>
      </Link>

      <Badge variant={estPubliee ? "default" : "secondary"} className="shrink-0">
        {estPubliee ? "Publiée" : "Brouillon"}
      </Badge>

      <DropdownMenu open={menuOuvert} onOpenChange={setMenuOuvert}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/formations/${formation.id}`}>
              <Pencil className="size-4" />
              Éditer
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={basculer}>
            {estPubliee ? (
              <>
                <EyeOff className="size-4" />
                Dépublier
              </>
            ) : (
              <>
                <Eye className="size-4" />
                Publier
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={dupliquer}>
            <Copy className="size-4" />
            Dupliquer
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DialogueConfirmation
            declencheur={
              <DropdownMenuItem
                variant="destructive"
                onSelect={(evenement) => evenement.preventDefault()}
              >
                <Trash2 className="size-4" />
                Supprimer
              </DropdownMenuItem>
            }
            titre={`Supprimer « ${formation.titre} » ?`}
            description={
              <>
                Cette formation, ses {formation.nbLecons} leçon
                {formation.nbLecons > 1 ? "s" : ""}, ses chapitres et tous les
                fichiers associés seront <strong>définitivement supprimés</strong>.
                Cette action est irréversible.
              </>
            }
            action={() => supprimerFormation(formation.id)}
            messageSucces="Formation supprimée."
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
