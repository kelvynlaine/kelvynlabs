import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

/**
 * Page d'accueil publique — provisoire.
 *
 * En Phase 3 elle deviendra le catalogue des formations, alimenté par
 * `listerFormationsVisibles()` (lib/access.ts). Elle sert pour l'instant à
 * valider le design system : palette, typographie et bascule clair/sombre.
 */

const ECHANTILLONS = [
  { nom: "Fond", classe: "bg-background border-border border" },
  { nom: "Surface", classe: "bg-card border-border border" },
  { nom: "Surface haute", classe: "bg-secondary" },
  { nom: "Marque", classe: "bg-brand" },
  { nom: "Marque vive", classe: "bg-brand-vivid" },
  { nom: "Halo", classe: "bg-brand-subtle" },
  { nom: "Succès", classe: "bg-success" },
  { nom: "Alerte", classe: "bg-warning" },
  { nom: "Erreur", classe: "bg-destructive" },
];

export default function PageAccueil() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="bg-brand-vivid/15 pointer-events-none absolute top-[-30%] left-1/2 size-[46rem] -translate-x-1/2 rounded-full blur-[140px]"
      />

      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">
              <Lock className="size-3.5" />
              Admin
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
        <Badge variant="secondary" className="mb-6">
          Phase 1 · Fondations
        </Badge>

        <h1 className="max-w-2xl text-5xl leading-[1.05] sm:text-6xl">
          <span className="text-gradient-brand">Apprendre sans bruit.</span>
        </h1>

        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
          {siteConfig.description}
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" disabled>
            Voir les formations
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/admin">Espace administrateur</Link>
          </Button>
        </div>

        <p className="text-muted-foreground mt-4 text-sm">
          Le catalogue arrive en Phase 3. Cette page valide pour l&apos;instant
          le design system.
        </p>

        {/* ---- Aperçu du design system --------------------------------- */}
        <section className="border-border mt-24 border-t pt-12">
          <h2 className="text-2xl">Design system</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Basculez entre les thèmes clair et sombre pour vérifier les deux
            rendus.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-5">
            {ECHANTILLONS.map(({ nom, classe }) => (
              <div key={nom} className="space-y-2">
                <div className={`h-16 rounded-xl ${classe}`} />
                <p className="text-muted-foreground text-xs">{nom}</p>
              </div>
            ))}
          </div>

          <div className="border-border mt-12 grid gap-8 border-t pt-8 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-3 text-xs tracking-widest uppercase">
                Titres · Instrument Serif
              </p>
              <p className="font-heading text-4xl">Formations en ligne</p>
              <p className="font-heading text-muted-foreground mt-2 text-2xl">
                Structurées et actionnables
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-3 text-xs tracking-widest uppercase">
                Corps · Inter
              </p>
              <p className="leading-relaxed">
                Le corps de texte reste en Inter pour la lisibilité sur de
                longues leçons, tandis que les titres portent la signature
                sérif de la marque.
              </p>
              <p className="text-muted-foreground mt-3 font-mono text-sm">
                const contenu = &quot;JetBrains Mono&quot;;
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
