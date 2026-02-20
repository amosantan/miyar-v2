CREATE TABLE `connector_health` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(64) NOT NULL,
	`sourceId` varchar(64) NOT NULL,
	`sourceName` varchar(255) NOT NULL,
	`healthStatus` enum('success','partial','failed') NOT NULL,
	`httpStatusCode` int,
	`responseTimeMs` int,
	`recordsExtracted` int NOT NULL DEFAULT 0,
	`recordsInserted` int NOT NULL DEFAULT 0,
	`duplicatesSkipped` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`errorType` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connector_health_id` PRIMARY KEY(`id`)
);
