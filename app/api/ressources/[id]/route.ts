import { NextResponse } from "next/server";

import { checkRessourceAccess } from "@/lib/access";
import { lireFichier } from "@/lib/stockage";

/**
 * Sert un fichier téléchargeable attaché à une leçon.
 *
 * ⚠️ C'est le point le plus important de cette route : elle passe par
 * `checkRessourceAccess()` AVANT de lire quoi que ce soit sur le disque.
 *
 * Une plateforme payante qui ne protège que ses pages HTML se contourne en
 * appelant directement l'endpoint de téléchargement. Le contrôle d'accès doit
 * donc vivre ici aussi — et il vit au même endroit que celui des pages, dans
 * lib/access.ts, pour qu'il n'y ait jamais deux règles à maintenir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const acces = await checkRessourceAccess(id);

  if (!acces.autorise) {
    // On répond 404 y compris pour « paiement requis » : révéler l'existence
    // d'un fichier verrouillé n'apporte rien et facilite l'énumération.
    return new NextResponse("Introuvable", { status: 404 });
  }

  const ressource = acces.donnee;
  const contenu = await lireFichier(ressource.chemin);

  if (!contenu) {
    // La ligne existe en base mais le fichier a disparu du disque : c'est une
    // incohérence côté serveur, pas une erreur du visiteur.
    return new NextResponse("Fichier indisponible", { status: 500 });
  }

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(contenu.length),
      // `attachment` force le téléchargement plutôt que l'affichage : un HTML
      // ou un PDF piégé ne s'exécutera pas dans notre origine.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ressource.nomFichier)}`,
      // Contenu potentiellement soumis à un paywall : jamais de cache partagé.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
