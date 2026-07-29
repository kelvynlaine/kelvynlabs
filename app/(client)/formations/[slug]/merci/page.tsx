import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";

import { EnteteSite } from "@/components/client/entete-site";
import { Button } from "@/components/ui/button";
import { enregistrerAchat } from "@/lib/achat";
import { stripeEstConfigure } from "@/lib/env.server";
import { ouvrirSessionEtudiant } from "@/lib/etudiant";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Merci",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Page d'arrivée après un paiement Stripe réussi.
 *
 * Elle fait deux choses que le webhook ne peut pas faire :
 *
 *   1. **Poser le cookie de session client.** Le webhook est un appel de
 *      serveur à serveur : il n'a aucun navigateur en face de lui. C'est donc
 *      ici, et seulement ici, que l'acheteur est rattaché à son appareil.
 *
 *   2. **Enregistrer l'achat sans attendre le webhook.** Celui-ci peut mettre
 *      quelques secondes ; sans ce filet, le client verrait « merci » puis se
 *      heurterait à un contenu encore verrouillé. `enregistrerAchat()` est
 *      idempotente : le webhook qui arrive ensuite ne crée pas de doublon.
 *
 * ⚠️ La session est relue AUPRÈS DE STRIPE à partir de son identifiant, jamais
 * crue sur parole. Sans cette vérification, il suffirait de visiter
 * `/merci?session_id=nimporte_quoi` pour débloquer une formation.
 */
export default async function PageMerci({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;

  if (!stripeEstConfigure()) notFound();
  if (!sessionId) redirect(`/formations/${slug}`);

  let echec: string | null = null;

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const resultat = await enregistrerAchat(session);

    if (resultat.ok) {
      await ouvrirSessionEtudiant(resultat.studentId);
    } else {
      echec = resultat.raison;
    }
  } catch (erreur) {
    // Identifiant de session inconnu de Stripe, ou API injoignable.
    console.error("[stripe] confirmation impossible", erreur);
    echec = "La confirmation du paiement n'a pas pu être vérifiée.";
  }

  return (
    <>
      <EnteteSite />

      <main
        id="contenu-principal"
        className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6"
      >
        {echec ? (
          <>
            <TriangleAlert className="text-warning size-10" />
            <h1 className="mt-6 text-3xl">Paiement en cours de traitement</h1>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Votre paiement a bien été transmis, mais nous n&apos;avons pas
              encore pu confirmer l&apos;accès. Cela se règle généralement en
              quelques instants — rechargez cette page. Si rien ne change,
              contactez-nous avec la référence ci-dessous.
            </p>
            <p className="text-muted-foreground mt-6 font-mono text-xs break-all">
              {sessionId}
            </p>
          </>
        ) : (
          <>
            <CircleCheck className="text-success size-10" />
            <h1 className="mt-6 text-3xl">Merci, votre accès est ouvert</h1>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Le paiement est confirmé. Vous pouvez commencer la formation dès
              maintenant.
            </p>

            <Button size="lg" className="mt-8" asChild>
              <Link href={`/formations/${slug}`}>
                Accéder à la formation
                <ArrowRight className="size-4" />
              </Link>
            </Button>

            {/* Dire tout de suite comment revenir : c'est la question que se
                pose l'acheteur au moment où il ferme l'onglet. */}
            <p className="text-muted-foreground border-border mt-10 border-t pt-6 text-xs leading-relaxed">
              Vous êtes connecté sur cet appareil. Pour retrouver votre
              formation ailleurs — ou après avoir effacé vos cookies — utilisez{" "}
              <Link
                href="/connexion"
                className="text-foreground underline underline-offset-4"
              >
                la connexion par email
              </Link>{" "}
              avec l&apos;adresse qui a servi au paiement. Aucun mot de passe à
              retenir.
            </p>
          </>
        )}
      </main>
    </>
  );
}
