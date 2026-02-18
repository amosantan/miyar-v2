CREATE TABLE `benchmark_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('materials','finishes','ffe','procurement','cost_bands','tier_definitions','style_families','brand_archetypes','risk_factors','lead_times') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`market` varchar(64) NOT NULL DEFAULT 'UAE',
	`submarket` varchar(64) DEFAULT 'Dubai',
	`projectClass` enum('mid','upper','luxury','ultra_luxury') NOT NULL,
	`validFrom` timestamp,
	`validTo` timestamp,
	`confidenceLevel` enum('high','medium','low') DEFAULT 'medium',
	`sourceType` enum('manual','admin','imported','curated') DEFAULT 'admin',
	`benchmarkVersionId` int,
	`data` json NOT NULL,
	`versionTag` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `benchmark_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versionTag` varchar(64) NOT NULL,
	`description` text,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`publishedBy` int,
	`recordCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `benchmark_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `benchmark_versions_versionTag_unique` UNIQUE(`versionTag`)
);
--> statement-breakpoint
CREATE TABLE `project_intelligence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scoreMatrixId` int NOT NULL,
	`benchmarkVersionId` int,
	`modelVersionId` int,
	`costDeltaVsBenchmark` decimal(10,2),
	`uniquenessIndex` decimal(6,4),
	`feasibilityFlags` json,
	`reworkRiskIndex` decimal(6,4),
	`procurementComplexity` decimal(6,4),
	`tierPercentile` decimal(6,4),
	`styleFamily` varchar(64),
	`costBand` varchar(32),
	`inputSnapshot` json,
	`scoreSnapshot` json,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_intelligence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roi_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`hourlyRate` decimal(10,2) NOT NULL DEFAULT '350',
	`reworkCostPct` decimal(6,4) NOT NULL DEFAULT '0.12',
	`tenderIterationCost` decimal(10,2) NOT NULL DEFAULT '25000',
	`designCycleCost` decimal(10,2) NOT NULL DEFAULT '45000',
	`budgetVarianceMultiplier` decimal(6,4) NOT NULL DEFAULT '0.08',
	`timeAccelerationWeeks` int DEFAULT 6,
	`conservativeMultiplier` decimal(6,4) NOT NULL DEFAULT '0.60',
	`aggressiveMultiplier` decimal(6,4) NOT NULL DEFAULT '1.40',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `roi_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`secret` varchar(255),
	`events` json NOT NULL,
	`fieldMapping` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`lastStatus` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `webhook_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `report_instances` MODIFY COLUMN `reportType` enum('executive_pack','full_technical','tender_brief','executive_decision_pack','design_brief_rfq','marketing_starter','validation_summary','design_brief','rfq_pack','full_report') NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `benchmarkVersionId` int;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `modelVersionId` int;--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `benchmarkVersionId` int;--> statement-breakpoint
ALTER TABLE `report_instances` ADD `bundleUrl` text;--> statement-breakpoint
ALTER TABLE `report_instances` ADD `benchmarkVersionId` int;--> statement-breakpoint
ALTER TABLE `report_instances` ADD `modelVersionId` int;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `isTemplate` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `templateKey` varchar(64);--> statement-breakpoint
ALTER TABLE `score_matrices` ADD `benchmarkVersionId` int;