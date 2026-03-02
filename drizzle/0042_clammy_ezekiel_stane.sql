ALTER TABLE `project_assets` MODIFY COLUMN `category` enum('brief','brand','budget','competitor','inspiration','material','sales','legal','mood_image','material_board','marketing_hero','floor_plan','voice_note','generated','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `project_assets` ADD `assetType` enum('image','pdf','audio','video','url','text_note') DEFAULT 'image';--> statement-breakpoint
ALTER TABLE `project_assets` ADD `aiExtractionResult` json;--> statement-breakpoint
ALTER TABLE `project_assets` ADD `aiContributions` json;