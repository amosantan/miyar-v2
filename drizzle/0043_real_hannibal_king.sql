CREATE TABLE `material_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`organizationId` int NOT NULL,
	`roomId` varchar(20) NOT NULL,
	`roomName` varchar(100) NOT NULL,
	`element` enum('floor','walls','ceiling','joinery','hardware') NOT NULL,
	`materialLibraryId` int,
	`materialName` varchar(300) NOT NULL,
	`allocationPct` decimal(5,2) NOT NULL,
	`surfaceAreaM2` decimal(10,2) NOT NULL,
	`unitCostMin` decimal(10,2),
	`unitCostMax` decimal(10,2),
	`totalCostMin` decimal(12,2),
	`totalCostMax` decimal(12,2),
	`aiReasoning` text,
	`isLocked` boolean NOT NULL DEFAULT false,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_supplier_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`supplierName` varchar(200) NOT NULL,
	`supplierUrl` text NOT NULL,
	`materialCategory` enum('flooring','wall_paint','wall_tile','ceiling','joinery','sanitaryware','fittings','lighting','hardware','specialty') NOT NULL,
	`tier` enum('affordable','mid','premium','ultra') NOT NULL,
	`notes` text,
	`lastScrapedAt` timestamp,
	`lastPriceAedMin` decimal(10,2),
	`lastPriceAedMax` decimal(10,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_supplier_sources_id` PRIMARY KEY(`id`)
);
