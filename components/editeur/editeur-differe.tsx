"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Chargement différé de l'éditeur.
 *
 * Tiptap et ProseMirror représentent la plus grosse part du JavaScript de la
 * page d'édition d'une leçon. Chargés avec le reste, ils retardent
 * l'interactivité des champs simples — titre, slug, durée, bouton
 * d'enregistrement — qui n'ont pourtant besoin de rien.
 *
 * En les isolant dans un module chargé à la demande, ces champs répondent
 * immédiatement et l'éditeur arrive juste après, avec un état d'attente à la
 * bonne hauteur pour ne pas décaler la page.
 *
 * `ssr: false` : Tiptap manipule le DOM, un rendu serveur produirait de toute
 * façon une divergence d'hydratation.
 */
export const EditeurTiptap = dynamic(
  () => import("@/components/editeur/editeur-tiptap").then((m) => m.EditeurTiptap),
  {
    ssr: false,
    loading: () => (
      <div className="border-border bg-card flex min-h-[480px] items-center justify-center rounded-xl border">
        <span className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Chargement de l&apos;éditeur…
        </span>
      </div>
    ),
  },
);
