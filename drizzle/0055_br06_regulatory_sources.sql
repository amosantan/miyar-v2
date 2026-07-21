CREATE TABLE `regulatory_clause_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceVersionId` int NOT NULL,
	`clauseKey` varchar(160) NOT NULL,
	`locator` varchar(255) NOT NULL,
	`pageLocator` varchar(64),
	`candidateSummary` text NOT NULL,
	`candidateFingerprint` varchar(64) NOT NULL,
	`extractionMethod` enum('deterministic','ai_extracted_candidate','human_transcription') NOT NULL,
	`reviewStatus` enum('candidate','accepted_for_review','rejected') NOT NULL DEFAULT 'candidate',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_clause_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_clause_candidates_version_key_unique` UNIQUE(`sourceVersionId`,`clauseKey`,`candidateFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_source_assertions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceVersionId` int NOT NULL,
	`assertionType` enum('document_identity','authenticity','temporal_status','jurisdiction','permitted_use') NOT NULL,
	`decision` enum('accepted','rejected','withdrawn') NOT NULL,
	`assertedByUserId` int NOT NULL,
	`reason` text NOT NULL,
	`assertionFingerprint` varchar(64) NOT NULL,
	`validFrom` timestamp NOT NULL DEFAULT (now()),
	`validTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_source_assertions_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_source_assertions_fingerprint_unique` UNIQUE(`assertionFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_source_captures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`sourceVersionId` int,
	`requestedUrl` text NOT NULL,
	`finalUrl` text,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`httpStatus` int,
	`mimeType` varchar(128),
	`byteLength` int,
	`artifactFingerprint` varchar(64),
	`etag` varchar(255),
	`lastModified` varchar(255),
	`parserVersion` varchar(64) NOT NULL,
	`storageReference` text,
	`fetchResult` enum('captured','unchanged','changed_candidate','disappeared_candidate','denied','failed') NOT NULL,
	`failureCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_source_captures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_source_relations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceVersionId` int NOT NULL,
	`targetSourceVersionId` int NOT NULL,
	`relationType` enum('amends','supersedes','suspends','revokes','clarifies') NOT NULL,
	`relationFingerprint` varchar(64) NOT NULL,
	`clauseScope` json NOT NULL,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_source_relations_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_source_relations_fingerprint_unique` UNIQUE(`relationFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_source_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`versionKey` varchar(128) NOT NULL,
	`edition` varchar(128),
	`publicationDate` timestamp,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`contentFingerprint` varchar(64) NOT NULL,
	`parserVersion` varchar(64) NOT NULL,
	`status` enum('candidate','asserted','stale','withdrawn','archived') NOT NULL DEFAULT 'candidate',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_source_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_source_versions_source_version_unique` UNIQUE(`sourceId`,`versionKey`),
	CONSTRAINT `regulatory_source_versions_source_fingerprint_unique` UNIQUE(`sourceId`,`contentFingerprint`),
	CONSTRAINT `regulatory_source_versions_source_id_unique` UNIQUE(`sourceId`,`id`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(128) NOT NULL,
	`issuingAuthority` varchar(160) NOT NULL,
	`documentIdentity` varchar(255) NOT NULL,
	`jurisdiction` varchar(128) NOT NULL,
	`languages` json NOT NULL,
	`canonicalUrl` text NOT NULL,
	`approvedHosts` json NOT NULL,
	`retentionPolicy` enum('metadata_only','artifact_permitted','prohibited','pending_review') NOT NULL,
	`licensingStatus` enum('permitted','restricted','prohibited','pending_review') NOT NULL,
	`coverageStatus` enum('supported','candidate','unsupported') NOT NULL DEFAULT 'candidate',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulatory_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_sources_source_key_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
ALTER TABLE `regulatory_clause_candidates` ADD CONSTRAINT `reg_clause_candidates_version_fk` FOREIGN KEY (`sourceVersionId`) REFERENCES `regulatory_source_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_assertions` ADD CONSTRAINT `reg_source_assertions_version_fk` FOREIGN KEY (`sourceVersionId`) REFERENCES `regulatory_source_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_assertions` ADD CONSTRAINT `reg_source_assertions_user_fk` FOREIGN KEY (`assertedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_captures` ADD CONSTRAINT `reg_source_captures_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `regulatory_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_captures` ADD CONSTRAINT `reg_source_captures_version_fk` FOREIGN KEY (`sourceId`,`sourceVersionId`) REFERENCES `regulatory_source_versions`(`sourceId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_relations` ADD CONSTRAINT `reg_source_relations_source_fk` FOREIGN KEY (`sourceVersionId`) REFERENCES `regulatory_source_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_relations` ADD CONSTRAINT `reg_source_relations_target_fk` FOREIGN KEY (`targetSourceVersionId`) REFERENCES `regulatory_source_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_source_versions` ADD CONSTRAINT `reg_source_versions_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `regulatory_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `regulatory_clause_candidates_version_status_idx` ON `regulatory_clause_candidates` (`sourceVersionId`,`reviewStatus`);--> statement-breakpoint
CREATE INDEX `regulatory_source_assertions_version_type_idx` ON `regulatory_source_assertions` (`sourceVersionId`,`assertionType`,`decision`);--> statement-breakpoint
CREATE INDEX `regulatory_source_captures_source_time_idx` ON `regulatory_source_captures` (`sourceId`,`retrievedAt`);--> statement-breakpoint
CREATE INDEX `regulatory_source_captures_version_idx` ON `regulatory_source_captures` (`sourceVersionId`);--> statement-breakpoint
CREATE INDEX `regulatory_source_relations_temporal_idx` ON `regulatory_source_relations` (`targetSourceVersionId`,`effectiveFrom`,`effectiveTo`);--> statement-breakpoint
CREATE INDEX `regulatory_source_versions_temporal_idx` ON `regulatory_source_versions` (`sourceId`,`effectiveFrom`,`effectiveTo`);