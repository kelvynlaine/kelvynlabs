import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export function PiedDePage() {
  return (
    <footer className="border-border mt-24 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>

        {/*
          Reformulé depuis l'arrivée des comptes clients : « sans compte » est
          devenu faux pour une partie des visiteurs. L'engagement qui tient
          toujours, et qui est celui qui compte, c'est l'absence de traceur.
        */}
        <p className="text-xs">
          Votre progression est enregistrée sans aucun traceur publicitaire.{" "}
          <Link
            href="/admin"
            className="hover:text-foreground underline underline-offset-4"
          >
            Administration
          </Link>
        </p>
      </div>
    </footer>
  );
}
