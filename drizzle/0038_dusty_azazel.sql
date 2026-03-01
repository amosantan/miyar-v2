ALTER TABLE `projects` ADD `handoverCondition` enum('Shell & Core','Category A','Category B','Fully Furnished');--> statement-breakpoint
ALTER TABLE `projects` ADD `brandedStatus` enum('Unbranded','Hospitality Branded','Fashion/Automotive Branded');--> statement-breakpoint
ALTER TABLE `projects` ADD `salesChannel` enum('Local Brokerage','International Roadshows','Direct to VIP');