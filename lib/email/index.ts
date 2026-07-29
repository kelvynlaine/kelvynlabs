import "server-only";

import { resendEstConfigure, smtpEstConfigure } from "@/lib/env.server";

import { backendJournal } from "@/lib/email/journal";
import { backendResend } from "@/lib/email/resend";
import { backendSmtp } from "@/lib/email/smtp";

/**
 * Envoi d'email — point d'entrée unique.
 *
 * Même principe que `lib/stockage` : le reste du code appelle `envoyerEmail()`
 * sans savoir par où ça part. Changer de fournisseur ne touche aucun appelant.
 *
 * Trois backends, choisis dans cet ordre :
 *
 *   1. SMTP  — votre boîte Hostinger, incluse dans l'hébergement. Aucune
 *              inscription à un service tiers.
 *   2. Resend — API HTTP. Utile quand l'hébergeur bloque le port SMTP sortant,
 *              ce que font beaucoup de plateformes managées.
 *   3. Journal — écrit le message dans les logs au lieu de l'envoyer. C'est le
 *              mode par défaut en développement : le lien de connexion
 *              s'affiche dans le terminal, et rien ne part vers de vraies
 *              adresses pendant qu'on teste.
 *
 * ⚠️ Le mode journal est REFUSÉ en production. Un envoi silencieusement ignoré
 * y produirait exactement le symptôme le plus coûteux à diagnostiquer : des
 * clients qui « ne reçoivent pas l'email », sans la moindre erreur nulle part.
 */

export type Message = {
  destinataire: string;
  sujet: string;
  texte: string;
  html: string;
};

export type BackendEmail = {
  readonly nom: string;
  envoyer(message: Message, expediteur: string): Promise<void>;
};

function backend(): BackendEmail {
  if (smtpEstConfigure()) return backendSmtp;
  if (resendEstConfigure()) return backendResend;
  return backendJournal;
}

/** Nom du backend actif — exposé à la sonde de santé. */
export function nomBackendEmail(): string {
  return backend().nom;
}

/** Vrai si les emails partent réellement. */
export function emailEstConfigure(): boolean {
  return backend() !== backendJournal;
}

/**
 * Adresse d'expédition.
 *
 * `EMAIL_EXPEDITEUR` est explicite si elle est renseignée ; sinon on retombe
 * sur l'utilisateur SMTP, qui est presque toujours l'adresse elle-même.
 */
function expediteur(): string {
  const configure = process.env.EMAIL_EXPEDITEUR?.trim();
  if (configure) return configure;

  const utilisateurSmtp = process.env.SMTP_UTILISATEUR?.trim();
  if (utilisateurSmtp) return utilisateurSmtp;

  return "Kelvynlabs <onboarding@resend.dev>";
}

export async function envoyerEmail(message: Message): Promise<void> {
  const actif = backend();

  if (actif === backendJournal && process.env.NODE_ENV === "production") {
    throw new Error(
      "Aucun fournisseur d'email configuré. Renseignez SMTP_* ou RESEND_API_KEY.",
    );
  }

  await actif.envoyer(message, expediteur());
}
