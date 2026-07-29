import { randomUUID } from "node:crypto";

import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Schéma de la base Kelvynlabs (SQLite).
 *
 * Ce fichier est la SOURCE DE VÉRITÉ du schéma. Les fichiers SQL de `drizzle/`
 * en sont générés (`npm run db:generate`) — ne les éditez pas à la main.
 *
 * Conventions SQLite retenues :
 *   · identifiants     → UUID v4 en `text` (générés côté application)
 *   · dates            → entier epoch en millisecondes, exposé en `Date` par Drizzle
 *   · énumérations     → `text` contraint par `enum` (typé à la compilation ET
 *                        vérifié à l'exécution par une contrainte CHECK générée)
 *   · JSON             → `text` en mode json (le contenu Tiptap)
 *   · ordre d'affichage→ `real` : permet d'insérer entre deux éléments lors d'un
 *                        glisser-déposer en écrivant UNE ligne, au lieu de
 *                        réindexer toute la liste.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const creeLe = () =>
  integer("cree_le", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const misAJourLe = () =>
  integer("mis_a_jour_le", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date());

export const STATUTS = ["draft", "published"] as const;
export const PROVIDERS_VIDEO = ["youtube", "bunny"] as const;
export const TYPES_RESSOURCE = ["pdf", "doc", "image", "archive", "autre"] as const;
export const TYPES_MEDIA = ["image", "video", "document"] as const;
export const STATUTS_ENROLLMENT = ["en_attente", "actif", "rembourse", "annule"] as const;

/* ==========================================================================
 * Authentification
 * ========================================================================== */

/**
 * L'unique compte administrateur (la table en accepte plusieurs, mais la
 * plateforme est conçue pour un seul créateur).
 *
 * Le mot de passe est stocké sous forme de dérivation scrypt salée — jamais en
 * clair, jamais en simple hash. Voir `lib/mot-de-passe.ts`.
 */
export const admins = sqliteTable("admins", {
  id: id(),
  email: text("email").notNull(),
  motDePasseHash: text("mot_de_passe_hash").notNull(),
  nom: text("nom"),
  creeLe: creeLe(),
}, (table) => [
  // Unicité insensible à la casse : « Kelvyn@x.fr » et « kelvyn@x.fr » sont
  // le même compte.
  uniqueIndex("admins_email_unique").on(sql`lower(${table.email})`),
]);

/**
 * Sessions administrateur.
 *
 * Le cookie ne contient que le jeton brut ; la base n'en stocke que le SHA-256.
 * Conséquence : une fuite de la base ne permet pas de rejouer une session, et
 * une session peut être révoquée instantanément en supprimant sa ligne.
 */
export const sessions = sqliteTable("sessions", {
  // Le SHA-256 du jeton, en hexadécimal. Sert directement de clé primaire.
  jetonHash: text("jeton_hash").primaryKey(),
  adminId: text("admin_id")
    .notNull()
    .references(() => admins.id, { onDelete: "cascade" }),
  expireLe: integer("expire_le", { mode: "timestamp_ms" }).notNull(),
  creeLe: creeLe(),
}, (table) => [
  index("sessions_admin_idx").on(table.adminId),
  index("sessions_expire_idx").on(table.expireLe),
]);

/* ==========================================================================
 * Contenu
 * ========================================================================== */

export const formations = sqliteTable("formations", {
  id: id(),
  titre: text("titre").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  /** Résumé court affiché sur les cartes du catalogue. */
  descriptionCourte: text("description_courte"),
  imageCouverture: text("image_couverture"),
  statut: text("statut", { enum: STATUTS }).notNull().default("draft"),

  /**
   * Prix en CENTIMES (entier). Jamais un flottant : les arrondis sur de la
   * monnaie produisent des écarts de facturation. NULL = gratuite.
   * Inutilisé en V1, lu par Stripe plus tard.
   */
  prixCents: integer("prix_cents"),
  devise: text("devise").notNull().default("EUR"),

  ordre: real("ordre").notNull().default(0),
  publieLe: integer("publie_le", { mode: "timestamp_ms" }),
  creeLe: creeLe(),
  misAJourLe: misAJourLe(),
}, (table) => [
  uniqueIndex("formations_slug_unique").on(table.slug),
  index("formations_statut_ordre_idx").on(table.statut, table.ordre),
]);

export const chapitres = sqliteTable("chapitres", {
  id: id(),
  formationId: text("formation_id")
    .notNull()
    .references(() => formations.id, { onDelete: "cascade" }),
  titre: text("titre").notNull(),
  description: text("description"),
  ordre: real("ordre").notNull().default(0),
  creeLe: creeLe(),
  misAJourLe: misAJourLe(),
}, (table) => [
  index("chapitres_formation_ordre_idx").on(table.formationId, table.ordre),
]);

export const lecons = sqliteTable("lecons", {
  id: id(),
  chapitreId: text("chapitre_id")
    .notNull()
    .references(() => chapitres.id, { onDelete: "cascade" }),

  /**
   * Dénormalisation assumée : la formation est déductible via le chapitre,
   * mais la stocker ici évite une jointure sur le chemin le plus chaud du site
   * (résolution d'une URL /formations/x/lecons/y) et permet de garantir
   * l'unicité d'un slug de leçon à l'échelle de la formation — condition
   * nécessaire pour que l'URL soit routable sans ambiguïté.
   * Maintenue par l'application, jamais saisie à la main.
   */
  formationId: text("formation_id")
    .notNull()
    .references(() => formations.id, { onDelete: "cascade" }),

  titre: text("titre").notNull(),
  slug: text("slug").notNull(),

  /** Document Tiptap. Stocké en JSON et non en HTML, pour pouvoir re-rendre
      le contenu autrement plus tard sans avoir à re-parser du balisage. */
  contenu: text("contenu", { mode: "json" }),

  /** Pour `youtube` : l'ID de la vidéo. Pour `bunny` : le GUID Stream. */
  videoUrl: text("video_url"),
  videoProvider: text("video_provider", { enum: PROVIDERS_VIDEO }),

  dureeEstimeeMin: integer("duree_estimee_min"),
  ordre: real("ordre").notNull().default(0),
  statut: text("statut", { enum: STATUTS }).notNull().default("draft"),
  creeLe: creeLe(),
  misAJourLe: misAJourLe(),
}, (table) => [
  uniqueIndex("lecons_slug_unique_par_formation").on(table.formationId, table.slug),
  index("lecons_chapitre_ordre_idx").on(table.chapitreId, table.ordre),
]);

export const ressources = sqliteTable("ressources", {
  id: id(),
  leconId: text("lecon_id")
    .notNull()
    .references(() => lecons.id, { onDelete: "cascade" }),
  nomFichier: text("nom_fichier").notNull(),
  /** Chemin relatif dans le stockage privé — jamais une URL directe : l'accès
      passe par /api/fichiers, qui applique checkAccess() avant de servir. */
  chemin: text("chemin").notNull(),
  type: text("type", { enum: TYPES_RESSOURCE }).notNull().default("autre"),
  tailleOctets: integer("taille_octets"),
  ordre: real("ordre").notNull().default(0),
  creeLe: creeLe(),
}, (table) => [
  index("ressources_lecon_ordre_idx").on(table.leconId, table.ordre),
]);

/** Bibliothèque de médias réutilisables. */
export const medias = sqliteTable("medias", {
  id: id(),
  type: text("type", { enum: TYPES_MEDIA }).notNull(),
  /** Chemin relatif dans le stockage. L'URL publique en est dérivée. */
  chemin: text("chemin").notNull(),
  nomOriginal: text("nom_original"),
  mimeType: text("mime_type"),
  tailleOctets: integer("taille_octets"),
  largeur: integer("largeur"),
  hauteur: integer("hauteur"),
  /** Rattachements optionnels : un média peut rester orphelin dans la
      bibliothèque tant qu'il n'a pas été inséré quelque part. */
  formationId: text("formation_id").references(() => formations.id, {
    onDelete: "set null",
  }),
  leconId: text("lecon_id").references(() => lecons.id, { onDelete: "set null" }),
  creeLe: creeLe(),
}, (table) => [
  index("medias_type_cree_idx").on(table.type, table.creeLe),
]);

/* ==========================================================================
 * Tables préparatoires — créées maintenant, INUTILISÉES en V1
 * --------------------------------------------------------------------------
 * Aucun code ne les lit ni ne les écrit tant que Stripe et les comptes clients
 * ne sont pas implémentés. Elles existent pour que la future migration soit
 * additive plutôt qu'une restructuration.
 * ========================================================================== */

export const students = sqliteTable("students", {
  id: id(),
  email: text("email").notNull(),
  motDePasseHash: text("mot_de_passe_hash"),
  stripeCustomerId: text("stripe_customer_id"),
  creeLe: creeLe(),
}, (table) => [
  uniqueIndex("students_email_unique").on(sql`lower(${table.email})`),
]);

/**
 * Sessions client.
 *
 * Tant qu'il n'existe pas de vraie connexion par email, c'est ce qui rattache
 * un navigateur à l'acheteur après un paiement réussi. Même construction que
 * les sessions admin : la base ne stocke que le SHA-256 du jeton, si bien
 * qu'une fuite ne permet pas de rejouer une session, et une session reste
 * révocable en supprimant sa ligne.
 *
 * ⚠️ Limite assumée de cette étape : l'accès acheté est lié au NAVIGATEUR.
 * Effacer ses cookies, ou ouvrir la formation depuis un autre appareil, fait
 * perdre l'accès. C'est la connexion par email (étape suivante) qui lèvera
 * cette limite — l'enrollment, lui, est déjà rattaché au student et survit.
 */
export const studentSessions = sqliteTable("student_sessions", {
  jetonHash: text("jeton_hash").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  expireLe: integer("expire_le", { mode: "timestamp_ms" }).notNull(),
  creeLe: creeLe(),
}, (table) => [
  index("student_sessions_student_idx").on(table.studentId),
  index("student_sessions_expire_idx").on(table.expireLe),
]);

export const enrollments = sqliteTable("enrollments", {
  id: id(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  formationId: text("formation_id")
    .notNull()
    .references(() => formations.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id"),
  statut: text("statut", { enum: STATUTS_ENROLLMENT }).notNull().default("en_attente"),
  dateAchat: integer("date_achat", { mode: "timestamp_ms" }),
  creeLe: creeLe(),
}, (table) => [
  uniqueIndex("enrollments_unique_par_formation").on(table.studentId, table.formationId),
]);

/**
 * Suivi d'avancement.
 *
 * En V1 : `identifiantClient` = UUID anonyme dans un cookie httpOnly.
 * Plus tard, à la première connexion d'un client :
 *   UPDATE progressions SET student_id = ? WHERE identifiant_client = ?
 * Aucune progression n'est perdue lors de la bascule.
 */
export const progressions = sqliteTable("progressions", {
  id: id(),
  identifiantClient: text("identifiant_client").notNull(),
  studentId: text("student_id").references(() => students.id, { onDelete: "cascade" }),
  leconId: text("lecon_id")
    .notNull()
    .references(() => lecons.id, { onDelete: "cascade" }),
  complete: integer("complete", { mode: "boolean" }).notNull().default(false),
  completeLe: integer("complete_le", { mode: "timestamp_ms" }),
  creeLe: creeLe(),
  misAJourLe: misAJourLe(),
}, (table) => [
  uniqueIndex("progressions_unique_par_visiteur").on(
    table.identifiantClient,
    table.leconId,
  ),
  index("progressions_lecon_idx").on(table.leconId),
]);

/* ==========================================================================
 * Relations — permettent les requêtes imbriquées `db.query.x.findMany({ with })`
 * ========================================================================== */

export const formationsRelations = relations(formations, ({ many }) => ({
  chapitres: many(chapitres),
  lecons: many(lecons),
}));

export const chapitresRelations = relations(chapitres, ({ one, many }) => ({
  formation: one(formations, {
    fields: [chapitres.formationId],
    references: [formations.id],
  }),
  lecons: many(lecons),
}));

export const leconsRelations = relations(lecons, ({ one, many }) => ({
  chapitre: one(chapitres, {
    fields: [lecons.chapitreId],
    references: [chapitres.id],
  }),
  formation: one(formations, {
    fields: [lecons.formationId],
    references: [formations.id],
  }),
  ressources: many(ressources),
}));

export const ressourcesRelations = relations(ressources, ({ one }) => ({
  lecon: one(lecons, { fields: [ressources.leconId], references: [lecons.id] }),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  admin: one(admins, { fields: [sessions.adminId], references: [admins.id] }),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  enrollments: many(enrollments),
  sessions: many(studentSessions),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  formation: one(formations, {
    fields: [enrollments.formationId],
    references: [formations.id],
  }),
}));

export const studentSessionsRelations = relations(studentSessions, ({ one }) => ({
  student: one(students, {
    fields: [studentSessions.studentId],
    references: [students.id],
  }),
}));

/* ==========================================================================
 * Types inférés — à utiliser partout plutôt que de redéclarer des interfaces
 * ========================================================================== */

export type Admin = typeof admins.$inferSelect;
export type Formation = typeof formations.$inferSelect;
export type FormationInsert = typeof formations.$inferInsert;
export type Chapitre = typeof chapitres.$inferSelect;
export type ChapitreInsert = typeof chapitres.$inferInsert;
export type Lecon = typeof lecons.$inferSelect;
export type LeconInsert = typeof lecons.$inferInsert;
export type Ressource = typeof ressources.$inferSelect;
export type Media = typeof medias.$inferSelect;
export type Progression = typeof progressions.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type StudentSession = typeof studentSessions.$inferSelect;

export type Statut = (typeof STATUTS)[number];
export type ProviderVideo = (typeof PROVIDERS_VIDEO)[number];
export type TypeMedia = (typeof TYPES_MEDIA)[number];
export type TypeRessource = (typeof TYPES_RESSOURCE)[number];
