/**
 * Ordonnancement fractionnaire.
 *
 * Le champ `ordre` est un flottant. Déplacer un élément entre deux voisins
 * revient à lui attribuer la moyenne de leurs positions — donc UNE seule
 * écriture, quel que soit le nombre d'éléments dans la liste. L'alternative
 * (des entiers 0,1,2…) obligerait à réécrire toutes les lignes suivantes à
 * chaque déplacement.
 *
 * Limite connue : la précision des flottants n'est pas infinie. Après ~50
 * insertions successives au même endroit, les valeurs deviennent
 * indistinguables. `besoinDeCompacter()` détecte cette situation et
 * `positionsCompactees()` renumérote proprement.
 */

/** Écart entre deux éléments consécutifs lors d'une numérotation propre. */
const PAS = 1000;

/** Position à donner à un nouvel élément ajouté en fin de liste. */
export function positionApres(dernierOrdre: number | undefined): number {
  return (dernierOrdre ?? 0) + PAS;
}

/**
 * Position d'un élément déplacé entre `avant` et `apres`.
 * `undefined` signifie « bord de liste ».
 */
export function positionEntre(
  avant: number | undefined,
  apres: number | undefined,
): number {
  if (avant === undefined && apres === undefined) return PAS;
  if (avant === undefined) return apres! - PAS;
  if (apres === undefined) return avant + PAS;
  return (avant + apres) / 2;
}

/**
 * Vrai si deux positions sont devenues trop proches pour qu'on puisse encore
 * insérer entre elles de façon fiable.
 */
export function besoinDeCompacter(positions: number[]): boolean {
  for (let i = 1; i < positions.length; i++) {
    const precedent = positions[i - 1];
    const courant = positions[i];
    if (precedent === undefined || courant === undefined) continue;
    if (Math.abs(courant - precedent) < 0.0001) return true;
  }
  return false;
}

/** Renumérote une liste déjà triée avec un écart régulier. */
export function positionsCompactees(nombre: number): number[] {
  return Array.from({ length: nombre }, (_, index) => (index + 1) * PAS);
}

/**
 * Réordonne un tableau d'identifiants après un glisser-déposer et renvoie les
 * couples (id, nouvelle position) à persister.
 *
 * On renvoie la liste COMPLÈTE renumérotée plutôt que la seule ligne déplacée :
 * c'est un peu plus d'écritures, mais l'état final est déterministe et ne
 * dérive jamais — ce qui compte davantage sur des listes de quelques dizaines
 * d'éléments comme ici.
 */
export function calculerNouvelOrdre(
  idsDansLOrdre: string[],
): { id: string; ordre: number }[] {
  const positions = positionsCompactees(idsDansLOrdre.length);
  return idsDansLOrdre.map((id, index) => ({
    id,
    ordre: positions[index] ?? (index + 1) * PAS,
  }));
}
