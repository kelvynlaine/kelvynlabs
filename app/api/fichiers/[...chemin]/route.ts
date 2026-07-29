import { NextResponse } from "next/server";

import { lireFichier } from "@/lib/stockage";

/**
 * Sert les fichiers du bucket public `medias` (images).
 *
 * Pourquoi une route plutôt que le dossier `public/` : les uploads vivent hors
 * du dépôt, sur un volume persistant. `public/` est figé au build et serait
 * écrasé à chaque redéploiement.
 *
 * ⚠️ Cette route ne sert QUE `medias`. Les ressources téléchargeables passent
 * par /api/ressources/[id], qui applique checkAccess(). Sans cette séparation,
 * il suffirait de deviner un chemin pour contourner un futur paywall.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chemin: string[] }> },
) {
  const { chemin } = await params;
  const relatif = chemin.map(decodeURIComponent).join("/");

  // Seul le bucket public est accessible ici. `resoudreCheminUpload` empêche
  // par ailleurs toute traversée de répertoire (`../`).
  if (chemin[0] !== "medias") {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const contenu = await lireFichier(relatif);
  if (!contenu) return new NextResponse("Introuvable", { status: 404 });

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": typeMimeDepuisExtension(relatif),
      "Content-Length": String(contenu.length),
      // Les noms de fichiers sont des UUID : un contenu donné ne change jamais
      // d'adresse, on peut donc le mettre en cache indéfiniment.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

function typeMimeDepuisExtension(chemin: string): string {
  const point = chemin.lastIndexOf(".");
  if (point === -1) return "application/octet-stream";
  return TYPES[chemin.slice(point).toLowerCase()] ?? "application/octet-stream";
}
