CREATE TABLE `benchmark_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`benchmarkKey` varchar(255) NOT NULL,
	`currentTypical` decimal(12,2),
	`currentMin` decimal(12,2),
	`currentMax` decimal(12,2),
	`proposedP25` decimal(12,2) NOT NULL,
	`proposedP50` decimal(12,2) NOT NULL,
	`proposedP75` decimal(12,2) NOT NULL,
	`weightedMean` decimal(12,2) NOT NULL,
	`deltaPct` decimal(8,2),
	`evidenceCount` int NOT NULL,
	`sourceDiversity` int NOT NULL,
	`reliabilityDist` json NOT NULL,
	`recencyDist` json NOT NULL,
	`confidenceScore` int NOT NULL,
	`impactNotes` text,
	`recommendation` enum('publish','reject') NOT NULL,
	`rejectionReason` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewerNotes` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`benchmarkSnapshotId` int,
	`runId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmark_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`benchmarkVersionId` int,
	`snapshotJson` json NOT NULL,
	`description` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmark_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitor_entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`headquarters` varchar(255),
	`segmentFocus` enum('affordable','mid','premium','luxury','ultra_luxury','mixed') DEFAULT 'mixed',
	`website` text,
	`logoUrl` text,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitor_entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitor_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitorId` int NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`location` varchar(255),
	`segment` enum('affordable','mid','premium','luxury','ultra_luxury'),
	`assetType` enum('residential','commercial','hospitality','mixed_use') DEFAULT 'residential',
	`positioningKeywords` json,
	`interiorStyleSignals` json,
	`materialCues` json,
	`amenityList` json,
	`unitMix` text,
	`priceIndicators` json,
	`salesMessaging` json,
	`differentiationClaims` json,
	`completionStatus` enum('announced','under_construction','completed','sold_out'),
	`launchDate` varchar(32),
	`totalUnits` int,
	`architect` varchar(255),
	`interiorDesigner` varchar(255),
	`sourceUrl` text,
	`captureDate` timestamp,
	`evidenceCitations` json,
	`completenessScore` int,
	`runId` varchar(64),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitor_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tagId` int NOT NULL,
	`entityType` enum('competitor_project','scenario','evidence_record','project') NOT NULL,
	`entityId` int NOT NULL,
	`addedBy` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entity_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` varchar(64) NOT NULL,
	`projectId` int,
	`sourceRegistryId` int,
	`category` enum('floors','walls','ceilings','joinery','lighting','sanitary','kitchen','hardware','ffe','other') NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`specClass` varchar(128),
	`priceMin` decimal(12,2),
	`priceTypical` decimal(12,2),
	`priceMax` decimal(12,2),
	`unit` varchar(32) NOT NULL,
	`currencyOriginal` varchar(8) DEFAULT 'AED',
	`currencyAed` decimal(12,2),
	`fxRate` decimal(10,6),
	`fxSource` text,
	`sourceUrl` text NOT NULL,
	`publisher` varchar(255),
	`captureDate` timestamp NOT NULL,
	`reliabilityGrade` enum('A','B','C') NOT NULL,
	`confidenceScore` int NOT NULL,
	`extractedSnippet` text,
	`notes` text,
	`runId` varchar(64),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `evidence_records_recordId_unique` UNIQUE(`recordId`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runType` enum('price_extraction','competitor_extraction','benchmark_proposal','manual_entry') NOT NULL,
	`runId` varchar(64) NOT NULL,
	`actor` int,
	`inputSummary` json,
	`outputSummary` json,
	`sourcesProcessed` int DEFAULT 0,
	`recordsExtracted` int DEFAULT 0,
	`errors` int DEFAULT 0,
	`errorDetails` json,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	CONSTRAINT `intelligence_audit_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `intelligence_audit_log_runId_unique` UNIQUE(`runId`)
);
--> statement-breakpoint
CREATE TABLE `source_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`sourceType` enum('supplier_catalog','manufacturer_catalog','developer_brochure','industry_report','government_tender','procurement_portal','trade_publication','retailer_listing','aggregator','other') NOT NULL,
	`reliabilityDefault` enum('A','B','C') NOT NULL DEFAULT 'B',
	`isWhitelisted` boolean NOT NULL DEFAULT true,
	`region` varchar(64) DEFAULT 'UAE',
	`notes` text,
	`addedBy` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trend_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` enum('material_trend','design_trend','market_trend','buyer_preference','sustainability','technology','pricing','other') NOT NULL,
	`description` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trend_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `trend_tags_name_unique` UNIQUE(`name`)
);
