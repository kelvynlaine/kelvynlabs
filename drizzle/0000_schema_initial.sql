CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`mot_de_passe_hash` text NOT NULL,
	`nom` text,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (lower("email"));--> statement-breakpoint
CREATE TABLE `chapitres` (
	`id` text PRIMARY KEY NOT NULL,
	`formation_id` text NOT NULL,
	`titre` text NOT NULL,
	`description` text,
	`ordre` real DEFAULT 0 NOT NULL,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapitres_formation_ordre_idx` ON `chapitres` (`formation_id`,`ordre`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`formation_id` text NOT NULL,
	`stripe_session_id` text,
	`statut` text DEFAULT 'en_attente' NOT NULL,
	`date_achat` integer,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_unique_par_formation` ON `enrollments` (`student_id`,`formation_id`);--> statement-breakpoint
CREATE TABLE `formations` (
	`id` text PRIMARY KEY NOT NULL,
	`titre` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`description_courte` text,
	`image_couverture` text,
	`statut` text DEFAULT 'draft' NOT NULL,
	`prix_cents` integer,
	`devise` text DEFAULT 'EUR' NOT NULL,
	`ordre` real DEFAULT 0 NOT NULL,
	`publie_le` integer,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `formations_slug_unique` ON `formations` (`slug`);--> statement-breakpoint
CREATE INDEX `formations_statut_ordre_idx` ON `formations` (`statut`,`ordre`);--> statement-breakpoint
CREATE TABLE `lecons` (
	`id` text PRIMARY KEY NOT NULL,
	`chapitre_id` text NOT NULL,
	`formation_id` text NOT NULL,
	`titre` text NOT NULL,
	`slug` text NOT NULL,
	`contenu` text,
	`video_url` text,
	`video_provider` text,
	`duree_estimee_min` integer,
	`ordre` real DEFAULT 0 NOT NULL,
	`statut` text DEFAULT 'draft' NOT NULL,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`chapitre_id`) REFERENCES `chapitres`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lecons_slug_unique_par_formation` ON `lecons` (`formation_id`,`slug`);--> statement-breakpoint
CREATE INDEX `lecons_chapitre_ordre_idx` ON `lecons` (`chapitre_id`,`ordre`);--> statement-breakpoint
CREATE TABLE `medias` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`chemin` text NOT NULL,
	`nom_original` text,
	`mime_type` text,
	`taille_octets` integer,
	`largeur` integer,
	`hauteur` integer,
	`formation_id` text,
	`lecon_id` text,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lecon_id`) REFERENCES `lecons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `medias_type_cree_idx` ON `medias` (`type`,`cree_le`);--> statement-breakpoint
CREATE TABLE `progressions` (
	`id` text PRIMARY KEY NOT NULL,
	`identifiant_client` text NOT NULL,
	`student_id` text,
	`lecon_id` text NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`complete_le` integer,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`mis_a_jour_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lecon_id`) REFERENCES `lecons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progressions_unique_par_visiteur` ON `progressions` (`identifiant_client`,`lecon_id`);--> statement-breakpoint
CREATE INDEX `progressions_lecon_idx` ON `progressions` (`lecon_id`);--> statement-breakpoint
CREATE TABLE `ressources` (
	`id` text PRIMARY KEY NOT NULL,
	`lecon_id` text NOT NULL,
	`nom_fichier` text NOT NULL,
	`chemin` text NOT NULL,
	`type` text DEFAULT 'autre' NOT NULL,
	`taille_octets` integer,
	`ordre` real DEFAULT 0 NOT NULL,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lecon_id`) REFERENCES `lecons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ressources_lecon_ordre_idx` ON `ressources` (`lecon_id`,`ordre`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`jeton_hash` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`expire_le` integer NOT NULL,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_admin_idx` ON `sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `sessions_expire_idx` ON `sessions` (`expire_le`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`mot_de_passe_hash` text,
	`stripe_customer_id` text,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_email_unique` ON `students` (lower("email"));