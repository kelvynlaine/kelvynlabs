/**
 * Nom du cookie de session, isolé dans son propre module.
 *
 * Pourquoi ne pas le lire depuis `lib/auth.ts` : ce dernier importe
 * `server-only` et le driver SQLite natif. Le middleware, qui tourne sur le
 * runtime Edge, ne peut donc pas l'importer. Cette constante doit rester
 * partageable entre les deux mondes — d'où ce fichier volontairement vide de
 * toute dépendance.
 */
export const COOKIE_SESSION = "kl_session";
