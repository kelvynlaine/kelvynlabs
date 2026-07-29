import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminCourant } from "@/lib/auth";
import { db } from "@/lib/db";
import { lecons, medias, ressources } from "@/lib/db/schema";
import { positionApres } from "@/lib/ordre";
import { enregistrerFichier, urlMedia, type Bucket } from "@/lib/stockage";

/**
 * Réception des fichiers uploadés depuis l'administration.
 *
 * Pourquoi une route et pas une server action : les server actions plafonnent
 * la taille du corps de requête (1 Mo par défaut) — inadapté à un PDF de 40 Mo.
 * Une route handler reçoit le flux sans cette limite.
 *
 * ⚠️ Le navigateur n'écrit JAMAIS directement dans le stockage : il poste ici,
 * et c'est le serveur qui valide (type réel, taille, signature binaire) puis
 * écrit sous un nom qu'il choisit lui-même.
 */

const schemaChamps = z.object({
  bucket: z.enum(["medias", "ressources"]),
  formationId: z.string().uuid().optional(),
  leconId: z.string().uuid().optional(),
});

/** Déduit le type de ressource à partir du MIME, pour l'icône affichée. */
function typeRessource(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf" as const;
  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType === "application/zip") return "archive" as const;
  if (mimeType.includes("word") || mimeType.includes("document")) return "doc" as const;
  return "autre" as const;
}

export async function POST(request: Request) {
  // Autorisation d'abord, avant même de lire le corps de la requête : inutile
  // d'accepter 100 Mo d'un visiteur non authentifié.
  const admin = await getAdminCourant();
  if (!admin) {
    return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible" }, { status: 400 });
  }

  const champs = schemaChamps.safeParse({
    bucket: formData.get("bucket"),
    formationId: formData.get("formationId") ?? undefined,
    leconId: formData.get("leconId") ?? undefined,
  });

  if (!champs.success) {
    return NextResponse.json({ erreur: "Paramètres invalides" }, { status: 400 });
  }

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    return NextResponse.json({ erreur: "Aucun fichier reçu" }, { status: 400 });
  }

  const bucket = champs.data.bucket as Bucket;
  const resultat = await enregistrerFichier(bucket, fichier);

  if ("erreur" in resultat) {
    return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });
  }

  /* --- Bucket `ressources` : rattachement obligatoire à une leçon --------- */
  if (bucket === "ressources") {
    const { leconId } = champs.data;
    if (!leconId) {
      return NextResponse.json(
        { erreur: "Une ressource doit être rattachée à une leçon." },
        { status: 400 },
      );
    }

    const lecon = await db.query.lecons.findFirst({ where: eq(lecons.id, leconId) });
    if (!lecon) {
      return NextResponse.json({ erreur: "Leçon introuvable." }, { status: 404 });
    }

    const derniere = await db.query.ressources.findFirst({
      where: eq(ressources.leconId, leconId),
      orderBy: [desc(ressources.ordre)],
    });

    const [creee] = await db
      .insert(ressources)
      .values({
        leconId,
        nomFichier: resultat.nomOriginal,
        chemin: resultat.chemin,
        type: typeRessource(resultat.mimeType),
        tailleOctets: resultat.tailleOctets,
        ordre: positionApres(derniere?.ordre),
      })
      .returning();

    return NextResponse.json({ ressource: creee });
  }

  /* --- Bucket `medias` : entrée dans la bibliothèque ---------------------- */
  const [media] = await db
    .insert(medias)
    .values({
      type: "image",
      chemin: resultat.chemin,
      nomOriginal: resultat.nomOriginal,
      mimeType: resultat.mimeType,
      tailleOctets: resultat.tailleOctets,
      largeur: resultat.largeur,
      hauteur: resultat.hauteur,
      formationId: champs.data.formationId ?? null,
      leconId: champs.data.leconId ?? null,
    })
    .returning();

  if (!media) {
    return NextResponse.json({ erreur: "Enregistrement échoué" }, { status: 500 });
  }

  return NextResponse.json({
    media: { ...media, url: urlMedia(media.chemin) },
  });
}
