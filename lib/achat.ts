import "server-only";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { enrollments } from "@/lib/db/schema";
import { trouverOuCreerStudent } from "@/lib/etudiant";

/**
 * Enregistrement d'un achat.
 *
 * ⚠️ Cette fonction est appelée depuis DEUX endroits, volontairement :
 *
 *   · le webhook Stripe, qui fait autorité — il arrive même si le client
 *     ferme son navigateur juste après avoir payé ;
 *   · la page de confirmation, parce que le webhook peut n'être pas encore
 *     arrivé quand le client y atterrit. Sans cela, il verrait « paiement
 *     réussi » puis se heurterait à un contenu verrouillé pendant quelques
 *     secondes.
 *
 * Elle doit donc être IDEMPOTENTE : deux appels pour le même paiement ne
 * doivent produire qu'un seul enrollment. C'est ce que garantit l'index
 * unique (student_id, formation_id) combiné à `onConflictDoUpdate`.
 */
export type ResultatAchat =
  | { ok: true; studentId: string; formationId: string; dejaEnregistre: boolean }
  | { ok: false; raison: string };

export async function enregistrerAchat(
  session: Stripe.Checkout.Session,
): Promise<ResultatAchat> {
  // Un paiement non abouti ne débloque rien. `payment_status` est le seul
  // champ qui fasse foi : `status: "complete"` peut être vrai pour une
  // session dont le paiement est encore en attente (virement, prélèvement).
  if (session.payment_status !== "paid") {
    return { ok: false, raison: `Paiement non abouti (${session.payment_status})` };
  }

  const formationId = session.metadata?.formationId;
  if (!formationId) {
    return { ok: false, raison: "Session sans formationId dans les métadonnées" };
  }

  const email =
    session.customer_details?.email ?? session.customer_email ?? null;

  if (!email) {
    return { ok: false, raison: "Session sans email client" };
  }

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);

  const student = await trouverOuCreerStudent(email, stripeCustomerId);

  const existant = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, student.id),
      eq(enrollments.formationId, formationId),
    ),
    columns: { id: true, statut: true },
  });

  await db
    .insert(enrollments)
    .values({
      studentId: student.id,
      formationId,
      stripeSessionId: session.id,
      statut: "actif",
      dateAchat: new Date(),
    })
    .onConflictDoUpdate({
      target: [enrollments.studentId, enrollments.formationId],
      set: {
        statut: "actif",
        stripeSessionId: session.id,
        dateAchat: new Date(),
      },
    });

  return {
    ok: true,
    studentId: student.id,
    formationId,
    dejaEnregistre: existant?.statut === "actif",
  };
}

/**
 * Repasse un enrollment en « remboursé » — l'accès se ferme immédiatement,
 * puisque checkAccess() n'accepte que le statut « actif ».
 *
 * On ne supprime pas la ligne : garder la trace d'un achat remboursé évite
 * qu'un même client rachète en croyant n'avoir jamais payé, et sert de
 * justificatif en cas de litige.
 */
export async function annulerAchat(
  stripeSessionId: string,
  statut: "rembourse" | "annule",
): Promise<boolean> {
  const ligne = await db.query.enrollments.findFirst({
    where: eq(enrollments.stripeSessionId, stripeSessionId),
    columns: { id: true },
  });

  if (!ligne) return false;

  await db.update(enrollments).set({ statut }).where(eq(enrollments.id, ligne.id));
  return true;
}
