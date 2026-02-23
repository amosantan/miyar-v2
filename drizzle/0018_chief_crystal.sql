CREATE TABLE `accuracy_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` timestamp NOT NULL DEFAULT (now()),
	`totalComparisons` int NOT NULL,
	`withCostPrediction` int NOT NULL,
	`withOutcomePrediction` int NOT NULL,
	`costWithin10Pct` int NOT NULL,
	`costWithin20Pct` int NOT NULL,
	`costOutside20Pct` int NOT NULL,
	`costMaePct` decimal(8,4),
	`costTrend` enum('improving','stable','degrading','insufficient_data') NOT NULL,
	`scoreCorrectPredictions` int NOT NULL,
	`scoreIncorrectPredictions` int NOT NULL,
	`scoreAccuracyRate` decimal(8,4) NOT NULL,
	`scoreTrend` enum('improving','stable','degrading','insufficient_data') NOT NULL,
	`riskCorrectPredictions` int NOT NULL,
	`riskIncorrectPredictions` int NOT NULL,
	`riskAccuracyRate` decimal(8,4) NOT NULL,
	`riskTrend` enum('improving','stable','degrading','insufficient_data') NOT NULL,
	`overallPlatformAccuracy` decimal(8,4) NOT NULL,
	`gradeA` int NOT NULL,
	`gradeB` int NOT NULL,
	`gradeC` int NOT NULL,
	CONSTRAINT `accuracy_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decision_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` enum('risk_indicator','success_driver','cost_anomaly') NOT NULL,
	`conditions` json NOT NULL,
	`matchCount` int NOT NULL DEFAULT 0,
	`reliabilityScore` decimal(5,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_pattern_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`patternId` int NOT NULL,
	`matchedAt` timestamp NOT NULL DEFAULT (now()),
	`confidence` decimal(5,2) NOT NULL DEFAULT '1.00',
	`contextSnapshot` json,
	CONSTRAINT `project_pattern_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `logic_change_log` ADD `status` enum('applied','proposed','rejected') DEFAULT 'applied' NOT NULL;