CREATE TABLE `outcome_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`comparedAt` timestamp NOT NULL DEFAULT (now()),
	`predictedCostMid` decimal(15,2),
	`actualCost` decimal(15,2),
	`costDeltaPct` decimal(10,4),
	`costAccuracyBand` enum('within_10pct','within_20pct','outside_20pct','no_prediction') NOT NULL,
	`predictedComposite` decimal(5,4) NOT NULL,
	`predictedDecision` varchar(64) NOT NULL,
	`actualOutcomeSuccess` boolean NOT NULL,
	`scorePredictionCorrect` boolean NOT NULL,
	`predictedRisk` decimal(5,4) NOT NULL,
	`actualReworkOccurred` boolean NOT NULL,
	`riskPredictionCorrect` boolean NOT NULL,
	`overallAccuracyGrade` enum('A','B','C','insufficient_data') NOT NULL,
	`learningSignals` json,
	`rawComparison` json,
	CONSTRAINT `outcome_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `actualFitoutCostPerSqm` decimal(10,2);--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `actualTotalCost` decimal(15,2);--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `projectDeliveredOnTime` boolean;--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `reworkOccurred` boolean;--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `reworkCostAed` decimal(15,2);--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `clientSatisfactionScore` int;--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `tenderIterations` int;--> statement-breakpoint
ALTER TABLE `project_outcomes` ADD `keyLessonsLearned` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);