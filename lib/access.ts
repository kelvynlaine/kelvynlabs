import "server-only";

import { asc, eq } from "drizzle-orm";

import { estAdminCourant } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  chapitres,
  formations,
  lecons,
  type Chapitre,
  type Formation,
  type Lecon,
  type Ressource,
} from "@/lib/db/schema";

/* ============================================================================
 *
 *   ⚠️  POINT D'ENTRÉE UNIQUE DU CONTRÔLE D'ACCÈS CLIENT  ⚠️
 *
 *   Ce fichier est le SEUL endroit du projet autorisé à décider si un visiteur
 *   peut voir une formation, une leçon ou un fichier.
 *
 *   RÈGLE ABSOLUE — aucune exception :
 *     · Interdit d'écrire `if (formation.statut === "published")` ailleurs.
 *     · Toute page, route API ou server action servant du contenu à un client
 *       doit d'abord appeler checkAccess() ou checkLeconAccess().
 *     · Cela vaut AUSSI pour ce qui ne rend pas de HTML : URL vidéo, fichier
 *       téléchargeable, marquage de progression. Un paywall qui ne protège que
 *       les pages se contourne en appelant l'API directement.
 *
 *   Cette règle est devenue PLUS importante depuis l'abandon de Supabase.
 *   Auparavant, la RLS constituait un filet de sécurité en base : même si une
 *   page oubliait de vérifier, PostgreSQL refusait de renvoyer un brouillon.
 *   Désormais la base est un fichier local sans notion d'utilisateur : ce
 *   fichier est la SEULE barrière. Il n'y a plus de second rempart.
 *
 *   En contrepartie, la surface d'attaque a diminué : le navigateur ne parle
 *   plus jamais à la base, uniquement au serveur Next.js.
 *
 *   Les emplacements à modifier pour brancher Stripe sont balisés « ÉTAPE STRIPE ».
 *
 * ========================================================================== */

export type RaisonRefus =
  | "introuvable"
  /** Réservé à la V2 : formation payante non achetée. */
  | "paiement_requis"
  /** Réservé à la V2 : contenu réservé aux comptes connectés. */
  | "connexion_requise";

export type ResultatAcces<T> =
  | { autorise: true; donnee: T; apercuAdmin: boolean }
  | { autorise: false; raison: RaisonRefus; formation: Formation | null };

export type LeconResume = Pick<
  Lecon,
  "id" | "titre" | "slug" | "dureeEstimeeMin" | "ordre" | "statut" | "chapitreId"
> & { aUneVideo: boolean };

export type ChapitreAvecLecons = Chapitre & { lecons: LeconResume[] };

export type FormationComplete = Formation & {
  chapitres: ChapitreAvecLecons[];
};

/* -------------------------------------------------------------------------- */
/* Cœur de la décision                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Applique la politique d'accès à une formation déjà chargée.
 *
 * C'est la seule fonction à faire évoluer quand la monétisation arrivera :
 * tout le reste de ce fichier n'est que de la récupération de données.
 */
function evaluerAcces(
  formation: Formation,
  apercuAdmin: boolean,
): { autorise: true } | { autorise: false; raison: RaisonRefus } {
  // L'admin voit tout, brouillons compris : c'est le « mode aperçu ».
  if (apercuAdmin) return { autorise: true };

  // Une formation non publiée n'existe pas du point de vue d'un visiteur.
  // On répond « introuvable » plutôt que « non publiée » : inutile de révéler
  // qu'un brouillon occupe cette adresse.
  if (formation.statut !== "published") {
    return { autorise: false, raison: "introuvable" };
  }

  /* ---- ÉTAPE STRIPE (V2) — décommenter le jour du branchement -------------
   *
   * const estPayante = (formation.prixCents ?? 0) > 0;
   * if (estPayante) {
   *   const student = await getStudentCourant();
   *   if (!student) return { autorise: false, raison: "connexion_requise" };
   *   if (!(await aUnEnrollmentActif(student.id, formation.id))) {
   *     return { autorise: false, raison: "paiement_requis" };
   *   }
   * }
   *
   * ------------------------------------------------------------------------ */

  return { autorise: true };
}

/* -------------------------------------------------------------------------- */
/* API publique                                                               */
/* -------------------------------------------------------------------------- */

type CibleFormation = { slug: string } | { id: string };

/** Charge le sommaire complet d'une formation, sans aucun filtrage d'accès. */
async function chargerSommaire(
  cible: CibleFormation,
): Promise<FormationComplete | null> {
  const formation = await db.query.formations.findFirst({
    where:
      "slug" in cible
        ? eq(formations.slug, cible.slug)
        : eq(formations.id, cible.id),
  });

  if (!formation) return null;

  const [listeChapitres, listeLecons] = await Promise.all([
    db.query.chapitres.findMany({
      where: eq(chapitres.formationId, formation.id),
      orderBy: [asc(chapitres.ordre)],
    }),
    db.query.lecons.findMany({
      where: eq(lecons.formationId, formation.id),
      orderBy: [asc(lecons.ordre)],
      columns: {
        id: true,
        titre: true,
        slug: true,
        dureeEstimeeMin: true,
        ordre: true,
        statut: true,
        chapitreId: true,
        videoUrl: true,
      },
    }),
  ]);

  return {
    ...formation,
    chapitres: listeChapitres.map((chapitre) => ({
      ...chapitre,
      lecons: listeLecons
        .filter((lecon) => lecon.chapitreId === chapitre.id)
        .map(({ videoUrl, ...reste }) => ({
          ...reste,
          aUneVideo: Boolean(videoUrl),
        })),
    })),
  };
}

/**
 * Vérifie l'accès à une formation et renvoie son sommaire.
 *
 * @example
 * const acces = await checkAccess({ slug });
 * if (!acces.autorise) notFound();
 * const formation = acces.donnee;
 */
export async function checkAccess(
  cible: CibleFormation,
): Promise<ResultatAcces<FormationComplete>> {
  const apercuAdmin = await estAdminCourant();
  const complete = await chargerSommaire(cible);

  if (!complete) {
    return { autorise: false, raison: "introuvable", formation: null };
  }

  const verdict = evaluerAcces(complete, apercuAdmin);
  if (!verdict.autorise) {
    return { autorise: false, raison: verdict.raison, formation: complete };
  }

  // Un brouillon de leçon ne doit jamais apparaître dans le sommaire d'un
  // visiteur ; l'admin, lui, les voit avec leur badge « brouillon ».
  const sommaire = complete.chapitres.map((chapitre) => ({
    ...chapitre,
    lecons: chapitre.lecons.filter(
      (lecon) => apercuAdmin || lecon.statut === "published",
    ),
  }));

  return {
    autorise: true,
    apercuAdmin,
    donnee: { ...complete, chapitres: sommaire },
  };
}

export type LeconAvecContexte = {
  lecon: Lecon;
  ressources: Ressource[];
  formation: FormationComplete;
  precedente: LeconResume | null;
  suivante: LeconResume | null;
};

/**
 * Vérifie l'accès à une leçon précise.
 *
 * L'accès à une leçon est TOUJOURS dérivé de l'accès à sa formation : c'est ce
 * qui garantit qu'un futur paywall posé sur la formation protège aussi chacune
 * de ses leçons, sans qu'on ait à y penser leçon par leçon.
 */
export async function checkLeconAccess(
  formationSlug: string,
  leconSlug: string,
): Promise<ResultatAcces<LeconAvecContexte>> {
  const accesFormation = await checkAccess({ slug: formationSlug });
  if (!accesFormation.autorise) return accesFormation;

  const { donnee: formation, apercuAdmin } = accesFormation;

  // Liste à plat dans l'ordre de lecture : sert à la fois à localiser la leçon
  // et à calculer précédente/suivante en une seule passe.
  const parcours = formation.chapitres.flatMap((chapitre) => chapitre.lecons);
  const index = parcours.findIndex((lecon) => lecon.slug === leconSlug);
  const resume = index === -1 ? undefined : parcours[index];

  if (!resume) {
    return { autorise: false, raison: "introuvable", formation };
  }

  const lecon = await db.query.lecons.findFirst({
    where: eq(lecons.id, resume.id),
    with: { ressources: true },
  });

  if (!lecon) {
    return { autorise: false, raison: "introuvable", formation };
  }

  const { ressources: listeRessources, ...donneesLecon } = lecon;

  return {
    autorise: true,
    apercuAdmin,
    donnee: {
      lecon: donneesLecon,
      ressources: [...listeRessources].sort((a, b) => a.ordre - b.ordre),
      formation,
      precedente: parcours[index - 1] ?? null,
      suivante: parcours[index + 1] ?? null,
    },
  };
}

/**
 * Vérifie l'accès à une ressource téléchargeable.
 *
 * Existe pour que la route qui sert les fichiers n'ait pas à réimplémenter la
 * règle : sans elle, un futur paywall protégerait les pages mais pas les PDF,
 * qu'il suffirait alors de télécharger directement.
 */
export async function checkRessourceAccess(
  ressourceId: string,
): Promise<ResultatAcces<Ressource>> {
  const ressource = await db.query.ressources.findFirst({
    where: (t, { eq: egal }) => egal(t.id, ressourceId),
    with: { lecon: true },
  });

  if (!ressource) {
    return { autorise: false, raison: "introuvable", formation: null };
  }

  const apercuAdmin = await estAdminCourant();

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, ressource.lecon.formationId),
  });

  if (!formation) {
    return { autorise: false, raison: "introuvable", formation: null };
  }

  const verdict = evaluerAcces(formation, apercuAdmin);
  if (!verdict.autorise) {
    return { autorise: false, raison: verdict.raison, formation };
  }

  // La leçon doit elle aussi être publiée : une ressource attachée à un
  // brouillon reste privée même si sa formation est publiée.
  if (!apercuAdmin && ressource.lecon.statut !== "published") {
    return { autorise: false, raison: "introuvable", formation };
  }

  const { lecon: _lecon, ...donnees } = ressource;
  return { autorise: true, apercuAdmin, donnee: donnees };
}

/**
 * Formations visibles dans le catalogue.
 *
 * Vit ici et pas ailleurs parce qu'en V2 une formation payante restera listée
 * (c'est une vitrine) alors que son contenu sera verrouillé : les deux règles
 * doivent évoluer ensemble, dans le même fichier.
 */
export type FormationVisible = Formation & {
  nbLecons: number;
  dureeMinutes: number;
  /** Leçons visibles, dans l'ordre : sert de dénominateur à la progression. */
  idsLecons: string[];
};

export async function listerFormationsVisibles(): Promise<FormationVisible[]> {
  const publiees = await db.query.formations.findMany({
    where: eq(formations.statut, "published"),
    orderBy: [asc(formations.ordre), asc(formations.creeLe)],
  });

  if (publiees.length === 0) return [];

  // Une seule requête pour toutes les formations, plutôt qu'une par carte :
  // le catalogue reste à deux requêtes quel que soit le nombre de formations.
  const leconsPubliees = await db.query.lecons.findMany({
    where: eq(lecons.statut, "published"),
    columns: { id: true, formationId: true, dureeEstimeeMin: true },
    orderBy: [asc(lecons.ordre)],
  });

  const parFormation = new Map<string, { ids: string[]; duree: number }>();

  for (const lecon of leconsPubliees) {
    const entree = parFormation.get(lecon.formationId) ?? { ids: [], duree: 0 };
    entree.ids.push(lecon.id);
    entree.duree += lecon.dureeEstimeeMin ?? 0;
    parFormation.set(lecon.formationId, entree);
  }

  return publiees.map((formation) => {
    const entree = parFormation.get(formation.id);
    return {
      ...formation,
      nbLecons: entree?.ids.length ?? 0,
      dureeMinutes: entree?.duree ?? 0,
      idsLecons: entree?.ids ?? [],
    };
  });
}
