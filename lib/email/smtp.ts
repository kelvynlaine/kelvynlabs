import "server-only";

import type { Transporter } from "nodemailer";

import type { BackendEmail } from "@/lib/email";

/**
 * Backend SMTP — pour la boîte email fournie avec votre hébergement.
 *
 * C'est le chemin qui ne demande de s'inscrire nulle part : Hostinger fournit
 * des adresses avec le domaine, et elles s'utilisent en SMTP. Un envoi depuis
 * votre propre domaine passe aussi mieux les filtres anti-spam qu'un envoi
 * depuis un domaine partagé.
 *
 * ⚠️ Si les emails ne partent pas et que l'erreur est un délai d'attente, le
 * port sortant est probablement bloqué par l'hébergeur — c'est fréquent. Dans
 * ce cas, basculez sur Resend : une variable à changer, rien d'autre.
 */
let transporteur: Transporter | undefined;

async function getTransporteur(): Promise<Transporter> {
  if (transporteur) return transporteur;

  // Import dynamique : nodemailer n'est chargé que si SMTP est réellement
  // configuré. Une installation qui utilise Resend ne paie pas ce module.
  const { createTransport } = await import("nodemailer");

  const port = Number(process.env.SMTP_PORT?.trim() || 465);

  transporteur = createTransport({
    host: process.env.SMTP_HOTE?.trim(),
    port,
    // 465 est du TLS implicite, 587 du STARTTLS. Se tromper donne une erreur
    // de handshake plutôt obscure : on déduit plutôt que de le demander.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_UTILISATEUR?.trim(),
      pass: process.env.SMTP_MOT_DE_PASSE,
    },
  });

  return transporteur;
}

export const backendSmtp: BackendEmail = {
  nom: "SMTP",

  async envoyer(message, expediteur) {
    const transport = await getTransporteur();

    await transport.sendMail({
      from: expediteur,
      to: message.destinataire,
      subject: message.sujet,
      text: message.texte,
      html: message.html,
    });
  },
};
