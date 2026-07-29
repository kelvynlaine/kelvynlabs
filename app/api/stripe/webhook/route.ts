import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { annulerAchat, enregistrerAchat } from "@/lib/achat";
import { getServerEnv, stripeEstConfigure } from "@/lib/env.server";
import { getStripe } from "@/lib/stripe";

/**
 * Réception des événements Stripe.
 *
 * ⚠️ LA VÉRIFICATION DE SIGNATURE EST LE CŒUR DE CETTE ROUTE.
 *
 * Cet endpoint est public — il doit l'être, Stripe appelle depuis l'extérieur.
 * Sans vérification, n'importe qui pourrait poster un faux
 * « checkout.session.completed » et s'offrir toutes les formations payantes.
 * C'est la signature `stripe-signature`, calculée avec le secret du webhook,
 * qui prouve que l'événement vient bien de Stripe.
 *
 * Deux conséquences dans le code ci-dessous :
 *   · on lit le corps BRUT (`request.text()`), jamais `request.json()` : la
 *     signature porte sur les octets exacts, et re-sérialiser du JSON change
 *     un espace suffisant à invalider le calcul ;
 *   · sans STRIPE_WEBHOOK_SECRET, la route refuse tout. Jamais de mode
 *     « on fait confiance ».
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripeEstConfigure()) {
    return NextResponse.json({ erreur: "Stripe non configuré" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ erreur: "Signature absente" }, { status: 400 });
  }

  const corpsBrut = await request.text();

  let evenement: Stripe.Event;
  try {
    evenement = getStripe().webhooks.constructEvent(
      corpsBrut,
      signature,
      getServerEnv().STRIPE_WEBHOOK_SECRET!,
    );
  } catch (erreur) {
    // Signature invalide : requête forgée, ou secret mal configuré. On ne
    // détaille pas la raison dans la réponse.
    console.error("[stripe] signature invalide", erreur);
    return NextResponse.json({ erreur: "Signature invalide" }, { status: 400 });
  }

  try {
    switch (evenement.type) {
      /* --- Paiement abouti : on ouvre l'accès ----------------------------- */
      case "checkout.session.completed":
      // Paiement différé (virement, prélèvement) confirmé plus tard.
      case "checkout.session.async_payment_succeeded": {
        const session = evenement.data.object;
        const resultat = await enregistrerAchat(session);

        if (!resultat.ok) {
          // On journalise sans renvoyer d'erreur : répondre autre chose qu'un
          // 2xx ferait rejouer l'événement par Stripe pendant des heures,
          // alors que le problème (email manquant, métadonnée absente) ne se
          // résoudra pas tout seul.
          console.error("[stripe] achat non enregistré :", resultat.raison);
        }
        break;
      }

      /* --- Paiement différé échoué --------------------------------------- */
      case "checkout.session.async_payment_failed": {
        await annulerAchat(evenement.data.object.id, "annule");
        break;
      }

      /* --- Remboursement : l'accès se referme ----------------------------- */
      case "charge.refunded": {
        const charge = evenement.data.object;
        const paiement =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        if (paiement) {
          // Le remboursement porte sur un PaymentIntent ; on remonte à la
          // session de paiement pour retrouver l'enrollment correspondant.
          const sessions = await getStripe().checkout.sessions.list({
            payment_intent: paiement,
            limit: 1,
          });
          const session = sessions.data[0];
          if (session) await annulerAchat(session.id, "rembourse");
        }
        break;
      }

      default:
        // Tout autre événement est ignoré volontairement. On répond quand même
        // 200 : sinon Stripe considère l'endpoint en échec et finit par le
        // désactiver, y compris pour les événements qui nous intéressent.
        break;
    }
  } catch (erreur) {
    // Erreur de NOTRE côté (base indisponible…) : on renvoie 500 pour que
    // Stripe réessaie — c'est précisément le cas où un nouvel essai peut
    // réussir.
    console.error("[stripe] traitement échoué", erreur);
    return NextResponse.json({ erreur: "Traitement échoué" }, { status: 500 });
  }

  return NextResponse.json({ recu: true });
}
