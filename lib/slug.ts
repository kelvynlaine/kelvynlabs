/**
 * Génération de slugs d'URL.
 *
 * Pas de dépendance externe : la normalisation Unicode NFD sépare les lettres
 * de leurs accents, qu'il suffit alors de retirer. « Élève & Système » devient
 * « eleve-systeme ».
 */
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marques diacritiques isolees par NFD
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

/**
 * Rend un slug unique en lui ajoutant un suffixe numérique si nécessaire.
 *
 * `estPris` interroge la base. On boucle plutôt que d'ajouter systématiquement
 * un suffixe : les URLs restent propres tant qu'il n'y a pas de collision.
 */
export async function slugUnique(
  base: string,
  estPris: (candidat: string) => Promise<boolean>,
): Promise<string> {
  const racine = slugifier(base) || "sans-titre";

  if (!(await estPris(racine))) return racine;

  for (let suffixe = 2; suffixe < 1000; suffixe++) {
    const candidat = `${racine}-${suffixe}`;
    if (!(await estPris(candidat))) return candidat;
  }

  // Garde-fou : au-delà de 1000 homonymes, on bascule sur un suffixe aléatoire
  // plutôt que de boucler indéfiniment.
  return `${racine}-${Math.random().toString(36).slice(2, 8)}`;
}
