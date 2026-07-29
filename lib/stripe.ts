import "server-only";

import Stripe from "stripe";

import { getServerEnv, stripeEstConfigure } from "@/lib/env.server";

/**
 * Client Stripe, instancié paresseusement.
 *
 * Même raison que pour la base de données : une instanciation à l'import
 * forcerait la présence des clés dès le build, alors que la plateforme doit
 * pouvoir tourner — et se construire — sans Stripe tant qu'aucune formation
 * n'est payante.
 */
let instance: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripeEstConfigure()) {
    throw new Error(
      "Stripe n'est pas configuré : renseignez STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET.",
    );
  }

  instance ??= new Stripe(getServerEnv().STRIPE_SECRET_KEY!, {
    // Version d'API épinglée : sans cela, Stripe fait évoluer le format des
    // objets sous nos pieds et un webhook qui marchait cesse de marcher sans
    // qu'aucune ligne de code n'ait changé.
    apiVersion: "2026-06-24.dahlia",
    appInfo: { name: "Kelvynlabs", version: "1.0.0" },
    // Les erreurs réseau ponctuelles sont réessayées automatiquement plutôt
    // que de faire échouer un paiement pour un timeout passager.
    maxNetworkRetries: 2,
  });

  return instance;
}

/** Montant formaté pour l'affichage : 4900 centimes → « 49,00 € ». */
export function formaterPrix(centimes: number, devise = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
  }).format(centimes / 100);
}
