CREATE TABLE `brief_applicability_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`bindingId` int NOT NULL,
	`classificationFingerprint` varchar(64) NOT NULL,
	`stage` enum('proposed','reviewed','approved','withdrawn') NOT NULL,
	`targetEventId` int,
	`actorUserId` int NOT NULL,
	`rationale` text NOT NULL,
	`inputs` json NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_applicability_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_applicability_events_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_applicability_events_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`)
);
--> statement-breakpoint
CREATE TABLE `brief_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`bindingId` int NOT NULL,
	`sectionRevisionId` int NOT NULL,
	`approverUserId` int NOT NULL,
	`decision` enum('approved','withdrawn') NOT NULL,
	`targetApprovalId` int,
	`issuePurpose` enum('internal_coordination','client_board_approval','tender_rfq') NOT NULL,
	`rationale` text NOT NULL,
	`limitations` json NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_approvals_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_approvals_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`)
);
--> statement-breakpoint
CREATE TABLE `brief_condition_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`bindingId` int NOT NULL,
	`kind` enum('stale','blocked') NOT NULL,
	`gate` enum('evidence_content','approval_issue') NOT NULL,
	`stage` enum('raised','resolution_submitted','resolution_accepted','resolution_rejected') NOT NULL,
	`reasonCode` varchar(96) NOT NULL,
	`explanation` text NOT NULL,
	`targetEventId` int,
	`dependencyId` int,
	`ownerUserId` int NOT NULL,
	`actorUserId` int,
	`evidence` json NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_condition_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_condition_events_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_condition_events_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`)
);
--> statement-breakpoint
CREATE TABLE `brief_dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`bindingId` int NOT NULL,
	`sectionRevisionId` int NOT NULL,
	`dependencyType` enum('project_input','scenario','geometry','space_programme','evidence','calculation','benchmark','material','supplier_offer','board','visual','generation') NOT NULL,
	`dependencyRef` json NOT NULL,
	`authority` varchar(96) NOT NULL,
	`recordVersion` varchar(128) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`relevance` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_dependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_dependencies_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_dependencies_identity_unique` UNIQUE(`organizationId`,`projectId`,`bindingId`,`dependencyType`,`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `brief_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`sectionId` enum('intent','asset_context','space_programme','design_direction','specification_intent','cost_quantities','supply','risk_compliance','concept_media','governance'),
	`issueId` int,
	`operationId` int NOT NULL,
	`actorUserId` int,
	`actorType` enum('human','ai','system') NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`payloadSchemaVersion` varchar(32) NOT NULL,
	`payload` json NOT NULL,
	`operationOrdinal` int NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_events_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_events_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`),
	CONSTRAINT `brief_events_operation_ordinal_unique` UNIQUE(`organizationId`,`projectId`,`operationId`,`operationOrdinal`)
);
--> statement-breakpoint
CREATE TABLE `brief_finding_resolutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`findingId` int NOT NULL,
	`sectionRevisionId` int NOT NULL,
	`stage` enum('submitted','accepted','rejected') NOT NULL,
	`submitterUserId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`targetSubmissionId` int,
	`evidence` json NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_finding_resolutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_finding_resolutions_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_finding_resolutions_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`)
);
--> statement-breakpoint
CREATE TABLE `brief_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`bindingId` int NOT NULL,
	`sectionRevisionId` int NOT NULL,
	`reviewerUserId` int NOT NULL,
	`severity` enum('blocking','advisory') NOT NULL,
	`ownerUserId` int NOT NULL,
	`statement` text NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_findings_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_findings_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_findings_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`)
);
--> statement-breakpoint
CREATE TABLE `brief_issue_applicability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`issueId` int NOT NULL,
	`issueSectionId` int NOT NULL,
	`applicabilityEventId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_issue_applicability_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_issue_applicability_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_issue_applicability_ref_unique` UNIQUE(`organizationId`,`projectId`,`issueId`,`issueSectionId`,`applicabilityEventId`)
);
--> statement-breakpoint
CREATE TABLE `brief_issue_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`issueId` int NOT NULL,
	`issueSectionId` int NOT NULL,
	`approvalId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_issue_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_issue_approvals_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_issue_approvals_ref_unique` UNIQUE(`organizationId`,`projectId`,`issueId`,`issueSectionId`,`approvalId`)
);
--> statement-breakpoint
CREATE TABLE `brief_issue_dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`issueId` int NOT NULL,
	`issueSectionId` int NOT NULL,
	`dependencyId` int NOT NULL,
	`recordVersion` varchar(128) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_issue_dependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_issue_dependencies_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_issue_dependencies_ref_unique` UNIQUE(`organizationId`,`projectId`,`issueId`,`issueSectionId`,`dependencyId`)
);
--> statement-breakpoint
CREATE TABLE `brief_issue_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`issueId` int NOT NULL,
	`bindingId` int NOT NULL,
	`sectionRevisionId` int NOT NULL,
	`sectionId` enum('intent','asset_context','space_programme','design_direction','specification_intent','cost_quantities','supply','risk_compliance','concept_media','governance') NOT NULL,
	`applicability` enum('required','conditional','not_applicable') NOT NULL,
	`achievedState` enum('approved','issued') NOT NULL,
	`requirementProfileVersion` varchar(96) NOT NULL,
	`classificationFingerprint` varchar(64) NOT NULL,
	`componentScope` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_issue_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_issue_sections_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_issue_sections_section_unique` UNIQUE(`organizationId`,`projectId`,`issueId`,`sectionId`)
);
--> statement-breakpoint
CREATE TABLE `brief_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`operationId` int NOT NULL,
	`issueNumber` int NOT NULL,
	`issuerUserId` int NOT NULL,
	`issuePurpose` enum('internal_coordination','client_board_approval','tender_rfq') NOT NULL,
	`metadata` json NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_issues_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_issues_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_issues_number_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`issueNumber`)
);
--> statement-breakpoint
CREATE TABLE `brief_legacy_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceId` varchar(128) NOT NULL,
	`importedVersionId` int,
	`importedRevisionId` int,
	`disposition` enum('linked','imported','rejected','drifted') NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_legacy_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_legacy_links_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_legacy_links_source_unique` UNIQUE(`organizationId`,`projectId`,`sourceType`,`sourceId`)
);
--> statement-breakpoint
CREATE TABLE `brief_operations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int,
	`actorUserId` int NOT NULL,
	`operation` varchar(96) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`requestHash` varchar(64) NOT NULL,
	`status` enum('pending','completed') NOT NULL DEFAULT 'pending',
	`resultEntityType` varchar(64),
	`resultEntityId` int,
	`resultRevision` int,
	`result` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `brief_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_operations_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_operations_idempotency_unique` UNIQUE(`organizationId`,`projectId`,`actorUserId`,`operation`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `brief_role_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int,
	`sectionId` enum('intent','asset_context','space_programme','design_direction','specification_intent','cost_quantities','supply','risk_compliance','concept_media','governance'),
	`subjectUserId` int NOT NULL,
	`role` enum('author','section_owner','reviewer','approver','issuer','viewer') NOT NULL,
	`action` enum('granted','revoked') NOT NULL,
	`targetGrantEventId` int,
	`actorUserId` int NOT NULL,
	`reason` text NOT NULL,
	`streamSequence` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_role_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_role_events_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_role_events_stream_sequence_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`streamSequence`)
);
--> statement-breakpoint
CREATE TABLE `brief_section_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`scopeKey` varchar(96) NOT NULL,
	`sectionId` enum('intent','asset_context','space_programme','design_direction','specification_intent','cost_quantities','supply','risk_compliance','concept_media','governance') NOT NULL,
	`content` json NOT NULL,
	`origin` enum('user','deterministic','ai_proposal','legacy_import') NOT NULL,
	`authorUserId` int,
	`actorType` enum('human','ai','system') NOT NULL,
	`contentSchemaVersion` varchar(64) NOT NULL,
	`revisionFingerprint` varchar(64) NOT NULL,
	`lineageFingerprint` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_section_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_section_revisions_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_section_revisions_fingerprint_unique` UNIQUE(`organizationId`,`projectId`,`scopeKey`,`sectionId`,`revisionFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `brief_streams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`scopeType` enum('project','scenario') NOT NULL,
	`scenarioId` int,
	`scopeKey` varchar(96) NOT NULL,
	`issuePurpose` enum('internal_coordination','client_board_approval','tender_rfq') NOT NULL,
	`typologyProfileVersion` varchar(96) NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	`nextEventSequence` bigint NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_streams_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_streams_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_streams_identity_unique` UNIQUE(`organizationId`,`projectId`,`scopeKey`,`issuePurpose`)
);
--> statement-breakpoint
CREATE TABLE `brief_version_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionId` int NOT NULL,
	`sectionRevisionId` int,
	`sectionId` enum('intent','asset_context','space_programme','design_direction','specification_intent','cost_quantities','supply','risk_compliance','concept_media','governance') NOT NULL,
	`applicability` enum('required','conditional','not_applicable') NOT NULL DEFAULT 'required',
	`achievedState` enum('missing','drafted','evidenced','reviewed','approved','issued') NOT NULL DEFAULT 'missing',
	`classifications` json NOT NULL,
	`classificationFingerprint` varchar(64) NOT NULL,
	`componentScope` json NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_version_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_version_sections_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_version_sections_section_unique` UNIQUE(`organizationId`,`projectId`,`versionId`,`sectionId`)
);
--> statement-breakpoint
CREATE TABLE `brief_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`streamId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`predecessorVersionId` int,
	`origin` enum('user','deterministic','ai_proposal','legacy_import') NOT NULL,
	`status` enum('working','locked') NOT NULL DEFAULT 'working',
	`requirementProfileVersion` varchar(96) NOT NULL,
	`componentScope` json NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brief_versions_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `brief_versions_number_unique` UNIQUE(`organizationId`,`projectId`,`streamId`,`versionNumber`)
);
--> statement-breakpoint
ALTER TABLE `brief_issue_sections` ADD CONSTRAINT `brief_issue_sections_issue_scope_fk` FOREIGN KEY (`organizationId`,`projectId`,`issueId`) REFERENCES `brief_issues`(`organizationId`,`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brief_issue_sections` ADD CONSTRAINT `brief_issue_sections_binding_scope_fk` FOREIGN KEY (`organizationId`,`projectId`,`bindingId`) REFERENCES `brief_version_sections`(`organizationId`,`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brief_issue_sections` ADD CONSTRAINT `brief_issue_sections_revision_scope_fk` FOREIGN KEY (`organizationId`,`projectId`,`sectionRevisionId`) REFERENCES `brief_section_revisions`(`organizationId`,`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brief_version_sections` ADD CONSTRAINT `brief_version_sections_version_scope_fk` FOREIGN KEY (`organizationId`,`projectId`,`versionId`) REFERENCES `brief_versions`(`organizationId`,`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brief_version_sections` ADD CONSTRAINT `brief_version_sections_revision_scope_fk` FOREIGN KEY (`organizationId`,`projectId`,`sectionRevisionId`) REFERENCES `brief_section_revisions`(`organizationId`,`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brief_versions` ADD CONSTRAINT `brief_versions_stream_scope_fk` FOREIGN KEY (`organizationId`,`projectId`,`streamId`) REFERENCES `brief_streams`(`organizationId`,`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `brief_applicability_events_binding_idx` ON `brief_applicability_events` (`organizationId`,`projectId`,`bindingId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `brief_approvals_binding_idx` ON `brief_approvals` (`organizationId`,`projectId`,`bindingId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `brief_condition_events_binding_idx` ON `brief_condition_events` (`organizationId`,`projectId`,`bindingId`,`kind`,`createdAt`);--> statement-breakpoint
CREATE INDEX `brief_finding_resolutions_finding_idx` ON `brief_finding_resolutions` (`organizationId`,`projectId`,`findingId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `brief_findings_binding_idx` ON `brief_findings` (`organizationId`,`projectId`,`bindingId`);--> statement-breakpoint
CREATE INDEX `brief_role_events_stream_subject_idx` ON `brief_role_events` (`organizationId`,`projectId`,`streamId`,`subjectUserId`,`role`);--> statement-breakpoint
CREATE INDEX `brief_streams_scenario_idx` ON `brief_streams` (`organizationId`,`projectId`,`scenarioId`);--> statement-breakpoint
CREATE INDEX `brief_version_sections_stream_idx` ON `brief_version_sections` (`organizationId`,`projectId`,`streamId`,`versionId`);--> statement-breakpoint
CREATE INDEX `brief_versions_stream_idx` ON `brief_versions` (`organizationId`,`projectId`,`streamId`);