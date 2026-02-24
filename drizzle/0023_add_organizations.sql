CREATE TABLE `organization_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`domain` varchar(255),
	`plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`stripeCustomerId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `evidence_references` MODIFY COLUMN `targetType` enum('scenario','decision_note','explainability_driver','design_brief','report','material_board','pack_section') NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `prompt_templates` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `orgId` int;