import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

/**
 * Identité anonyme d'un visiteur, pour le suivi de progression sans compte.
 *
 * Le cookie contient un UUID aléatoire et RIEN d'autre : ni email, ni
 * empreinte de navigateur, ni identifiant publicitaire. Il ne sert qu'à
 * retrouver « les leçons que CE navigateur a cochées ».
 *
 * ⚠️ Il est httpOnly : le JavaScript de la page ne peut pas le lire. C'est ce
 * qui empêche un visiteur de se faire passer pour un autre en forgeant la
 * valeur — les écritures de progression passent donc toutes par le serveur.
 *
 * ⚠️ Le cookie n'est PAS posé à la simple visite. Il n'est créé qu'au premier
 * geste qui en a besoin (cocher une leçon). Quelqu'un qui parcourt le
 * catalogue sans rien cocher repart sans aucun cookie : c'est ce qui permet de
 * le qualifier de strictement fonctionnel, et donc de se passer d'une bannière
 * de consentement.
 */

export const COOKIE_VISITEUR = "kl_visiteur";

const UN_AN_EN_SECONDES = 365 * 24 * 60 * 60;

/** Identifiant du visiteur courant, ou null s'il n'a encore rien coché. */
export async function getIdentifiantVisiteur(): Promise<string | null> {
  const store = await cookies();
  const valeur = store.get(COOKIE_VISITEUR)?.value;

  // Contrôle de forme : une valeur bricolée à la main ne doit pas se retrouver
  // telle quelle dans une requête.
  if (!valeur || !/^[0-9a-f-]{36}$/i.test(valeur)) return null;

  return valeur;
}

/**
 * Identifiant du visiteur, créé au besoin.
 *
 * ⚠️ Écrit un cookie : n'est appelable que depuis une server action ou un
 * route handler. Un Server Component ne peut pas écrire de cookie et l'appel
 * y échouerait silencieusement.
 */
export async function assurerIdentifiantVisiteur(): Promise<string> {
  const existant = await getIdentifiantVisiteur();
  if (existant) return existant;

  const identifiant = randomUUID();
  const store = await cookies();

  store.set(COOKIE_VISITEUR, identifiant, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UN_AN_EN_SECONDES,
  });

  return identifiant;
}
