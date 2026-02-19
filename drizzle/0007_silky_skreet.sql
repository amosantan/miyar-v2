CREATE TABLE `benchmark_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`basedOnOutcomesQuery` text,
	`suggestedChanges` json NOT NULL,
	`confidence` decimal(6,4),
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`reviewerNotes` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmark_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logic_change_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logicVersionId` int NOT NULL,
	`actor` int NOT NULL,
	`changeSummary` text NOT NULL,
	`rationale` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logic_change_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logic_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logicVersionId` int NOT NULL,
	`ruleKey` varchar(128) NOT NULL,
	`thresholdValue` decimal(10,4) NOT NULL,
	`comparator` enum('gt','gte','lt','lte','eq','neq') NOT NULL,
	`notes` text,
	CONSTRAINT `logic_thresholds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logic_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`publishedAt` timestamp,
	`notes` text,
	CONSTRAINT `logic_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logic_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logicVersionId` int NOT NULL,
	`dimension` varchar(32) NOT NULL,
	`weight` decimal(6,4) NOT NULL,
	CONSTRAINT `logic_weights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`procurementActualCosts` json,
	`leadTimesActual` json,
	`rfqResults` json,
	`adoptionMetrics` json,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`capturedBy` int,
	CONSTRAINT `project_outcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`baselineScenarioId` int NOT NULL,
	`comparedScenarioIds` json NOT NULL,
	`decisionNote` text,
	`comparisonResult` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_inputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scenarioId` int NOT NULL,
	`jsonInput` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_inputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_outputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scenarioId` int NOT NULL,
	`scoreJson` json NOT NULL,
	`roiJson` json,
	`riskJson` json,
	`boardCostJson` json,
	`benchmarkVersionId` int,
	`logicVersionId` int,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_outputs_id` PRIMARY KEY(`id`)
);
