"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  FileText,
  GripVertical,
  Layers,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  creerChapitre,
  creerLecon,
  majChapitre,
  reordonnerChapitres,
  reordonnerLecons,
  supprimerChapitre,
  supprimerLecon,
} from "@/app/admin/(protege)/formations/[id]/actions";
import { DialogueConfirmation } from "@/components/admin/dialogue-confirmation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LeconArbre = {
  id: string;
  titre: string;
  slug: string;
  statut: "draft" | "published";
  dureeEstimeeMin: number | null;
  aUneVideo: boolean;
};

export type ChapitreArbre = {
  id: string;
  titre: string;
  description: string | null;
  lecons: LeconArbre[];
};

/**
 * Arborescence éditable d'une formation.
 *
 * Un SEUL DndContext gère les deux types d'éléments (chapitres et leçons) :
 * imbriquer deux contextes ne fonctionne pas correctement avec dnd-kit. On
 * distingue donc les deux par le champ `data.type` attaché à chaque élément
 * déplaçable.
 *
 * Une leçon peut être déposée dans un autre chapitre : le déplacement est
 * appliqué localement pendant le survol (`onDragOver`), puis persisté au
 * relâchement.
 */
export function ArborescenceFormation({
  formationId,
  chapitres: chapitresInitiaux,
}: {
  formationId: string;
  chapitres: ChapitreArbre[];
}) {
  const [chapitres, setChapitres] = useState(chapitresInitiaux);
  const [actifId, setActifId] = useState<string | null>(null);
  const [, demarrer] = useTransition();

  // Les données serveur font autorité : après une action (ajout, suppression),
  // le rafraîchissement de la page doit reprendre la main sur l'état local.
  useEffect(() => setChapitres(chapitresInitiaux), [chapitresInitiaux]);

  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const idsChapitres = chapitres.map((c) => c.id);

  function chapitreDeLaLecon(leconId: string): ChapitreArbre | undefined {
    return chapitres.find((c) => c.lecons.some((l) => l.id === leconId));
  }

  function auDebut(evenement: DragStartEvent) {
    setActifId(String(evenement.active.id));
  }

  /** Déplace une leçon d'un chapitre à l'autre pendant le survol. */
  function auSurvol(evenement: DragOverEvent) {
    const { active, over } = evenement;
    if (!over) return;
    if (active.data.current?.type !== "lecon") return;

    const leconId = String(active.id);
    const source = chapitreDeLaLecon(leconId);
    if (!source) return;

    // La cible peut être une autre leçon, ou la zone vide d'un chapitre.
    const cibleId =
      over.data.current?.type === "lecon"
        ? chapitreDeLaLecon(String(over.id))?.id
        : String(over.id).replace(/^zone-/, "");

    if (!cibleId || cibleId === source.id) return;

    setChapitres((precedents) => {
      const lecon = source.lecons.find((l) => l.id === leconId);
      if (!lecon) return precedents;

      return precedents.map((chapitre) => {
        if (chapitre.id === source.id) {
          return { ...chapitre, lecons: chapitre.lecons.filter((l) => l.id !== leconId) };
        }
        if (chapitre.id === cibleId) {
          return { ...chapitre, lecons: [...chapitre.lecons, lecon] };
        }
        return chapitre;
      });
    });
  }

  function auRelachement(evenement: DragEndEvent) {
    const { active, over } = evenement;
    setActifId(null);
    if (!over) return;

    /* --- Chapitre déplacé --------------------------------------------- */
    if (active.data.current?.type === "chapitre") {
      const depuis = idsChapitres.indexOf(String(active.id));
      const vers = idsChapitres.indexOf(String(over.id));
      if (depuis === -1 || vers === -1 || depuis === vers) return;

      const reordonnes = arrayMove(chapitres, depuis, vers);
      setChapitres(reordonnes);

      demarrer(async () => {
        const resultat = await reordonnerChapitres(
          formationId,
          reordonnes.map((c) => c.id),
        );
        if (!resultat.ok) toast.error(resultat.erreur ?? "Réordonnancement échoué.");
      });
      return;
    }

    /* --- Leçon déplacée ------------------------------------------------ */
    if (active.data.current?.type === "lecon") {
      const chapitre = chapitreDeLaLecon(String(active.id));
      if (!chapitre) return;

      let finaux = chapitres;

      // Réordonnancement à l'intérieur d'un même chapitre.
      if (over.data.current?.type === "lecon") {
        const ids = chapitre.lecons.map((l) => l.id);
        const depuis = ids.indexOf(String(active.id));
        const vers = ids.indexOf(String(over.id));

        if (depuis !== -1 && vers !== -1 && depuis !== vers) {
          finaux = chapitres.map((c) =>
            c.id === chapitre.id
              ? { ...c, lecons: arrayMove(c.lecons, depuis, vers) }
              : c,
          );
          setChapitres(finaux);
        }
      }

      // On persiste l'état COMPLET de l'arborescence plutôt qu'un delta :
      // l'affichage et la base ne peuvent alors pas diverger.
      demarrer(async () => {
        const resultat = await reordonnerLecons(
          formationId,
          finaux.map((c) => ({
            chapitreId: c.id,
            leconIds: c.lecons.map((l) => l.id),
          })),
        );
        if (!resultat.ok) toast.error(resultat.erreur ?? "Déplacement échoué.");
      });
    }
  }

  function ajouterChapitre() {
    demarrer(async () => {
      const resultat = await creerChapitre(formationId);
      if (!resultat.ok) toast.error(resultat.erreur ?? "Ajout impossible.");
    });
  }

  const leconActive = actifId
    ? chapitres.flatMap((c) => c.lecons).find((l) => l.id === actifId)
    : null;

  return (
    <div className="space-y-4">
      <DndContext
        /* `id` explicite : sans lui, dnd-kit numérote ses contextes avec un
           compteur incrémental qui ne coïncide pas entre le rendu serveur et
           le rendu client, ce qui produit une erreur d'hydratation React sur
           l'attribut aria-describedby. */
        id="arborescence-formation"
        sensors={capteurs}
        collisionDetection={pointerWithin}
        onDragStart={auDebut}
        onDragOver={auSurvol}
        onDragEnd={auRelachement}
      >
        <SortableContext items={idsChapitres} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {chapitres.map((chapitre) => (
              <CarteChapitre
                key={chapitre.id}
                formationId={formationId}
                chapitre={chapitre}
              />
            ))}
          </div>
        </SortableContext>

        {/* Aperçu suivant le curseur : sans lui, l'élément déplacé disparaît
            visuellement dès qu'il quitte son conteneur d'origine. */}
        <DragOverlay>
          {leconActive ? (
            <div className="bg-card border-brand-vivid/50 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-2xl">
              <FileText className="text-brand-text size-4" />
              <span className="text-sm font-medium">{leconActive.titre}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {chapitres.length === 0 ? (
        <div className="border-border rounded-2xl border border-dashed py-16 text-center">
          <Layers className="text-muted-foreground mx-auto size-8" />
          <p className="mt-4 text-sm font-medium">Aucun chapitre</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Structurez votre formation en chapitres, puis en leçons.
          </p>
        </div>
      ) : null}

      <Button variant="outline" className="w-full" onClick={ajouterChapitre}>
        <Plus className="size-4" />
        Ajouter un chapitre
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CarteChapitre({
  formationId,
  chapitre,
}: {
  formationId: string;
  chapitre: ChapitreArbre;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapitre.id, data: { type: "chapitre" } });

  // Zone de dépôt propre au chapitre : c'est elle qui permet de déposer une
  // leçon dans un chapitre encore vide.
  const { setNodeRef: refZone, isOver } = useDroppable({
    id: `zone-${chapitre.id}`,
    data: { type: "zone" },
  });

  const [, demarrer] = useTransition();

  function ajouterLecon() {
    demarrer(async () => {
      const resultat = await creerLecon(chapitre.id);
      if (!resultat.ok) toast.error(resultat.erreur ?? "Ajout impossible.");
    });
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-card border-border rounded-2xl border ${
        isDragging ? "z-10 opacity-90 shadow-2xl" : ""
      }`}
    >
      <header className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none rounded p-1 active:cursor-grabbing"
          aria-label={`Réordonner le chapitre ${chapitre.titre}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <TitreChapitreEditable chapitre={chapitre} />

        <Badge variant="secondary" className="shrink-0">
          {chapitre.lecons.length} leçon{chapitre.lecons.length > 1 ? "s" : ""}
        </Badge>

        <DialogueConfirmation
          declencheur={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Supprimer le chapitre ${chapitre.titre}`}
            >
              <Trash2 className="text-muted-foreground size-4" />
            </Button>
          }
          titre={`Supprimer « ${chapitre.titre} » ?`}
          description={
            <>
              Le chapitre et ses {chapitre.lecons.length} leçon
              {chapitre.lecons.length > 1 ? "s" : ""} seront{" "}
              <strong>définitivement supprimés</strong>, ainsi que les fichiers
              qui y sont attachés.
            </>
          }
          action={() => supprimerChapitre(chapitre.id)}
          messageSucces="Chapitre supprimé."
        />
      </header>

      <div
        ref={refZone}
        className={`border-border mx-3 mb-3 rounded-xl border border-dashed p-2 transition-colors ${
          isOver ? "border-brand-vivid bg-brand-subtle/30" : ""
        } ${chapitre.lecons.length === 0 ? "py-6" : ""}`}
      >
        <SortableContext
          items={chapitre.lecons.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">
            {chapitre.lecons.map((lecon) => (
              <LigneLecon key={lecon.id} formationId={formationId} lecon={lecon} />
            ))}
          </ul>
        </SortableContext>

        {chapitre.lecons.length === 0 ? (
          <p className="text-muted-foreground text-center text-xs">
            Glissez une leçon ici, ou ajoutez-en une.
          </p>
        ) : null}

        <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={ajouterLecon}>
          <Plus className="size-3.5" />
          Ajouter une leçon
        </Button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/** Titre de chapitre modifiable sur place, enregistré à la perte de focus. */
function TitreChapitreEditable({ chapitre }: { chapitre: ChapitreArbre }) {
  const [titre, setTitre] = useState(chapitre.titre);
  const [, demarrer] = useTransition();

  useEffect(() => setTitre(chapitre.titre), [chapitre.titre]);

  function enregistrer() {
    const nettoye = titre.trim();

    if (!nettoye) {
      setTitre(chapitre.titre); // champ vidé par accident : on restaure
      return;
    }
    if (nettoye === chapitre.titre) return;

    demarrer(async () => {
      const donnees = new FormData();
      donnees.set("id", chapitre.id);
      donnees.set("titre", nettoye);
      if (chapitre.description) donnees.set("description", chapitre.description);

      const resultat = await majChapitre({}, donnees);
      if (!resultat.ok) {
        toast.error(resultat.erreur ?? "Enregistrement échoué.");
        setTitre(chapitre.titre);
      }
    });
  }

  return (
    <Input
      value={titre}
      onChange={(evenement) => setTitre(evenement.target.value)}
      onBlur={enregistrer}
      onKeyDown={(evenement) => {
        if (evenement.key === "Enter") evenement.currentTarget.blur();
        if (evenement.key === "Escape") {
          setTitre(chapitre.titre);
          evenement.currentTarget.blur();
        }
      }}
      aria-label="Titre du chapitre"
      maxLength={200}
      className="h-8 flex-1 border-transparent bg-transparent px-2 font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
    />
  );
}

/* -------------------------------------------------------------------------- */

function LigneLecon({
  formationId,
  lecon,
}: {
  formationId: string;
  lecon: LeconArbre;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lecon.id, data: { type: "lecon" } });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-background hover:border-brand-vivid/40 border-border group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none rounded p-1 active:cursor-grabbing"
        aria-label={`Réordonner ${lecon.titre}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      <Link
        href={`/admin/formations/${formationId}/lecons/${lecon.id}`}
        className="min-w-0 flex-1 truncate py-0.5 text-sm"
      >
        {lecon.titre}
      </Link>

      <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
        {lecon.aUneVideo ? <Video className="size-3.5" /> : null}
        {lecon.dureeEstimeeMin ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {lecon.dureeEstimeeMin} min
          </span>
        ) : null}
      </div>

      <Badge
        variant={lecon.statut === "published" ? "default" : "secondary"}
        className="shrink-0 text-[10px]"
      >
        {lecon.statut === "published" ? "Publiée" : "Brouillon"}
      </Badge>

      <DialogueConfirmation
        declencheur={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={`Supprimer ${lecon.titre}`}
          >
            <Trash2 className="text-muted-foreground size-3.5" />
          </Button>
        }
        titre={`Supprimer « ${lecon.titre} » ?`}
        description="La leçon, son contenu et ses ressources téléchargeables seront définitivement supprimés."
        action={() => supprimerLecon(lecon.id)}
        messageSucces="Leçon supprimée."
      />
    </li>
  );
}
