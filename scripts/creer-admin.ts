/**
 * Création (ou réinitialisation) du compte administrateur.
 *
 *   npm run admin:creer -- vous@exemple.fr "votre-mot-de-passe"
 *
 * Remplace le « Bootstrap admin » qui passait par le dashboard Supabase.
 * Le mot de passe peut aussi être fourni via la variable MOT_DE_PASSE, ce qui
 * évite de le laisser dans l'historique du shell :
 *
 *   MOT_DE_PASSE='…' npm run admin:creer -- vous@exemple.fr
 */
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appliquerMigrations } from "@/lib/db/migrate";
import { admins } from "@/lib/db/schema";
import { hacherMotDePasse } from "@/lib/mot-de-passe";

const LONGUEUR_MIN = 12;

async function principal() {
  const [emailBrut] = process.argv.slice(2);
  const motDePasse = process.env.MOT_DE_PASSE ?? process.argv[3];

  if (!emailBrut || !motDePasse) {
    console.error(
      "Usage : npm run admin:creer -- <email> <mot-de-passe>\n" +
        "   ou : MOT_DE_PASSE='…' npm run admin:creer -- <email>",
    );
    process.exit(1);
  }

  const email = emailBrut.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Adresse email invalide : ${email}`);
    process.exit(1);
  }

  if (motDePasse.length < LONGUEUR_MIN) {
    console.error(
      `Mot de passe trop court (${motDePasse.length} caractères, minimum ${LONGUEUR_MIN}).\n` +
        `C'est le seul rempart devant votre espace d'administration.`,
    );
    process.exit(1);
  }

  // La base peut ne pas exister encore : on pose le schéma avant d'écrire.
  appliquerMigrations();

  const hash = await hacherMotDePasse(motDePasse);

  const existant = await db.query.admins.findFirst({
    where: (t) => sql`lower(${t.email}) = ${email}`,
  });

  if (existant) {
    await db
      .update(admins)
      .set({ motDePasseHash: hash })
      .where(eq(admins.id, existant.id));
    console.log(`✓ Mot de passe réinitialisé pour ${email}`);
  } else {
    await db.insert(admins).values({ email, motDePasseHash: hash });
    console.log(`✓ Compte administrateur créé : ${email}`);
  }

  console.log("  Connexion : /admin/login");
}

principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
