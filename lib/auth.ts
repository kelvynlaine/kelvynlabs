import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { COOKIE_SESSION } from "@/lib/auth-cookie";
import { db } from "@/lib/db";
import { admins, sessions, type Admin } from "@/lib/db/schema";
import { verifierMotDePasse } from "@/lib/mot-de-passe";

export { COOKIE_SESSION };

/**
 * Authentification administrateur — sessions maison.
 *
 * Remplace Supabase Auth. Le fonctionnement tient en trois idées :
 *
 *   1. le cookie ne contient qu'un jeton aléatoire de 256 bits ;
 *   2. la base ne stocke QUE le SHA-256 de ce jeton. Une fuite de la base ne
 *      permet donc pas de rejouer une session — c'est le même raisonnement que
 *      pour un mot de passe, appliqué aux jetons ;
 *   3. la session étant une ligne en base, elle est révocable instantanément —
 *      ce qu'un JWT auto-porteur ne permet pas.
 *
 * ⚠️ Le middleware ne peut PAS valider une session : il s'exécute sur le
 * runtime Edge, où le module natif SQLite n'existe pas. Il se contente de
 * vérifier la PRÉSENCE du cookie. La validation réelle a lieu ici, appelée
 * depuis chaque page et chaque server action de /admin.
 */

const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
/** En deçà de ce seuil restant, la session est prolongée à la volée. */
const SEUIL_RENOUVELLEMENT_MS = 15 * 24 * 60 * 60 * 1000;

function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Connexion / déconnexion                                                    */
/* -------------------------------------------------------------------------- */

export type ResultatConnexion =
  | { ok: true; admin: Admin }
  | { ok: false; erreur: string };

/**
 * Vérifie les identifiants et ouvre une session.
 *
 * Le message d'erreur est identique que l'email soit inconnu ou le mot de passe
 * faux : le distinguer permettrait d'énumérer les comptes existants.
 */
export async function connecter(
  email: string,
  motDePasse: string,
): Promise<ResultatConnexion> {
  const normalise = email.trim().toLowerCase();

  const admin = await db.query.admins.findFirst({
    where: (t, { sql }) => sql`lower(${t.email}) = ${normalise}`,
  });

  if (!admin) {
    // Compte inexistant : on hache tout de même un mot de passe factice.
    // Sans cela, une réponse immédiate trahirait « cet email n'existe pas »,
    // alors qu'un compte réel prendrait ~100 ms à vérifier.
    await verifierMotDePasse(motDePasse, "scrypt$65536$8$2$00$00");
    return { ok: false, erreur: "Identifiants incorrects." };
  }

  const valide = await verifierMotDePasse(motDePasse, admin.motDePasseHash);
  if (!valide) return { ok: false, erreur: "Identifiants incorrects." };

  await ouvrirSession(admin.id);
  return { ok: true, admin };
}

async function ouvrirSession(adminId: string): Promise<void> {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_SESSION_MS);

  await db.insert(sessions).values({
    jetonHash: empreinteJeton(jeton),
    adminId,
    expireLe,
  });

  // Purge opportuniste des sessions expirées : évite d'avoir à programmer une
  // tâche planifiée pour une table qui grossit de quelques lignes par mois.
  await db.delete(sessions).where(lt(sessions.expireLe, new Date()));

  const store = await cookies();
  store.set(COOKIE_SESSION, jeton, {
    httpOnly: true, // inaccessible au JavaScript de la page (anti-XSS)
    sameSite: "lax", // le cookie n'accompagne pas les requêtes tierces (anti-CSRF)
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expireLe,
  });
}

export async function deconnecter(): Promise<void> {
  const store = await cookies();
  const jeton = store.get(COOKIE_SESSION)?.value;

  if (jeton) {
    await db.delete(sessions).where(eq(sessions.jetonHash, empreinteJeton(jeton)));
  }

  store.delete(COOKIE_SESSION);
}

/* -------------------------------------------------------------------------- */
/* Lecture de la session                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Administrateur connecté pour la requête en cours, ou null.
 *
 * `cache()` déduplique l'appel : plusieurs composants d'une même page peuvent
 * l'invoquer sans multiplier les requêtes.
 */
export const getAdminCourant = cache(async (): Promise<Admin | null> => {
  const store = await cookies();
  const jeton = store.get(COOKIE_SESSION)?.value;
  if (!jeton) return null;

  const empreinte = empreinteJeton(jeton);

  const ligne = await db.query.sessions.findFirst({
    where: eq(sessions.jetonHash, empreinte),
    with: { admin: true },
  });

  if (!ligne) return null;

  // Comparaison à temps constant, par cohérence avec le reste du module : la
  // recherche par index a déjà filtré, mais on ne veut aucun chemin où une
  // égalité de jeton se mesure au temps.
  const attendu = Buffer.from(ligne.jetonHash, "utf8");
  const fourni = Buffer.from(empreinte, "utf8");
  if (attendu.length !== fourni.length || !timingSafeEqual(attendu, fourni)) {
    return null;
  }

  if (ligne.expireLe.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.jetonHash, empreinte));
    return null;
  }

  // Prolongation glissante : l'admin qui utilise la plateforme régulièrement
  // n'est jamais déconnecté, mais une session abandonnée finit par expirer.
  if (ligne.expireLe.getTime() - Date.now() < SEUIL_RENOUVELLEMENT_MS) {
    await db
      .update(sessions)
      .set({ expireLe: new Date(Date.now() + DUREE_SESSION_MS) })
      .where(eq(sessions.jetonHash, empreinte));
  }

  return ligne.admin;
});

/** Vrai si le visiteur courant est l'administrateur. */
export async function estAdminCourant(): Promise<boolean> {
  return (await getAdminCourant()) !== null;
}

/**
 * Garde à placer en tête de CHAQUE page et server action de /admin.
 *
 * Le middleware ne vérifie que la présence du cookie ; c'est cette fonction qui
 * constitue l'autorisation réelle. Un layout ne protège pas les server actions
 * qu'il rend : chacune doit appeler cette garde pour son propre compte.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdminCourant();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Nombre de comptes administrateur — sert à détecter une base non initialisée. */
export async function compterAdmins(): Promise<number> {
  const lignes = await db.select({ id: admins.id }).from(admins);
  return lignes.length;
}
