CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(64),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`typology` varchar(64) NOT NULL,
	`location` varchar(64) NOT NULL,
	`marketTier` varchar(64) NOT NULL,
	`materialLevel` int NOT NULL,
	`costPerSqftLow` decimal(10,2),
	`costPerSqftMid` decimal(10,2),
	`costPerSqftHigh` decimal(10,2),
	`avgSellingPrice` decimal(10,2),
	`absorptionRate` decimal(6,4),
	`competitiveDensity` int,
	`sourceType` enum('synthetic','client_provided','curated') DEFAULT 'synthetic',
	`dataYear` int,
	`region` varchar(64) DEFAULT 'UAE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `benchmark_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `direction_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`isPrimary` boolean DEFAULT false,
	`des01Style` enum('Modern','Contemporary','Minimal','Classic','Fusion','Other'),
	`des02MaterialLevel` int,
	`des03Complexity` int,
	`des04Experience` int,
	`fin01BudgetCap` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `direction_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versionTag` varchar(32) NOT NULL,
	`dimensionWeights` json NOT NULL,
	`variableWeights` json NOT NULL,
	`penaltyConfig` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	`notes` text,
	CONSTRAINT `model_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_versions_versionTag_unique` UNIQUE(`versionTag`)
);
--> statement-breakpoint
CREATE TABLE `override_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`overrideType` enum('strategic','market_insight','risk_adjustment','experimental') NOT NULL,
	`authorityLevel` int NOT NULL,
	`originalValue` json NOT NULL,
	`overrideValue` json NOT NULL,
	`justification` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `override_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','ready','processing','evaluated','locked') NOT NULL DEFAULT 'draft',
	`ctx01Typology` enum('Residential','Mixed-use','Hospitality','Office') DEFAULT 'Residential',
	`ctx02Scale` enum('Small','Medium','Large') DEFAULT 'Medium',
	`ctx03Gfa` decimal(12,2),
	`ctx04Location` enum('Prime','Secondary','Emerging') DEFAULT 'Secondary',
	`ctx05Horizon` enum('0-12m','12-24m','24-36m','36m+') DEFAULT '12-24m',
	`str01BrandClarity` int DEFAULT 3,
	`str02Differentiation` int DEFAULT 3,
	`str03BuyerMaturity` int DEFAULT 3,
	`mkt01Tier` enum('Mid','Upper-mid','Luxury','Ultra-luxury') DEFAULT 'Upper-mid',
	`mkt02Competitor` int DEFAULT 3,
	`mkt03Trend` int DEFAULT 3,
	`fin01BudgetCap` decimal(10,2),
	`fin02Flexibility` int DEFAULT 3,
	`fin03ShockTolerance` int DEFAULT 3,
	`fin04SalesPremium` int DEFAULT 3,
	`des01Style` enum('Modern','Contemporary','Minimal','Classic','Fusion','Other') DEFAULT 'Modern',
	`des02MaterialLevel` int DEFAULT 3,
	`des03Complexity` int DEFAULT 3,
	`des04Experience` int DEFAULT 3,
	`des05Sustainability` int DEFAULT 2,
	`exe01SupplyChain` int DEFAULT 3,
	`exe02Contractor` int DEFAULT 3,
	`exe03Approvals` int DEFAULT 2,
	`exe04QaMaturity` int DEFAULT 3,
	`add01SampleKit` boolean DEFAULT false,
	`add02PortfolioMode` boolean DEFAULT false,
	`add03DashboardExport` boolean DEFAULT true,
	`modelVersionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lockedAt` timestamp,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scoreMatrixId` int NOT NULL,
	`reportType` enum('validation_summary','design_brief','rfq_pack','full_report') NOT NULL,
	`fileUrl` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`generatedBy` int,
	CONSTRAINT `report_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`variableOverrides` json,
	`scoreMatrixId` int,
	`rasScore` decimal(6,2),
	`isDominant` boolean DEFAULT false,
	`stabilityScore` decimal(6,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `score_matrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`directionId` int,
	`modelVersionId` int NOT NULL,
	`saScore` decimal(6,2) NOT NULL,
	`ffScore` decimal(6,2) NOT NULL,
	`mpScore` decimal(6,2) NOT NULL,
	`dsScore` decimal(6,2) NOT NULL,
	`erScore` decimal(6,2) NOT NULL,
	`compositeScore` decimal(6,2) NOT NULL,
	`riskScore` decimal(6,2) NOT NULL,
	`rasScore` decimal(6,2) NOT NULL,
	`confidenceScore` decimal(6,2) NOT NULL,
	`decisionStatus` enum('validated','conditional','not_validated') NOT NULL,
	`penalties` json,
	`riskFlags` json,
	`dimensionWeights` json NOT NULL,
	`variableContributions` json NOT NULL,
	`conditionalActions` json,
	`inputSnapshot` json NOT NULL,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `score_matrices_id` PRIMARY KEY(`id`)
);
