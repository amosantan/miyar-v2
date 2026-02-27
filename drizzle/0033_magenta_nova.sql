CREATE TABLE `material_constants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialType` varchar(32) NOT NULL,
	`carbonIntensity` decimal(10,4) NOT NULL,
	`density` int NOT NULL,
	`typicalThickness` decimal(6,3) NOT NULL,
	`recyclability` decimal(4,3) NOT NULL,
	`maintenanceFactor` decimal(6,4) NOT NULL,
	`costPerM2` decimal(10,2) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_constants_id` PRIMARY KEY(`id`),
	CONSTRAINT `material_constants_materialType_unique` UNIQUE(`materialType`)
);
--> statement-breakpoint
CREATE TABLE `sustainability_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`compositeScore` int NOT NULL,
	`grade` varchar(2) NOT NULL,
	`embodiedCarbon` decimal(18,2) NOT NULL,
	`operationalEnergy` decimal(18,2) NOT NULL,
	`lifecycleCost` decimal(18,2) NOT NULL,
	`carbonPerSqm` decimal(12,2),
	`energyRating` varchar(2),
	`renewablesEnabled` boolean DEFAULT false,
	`waterRecycling` boolean DEFAULT false,
	`configSnapshot` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sustainability_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_design_briefs` ADD `share_token` varchar(64);--> statement-breakpoint
ALTER TABLE `ai_design_briefs` ADD `share_expires_at` timestamp;