CREATE TABLE `asset_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`linkType` enum('evaluation','report','scenario','material_board','design_brief','visual') NOT NULL,
	`linkId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`entityType` enum('design_brief','material_board','visual','general') NOT NULL,
	`entityId` int,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scenarioId` int,
	`version` int NOT NULL DEFAULT 1,
	`projectIdentity` json NOT NULL,
	`positioningStatement` text NOT NULL,
	`styleMood` json NOT NULL,
	`materialGuidance` json NOT NULL,
	`budgetGuardrails` json NOT NULL,
	`procurementConstraints` json NOT NULL,
	`deliverablesChecklist` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `design_briefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_visuals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scenarioId` int,
	`type` enum('mood','material_board','hero') NOT NULL,
	`promptJson` json NOT NULL,
	`modelVersion` varchar(64) DEFAULT 'nano-banana-v1',
	`imageAssetId` int,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_visuals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scenarioId` int,
	`boardName` varchar(255) NOT NULL,
	`boardJson` json NOT NULL,
	`boardImageAssetId` int,
	`benchmarkVersionId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materials_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('tile','stone','wood','metal','fabric','glass','paint','wallpaper','lighting','furniture','fixture','accessory','other') NOT NULL,
	`tier` enum('economy','mid','premium','luxury','ultra_luxury') NOT NULL,
	`typicalCostLow` decimal(10,2),
	`typicalCostHigh` decimal(10,2),
	`costUnit` varchar(32) DEFAULT 'AED/sqm',
	`leadTimeDays` int,
	`leadTimeBand` enum('short','medium','long','critical') DEFAULT 'medium',
	`regionAvailability` json,
	`supplierName` varchar(255),
	`supplierContact` varchar(255),
	`supplierUrl` text,
	`imageUrl` text,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materials_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materials_to_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`materialId` int NOT NULL,
	`quantity` decimal(10,2),
	`unitOfMeasure` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `materials_to_boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`filename` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` int NOT NULL,
	`storagePath` text NOT NULL,
	`storageUrl` text,
	`checksum` varchar(128),
	`uploadedBy` int NOT NULL,
	`category` enum('brief','brand','budget','competitor','inspiration','material','sales','legal','mood_image','material_board','marketing_hero','generated','other') NOT NULL DEFAULT 'other',
	`tags` json,
	`notes` text,
	`isClientVisible` boolean NOT NULL DEFAULT true,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('mood','material_board','hero') NOT NULL,
	`templateText` text NOT NULL,
	`variables` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompt_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `report_instances` MODIFY COLUMN `reportType` enum('executive_pack','full_technical','tender_brief','executive_decision_pack','design_brief_rfq','marketing_starter','validation_summary','design_brief','rfq_pack','full_report','marketing_prelaunch') NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `approvalState` enum('draft','review','approved_rfq','approved_marketing') DEFAULT 'draft';