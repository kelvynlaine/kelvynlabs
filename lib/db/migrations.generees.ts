/**
 * FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.
 *
 * Produit par `scripts/embarquer-migrations.mjs` à partir de `drizzle/*.sql`.
 * Pour le mettre à jour : `npm run db:embarquer` (fait automatiquement au build).
 */

export type MigrationEmbarquee = {
  readonly idx: number;
  readonly tag: string;
  /** Horodatage du journal drizzle-kit (`__drizzle_migrations.created_at`). */
  readonly quand: number;
  readonly instructions: readonly string[];
};

export const migrationsEmbarquees: readonly MigrationEmbarquee[] = [
  {
    idx: 0,
    tag: "0000_schema_initial",
    quand: 1785327824036,
    instructions: [
      "CREATE TABLE `admins` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`email` text NOT NULL,\n\t`mot_de_passe_hash` text NOT NULL,\n\t`nom` text,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL\n);",
      "CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (lower(\"email\"));",
      "CREATE TABLE `chapitres` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`formation_id` text NOT NULL,\n\t`titre` text NOT NULL,\n\t`description` text,\n\t`ordre` real DEFAULT 0 NOT NULL,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\t`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX `chapitres_formation_ordre_idx` ON `chapitres` (`formation_id`,`ordre`);",
      "CREATE TABLE `enrollments` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`student_id` text NOT NULL,\n\t`formation_id` text NOT NULL,\n\t`stripe_session_id` text,\n\t`statut` text DEFAULT 'en_attente' NOT NULL,\n\t`date_achat` integer,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX `enrollments_unique_par_formation` ON `enrollments` (`student_id`,`formation_id`);",
      "CREATE TABLE `formations` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`titre` text NOT NULL,\n\t`slug` text NOT NULL,\n\t`description` text,\n\t`description_courte` text,\n\t`image_couverture` text,\n\t`statut` text DEFAULT 'draft' NOT NULL,\n\t`prix_cents` integer,\n\t`devise` text DEFAULT 'EUR' NOT NULL,\n\t`ordre` real DEFAULT 0 NOT NULL,\n\t`publie_le` integer,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\t`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL\n);",
      "CREATE UNIQUE INDEX `formations_slug_unique` ON `formations` (`slug`);",
      "CREATE INDEX `formations_statut_ordre_idx` ON `formations` (`statut`,`ordre`);",
      "CREATE TABLE `lecons` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`chapitre_id` text NOT NULL,\n\t`formation_id` text NOT NULL,\n\t`titre` text NOT NULL,\n\t`slug` text NOT NULL,\n\t`contenu` text,\n\t`video_url` text,\n\t`video_provider` text,\n\t`duree_estimee_min` integer,\n\t`ordre` real DEFAULT 0 NOT NULL,\n\t`statut` text DEFAULT 'draft' NOT NULL,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\t`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`chapitre_id`) REFERENCES `chapitres`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX `lecons_slug_unique_par_formation` ON `lecons` (`formation_id`,`slug`);",
      "CREATE INDEX `lecons_chapitre_ordre_idx` ON `lecons` (`chapitre_id`,`ordre`);",
      "CREATE TABLE `medias` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`type` text NOT NULL,\n\t`chemin` text NOT NULL,\n\t`nom_original` text,\n\t`mime_type` text,\n\t`taille_octets` integer,\n\t`largeur` integer,\n\t`hauteur` integer,\n\t`formation_id` text,\n\t`lecon_id` text,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE set null,\n\tFOREIGN KEY (`lecon_id`) REFERENCES `lecons`(`id`) ON UPDATE no action ON DELETE set null\n);",
      "CREATE INDEX `medias_type_cree_idx` ON `medias` (`type`,`cree_le`);",
      "CREATE TABLE `progressions` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`identifiant_client` text NOT NULL,\n\t`student_id` text,\n\t`lecon_id` text NOT NULL,\n\t`complete` integer DEFAULT false NOT NULL,\n\t`complete_le` integer,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\t`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`lecon_id`) REFERENCES `lecons`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX `progressions_unique_par_visiteur` ON `progressions` (`identifiant_client`,`lecon_id`);",
      "CREATE INDEX `progressions_lecon_idx` ON `progressions` (`lecon_id`);",
      "CREATE TABLE `ressources` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`lecon_id` text NOT NULL,\n\t`nom_fichier` text NOT NULL,\n\t`chemin` text NOT NULL,\n\t`type` text DEFAULT 'autre' NOT NULL,\n\t`taille_octets` integer,\n\t`ordre` real DEFAULT 0 NOT NULL,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`lecon_id`) REFERENCES `lecons`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX `ressources_lecon_ordre_idx` ON `ressources` (`lecon_id`,`ordre`);",
      "CREATE TABLE `sessions` (\n\t`jeton_hash` text PRIMARY KEY NOT NULL,\n\t`admin_id` text NOT NULL,\n\t`expire_le` integer NOT NULL,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX `sessions_admin_idx` ON `sessions` (`admin_id`);",
      "CREATE INDEX `sessions_expire_idx` ON `sessions` (`expire_le`);",
      "CREATE TABLE `students` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`email` text NOT NULL,\n\t`mot_de_passe_hash` text,\n\t`stripe_customer_id` text,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL\n);",
      "CREATE UNIQUE INDEX `students_email_unique` ON `students` (lower(\"email\"));",
    ],
  },
  {
    idx: 1,
    tag: "0001_sessions_client",
    quand: 1785334397438,
    instructions: [
      "CREATE TABLE `student_sessions` (\n\t`jeton_hash` text PRIMARY KEY NOT NULL,\n\t`student_id` text NOT NULL,\n\t`expire_le` integer NOT NULL,\n\t`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,\n\tFOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX `student_sessions_student_idx` ON `student_sessions` (`student_id`);",
      "CREATE INDEX `student_sessions_expire_idx` ON `student_sessions` (`expire_le`);",
    ],
  },
] as const;
