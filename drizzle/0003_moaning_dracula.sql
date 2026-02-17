ALTER TABLE `report_instances` MODIFY COLUMN `reportType` enum('executive_decision_pack','design_brief_rfq','marketing_starter','validation_summary','design_brief','rfq_pack','full_report') NOT NULL;--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `roomType` varchar(64) DEFAULT 'General';--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `differentiationIndex` decimal(6,4);--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `complexityMultiplier` decimal(6,4);--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `timelineRiskMultiplier` decimal(6,4);--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `buyerPreferenceWeights` json;--> statement-breakpoint
ALTER TABLE `benchmark_data` ADD `sourceNote` text;