import "server-only";

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// `promisify(scrypt)` retient la surcharge à 3 arguments et perd le paramètre
// `options` — or c'est précisément lui qui porte le paramétrage de sécurité.
// D'où cette enveloppe écrite à la main.
function scryptAsync(
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    scrypt(motDePasse, sel, longueur, options, (erreur, cle) =>
      erreur ? rejeter(erreur) : resoudre(cle),
    );
  });
}

/**
 * Hachage de mot de passe par scrypt.
 *
 * Pourquoi scrypt plutôt qu'Argon2 ou bcrypt : les deux autres imposent une
 * dépendance native à compiler, ce qui alourdit l'image Docker. scrypt est
 * fourni par Node lui-même, et reste une fonction de dérivation recommandée
 * par l'OWASP dès lors qu'elle est correctement paramétrée — ce qui est le
 * point suivant.
 *
 * Paramètres : N = 2^16, r = 8, p = 2 — l'une des deux configurations
 * explicitement recommandées par l'OWASP Password Storage Cheat Sheet.
 * Coût mémoire ≈ 64 Mo par vérification, ce qui rend une attaque par
 * dictionnaire sur GPU très coûteuse. Sans ce paramétrage, scrypt vaudrait à
 * peine mieux qu'un SHA-256 salé.
 */
const N = 65536;
const R = 8;
const P = 2;
const LONGUEUR_CLE = 64;
const LONGUEUR_SEL = 16;

// scrypt refuse d'allouer au-delà de 32 Mo par défaut : avec N=2^16 il faut
// relever explicitement la limite, sinon l'appel échoue.
const MAX_MEMOIRE = 192 * 1024 * 1024;

/** Format stocké : `scrypt$N$r$p$sel_hex$cle_hex` (auto-descriptif, versionnable). */
export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(LONGUEUR_SEL);
  const cle = await scryptAsync(motDePasse.normalize("NFKC"), sel, LONGUEUR_CLE, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMOIRE,
  });

  return `scrypt$${N}$${R}$${P}$${sel.toString("hex")}$${cle.toString("hex")}`;
}

/**
 * Vérifie un mot de passe contre son empreinte stockée.
 *
 * Les paramètres sont relus depuis l'empreinte plutôt que repris des constantes
 * ci-dessus : les empreintes créées avec d'anciens réglages restent
 * vérifiables si on durcit les paramètres plus tard.
 */
export async function verifierMotDePasse(
  motDePasse: string,
  empreinte: string,
): Promise<boolean> {
  const parties = empreinte.split("$");
  if (parties.length !== 6 || parties[0] !== "scrypt") return false;

  const [, nBrut, rBrut, pBrut, selHex, cleHex] = parties;
  const n = Number(nBrut);
  const r = Number(rBrut);
  const p = Number(pBrut);

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  if (!selHex || !cleHex) return false;

  const attendue = Buffer.from(cleHex, "hex");
  if (attendue.length === 0) return false;

  const calculee = await scryptAsync(
    motDePasse.normalize("NFKC"),
    Buffer.from(selHex, "hex"),
    attendue.length,
    { N: n, r, p, maxmem: MAX_MEMOIRE },
  );

  // Comparaison à temps constant : un `===` classique s'arrête au premier octet
  // différent, ce qui laisse fuiter la position de l'erreur par mesure du temps.
  return timingSafeEqual(calculee, attendue);
}
