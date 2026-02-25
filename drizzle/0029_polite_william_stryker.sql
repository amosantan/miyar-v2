CREATE TABLE `design_trends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trendName` varchar(255) NOT NULL,
	`trendCategory` enum('style','material','color','layout','technology','sustainability','other') NOT NULL,
	`confidenceLevel` enum('emerging','established','declining') NOT NULL DEFAULT 'emerging',
	`sourceUrl` text,
	`sourceRegistryId` int,
	`description` text,
	`relatedMaterials` json,
	`styleClassification` varchar(128),
	`region` varchar(64) DEFAULT 'UAE',
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`mentionCount` int NOT NULL DEFAULT 1,
	`runId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `design_trends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `generated_visuals` MODIFY COLUMN `type` enum('mood','mood_board','material_board','room_render','kitchen_render','bathroom_render','color_palette','hero') NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `ctx01Typology` enum('Residential','Mixed-use','Hospitality','Office','Villa','Gated Community','Villa Development') DEFAULT 'Residential';--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `finishLevel` enum('basic','standard','premium','luxury','ultra_luxury');--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `designStyle` varchar(255);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `brandsMentioned` json;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `materialSpec` text;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `intelligenceType` enum('material_price','finish_specification','design_trend','market_statistic','competitor_positioning','regulation') DEFAULT 'material_price';--> statement-breakpoint
ALTER TABLE `projects` ADD `unitMix` json;--> statement-breakpoint
ALTER TABLE `projects` ADD `villaSpaces` json;--> statement-breakpoint
ALTER TABLE `projects` ADD `developerGuidelines` json;