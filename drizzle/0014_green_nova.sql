CREATE TABLE `project_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`insightType` enum('cost_pressure','market_opportunity','competitor_alert','trend_signal','positioning_gap') NOT NULL,
	`insightSeverity` enum('critical','warning','info') NOT NULL,
	`title` varchar(512) NOT NULL,
	`body` text,
	`actionableRecommendation` text,
	`confidenceScore` decimal(5,4),
	`triggerCondition` text,
	`dataPoints` json,
	`insightStatus` enum('active','acknowledged','dismissed','resolved') NOT NULL DEFAULT 'active',
	`acknowledgedBy` int,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_insights_id` PRIMARY KEY(`id`)
);
