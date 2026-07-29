import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";
import { enrollments, students, studentSessions, type Student } from "@/lib/db/schema";

/**
 * Identité d'un client ayant acheté une formation.
 *
 * Une session s'ouvre par deux chemins, qui aboutissent au même endroit :
 *
 *   · juste après un paiement réussi, depuis l'email transmis par Stripe ;
 *   · à tout moment, via un lien de connexion envoyé par email
 *     (voir `lib/connexion-client.ts`).
 *
 * L'accès n'est donc PAS lié au navigateur : l'enrollment appartient au
 * `student`, et n'importe quel appareil peut le retrouver en prouvant qu'il
 * contrôle l'adresse email qui a payé.
 */

export const COOKIE_ETUDIANT = "kl_etudiant";

const DUREE_SESSION_MS = 180 * 24 * 60 * 60 * 1000; // 180 jours

function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/**
 * Ouvre une session client et pose le cookie.
 *
 * ⚠️ Écrit un cookie : appelable uniquement depuis une server action ou un
 * route handler.
 */
export async function ouvrirSessionEtudiant(studentId: string): Promise<void> {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_SESSION_MS);

  await db.insert(studentSessions).values({
    jetonHash: empreinteJeton(jeton),
    studentId,
    expireLe,
  });

  // Purge opportuniste : évite de programmer une tâche pour une table qui ne
  // grossit que de quelques lignes par mois.
  await db.delete(studentSessions).where(lt(studentSessions.expireLe, new Date()));

  const store = await cookies();
  store.set(COOKIE_ETUDIANT, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expireLe,
  });
}

/**
 * Ferme la session courante.
 *
 * La ligne est SUPPRIMÉE en base, pas seulement le cookie effacé : sans cela,
 * un jeton copié avant la déconnexion resterait valable jusqu'à son expiration.
 * Se déconnecter doit révoquer, pas seulement oublier.
 */
export async function fermerSessionEtudiant(): Promise<void> {
  const store = await cookies();
  const jeton = store.get(COOKIE_ETUDIANT)?.value;

  if (jeton) {
    await db
      .delete(studentSessions)
      .where(eq(studentSessions.jetonHash, empreinteJeton(jeton)));
  }

  store.delete(COOKIE_ETUDIANT);
}

/** Client identifié pour la requête en cours, ou null. */
export const getStudentCourant = cache(async (): Promise<Student | null> => {
  const store = await cookies();
  const jeton = store.get(COOKIE_ETUDIANT)?.value;
  if (!jeton) return null;

  const ligne = await db.query.studentSessions.findFirst({
    where: eq(studentSessions.jetonHash, empreinteJeton(jeton)),
    with: { student: true },
  });

  if (!ligne) return null;

  if (ligne.expireLe.getTime() <= Date.now()) {
    await db
      .delete(studentSessions)
      .where(eq(studentSessions.jetonHash, ligne.jetonHash));
    return null;
  }

  return ligne.student;
});

/**
 * Vrai si ce client a un accès actif à cette formation.
 *
 * Seul le statut `actif` ouvre l'accès : un paiement `en_attente` (virement
 * non encore confirmé) ou `rembourse` ne doit rien débloquer.
 */
export async function aUnEnrollmentActif(
  studentId: string,
  formationId: string,
): Promise<boolean> {
  const ligne = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.formationId, formationId),
      eq(enrollments.statut, "actif"),
    ),
    columns: { id: true },
  });

  return Boolean(ligne);
}

/**
 * Retrouve un client par email, ou le crée.
 *
 * La recherche est insensible à la casse : « Kelvyn@x.fr » et « kelvyn@x.fr »
 * doivent désigner le même acheteur, sans quoi un même client paierait deux
 * fois la même formation sans jamais y accéder deux fois.
 */
export async function trouverOuCreerStudent(
  email: string,
  stripeCustomerId?: string | null,
): Promise<Student> {
  const normalise = email.trim().toLowerCase();

  const existant = await db.query.students.findFirst({
    where: (t, { sql }) => sql`lower(${t.email}) = ${normalise}`,
  });

  if (existant) {
    // Le client Stripe peut n'avoir été connu qu'au second achat.
    if (stripeCustomerId && !existant.stripeCustomerId) {
      await db
        .update(students)
        .set({ stripeCustomerId })
        .where(eq(students.id, existant.id));
    }
    return existant;
  }

  const [cree] = await db
    .insert(students)
    .values({ email: normalise, stripeCustomerId: stripeCustomerId ?? null })
    .returning();

  if (!cree) throw new Error("Création du client impossible");
  return cree;
}
