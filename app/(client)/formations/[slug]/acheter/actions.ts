"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import type { EtatAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { formations } from "@/lib/db/schema";
import { stripeEstConfigure } from "@/lib/env.server";
import { aUnEnrollmentActif, getStudentCourant } from "@/lib/etudiant";
import { siteConfig } from "@/lib/site-config";
import { getStripe } from "@/lib/stripe";

/**
 * Ouvre une session de paiement Stripe Checkout.
 *
 * On ne construit PAS de formulaire de carte : Stripe Checkout est une page
 * hébergée par Stripe. Aucune donnée bancaire ne transite par Kelvynlabs, ce
 * qui écarte l'essentiel des obligations PCI.
 *
 * ⚠️ Le prix envoyé à Stripe est relu EN BASE, jamais reçu du client. Sans
 * cela, il suffirait de modifier la requête pour acheter une formation à
 * 1 centime.
 */
export async function creerSessionPaiement(slug: string): Promise<EtatAction> {
  if (!stripeEstConfigure()) {
    return { ok: false, erreur: "Le paiement n'est pas encore activé." };
  }

  const formation = await db.query.formations.findFirst({
    where: eq(formations.slug, slug),
  });

  if (!formation || formation.statut !== "published") {
    return { ok: false, erreur: "Formation introuvable." };
  }

  const prix = formation.prixCents ?? 0;
  if (prix <= 0) {
    return { ok: false, erreur: "Cette formation est gratuite." };
  }

  // Déjà achetée : inutile de laisser payer une seconde fois.
  const student = await getStudentCourant();
  if (student && (await aUnEnrollmentActif(student.id, formation.id))) {
    redirect(`/formations/${formation.slug}`);
  }

  const base = siteConfig.url.replace(/\/$/, "");

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // Une formation s'achète une fois : pas de quantité modifiable.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: formation.devise.toLowerCase(),
          unit_amount: prix,
          product_data: {
            name: formation.titre,
            description: formation.descriptionCourte ?? undefined,
          },
        },
      },
    ],

    // C'est cette métadonnée que le webhook relit pour savoir quelle formation
    // débloquer. Sans elle, un paiement réussi n'ouvrirait aucun accès.
    metadata: { formationId: formation.id, formationSlug: formation.slug },

    success_url: `${base}/formations/${formation.slug}/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/formations/${formation.slug}`,

    // Stripe collecte l'email : c'est lui qui identifie l'acheteur, et qui
    // permettra de lui rendre son accès quand la connexion par email existera.
    customer_creation: "always",

    locale: "fr",
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return { ok: false, erreur: "Stripe n'a pas renvoyé d'URL de paiement." };
  }

  redirect(session.url);
}
