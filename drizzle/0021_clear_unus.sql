CREATE TABLE `nl_query_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`query_text` text NOT NULL,
	`sql_generated` text,
	`rows_returned` int DEFAULT 0,
	`execution_ms` int,
	`status` enum('success','error','blocked') DEFAULT 'success',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nl_query_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `nl_query_log` ADD CONSTRAINT `nl_query_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;