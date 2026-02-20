ALTER TABLE `source_registry` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `source_registry` ADD `lastSuccessfulFetch` timestamp;