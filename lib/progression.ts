import "server-only";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { lecons, progressions } from "@/lib/db/schema";
import { getStudentCourant } from "@/lib/etudiant";
import { getIdentifiantVisiteur } from "@/lib/visiteur";

/**
 * Suivi de progression.
 *
 * Deux identités possibles, et c'est volontaire :
 *
 *   · un visiteur ANONYME est suivi par un UUID en cookie httpOnly. Pas de
 *     compte, pas d'email — cocher une leçon reste possible sans rien créer ;
 *   · un client CONNECTÉ est suivi par son `student_id`, ce qui fait suivre
 *     l'avancement d'un appareil à l'autre.
 *
 * À la connexion, `rattacherProgressionsAuClient()` transfère l'historique
 * anonyme vers le compte : personne ne perd son avancement en se connectant.
 *
 * Les lectures interrogent les DEUX identités quand elles existent, puis
 * fusionnent. Une leçon cochée sur un appareil avant connexion et une autre
 * cochée ailleurs après comptent donc toutes les deux.
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
  if (nbTotal === 0) return { ...PROGRESSION_VIDE, nbTotal };

  const portee = await porteeProgression();
  if (!portee) return { ...PROGRESSION_VIDE, nbTotal };

  const lignes = await db
    .select({ leconId: progressions.leconId })
    .from(progressions)
    .where(
      and(
        portee,
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

/**
 * Portée des lectures de progression : le compte s'il y en a un, plus le
 * cookie anonyme s'il existe.
 *
 * Renvoie `undefined` quand il n'y a ni compte ni cookie — il n'y a alors rien
 * à chercher, et surtout aucune condition à laisser vide dans un WHERE.
 */
async function porteeProgression() {
  const student = await getStudentCourant();
  const identifiant = await getIdentifiantVisiteur();

  const conditions = [
    student ? eq(progressions.studentId, student.id) : undefined,
    identifiant ? eq(progressions.identifiantClient, identifiant) : undefined,
  ].filter((condition) => condition !== undefined);

  if (conditions.length === 0) return undefined;

  return or(...conditions);
}

/** Vrai si le visiteur courant a terminé cette leçon. */
export async function leconEstTerminee(leconId: string): Promise<boolean> {
  const portee = await porteeProgression();
  if (!portee) return false;

  const ligne = await db.query.progressions.findFirst({
    where: and(portee, eq(progressions.leconId, leconId), eq(progressions.complete, true)),
    columns: { complete: true },
  });

  return ligne?.complete ?? false;
}

/**
 * Rattache au compte l'avancement pris avant la connexion.
 *
 * Appelée à chaque connexion, pas seulement à la première : un client qui
 * coche des leçons déconnecté puis se reconnecte récupère aussi ces lignes.
 *
 * On ne réécrit que les lignes encore orphelines. Écraser un `student_id`
 * existant permettrait, sur un poste partagé, de s'approprier l'avancement du
 * compte précédent.
 */
export async function rattacherProgressionsAuClient(studentId: string): Promise<void> {
  const identifiant = await getIdentifiantVisiteur();
  if (!identifiant) return;

  await db
    .update(progressions)
    .set({ studentId })
    .where(
      and(
        eq(progressions.identifiantClient, identifiant),
        isNull(progressions.studentId),
      ),
    );
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
  // Rattacher la ligne au compte dès l'écriture, quand il y en a un : c'est ce
  // qui fait que la leçon cochée ici sera vue depuis un autre appareil, sans
  // attendre une prochaine connexion.
  const student = await getStudentCourant();

  await db
    .insert(progressions)
    .values({
      identifiantClient: identifiant,
      studentId: student?.id ?? null,
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
        ...(student ? { studentId: student.id } : {}),
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
