import Link from "next/link";
import { LibraryBig, LogIn } from "lucide-react";

import { seDeconnecter } from "@/app/(client)/connexion/actions";
import { Button } from "@/components/ui/button";
import { getStudentCourant } from "@/lib/etudiant";

/**
 * État de connexion du client dans l'en-tête.
 *
 * Composant serveur : l'identité est lue côté serveur à chaque rendu, jamais
 * exposée au JavaScript de la page. Il n'y a donc rien à hydrater et aucune
 * milliseconde pendant laquelle l'en-tête afficherait le mauvais état.
 *
 * L'email est affiché tronqué : sur un écran partagé ou une capture, une
 * adresse complète en évidence n'apporte rien à celui qui est déjà connecté.
 */
export async function MenuCompte() {
  const student = await getStudentCourant();

  if (!student) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/connexion">
          <LogIn aria-hidden />
          Se connecter
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link href="/mes-formations">
          <LibraryBig aria-hidden />
          <span className="hidden sm:inline">Mes formations</span>
        </Link>
      </Button>

      <form action={seDeconnecter}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          title={`Connecté avec ${student.email}`}
        >
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
