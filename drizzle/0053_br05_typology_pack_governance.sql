CREATE TABLE `typology_pack_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`revisionId` int NOT NULL,
	`eventType` enum('created','reviewed','approved','withdrawn') NOT NULL,
	`actorUserId` int NOT NULL,
	`reason` text NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `typology_pack_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `typology_pack_events_org_id_unique` UNIQUE(`organizationId`,`id`),
	CONSTRAINT `typology_pack_events_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `typology_pack_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`packKey` varchar(96) NOT NULL,
	`revisionNumber` int NOT NULL,
	`basePackKey` varchar(96) NOT NULL,
	`basePackVersion` varchar(32) NOT NULL,
	`basePackFingerprint` varchar(64) NOT NULL,
	`payloadSchemaVersion` varchar(32) NOT NULL,
	`payload` json NOT NULL,
	`payloadFingerprint` varchar(64) NOT NULL,
	`status` enum('draft','reviewed','approved','withdrawn') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewDueAt` timestamp NOT NULL,
	`approvedBy` int,
	`approvedAt` timestamp,
	`withdrawnBy` int,
	`withdrawnAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `typology_pack_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `typology_pack_revisions_org_pack_revision_unique` UNIQUE(`organizationId`,`packKey`,`revisionNumber`),
	CONSTRAINT `typology_pack_revisions_org_id_unique` UNIQUE(`organizationId`,`id`)
);
--> statement-breakpoint
CREATE INDEX `typology_pack_events_org_revision_idx` ON `typology_pack_events` (`organizationId`,`revisionId`);--> statement-breakpoint
CREATE INDEX `typology_pack_revisions_org_status_idx` ON `typology_pack_revisions` (`organizationId`,`packKey`,`status`);