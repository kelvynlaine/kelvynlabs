import "server-only";

import { z } from "zod";

/**
 * Variables d'environnement serveur.
 *
 * Depuis l'abandon de Supabase, il n'y a plus AUCUN secret obligatoire : la
 * base est un fichier local et l'authentification repose sur des jetons
 * aléatoires stockés en base. Moins de secrets à gérer, moins de secrets à
 * faire fuiter.
 *
 * `server-only` fait échouer le build si un composant client importe ce
 * module, même indirectement.
 */
const schema = z.object({
  /**
   * Dossier des données persistantes (base SQLite + uploads).
   *
   * ⚠️ En production, il DOIT pointer vers un volume qui survit aux
   * redéploiements — sinon un `git pull` efface toutes les formations.
   * Voir docker-compose.yml.
   */
  DOSSIER_DONNEES: z.string().optional(),

  /** Provider vidéo proposé par défaut dans l'admin. */
  VIDEO_PROVIDER_DEFAULT: z.enum(["youtube", "bunny"]).default("youtube"),

  /* --- Bunny.net Stream : optionnel tant qu'on reste sur YouTube. --- */
  BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
  BUNNY_STREAM_API_KEY: z.string().optional(),
  BUNNY_STREAM_CDN_HOSTNAME: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cache: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cache) return cache;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  · ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides.\n${details}`);
  }

  cache = parsed.data;
  return cache;
}

/** Bunny n'est utilisable que si les trois variables sont présentes. */
export function bunnyEstConfigure(): boolean {
  const e = getServerEnv();
  return Boolean(
    e.BUNNY_STREAM_LIBRARY_ID && e.BUNNY_STREAM_API_KEY && e.BUNNY_STREAM_CDN_HOSTNAME,
  );
}
