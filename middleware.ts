import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESSION } from "@/lib/auth-cookie";

/**
 * Middleware global.
 *
 * ⚠️ Ce n'est PAS la couche d'autorisation, et il ne peut pas l'être : le
 * middleware s'exécute sur le runtime Edge, où le module natif SQLite n'existe
 * pas. Il lui est donc impossible de vérifier qu'une session est valide.
 *
 * Il ne fait qu'une chose : rediriger vers la connexion les requêtes vers
 * /admin qui n'ont même pas de cookie de session. C'est une amélioration
 * d'expérience (pas de page qui clignote), pas une sécurité.
 *
 * L'autorisation réelle est faite par `requireAdmin()` dans chaque page et
 * chaque server action de /admin, côté runtime Node.
 *
 * Note : on ne redirige PAS /admin/login vers /admin quand un cookie est
 * présent. Un cookie périmé provoquerait sinon une boucle infinie
 * (login → admin → requireAdmin échoue → login…). C'est la page de connexion
 * elle-même qui décide, après validation réelle de la session.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /admin/installation doit rester joignable sans session : c'est là qu'on
  // crée le tout premier compte. La page se ferme d'elle-même dès qu'un
  // administrateur existe.
  const routesOuvertes = ["/admin/login", "/admin/installation"];

  if (pathname.startsWith("/admin") && !routesOuvertes.includes(pathname)) {
    const aUnCookie = request.cookies.has(COOKIE_SESSION);

    if (!aUnCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      url.searchParams.set("suivant", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
