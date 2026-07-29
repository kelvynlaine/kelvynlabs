import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

/**
 * Jeu d'extensions Tiptap de Kelvynlabs.
 *
 * Défini dans un module partagé et non dans le composant : le schéma du
 * document doit être STRICTEMENT le même à l'écriture et à la lecture. Deux
 * listes divergentes produiraient des documents que le rendu ne saurait pas
 * interpréter.
 */
export function extensionsEditeur(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: {
        // Le titre de la leçon occupe déjà le h1 de la page : les titres du
        // contenu commencent donc à h2, pour ne pas casser la hiérarchie
        // sémantique (ce qui dégraderait aussi le référencement).
        levels: [2, 3, 4],
      },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        // Liste blanche de protocoles : sans elle, un lien `javascript:…`
        // saisi dans l'éditeur deviendrait une XSS au clic côté visiteur.
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      },
    }),

    Image.configure({
      // Les images sont insérées par l'uploader, qui produit des URLs internes
      // (/api/fichiers/...). On interdit le base64 pour éviter des documents
      // JSON de plusieurs mégaoctets en base.
      allowBase64: false,
      HTMLAttributes: { class: "rounded-xl" },
    }),

    Placeholder.configure({
      placeholder: placeholder ?? "Rédigez votre leçon…",
    }),
  ];
}
