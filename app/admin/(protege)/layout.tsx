import Link from "next/link";
import {
  BookOpen,
  ExternalLink,
  LayoutDashboard,
  LibraryBig,
  LogOut,
} from "lucide-react";

import { deconnexionAdmin } from "@/app/admin/login/actions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";

/**
 * Coquille de l'espace administrateur.
 *
 * `requireAdmin()` est appelé ICI et redonde volontairement avec le middleware :
 * le middleware ne vérifie que la présence d'une session, cette garde vérifie
 * les droits réels. Chaque server action de /admin refait la même vérification
 * de son côté — un layout ne protège pas les actions qu'il rend.
 */
export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // `labelCourt` sert à la barre mobile : à 375 px, « Tableau de bord » pousse
  // « Médias » hors de l'écran et l'onglet devient invisible sans défilement
  // horizontal — qui, sur une barre de navigation, ne se devine pas.
  const navigation = [
    {
      href: "/admin",
      label: "Tableau de bord",
      labelCourt: "Accueil",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/formations",
      label: "Formations",
      labelCourt: "Formations",
      icon: BookOpen,
    },
    {
      href: "/admin/medias",
      label: "Médias",
      labelCourt: "Médias",
      icon: LibraryBig,
    },
  ];

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/admin" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" target="_blank" rel="noopener noreferrer">
                Voir le site
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>

            <ThemeToggle />

            <form action={deconnexionAdmin}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label={`Se déconnecter (${admin.email})`}
                title={admin.email}
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Navigation repliée sur mobile : les trois onglets se partagent la
            largeur, sans défilement horizontal ni onglet coupé. */}
        <nav className="border-border grid grid-cols-3 border-t px-2 py-2 md:hidden">
          {navigation.map(({ href, labelCourt, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{labelCourt}</span>
            </Link>
          ))}
        </nav>
      </header>

      <main id="contenu-principal" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
