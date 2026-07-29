import { cn } from "@/lib/utils";

/**
 * Marque Kelvynlabs.
 *
 * Le monogramme est un SVG inline (pas un fichier image) : il hérite ainsi des
 * couleurs du thème et reste net à toutes les densités d'écran, sans requête
 * réseau supplémentaire.
 */
export function Logo({
  className,
  afficherTexte = true,
}: {
  className?: string;
  afficherTexte?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label="Kelvynlabs"
      >
        <defs>
          <linearGradient id="kl-degrade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-vivid)" />
            <stop offset="100%" stopColor="var(--brand)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#kl-degrade)" />
        {/* Monogramme « K » construit géométriquement : une hampe et deux
            obliques, pour rester lisible jusqu'à 16 px. */}
        <path
          d="M11 8.5v15M11 16l7.5-7.5M13.8 18.4L22 23.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {afficherTexte ? (
        <span className="text-[15px] font-semibold tracking-tight">
          Kelvyn<span className="text-brand-text">labs</span>
        </span>
      ) : null}
    </span>
  );
}
