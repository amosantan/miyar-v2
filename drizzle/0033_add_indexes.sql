-- P2-6: Database indexes on frequently queried columns
-- Covers all tables with userId, projectId, orgId FK columns + common filters

-- Users table (orgId)
CREATE INDEX IF NOT EXISTS `idx_users_orgId` ON `users` (`orgId`);

-- Projects table (userId, orgId, status)
CREATE INDEX IF NOT EXISTS `idx_projects_userId` ON `projects` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_projects_orgId` ON `projects` (`orgId`);
CREATE INDEX IF NOT EXISTS `idx_projects_status` ON `projects` (`status`);

-- Benchmarks (orgId)
CREATE INDEX IF NOT EXISTS `idx_benchmarks_orgId` ON `benchmarks` (`orgId`);

-- Audit logs (userId, entityType+action)
CREATE INDEX IF NOT EXISTS `idx_audit_logs_userId` ON `audit_logs` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_entity` ON `audit_logs` (`entityType`, `action`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created` ON `audit_logs` (`createdAt`);

-- Scoring results (projectId)
CREATE INDEX IF NOT EXISTS `idx_scoring_results_projectId` ON `scoring_results` (`projectId`);

-- ROI projections (projectId)
CREATE INDEX IF NOT EXISTS `idx_roi_projections_projectId` ON `roi_projections` (`projectId`);

-- Market evidence records (projectId, orgId, sourceId, createdAt)
CREATE INDEX IF NOT EXISTS `idx_evidence_projectId` ON `market_evidence_records` (`projectId`);
CREATE INDEX IF NOT EXISTS `idx_evidence_orgId` ON `market_evidence_records` (`orgId`);
CREATE INDEX IF NOT EXISTS `idx_evidence_sourceId` ON `market_evidence_records` (`sourceId`);
CREATE INDEX IF NOT EXISTS `idx_evidence_created` ON `market_evidence_records` (`createdAt`);

-- Scenario comparisons (projectId, userId)
CREATE INDEX IF NOT EXISTS `idx_scenario_comparisons_projectId` ON `scenario_comparisons` (`projectId`);
CREATE INDEX IF NOT EXISTS `idx_scenario_comparisons_userId` ON `scenario_comparisons` (`userId`);

-- Risk surface maps (projectId)
CREATE INDEX IF NOT EXISTS `idx_risk_maps_projectId` ON `risk_surface_maps` (`projectId`);

-- Stress test results (projectId)
CREATE INDEX IF NOT EXISTS `idx_stress_tests_projectId` ON `stress_test_results` (`projectId`);

-- Bias profiles (projectId, userId)
CREATE INDEX IF NOT EXISTS `idx_bias_profiles_projectId` ON `bias_profiles` (`projectId`);
CREATE INDEX IF NOT EXISTS `idx_bias_profiles_userId` ON `bias_profiles` (`userId`);

-- Bias alerts (userId, dismissed)
CREATE INDEX IF NOT EXISTS `idx_bias_alerts_userId` ON `bias_alerts` (`userId`);

-- Portfolio projects (portfolioId, projectId)
CREATE INDEX IF NOT EXISTS `idx_portfolio_projects_portfolioId` ON `portfolio_projects` (`portfolioId`);
CREATE INDEX IF NOT EXISTS `idx_portfolio_projects_projectId` ON `portfolio_projects` (`projectId`);

-- Monte Carlo simulations (projectId)
CREATE INDEX IF NOT EXISTS `idx_monte_carlo_projectId` ON `monte_carlo_simulations` (`projectId`);

-- Digital twin models (projectId)
CREATE INDEX IF NOT EXISTS `idx_digital_twin_projectId` ON `digital_twin_models` (`projectId`);

-- Customer health scores (userId, createdAt)
CREATE INDEX IF NOT EXISTS `idx_health_scores_userId` ON `customer_health_scores` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_health_scores_created` ON `customer_health_scores` (`createdAt`);

-- Design briefs (projectId)
CREATE INDEX IF NOT EXISTS `idx_design_briefs_projectId` ON `design_briefs` (`project_id`);

-- Material boards (projectId)
CREATE INDEX IF NOT EXISTS `idx_material_boards_projectId` ON `material_boards` (`project_id`);

-- Collaboration threads (projectId)
CREATE INDEX IF NOT EXISTS `idx_collab_threads_projectId` ON `collaboration_threads` (`project_id`);

-- Outcome predictions (projectId)
CREATE INDEX IF NOT EXISTS `idx_outcome_predictions_projectId` ON `outcome_predictions` (`project_id`);

-- Sensitivity analyses (projectId)
CREATE INDEX IF NOT EXISTS `idx_sensitivity_projectId` ON `sensitivity_analyses` (`project_id`);

-- Evidence attachments (projectId, orgId)
CREATE INDEX IF NOT EXISTS `idx_evidence_attach_projectId` ON `evidence_attachments` (`project_id`);
CREATE INDEX IF NOT EXISTS `idx_evidence_attach_orgId` ON `evidence_attachments` (`org_id`);

-- Webhooks (orgId)
CREATE INDEX IF NOT EXISTS `idx_webhooks_orgId` ON `webhooks` (`orgId`);

-- Notifications (userId, read, createdAt)
CREATE INDEX IF NOT EXISTS `idx_notifications_userId` ON `notifications` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_notifications_read` ON `notifications` (`userId`, `read`);

-- Ingestion batches (sourceId, status)
CREATE INDEX IF NOT EXISTS `idx_ingestion_batches_sourceId` ON `ingestion_batches` (`sourceId`);
CREATE INDEX IF NOT EXISTS `idx_ingestion_batches_status` ON `ingestion_batches` (`status`);

-- Analytics insights (projectId)
CREATE INDEX IF NOT EXISTS `idx_analytics_projectId` ON `analytics_insights` (`projectId`);
