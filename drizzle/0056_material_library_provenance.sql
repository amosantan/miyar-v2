ALTER TABLE `material_library` ADD `source_type` enum('miyar_assumption','supplier_quote','market_observation','manual_entry') DEFAULT 'miyar_assumption' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_library` ADD `source_label` varchar(255) DEFAULT 'MIYAR assumption' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_library` ADD `source_url` varchar(500);--> statement-breakpoint
ALTER TABLE `material_library` ADD `price_observed_at` date;--> statement-breakpoint
ALTER TABLE `material_library` ADD `price_confidence` enum('assumption','indicative','quoted') DEFAULT 'assumption' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_library` ADD `provenance_policy_version` varchar(64) DEFAULT 'material-library-provenance-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_library` ADD CONSTRAINT `material_library_product_code_unique` UNIQUE(`product_code`);