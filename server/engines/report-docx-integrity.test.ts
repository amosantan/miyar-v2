import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateDesignBriefDocx } from "./docx-brief";
import type { ClaimHealthSafeProjection } from "../../shared/claim-health";

const fallbackHealth = {
  claimState: "current_with_fallback",
  evaluatedAt: "2026-07-30T12:00:00.000Z",
  policyVersion: "ev04-claim-health-v1",
  policyManifestDigest: "sha256:ev04-policy-manifest",
  requiredCellSchemaVersion: "ev04-required-cell-v1",
  counts: { required: 2, eligible: 2, exact: 1, fallback: 1, optional: 0 },
  reasonCodes: ["approved_fallback"],
  cells: [],
} satisfies ClaimHealthSafeProjection;

describe("TR-10 design-brief DOCX integrity", () => {
  it("embeds one Arabic RTL identity and keeps hostile/formula-like text inert", async () => {
    const hostile = '<script>alert(1)</script> =HYPERLINK("javascript:alert(1)") abc\u202Etxt';
    const buffer = await generateDesignBriefDocx({
      locale: "ar",
      projectName: hostile,
      projectIdentity: { projectName: hostile, typology: hostile },
      designNarrative: { positioningStatement: hostile, primaryStyle: hostile },
      materialSpecifications: { approvedMaterials: [hostile] },
      boqFramework: {
        totalEstimatedSqm: 100,
        coreAllocations: [{ category: hostile, percentage: 25, estimatedCostLabel: hostile, notes: hostile }],
      },
      detailedBudget: { totalBudgetCap: hostile },
      spaceAllocation: {
        efficiencyScore: 80, totalArea: 1_000, roomCount: 1, circulationPct: 12,
        rooms: [{ name: "Dynamic Room", area: 400, pctOfTotal: 40, finishGrade: "A" }],
        recommendations: [{ roomType: "Dynamic Room", severity: "advisory", advice: hostile }],
      },
      designerInstructions: {
        phasedDeliverables: { conceptDesign: [hostile] },
        authorityApprovals: [hostile],
        coordinationRequirements: [hostile],
        procurementAndLogistics: { leadTimeWindow: hostile },
      },
      version: 2,
      renderContext: {
        documentId: "MYR-BRIEF-TEST",
        generatedAt: "2026-07-18T08:00:00.000Z",
        locale: "ar",
        artifactVersion: "artifact-v1",
        rendererVersion: "docx-v1",
        modelVersion: "model-v1",
        benchmarkVersion: "benchmark-v1",
        logicVersion: "logic-v1",
        renderInputFingerprint: "a".repeat(64),
      },
    });

    const tempDir = await mkdtemp(path.join(tmpdir(), "miyar-tr10-docx-"));
    const docxPath = path.join(tempDir, "brief.docx");
    try {
      await writeFile(docxPath, buffer);
      const documentXml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], { encoding: "utf8" });
      const stylesXml = execFileSync("unzip", ["-p", docxPath, "word/styles.xml"], { encoding: "utf8" });
      const footerXml = execFileSync("unzip", ["-p", docxPath, "word/footer1.xml"], { encoding: "utf8" });

      expect(documentXml).toContain("MYR-BRIEF-TEST");
      expect(documentXml).toContain("بصمة مدخلات العرض");
      expect(documentXml).toContain("إخلاء مسؤولية مهم");
      expect(documentXml).toContain("معرّف المستند");
      expect(documentXml).toContain("الإصدار 2");
      expect(documentXml).toContain("المواد المعتمدة (الأساسية):");
      expect(documentXml).toContain("توزيعات الميزانية الاسترشادية حسب الفئة:");
      expect(documentXml).toContain("تفصيل الغرف:");
      expect(documentXml).toContain("الغرفة");
      expect(documentXml).toContain("المساحة (قدم²)");
      expect(documentXml).toContain("% من الإجمالي");
      expect(documentXml).toContain("الدرجة");
      expect(documentXml).toContain("إرشادات النسب من MIYAR:");
      expect(documentXml).toContain("صحة الأدلة");
      expect(documentXml).toContain("قديم — لقطة صحة الأدلة غير متاحة");
      expect(documentXml).toContain(
        "حالة الأدلة غير متاحة ولم تتم إعادة تقييمها."
      );
      expect(footerXml).toContain("الصفحة");
      expect(documentXml).toContain("w:bidi");
      expect(documentXml).toContain("w:rtl");
      expect(documentXml).toContain("w:bidiVisual");
      expect(stylesXml).toContain("Noto Sans Arabic");
      expect(documentXml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(documentXml).not.toContain("<script>");
      expect(documentXml).not.toContain("w:instrText");
      expect(documentXml).not.toContain("Material Board Annex");
      for (const untranslated of [
        "Document ID:",
        "Version 2",
        "Approved Materials (Primary):",
        "Indicative Budget Allocations per Category:",
        "Room Breakdown:",
        "Area (sqft)",
        "% of Total",
        "MIYAR Ratio Guidance:",
        "Legacy — health snapshot unavailable",
      ]) {
        expect(documentXml).not.toContain(untranslated);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("renders safe English fallback and Arabic current claim-health sections", async () => {
    const base = {
      projectName: "Claim health brief",
      projectIdentity: { projectName: "Claim health brief" },
      designNarrative: {},
      materialSpecifications: {},
      boqFramework: { totalEstimatedSqm: null, coreAllocations: [] },
      detailedBudget: {},
      designerInstructions: {
        phasedDeliverables: {},
        authorityApprovals: [],
        coordinationRequirements: [],
        procurementAndLogistics: {},
      },
      version: 1,
    };
    const healthWithUnsafeExtras = {
      ...fallbackHealth,
      runId: "PRIVATE-RUN-ID",
      rawError: "PRIVATE-RAW-ERROR",
    } as ClaimHealthSafeProjection;
    const english = await generateDesignBriefDocx({
      ...base,
      locale: "en",
      claimHealth: healthWithUnsafeExtras,
    });
    const arabic = await generateDesignBriefDocx({
      ...base,
      locale: "ar",
      claimHealth: {
        ...fallbackHealth,
        claimState: "current",
        counts: { ...fallbackHealth.counts, exact: 2, fallback: 0 },
        reasonCodes: [],
      },
    });

    const tempDir = await mkdtemp(path.join(tmpdir(), "miyar-ev04-docx-"));
    try {
      const englishPath = path.join(tempDir, "english.docx");
      const arabicPath = path.join(tempDir, "arabic.docx");
      await writeFile(englishPath, english);
      await writeFile(arabicPath, arabic);
      const englishXml = execFileSync(
        "unzip",
        ["-p", englishPath, "word/document.xml"],
        { encoding: "utf8" }
      );
      const arabicXml = execFileSync(
        "unzip",
        ["-p", arabicPath, "word/document.xml"],
        { encoding: "utf8" }
      );

      expect(englishXml).toContain("Evidence Health");
      expect(englishXml).toContain("Current with approved fallback");
      expect(englishXml).toContain("2/2");
      expect(englishXml).toContain("ev04-claim-health-v1");
      expect(englishXml).toContain("not a live recomputation");
      expect(englishXml).not.toContain("PRIVATE-RUN-ID");
      expect(englishXml).not.toContain("PRIVATE-RAW-ERROR");

      for (const arabicCopy of [
        "صحة الأدلة",
        "الحالة",
        "حالي",
        "التغطية المؤهلة",
        "الخلايا المطلوبة",
        "المطابقات الدقيقة",
        "البدائل المعتمدة",
        "إصدار السياسة",
        "إصدار مخطط الخلايا",
        "ليست إعادة تقييم مباشرة",
      ]) {
        expect(arabicXml).toContain(arabicCopy);
      }
      expect(arabicXml).not.toContain("Current with approved fallback");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
