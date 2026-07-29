import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

/**
 * Directives pour les robots d'indexation.
 *
 * L'administration et les routes de fichiers sont exclues. Ce n'est PAS une
 * mesure de sécurité — robots.txt n'empêche personne d'y accéder — mais cela
 * évite que des adresses privées se retrouvent dans les résultats de
 * recherche, et épargne au serveur l'exploration de contenus inutiles.
 * La protection réelle reste requireAdmin() et checkAccess().
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
