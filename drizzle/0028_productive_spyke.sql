CREATE TABLE `ai_design_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`org_id` int NOT NULL,
	`brief_data` json NOT NULL,
	`version` varchar(20) DEFAULT '1.0',
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_design_briefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int,
	`name` varchar(200) NOT NULL,
	`typology` varchar(100) NOT NULL,
	`tier` varchar(50) NOT NULL,
	`style` varchar(100) NOT NULL,
	`description` text,
	`target_budget_per_sqm` decimal(10,2),
	`rooms` json,
	`is_template` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `design_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `space_recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`org_id` int NOT NULL,
	`room_id` varchar(10) NOT NULL,
	`room_name` varchar(100) NOT NULL,
	`sqm` decimal(8,2),
	`style_direction` varchar(500),
	`color_scheme` varchar(500),
	`material_package` json,
	`budget_allocation` decimal(12,2),
	`budget_breakdown` json,
	`ai_rationale` text,
	`special_notes` json,
	`kitchen_spec` json,
	`bathroom_spec` json,
	`alternatives` json,
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `space_recommendations_id` PRIMARY KEY(`id`)
);
