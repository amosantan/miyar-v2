-- P3-2: Move hardcoded material data to database
-- Migrate material constants from digital-twin.ts to a DB table

CREATE TABLE `material_constants` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `materialType` varchar(32) NOT NULL UNIQUE,
  `carbonIntensity` decimal(10,4) NOT NULL COMMENT 'kgCO2e per kg of material',
  `density` int NOT NULL COMMENT 'kg per m³',
  `typicalThickness` decimal(6,3) NOT NULL COMMENT 'meters',
  `recyclability` decimal(4,3) NOT NULL COMMENT '0.0 to 1.0 ratio',
  `maintenanceFactor` decimal(6,4) NOT NULL COMMENT 'annual maintenance cost factor',
  `costPerM2` decimal(10,2) NOT NULL COMMENT 'AED per m²',
  `isActive` boolean DEFAULT true NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed data matching the current hardcoded values in digital-twin.ts
INSERT INTO `material_constants` (`materialType`, `carbonIntensity`, `density`, `typicalThickness`, `recyclability`, `maintenanceFactor`, `costPerM2`) VALUES
  ('concrete',   0.1590, 2400, 0.250, 0.650, 0.0050, 350.00),
  ('steel',      1.8500, 7850, 0.010, 0.900, 0.0030, 800.00),
  ('glass',      1.2400, 2500, 0.012, 0.400, 0.0080, 600.00),
  ('aluminum',   8.2400, 2700, 0.003, 0.950, 0.0040, 950.00),
  ('timber',     0.4600, 500,  0.100, 0.800, 0.0120, 450.00),
  ('stone',      0.0600, 2600, 0.030, 0.300, 0.0020, 700.00),
  ('gypsum',     0.1200, 1000, 0.013, 0.700, 0.0060, 120.00),
  ('insulation', 1.4000, 40,   0.100, 0.500, 0.0010, 200.00),
  ('ceramic',    0.7000, 2000, 0.010, 0.400, 0.0040, 280.00)
ON DUPLICATE KEY UPDATE
  `carbonIntensity` = VALUES(`carbonIntensity`),
  `density` = VALUES(`density`),
  `typicalThickness` = VALUES(`typicalThickness`),
  `recyclability` = VALUES(`recyclability`),
  `maintenanceFactor` = VALUES(`maintenanceFactor`),
  `costPerM2` = VALUES(`costPerM2`);

CREATE INDEX `idx_material_active` ON `material_constants` (`isActive`, `materialType`);
