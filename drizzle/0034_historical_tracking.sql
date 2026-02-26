-- P2-5: Historical tracking for health scores + sustainability
-- Health score history: already exists via customer_health_scores table (each run inserts a row)
-- Sustainability history: create a dedicated table to capture Digital Twin snapshots over time

CREATE TABLE `sustainability_snapshots` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `projectId` int NOT NULL,
  `userId` int NOT NULL,
  `compositeScore` float NOT NULL,
  `grade` varchar(2) NOT NULL,
  `embodiedCarbon` float NOT NULL,
  `operationalEnergy` float NOT NULL,
  `lifecycleCost` float NOT NULL,
  `carbonPerSqm` float,
  `energyRating` varchar(2),
  `renewablesEnabled` boolean DEFAULT false,
  `waterRecycling` boolean DEFAULT false,
  `configSnapshot` json,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `fk_ss_project` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`),
  CONSTRAINT `fk_ss_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);

CREATE INDEX `idx_ss_projectId` ON `sustainability_snapshots` (`projectId`);
CREATE INDEX `idx_ss_userId` ON `sustainability_snapshots` (`userId`);
CREATE INDEX `idx_ss_created` ON `sustainability_snapshots` (`createdAt`);

-- Health score trend index (already has userId index above, add composite for trend queries)
CREATE INDEX `idx_health_trend` ON `customer_health_scores` (`userId`, `createdAt`);
