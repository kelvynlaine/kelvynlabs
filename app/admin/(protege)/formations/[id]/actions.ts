"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { erreurDeValidation, schemaSlug, type EtatAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { chapitres, formations, lecons, ressources } from "@/lib/db/schema";
import { calculerNouvelOrdre, positionApres } from "@/lib/ordre";
import { slugUnique } from "@/lib/slug";
import { supprimerFichier } from "@/lib/stockage";

/**
 * Server actions des chapitres, leçons et ressources.
 *
 * ⚠️ Comme pour les formations : chaque action appelle `requireAdmin()` pour
 * son propre compte. Une server action est un endpoint HTTP public tant qu'elle
 * ne se protège pas elle-même.
 */

/** Invalide les pages admin et publiques touchées par une modification. */
async function rafraichir(formationId: string) {
  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, formationId),
    columns: { slug: true },
  });

  revalidatePath(`/admin/formations/${formationId}`);
  if (formation) revalidatePath(`/formations/${formation.slug}`);
}

/* ========================================================================== */
/* Chapitres                                                                  */
/* ========================================================================== */

export async function creerChapitre(formationId: string): Promise<EtatAction> {
  await requireAdmin();

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, formationId),
    columns: { id: true },
  });
  if (!formation) return { ok: false, erreur: "Formation introuvable" };

  const dernier = await db.query.chapitres.findFirst({
    where: eq(chapitres.formationId, formationId),
    orderBy: [desc(chapitres.ordre)],
    columns: { ordre: true },
  });

  await db.insert(chapitres).values({
    formationId,
    titre: "Nouveau chapitre",
    ordre: positionApres(dernier?.ordre),
  });

  await rafraichir(formationId);
  return { ok: true };
}

const schemaChapitre = z.object({
  id: z.string().min(1),
  titre: z.string().trim().min(1, "Le titre est requis").max(200),
  description: z.string().trim().max(2000).optional(),
});

export async function majChapitre(
  _precedent: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  await requireAdmin();

  const parsed = schemaChapitre.safeParse({
    id: formData.get("id"),
    titre: formData.get("titre"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) return erreurDeValidation(parsed.error);

  const chapitre = await db.query.chapitres.findFirst({
    where: eq(chapitres.id, parsed.data.id),
    columns: { formationId: true },
  });
  if (!chapitre) return { ok: false, erreur: "Chapitre introuvable" };

  const description = parsed.data.description?.trim();

  await db
    .update(chapitres)
    .set({
      titre: parsed.data.titre,
      description: description && description.length > 0 ? description : null,
    })
    .where(eq(chapitres.id, parsed.data.id));

  await rafraichir(chapitre.formationId);
  return { ok: true };
}

export async function supprimerChapitre(id: string): Promise<EtatAction> {
  await requireAdmin();

  const chapitre = await db.query.chapitres.findFirst({
    where: eq(chapitres.id, id),
    columns: { formationId: true },
    with: {
      lecons: { columns: { id: true }, with: { ressources: { columns: { chemin: true } } } },
    },
  });
  if (!chapitre) return { ok: false, erreur: "Chapitre introuvable" };

  const fichiers = chapitre.lecons.flatMap((lecon) =>
    lecon.ressources.map((r) => r.chemin),
  );

  await db.delete(chapitres).where(eq(chapitres.id, id));
  await Promise.all(fichiers.map((chemin) => supprimerFichier(chemin)));

  await rafraichir(chapitre.formationId);
  return { ok: true };
}

export async function reordonnerChapitres(
  formationId: string,
  ids: string[],
): Promise<EtatAction> {
  await requireAdmin();

  // On ne réordonne que des chapitres appartenant RÉELLEMENT à cette formation.
  // Sans ce filtre, un identifiant forgé permettrait de déplacer le chapitre
  // d'une autre formation.
  const autorises = new Set(
    (
      await db.query.chapitres.findMany({
        where: eq(chapitres.formationId, formationId),
        columns: { id: true },
      })
    ).map((c) => c.id),
  );

  for (const { id, ordre } of calculerNouvelOrdre(ids.filter((id) => autorises.has(id)))) {
    await db.update(chapitres).set({ ordre }).where(eq(chapitres.id, id));
  }

  await rafraichir(formationId);
  return { ok: true };
}

/* ========================================================================== */
/* Leçons                                                                     */
/* ========================================================================== */

/** Un slug de leçon est unique à l'échelle de la FORMATION, pas du chapitre. */
async function slugLeconPris(
  formationId: string,
  slug: string,
  sauf?: string,
): Promise<boolean> {
  const existante = await db.query.lecons.findFirst({
    where: sauf
      ? and(eq(lecons.formationId, formationId), eq(lecons.slug, slug), ne(lecons.id, sauf))
      : and(eq(lecons.formationId, formationId), eq(lecons.slug, slug)),
    columns: { id: true },
  });
  return Boolean(existante);
}

export async function creerLecon(chapitreId: string): Promise<EtatAction> {
  await requireAdmin();

  const chapitre = await db.query.chapitres.findFirst({
    where: eq(chapitres.id, chapitreId),
    columns: { id: true, formationId: true },
  });
  if (!chapitre) return { ok: false, erreur: "Chapitre introuvable" };

  const derniere = await db.query.lecons.findFirst({
    where: eq(lecons.chapitreId, chapitreId),
    orderBy: [desc(lecons.ordre)],
    columns: { ordre: true },
  });

  const slug = await slugUnique("nouvelle-lecon", (candidat) =>
    slugLeconPris(chapitre.formationId, candidat),
  );

  const [creee] = await db
    .insert(lecons)
    .values({
      chapitreId,
      formationId: chapitre.formationId,
      titre: "Nouvelle leçon",
      slug,
      ordre: positionApres(derniere?.ordre),
    })
    .returning({ id: lecons.id });

  await rafraichir(chapitre.formationId);

  if (creee) redirect(`/admin/formations/${chapitre.formationId}/lecons/${creee.id}`);
  return { ok: true };
}

const schemaLecon = z.object({
  id: z.string().min(1),
  titre: z.string().trim().min(1, "Le titre est requis").max(200),
  slug: schemaSlug,
  dureeEstimeeMin: z
    .string()
    .trim()
    .optional()
    .transform((valeur) => {
      if (!valeur) return null;
      const nombre = Number.parseInt(valeur, 10);
      return Number.isInteger(nombre) && nombre >= 0 && nombre <= 10000 ? nombre : null;
    }),
  videoProvider: z.enum(["youtube", "bunny", ""]).optional(),
  videoUrl: z.string().trim().max(500).optional(),
  /** Document Tiptap sérialisé côté client. */
  contenu: z.string().optional(),
});

/**
 * Normalise une saisie vidéo.
 *
 * Pour YouTube on ne conserve que l'identifiant : l'admin peut coller n'importe
 * quelle forme d'URL (watch, youtu.be, embed, avec paramètres de suivi), le
 * lecteur, lui, a besoin d'une seule chose.
 */
function normaliserVideo(
  provider: string | undefined,
  url: string | undefined,
): { videoProvider: "youtube" | "bunny" | null; videoUrl: string | null } | { erreur: string } {
  const brut = url?.trim();

  if (!provider || !brut) return { videoProvider: null, videoUrl: null };

  if (provider === "bunny") {
    // Un GUID Bunny : on l'accepte tel quel après un contrôle de forme.
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(brut)) {
      return { erreur: "Identifiant Bunny invalide (GUID attendu)." };
    }
    return { videoProvider: "bunny", videoUrl: brut };
  }

  const motifs = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /^([\w-]{11})$/,
  ];

  for (const motif of motifs) {
    const trouve = brut.match(motif);
    if (trouve?.[1]) return { videoProvider: "youtube", videoUrl: trouve[1] };
  }

  return { erreur: "Lien YouTube non reconnu (attendu : une URL ou un ID de 11 caractères)." };
}

export async function majLecon(
  _precedent: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  await requireAdmin();

  const parsed = schemaLecon.safeParse({
    id: formData.get("id"),
    titre: formData.get("titre"),
    slug: formData.get("slug"),
    dureeEstimeeMin: formData.get("dureeEstimeeMin") ?? undefined,
    videoProvider: formData.get("videoProvider") ?? undefined,
    videoUrl: formData.get("videoUrl") ?? undefined,
    contenu: formData.get("contenu") ?? undefined,
  });

  if (!parsed.success) return erreurDeValidation(parsed.error);
  const donnees = parsed.data;

  const lecon = await db.query.lecons.findFirst({
    where: eq(lecons.id, donnees.id),
    columns: { formationId: true },
  });
  if (!lecon) return { ok: false, erreur: "Leçon introuvable" };

  if (await slugLeconPris(lecon.formationId, donnees.slug, donnees.id)) {
    return {
      ok: false,
      erreur: "Ce slug est déjà utilisé par une autre leçon de cette formation",
      champs: { slug: "Déjà utilisé" },
    };
  }

  const video = normaliserVideo(donnees.videoProvider, donnees.videoUrl);
  if ("erreur" in video) {
    return { ok: false, erreur: video.erreur, champs: { videoUrl: video.erreur } };
  }

  // Le contenu arrive sous forme de chaîne JSON : on le valide avant de le
  // stocker, pour ne jamais écrire un document illisible en base.
  let contenu: unknown = undefined;
  if (donnees.contenu !== undefined) {
    try {
      contenu = donnees.contenu ? JSON.parse(donnees.contenu) : null;
    } catch {
      return { ok: false, erreur: "Contenu de la leçon illisible" };
    }
  }

  await db
    .update(lecons)
    .set({
      titre: donnees.titre,
      slug: donnees.slug,
      dureeEstimeeMin: donnees.dureeEstimeeMin,
      videoProvider: video.videoProvider,
      videoUrl: video.videoUrl,
      ...(contenu !== undefined ? { contenu } : {}),
    })
    .where(eq(lecons.id, donnees.id));

  await rafraichir(lecon.formationId);
  return { ok: true };
}

export async function basculerPublicationLecon(id: string): Promise<EtatAction> {
  await requireAdmin();

  const lecon = await db.query.lecons.findFirst({
    where: eq(lecons.id, id),
    columns: { statut: true, formationId: true },
  });
  if (!lecon) return { ok: false, erreur: "Leçon introuvable" };

  await db
    .update(lecons)
    .set({ statut: lecon.statut === "published" ? "draft" : "published" })
    .where(eq(lecons.id, id));

  await rafraichir(lecon.formationId);
  return { ok: true };
}

export async function supprimerLecon(id: string): Promise<EtatAction> {
  await requireAdmin();

  const lecon = await db.query.lecons.findFirst({
    where: eq(lecons.id, id),
    columns: { formationId: true },
    with: { ressources: { columns: { chemin: true } } },
  });
  if (!lecon) return { ok: false, erreur: "Leçon introuvable" };

  const fichiers = lecon.ressources.map((r) => r.chemin);

  await db.delete(lecons).where(eq(lecons.id, id));
  await Promise.all(fichiers.map((chemin) => supprimerFichier(chemin)));

  await rafraichir(lecon.formationId);
  return { ok: true };
}

/**
 * Applique un glisser-déposer de leçons.
 *
 * Une leçon peut changer de chapitre : `groupes` décrit l'état complet de
 * l'arborescence après le déplacement, chapitre par chapitre. Envoyer l'état
 * final plutôt qu'un delta évite toute divergence entre l'affichage et la base.
 */
export async function reordonnerLecons(
  formationId: string,
  groupes: { chapitreId: string; leconIds: string[] }[],
): Promise<EtatAction> {
  await requireAdmin();

  const [chapitresAutorises, leconsAutorisees] = await Promise.all([
    db.query.chapitres.findMany({
      where: eq(chapitres.formationId, formationId),
      columns: { id: true },
    }),
    db.query.lecons.findMany({
      where: eq(lecons.formationId, formationId),
      columns: { id: true },
    }),
  ]);

  // Même précaution que pour les chapitres : on n'accepte que des identifiants
  // appartenant à cette formation, jamais ceux fournis tels quels par le client.
  const chapitresOk = new Set(chapitresAutorises.map((c) => c.id));
  const leconsOk = new Set(leconsAutorisees.map((l) => l.id));

  for (const groupe of groupes) {
    if (!chapitresOk.has(groupe.chapitreId)) continue;

    const ids = groupe.leconIds.filter((id) => leconsOk.has(id));

    for (const { id, ordre } of calculerNouvelOrdre(ids)) {
      await db
        .update(lecons)
        .set({ ordre, chapitreId: groupe.chapitreId })
        .where(eq(lecons.id, id));
    }
  }

  await rafraichir(formationId);
  return { ok: true };
}

/* ========================================================================== */
/* Ressources                                                                 */
/* ========================================================================== */

export async function supprimerRessource(id: string): Promise<EtatAction> {
  await requireAdmin();

  const ressource = await db.query.ressources.findFirst({
    where: eq(ressources.id, id),
    with: { lecon: { columns: { formationId: true } } },
  });
  if (!ressource) return { ok: false, erreur: "Ressource introuvable" };

  await db.delete(ressources).where(eq(ressources.id, id));
  await supprimerFichier(ressource.chemin);

  await rafraichir(ressource.lecon.formationId);
  return { ok: true };
}
