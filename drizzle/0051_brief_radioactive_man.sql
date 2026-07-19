CREATE TABLE `artifact_input_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`artifactType` varchar(64) NOT NULL,
	`artifactId` varchar(128) NOT NULL,
	`artifactVersion` varchar(64) NOT NULL,
	`graphVersionId` int NOT NULL,
	`spaceVersionIds` json NOT NULL,
	`measurementRecordIds` json NOT NULL,
	`formulaVersions` json NOT NULL,
	`rendererVersion` varchar(64) NOT NULL,
	`copyVersion` varchar(64) NOT NULL,
	`locale` varchar(16) NOT NULL,
	`storageKey` text NOT NULL,
	`inputSnapshot` json NOT NULL,
	`snapshotDigestAlgorithm` varchar(32) NOT NULL,
	`snapshotDigest` varchar(64) NOT NULL,
	`issuedBy` int NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifact_input_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `artifact_input_snapshots_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `artifact_input_snapshots_artifact_unique` UNIQUE(`organizationId`,`projectId`,`artifactType`,`artifactId`,`artifactVersion`)
);
--> statement-breakpoint
CREATE TABLE `geometry_reconciliation_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`authorityId` int NOT NULL,
	`expectedCurrentGraphVersionId` int,
	`baseGraphVersionId` int,
	`candidateGraphVersionId` int NOT NULL,
	`resultGraphVersionId` int,
	`baseMeasurementRecordId` int,
	`candidateMeasurementRecordId` int,
	`baseFingerprint` varchar(64),
	`candidateFingerprint` varchar(64) NOT NULL,
	`differenceSquareMetres` decimal(40,12),
	`toleranceSquareMetres` decimal(40,12),
	`tolerancePolicyVersion` varchar(64) NOT NULL,
	`reviewDecision` enum('candidate_created','accepted','rejected','needs_clarification','reconciled') NOT NULL,
	`resultState` enum('valid','not_checked','conflict','insufficient') NOT NULL,
	`note` text NOT NULL,
	`reviewerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geometry_reconciliation_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `geometry_reconciliation_events_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`)
);
--> statement-breakpoint
CREATE TABLE `geometry_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`assetId` int,
	`sourceType` enum('manual','project_asset') NOT NULL,
	`acquisitionMethod` enum('manual_entry','dxf','pdf_text','image_ai','dwg_ai','typology_template','derived','migration') NOT NULL,
	`evidenceClass` enum('survey_measured','geometry_derived','source_stated','estimated','legacy_unknown') NOT NULL,
	`adapterName` varchar(128) NOT NULL,
	`adapterVersion` varchar(64) NOT NULL,
	`modelName` varchar(128),
	`modelVersion` varchar(64),
	`sourceUnits` enum('m','mm','unknown') NOT NULL,
	`sourceReferenceFrame` json NOT NULL,
	`sourceTransform` json NOT NULL,
	`sourceObservation` json NOT NULL,
	`schemaVersion` varchar(64) NOT NULL,
	`canonicalizerVersion` varchar(64) NOT NULL,
	`tolerancePolicyVersion` varchar(64) NOT NULL,
	`sourceChecksum` varchar(128) NOT NULL,
	`assetChecksum` varchar(128),
	`idempotencyKey` varchar(64) NOT NULL,
	`confidence` decimal(5,4),
	`capturedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geometry_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `geometry_sources_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `geometry_sources_idempotency_unique` UNIQUE(`organizationId`,`projectId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `legacy_space_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`legacySourceKey` varchar(512) NOT NULL,
	`legacyTable` varchar(128) NOT NULL,
	`legacyRowId` varchar(128),
	`legacyStringKey` varchar(255),
	`spaceIdentityId` int,
	`disposition` enum('mapped','unresolved_legacy_link','original_observation_lost','retired') NOT NULL,
	`evidence` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legacy_space_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `legacy_space_links_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `legacy_space_links_source_unique` UNIQUE(`organizationId`,`projectId`,`legacySourceKey`)
);
--> statement-breakpoint
CREATE TABLE `measurement_input_edges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`derivedMeasurementRecordId` int NOT NULL,
	`inputMeasurementRecordId` int NOT NULL,
	`inputOrdinal` int NOT NULL,
	`inputRole` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurement_input_edges_id` PRIMARY KEY(`id`),
	CONSTRAINT `measurement_input_edges_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `measurement_input_edges_pair_unique` UNIQUE(`organizationId`,`projectId`,`derivedMeasurementRecordId`,`inputMeasurementRecordId`),
	CONSTRAINT `measurement_input_edges_ordinal_unique` UNIQUE(`organizationId`,`projectId`,`derivedMeasurementRecordId`,`inputOrdinal`)
);
--> statement-breakpoint
CREATE TABLE `measurement_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`spaceIdentityId` int,
	`spaceVersionId` int,
	`graphVersionId` int,
	`geometrySourceId` int,
	`recordKind` enum('observation','derivation') NOT NULL,
	`measurementBasis` varchar(128) NOT NULL,
	`authorityVersion` varchar(64) NOT NULL,
	`originalValue` decimal(40,12),
	`originalValueExact` varchar(128),
	`originalUnit` varchar(32),
	`normalizedValue` decimal(40,12),
	`normalizedValueExact` varchar(128),
	`normalizedUnit` varchar(32),
	`acquisitionMethod` enum('manual_entry','dxf','pdf_text','image_ai','dwg_ai','typology_template','derived','migration') NOT NULL,
	`evidenceClass` enum('survey_measured','geometry_derived','source_stated','estimated','legacy_unknown') NOT NULL,
	`reviewState` enum('unreviewed','accepted','rejected','needs_clarification') NOT NULL DEFAULT 'unreviewed',
	`resultState` enum('valid','not_checked','conflict','insufficient') NOT NULL,
	`formulaVersion` varchar(64),
	`sourceIdentity` json NOT NULL,
	`confidence` decimal(5,4),
	`supersedesMeasurementRecordId` int,
	`contentFingerprint` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurement_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `measurement_records_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`)
);
--> statement-breakpoint
CREATE TABLE `project_geometry_authorities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`mode` enum('legacy','shadow','canonical') NOT NULL DEFAULT 'legacy',
	`currentGraphVersionId` int,
	`selectedGeometryVersionId` int,
	`revision` int NOT NULL DEFAULT 0,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_geometry_authorities_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_geometry_authorities_org_project_unique` UNIQUE(`organizationId`,`projectId`),
	CONSTRAINT `project_geometry_authorities_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`)
);
--> statement-breakpoint
CREATE TABLE `space_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`publicId` varchar(64) NOT NULL,
	`initialGraphId` varchar(64) NOT NULL,
	`lifecycleState` enum('active','retired','tombstoned') NOT NULL DEFAULT 'active',
	`tombstonedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `space_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `space_identities_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `space_identities_public_id_unique` UNIQUE(`organizationId`,`projectId`,`publicId`)
);
--> statement-breakpoint
CREATE TABLE `space_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`spaceIdentityId` int NOT NULL,
	`geometryVersionId` int NOT NULL,
	`version` int NOT NULL,
	`roomCode` varchar(64),
	`roomName` varchar(255) NOT NULL,
	`category` varchar(64) NOT NULL,
	`levelId` varchar(128) NOT NULL,
	`zoneId` varchar(128),
	`containment` json,
	`contentFingerprint` varchar(64) NOT NULL,
	`supersedesSpaceVersionId` int,
	`supersessionKind` enum('revision','split','merge','delete','duplicate'),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `space_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `space_versions_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `space_versions_identity_version_unique` UNIQUE(`organizationId`,`projectId`,`spaceIdentityId`,`version`),
	CONSTRAINT `space_versions_graph_identity_unique` UNIQUE(`organizationId`,`projectId`,`geometryVersionId`,`spaceIdentityId`)
);
--> statement-breakpoint
CREATE TABLE `spatial_graph_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int NOT NULL,
	`graphId` varchar(64) NOT NULL,
	`version` int NOT NULL,
	`parentGraphVersionId` int,
	`geometrySourceId` int,
	`status` enum('candidate','accepted','rejected','superseded') NOT NULL DEFAULT 'candidate',
	`canonicalGeometry` json NOT NULL,
	`canonicalJsonSizeBytes` int NOT NULL,
	`totalAreaSquareMetres` decimal(40,12) NOT NULL,
	`totalAreaSquareMicrometresTwice` varchar(128) NOT NULL,
	`schemaVersion` varchar(64) NOT NULL,
	`canonicalizerVersion` varchar(64) NOT NULL,
	`tolerancePolicyVersion` varchar(64) NOT NULL,
	`referenceFrame` json NOT NULL,
	`fingerprintAlgorithm` varchar(32) NOT NULL,
	`fingerprintDomain` varchar(128) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spatial_graph_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `spatial_graph_versions_scope_id_unique` UNIQUE(`organizationId`,`projectId`,`id`),
	CONSTRAINT `spatial_graph_versions_graph_version_unique` UNIQUE(`organizationId`,`projectId`,`graphId`,`version`)
);
--> statement-breakpoint
ALTER TABLE `project_assets` MODIFY COLUMN `assetType` enum('image','pdf','audio','video','url','text_note','cad') DEFAULT 'image';--> statement-breakpoint
CREATE INDEX `artifact_input_snapshots_graph_idx` ON `artifact_input_snapshots` (`organizationId`,`projectId`,`graphVersionId`);--> statement-breakpoint
CREATE INDEX `artifact_input_snapshots_digest_idx` ON `artifact_input_snapshots` (`organizationId`,`projectId`,`snapshotDigest`);--> statement-breakpoint
CREATE INDEX `geometry_reconciliation_events_candidate_idx` ON `geometry_reconciliation_events` (`organizationId`,`projectId`,`candidateGraphVersionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `geometry_reconciliation_events_authority_idx` ON `geometry_reconciliation_events` (`organizationId`,`projectId`,`authorityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `geometry_reconciliation_events_result_idx` ON `geometry_reconciliation_events` (`organizationId`,`projectId`,`resultGraphVersionId`);--> statement-breakpoint
CREATE INDEX `geometry_reconciliation_events_measurements_idx` ON `geometry_reconciliation_events` (`organizationId`,`projectId`,`baseMeasurementRecordId`,`candidateMeasurementRecordId`);--> statement-breakpoint
CREATE INDEX `geometry_sources_asset_idx` ON `geometry_sources` (`organizationId`,`projectId`,`assetId`);--> statement-breakpoint
CREATE INDEX `geometry_sources_checksum_idx` ON `geometry_sources` (`organizationId`,`projectId`,`sourceChecksum`);--> statement-breakpoint
CREATE INDEX `legacy_space_links_space_idx` ON `legacy_space_links` (`organizationId`,`projectId`,`spaceIdentityId`);--> statement-breakpoint
CREATE INDEX `measurement_input_edges_input_idx` ON `measurement_input_edges` (`organizationId`,`projectId`,`inputMeasurementRecordId`);--> statement-breakpoint
CREATE INDEX `measurement_records_space_idx` ON `measurement_records` (`organizationId`,`projectId`,`spaceIdentityId`,`spaceVersionId`);--> statement-breakpoint
CREATE INDEX `measurement_records_graph_idx` ON `measurement_records` (`organizationId`,`projectId`,`graphVersionId`);--> statement-breakpoint
CREATE INDEX `measurement_records_source_idx` ON `measurement_records` (`organizationId`,`projectId`,`geometrySourceId`);--> statement-breakpoint
CREATE INDEX `measurement_records_fingerprint_idx` ON `measurement_records` (`organizationId`,`projectId`,`contentFingerprint`);--> statement-breakpoint
CREATE INDEX `measurement_records_supersedes_idx` ON `measurement_records` (`organizationId`,`projectId`,`supersedesMeasurementRecordId`);--> statement-breakpoint
CREATE INDEX `project_geometry_authorities_current_idx` ON `project_geometry_authorities` (`organizationId`,`projectId`,`currentGraphVersionId`);--> statement-breakpoint
CREATE INDEX `project_geometry_authorities_shadow_idx` ON `project_geometry_authorities` (`organizationId`,`projectId`,`selectedGeometryVersionId`);--> statement-breakpoint
CREATE INDEX `space_identities_graph_idx` ON `space_identities` (`organizationId`,`projectId`,`initialGraphId`);--> statement-breakpoint
CREATE INDEX `space_versions_content_fingerprint_idx` ON `space_versions` (`organizationId`,`projectId`,`contentFingerprint`);--> statement-breakpoint
CREATE INDEX `space_versions_supersedes_idx` ON `space_versions` (`organizationId`,`projectId`,`supersedesSpaceVersionId`);--> statement-breakpoint
CREATE INDEX `spatial_graph_versions_fingerprint_idx` ON `spatial_graph_versions` (`organizationId`,`projectId`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `spatial_graph_versions_source_idx` ON `spatial_graph_versions` (`organizationId`,`projectId`,`geometrySourceId`);--> statement-breakpoint
CREATE INDEX `spatial_graph_versions_parent_idx` ON `spatial_graph_versions` (`organizationId`,`projectId`,`parentGraphVersionId`);
