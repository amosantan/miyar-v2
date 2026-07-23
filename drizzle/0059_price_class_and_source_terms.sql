ALTER TABLE `evidence_records` ADD `priceClass` enum('retail_listed','trade_quoted','official_statistic','consultancy_benchmark','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `priceBasis` enum('per_piece','per_pack','per_sqm','per_lm','per_litre','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `packQuantity` decimal(10,3);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `vatIncluded` boolean;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `platformProductKey` varchar(128);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `priceBasisPolicyVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `source_registry` ADD `platform` enum('shopify','woocommerce','magento','none');--> statement-breakpoint
ALTER TABLE `source_registry` ADD `termsDecision` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `source_registry` ADD `priceClass` enum('retail_listed','trade_quoted','official_statistic','consultancy_benchmark','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD CONSTRAINT `evidence_records_source_product_key_unique` UNIQUE(`sourceRegistryId`,`platformProductKey`);