CREATE TABLE `pdf_extractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`assetId` int NOT NULL,
	`pageNumber` int,
	`extractionMethod` enum('text_layer','vision_ai','manual') NOT NULL DEFAULT 'manual',
	`extractedRooms` json,
	`totalExtractedArea` decimal(12,2),
	`extractionStatus` enum('pending','extracted','verified','rejected') NOT NULL DEFAULT 'pending',
	`verifiedBy` int,
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pdf_extractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `status` enum('draft','draft_area_verification','ready','processing','evaluated','locked') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `projects` ADD `totalFitoutArea` decimal(12,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `totalNonFinishArea` decimal(12,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `fitoutAreaVerified` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `projects` ADD `projectArchetype` enum('residential_multi','office','single_villa','hospitality','community');