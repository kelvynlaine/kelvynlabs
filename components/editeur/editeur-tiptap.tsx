"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useCallback, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";

import { televerserImage } from "@/components/admin/televerseur-image";
import { extensionsEditeur } from "@/components/editeur/extensions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * Éditeur de contenu des leçons.
 *
 * Le document est maintenu en JSON dans un input caché : le formulaire parent
 * l'envoie comme un champ ordinaire, sans logique de soumission particulière.
 */
export function EditeurTiptap({
  nom,
  contenuInitial,
  leconId,
  formationId,
}: {
  nom: string;
  contenuInitial: unknown;
  leconId: string;
  formationId: string;
}) {
  const [json, setJson] = useState(() =>
    contenuInitial ? JSON.stringify(contenuInitial) : "",
  );

  const editeur = useEditor({
    extensions: extensionsEditeur(),
    content: (contenuInitial as object) ?? "",
    // Rendu différé côté client : Tiptap manipule le DOM, un rendu serveur
    // produirait une divergence d'hydratation.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "contenu-lecon min-h-[420px] w-full px-4 py-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => setJson(JSON.stringify(editor.getJSON())),
  });

  if (!editeur) {
    return (
      <div className="border-border bg-card flex min-h-[480px] items-center justify-center rounded-xl border">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    );
  }

  return (
    // Pas d'`overflow-hidden` ici : il créerait un conteneur de défilement qui
    // enfermerait la barre d'outils sticky à l'intérieur de la carte, au lieu
    // de la laisser se coller sous l'en-tête de la page.
    <div className="border-border bg-card rounded-xl border">
      <input type="hidden" name={nom} value={json} />
      <BarreOutils editeur={editeur} leconId={leconId} formationId={formationId} />
      <EditorContent editor={editeur} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BarreOutils({
  editeur,
  leconId,
  formationId,
}: {
  editeur: Editor;
  leconId: string;
  formationId: string;
}) {
  const champFichier = useRef<HTMLInputElement>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const definirLien = useCallback(() => {
    const actuel = editeur.getAttributes("link").href as string | undefined;
    const saisie = window.prompt("Adresse du lien", actuel ?? "https://");

    if (saisie === null) return; // annulé

    if (saisie === "") {
      editeur.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    // Double barrière avec la liste blanche des extensions : on refuse ici
    // aussi tout protocole exotique (`javascript:`, `data:`…).
    try {
      const url = new URL(saisie);
      if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
        toast.error("Protocole de lien non autorisé.");
        return;
      }
    } catch {
      toast.error("Adresse invalide.");
      return;
    }

    editeur.chain().focus().extendMarkRange("link").setLink({ href: saisie }).run();
  }, [editeur]);

  async function insererImage(fichier: File | undefined) {
    if (!fichier) return;

    setEnvoiEnCours(true);
    try {
      const media = await televerserImage(fichier, { leconId, formationId });

      editeur
        .chain()
        .focus()
        .setImage({
          src: media.url,
          alt: media.nomOriginal ?? "",
          // Les dimensions lues à l'upload sont réinjectées ici : elles
          // permettent au rendu client d'éviter le décalage de mise en page.
          ...(media.largeur && media.hauteur
            ? { width: media.largeur, height: media.hauteur }
            : {}),
        })
        .run();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Envoi échoué");
    } finally {
      setEnvoiEnCours(false);
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  return (
    <div className="border-border bg-card/95 sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b p-1.5 backdrop-blur">
      <Outil
        icone={Bold}
        label="Gras"
        actif={editeur.isActive("bold")}
        onClick={() => editeur.chain().focus().toggleBold().run()}
      />
      <Outil
        icone={Italic}
        label="Italique"
        actif={editeur.isActive("italic")}
        onClick={() => editeur.chain().focus().toggleItalic().run()}
      />
      <Outil
        icone={Strikethrough}
        label="Barré"
        actif={editeur.isActive("strike")}
        onClick={() => editeur.chain().focus().toggleStrike().run()}
      />
      <Outil
        icone={Code}
        label="Code en ligne"
        actif={editeur.isActive("code")}
        onClick={() => editeur.chain().focus().toggleCode().run()}
      />

      <Separateur />

      <Outil
        icone={Heading2}
        label="Titre de section"
        actif={editeur.isActive("heading", { level: 2 })}
        onClick={() => editeur.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <Outil
        icone={Heading3}
        label="Sous-titre"
        actif={editeur.isActive("heading", { level: 3 })}
        onClick={() => editeur.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Separateur />

      <Outil
        icone={List}
        label="Liste à puces"
        actif={editeur.isActive("bulletList")}
        onClick={() => editeur.chain().focus().toggleBulletList().run()}
      />
      <Outil
        icone={ListOrdered}
        label="Liste numérotée"
        actif={editeur.isActive("orderedList")}
        onClick={() => editeur.chain().focus().toggleOrderedList().run()}
      />
      <Outil
        icone={Quote}
        label="Citation"
        actif={editeur.isActive("blockquote")}
        onClick={() => editeur.chain().focus().toggleBlockquote().run()}
      />
      <Outil
        icone={Code}
        label="Bloc de code"
        actif={editeur.isActive("codeBlock")}
        onClick={() => editeur.chain().focus().toggleCodeBlock().run()}
      />
      <Outil
        icone={Minus}
        label="Séparateur"
        onClick={() => editeur.chain().focus().setHorizontalRule().run()}
      />

      <Separateur />

      <Outil
        icone={editeur.isActive("link") ? Link2Off : Link2}
        label={editeur.isActive("link") ? "Modifier le lien" : "Insérer un lien"}
        actif={editeur.isActive("link")}
        onClick={definirLien}
      />
      <Outil
        icone={envoiEnCours ? Loader2 : ImagePlus}
        label="Insérer une image"
        onClick={() => champFichier.current?.click()}
        disabled={envoiEnCours}
        anime={envoiEnCours}
      />

      <div className="ml-auto flex items-center gap-0.5">
        <Outil
          icone={Undo2}
          label="Annuler"
          onClick={() => editeur.chain().focus().undo().run()}
          disabled={!editeur.can().undo()}
        />
        <Outil
          icone={Redo2}
          label="Rétablir"
          onClick={() => editeur.chain().focus().redo().run()}
          disabled={!editeur.can().redo()}
        />
      </div>

      <input
        ref={champFichier}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(evenement) => insererImage(evenement.target.files?.[0])}
      />
    </div>
  );
}

function Separateur() {
  return <Separator orientation="vertical" className="mx-1 !h-5" />;
}

function Outil({
  icone: Icone,
  label,
  actif,
  onClick,
  disabled,
  anime,
}: {
  icone: ComponentType<{ className?: string }>;
  label: string;
  actif?: boolean;
  onClick: () => void;
  disabled?: boolean;
  anime?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`size-8 ${actif ? "bg-brand-subtle text-brand-text" : ""}`}
      aria-label={label}
      aria-pressed={actif}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icone className={`size-4 ${anime ? "animate-spin" : ""}`} />
    </Button>
  );
}
