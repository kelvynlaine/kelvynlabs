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
   * libSQL charge un binaire natif précompilé (.node) : il ne peut pas être
   * empaqueté par le bundler. Ces entrées demandent à Next de le charger
   * depuis node_modules à l'exécution.
   *
   * Contrairement à better-sqlite3, ce binaire est FOURNI DÉJÀ COMPILÉ : rien
   * à construire sur la machine de déploiement, donc ni Python ni compilateur
   * C++ requis — c'est précisément ce qui faisait échouer le déploiement
   * Hostinger.
   *
   * ⚠️ Le build de production utilise webpack (`next build`), pas Turbopack.
   * `node_modules/libsql/index.js` résout son binaire par un require dynamique
   * — `require(\`@libsql/${target}\`)` — que Turbopack transforme en « context
   * module » sur tout `node_modules/@libsql/`, jusqu'à tenter de parser les
   * fichiers LICENSE comme du JavaScript. webpack, lui, respecte
   * `serverExternalPackages` et n'y entre pas. Le mode développement reste sur
   * Turbopack, où le problème ne se pose pas.
   */
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/core",
    "@libsql/hrana-client",
    "@libsql/isomorphic-ws",
    "@libsql/isomorphic-fetch",
    "libsql",
  ],

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
