import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { lecons, progressions } from "@/lib/db/schema";
import { getIdentifiantVisiteur } from "@/lib/visiteur";

/**
 * Suivi de progression des visiteurs anonymes.
 *
 * En V1, la progression est rattachée à un UUID stocké dans un cookie
 * httpOnly. La table porte déjà une colonne `student_id` : le jour où les
 * comptes clients arriveront, la reprise des données tiendra en une requête
 * au moment de la première connexion —
 *
 *   UPDATE progressions SET student_id = ? WHERE identifiant_client = ?
 *
 * — sans qu'aucun visiteur ne perde son avancement.
 */

export type ProgressionFormation = {
  /** Identifiants des leçons marquées comme terminées. */
  terminees: Set<string>;
  nbTerminees: number;
  nbTotal: number;
  /** Pourcentage entier, 0 si la formation n'a aucune leçon. */
  pourcentage: number;
};

export const PROGRESSION_VIDE: ProgressionFormation = {
  terminees: new Set(),
  nbTerminees: 0,
  nbTotal: 0,
  pourcentage: 0,
};

/**
 * Progression du visiteur courant sur une formation.
 *
 * `idsLecons` doit être la liste des leçons VISIBLES par ce visiteur : c'est
 * elle qui sert de dénominateur. Compter des brouillons fausserait le
 * pourcentage et rendrait le 100 % inatteignable.
 */
export async function getProgressionFormation(
  idsLecons: string[],
): Promise<ProgressionFormation> {
  const nbTotal = idsLecons.length;

  const identifiant = await getIdentifiantVisiteur();
  if (!identifiant || nbTotal === 0) {
    return { ...PROGRESSION_VIDE, nbTotal };
  }

  const lignes = await db
    .select({ leconId: progressions.leconId })
    .from(progressions)
    .where(
      and(
        eq(progressions.identifiantClient, identifiant),
        eq(progressions.complete, true),
        inArray(progressions.leconId, idsLecons),
      ),
    );

  const terminees = new Set(lignes.map((ligne) => ligne.leconId));

  return {
    terminees,
    nbTerminees: terminees.size,
    nbTotal,
    pourcentage: Math.round((terminees.size / nbTotal) * 100),
  };
}

/** Vrai si le visiteur courant a terminé cette leçon. */
export async function leconEstTerminee(leconId: string): Promise<boolean> {
  const identifiant = await getIdentifiantVisiteur();
  if (!identifiant) return false;

  const ligne = await db.query.progressions.findFirst({
    where: and(
      eq(progressions.identifiantClient, identifiant),
      eq(progressions.leconId, leconId),
    ),
    columns: { complete: true },
  });

  return ligne?.complete ?? false;
}

/**
 * Enregistre l'état « terminée » d'une leçon.
 *
 * ⚠️ N'effectue AUCUN contrôle d'accès : c'est l'appelant (la server action)
 * qui doit avoir vérifié via checkAccess() que le visiteur a le droit de voir
 * cette leçon. Sans cela, l'endpoint permettrait d'énumérer les identifiants
 * de leçons non publiées en observant lesquels sont acceptés.
 */
export async function enregistrerProgression(
  identifiant: string,
  leconId: string,
  complete: boolean,
): Promise<void> {
  await db
    .insert(progressions)
    .values({
      identifiantClient: identifiant,
      leconId,
      complete,
      completeLe: complete ? new Date() : null,
    })
    .onConflictDoUpdate({
      // Correspond à l'index unique (identifiant_client, lecon_id) : deux
      // clics rapides produisent une mise à jour, jamais une seconde ligne.
      target: [progressions.identifiantClient, progressions.leconId],
      set: {
        complete,
        completeLe: complete ? new Date() : null,
        misAJourLe: new Date(),
      },
    });
}

/**
 * Prochaine leçon à lire : la première non terminée, dans l'ordre du sommaire.
 * Renvoie la première leçon si tout reste à faire, et null si tout est terminé.
 */
export function prochaineLecon<T extends { id: string }>(
  parcours: T[],
  terminees: Set<string>,
): T | null {
  return parcours.find((lecon) => !terminees.has(lecon.id)) ?? null;
}

/** Nombre de leçons terminées par chapitre, pour le sommaire. */
export function compterParChapitre(
  chapitres: { id: string; lecons: { id: string }[] }[],
  terminees: Set<string>,
): Map<string, { termine: number; total: number }> {
  const compte = new Map<string, { termine: number; total: number }>();

  for (const chapitre of chapitres) {
    compte.set(chapitre.id, {
      termine: chapitre.lecons.filter((lecon) => terminees.has(lecon.id)).length,
      total: chapitre.lecons.length,
    });
  }

  return compte;
}

/** Durée cumulée d'une liste de leçons, en minutes. */
export async function dureeTotale(idsLecons: string[]): Promise<number> {
  if (idsLecons.length === 0) return 0;

  const lignes = await db
    .select({ duree: lecons.dureeEstimeeMin })
    .from(lecons)
    .where(inArray(lecons.id, idsLecons));

  return lignes.reduce((total, ligne) => total + (ligne.duree ?? 0), 0);
}
