"use client";

/**
 * Filet de sécurité ultime : une erreur survenue dans le layout racine
 * lui-même, avant que la moindre police ou feuille de style ne soit appliquée.
 *
 * Ce composant REMPLACE `<html>` et `<body>` — il ne peut donc hériter d'aucun
 * style du projet. D'où les styles en ligne : c'est le seul endroit du code où
 * ils sont justifiés.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0A0A0B",
          color: "#FAFAFA",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Kelvynlabs est momentanément indisponible
        </h1>
        <p style={{ color: "#A1A1AA", margin: 0, maxWidth: "32rem" }}>
          Une erreur inattendue empêche l&apos;affichage de la page. Réessayez
          dans un instant.
        </p>

        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#6D4DF2",
            color: "#FFFFFF",
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>

        {error.digest ? (
          <p style={{ color: "#71717A", fontSize: "0.75rem", marginTop: "1rem" }}>
            Référence : {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
