import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";

/**
 * Sonde de santé, utilisée par le HEALTHCHECK Docker.
 *
 * Elle interroge réellement la base : un serveur qui répond mais dont le
 * fichier SQLite est illisible (volume non monté, permissions) est un serveur
 * en panne, même s'il renvoie du HTML.
 *
 * Ne divulgue rien : ni version, ni chemin, ni compte.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.select({ id: admins.id }).from(admins).limit(1);
    return NextResponse.json({ statut: "ok" });
  } catch {
    return NextResponse.json({ statut: "degrade" }, { status: 503 });
  }
}
