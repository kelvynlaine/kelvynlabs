CREATE TABLE `jetons_connexion` (
	`jeton_hash` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`expire_le` integer NOT NULL,
	`utilise_le` integer,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jetons_connexion_student_idx` ON `jetons_connexion` (`student_id`);--> statement-breakpoint
CREATE INDEX `jetons_connexion_expire_idx` ON `jetons_connexion` (`expire_le`);