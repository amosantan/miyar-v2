ALTER TABLE `dld_rents` MODIFY COLUMN `actual_area` decimal(14,2);--> statement-breakpoint
ALTER TABLE `dld_rents` MODIFY COLUMN `rent_per_sqm` decimal(14,2);--> statement-breakpoint
ALTER TABLE `sustainability_snapshots` MODIFY COLUMN `carbonPerSqm` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `developerType` enum('Master Developer','Private/Boutique','Institutional Investor');--> statement-breakpoint
ALTER TABLE `projects` ADD `targetDemographic` enum('HNWI','Families','Young Professionals','Investors');--> statement-breakpoint
ALTER TABLE `projects` ADD `salesStrategy` enum('Sell Off-Plan','Sell on Completion','Build-to-Rent');--> statement-breakpoint
ALTER TABLE `projects` ADD `competitiveDensity` enum('Low','Moderate','Saturated');--> statement-breakpoint
ALTER TABLE `projects` ADD `projectUsp` enum('Location/Views','Amenities/Facilities','Price/Value','Design/Architecture');--> statement-breakpoint
ALTER TABLE `projects` ADD `targetYield` enum('< 5%','5-7%','7-9%','> 9%');--> statement-breakpoint
ALTER TABLE `projects` ADD `procurementStrategy` enum('Turnkey','Traditional','Construction Management');--> statement-breakpoint
ALTER TABLE `projects` ADD `amenityFocus` enum('Wellness/Spa','F&B/Social','Minimal/Essential','Business/Co-working');--> statement-breakpoint
ALTER TABLE `projects` ADD `techIntegration` enum('Basic','Smart Home Ready','Fully Integrated');--> statement-breakpoint
ALTER TABLE `projects` ADD `materialSourcing` enum('Local','European','Asian','Global Mix');