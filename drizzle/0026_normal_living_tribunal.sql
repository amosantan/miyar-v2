CREATE TABLE `project_roi_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`scenario_id` int,
	`rework_cost_avoided` decimal(14,2) NOT NULL,
	`programme_acceleration_value` decimal(14,2) NOT NULL,
	`total_value_created` decimal(14,2) NOT NULL,
	`net_roi_percent` decimal(8,2) NOT NULL,
	`confidence_multiplier` decimal(5,4) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_roi_models_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_surface_maps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`domain` varchar(100) NOT NULL,
	`probability` int NOT NULL,
	`impact` int NOT NULL,
	`vulnerability` int NOT NULL,
	`control_strength` int NOT NULL,
	`composite_risk_score` int NOT NULL,
	`risk_band` enum('Minimal','Controlled','Elevated','Critical','Systemic') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_surface_maps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_stress_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scenario_id` int NOT NULL,
	`stress_condition` varchar(100) NOT NULL,
	`impact_magnitude_percent` decimal(6,2) NOT NULL,
	`resilience_score` int NOT NULL,
	`failure_points` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_stress_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dm_compliance_checklists` DROP FOREIGN KEY `dm_compliance_checklists_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `dm_compliance_checklists` DROP FOREIGN KEY `dm_compliance_checklists_organization_id_organizations_id_fk`;
--> statement-breakpoint
ALTER TABLE `finish_schedule_items` DROP FOREIGN KEY `finish_schedule_items_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `finish_schedule_items` DROP FOREIGN KEY `finish_schedule_items_organization_id_organizations_id_fk`;
--> statement-breakpoint
ALTER TABLE `finish_schedule_items` DROP FOREIGN KEY `finish_schedule_items_material_library_id_material_library_id_fk`;
--> statement-breakpoint
ALTER TABLE `nl_query_log` DROP FOREIGN KEY `nl_query_log_user_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `project_color_palettes` DROP FOREIGN KEY `project_color_palettes_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `project_color_palettes` DROP FOREIGN KEY `project_color_palettes_organization_id_organizations_id_fk`;
--> statement-breakpoint
ALTER TABLE `rfq_line_items` DROP FOREIGN KEY `rfq_line_items_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `rfq_line_items` DROP FOREIGN KEY `rfq_line_items_organization_id_organizations_id_fk`;
