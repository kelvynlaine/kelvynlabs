import { isAbsolute, join, normalize, resolve, sep } from "node:path";

/**
 * Emplacements sur disque des données persistantes.
 *
 * Tout ce que produit l'application (base SQLite, fichiers uploadés) vit sous
 * un dossier unique, `DOSSIER_DONNEES`, VOLONTAIREMENT SITUÉ HORS DU DÉPÔT GIT.
 *
 * C'est le point critique du déploiement : sur le VPS, ce dossier doit être un
 * volume monté qui SURVIT aux redéploiements. S'il pointait à l'intérieur du
 * projet, un `git pull` suivi d'un rebuild effacerait toutes les formations.
 */

const DEFAUT = ".data";

export function dossierDonnees(): string {
  const configure = process.env.DOSSIER_DONNEES?.trim();
  return resolve(configure && configure.length > 0 ? configure : DEFAUT);
}

export function cheminBaseDeDonnees(): string {
  return join(dossierDonnees(), "kelvynlabs.db");
}

export function dossierUploads(): string {
  return join(dossierDonnees(), "uploads");
}

/**
 * Résout un chemin de fichier stocké en base vers son emplacement réel.
 *
 * ⚠️ Barrière anti-traversée de répertoire. Un chemin comme
 * `../../etc/passwd` ou `/etc/passwd` doit être rejeté : sans cette
 * vérification, la route qui sert les fichiers deviendrait une primitive de
 * lecture arbitraire sur tout le disque du serveur.
 */
export function resoudreCheminUpload(cheminRelatif: string): string | null {
  if (!cheminRelatif || isAbsolute(cheminRelatif)) return null;

  // Un octet nul tronque les chaînes dans les appels système sous-jacents :
  // il ne doit jamais atteindre le système de fichiers.
  if (cheminRelatif.includes("\0")) return null;

  const base = dossierUploads();
  const resolu = resolve(base, normalize(cheminRelatif));

  // Le chemin résolu doit rester strictement à l'intérieur du dossier
  // d'uploads. Le séparateur final évite qu'un dossier voisin nommé
  // « uploads-public » soit accepté par simple préfixe.
  if (resolu !== base && !resolu.startsWith(base + sep)) return null;

  return resolu;
}
