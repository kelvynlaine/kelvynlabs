import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { jetonsConnexion, students } from "@/lib/db/schema";
import { envoyerEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site-config";
import { urlSite } from "@/lib/url-site";

/**
 * Connexion des clients par lien envoyé par email.
 *
 * ⚠️ Ce fichier décide QUI est un client donné. Il ne décide PAS de ce à quoi
 * ce client a droit — cela reste `lib/access.ts`, point d'entrée unique. Une
 * fois la session ouverte, `evaluerAcces()` fait le reste sans modification :
 * il interrogeait déjà `getStudentCourant()` et les enrollments.
 */

/** Court par construction : la fenêtre d'exploitation d'un email intercepté. */
const VALIDITE_JETON_MS = 20 * 60 * 1000;

/** Limitation de débit : au plus 3 demandes par adresse sur cette fenêtre. */
const FENETRE_LIMITE_MS = 15 * 60 * 1000;
const MAX_DEMANDES_PAR_FENETRE = 3;

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Résultat volontairement IDENTIQUE que l'adresse existe ou non.
 *
 * Répondre « aucun compte à cette adresse » transformerait le formulaire en
 * oracle : n'importe qui pourrait vérifier si telle personne est cliente. Le
 * message affiché est donc toujours le même, et c'est la boîte mail qui fait
 * la différence.
 */
export type DemandeConnexion = { envoye: boolean; limiteAtteinte: boolean };

export async function demanderLienConnexion(
  emailBrut: string,
): Promise<DemandeConnexion> {
  const email = normaliserEmail(emailBrut);

  const student = await db.query.students.findFirst({
    where: (t, { sql: s }) => s`lower(${t.email}) = ${email}`,
    columns: { id: true, email: true },
  });

  // Pas de compte : on s'arrête ici, silencieusement. L'appelant affichera le
  // même message que dans le cas nominal.
  if (!student) return { envoye: false, limiteAtteinte: false };

  const recentes = await db
    .select({ n: sql<number>`count(*)` })
    .from(jetonsConnexion)
    .where(
      and(
        eq(jetonsConnexion.studentId, student.id),
        gt(jetonsConnexion.creeLe, new Date(Date.now() - FENETRE_LIMITE_MS)),
      ),
    );

  if (Number(recentes[0]?.n ?? 0) >= MAX_DEMANDES_PAR_FENETRE) {
    // Sans cette borne, le formulaire devient une arme : quiconque connaît
    // l'adresse d'un client peut inonder sa boîte en rechargeant la page.
    return { envoye: false, limiteAtteinte: true };
  }

  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + VALIDITE_JETON_MS);

  await db.insert(jetonsConnexion).values({
    jetonHash: empreinte(jeton),
    studentId: student.id,
    expireLe,
  });

  // Purge opportuniste des jetons périmés depuis plus d'un jour : la table ne
  // grossit que de quelques lignes par connexion, une tâche planifiée serait
  // disproportionnée.
  await db
    .delete(jetonsConnexion)
    .where(lt(jetonsConnexion.expireLe, new Date(Date.now() - 24 * 60 * 60 * 1000)));

  const lien = `${await urlSite()}/connexion/verifier?jeton=${encodeURIComponent(jeton)}`;

  await envoyerEmail({
    destinataire: student.email,
    sujet: `Votre lien de connexion ${siteConfig.name}`,
    texte: texteEmail(lien),
    html: htmlEmail(lien),
  });

  return { envoye: true, limiteAtteinte: false };
}

export type ResultatVerification =
  | { valide: true; studentId: string }
  | { valide: false; raison: "inconnu" | "expire" | "deja_utilise" };

/**
 * Valide un jeton et le consomme.
 *
 * La consommation est faite par un UPDATE CONDITIONNEL plutôt que par une
 * lecture suivie d'une écriture : seule la première des deux requêtes
 * concurrentes trouve encore `utilise_le IS NULL` et modifie une ligne. Deux
 * onglets ouverts sur le même lien ne peuvent donc pas ouvrir deux sessions.
 */
export async function verifierEtConsommerJeton(
  jeton: string,
): Promise<ResultatVerification> {
  if (!jeton) return { valide: false, raison: "inconnu" };

  const hash = empreinte(jeton);

  const ligne = await db.query.jetonsConnexion.findFirst({
    where: eq(jetonsConnexion.jetonHash, hash),
  });

  if (!ligne) return { valide: false, raison: "inconnu" };

  // Comparaison à temps constant sur l'empreinte retrouvée. La recherche par
  // clé primaire a déjà eu lieu ; ceci ferme la porte à une mesure de temps
  // sur la comparaison elle-même.
  const attendu = Buffer.from(ligne.jetonHash, "utf8");
  const fourni = Buffer.from(hash, "utf8");
  if (attendu.length !== fourni.length || !timingSafeEqual(attendu, fourni)) {
    return { valide: false, raison: "inconnu" };
  }

  if (ligne.utiliseLe) return { valide: false, raison: "deja_utilise" };
  if (ligne.expireLe.getTime() <= Date.now()) return { valide: false, raison: "expire" };

  const consomme = await db
    .update(jetonsConnexion)
    .set({ utiliseLe: new Date() })
    .where(and(eq(jetonsConnexion.jetonHash, hash), isNull(jetonsConnexion.utiliseLe)))
    .returning({ studentId: jetonsConnexion.studentId });

  const gagnant = consomme[0];
  if (!gagnant) return { valide: false, raison: "deja_utilise" };

  return { valide: true, studentId: gagnant.studentId };
}

/** Vrai si une adresse correspond à un compte — réservé à l'administration. */
export async function compterClients(): Promise<number> {
  const lignes = await db.select({ n: sql<number>`count(*)` }).from(students);
  return Number(lignes[0]?.n ?? 0);
}

function texteEmail(lien: string): string {
  return [
    `Voici votre lien de connexion à ${siteConfig.name} :`,
    "",
    lien,
    "",
    "Ce lien est valable 20 minutes et ne fonctionne qu'une seule fois.",
    "",
    "Si vous n'avez pas demandé à vous connecter, ignorez ce message :",
    "personne ne peut accéder à votre compte sans ce lien.",
  ].join("\n");
}

/**
 * HTML volontairement minimal et en styles en ligne.
 *
 * Les clients de messagerie ignorent les feuilles de style externes et une
 * bonne partie des sélecteurs CSS. Un email sobre s'affiche partout ; un email
 * élaboré s'affiche bien dans Gmail et casse ailleurs.
 */
function htmlEmail(lien: string): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#0b0b0f;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#e7e7ea">
  <div style="max-width:480px;margin:0 auto">
    <p style="font-size:18px;font-weight:600;margin:0 0 24px">${siteConfig.name}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px">Voici votre lien de connexion.</p>
    <p style="margin:0 0 24px">
      <a href="${lien}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">Me connecter</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#9a9aa4;margin:0 0 8px">Ce lien est valable 20 minutes et ne fonctionne qu'une seule fois.</p>
    <p style="font-size:13px;line-height:1.6;color:#9a9aa4;margin:0">Si vous n'avez pas demandé à vous connecter, ignorez ce message : personne ne peut accéder à votre compte sans ce lien.</p>
  </div>
</body></html>`;
}
