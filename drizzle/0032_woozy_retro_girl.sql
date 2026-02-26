CREATE TABLE `customer_health_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`org_id` int,
	`composite_score` int NOT NULL,
	`engagement_score` int NOT NULL,
	`adoption_score` int NOT NULL,
	`quality_score` int NOT NULL,
	`velocity_score` int NOT NULL,
	`health_tier` varchar(20) NOT NULL,
	`recommendations` json,
	`metrics` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_health_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_twin_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`org_id` int,
	`sustainability_score` int NOT NULL,
	`sustainability_grade` varchar(5) NOT NULL,
	`embodied_carbon` decimal(18,2),
	`carbon_per_sqm` decimal(12,2),
	`operational_energy` decimal(18,2),
	`energy_per_sqm` decimal(12,2),
	`lifecycle_cost_30yr` decimal(18,2),
	`carbon_breakdown` json,
	`lifecycle` json,
	`config` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_twin_models_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monte_carlo_simulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`org_id` int,
	`iterations` int NOT NULL,
	`p5` decimal(18,2),
	`p10` decimal(18,2),
	`p25` decimal(18,2),
	`p50` decimal(18,2),
	`p75` decimal(18,2),
	`p90` decimal(18,2),
	`p95` decimal(18,2),
	`mean` decimal(18,2),
	`std_dev` decimal(18,2),
	`var95` decimal(18,2),
	`budget_exceed_pct` decimal(6,2),
	`histogram` json,
	`time_series_data` json,
	`config` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monte_carlo_simulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolio_id` int NOT NULL,
	`project_id` int NOT NULL,
	`added_at` timestamp NOT NULL DEFAULT (now()),
	`note` text,
	CONSTRAINT `portfolio_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`organization_id` int NOT NULL,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_alerts` MODIFY COLUMN `alertType` enum('price_shock','project_at_risk','accuracy_degraded','pattern_warning','benchmark_drift','market_opportunity','portfolio_risk','portfolio_failure_pattern') NOT NULL;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `brief_id` int;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `pricing_source` varchar(32);