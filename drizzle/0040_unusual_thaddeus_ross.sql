ALTER TABLE `materials_catalog` ADD `embodiedCarbon` decimal(10,4);--> statement-breakpoint
ALTER TABLE `materials_catalog` ADD `maintenanceFactor` decimal(6,4);--> statement-breakpoint
ALTER TABLE `materials_catalog` ADD `brandStandardApproval` enum('open_market','approved_vendor','preferred_brand') DEFAULT 'open_market' NOT NULL;