/**
 * Constantes d'identité de la plateforme.
 * Aucun secret ici : ce fichier est importable côté client.
 */
export const siteConfig = {
  name: "Kelvynlabs",
  tagline: "Formations en ligne",
  description:
    "Des formations claires, structurées et actionnables. Apprenez à votre rythme, sans bruit.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
