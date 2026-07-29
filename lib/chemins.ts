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

/**
 * Détecte l'espace de compte d'un hébergement mutualisé, quand il y en a un.
 *
 * Sur ce type d'hébergement (Hostinger, cPanel, Plesk…), l'application vit
 * sous `/home/<compte>/domains/<site>/…`. Chaque mise en ligne REMPLACE ce
 * sous-arbre — c'est ce qui effaçait la base — mais le dossier du compte,
 * lui, survit : c'est le même système de fichiers d'un déploiement à l'autre.
 *
 * Y placer les données transforme un hébergement qu'on croyait éphémère en
 * hébergement persistant, et supprime le besoin d'une base distante.
 *
 * On exige la forme complète `/home/<compte>/domains/` plutôt que le seul
 * segment `domains` : sur un VPS où le projet serait rangé sous
 * `/srv/domains/…`, écrire dans `/srv` serait présomptueux.
 */
export function racineCompteMutualise(): string | null {
  const correspondance = /^(\/home\/[^/]+)\/domains\//.exec(process.cwd());
  return correspondance?.[1] ?? null;
}

export function dossierDonnees(): string {
  const configure = process.env.DOSSIER_DONNEES?.trim();
  if (configure && configure.length > 0) return resolve(configure);

  const compte = racineCompteMutualise();
  if (compte) return join(compte, ".kelvynlabs-data");

  return resolve(DEFAUT);
}

/**
 * Vrai si les données sont hors du répertoire de déploiement, donc si elles
 * survivront à la prochaine mise en ligne.
 *
 * Exposé à la sonde de santé : c'est la seule question qui compte vraiment
 * après un déploiement, et elle se répond sans divulguer le moindre chemin.
 */
export function donneesHorsRepertoireDeploiement(): boolean {
  const dossier = dossierDonnees();
  const courant = resolve(process.cwd());

  return dossier !== courant && !dossier.startsWith(courant + sep);
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
