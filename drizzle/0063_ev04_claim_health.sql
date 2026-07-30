CREATE TABLE `claim_health_policy_version` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(96) NOT NULL,
	`requiredCellSchemaVersion` varchar(96) NOT NULL,
	`status` enum('draft','approved','superseded') NOT NULL,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`policyDocument` json NOT NULL,
	`policyDigest` varchar(71) NOT NULL,
	`approvedBy` int,
	`approvedByIdentity` varchar(160),
	`approvedAt` timestamp,
	`supersedesId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_health_policy_version_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_health_policy_version_version_unique` UNIQUE(`version`),
	CONSTRAINT `claim_health_policy_version_supersedes_unique` UNIQUE(`supersedesId`),
	CONSTRAINT `claim_health_policy_version_identity_unique` UNIQUE(`id`,`version`,`requiredCellSchemaVersion`),
	CONSTRAINT `claim_health_policy_version_approval_check` CHECK((
        (
          `claim_health_policy_version`.`status` = 'approved'
          and `claim_health_policy_version`.`approvedAt` is not null
          and (
            (`claim_health_policy_version`.`approvedBy` is not null and `claim_health_policy_version`.`approvedByIdentity` is null)
            or (`claim_health_policy_version`.`approvedBy` is null and `claim_health_policy_version`.`approvedByIdentity` is not null)
          )
        )
        or (
          `claim_health_policy_version`.`status` <> 'approved'
          and `claim_health_policy_version`.`approvedBy` is null
          and `claim_health_policy_version`.`approvedByIdentity` is null
          and `claim_health_policy_version`.`approvedAt` is null
        )
      )),
	CONSTRAINT `claim_health_policy_version_interval_check` CHECK((`claim_health_policy_version`.`effectiveTo` is null or `claim_health_policy_version`.`effectiveFrom` is not null) and (`claim_health_policy_version`.`effectiveTo` is null or `claim_health_policy_version`.`effectiveTo` > `claim_health_policy_version`.`effectiveFrom`)),
	CONSTRAINT `claim_health_policy_version_digest_check` CHECK(`claim_health_policy_version`.`policyDigest` regexp '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT `claim_health_policy_version_document_identity_check` CHECK(json_unquote(json_extract(`claim_health_policy_version`.`policyDocument`, '$.policyVersion')) = `claim_health_policy_version`.`version`
        and json_unquote(json_extract(`claim_health_policy_version`.`policyDocument`, '$.requiredCellSchemaVersion')) = `claim_health_policy_version`.`requiredCellSchemaVersion`)
);
--> statement-breakpoint
CREATE TABLE `claim_health_snapshot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('platform','organization','project','supplier_quote') NOT NULL,
	`organizationId` int,
	`projectId` int,
	`supplierQuoteId` int,
	`reportInstanceId` int,
	`consumer` enum('project_workspace','material_cost','design_brief','investor_summary','stored_project_report','public_share','market_evidence','admin_operations') NOT NULL,
	`evaluationClock` timestamp NOT NULL,
	`policyVersionId` int NOT NULL,
	`policyVersion` varchar(96) NOT NULL,
	`requiredCellSchemaVersion` varchar(96) NOT NULL,
	`requiredCellInputs` json NOT NULL,
	`evaluatedResults` json NOT NULL,
	`safeProjection` json NOT NULL,
	`inputDigest` varchar(71) NOT NULL,
	`contentDigest` varchar(71) NOT NULL,
	`createdByUserId` int,
	`createdBySystemIdentity` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_health_snapshot_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_health_snapshot_report_unique` UNIQUE(`reportInstanceId`),
	CONSTRAINT `claim_health_snapshot_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `claim_health_snapshot_share_binding_unique` UNIQUE(`id`,`organizationId`,`reportInstanceId`),
	CONSTRAINT `claim_health_snapshot_scope_check` CHECK((
        (`claim_health_snapshot`.`scope` = 'platform' and `claim_health_snapshot`.`organizationId` is null and `claim_health_snapshot`.`projectId` is null and `claim_health_snapshot`.`supplierQuoteId` is null)
        or (`claim_health_snapshot`.`scope` = 'organization' and `claim_health_snapshot`.`organizationId` is not null and `claim_health_snapshot`.`projectId` is null and `claim_health_snapshot`.`supplierQuoteId` is null)
        or (`claim_health_snapshot`.`scope` = 'project' and `claim_health_snapshot`.`organizationId` is not null and `claim_health_snapshot`.`projectId` is not null and `claim_health_snapshot`.`supplierQuoteId` is null)
        or (`claim_health_snapshot`.`scope` = 'supplier_quote' and `claim_health_snapshot`.`organizationId` is not null and `claim_health_snapshot`.`projectId` is null and `claim_health_snapshot`.`supplierQuoteId` is not null)
      )),
	CONSTRAINT `claim_health_snapshot_report_scope_check` CHECK(`claim_health_snapshot`.`reportInstanceId` is null or (`claim_health_snapshot`.`scope` = 'project' and `claim_health_snapshot`.`projectId` is not null)),
	CONSTRAINT `claim_health_snapshot_actor_check` CHECK((
        (`claim_health_snapshot`.`createdByUserId` is not null and `claim_health_snapshot`.`createdBySystemIdentity` is null)
        or (`claim_health_snapshot`.`createdByUserId` is null and `claim_health_snapshot`.`createdBySystemIdentity` is not null)
      )),
	CONSTRAINT `claim_health_snapshot_digest_check` CHECK(`claim_health_snapshot`.`inputDigest` regexp '^sha256:[0-9a-f]{64}$' and `claim_health_snapshot`.`contentDigest` regexp '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE `report_public_share` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reportInstanceId` int NOT NULL,
	`snapshotId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`revokedByUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_public_share_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_public_share_token_hash_unique` UNIQUE(`tokenHash`),
	CONSTRAINT `report_public_share_token_hash_check` CHECK(`report_public_share`.`tokenHash` regexp '^[0-9a-f]{64}$'),
	CONSTRAINT `report_public_share_expiry_check` CHECK(`report_public_share`.`expiresAt` > `report_public_share`.`createdAt`),
	CONSTRAINT `report_public_share_revocation_check` CHECK((`report_public_share`.`revokedAt` is null and `report_public_share`.`revokedByUserId` is null) or (`report_public_share`.`revokedAt` is not null and `report_public_share`.`revokedByUserId` is not null))
);
--> statement-breakpoint
CREATE TABLE `source_incident_event` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`eventSequence` int NOT NULL,
	`eventType` enum('opened','acknowledged','resolved','reopened') NOT NULL,
	`resultingState` enum('open','acknowledged','resolved') NOT NULL,
	`severity` enum('advisory','blocking') NOT NULL,
	`blockingEffect` boolean NOT NULL,
	`actorType` enum('platform_admin','organization_admin','system_detector') NOT NULL,
	`actorUserId` int,
	`actorIdentity` varchar(160) NOT NULL,
	`actorSessionIdentity` varchar(160),
	`detectorPolicyVersion` varchar(96),
	`reason` text NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`policyVersionId` int NOT NULL,
	`ingestionRunId` varchar(64),
	`evidenceRecordId` int,
	`snapshotId` int,
	`idempotencyKey` varchar(128) NOT NULL,
	`requestDigest` varchar(71) NOT NULL,
	`auditIdentity` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_incident_event_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_incident_event_sequence_unique` UNIQUE(`incidentId`,`eventSequence`),
	CONSTRAINT `source_incident_event_idempotency_unique` UNIQUE(`incidentId`,`actorIdentity`,`idempotencyKey`),
	CONSTRAINT `source_incident_event_actor_check` CHECK((
        (`source_incident_event`.`actorType` = 'system_detector' and `source_incident_event`.`actorUserId` is null and `source_incident_event`.`actorSessionIdentity` is null and `source_incident_event`.`detectorPolicyVersion` is not null)
        or (`source_incident_event`.`actorType` in ('platform_admin', 'organization_admin') and `source_incident_event`.`actorUserId` is not null and `source_incident_event`.`actorSessionIdentity` is not null and `source_incident_event`.`detectorPolicyVersion` is null)
      )),
	CONSTRAINT `source_incident_event_blocking_check` CHECK((
        (`source_incident_event`.`severity` = 'blocking' and `source_incident_event`.`blockingEffect` = true)
        or (`source_incident_event`.`severity` = 'advisory' and `source_incident_event`.`blockingEffect` = false)
      )),
	CONSTRAINT `source_incident_event_digest_check` CHECK(`source_incident_event`.`requestDigest` regexp '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT `source_incident_event_sequence_check` CHECK(`source_incident_event`.`eventSequence` > 0)
);
--> statement-breakpoint
CREATE TABLE `source_incident` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentKey` varchar(128) NOT NULL,
	`scope` enum('platform','organization','project','supplier_quote') NOT NULL,
	`organizationId` int,
	`projectId` int,
	`supplierQuoteId` int,
	`sourceRegistryId` int,
	`sourceIdentity` varchar(255) NOT NULL,
	`incidentType` enum('required_run_missed','repeated_source_failure','source_authorization_revoked','unexpected_zero','anomalous_extraction','corrupted_source_content','provenance_digest_mismatch','quality_quarantine_backlog','confidentiality_concern','tenant_boundary_concern','stale_mandatory_evidence') NOT NULL,
	`openedAt` timestamp NOT NULL,
	`openedUnderPolicyVersionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_incident_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_incident_key_unique` UNIQUE(`incidentKey`),
	CONSTRAINT `source_incident_scope_id_unique` UNIQUE(`id`,`scope`,`organizationId`,`projectId`,`supplierQuoteId`,`sourceIdentity`),
	CONSTRAINT `source_incident_scope_check` CHECK((
        (`source_incident`.`scope` = 'platform' and `source_incident`.`organizationId` is null and `source_incident`.`projectId` is null and `source_incident`.`supplierQuoteId` is null)
        or (`source_incident`.`scope` = 'organization' and `source_incident`.`organizationId` is not null and `source_incident`.`projectId` is null and `source_incident`.`supplierQuoteId` is null)
        or (`source_incident`.`scope` = 'project' and `source_incident`.`organizationId` is not null and `source_incident`.`projectId` is not null and `source_incident`.`supplierQuoteId` is null)
        or (`source_incident`.`scope` = 'supplier_quote' and `source_incident`.`organizationId` is not null and `source_incident`.`projectId` is null and `source_incident`.`supplierQuoteId` is not null)
      ))
);
--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_org_id_unique` UNIQUE(`orgId`,`id`);--> statement-breakpoint
ALTER TABLE `report_instances` ADD CONSTRAINT `report_instances_project_id_unique` UNIQUE(`projectId`,`id`);--> statement-breakpoint
ALTER TABLE `supplier_quote` ADD CONSTRAINT `supplier_quote_org_id_unique` UNIQUE(`orgId`,`id`);--> statement-breakpoint
ALTER TABLE `claim_health_snapshot` ADD CONSTRAINT `claim_health_snapshot_policy_identity_fk` FOREIGN KEY (`policyVersionId`,`policyVersion`,`requiredCellSchemaVersion`) REFERENCES `claim_health_policy_version`(`id`,`version`,`requiredCellSchemaVersion`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_health_snapshot` ADD CONSTRAINT `claim_health_snapshot_organization_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_health_snapshot` ADD CONSTRAINT `claim_health_snapshot_project_org_fk` FOREIGN KEY (`organizationId`,`projectId`) REFERENCES `projects`(`orgId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_health_snapshot` ADD CONSTRAINT `claim_health_snapshot_supplier_quote_org_fk` FOREIGN KEY (`organizationId`,`supplierQuoteId`) REFERENCES `supplier_quote`(`orgId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_health_snapshot` ADD CONSTRAINT `claim_health_snapshot_report_project_fk` FOREIGN KEY (`projectId`,`reportInstanceId`) REFERENCES `report_instances`(`projectId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_health_snapshot` ADD CONSTRAINT `claim_health_snapshot_member_actor_fk` FOREIGN KEY (`organizationId`,`createdByUserId`) REFERENCES `organization_members`(`orgId`,`userId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_public_share` ADD CONSTRAINT `report_public_share_organization_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_public_share` ADD CONSTRAINT `report_public_share_snapshot_binding_fk` FOREIGN KEY (`snapshotId`,`organizationId`,`reportInstanceId`) REFERENCES `claim_health_snapshot`(`id`,`organizationId`,`reportInstanceId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_public_share` ADD CONSTRAINT `report_public_share_creator_fk` FOREIGN KEY (`organizationId`,`createdByUserId`) REFERENCES `organization_members`(`orgId`,`userId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_public_share` ADD CONSTRAINT `report_public_share_revoker_fk` FOREIGN KEY (`organizationId`,`revokedByUserId`) REFERENCES `organization_members`(`orgId`,`userId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident_event` ADD CONSTRAINT `source_incident_event_incident_fk` FOREIGN KEY (`incidentId`) REFERENCES `source_incident`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident_event` ADD CONSTRAINT `source_incident_event_policy_fk` FOREIGN KEY (`policyVersionId`) REFERENCES `claim_health_policy_version`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident_event` ADD CONSTRAINT `source_incident_event_snapshot_fk` FOREIGN KEY (`snapshotId`) REFERENCES `claim_health_snapshot`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident` ADD CONSTRAINT `source_incident_organization_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident` ADD CONSTRAINT `source_incident_project_org_fk` FOREIGN KEY (`organizationId`,`projectId`) REFERENCES `projects`(`orgId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident` ADD CONSTRAINT `source_incident_supplier_quote_org_fk` FOREIGN KEY (`organizationId`,`supplierQuoteId`) REFERENCES `supplier_quote`(`orgId`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident` ADD CONSTRAINT `source_incident_source_registry_fk` FOREIGN KEY (`sourceRegistryId`) REFERENCES `source_registry`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_incident` ADD CONSTRAINT `source_incident_open_policy_fk` FOREIGN KEY (`openedUnderPolicyVersionId`) REFERENCES `claim_health_policy_version`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_health_policy_version_effective_idx` ON `claim_health_policy_version` (`status`,`effectiveFrom`,`effectiveTo`);--> statement-breakpoint
CREATE INDEX `claim_health_snapshot_scope_clock_idx` ON `claim_health_snapshot` (`organizationId`,`projectId`,`consumer`,`evaluationClock`);--> statement-breakpoint
CREATE INDEX `claim_health_snapshot_policy_idx` ON `claim_health_snapshot` (`policyVersionId`,`evaluationClock`);--> statement-breakpoint
CREATE INDEX `report_public_share_report_idx` ON `report_public_share` (`organizationId`,`reportInstanceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `source_incident_event_effective_idx` ON `source_incident_event` (`incidentId`,`effectiveAt`,`eventSequence`);--> statement-breakpoint
CREATE INDEX `source_incident_scope_source_idx` ON `source_incident` (`scope`,`organizationId`,`projectId`,`supplierQuoteId`,`sourceIdentity`);