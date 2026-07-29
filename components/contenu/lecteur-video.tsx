import type { ProviderVideo } from "@/lib/db/schema";

/**
 * Lecteur vidéo d'une leçon.
 *
 * Composant PARTAGÉ entre l'aperçu de l'administration et les pages client
 * (Phase 3). C'est ce partage qui garantit que « aperçu » veut réellement dire
 * « ce que verra le visiteur » : deux implémentations divergeraient au premier
 * ajustement.
 */
export function LecteurVideo({
  provider,
  videoUrl,
  titre,
  cdnBunny,
}: {
  provider: ProviderVideo;
  videoUrl: string;
  titre: string;
  /** Hostname CDN de la Stream Library, requis pour Bunny uniquement. */
  cdnBunny?: string;
}) {
  if (provider === "bunny") {
    if (!cdnBunny) {
      return (
        <CadreMessage>
          Bunny.net n&apos;est pas configuré. Renseignez les variables{" "}
          <code className="font-mono">BUNNY_*</code> pour lire cette vidéo.
        </CadreMessage>
      );
    }

    return (
      <Cadre>
        <iframe
          src={`https://${cdnBunny}/embed/${encodeURIComponent(videoUrl)}?autoplay=false&preload=false`}
          title={titre}
          loading="lazy"
          allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </Cadre>
    );
  }

  return (
    <Cadre>
      <iframe
        // youtube-nocookie : pas de cookie de suivi tant que la vidéo n'est pas
        // lancée. `rel=0` limite les suggestions de fin à la même chaîne, pour
        // ne pas renvoyer l'apprenant vers un concurrent.
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoUrl)}?rel=0&modestbranding=1`}
        title={titre}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full"
      />
    </Cadre>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-secondary relative aspect-video w-full overflow-hidden rounded-xl">
      {children}
    </div>
  );
}

function CadreMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-secondary/50 text-muted-foreground flex aspect-video w-full items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm">
      <p>{children}</p>
    </div>
  );
}
