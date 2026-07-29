/**
 * Application des migrations, exécutée AVANT le démarrage du serveur.
 *
 * Pourquoi un script séparé, et en JavaScript brut :
 *
 *   1. Les migrations lisent le disque (`node:fs`, `node:path`). Tant qu'elles
 *      étaient déclenchées depuis `instrumentation.ts`, les deux bundlers de
 *      Next les tiraient dans la compilation du runtime EDGE — où ces modules
 *      n'existent pas. Turbopack échouait en tentant de parser un fichier
 *      LICENSE de libSQL, webpack sur « Reading from node:fs is not handled ».
 *      Sortir les migrations du graphe de l'application supprime les deux.
 *
 *   2. En `.mjs` et sans TypeScript : l'image de production n'embarque pas
 *      tsx. Ce script doit tourner avec le seul `node` disponible sur l'hôte.
 *
 * Il est idempotent : Drizzle tient un journal des migrations déjà appliquées.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Détecte un hébergement dont le disque est recréé à chaque déploiement.
 *
 * Sur ce type de plateforme, le projet est reconstruit depuis git : tout ce
 * qui a été écrit sur le disque de l'application disparaît. Un fichier SQLite
 * local y serait effacé à chaque mise en ligne, avec toutes les formations —
 * et le symptôme n'apparaît qu'AU DEUXIÈME déploiement, quand le contenu a
 * déjà été saisi. C'est exactement le genre de panne qu'il faut rendre
 * impossible plutôt que documenter.
 */
function disqueProbablementEphemere() {
  // Un hébergement mutualisé n'est éphémère qu'en APPARENCE : le sous-arbre du
  // site est remplacé à chaque mise en ligne, mais le dossier du compte
  // survit. Dès qu'on en détecte un, les données y sont placées et il n'y a
  // plus rien à craindre.
  if (racineCompteMutualise()) return false;

  const indices = [
    Boolean(process.env.VERCEL),
    Boolean(process.env.NETLIFY),
    Boolean(process.env.RENDER),
    Boolean(process.env.RAILWAY_ENVIRONMENT),
  ];

  return indices.some(Boolean);
}

/**
 * ⚠️ Doit rester identique à `racineCompteMutualise()` dans `lib/chemins.ts`.
 * Le script tourne en JavaScript brut, hors du graphe de modules de
 * l'application : il ne peut pas importer la version TypeScript. Si l'une des
 * deux change, changez l'autre — sinon le script migrerait un fichier que le
 * serveur n'ouvre pas.
 */
function racineCompteMutualise() {
  const correspondance = /^(\/home\/[^/]+)\/domains\//.exec(process.cwd());
  return correspondance?.[1] ?? null;
}

/** ⚠️ Doit rester identique à `dossierDonnees()` dans `lib/chemins.ts`. */
function dossierDonnees() {
  const configure = process.env.DOSSIER_DONNEES?.trim();
  if (configure) return resolve(configure);

  const compte = racineCompteMutualise();
  if (compte) return join(compte, ".kelvynlabs-data");

  return resolve(".data");
}

function configuration() {
  const distante = process.env.DATABASE_URL?.trim();

  if (distante) {
    return {
      url: distante,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
      description: "base distante",
    };
  }

  // Refuser de démarrer vaut infiniment mieux que de démarrer, accepter du
  // contenu, puis l'effacer au déploiement suivant sans prévenir.
  if (disqueProbablementEphemere() && process.env.AUTORISER_BASE_EPHEMERE !== "1") {
    console.error(
      [
        "",
        "✗ REFUS DE DÉMARRER — risque de perte de données",
        "",
        "  Cet hébergement reconstruit l'application à chaque déploiement :",
        "  le disque est recréé, et une base SQLite locale y serait effacée",
        "  à chaque mise en ligne, avec toutes vos formations.",
        "",
        "  Renseignez une base distante :",
        "",
        "      DATABASE_URL=libsql://votre-base.turso.io",
        "      DATABASE_AUTH_TOKEN=...",
        "",
        "  (Turso propose un niveau gratuit. Voir README, section",
        "  « Où vivent les données ».)",
        "",
        "  Si vous savez ce que vous faites et acceptez de perdre les données",
        "  à chaque déploiement, posez AUTORISER_BASE_EPHEMERE=1.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const chemin = join(dossierDonnees(), "kelvynlabs.db");
  mkdirSync(dirname(chemin), { recursive: true });

  return { url: `file:${chemin}`, description: `fichier local ${chemin}` };
}

async function principal() {
  /*
   * Mode « optionnel », utilisé pendant le BUILD.
   *
   * Beaucoup d'hébergements managés lancent leur propre commande de démarrage
   * et court-circuitent `npm start` — donc ce script. Le lancer aussi pendant
   * le build garantit que les migrations s'appliquent au moins une fois, tant
   * que la base est distante (donc joignable à ce moment-là).
   *
   * Sur un build LOCAL sans base distante, on ne fait rien : la base locale
   * n'est pas celle qui servira à l'exécution, et `npm start` prendra le
   * relais avec son garde-fou.
   *
   * Sur un hébergement éphémère, en revanche, il faut échouer ICI. Le
   * garde-fou de `configuration()` ne protège que `npm start` — jamais
   * exécuté quand la plateforme impose sa propre commande de démarrage. Sans
   * cet arrêt, le déploiement « réussit » et met en ligne un site dont chaque
   * page d'administration renvoie 500, ce qui est le pire des retours : vert
   * côté hébergeur, cassé côté visiteur.
   */
  if (process.argv.includes("--optionnel") && !process.env.DATABASE_URL?.trim()) {
    if (!disqueProbablementEphemere() || process.env.AUTORISER_BASE_EPHEMERE === "1") {
      console.log("→ Migrations ignorées (pas de base distante configurée)");
      return;
    }

    console.error(
      [
        "",
        "✗ BUILD INTERROMPU — DATABASE_URL manquante",
        "",
        "  Cet hébergement recrée le disque à chaque déploiement. Sans base",
        "  distante, l'application démarrerait sur un fichier SQLite vide :",
        "  l'accueil s'afficherait, mais /admin renverrait 500 et le moindre",
        "  contenu saisi disparaîtrait au déploiement suivant.",
        "",
        "  Renseignez dans les variables d'environnement de votre hébergeur :",
        "",
        "      DATABASE_URL=libsql://votre-base.turso.io",
        "      DATABASE_AUTH_TOKEN=...",
        "",
        "  (Turso propose un niveau gratuit. Voir README, section",
        "  « Où vivent les données ».)",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const dossierMigrations = join(process.cwd(), "drizzle");

  if (!existsSync(dossierMigrations)) {
    console.error(
      `✗ Dossier de migrations introuvable : ${dossierMigrations}\n` +
        `  Vérifiez qu'il est bien déployé avec l'application.`,
    );
    process.exit(1);
  }

  const config = configuration();
  console.log(`→ Migrations sur ${config.description}`);

  const client = createClient({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  });

  await migrate(drizzle(client), { migrationsFolder: dossierMigrations });
  client.close();

  console.log("✓ Base à jour");
}

principal().catch((erreur) => {
  console.error("✗ Migration échouée :", erreur);
  process.exit(1);
});
