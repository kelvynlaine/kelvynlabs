"use server";

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { erreurDeValidation, schemaSlug, type EtatAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { chapitres, formations, lecons, medias } from "@/lib/db/schema";
import { calculerNouvelOrdre, positionApres } from "@/lib/ordre";
import { slugUnique, slugifier } from "@/lib/slug";
import { supprimerFichier } from "@/lib/stockage";

/**
 * Server actions des formations.
 *
 * ⚠️ CHAQUE action appelle `requireAdmin()` pour son propre compte. Une server
 * action est un endpoint HTTP à part entière : le fait qu'elle soit rendue par
 * un layout protégé ne la protège en RIEN. Oublier cette ligne dans une seule
 * action ouvrirait une écriture publique sur la base.
 */

/* -------------------------------------------------------------------------- */
/* Schémas                                                                    */
/* -------------------------------------------------------------------------- */

const schemaFormation = z.object({
  titre: z.string().trim().min(1, "Le titre est requis").max(200, "Titre trop long"),
  slug: schemaSlug,
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  descriptionCourte: z
    .string()
    .trim()
    .max(280, "280 caractères maximum — c'est un résumé de carte")
    .optional()
    .or(z.literal("")),
  imageCouverture: z.string().trim().max(500).optional().or(z.literal("")),
  /** Saisi en euros dans l'interface, stocké en centimes. */
  prixEuros: z
    .string()
    .trim()
    .optional()
    .transform((valeur) => {
      if (!valeur) return null;
      const nombre = Number(valeur.replace(",", "."));
      return Number.isFinite(nombre) && nombre > 0 ? Math.round(nombre * 100) : null;
    }),
});

function texteOuNull(valeur: string | undefined): string | null {
  const nettoye = valeur?.trim();
  return nettoye && nettoye.length > 0 ? nettoye : null;
}

/** Un slug ne doit pas être déjà pris par une AUTRE formation. */
async function slugDejaPris(slug: string, sauf?: string): Promise<boolean> {
  const existante = await db.query.formations.findFirst({
    where: sauf
      ? and(eq(formations.slug, slug), ne(formations.id, sauf))
      : eq(formations.slug, slug),
    columns: { id: true },
  });
  return Boolean(existante);
}

/* -------------------------------------------------------------------------- */
/* Création                                                                   */
/* -------------------------------------------------------------------------- */

export async function creerFormation(
  _precedent: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  await requireAdmin();

  const titre = String(formData.get("titre") ?? "").trim();
  if (!titre) return { ok: false, erreur: "Le titre est requis" };
  if (titre.length > 200) return { ok: false, erreur: "Titre trop long" };

  const slug = await slugUnique(titre, (candidat) => slugDejaPris(candidat));

  const derniere = await db.query.formations.findFirst({
    orderBy: [desc(formations.ordre)],
    columns: { ordre: true },
  });

  const [creee] = await db
    .insert(formations)
    .values({ titre, slug, ordre: positionApres(derniere?.ordre) })
    .returning();

  if (!creee) return { ok: false, erreur: "Création impossible" };

  revalidatePath("/admin/formations");
  redirect(`/admin/formations/${creee.id}`);
}

/* -------------------------------------------------------------------------- */
/* Mise à jour                                                                */
/* -------------------------------------------------------------------------- */

export async function majFormation(
  _precedent: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, erreur: "Formation introuvable" };

  const parsed = schemaFormation.safeParse({
    titre: formData.get("titre"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? undefined,
    descriptionCourte: formData.get("descriptionCourte") ?? undefined,
    imageCouverture: formData.get("imageCouverture") ?? undefined,
    prixEuros: formData.get("prixEuros") ?? undefined,
  });

  if (!parsed.success) return erreurDeValidation(parsed.error);

  const donnees = parsed.data;

  if (await slugDejaPris(donnees.slug, id)) {
    return {
      ok: false,
      erreur: "Ce slug est déjà utilisé par une autre formation",
      champs: { slug: "Déjà utilisé" },
    };
  }

  await db
    .update(formations)
    .set({
      titre: donnees.titre,
      slug: donnees.slug,
      description: texteOuNull(donnees.description),
      descriptionCourte: texteOuNull(donnees.descriptionCourte),
      imageCouverture: texteOuNull(donnees.imageCouverture),
      prixCents: donnees.prixEuros,
    })
    .where(eq(formations.id, id));

  revalidatePath("/admin/formations");
  revalidatePath(`/admin/formations/${id}`);
  revalidatePath(`/formations/${donnees.slug}`);

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Publication                                                                */
/* -------------------------------------------------------------------------- */

export async function basculerPublicationFormation(id: string): Promise<EtatAction> {
  await requireAdmin();

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, id),
  });
  if (!formation) return { ok: false, erreur: "Formation introuvable" };

  const publier = formation.statut !== "published";

  // Publier une formation sans aucune leçon publiée produirait une page vide
  // côté client : on refuse plutôt que de laisser passer.
  if (publier) {
    const leconPubliee = await db.query.lecons.findFirst({
      where: and(eq(lecons.formationId, id), eq(lecons.statut, "published")),
      columns: { id: true },
    });

    if (!leconPubliee) {
      return {
        ok: false,
        erreur: "Publiez d'abord au moins une leçon : la formation serait vide.",
      };
    }
  }

  await db
    .update(formations)
    .set({
      statut: publier ? "published" : "draft",
      // On garde la date de première publication : la réécrire à chaque
      // republication fausserait un futur tri « nouveautés ».
      publieLe: publier ? (formation.publieLe ?? new Date()) : formation.publieLe,
    })
    .where(eq(formations.id, id));

  revalidatePath("/admin/formations");
  revalidatePath(`/admin/formations/${id}`);
  revalidatePath("/formations");
  revalidatePath(`/formations/${formation.slug}`);

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Duplication                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Duplique une formation avec toute son arborescence.
 *
 * La copie repart en brouillon et SANS les ressources téléchargeables : celles-ci
 * pointent vers des fichiers sur disque, que dupliquer signifierait recopier —
 * on préfère ne pas doubler silencieusement l'espace disque à chaque duplication.
 */
export async function dupliquerFormation(id: string): Promise<EtatAction> {
  await requireAdmin();

  const source = await db.query.formations.findFirst({
    where: eq(formations.id, id),
  });
  if (!source) return { ok: false, erreur: "Formation introuvable" };

  const [chapitresSource, leconsSource, derniere] = await Promise.all([
    db.query.chapitres.findMany({
      where: eq(chapitres.formationId, id),
      orderBy: [asc(chapitres.ordre)],
    }),
    db.query.lecons.findMany({
      where: eq(lecons.formationId, id),
      orderBy: [asc(lecons.ordre)],
    }),
    db.query.formations.findFirst({
      orderBy: [desc(formations.ordre)],
      columns: { ordre: true },
    }),
  ]);

  const nouveauSlug = await slugUnique(`${source.slug}-copie`, (candidat) =>
    slugDejaPris(candidat),
  );

  const [copie] = await db
    .insert(formations)
    .values({
      titre: `${source.titre} (copie)`,
      slug: nouveauSlug,
      description: source.description,
      descriptionCourte: source.descriptionCourte,
      imageCouverture: source.imageCouverture,
      prixCents: source.prixCents,
      devise: source.devise,
      statut: "draft",
      ordre: positionApres(derniere?.ordre),
    })
    .returning();

  if (!copie) return { ok: false, erreur: "Duplication impossible" };

  // Correspondance ancien chapitre → nouveau, pour rattacher les leçons.
  const correspondance = new Map<string, string>();

  for (const chapitre of chapitresSource) {
    const [nouveau] = await db
      .insert(chapitres)
      .values({
        formationId: copie.id,
        titre: chapitre.titre,
        description: chapitre.description,
        ordre: chapitre.ordre,
      })
      .returning({ id: chapitres.id });

    if (nouveau) correspondance.set(chapitre.id, nouveau.id);
  }

  for (const lecon of leconsSource) {
    const nouveauChapitreId = correspondance.get(lecon.chapitreId);
    if (!nouveauChapitreId) continue;

    await db.insert(lecons).values({
      chapitreId: nouveauChapitreId,
      formationId: copie.id,
      titre: lecon.titre,
      // Le slug est unique par formation : dans une formation neuve, celui de
      // la source est forcément libre.
      slug: lecon.slug,
      contenu: lecon.contenu,
      videoUrl: lecon.videoUrl,
      videoProvider: lecon.videoProvider,
      dureeEstimeeMin: lecon.dureeEstimeeMin,
      ordre: lecon.ordre,
      statut: "draft",
    });
  }

  revalidatePath("/admin/formations");
  redirect(`/admin/formations/${copie.id}`);
}

/* -------------------------------------------------------------------------- */
/* Suppression                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Supprime une formation, son arborescence et ses fichiers.
 *
 * Les suppressions en cascade sont assurées par les clés étrangères SQLite
 * (`foreign_keys = ON` dans lib/db). En revanche, aucune base ne supprime les
 * FICHIERS : on s'en charge explicitement, sinon le disque se remplit de
 * médias orphelins que plus rien ne référence.
 */
export async function supprimerFormation(id: string): Promise<EtatAction> {
  await requireAdmin();

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, id),
    columns: { id: true, slug: true },
  });
  if (!formation) return { ok: false, erreur: "Formation introuvable" };

  const leconsFormation = await db.query.lecons.findMany({
    where: eq(lecons.formationId, id),
    columns: { id: true },
    with: { ressources: { columns: { chemin: true } } },
  });

  const mediasFormation = await db.query.medias.findMany({
    where: eq(medias.formationId, id),
    columns: { chemin: true },
  });

  await db.delete(formations).where(eq(formations.id, id));

  const fichiers = [
    ...leconsFormation.flatMap((lecon) => lecon.ressources.map((r) => r.chemin)),
    ...mediasFormation.map((media) => media.chemin),
  ];

  await Promise.all(fichiers.map((chemin) => supprimerFichier(chemin)));

  revalidatePath("/admin/formations");
  revalidatePath("/formations");
  revalidatePath(`/formations/${formation.slug}`);

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Réordonnancement                                                           */
/* -------------------------------------------------------------------------- */

export async function reordonnerFormations(ids: string[]): Promise<EtatAction> {
  await requireAdmin();

  const positions = calculerNouvelOrdre(ids);

  for (const { id, ordre } of positions) {
    await db.update(formations).set({ ordre }).where(eq(formations.id, id));
  }

  revalidatePath("/admin/formations");
  revalidatePath("/formations");

  return { ok: true };
}

/** Slug proposé en direct pendant la saisie du titre, côté client. */
export async function proposerSlug(titre: string): Promise<string> {
  await requireAdmin();
  return slugifier(titre);
}
