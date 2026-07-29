import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export function PiedDePage() {
  return (
    <footer className="border-border mt-24 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>

        <p className="text-xs">
          Votre progression est enregistrée sur cet appareil, sans compte ni
          traceur.{" "}
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
