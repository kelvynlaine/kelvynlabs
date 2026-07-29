import "server-only";

import type { BackendEmail } from "@/lib/email";

/**
 * Backend Resend — API HTTP.
 *
 * Pourquoi le proposer à côté de SMTP : beaucoup d'hébergements managés
 * bloquent le port 465/587 sortant pour limiter les envois en masse. Quand
 * c'est le cas, SMTP échoue par un délai d'attente peu bavard, alors qu'une
 * requête HTTPS passe toujours.
 *
 * Aucune dépendance : `fetch` suffit, et une dépendance de moins est une
 * dépendance de moins à maintenir.
 */
export const backendResend: BackendEmail = {
  nom: "Resend",

  async envoyer(message, expediteur) {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteur,
        to: [message.destinataire],
        subject: message.sujet,
        text: message.texte,
        html: message.html,
      }),
    });

    if (!reponse.ok) {
      // Le corps de la réponse contient la raison réelle (domaine non vérifié,
      // clé invalide…). Sans lui, le diagnostic se résume à « 4xx ».
      const detail = await reponse.text().catch(() => "");
      throw new Error(`Resend a refusé l'envoi (${reponse.status}) : ${detail.slice(0, 300)}`);
    }
  },
};
