import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Rendu d'un document Tiptap.
 *
 * ⚠️ Choix délibéré : on parcourt le JSON et on construit des éléments React,
 * plutôt que d'appeler `generateHTML()` puis `dangerouslySetInnerHTML`.
 *
 * Pourquoi : `dangerouslySetInnerHTML` injecte du balisage brut dans la page.
 * Si un document contenait un jour du HTML inattendu — contenu importé, base
 * restaurée depuis une sauvegarde altérée, régression d'une future extension —
 * il serait exécuté tel quel. Ici, seuls les types de nœuds explicitement
 * listés ci-dessous produisent quelque chose ; tout le reste est ignoré. La
 * page ne peut pas rendre ce que ce fichier ne sait pas construire.
 *
 * Corollaire : ajouter une extension à l'éditeur suppose d'ajouter son nœud
 * ici, sinon son contenu ne s'affichera pas.
 */

type Marque = { type: string; attrs?: Record<string, unknown> };

type Noeud = {
  type?: string;
  text?: string;
  content?: Noeud[];
  marks?: Marque[];
  attrs?: Record<string, unknown>;
};

/** Protocoles autorisés pour un lien ou une image. */
function urlSure(valeur: unknown, protocolesAutorises: string[]): string | null {
  if (typeof valeur !== "string" || valeur.length === 0) return null;

  // Les URLs internes (nos images) sont relatives : sûres par construction.
  if (valeur.startsWith("/")) return valeur;

  try {
    const url = new URL(valeur);
    return protocolesAutorises.includes(url.protocol) ? valeur : null;
  } catch {
    return null;
  }
}

/** Applique les marques (gras, lien, code…) à un fragment de texte. */
function appliquerMarques(texte: string, marques: Marque[] | undefined): ReactNode {
  if (!marques || marques.length === 0) return texte;

  return marques.reduce<ReactNode>((contenu, marque) => {
    switch (marque.type) {
      case "bold":
        return <strong>{contenu}</strong>;
      case "italic":
        return <em>{contenu}</em>;
      case "strike":
        return <s>{contenu}</s>;
      case "underline":
        return <u>{contenu}</u>;
      case "code":
        return (
          <code className="bg-secondary rounded px-1.5 py-0.5 font-mono text-[0.9em]">
            {contenu}
          </code>
        );
      case "link": {
        const href = urlSure(marque.attrs?.href, ["http:", "https:", "mailto:"]);
        if (!href) return contenu; // lien au protocole refusé : on garde le texte

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-brand-text underline underline-offset-4 hover:no-underline"
          >
            {contenu}
          </a>
        );
      }
      default:
        // Marque inconnue : le texte reste, la mise en forme est ignorée.
        return contenu;
    }
  }, texte as ReactNode) as ReactNode;
}

function rendreNoeuds(noeuds: Noeud[] | undefined, prefixe = ""): ReactNode[] {
  if (!noeuds) return [];
  return noeuds.map((noeud, index) => rendreNoeud(noeud, `${prefixe}${index}`));
}

function rendreNoeud(noeud: Noeud, cle: string): ReactNode {
  const enfants = () => rendreNoeuds(noeud.content, `${cle}-`);

  switch (noeud.type) {
    case "text":
      return (
        <span key={cle}>{appliquerMarques(noeud.text ?? "", noeud.marks)}</span>
      );

    case "paragraph":
      return <p key={cle}>{enfants()}</p>;

    case "heading": {
      const niveau = Number(noeud.attrs?.level ?? 2);
      const Balise = (["h2", "h3", "h4"][Math.min(Math.max(niveau, 2), 4) - 2] ??
        "h2") as "h2" | "h3" | "h4";
      return <Balise key={cle}>{enfants()}</Balise>;
    }

    case "bulletList":
      return <ul key={cle}>{enfants()}</ul>;

    case "orderedList":
      return (
        <ol key={cle} start={Number(noeud.attrs?.start ?? 1)}>
          {enfants()}
        </ol>
      );

    case "listItem":
      return <li key={cle}>{enfants()}</li>;

    case "blockquote":
      return (
        <blockquote
          key={cle}
          className="border-brand-vivid/60 text-muted-foreground border-l-2 pl-4 italic"
        >
          {enfants()}
        </blockquote>
      );

    case "codeBlock":
      return (
        <pre
          key={cle}
          className="bg-secondary overflow-x-auto rounded-xl p-4 font-mono text-sm"
        >
          <code>{noeud.content?.map((enfant) => enfant.text).join("") ?? ""}</code>
        </pre>
      );

    case "horizontalRule":
      return <hr key={cle} className="border-border my-8" />;

    case "hardBreak":
      return <br key={cle} />;

    case "image": {
      const src = urlSure(noeud.attrs?.src, ["http:", "https:"]);
      if (!src) return null;

      const largeur = Number(noeud.attrs?.width);
      const hauteur = Number(noeud.attrs?.height);
      const alt = typeof noeud.attrs?.alt === "string" ? noeud.attrs.alt : "";

      // Dimensions connues → next/image, qui réserve la place et évite le
      // décalage de mise en page au chargement.
      if (Number.isFinite(largeur) && Number.isFinite(hauteur) && largeur > 0) {
        return (
          <Image
            key={cle}
            src={src}
            alt={alt}
            width={largeur}
            height={hauteur}
            className="h-auto w-full rounded-xl"
            sizes="(max-width: 768px) 100vw, 720px"
          />
        );
      }

      return (
        // eslint-disable-next-line @next/next/no-img-element -- dimensions inconnues
        <img key={cle} src={src} alt={alt} loading="lazy" className="rounded-xl" />
      );
    }

    case "doc":
      return <div key={cle}>{enfants()}</div>;

    default:
      // Type non pris en charge : on rend ses enfants si le nœud en a, sinon
      // rien. Un contenu inattendu ne peut donc pas s'exécuter.
      return noeud.content ? <div key={cle}>{enfants()}</div> : null;
  }
}

export function RenduContenu({ contenu }: { contenu: unknown }) {
  if (!contenu || typeof contenu !== "object") return null;

  const document = contenu as Noeud;
  if (document.type !== "doc" || !Array.isArray(document.content)) return null;

  return (
    <div className="contenu-lecon">{rendreNoeuds(document.content)}</div>
  );
}

/** Vrai si le document ne contient aucun texte ni média. */
export function contenuEstVide(contenu: unknown): boolean {
  if (!contenu || typeof contenu !== "object") return true;

  const document = contenu as Noeud;
  if (!Array.isArray(document.content) || document.content.length === 0) return true;

  const aDuContenu = (noeuds: Noeud[]): boolean =>
    noeuds.some((noeud) => {
      if (noeud.type === "text" && noeud.text?.trim()) return true;
      if (noeud.type === "image" || noeud.type === "horizontalRule") return true;
      return noeud.content ? aDuContenu(noeud.content) : false;
    });

  return !aDuContenu(document.content);
}
