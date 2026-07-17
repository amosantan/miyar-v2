ALTER TABLE `accuracy_snapshots` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `accuracy_snapshots` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `benchmark_suggestions` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `benchmark_suggestions` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_patterns` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_patterns` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `design_trends` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `design_trends` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `logic_change_log` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `logic_change_log` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_insights` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `project_insights` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_insights` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE `trend_snapshots` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `trend_snapshots` ADD `corpusScope` enum('organization','platform_public','legacy_unscoped') DEFAULT 'legacy_unscoped' NOT NULL;--> statement-breakpoint
ALTER TABLE `trend_snapshots` ADD `corpusPolicyVersion` varchar(64) DEFAULT 'legacy-v0' NOT NULL;--> statement-breakpoint
CREATE INDEX `decision_patterns_corpus_idx` ON `decision_patterns` (`corpusScope`);--> statement-breakpoint
CREATE INDEX `design_trends_corpus_region_style_idx` ON `design_trends` (`corpusScope`,`region`,`styleClassification`);--> statement-breakpoint
CREATE INDEX `evidence_records_corpus_org_project_category_idx` ON `evidence_records` (`corpusScope`,`orgId`,`projectId`,`category`);--> statement-breakpoint
CREATE INDEX `logic_change_log_corpus_status_idx` ON `logic_change_log` (`corpusScope`,`status`);--> statement-breakpoint
CREATE INDEX `trend_snapshots_corpus_org_category_geography_idx` ON `trend_snapshots` (`corpusScope`,`orgId`,`category`,`geography`);