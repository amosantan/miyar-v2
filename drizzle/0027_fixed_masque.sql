CREATE TABLE `bias_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scoreMatrixId` int,
	`userId` int NOT NULL,
	`orgId` int,
	`biasType` enum('optimism_bias','anchoring_bias','confirmation_bias','overconfidence','scope_creep','sunk_cost','clustering_illusion') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`confidence` decimal(5,2) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`intervention` text,
	`evidencePoints` json,
	`mathExplanation` text,
	`dismissed` boolean DEFAULT false,
	`dismissedBy` int,
	`dismissedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bias_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bias_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orgId` int,
	`biasType` varchar(64) NOT NULL,
	`occurrenceCount` int DEFAULT 0,
	`lastDetectedAt` timestamp,
	`avgSeverity` decimal(3,2),
	`trend` enum('increasing','stable','decreasing') DEFAULT 'stable',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bias_profiles_id` PRIMARY KEY(`id`)
);
