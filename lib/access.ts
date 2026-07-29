import "server-only";

import { asc, eq } from "drizzle-orm";

import { estAdminCourant } from "@/lib/auth";
import { db } from "@/lib/db";
import { aUnEnrollmentActif, getStudentCourant } from "@/lib/etudiant";
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
 *   Depuis la Phase 5, cette fonction décide AUSSI du paiement : une formation
 *   payante n'est accessible qu'à un client dont l'enrollment est actif. Le
 *   verrou vaut donc pour tout ce qui passe par ici — pages, fichiers
 *   téléchargeables, progression — sans qu'aucun appelant n'ait été modifié.
 *
 * ========================================================================== */

export type RaisonRefus =
  | "introuvable"
  /**
   * Formation payante non achetée PAR CE VISITEUR.
   *
   * Recouvre deux situations que l'interface distingue : le visiteur n'a rien
   * acheté (on lui propose de payer), ou il a acheté depuis un autre appareil
   * (on lui propose de se connecter). Le refus, lui, est le même.
   */
  | "paiement_requis";

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
 * C'est la seule fonction qui décide. Tout le reste de ce fichier n'est que de
 * la récupération de données.
 */
async function evaluerAcces(
  formation: Formation,
  apercuAdmin: boolean,
): Promise<{ autorise: true } | { autorise: false; raison: RaisonRefus }> {
  // L'admin voit tout, brouillons compris : c'est le « mode aperçu ».
  if (apercuAdmin) return { autorise: true };

  // Une formation non publiée n'existe pas du point de vue d'un visiteur.
  // On répond « introuvable » plutôt que « non publiée » : inutile de révéler
  // qu'un brouillon occupe cette adresse.
  if (formation.statut !== "published") {
    return { autorise: false, raison: "introuvable" };
  }

  /* ---- Formations payantes ----------------------------------------------
   *
   * C'est ICI, et uniquement ici, que le paiement conditionne l'accès. Toutes
   * les pages, toutes les routes de fichiers et l'enregistrement de la
   * progression passent par cette fonction : verrouiller ici verrouille tout
   * d'un coup, y compris les endpoints qui ne rendent pas de HTML.
   *
   * Une formation dont le prix est nul ou absent reste entièrement gratuite —
   * le comportement d'avant Stripe est donc strictement préservé.
   */
  const estPayante = (formation.prixCents ?? 0) > 0;
  if (!estPayante) return { autorise: true };

  /*
   * ⚠️ NE REMETTEZ PAS DE TEST SUR LA CONFIGURATION DE STRIPE ICI.
   *
   * Une version antérieure refusait l'accès dès que `stripeEstConfigure()`
   * était faux, AVANT même de regarder si le visiteur avait acheté. L'intention
   * était bonne — ne pas offrir un contenu destiné à être vendu — mais l'effet
   * était de verrouiller les clients qui avaient réellement payé, dès que les
   * clés Stripe manquaient : rotation de clés, bascule test → production, ou
   * simple variable d'environnement perdue lors d'un redéploiement. Tous les
   * clients payants perdaient l'accès en même temps, sans aucun signal.
   *
   * Ce test était de surcroît INUTILE : l'exigence d'un enrollment actif,
   * juste en dessous, refuse déjà l'accès à qui n'a pas acheté. La
   * configuration de Stripe décide de la possibilité de VENDRE, jamais de
   * l'honorer d'un achat déjà conclu. Ce sont deux questions distinctes, et
   * seule la seconde a sa place dans un contrôle d'accès.
   */
  const student = await getStudentCourant();
  if (!student) return { autorise: false, raison: "paiement_requis" };

  const inscrit = await aUnEnrollmentActif(student.id, formation.id);
  if (!inscrit) return { autorise: false, raison: "paiement_requis" };

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

  const verdict = await evaluerAcces(complete, apercuAdmin);
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

/**
 * Données de VITRINE d'une formation payante non achetée.
 *
 * Une formation verrouillée ne doit pas renvoyer un 404 : le visiteur doit
 * pouvoir voir ce qu'il achète. Cette fonction expose délibérément le titre,
 * la description, le prix et le PROGRAMME — c'est-à-dire les titres des
 * chapitres et des leçons, leur durée, rien de plus.
 *
 * ⚠️ Elle ne donne jamais accès au CONTENU : ni texte de leçon, ni vidéo, ni
 * ressource. `FormationComplete` ne transporte que des intitulés — c'est ce
 * qui rend cette exposition sûre. Ne l'élargissez pas sans y repenser.
 *
 * Renvoie null si la formation n'existe pas ou n'est pas publiée : la vitrine
 * ne contourne pas la règle de publication.
 */
export async function getVitrineFormation(
  slug: string,
): Promise<FormationComplete | null> {
  const complete = await chargerSommaire({ slug });
  if (!complete || complete.statut !== "published") return null;

  return {
    ...complete,
    chapitres: complete.chapitres.map((chapitre) => ({
      ...chapitre,
      lecons: chapitre.lecons.filter((lecon) => lecon.statut === "published"),
    })),
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

  const verdict = await evaluerAcces(formation, apercuAdmin);
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

/**
 * Formations auxquelles le client connecté a réellement accès.
 *
 * Elle vit ICI, et non dans une page, parce qu'elle répond à une question
 * d'accès : « à quoi cette personne a-t-elle droit ? ». La règle de visibilité
 * — seules les formations publiées — reste ainsi appliquée au même endroit que
 * partout ailleurs. Une formation dépubliée après un achat disparaît donc de
 * la liste, comme elle disparaît du catalogue.
 */
export async function listerFormationsDuClient(): Promise<FormationVisible[]> {
  const student = await getStudentCourant();
  if (!student) return [];

  const lignes = await db.query.enrollments.findMany({
    where: (t, { and: et, eq: egal }) =>
      et(egal(t.studentId, student.id), egal(t.statut, "actif")),
    columns: { formationId: true },
  });

  if (lignes.length === 0) return [];

  const achetees = new Set(lignes.map((ligne) => ligne.formationId));
  const visibles = await listerFormationsVisibles();

  return visibles.filter((formation) => achetees.has(formation.id));
}
