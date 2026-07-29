CREATE TABLE `paint_coverage_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`specId` int NOT NULL,
	`coverageM2PerLitrePerCoat` decimal(10,3) NOT NULL,
	`coatCount` int NOT NULL,
	`wastePct` decimal(6,3) NOT NULL,
	`packSizesLitres` json NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`policyVersion` varchar(64) NOT NULL,
	`sourceDocumentUrl` text NOT NULL,
	`sourceDocumentDigest` varchar(128) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`supersedesId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paint_coverage_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `paint_coverage_profiles_supersedes_unique` UNIQUE(`supersedesId`)
);
--> statement-breakpoint
ALTER TABLE `sustainability_snapshots` MODIFY COLUMN `lifecycleCost` decimal(18,2);--> statement-breakpoint
ALTER TABLE `digital_twin_models` ADD `lifecycle_cost_resolution_state` enum('resolved','insufficient','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` MODIFY COLUMN `element` enum('floor','wall_primary','wall_feature','wall_wet','ceiling','joinery','hardware','sanitaryware') NOT NULL;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` ADD `product_id` int;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` ADD `spec_id` int;--> statement-breakpoint
ALTER TABLE `finish_schedule_items` ADD `identity_state` enum('resolved','unresolved','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_allocations` MODIFY COLUMN `element` enum('floor','walls','ceiling','joinery','hardware','sanitaryware') NOT NULL;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `specId` int;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `benchmarkProposalId` int;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolutionState` enum('resolved','insufficient','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolutionReason` varchar(64);--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolvedPriceScope` enum('supply_only','supply_and_install','legacy_unknown');--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `requestedGeography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae');--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolvedGeography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae');--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolvedUnitBasis` enum('per_piece','per_pack','per_sqm','per_lm','per_litre');--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolutionAsOf` timestamp;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `resolverPolicyVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `benchmarkVersionId` int;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `benchmarkVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `provenancePolicyVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `presentationProvenance` json;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `quantityPolicyVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `quantityConversionInputs` json;--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `explicitQuantity` decimal(12,3);--> statement-breakpoint
ALTER TABLE `material_allocations` ADD `explicitQuantityUnit` enum('sqm','lm','piece','pack','litre');--> statement-breakpoint
ALTER TABLE `materials_to_boards` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `materials_to_boards` ADD `specId` int;--> statement-breakpoint
ALTER TABLE `materials_to_boards` ADD `identityState` enum('resolved','unresolved','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `materialPriceGeography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae');--> statement-breakpoint
ALTER TABLE `projects` ADD `material_pricing_revision` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `rfq_line_items` MODIFY COLUMN `quantity` decimal(12,3);--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `product_id` int;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `spec_id` int;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `benchmark_proposal_id` int;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolution_state` enum('resolved','insufficient','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolution_reason` varchar(64);--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolved_price_scope` enum('supply_only','supply_and_install','legacy_unknown');--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `requested_geography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae');--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolved_geography` enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae');--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolved_unit_basis` enum('per_piece','per_pack','per_sqm','per_lm','per_litre');--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolution_as_of` timestamp;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `resolver_policy_version` varchar(64);--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `benchmark_version_id` int;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `benchmark_version` varchar(64);--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `provenance_policy_version` varchar(64);--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `presentation_provenance` json;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `quantity_policy_version` varchar(64);--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `quantity_conversion_inputs` json;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `line_kind` enum('material','non_material_fee','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `artifact_state` enum('draft','issued','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfq_line_items` ADD `non_material_policy_version` varchar(64);--> statement-breakpoint
ALTER TABLE `sustainability_snapshots` ADD `lifecycleCostResolutionState` enum('resolved','insufficient','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL;--> statement-breakpoint
CREATE INDEX `paint_coverage_profiles_resolution_idx` ON `paint_coverage_profiles` (`productId`,`specId`,`status`,`effectiveAt`);
