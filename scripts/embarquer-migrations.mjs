/**
 * Transforme les fichiers `drizzle/*.sql` en un module TypeScript.
 *
 * POURQUOI EMBARQUER LE SQL PLUTÔT QUE LE LIRE SUR DISQUE
 *
 * Le migrateur de Drizzle lit le dossier `drizzle/` avec `node:fs`. Cela
 * suppose deux choses qui ne sont vraies ni l'une ni l'autre sur un
 * hébergement Node.js managé :
 *
 *   1. que le dossier `drizzle/` soit déployé à côté du serveur compilé —
 *      Next ne copie dans `standalone` que ce que le graphe de modules
 *      référence, et un dossier lu dynamiquement n'en fait pas partie ;
 *   2. que le code qui l'appelle ne soit jamais tiré dans la compilation du
 *      runtime Edge, où `node:fs` n'existe pas. C'est précisément ce qui
 *      faisait échouer le build via `instrumentation.ts`.
 *
 * Une fois le SQL devenu une simple constante, les deux problèmes
 * disparaissent : plus de lecture disque, plus de dossier à déployer, et le
 * module est bundlable sur n'importe quel runtime.
 *
 * Le fichier produit est committé pour que `npm ci && npm run build` suffise,
 * et régénéré à chaque build : il ne peut donc pas dériver du SQL réel.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const racine = process.cwd();
const dossier = join(racine, "drizzle");
const sortie = join(racine, "lib", "db", "migrations.generees.ts");

const journal = JSON.parse(readFileSync(join(dossier, "meta", "_journal.json"), "utf8"));

const migrations = journal.entries
  .sort((a, b) => a.idx - b.idx)
  .map((entree) => {
    const sql = readFileSync(join(dossier, `${entree.tag}.sql`), "utf8");

    // Drizzle sépare les instructions par ce marqueur. Les exécuter une par
    // une est nécessaire : libSQL n'accepte qu'une instruction par `execute`.
    const instructions = sql
      .split("--> statement-breakpoint")
      .map((bloc) => bloc.trim())
      .filter((bloc) => bloc.length > 0);

    // `when` est l'horodatage que drizzle-kit écrit dans `__drizzle_migrations`
    // sous le nom `created_at`. Le conserver permet de reconnaître au
    // timestamp près ce qu'une base déjà migrée par drizzle-kit a reçu, sans
    // se contenter de compter les lignes.
    return { idx: entree.idx, tag: entree.tag, quand: entree.when, instructions };
  });

const corps = migrations
  .map(
    (m) =>
      `  {\n` +
      `    idx: ${m.idx},\n` +
      `    tag: ${JSON.stringify(m.tag)},\n` +
      `    quand: ${m.quand},\n` +
      `    instructions: [\n` +
      m.instructions.map((i) => `      ${JSON.stringify(i)},`).join("\n") +
      `\n    ],\n` +
      `  },`,
  )
  .join("\n");

const contenu = `/**
 * FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.
 *
 * Produit par \`scripts/embarquer-migrations.mjs\` à partir de \`drizzle/*.sql\`.
 * Pour le mettre à jour : \`npm run db:embarquer\` (fait automatiquement au build).
 */

export type MigrationEmbarquee = {
  readonly idx: number;
  readonly tag: string;
  /** Horodatage du journal drizzle-kit (\`__drizzle_migrations.created_at\`). */
  readonly quand: number;
  readonly instructions: readonly string[];
};

export const migrationsEmbarquees: readonly MigrationEmbarquee[] = [
${corps}
] as const;
`;

writeFileSync(sortie, contenu, "utf8");

const total = migrations.reduce((n, m) => n + m.instructions.length, 0);
console.log(`✓ ${migrations.length} migrations embarquées (${total} instructions)`);
