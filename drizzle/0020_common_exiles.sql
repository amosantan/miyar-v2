CREATE TABLE `platform_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` enum('price_shock','project_at_risk','accuracy_degraded','pattern_warning','benchmark_drift','market_opportunity') NOT NULL,
	`severity` enum('critical','high','medium','info') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`affectedProjectIds` json,
	`affectedCategories` json,
	`triggerData` json,
	`suggestedAction` text NOT NULL,
	`status` enum('active','acknowledged','resolved','expired') NOT NULL DEFAULT 'active',
	`acknowledgedBy` int,
	`acknowledgedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_alerts_id` PRIMARY KEY(`id`)
);
