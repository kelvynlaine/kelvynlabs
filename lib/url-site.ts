import "server-only";

import { headers } from "next/headers";

import { siteConfig } from "@/lib/site-config";

/**
 * URL publique du site, côté serveur.
 *
 * `NEXT_PUBLIC_SITE_URL` reste la source de vérité. Elle est simplement
 * devenue FACULTATIVE : à défaut, on déduit l'URL des en-têtes de la requête.
 *
 * Pourquoi cette reprise vaut la peine : sans elle, un déploiement où la
 * variable a été oubliée produit un plan de site et des URL canoniques
 * pointant vers `http://localhost:3000`. C'est invisible à l'œil — les pages
 * s'affichent normalement — mais les moteurs de recherche indexent des liens
 * morts et les redirections de paiement mènent nulle part. Une panne
 * silencieuse de plus, exactement le genre qu'on cherche à supprimer ici.
 *
 * ⚠️ La reprise fait confiance à l'en-tête `Host`, que le client contrôle.
 * C'est acceptable pour un plan de site, pas pour construire un lien qu'on
 * enverrait par courriel : renseignez la variable dès que le domaine
 * définitif est connu. Voir README, section déploiement.
 */
export async function urlSite(): Promise<string> {
  const configuree = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuree) return configuree.replace(/\/+$/, "");

  try {
    const entetes = await headers();
    const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");

    if (hote) {
      const protocole =
        entetes.get("x-forwarded-proto") ??
        (hote.startsWith("localhost") || hote.startsWith("127.0.0.1") ? "http" : "https");

      return `${protocole}://${hote}`;
    }
  } catch {
    // `headers()` n'est pas disponible en rendu statique. La valeur de repli
    // ci-dessous suffit : les routes qui comptent sont toutes dynamiques.
  }

  return siteConfig.url.replace(/\/+$/, "");
}
