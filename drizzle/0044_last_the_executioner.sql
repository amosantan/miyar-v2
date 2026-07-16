CREATE TABLE `amenity_sub_spaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceProgramRoomId` int NOT NULL,
	`subSpaceName` varchar(100) NOT NULL,
	`subSpaceType` enum('pool','gym','spa','lounge','kids_club','business_center','concierge','prayer_room','theater') NOT NULL,
	`sqm` decimal(10,2) NOT NULL,
	`pctOfParent` decimal(5,2) NOT NULL,
	`isFitOut` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `amenity_sub_spaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `space_program_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`organizationId` int NOT NULL,
	`roomCode` varchar(20) NOT NULL,
	`roomName` varchar(100) NOT NULL,
	`category` enum('lobby','corridor','office_floor','guest_room','suite','fb_restaurant','bathroom','kitchen','bedroom','living','utility','amenity','parking','retail','back_of_house','other') NOT NULL,
	`sqm` decimal(10,2) NOT NULL,
	`floorLevel` varchar(20),
	`source` enum('typology_default','user_manual','file_extraction') NOT NULL DEFAULT 'typology_default',
	`isFitOut` boolean NOT NULL DEFAULT true,
	`fitOutOverridden` boolean NOT NULL DEFAULT false,
	`fitOutReason` text,
	`finishGrade` enum('A','B','C') NOT NULL DEFAULT 'B',
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`budgetPct` decimal(5,4),
	`sortOrder` int NOT NULL DEFAULT 0,
	`blockName` varchar(100) NOT NULL DEFAULT 'Main',
	`blockTypology` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `space_program_rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `report_instances` MODIFY COLUMN `reportType` enum('executive_pack','full_technical','tender_brief','executive_decision_pack','design_brief_rfq','marketing_starter','validation_summary','design_brief','rfq_pack','full_report','marketing_prelaunch','autonomous_design_brief') NOT NULL;