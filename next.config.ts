import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Build autonome : Next produit un dossier `.next/standalone` contenant le
   * serveur et uniquement les dépendances réellement utilisées. C'est ce qui
   * permet une image Docker de quelques dizaines de Mo au lieu d'embarquer
   * tout `node_modules`.
   */
  output: "standalone",

  /**
   * better-sqlite3 est un module NATIF (.node) : il ne peut pas être empaqueté
   * par le bundler. Cette ligne demande à Next de le charger depuis
   * node_modules à l'exécution — sans elle, le build échoue.
   */
  serverExternalPackages: ["better-sqlite3"],

  images: {
    // Les images sont servies par notre propre route (/api/fichiers), sur la
    // même origine : aucun domaine distant à autoriser.
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Empêche le navigateur de « deviner » un type MIME différent de
          // celui annoncé — vecteur classique d'exécution de fichier uploadé.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Interdit l'affichage du site dans une iframe tierce (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
