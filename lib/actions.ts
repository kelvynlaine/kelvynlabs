import { z } from "zod";

/**
 * Forme commune des retours de server action.
 *
 * Uniformiser ce type permet aux formulaires clients de partager le même
 * traitement d'erreur (`useActionState`) au lieu d'en réinventer un à chaque
 * fois.
 */
export type EtatAction = {
  ok?: boolean;
  erreur?: string;
  /** Erreurs par champ, pour un affichage à côté de l'input concerné. */
  champs?: Record<string, string>;
};

export const ETAT_INITIAL: EtatAction = {};

/** Convertit une erreur Zod en état d'action exploitable par un formulaire. */
export function erreurDeValidation(erreur: z.ZodError): EtatAction {
  const champs: Record<string, string> = {};

  for (const probleme of erreur.issues) {
    const cle = probleme.path.join(".") || "_";
    champs[cle] ??= probleme.message;
  }

  return {
    ok: false,
    erreur: erreur.issues[0]?.message ?? "Formulaire invalide",
    champs,
  };
}

/** Schéma de slug réutilisable : minuscules, chiffres et tirets simples. */
export const schemaSlug = z
  .string()
  .trim()
  .min(1, "Le slug est requis")
  .max(80, "Slug trop long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Le slug ne peut contenir que des minuscules, des chiffres et des tirets",
  );
