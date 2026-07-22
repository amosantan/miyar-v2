ALTER TABLE `benchmark_proposals` ADD `keyPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `modelSuggestedFinishLevel` varchar(32);