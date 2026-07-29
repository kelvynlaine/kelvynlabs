import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";

import { FormulaireConnexion } from "@/components/admin/formulaire-connexion";
import { Logo } from "@/components/logo";
import { compterAdmins, getAdminCourant } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Connexion administrateur",
  robots: { index: false, follow: false },
};

const MESSAGES_ERREUR: Record<string, string> = {
  non_autorise:
    "Ce compte n'est pas autorisé à administrer la plateforme.",
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suivant?: string; erreur?: string }>;
}) {
  const { suivant, erreur } = await searchParams;

  // C'est ici, et non dans le middleware, qu'on redirige un admin déjà
  // connecté : le middleware ne voit qu'un cookie, il ne peut pas savoir s'il
  // est encore valide. Le faire là-bas créerait une boucle de redirection avec
  // un cookie périmé.
  if (await getAdminCourant()) redirect("/admin");

  // Base vierge : aucun compte n'existe encore. On le dit, plutôt que de
  // laisser tourner en boucle sur « identifiants incorrects ».
  const aucunAdmin = (await compterAdmins()) === 0;

  // On ne fait confiance au paramètre que s'il désigne un chemin interne.
  // La server action refait cette vérification : ceci n'est qu'un pré-filtre.
  const destination =
    suivant?.startsWith("/") && !suivant.startsWith("//") ? suivant : "/admin";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* Halo violet diffus — signature visuelle de Kelvynlabs. */}
      <div
        aria-hidden
        className="bg-brand-vivid/20 pointer-events-none absolute top-[-20%] left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Retour au site
        </Link>

        <div className="bg-card/80 border-border rounded-2xl border p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8 space-y-3">
            <Logo />
            <div>
              <h1 className="text-2xl">Espace administrateur</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Réservé à l&apos;équipe {siteConfig.name}.
              </p>
            </div>
          </div>

          {aucunAdmin ? (
            <div className="border-warning/30 bg-warning/10 mb-6 rounded-lg border px-3 py-2.5 text-sm">
              <p className="text-warning flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0" />
                Aucun compte administrateur
              </p>
              <p className="text-muted-foreground mt-1.5">
                <Link
                  href="/admin/installation"
                  className="text-brand-text underline underline-offset-4"
                >
                  Créez le compte administrateur
                </Link>{" "}
                pour démarrer.
              </p>
            </div>
          ) : null}

          {erreur && MESSAGES_ERREUR[erreur] ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-lg border px-3 py-2 text-sm"
            >
              {MESSAGES_ERREUR[erreur]}
            </p>
          ) : null}

          <FormulaireConnexion suivant={destination} />
        </div>

        <p className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-xs">
          <ShieldCheck className="size-3.5" />
          Session chiffrée · accès réservé à l&apos;administrateur
        </p>
      </div>
    </main>
  );
}
