ALTER TABLE `projects` ADD `lifecycleFocus` enum('Short-term Resale','Medium-term Hold','Long-term Retention');--> statement-breakpoint
ALTER TABLE `projects` ADD `brandStandardConstraints` enum('High Flexibility','Moderate Guidelines','Strict Vendor List');--> statement-breakpoint
ALTER TABLE `projects` ADD `timelineFlexibility` enum('Highly Flexible','Moderate Contingency','Fixed / Zero Tolerance');--> statement-breakpoint
ALTER TABLE `projects` ADD `targetValueAdd` enum('Max Capital Appreciation','Max Rental Yield','Balanced Return','Brand Flagship / Trophy');