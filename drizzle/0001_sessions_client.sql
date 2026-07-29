CREATE TABLE `student_sessions` (
	`jeton_hash` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`expire_le` integer NOT NULL,
	`cree_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_sessions_student_idx` ON `student_sessions` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_sessions_expire_idx` ON `student_sessions` (`expire_le`);