import "server-only";

import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";

import { dossierUploads, resoudreCheminUpload } from "@/lib/chemins";
import { stockageObjetEstConfigure } from "@/lib/env.server";
import { backendDisque } from "@/lib/stockage/disque";
import { backendS3 } from "@/lib/stockage/s3";

/**
 * Stockage des fichiers.
 *
 * Toute l'application passe par ce module — c'est ce qui a permis d'ajouter le
 * stockage objet sans toucher une seule ligne ailleurs : ni les routes qui
 * servent les fichiers, ni l'upload, ni la bibliothèque de médias.
 *
 * Deux backends, choisis par les variables d'environnement :
 *   · disque → fichiers à côté de la base, sous DOSSIER_DONNEES (par défaut) ;
 *   · S3     → stockage objet compatible S3 (Cloudflare R2, Backblaze B2…),
 *              dès que les quatre variables S3_* sont renseignées.
 *
 * ⚠️ Sur un hébergement dont le disque est recréé à chaque déploiement, le
 * backend disque ferait disparaître images et ressources à chaque mise en
 * ligne. Le backend S3 est alors obligatoire.
 *
 * Deux « buckets », deux régimes d'accès :
 *   · medias     → images. Servies par /api/fichiers.
 *   · ressources → PDF et fichiers téléchargeables. Servis UNIQUEMENT par
 *                  /api/ressources/[id], après passage par checkAccess().
 *
 * Aucun fichier n'est écrit dans `public/` : ce dossier est figé au build et
 * serait de toute façon écrasé au redéploiement.
 */

/** Backend actif. Le choix se fait à la configuration, jamais dans le code. */
function backend() {
  return stockageObjetEstConfigure() ? backendS3 : backendDisque;
}

/** Nom du backend actif — affiché dans les diagnostics. */
export function nomStockage(): string {
  return backend().nom;
}

export type Bucket = "medias" | "ressources";

/* -------------------------------------------------------------------------- */
/* Politique de validation                                                    */
/* -------------------------------------------------------------------------- */

const MO = 1024 * 1024;

export const LIMITES = {
  medias: {
    tailleMax: 10 * MO,
    /**
     * Liste blanche stricte. Notez l'ABSENCE de `image/svg+xml` : un SVG est un
     * document XML pouvant embarquer du JavaScript, donc un vecteur de XSS
     * stocké dès lors qu'il est servi depuis notre propre origine.
     */
    mimeAutorises: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
    ],
  },
  ressources: {
    tailleMax: 100 * MO,
    mimeAutorises: [
      "application/pdf",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },
} as const satisfies Record<Bucket, { tailleMax: number; mimeAutorises: readonly string[] }>;

/** Extension déduite du type MIME — jamais du nom fourni par le client. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

export type ResultatUpload = {
  chemin: string;
  nomOriginal: string;
  mimeType: string;
  tailleOctets: number;
  largeur: number | null;
  hauteur: number | null;
};

export type ErreurUpload = { erreur: string };

/**
 * Écrit un fichier reçu et renvoie ses métadonnées.
 *
 * Le nom de destination est un UUID, jamais le nom fourni par l'utilisateur :
 * un nom comme `../../.env` ou `photo.png.php` ne peut donc rien provoquer.
 * Le nom d'origine n'est conservé qu'à titre d'affichage, en base.
 */
export async function enregistrerFichier(
  bucket: Bucket,
  fichier: File,
): Promise<ResultatUpload | ErreurUpload> {
  const limites = LIMITES[bucket];

  if (fichier.size === 0) return { erreur: "Fichier vide." };

  if (fichier.size > limites.tailleMax) {
    const maxMo = Math.round(limites.tailleMax / MO);
    return { erreur: `Fichier trop volumineux (maximum ${maxMo} Mo).` };
  }

  const mimeType = fichier.type;
  if (!(limites.mimeAutorises as readonly string[]).includes(mimeType)) {
    return { erreur: `Type de fichier non autorisé (${mimeType || "inconnu"}).` };
  }

  const octets = Buffer.from(await fichier.arrayBuffer());

  // Le type MIME annoncé par le navigateur n'est qu'une déclaration : on
  // vérifie la signature réelle du fichier. Sans ça, un exécutable renommé en
  // .png passerait la validation.
  if (mimeType.startsWith("image/") && !signatureImageValide(octets, mimeType)) {
    return { erreur: "Le contenu du fichier ne correspond pas à son type déclaré." };
  }

  const extension = EXTENSIONS[mimeType] ?? extname(fichier.name).toLowerCase();
  const chemin = join(bucket, `${randomUUID()}${extension}`);

  // Le chemin est construit par nous (bucket + UUID), mais on le repasse par
  // la barrière anti-traversée : une régression future dans la génération ne
  // doit pas pouvoir écrire hors du dossier autorisé.
  if (!resoudreCheminUpload(chemin)) {
    return { erreur: "Chemin de destination invalide." };
  }

  try {
    await backend().ecrire(chemin, octets);
  } catch (erreur) {
    console.error("[stockage] écriture impossible", erreur);
    return { erreur: "Enregistrement du fichier impossible." };
  }

  const dimensions = mimeType.startsWith("image/") ? dimensionsImage(octets) : null;

  return {
    chemin,
    nomOriginal: fichier.name.slice(0, 200),
    mimeType,
    tailleOctets: octets.length,
    largeur: dimensions?.largeur ?? null,
    hauteur: dimensions?.hauteur ?? null,
  };
}

/** Supprime un fichier. Silencieux s'il a déjà disparu. */
export async function supprimerFichier(cheminRelatif: string): Promise<void> {
  if (!resoudreCheminUpload(cheminRelatif)) return;
  await backend().supprimer(cheminRelatif);
}

/** Lit un fichier. `null` si absent ou si le chemin sort du dossier autorisé. */
export async function lireFichier(cheminRelatif: string): Promise<Buffer | null> {
  // La vérification anti-traversée s'applique aux DEUX backends : sur S3 elle
  // empêche qu'un chemin forgé aille lire une clé hors des préfixes attendus.
  if (!resoudreCheminUpload(cheminRelatif)) return null;
  return backend().lire(cheminRelatif);
}

/** URL publique d'un média. Les ressources privées n'en ont pas. */
export function urlMedia(cheminRelatif: string): string {
  return `/api/fichiers/${cheminRelatif.split("/").map(encodeURIComponent).join("/")}`;
}

export function dossierDeStockage(): string {
  return dossierUploads();
}

/* -------------------------------------------------------------------------- */
/* Inspection binaire                                                         */
/* -------------------------------------------------------------------------- */

/** Vérifie les octets de signature (« magic number ») d'une image. */
function signatureImageValide(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  switch (mimeType) {
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    case "image/gif":
      return buffer.subarray(0, 6).toString("ascii").startsWith("GIF8");
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/avif":
      return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    default:
      return false;
  }
}

/**
 * Dimensions d'une image, lues directement dans l'en-tête.
 *
 * Évite une dépendance de traitement d'image (sharp) pour un besoin qui se
 * résume à lire quelques octets. Les dimensions alimentent `next/image`, ce qui
 * supprime le décalage de mise en page au chargement des pages de leçon.
 * Renvoie null pour les formats non couverts — c'est un confort, pas une
 * nécessité.
 */
function dimensionsImage(
  buffer: Buffer,
): { largeur: number; hauteur: number } | null {
  try {
    // PNG : largeur et hauteur en big-endian dans le chunk IHDR.
    if (buffer.subarray(1, 4).toString("ascii") === "PNG") {
      return { largeur: buffer.readUInt32BE(16), hauteur: buffer.readUInt32BE(20) };
    }

    // GIF : little-endian, juste après la signature.
    if (buffer.subarray(0, 3).toString("ascii") === "GIF") {
      return { largeur: buffer.readUInt16LE(6), hauteur: buffer.readUInt16LE(8) };
    }

    // WebP : trois variantes de conteneur, chacune avec son encodage.
    if (buffer.subarray(8, 12).toString("ascii") === "WEBP") {
      const format = buffer.subarray(12, 16).toString("ascii");

      if (format === "VP8X") {
        return {
          largeur: 1 + (buffer.readUIntLE(24, 3) & 0xffffff),
          hauteur: 1 + (buffer.readUIntLE(27, 3) & 0xffffff),
        };
      }
      if (format === "VP8 ") {
        return {
          largeur: buffer.readUInt16LE(26) & 0x3fff,
          hauteur: buffer.readUInt16LE(28) & 0x3fff,
        };
      }
      if (format === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return {
          largeur: 1 + (bits & 0x3fff),
          hauteur: 1 + ((bits >> 14) & 0x3fff),
        };
      }
      return null;
    }

    // JPEG : parcours des segments jusqu'au marqueur SOF, qui porte la taille.
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let position = 2;

      while (position + 9 < buffer.length) {
        if (buffer[position] !== 0xff) {
          position++;
          continue;
        }

        const marqueur = buffer[position + 1];
        if (marqueur === undefined) break;

        // SOF0..SOF15, en excluant DHT (C4), JPG (C8) et DAC (CC).
        const estSOF =
          marqueur >= 0xc0 &&
          marqueur <= 0xcf &&
          marqueur !== 0xc4 &&
          marqueur !== 0xc8 &&
          marqueur !== 0xcc;

        if (estSOF) {
          return {
            hauteur: buffer.readUInt16BE(position + 5),
            largeur: buffer.readUInt16BE(position + 7),
          };
        }

        position += 2 + buffer.readUInt16BE(position + 2);
      }
    }

    return null;
  } catch {
    // En-tête tronqué ou exotique : les dimensions ne sont qu'un confort.
    return null;
  }
}
