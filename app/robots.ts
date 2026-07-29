import type { MetadataRoute } from "next";

import { urlSite } from "@/lib/url-site";

/**
 * Directives pour les robots d'indexation.
 *
 * L'administration et les routes de fichiers sont exclues. Ce n'est PAS une
 * mesure de sécurité — robots.txt n'empêche personne d'y accéder — mais cela
 * évite que des adresses privées se retrouvent dans les résultats de
 * recherche, et épargne au serveur l'exploration de contenus inutiles.
 * La protection réelle reste requireAdmin() et checkAccess().
 */
/**
 * Rendu à la demande, et non à la compilation : l'URL du plan de site est
 * déduite des en-têtes de la requête quand `NEXT_PUBLIC_SITE_URL` est absente.
 * En statique, il n'y a pas de requête — le fichier annoncerait `localhost`.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${await urlSite()}/sitemap.xml`,
  };
}
