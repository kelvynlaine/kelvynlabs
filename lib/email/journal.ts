import "server-only";

import type { BackendEmail } from "@/lib/email";

/**
 * Backend de développement : écrit le message dans les logs.
 *
 * Il rend le lien de connexion visible dans le terminal, ce qui permet de
 * dérouler tout le parcours sans configurer quoi que ce soit — et sans risquer
 * d'envoyer des emails de test à de vraies adresses.
 *
 * ⚠️ `lib/email/index.ts` refuse ce backend en production.
 */
export const backendJournal: BackendEmail = {
  nom: "journal (aucun envoi réel)",

  async envoyer(message) {
    console.info(
      [
        "",
        "┌─ EMAIL NON ENVOYÉ (mode journal) ─────────────────────────────",
        `│ À      : ${message.destinataire}`,
        `│ Sujet  : ${message.sujet}`,
        "├───────────────────────────────────────────────────────────────",
        ...message.texte.split("\n").map((ligne) => `│ ${ligne}`),
        "└───────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  },
};
