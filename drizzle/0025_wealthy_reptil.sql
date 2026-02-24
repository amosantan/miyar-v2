CREATE TABLE `dm_compliance_checklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`items` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dm_compliance_checklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finish_schedule_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`room_id` varchar(10) NOT NULL,
	`room_name` varchar(100) NOT NULL,
	`element` enum('floor','wall_primary','wall_feature','wall_wet','ceiling','joinery','hardware') NOT NULL,
	`material_library_id` int,
	`override_spec` varchar(500),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finish_schedule_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('flooring','wall_paint','wall_tile','ceiling','joinery','sanitaryware','fittings','lighting','hardware','specialty') NOT NULL,
	`tier` enum('affordable','mid','premium','ultra') NOT NULL,
	`style` enum('modern','contemporary','classic','minimalist','arabesque','all') NOT NULL DEFAULT 'all',
	`product_code` varchar(100),
	`product_name` varchar(300) NOT NULL,
	`brand` varchar(150) NOT NULL,
	`supplier_name` varchar(200) NOT NULL,
	`supplier_location` varchar(200),
	`supplier_phone` varchar(50),
	`unit_label` varchar(30) NOT NULL,
	`price_aed_min` decimal(10,2),
	`price_aed_max` decimal(10,2),
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `material_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_color_palettes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`palette_key` varchar(100) NOT NULL,
	`colors` json NOT NULL,
	`gemini_rationale` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_color_palettes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfq_line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`section_no` int NOT NULL,
	`item_code` varchar(20) NOT NULL,
	`description` varchar(500) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`quantity` decimal(10,2),
	`unit_rate_aed_min` decimal(10,2),
	`unit_rate_aed_max` decimal(10,2),
	`total_aed_min` decimal(12,2),
	`total_aed_max` decimal(12,2),
	`supplier_name` varchar(200),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rfq_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dm_compliance_checklists` ADD CONSTRAINT `dm_compliance_checklists_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dm_compliance_checklists` ADD CONSTRAINT `dm_compliance_checklists_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` ADD CONSTRAINT `finish_schedule_items_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` ADD CONSTRAINT `finish_schedule_items_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` ADD CONSTRAINT `finish_schedule_items_material_library_id_material_library_id_fk` FOREIGN KEY (`material_library_id`) REFERENCES `material_library`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_color_palettes` ADD CONSTRAINT `project_color_palettes_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_color_palettes` ADD CONSTRAINT `project_color_palettes_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD CONSTRAINT `rfq_line_items_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD CONSTRAINT `rfq_line_items_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;