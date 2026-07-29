"use client";

import { ListTree } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Sommaire en tiroir, pour les écrans où la barre latérale ne tient pas.
 *
 * Le sommaire lui-même est rendu côté serveur et passé en `children` : le
 * tiroir n'ajoute que l'ouverture et la fermeture, aucune donnée ne transite
 * inutilement vers le navigateur.
 */
export function SommaireMobile({
  children,
  titre,
  progression,
}: {
  children: ReactNode;
  titre: string;
  progression: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  // Sans cela, cliquer sur une leçon changerait de page en laissant le tiroir
  // ouvert par-dessus le contenu.
  useEffect(() => setOuvert(false), [chemin]);

  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <ListTree className="size-4" />
          Sommaire
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[min(22rem,90vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left text-base">{titre}</SheetTitle>
          <SheetDescription className="text-left">{progression}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
