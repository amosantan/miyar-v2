CREATE TABLE `product` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int,
	`identityKey` varchar(64) NOT NULL,
	`brand` varchar(255),
	`manufacturer` varchar(255),
	`productCode` varchar(128),
	`productName` varchar(255) NOT NULL,
	`series` varchar(255),
	`canonicalCategory` enum('floors','walls','ceilings','joinery','lighting','sanitary','kitchen','hardware','ffe','other') NOT NULL,
	`nominalDimensions` json,
	`materialComposition` text,
	`finish` varchar(255),
	`styleTags` json,
	`originCountry` varchar(128),
	`discontinued` boolean NOT NULL DEFAULT false,
	`createdVia` enum('manual','scrape_dedup','quote_import') NOT NULL,
	`sourceRegistryId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_identity_key_unique` UNIQUE(`identityKey`)
);
--> statement-breakpoint
CREATE TABLE `specification` (
	`id` int AUTO_INCREMENT NOT NULL,
	`specKey` varchar(255) NOT NULL,
	`category` enum('floors','walls','ceilings','joinery','lighting','sanitary','kitchen','hardware','ffe','other') NOT NULL,
	`finishLevel` enum('basic','standard','premium','luxury','ultra_luxury') NOT NULL,
	`unitBasis` enum('per_piece','per_pack','per_sqm','per_lm','per_litre') NOT NULL,
	`geography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae') NOT NULL,
	`performanceAttributes` json,
	`policyVersion` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `specification_id` PRIMARY KEY(`id`),
	CONSTRAINT `specification_spec_key_unique` UNIQUE(`specKey`)
);
--> statement-breakpoint
CREATE TABLE `supplier_quote` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`contactRef` varchar(255),
	`quoteRef` varchar(255) NOT NULL,
	`receivedAt` timestamp NOT NULL,
	`validUntil` timestamp,
	`confidentiality` enum('internal','confidential','restricted') NOT NULL DEFAULT 'confidential',
	`inclusions` json,
	`exclusions` json,
	`alternates` json,
	`supersedesId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplier_quote_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_quote_org_ref_unique` UNIQUE(`orgId`,`quoteRef`),
	CONSTRAINT `supplier_quote_supersedes_unique` UNIQUE(`supersedesId`)
);
--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `specId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `orgId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `priceScope` enum('supply_only','supply_and_install');--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `sourceKind` enum('observed','assumption') DEFAULT 'observed' NOT NULL;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `sourceLadderRung` enum('supplier_quote','official_statistic','consultancy_benchmark','market_observation','retail_sanity','assumption');--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `benchmarkVersionId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `supplierQuoteId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `supersedesId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `legacyMaterialLibraryId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `sourceLabel` varchar(255);--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `priceConfidence` enum('assumption','indicative','quoted');--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD `provenancePolicyVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `specId` int;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `geography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae');--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `priceScope` enum('supply_only','supply_and_install');--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `deliveryIncluded` boolean;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `moqValue` decimal(12,3);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `moqUnit` varchar(32);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `leadTimeDays` int;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `wasteBasis` varchar(64);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `observationKind` enum('market_listing','official_statistic','consultancy_benchmark','supplier_quote','manual');--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `supplierQuoteId` int;--> statement-breakpoint
ALTER TABLE `evidence_records` ADD `supersedesObservationId` int;--> statement-breakpoint
ALTER TABLE `material_library` ADD `product_id` int;--> statement-breakpoint
ALTER TABLE `materials_catalog` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD CONSTRAINT `benchmark_proposals_supersedes_unique` UNIQUE(`supersedesId`);--> statement-breakpoint
ALTER TABLE `benchmark_proposals` ADD CONSTRAINT `benchmark_proposals_legacy_library_unique` UNIQUE(`legacyMaterialLibraryId`);--> statement-breakpoint
ALTER TABLE `evidence_records` ADD CONSTRAINT `evidence_records_supersedes_unique` UNIQUE(`supersedesObservationId`);--> statement-breakpoint
CREATE INDEX `product_scope_brand_code_idx` ON `product` (`orgId`,`brand`,`productCode`);--> statement-breakpoint
CREATE INDEX `product_scope_category_name_idx` ON `product` (`orgId`,`canonicalCategory`,`productName`);--> statement-breakpoint
CREATE INDEX `specification_resolution_idx` ON `specification` (`category`,`finishLevel`,`unitBasis`,`geography`);--> statement-breakpoint
CREATE INDEX `supplier_quote_org_validity_idx` ON `supplier_quote` (`orgId`,`validUntil`);--> statement-breakpoint
CREATE INDEX `benchmark_proposals_governed_resolver_idx` ON `benchmark_proposals` (`specId`,`orgId`,`productId`,`priceScope`,`status`,`recommendation`);--> statement-breakpoint
CREATE INDEX `benchmark_proposals_supplier_quote_idx` ON `benchmark_proposals` (`supplierQuoteId`);--> statement-breakpoint
CREATE INDEX `evidence_records_governed_price_idx` ON `evidence_records` (`specId`,`productId`,`priceScope`,`captureDate`);--> statement-breakpoint
CREATE INDEX `evidence_records_supplier_quote_idx` ON `evidence_records` (`supplierQuoteId`);
