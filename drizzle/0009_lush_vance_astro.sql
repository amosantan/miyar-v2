CREATE TABLE `evidence_references` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceRecordId` int NOT NULL,
	`targetType` enum('scenario','decision_note','explainability_driver','design_brief','report','material_board','pack_section') NOT NULL,
	`targetId` int NOT NULL,
	`sectionLabel` varchar(255),
	`citationText` text,
	`addedBy` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_references_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `title` varchar(512);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `evidencePhase` enum('concept','schematic','detailed_design','tender','procurement','construction','handover');--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `author` varchar(255);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `confidentiality` enum('public','internal','confidential','restricted') DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `fileUrl` text;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `fileKey` varchar(512);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `fileMimeType` varchar(128);