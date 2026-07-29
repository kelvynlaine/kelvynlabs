import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getServerEnv } from "@/lib/env.server";

/**
 * Backend « stockage objet », compatible S3.
 *
 * Fonctionne avec Cloudflare R2, Backblaze B2, Scaleway, MinIO ou S3 lui-même :
 * tous exposent la même API. Le choix du fournisseur se fait par les variables
 * d'environnement, pas dans le code.
 *
 * ⚠️ Indispensable sur un hébergement dont le disque est recréé à chaque
 * déploiement (Hostinger Node.js managé, Vercel, Render…). Sans lui, chaque
 * mise en ligne effacerait les images de couverture, les images des leçons et
 * les ressources téléchargeables.
 *
 * Les fichiers restent servis par `/api/fichiers` et `/api/ressources`, jamais
 * par une URL publique du bucket. C'est ce qui permet à checkAccess() de
 * continuer à protéger les ressources payantes : un bucket public court-
 * circuiterait le contrôle d'accès.
 */
let client: S3Client | undefined;

function getClient(): S3Client {
  const env = getServerEnv();

  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("Stockage S3 incomplètement configuré");
  }

  client ??= new S3Client({
    // R2 et la plupart des alternatives ignorent la région mais en exigent
    // une : « auto » est la valeur conventionnelle.
    region: env.S3_REGION ?? "auto",
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // Indispensable hors AWS : sans cela le SDK construit des URLs
    // `bucket.endpoint`, que R2 et MinIO ne servent pas.
    forcePathStyle: true,
  });

  return client;
}

function bucket(): string {
  return getServerEnv().S3_BUCKET!;
}

export const backendS3 = {
  nom: "s3" as const,

  async ecrire(chemin: string, contenu: Buffer): Promise<void> {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: chemin,
        Body: contenu,
        // Le type réel a déjà été validé en amont ; on le conserve pour que
        // le fichier reste exploitable si le bucket est un jour lu ailleurs.
        ContentLength: contenu.length,
      }),
    );
  },

  async lire(chemin: string): Promise<Buffer | null> {
    try {
      const reponse = await getClient().send(
        new GetObjectCommand({ Bucket: bucket(), Key: chemin }),
      );

      if (!reponse.Body) return null;

      // `transformToByteArray` évite de manipuler le flux à la main et
      // fonctionne sur toutes les implémentations du SDK.
      const octets = await reponse.Body.transformToByteArray();
      return Buffer.from(octets);
    } catch (erreur) {
      // Objet absent : c'est un cas normal (fichier supprimé, chemin obsolète),
      // pas une panne. Les vraies erreurs réseau remontent aussi ici — on
      // journalise pour pouvoir les distinguer dans les logs.
      const nom = (erreur as { name?: string })?.name;
      if (nom !== "NoSuchKey" && nom !== "NotFound") {
        console.error("[stockage s3] lecture impossible", erreur);
      }
      return null;
    }
  },

  async supprimer(chemin: string): Promise<void> {
    try {
      await getClient().send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: chemin }),
      );
    } catch (erreur) {
      console.error("[stockage s3] suppression impossible", erreur);
    }
  },
};
