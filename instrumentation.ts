/**
 * Point d'entrée exécuté une fois au démarrage du serveur Next.js, avant toute
 * requête. C'est l'endroit prévu pour l'initialisation du processus.
 *
 * On y applique les migrations : au premier `docker compose up`, la base est
 * créée et le schéma posé sans aucune commande manuelle.
 */
export async function register() {
  // Le runtime Edge n'a ni système de fichiers ni module natif SQLite : on ne
  // fait rien là-bas (le middleware n'accède jamais à la base, par conception).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { appliquerMigrations } = await import("@/lib/db/migrate");
  appliquerMigrations();
}
