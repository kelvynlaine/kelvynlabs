"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { demanderLienConnexion, verifierEtConsommerJeton } from "@/lib/connexion-client";
import { fermerSessionEtudiant, ouvrirSessionEtudiant } from "@/lib/etudiant";
import { rattacherProgressionsAuClient } from "@/lib/progression";

const schemaEmail = z.object({
  email: z.email("Cette adresse email ne semble pas valide."),
});

export type EtatDemande =
  | { statut: "vierge" }
  | { statut: "envoye" }
  | { statut: "erreur"; message: string };

/**
 * Demande d'un lien de connexion.
 *
 * ⚠️ Répond « envoyé » MÊME si l'adresse est inconnue. Distinguer les deux cas
 * transformerait ce formulaire en oracle permettant de savoir qui est client.
 * Le seul cas distinct est la limitation de débit, qui ne révèle rien de plus
 * que ce que l'auteur des demandes vient lui-même de provoquer.
 */
export async function demanderLien(
  _precedent: EtatDemande,
  donnees: FormData,
): Promise<EtatDemande> {
  const analyse = schemaEmail.safeParse({ email: donnees.get("email") });

  if (!analyse.success) {
    return {
      statut: "erreur",
      message: analyse.error.issues[0]?.message ?? "Adresse invalide.",
    };
  }

  try {
    const resultat = await demanderLienConnexion(analyse.data.email);

    if (resultat.limiteAtteinte) {
      return {
        statut: "erreur",
        message:
          "Trop de demandes pour cette adresse. Patientez quelques minutes " +
          "avant de réessayer, et pensez à vérifier vos spams.",
      };
    }

    return { statut: "envoye" };
  } catch (erreur) {
    // L'envoi peut échouer pour de bonnes raisons (SMTP bloqué, domaine non
    // vérifié). Le dire franchement vaut mieux qu'un faux « c'est envoyé » qui
    // laisserait le client attendre un email qui n'arrivera jamais.
    console.error("[connexion] envoi impossible :", erreur);
    return {
      statut: "erreur",
      message: "L'email n'a pas pu être envoyé. Réessayez dans un instant.",
    };
  }
}

export type EtatVerification = { statut: "erreur"; message: string };

/**
 * Confirmation du lien, déclenchée par un bouton — donc par un POST.
 *
 * ⚠️ POURQUOI UN BOUTON ET NON UNE SIMPLE VISITE DU LIEN
 *
 * Les jetons sont à usage unique. Or les passerelles antispam et les aperçus
 * de lien (Outlook/Defender, Slack, WhatsApp…) VISITENT les URL contenues dans
 * les emails avant que le destinataire ne les ouvre. Consommer le jeton sur un
 * GET reviendrait donc à le laisser griller par un robot, et le client verrait
 * « lien déjà utilisé » sans avoir rien fait.
 *
 * Un POST n'est jamais déclenché par ces robots.
 */
export async function confirmerConnexion(
  _precedent: EtatVerification | null,
  donnees: FormData,
): Promise<EtatVerification> {
  const jeton = String(donnees.get("jeton") ?? "");
  const resultat = await verifierEtConsommerJeton(jeton);

  if (!resultat.valide) {
    const messages = {
      inconnu: "Ce lien n'est pas valide. Demandez-en un nouveau.",
      expire: "Ce lien a expiré. Demandez-en un nouveau, c'est immédiat.",
      deja_utilise: "Ce lien a déjà servi. Demandez-en un nouveau.",
    } as const;

    return { statut: "erreur", message: messages[resultat.raison] };
  }

  await ouvrirSessionEtudiant(resultat.studentId);

  // L'avancement pris avant la connexion suit le compte : sans cela, se
  // connecter donnerait l'impression d'avoir tout perdu.
  await rattacherProgressionsAuClient(resultat.studentId);

  // `redirect()` interrompt l'action : rien ne sera renvoyé au formulaire.
  redirect("/mes-formations");
}

export async function seDeconnecter(): Promise<void> {
  await fermerSessionEtudiant();
  redirect("/");
}
