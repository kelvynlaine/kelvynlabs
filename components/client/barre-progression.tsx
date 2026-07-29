/**
 * Barre de progression.
 *
 * Écrite à la main plutôt qu'importée : le composant `progress` de shadcn/ui
 * embarque une dépendance Radix pour un `<div>` dont la largeur varie. Ici on
 * a besoin de deux variantes visuelles et de rien d'autre.
 *
 * `role="progressbar"` et les attributs `aria-value*` sont ce qui rend
 * l'avancement audible pour un lecteur d'écran — une barre purement visuelle
 * ne dirait rien.
 */
export function BarreProgression({
  pourcentage,
  taille = "normale",
  etiquette,
}: {
  pourcentage: number;
  taille?: "fine" | "normale";
  etiquette?: string;
}) {
  const valeur = Math.min(100, Math.max(0, Math.round(pourcentage)));

  return (
    <div
      role="progressbar"
      aria-valuenow={valeur}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiquette ?? `Progression : ${valeur} %`}
      className={`bg-secondary w-full overflow-hidden ${
        taille === "fine" ? "h-1" : "h-2 rounded-full"
      }`}
    >
      <div
        className="bg-brand-vivid h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${valeur}%` }}
      />
    </div>
  );
}
