ALTER TABLE `design_briefs` ADD `designNarrative` json NOT NULL;--> statement-breakpoint
ALTER TABLE `design_briefs` ADD `materialSpecifications` json NOT NULL;--> statement-breakpoint
ALTER TABLE `design_briefs` ADD `boqFramework` json NOT NULL;--> statement-breakpoint
ALTER TABLE `design_briefs` ADD `detailedBudget` json NOT NULL;--> statement-breakpoint
ALTER TABLE `design_briefs` ADD `designerInstructions` json NOT NULL;--> statement-breakpoint
ALTER TABLE `design_briefs` DROP COLUMN `positioningStatement`;--> statement-breakpoint
ALTER TABLE `design_briefs` DROP COLUMN `styleMood`;--> statement-breakpoint
ALTER TABLE `design_briefs` DROP COLUMN `materialGuidance`;--> statement-breakpoint
ALTER TABLE `design_briefs` DROP COLUMN `budgetGuardrails`;--> statement-breakpoint
ALTER TABLE `design_briefs` DROP COLUMN `procurementConstraints`;--> statement-breakpoint
ALTER TABLE `design_briefs` DROP COLUMN `deliverablesChecklist`;