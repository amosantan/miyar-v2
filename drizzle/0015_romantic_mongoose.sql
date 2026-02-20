ALTER TABLE `materials_to_boards` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `materials_to_boards` ADD `specNotes` text;--> statement-breakpoint
ALTER TABLE `materials_to_boards` ADD `costBandOverride` varchar(64);