/**
 * Market Intelligence Router (Stage 1)
 * Evidence Vault, Source Registry, Benchmark Proposals,
 * Competitor Intelligence, Trend Tags, Audit Logging
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { nanoid } from "nanoid";
import { DynamicConnector } from "../engines/ingestion/connectors/dynamic";
import { runSingleConnector, testScrape } from "../engines/ingestion/orchestrator";
import { generateCsvTemplate, processCsvUpload } from "../engines/ingestion/csv-pipeline";
import { seedUAESources } from "../engines/ingestion/seeds/uae-sources";

// ─── Shared Schemas ─────────────────────────────────────────────────────────

const evidenceRecordSchema = z.object({
  projectId: z.number().optional(),
  sourceRegistryId: z.number().optional(),
  category: z.enum([
    "floors", "walls", "ceilings", "joinery", "lighting",
    "sanitary", "kitchen", "hardware", "ffe", "other",
  ]),
  itemName: z.string().min(1),
  specClass: z.string().optional(),
  priceMin: z.number().optional(),
  priceTypical: z.number().optional(),
  priceMax: z.number().optional(),
  unit: z.string().min(1),
  currencyOriginal: z.string().default("AED"),
  currencyAed: z.number().optional(),
  fxRate: z.number().optional(),
  fxSource: z.string().optional(),
  sourceUrl: z.string().url(),
  publisher: z.string().optional(),
  captureDate: z.string(), // ISO date
  reliabilityGrade: z.enum(["A", "B", "C"]),
  confidenceScore: z.number().min(0).max(100),
  extractedSnippet: z.string().optional(),
  notes: z.string().optional(),
  // V2.2 metadata fields
  title: z.string().optional(),
  evidencePhase: z.enum(["concept", "schematic", "detailed_design", "tender", "procurement", "construction", "handover"]).optional(),
  author: z.string().optional(),
  confidentiality: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  tags: z.array(z.string()).optional(),
  fileUrl: z.string().optional(),
  fileKey: z.string().optional(),
  fileMimeType: z.string().optional(),
});

const sourceRegistrySchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  sourceType: z.enum([
    "supplier_catalog", "manufacturer_catalog", "developer_brochure",
    "industry_report", "government_tender", "procurement_portal",
    "trade_publication", "retailer_listing", "aggregator", "other",
  ]),
  reliabilityDefault: z.enum(["A", "B", "C"]).default("B"),
  isWhitelisted: z.boolean().default(true),
  region: z.string().default("UAE"),
  notes: z.string().optional(),
  // DFE Fields
  scrapeConfig: z.any().optional(),
  scrapeSchedule: z.string().optional(),
  scrapeMethod: z.enum(["html_llm", "html_rules", "json_api", "rss_feed", "csv_upload", "email_forward"]).default("html_llm"),
  scrapeHeaders: z.any().optional(),
  extractionHints: z.string().optional(),
  priceFieldMapping: z.any().optional(),
  lastScrapedAt: z.string().optional(),
  lastScrapedStatus: z.enum(["success", "partial", "failed", "never"]).default("never"),
  lastRecordCount: z.number().default(0),
  consecutiveFailures: z.number().default(0),
  requestDelayMs: z.number().default(2000),
});

// ─── Helper: generate evidence record ID ────────────────────────────────────

function generateRecordId(): string {
  const seq = nanoid(8).toUpperCase();
  return `MYR-PE-${seq}`;
}

// ─── Helper: generate run ID ────────────────────────────────────────────────

function generateRunId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nanoid(6)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════

export const marketIntelligenceRouter = router({

  // ─── Source Registry ────────────────────────────────────────────────────────

  sources: router({
    list: protectedProcedure.query(async () => {
      return db.listSourceRegistry();
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSourceRegistryById(input.id);
      }),

    create: adminProcedure
      .input(sourceRegistrySchema)
      .mutation(async ({ input, ctx }) => {
        const { lastScrapedAt, ...rest } = input;
        const result = await db.createSourceRegistryEntry({
          ...rest,
          lastScrapedAt: lastScrapedAt ? new Date(lastScrapedAt) : undefined,
          addedBy: ctx.user.id
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "source_registry.create",
          entityType: "source_registry",
          entityId: result.id,
        });
        return result;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        url: z.string().url().optional(),
        sourceType: z.enum([
          "supplier_catalog", "manufacturer_catalog", "developer_brochure",
          "industry_report", "government_tender", "procurement_portal",
          "trade_publication", "retailer_listing", "aggregator", "other",
        ]).optional(),
        reliabilityDefault: z.enum(["A", "B", "C"]).optional(),
        isWhitelisted: z.boolean().optional(),
        region: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
        // DFE Fields
        scrapeConfig: z.any().optional(),
        scrapeSchedule: z.string().optional(),
        scrapeMethod: z.enum(["html_llm", "html_rules", "json_api", "rss_feed", "csv_upload", "email_forward"]).optional(),
        scrapeHeaders: z.any().optional(),
        extractionHints: z.string().optional(),
        priceFieldMapping: z.any().optional(),
        lastScrapedAt: z.string().optional(),
        lastScrapedStatus: z.enum(["success", "partial", "failed", "never"]).optional(),
        lastRecordCount: z.number().optional(),
        consecutiveFailures: z.number().optional(),
        requestDelayMs: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, lastScrapedAt, ...data } = input;
        await db.updateSourceRegistryEntry(id, {
          ...data,
          lastScrapedAt: lastScrapedAt ? new Date(lastScrapedAt) : undefined
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "source_registry.update",
          entityType: "source_registry",
          entityId: id,
          details: data.isActive !== undefined ? { isActive: data.isActive } : undefined,
        });
        return { success: true };
      }),

    toggleActive: adminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateSourceRegistryEntry(input.id, { isActive: input.isActive });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: input.isActive ? "source_registry.enable" : "source_registry.disable",
          entityType: "source_registry",
          entityId: input.id,
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteSourceRegistryEntry(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "source_registry.delete",
          entityType: "source_registry",
          entityId: input.id,
        });
        return { success: true };
      }),

    seedDefaults: adminProcedure.mutation(async ({ ctx }) => {
      const result = await seedUAESources();
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "source_registry.seed_defaults",
        entityType: "source_registry",
        details: { created: result.created, skipped: result.skipped },
      });
      return { created: result.created, skipped: result.skipped };
    }),

    testScrape: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const source = await db.getSourceRegistryById(input.id);
        if (!source) throw new Error("Source not found");
        const connector = new DynamicConnector(source);
        return await testScrape(connector);
      }),

    scrapeNow: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const source = await db.getSourceRegistryById(input.id);
        if (!source) throw new Error("Source not found");

        // Reset failures on manual run intent
        await db.updateSourceRegistryEntry(source.id, { consecutiveFailures: 0 });

        const connector = new DynamicConnector(source);
        const report = await runSingleConnector(connector, "manual", ctx.user.id);

        // Update registry with latest results
        const isSuccess = report.sourcesSucceeded > 0;
        await db.updateSourceRegistryEntry(source.id, {
          lastScrapedAt: new Date(),
          lastScrapedStatus: isSuccess ? "success" : "failed",
          lastRecordCount: report.evidenceCreated,
          consecutiveFailures: isSuccess ? 0 : (source.consecutiveFailures || 0) + 1,
        });

        return report;
      }),

    downloadCsvTemplate: adminProcedure.mutation(async () => {
      const buffer = generateCsvTemplate();
      return { base64: buffer.toString("base64") };
    }),

    uploadCsv: adminProcedure
      .input(z.object({
        sourceId: z.number(),
        base64File: z.string()
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64File, "base64");
        const report = await processCsvUpload(buffer, input.sourceId, ctx.user.id);

        // Update registry metrics for the upload
        const isSuccess = report.successCount > 0;
        await db.updateSourceRegistryEntry(input.sourceId, {
          lastScrapedAt: new Date(),
          lastScrapedStatus: isSuccess ? "success" : "failed",
          lastRecordCount: report.successCount,
          consecutiveFailures: isSuccess ? 0 : 1
        });

        return report;
      }),
  }),

  // ─── Evidence Records ──────────────────────────────────────────────────────

  evidence: router({
    list: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        category: z.string().optional(),
        reliabilityGrade: z.string().optional(),
        evidencePhase: z.string().optional(),
        confidentiality: z.string().optional(),
        limit: z.number().default(100),
      }).optional())
      .query(async ({ input }) => {
        return db.listEvidenceRecords({
          projectId: input?.projectId,
          category: input?.category,
          reliabilityGrade: input?.reliabilityGrade,
          evidencePhase: input?.evidencePhase,
          confidentiality: input?.confidentiality,
          limit: input?.limit ?? 100,
        });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEvidenceRecordById(input.id);
      }),

    create: adminProcedure
      .input(evidenceRecordSchema)
      .mutation(async ({ input, ctx }) => {
        const recordId = generateRecordId();
        const result = await db.createEvidenceRecord({
          ...input,
          recordId,
          priceMin: input.priceMin ? String(input.priceMin) as any : null,
          priceTypical: input.priceTypical ? String(input.priceTypical) as any : null,
          priceMax: input.priceMax ? String(input.priceMax) as any : null,
          currencyAed: input.currencyAed ? String(input.currencyAed) as any : null,
          fxRate: input.fxRate ? String(input.fxRate) as any : null,
          captureDate: new Date(input.captureDate),
          createdBy: ctx.user.id,
        });

        // Log to intelligence audit
        await db.createIntelligenceAuditEntry({
          runType: "manual_entry",
          runId: generateRunId("MAN"),
          actor: ctx.user.id,
          inputSummary: { category: input.category, itemName: input.itemName },
          outputSummary: { recordId, evidenceId: result.id },
          sourcesProcessed: 1,
          recordsExtracted: 1,
          errors: 0,
          startedAt: new Date(),
          completedAt: new Date(),
        });

        return { id: result.id, recordId };
      }),

    bulkImport: adminProcedure
      .input(z.object({
        records: z.array(evidenceRecordSchema),
      }))
      .mutation(async ({ input, ctx }) => {
        const runId = generateRunId("BULK");
        const startedAt = new Date();
        let imported = 0;
        const errors: { index: number; error: string }[] = [];

        for (let i = 0; i < input.records.length; i++) {
          try {
            const rec = input.records[i];
            const recordId = generateRecordId();
            await db.createEvidenceRecord({
              ...rec,
              recordId,
              priceMin: rec.priceMin ? String(rec.priceMin) as any : null,
              priceTypical: rec.priceTypical ? String(rec.priceTypical) as any : null,
              priceMax: rec.priceMax ? String(rec.priceMax) as any : null,
              currencyAed: rec.currencyAed ? String(rec.currencyAed) as any : null,
              fxRate: rec.fxRate ? String(rec.fxRate) as any : null,
              captureDate: new Date(rec.captureDate),
              runId,
              createdBy: ctx.user.id,
            });
            imported++;
          } catch (e: any) {
            errors.push({ index: i, error: e.message });
          }
        }

        await db.createIntelligenceAuditEntry({
          runType: "price_extraction",
          runId,
          actor: ctx.user.id,
          inputSummary: { totalRecords: input.records.length },
          outputSummary: { imported, errors: errors.length },
          sourcesProcessed: input.records.length,
          recordsExtracted: imported,
          errors: errors.length,
          errorDetails: errors.length > 0 ? errors : undefined,
          startedAt,
          completedAt: new Date(),
        });

        return { imported, errors: errors.length, runId };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteEvidenceRecord(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "evidence_record.delete",
          entityType: "evidence_record",
          entityId: input.id,
        });
        return { success: true };
      }),

    stats: protectedProcedure.query(async () => {
      return db.getEvidenceStats();
    }),

    // V2.2 — Evidence References
    listReferences: protectedProcedure
      .input(z.object({
        evidenceRecordId: z.number().optional(),
        targetType: z.string().optional(),
        targetId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.listEvidenceReferences(input);
      }),

    addReference: adminProcedure
      .input(z.object({
        evidenceRecordId: z.number(),
        targetType: z.enum([
          "scenario", "decision_note", "explainability_driver",
          "design_brief", "report", "material_board", "pack_section",
        ]),
        targetId: z.number(),
        sectionLabel: z.string().optional(),
        citationText: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createEvidenceReference({ ...input, addedBy: ctx.user.id });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "evidence_reference.create",
          entityType: "evidence_reference",
          entityId: result.id,
        });
        return result;
      }),

    removeReference: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteEvidenceReference(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "evidence_reference.delete",
          entityType: "evidence_reference",
          entityId: input.id,
        });
        return { success: true };
      }),

    // Get evidence records linked to a specific target (e.g., scenario, design_brief)
    getForTarget: protectedProcedure
      .input(z.object({
        targetType: z.string(),
        targetId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getEvidenceForTarget(input.targetType, input.targetId);
      }),
  }),

  // ─── Benchmark Proposals ──────────────────────────────────────────────────

  proposals: router({
    list: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listBenchmarkProposals(input?.status);
      }),

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBenchmarkProposalById(input.id);
      }),

    generate: adminProcedure
      .input(z.object({
        category: z.string().optional(),
        minEvidenceCount: z.number().default(3),
      }))
      .mutation(async ({ input, ctx }) => {
        const runId = generateRunId("PROP");
        const startedAt = new Date();

        // Get all evidence records, optionally filtered by category
        const evidence = await db.listEvidenceRecords({
          category: input.category,
          limit: 10000,
        });

        if (evidence.length === 0) {
          return { proposals: [], message: "No evidence records found to generate proposals from." };
        }

        // Group evidence by category + unit (benchmark key)
        const groups = new Map<string, typeof evidence>();
        for (const rec of evidence) {
          const key = `${rec.category}:${rec.unit}`;
          const existing = groups.get(key) ?? [];
          existing.push(rec);
          groups.set(key, existing);
        }

        const proposals: { id: number; benchmarkKey: string; recommendation: string }[] = [];
        let proposalsCreated = 0;

        for (const [benchmarkKey, records] of Array.from(groups.entries())) {
          if (records.length < input.minEvidenceCount) continue;

          // Compute statistics
          const prices = records
            .map((r: any) => Number(r.priceTypical ?? r.currencyAed ?? 0))
            .filter((p: number) => p > 0)
            .sort((a: number, b: number) => a - b);

          if (prices.length === 0) continue;

          const p25 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
          const p50 = prices[Math.floor(prices.length * 0.5)] ?? prices[0];
          const p75 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];

          // Weighted mean: A-grade records get 3x weight, B=2x, C=1x
          const weightMap: Record<string, number> = { A: 3, B: 2, C: 1 };
          let weightedSum = 0;
          let totalWeight = 0;
          for (const rec of records) {
            const price = Number(rec.priceTypical ?? rec.currencyAed ?? 0);
            if (price <= 0) continue;
            const w = weightMap[rec.reliabilityGrade] ?? 1;
            weightedSum += price * w;
            totalWeight += w;
          }
          const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : p50;

          // Reliability distribution
          const reliabilityDist = { A: 0, B: 0, C: 0 };
          for (const rec of records) {
            reliabilityDist[rec.reliabilityGrade as "A" | "B" | "C"]++;
          }

          // Recency distribution
          const now = Date.now();
          const recencyDist = { recent: 0, mid: 0, old: 0 };
          for (const rec of records) {
            const age = now - new Date(rec.captureDate).getTime();
            const months = age / (30 * 24 * 60 * 60 * 1000);
            if (months <= 3) recencyDist.recent++;
            else if (months <= 12) recencyDist.mid++;
            else recencyDist.old++;
          }

          // Source diversity
          const uniqueSources = new Set(records.map((r: any) => r.sourceRegistryId ?? r.sourceUrl));
          const sourceDiversity = uniqueSources.size;

          // Confidence score
          let confidence = 50;
          if (records.length >= 10) confidence += 15;
          else if (records.length >= 5) confidence += 10;
          if (sourceDiversity >= 3) confidence += 15;
          else if (sourceDiversity >= 2) confidence += 10;
          if (reliabilityDist.A >= records.length * 0.5) confidence += 10;
          if (recencyDist.recent >= records.length * 0.5) confidence += 10;
          confidence = Math.min(100, confidence);

          // Recommendation
          const minSampleSize = 5;
          const minSourceDiversity = 2;
          let recommendation: "publish" | "reject" = "publish";
          let rejectionReason: string | undefined;

          if (records.length < minSampleSize) {
            recommendation = "reject";
            rejectionReason = `Insufficient sample size: ${records.length} < ${minSampleSize}`;
          } else if (sourceDiversity < minSourceDiversity) {
            recommendation = "reject";
            rejectionReason = `Insufficient source diversity: ${sourceDiversity} < ${minSourceDiversity}`;
          } else if (confidence < 40) {
            recommendation = "reject";
            rejectionReason = `Low confidence score: ${confidence}`;
          }

          const result = await db.createBenchmarkProposal({
            benchmarkKey,
            proposedP25: String(p25.toFixed(2)) as any,
            proposedP50: String(p50.toFixed(2)) as any,
            proposedP75: String(p75.toFixed(2)) as any,
            weightedMean: String(weightedMean.toFixed(2)) as any,
            evidenceCount: records.length,
            sourceDiversity,
            reliabilityDist,
            recencyDist,
            confidenceScore: confidence,
            recommendation,
            rejectionReason,
            runId,
          });

          proposals.push({ id: result.id, benchmarkKey, recommendation });
          proposalsCreated++;
        }

        await db.createIntelligenceAuditEntry({
          runType: "benchmark_proposal",
          runId,
          actor: ctx.user.id,
          inputSummary: { category: input.category, minEvidenceCount: input.minEvidenceCount, totalEvidence: evidence.length },
          outputSummary: { proposalsCreated, groups: groups.size },
          sourcesProcessed: evidence.length,
          recordsExtracted: proposalsCreated,
          errors: 0,
          startedAt,
          completedAt: new Date(),
        });

        return { proposals, runId };
      }),

    review: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        reviewerNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.reviewBenchmarkProposal(input.id, {
          status: input.status,
          reviewerNotes: input.reviewerNotes,
          reviewedBy: ctx.user.id,
        });

        // If approved, create a benchmark snapshot
        if (input.status === "approved") {
          const proposal = await db.getBenchmarkProposalById(input.id);
          if (proposal) {
            const activeBV = await db.getActiveBenchmarkVersion();
            const currentBenchmarks = await db.getAllBenchmarkData();
            await db.createBenchmarkSnapshot({
              benchmarkVersionId: activeBV?.id,
              snapshotJson: {
                beforeApproval: currentBenchmarks.map((b: any) => ({
                  id: b.id,
                  typology: b.typology,
                  location: b.location,
                  marketTier: b.marketTier,
                  costPerSqftMid: b.costPerSqftMid,
                })),
                approvedProposal: {
                  benchmarkKey: proposal.benchmarkKey,
                  proposedP50: proposal.proposedP50,
                  weightedMean: proposal.weightedMean,
                },
              },
              description: `Snapshot before applying proposal ${proposal.benchmarkKey}`,
              createdBy: ctx.user.id,
            });
          }
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          action: `benchmark_proposal.${input.status}`,
          entityType: "benchmark_proposal",
          entityId: input.id,
          details: { reviewerNotes: input.reviewerNotes },
        });

        return { success: true };
      }),
  }),

  // ─── Benchmark Snapshots ──────────────────────────────────────────────────

  snapshots: router({
    list: adminProcedure.query(async () => {
      return db.listBenchmarkSnapshots();
    }),

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBenchmarkSnapshotById(input.id);
      }),

    create: adminProcedure
      .input(z.object({ description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const activeBV = await db.getActiveBenchmarkVersion();
        const currentBenchmarks = await db.getAllBenchmarkData();
        const result = await db.createBenchmarkSnapshot({
          benchmarkVersionId: activeBV?.id,
          snapshotJson: currentBenchmarks,
          description: input.description ?? `Manual snapshot at ${new Date().toISOString()}`,
          createdBy: ctx.user.id,
        });
        return result;
      }),
  }),

  // ─── Competitor Intelligence ──────────────────────────────────────────────

  competitors: router({
    // ─── Entities ─────────────────────────────────────────────────────────
    listEntities: protectedProcedure.query(async () => {
      return db.listCompetitorEntities();
    }),

    getEntity: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompetitorEntityById(input.id);
      }),

    createEntity: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        headquarters: z.string().optional(),
        segmentFocus: z.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury", "mixed"]).default("mixed"),
        website: z.string().optional(),
        logoUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createCompetitorEntity({ ...input, createdBy: ctx.user.id });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "competitor_entity.create",
          entityType: "competitor_entity",
          entityId: result.id,
        });
        return result;
      }),

    updateEntity: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        headquarters: z.string().optional(),
        segmentFocus: z.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury", "mixed"]).optional(),
        website: z.string().optional(),
        logoUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCompetitorEntity(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "competitor_entity.update",
          entityType: "competitor_entity",
          entityId: id,
        });
        return { success: true };
      }),

    deleteEntity: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCompetitorEntity(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "competitor_entity.delete",
          entityType: "competitor_entity",
          entityId: input.id,
        });
        return { success: true };
      }),

    // ─── Projects ─────────────────────────────────────────────────────────
    listProjects: protectedProcedure
      .input(z.object({
        competitorId: z.number().optional(),
        segment: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listCompetitorProjects(input?.competitorId, input?.segment);
      }),

    getProject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompetitorProjectById(input.id);
      }),

    createProject: adminProcedure
      .input(z.object({
        competitorId: z.number(),
        projectName: z.string().min(1),
        location: z.string().optional(),
        segment: z.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury"]).optional(),
        assetType: z.enum(["residential", "commercial", "hospitality", "mixed_use"]).default("residential"),
        positioningKeywords: z.array(z.string()).optional(),
        interiorStyleSignals: z.array(z.string()).optional(),
        materialCues: z.array(z.string()).optional(),
        amenityList: z.array(z.string()).optional(),
        unitMix: z.string().optional(),
        priceIndicators: z.any().optional(),
        salesMessaging: z.array(z.string()).optional(),
        differentiationClaims: z.array(z.string()).optional(),
        completionStatus: z.enum(["announced", "under_construction", "completed", "sold_out"]).optional(),
        launchDate: z.string().optional(),
        totalUnits: z.number().optional(),
        architect: z.string().optional(),
        interiorDesigner: z.string().optional(),
        sourceUrl: z.string().optional(),
        captureDate: z.string().optional(),
        evidenceCitations: z.any().optional(),
        completenessScore: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createCompetitorProject({
          ...input,
          captureDate: input.captureDate ? new Date(input.captureDate) : undefined,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "competitor_project.create",
          entityType: "competitor_project",
          entityId: result.id,
        });
        return result;
      }),

    updateProject: adminProcedure
      .input(z.object({
        id: z.number(),
        projectName: z.string().optional(),
        location: z.string().optional(),
        segment: z.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury"]).optional(),
        positioningKeywords: z.array(z.string()).optional(),
        interiorStyleSignals: z.array(z.string()).optional(),
        materialCues: z.array(z.string()).optional(),
        amenityList: z.array(z.string()).optional(),
        priceIndicators: z.any().optional(),
        salesMessaging: z.array(z.string()).optional(),
        differentiationClaims: z.array(z.string()).optional(),
        completionStatus: z.enum(["announced", "under_construction", "completed", "sold_out"]).optional(),
        totalUnits: z.number().optional(),
        architect: z.string().optional(),
        interiorDesigner: z.string().optional(),
        sourceUrl: z.string().optional(),
        evidenceCitations: z.any().optional(),
        completenessScore: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCompetitorProject(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "competitor_project.update",
          entityType: "competitor_project",
          entityId: id,
        });
        return { success: true };
      }),

    deleteProject: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCompetitorProject(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "competitor_project.delete",
          entityType: "competitor_project",
          entityId: input.id,
        });
        return { success: true };
      }),

    // ─── Comparison View ──────────────────────────────────────────────────
    compare: protectedProcedure
      .input(z.object({ projectIds: z.array(z.number()).min(2).max(6) }))
      .query(async ({ input }) => {
        const projects: Awaited<ReturnType<typeof db.getCompetitorProjectById>>[] = [];
        for (const id of input.projectIds) {
          const p = await db.getCompetitorProjectById(id);
          if (p) projects.push(p);
        }
        // Build comparison matrix
        const dimensions = [
          "segment", "assetType", "completionStatus", "totalUnits",
          "positioningKeywords", "interiorStyleSignals", "materialCues",
          "amenityList", "differentiationClaims",
        ] as const;

        const validProjects = projects.filter((p): p is NonNullable<typeof p> => p != null);
        const matrix = dimensions.map(dim => ({
          dimension: dim,
          values: validProjects.map(p => ({
            projectId: p.id,
            projectName: p.projectName,
            value: (p as any)[dim],
          })),
        }));

        return { projects: validProjects, matrix };
      }),

    bulkImport: adminProcedure
      .input(z.object({
        competitorId: z.number(),
        projects: z.array(z.object({
          projectName: z.string(),
          location: z.string().optional(),
          segment: z.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury"]).optional(),
          assetType: z.enum(["residential", "commercial", "hospitality", "mixed_use"]).default("residential"),
          positioningKeywords: z.array(z.string()).optional(),
          interiorStyleSignals: z.array(z.string()).optional(),
          materialCues: z.array(z.string()).optional(),
          amenityList: z.array(z.string()).optional(),
          sourceUrl: z.string().optional(),
          evidenceCitations: z.any().optional(),
          completenessScore: z.number().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const runId = generateRunId("COMP");
        const startedAt = new Date();
        let imported = 0;

        for (const proj of input.projects) {
          await db.createCompetitorProject({
            ...proj,
            competitorId: input.competitorId,
            runId,
            createdBy: ctx.user.id,
          });
          imported++;
        }

        await db.createIntelligenceAuditEntry({
          runType: "competitor_extraction",
          runId,
          actor: ctx.user.id,
          inputSummary: { competitorId: input.competitorId, projectCount: input.projects.length },
          outputSummary: { imported },
          sourcesProcessed: input.projects.length,
          recordsExtracted: imported,
          errors: 0,
          startedAt,
          completedAt: new Date(),
        });

        return { imported, runId };
      }),
  }),

  // ─── Trend Tags ───────────────────────────────────────────────────────────

  tags: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.listTrendTags(input?.category);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        category: z.enum([
          "material_trend", "design_trend", "market_trend",
          "buyer_preference", "sustainability", "technology", "pricing", "other",
        ]),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createTrendTag({ ...input, createdBy: ctx.user.id });
        return result;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTrendTag(input.id);
        return { success: true };
      }),

    // ─── Entity Tagging ───────────────────────────────────────────────────
    attach: adminProcedure
      .input(z.object({
        tagId: z.number(),
        entityType: z.enum(["competitor_project", "scenario", "evidence_record", "project"]),
        entityId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createEntityTag({ ...input, addedBy: ctx.user.id });
        return result;
      }),

    detach: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEntityTag(input.id);
        return { success: true };
      }),

    getEntityTags: protectedProcedure
      .input(z.object({
        entityType: z.enum(["competitor_project", "scenario", "evidence_record", "project"]),
        entityId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getEntityTags(input.entityType, input.entityId);
      }),

    getTaggedEntities: protectedProcedure
      .input(z.object({ tagId: z.number() }))
      .query(async ({ input }) => {
        return db.getTaggedEntities(input.tagId);
      }),
  }),

  // ─── Intelligence Audit Log ───────────────────────────────────────────────

  auditLog: router({
    list: adminProcedure
      .input(z.object({
        runType: z.string().optional(),
        limit: z.number().default(50),
      }).optional())
      .query(async ({ input }) => {
        return db.listIntelligenceAuditLog(input?.runType, input?.limit ?? 50);
      }),

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getIntelligenceAuditEntryById(input.id);
      }),
  }),

  dataHealth: protectedProcedure.query(async () => {
    return await db.getDataHealthStats();
  }),
});

// ─── Default Source Registry Entries ─────────────────────────────────────────

function getDefaultSources() {
  return [
    {
      name: "RAK Ceramics UAE",
      url: "https://www.rakceramics.com",
      sourceType: "manufacturer_catalog" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Major UAE ceramic tile manufacturer — product catalogs with pricing",
    },
    {
      name: "DERA Interiors",
      url: "https://www.derainteriors.com",
      sourceType: "supplier_catalog" as const,
      reliabilityDefault: "B" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "UAE-based interior fit-out supplier",
    },
    {
      name: "Dragon Mart Dubai",
      url: "https://www.dragonmart.ae",
      sourceType: "retailer_listing" as const,
      reliabilityDefault: "B" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Large trading hub — wide range of building materials",
    },
    {
      name: "Porcelanosa UAE",
      url: "https://www.porcelanosa.com/ae",
      sourceType: "manufacturer_catalog" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Premium tile and bathroom manufacturer",
    },
    {
      name: "Emaar Properties",
      url: "https://www.emaar.com",
      sourceType: "developer_brochure" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Major UAE developer — project brochures and specifications",
    },
    {
      name: "DAMAC Properties",
      url: "https://www.damacproperties.com",
      sourceType: "developer_brochure" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Luxury developer — interior specifications and pricing signals",
    },
    {
      name: "Nakheel Properties",
      url: "https://www.nakheel.com",
      sourceType: "developer_brochure" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Major Dubai developer — community and project data",
    },
    {
      name: "RICS Market Reports",
      url: "https://www.rics.org",
      sourceType: "industry_report" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Royal Institution of Chartered Surveyors — construction cost data",
    },
    {
      name: "JLL MENA Research",
      url: "https://www.jll.com/mena",
      sourceType: "industry_report" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Real estate consultancy — market reports and cost indices",
    },
    {
      name: "Dubai Statistics Center",
      url: "https://www.dsc.gov.ae",
      sourceType: "government_tender" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Government statistics — construction indices and economic data",
    },
    {
      name: "Hafele UAE",
      url: "https://www.hafele.ae",
      sourceType: "manufacturer_catalog" as const,
      reliabilityDefault: "A" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Hardware and fittings manufacturer — product catalogs",
    },
    {
      name: "GEMS Building Materials",
      url: "https://www.gemsbm.com",
      sourceType: "supplier_catalog" as const,
      reliabilityDefault: "B" as const,
      isWhitelisted: true,
      region: "UAE",
      notes: "Building materials supplier — pricing and availability",
    },
  ];
}
