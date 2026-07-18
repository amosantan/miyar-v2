CREATE TABLE `evidence_confidence_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceRecordId` int,
	`runId` varchar(64),
	`sourceId` varchar(64),
	`actorId` int,
	`assessmentCorpusScope` enum('organization','platform_public','legacy_unscoped'),
	`origin` enum('connector','csv_upload','manual_entry','bulk_entry') NOT NULL,
	`outcome` enum('accepted','rejected') NOT NULL,
	`evaluationClock` timestamp NOT NULL,
	`rawPublicationText` text,
	`datePrecision` enum('missing','date','timestamp','unknown') NOT NULL,
	`parsingStatus` enum('valid','missing','invalid','future') NOT NULL,
	`parsedPublicationDate` timestamp,
	`staticGradePolicyId` varchar(64),
	`registryGradePolicyId` varchar(64),
	`confidencePolicyId` varchar(64) NOT NULL,
	`qualityPolicyId` varchar(64),
	`mergePolicyId` varchar(64),
	`assessmentGrade` enum('A','B','C'),
	`baseConfidence` decimal(6,4),
	`recencyAdjustment` decimal(6,4),
	`confidenceAfterRecency` decimal(6,4),
	`qualityMultiplier` decimal(6,4),
	`qualityFloor` decimal(6,4),
	`qualityFlags` json,
	`previousScore` int,
	`candidateScore` int,
	`finalScore` int,
	`mergeDecision` enum('inserted','latest_accepted','manual_assertion','rejected'),
	`rejectionCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_confidence_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `currentConfidenceAssessmentId` int;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `confidencePolicyVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `publicObservationKey` varchar(64);--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `recordsRejected` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD CONSTRAINT `evidence_records_public_observation_key_unique` UNIQUE(`publicObservationKey`);--> statement-breakpoint
CREATE INDEX `evidence_confidence_assessments_evidence_time_idx` ON `evidence_confidence_assessments` (`evidenceRecordId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `evidence_confidence_assessments_run_outcome_idx` ON `evidence_confidence_assessments` (`runId`,`outcome`);