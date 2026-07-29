import { ImageResponse } from "next/og";

import { checkAccess } from "@/lib/access";
import { siteConfig } from "@/lib/site-config";

/**
 * Image de partage générée pour chaque formation.
 *
 * Un lien de formation collé dans une conversation ou sur un réseau affiche
 * autrement un rectangle vide. L'image est produite à la volée depuis le titre
 * réel — rien à ré-exporter à la main quand un titre change.
 *
 * ⚠️ Contraintes du moteur de rendu (Satori), qui ne sont PAS celles d'un
 * navigateur :
 *   · tout `<div>` ayant plus d'un enfant doit déclarer `display: flex`.
 *     Attention aux expressions JSX : `{n} leçon{n > 1 ? "s" : ""}` compte
 *     pour trois enfants. D'où les chaînes pré-assemblées ci-dessous ;
 *   · `-webkit-line-clamp` n'est pas supporté — les textes trop longs sont
 *     donc coupés en JavaScript, pas en CSS.
 *
 * Runtime Node explicite : la génération lit la base, ce que le runtime Edge
 * ne permet pas (module natif SQLite).
 */
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aperçu de la formation";

/** Coupe sur un mot entier plutôt qu'en plein milieu. */
function tronquer(texte: string, maximum: number): string {
  if (texte.length <= maximum) return texte;
  const coupe = texte.slice(0, maximum);
  const dernierEspace = coupe.lastIndexOf(" ");
  return `${(dernierEspace > maximum * 0.6 ? coupe.slice(0, dernierEspace) : coupe).trimEnd()}…`;
}

export default async function ImageFormation({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const acces = await checkAccess({ slug });

  const titre = tronquer(
    acces.autorise ? acces.donnee.titre : siteConfig.name,
    72,
  );
  const resume = tronquer(
    acces.autorise
      ? (acces.donnee.descriptionCourte ?? siteConfig.description)
      : siteConfig.description,
    120,
  );
  const nbLecons = acces.autorise
    ? acces.donnee.chapitres.reduce((total, c) => total + c.lecons.length, 0)
    : 0;

  const etiquetteLecons = `${nbLecons} leçon${nbLecons > 1 ? "s" : ""}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0A0A0B",
          // Lueur violette reprise du site : c'est ce qui rend la vignette
          // reconnaissable d'un coup d'œil dans un fil de discussion.
          backgroundImage:
            "radial-gradient(900px 500px at 50% -25%, rgba(124,92,255,0.32), transparent 70%)",
          color: "#FAFAFA",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #7C5CFF, #5B3DF5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>Kelvynlabs</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: titre.length > 46 ? 60 : 76,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -2,
            }}
          >
            {titre}
          </div>

          <div style={{ display: "flex", fontSize: 28, color: "#A1A1AA", lineHeight: 1.4 }}>
            {resume}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24 }}>
          <div
            style={{
              display: "flex",
              padding: "8px 20px",
              borderRadius: 999,
              background: "rgba(124,92,255,0.18)",
              border: "1px solid rgba(124,92,255,0.45)",
              color: "#A78BFA",
            }}
          >
            {etiquetteLecons}
          </div>
          <div style={{ display: "flex", color: "#71717A" }}>Formation en ligne</div>
        </div>
      </div>
    ),
    size,
  );
}
