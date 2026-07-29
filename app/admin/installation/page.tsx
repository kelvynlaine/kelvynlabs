import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { FormulaireInstallation } from "@/components/admin/formulaire-installation";
import { Logo } from "@/components/logo";
import { compterAdmins } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Installation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Création du compte administrateur au premier démarrage.
 *
 * Cette page n'existe que tant qu'aucun compte n'a été créé : dès qu'il y en a
 * un, elle redirige vers la connexion. C'est ce qui évite d'avoir à faire
 * tourner un script TypeScript dans l'image Docker de production, où seul le
 * JavaScript compilé est présent.
 *
 * ⚠️ Créez ce compte immédiatement après le premier déploiement : tant qu'il
 * n'existe pas, cette page est ouverte à qui connaît l'adresse du site.
 */
export default async function PageInstallation() {
  if ((await compterAdmins()) > 0) redirect("/admin/login");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="bg-brand-vivid/20 pointer-events-none absolute top-[-20%] left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="bg-card/80 border-border rounded-2xl border p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8 space-y-3">
            <Logo />
            <div>
              <h1 className="text-2xl">Première installation</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Créez le compte administrateur de la plateforme.
              </p>
            </div>
          </div>

          <FormulaireInstallation />
        </div>

        <p className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-center text-xs">
          <ShieldCheck className="size-3.5 shrink-0" />
          Cette page se ferme définitivement une fois le compte créé
        </p>
      </div>
    </main>
  );
}
