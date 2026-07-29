import type { Metadata } from "next";
import Link from "next/link";

import { Confirmation } from "@/app/(client)/connexion/verifier/confirmation";
import { EnteteSite } from "@/components/client/entete-site";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Page d'atterrissage du lien reçu par email.
 *
 * Elle ne consomme RIEN : elle se contente d'afficher un bouton. C'est ce
 * bouton qui déclenche la connexion, en POST. Voir `Confirmation` pour le
 * détail — les robots des messageries ouvrent les liens des emails, et un
 * jeton à usage unique consommé au chargement serait grillé avant que le
 * client ne l'ouvre.
 */
export default async function PageVerification({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;

  return (
    <>
      <EnteteSite />

      <main id="contenu" className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl tracking-tight">Connexion</h1>

        {jeton ? (
          <>
            <p className="text-muted-foreground mt-3 mb-8 leading-relaxed">
              Vous y êtes presque. Confirmez pour accéder à vos formations.
            </p>
            <Confirmation jeton={jeton} />
          </>
        ) : (
          <div className="mt-3 space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Ce lien est incomplet. Il a peut-être été coupé par votre
              messagerie&nbsp;: demandez-en un nouveau, c&apos;est immédiat.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/connexion">Demander un nouveau lien</Link>
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
