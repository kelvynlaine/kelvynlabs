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

  /* --- Stripe : optionnel tant qu'aucune formation n'est payante. --------
   *
   * Tant que ces variables sont absentes, la plateforme fonctionne
   * exactement comme avant : les formations avec un prix affichent
   * « Achat à venir » au lieu d'un bouton de paiement. Aucune page ne casse.
   */
  STRIPE_SECRET_KEY: z
    .string()
    .startsWith("sk_", "La clé secrète Stripe commence par sk_test_ ou sk_live_")
    .optional(),

  /**
   * Secret de signature du webhook (`whsec_…`).
   *
   * ⚠️ Sans lui, la route webhook REFUSE toute requête. C'est délibéré :
   * un webhook non vérifié laisserait n'importe qui poster un faux
   * « paiement réussi » et s'offrir toutes les formations.
   */
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .startsWith("whsec_", "Le secret de webhook Stripe commence par whsec_")
    .optional(),
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

/**
 * Stripe n'est utilisable que si la clé secrète ET le secret de webhook sont
 * présents.
 *
 * Exiger les deux est volontaire : avec la seule clé secrète, on pourrait
 * encaisser un paiement sans jamais recevoir la confirmation qui débloque
 * l'accès. Un client payerait sans rien recevoir — le pire des deux mondes.
 */
export function stripeEstConfigure(): boolean {
  const e = getServerEnv();
  return Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET);
}

/** Vrai si les clés utilisées sont celles du mode test. */
export function stripeEstEnModeTest(): boolean {
  return getServerEnv().STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
}
