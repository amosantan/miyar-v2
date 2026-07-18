import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateDesignBriefDocx } from "./docx-brief";

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
      ]) {
        expect(documentXml).not.toContain(untranslated);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
