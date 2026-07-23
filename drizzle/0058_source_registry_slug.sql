ALTER TABLE `source_registry` ADD `slug` varchar(64);--> statement-breakpoint
ALTER TABLE `source_registry` ADD CONSTRAINT `source_registry_slug_unique` UNIQUE(`slug`);