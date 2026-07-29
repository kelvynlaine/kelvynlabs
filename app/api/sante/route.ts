import { NextResponse } from "next/server";

import { donneesHorsRepertoireDeploiement } from "@/lib/chemins";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { nomBackendEmail } from "@/lib/email";
import { stripeEstConfigure } from "@/lib/env.server";
import { nomStockage } from "@/lib/stockage";

/**
 * Sonde de santé, utilisée par le HEALTHCHECK Docker et par vous en cas de
 * doute après un déploiement.
 *
 * Elle interroge RÉELLEMENT la base : un serveur qui répond mais dont la base
 * est inaccessible est un serveur en panne, même s'il renvoie du HTML.
 *
 * Quand quelque chose ne va pas, elle dit QUOI. Un « degrade » sans explication
 * oblige à fouiller les logs de l'hébergeur — souvent les moins accessibles au
 * moment où l'on en a besoin.
 *
 * ⚠️ Elle ne divulgue jamais d'URL, de jeton ni de chemin : seulement la
 * nature du problème et le geste qui le corrige.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostic = {
    base: "inconnu" as string,
    stockage: "inconnu" as string,
    persistance: "inconnu" as string,
    paiement: stripeEstConfigure() ? "configuré" : "non configuré",
    /*
     * Sans fournisseur d'email, les clients ne peuvent PAS se connecter depuis
     * un autre appareil : le lien de connexion n'est jamais envoyé. C'est le
     * genre de panne qu'aucun visiteur ne signale — on la voit ici.
     */
    email: "inconnu" as string,
  };

  try {
    diagnostic.email = nomBackendEmail();
  } catch {
    diagnostic.email = "indéterminé";
  }

  try {
    diagnostic.stockage = nomStockage() === "s3" ? "objet (S3)" : "disque local";
  } catch {
    diagnostic.stockage = "indéterminé";
  }

  /*
   * La seule question qui compte après un déploiement : ce que j'ai saisi
   * sera-t-il encore là après le prochain ? On y répond sans divulguer le
   * moindre chemin — l'emplacement exact n'a pas à être public.
   */
  try {
    if (process.env.DATABASE_URL?.trim()) {
      diagnostic.persistance = "base distante";
    } else {
      diagnostic.persistance = donneesHorsRepertoireDeploiement()
        ? "hors du répertoire de déploiement (survit aux mises en ligne)"
        : "DANS le répertoire de déploiement (effacé à chaque mise en ligne)";
    }
  } catch {
    diagnostic.persistance = "indéterminé";
  }

  try {
    await db.select({ id: admins.id }).from(admins).limit(1);
    diagnostic.base = "ok";

    return NextResponse.json({ statut: "ok", ...diagnostic });
  } catch (erreur) {
    // ⚠️ Drizzle enveloppe l'erreur du driver : son `message` ne dit que
    // « Failed query: … ». Le motif réel — « no such table » — n'apparaît que
    // dans `cause`. Ne regarder que le message classait donc tout schéma
    // manquant en panne de connexion, et envoyait chercher au mauvais endroit.
    const messages: string[] = [];
    let courante: unknown = erreur;

    for (let i = 0; i < 5 && courante instanceof Error; i++) {
      messages.push(courante.message);
      courante = courante.cause;
    }

    const message = messages.join(" | ") || String(erreur);

    // Base joignable mais schéma absent : symptôme d'un déploiement dont les
    // migrations n'ont pas tourné. Le distinguer d'une panne de connexion fait
    // gagner beaucoup de temps.
    const schemaManquant = /no such table|does not exist|SQLITE_UNKNOWN/i.test(message);

    // Depuis que l'application applique ses migrations elle-même à la première
    // requête, un schéma absent ne signifie plus « migrations oubliées » mais
    // « migrations refusées » — typiquement un dossier de données non
    // inscriptible. La distinction change entièrement où l'on doit chercher.
    diagnostic.base = schemaManquant
      ? "connectée, mais SCHÉMA ABSENT — la migration automatique a échoué"
      : "INJOIGNABLE — vérifiez DATABASE_URL et DATABASE_AUTH_TOKEN";

    console.error("[sante] base indisponible :", message);

    return NextResponse.json(
      {
        statut: "degrade",
        ...diagnostic,
        correction: schemaManquant
          ? "Vérifiez que le dossier de données est inscriptible (DOSSIER_DONNEES)."
          : "Vérifiez les variables d'environnement de la base dans votre hébergeur.",
      },
      { status: 503 },
    );
  }
}
