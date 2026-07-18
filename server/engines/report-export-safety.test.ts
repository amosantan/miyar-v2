import { describe, expect, it } from "vitest";
import { computeBoardSummary, generateRfqLines } from "./board-composer";
import { generateBoardPdfHtml } from "./board-pdf";
import { buildBoardAnnexData } from "./board-annex";
import { generateInvestorPdfHtml, type InvestorPdfInput } from "./investor-pdf";
import { generateAutonomousBriefHTML, generateDesignBriefHTML, generateFullReportHTML, generatePortfolioReportHTML, generateScenarioComparisonHTML, generateValidationSummaryHTML } from "./pdf-report";

const hostile = `<img src=x onerror=alert(1)>`;

describe("TR-10 standalone export safety and render context", () => {
  it("renders a localized, escaped material-board artifact with one identity block", () => {
    const items = [{
      materialId: 1, name: hostile, category: "stone", tier: "luxury", costLow: 450, costHigh: 800,
      costUnit: "AED/sqm", leadTimeDays: 120, leadTimeBand: "critical", supplierName: "Supplier",
      specNotes: hostile, quantity: "10", unitOfMeasure: "sqm", notes: hostile,
    }];
    const html = generateBoardPdfHtml({
      boardName: hostile, projectName: hostile, items,
      summary: computeBoardSummary(items), rfqLines: generateRfqLines(items), locale: "ar",
      documentId: "MYR-BRD-TEST", generatedAt: "2026-07-18T08:00:00.000Z",
      artifactVersion: "artifact-v1", rendererVersion: "renderer-v1", modelVersion: "model-v1", benchmarkVersion: "benchmark-v1", logicVersion: "logic-v1",
    });

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("معرّف المستند");
    expect(html).toContain("MYR-BRD-TEST");
    expect(html).toContain("بصمة مدخلات العرض");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("Material Board Annex");
  });

  it("renders the investor fallback disclosure without changing its inputs", () => {
    const secretShareToken = "SENTINEL-INVESTOR-SHARE-TOKEN-DO-NOT-EXPORT";
    const investorInput: InvestorPdfInput = {
      projectName: hostile, typology: "Residential", location: "Dubai", tier: "Luxury", style: "Modern", gfaSqm: 1_000,
      execSummary: hostile, designDirection: { narrative: hostile }, spaces: [{ name: hostile, budgetAed: 1_000_000, sqm: 20, pct: 25 }],
      materials: [{ name: hostile, brand: hostile, room: hostile, price: hostile }],
      materialConstants: [{ materialType: hostile, costPerM2: 500, carbonIntensity: 25, sustainabilityGrade: "B" }],
      totalFitoutBudget: 1_000_000, costPerSqm: 1_000, sustainabilityGrade: "B", salePremiumPct: 18, estimatedSalesPremiumAed: 4_500_000,
      designTrends: [{ trendName: hostile, confidenceLevel: "established", trendCategory: hostile }],
      locale: "en", documentId: "MYR-INV-TEST", generatedAt: "2026-07-18T08:00:00.000Z",
      artifactVersion: "artifact-v1", rendererVersion: "renderer-v1",
    };
    const html = generateInvestorPdfHtml(investorInput);
    const htmlWithUnexpectedToken = generateInvestorPdfHtml({
      ...investorInput,
      shareToken: secretShareToken,
    } as InvestorPdfInput);
    const fingerprint = html.match(/\b[a-f0-9]{64}\b/)?.[0];
    const fingerprintWithUnexpectedToken = htmlWithUnexpectedToken.match(/\b[a-f0-9]{64}\b/)?.[0];

    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("MYR-INV-TEST");
    expect(html).toContain("Render-input fingerprint");
    expect(html).toContain("Ungoverned MIYAR fallback assumption");
    expect(html).toContain("AED 25,000 per m² baseline");
    expect(html).toContain("hardcoded MIYAR tier mappings");
    expect(html).toContain("unconditionally, regardless of available project evidence");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("Material Board Annex");
    expect(html).not.toContain("onclick=");
    expect(htmlWithUnexpectedToken).not.toContain(secretShareToken);
    expect(fingerprintWithUnexpectedToken).toBe(fingerprint);
  });

  it("uses the governed Arabic investor labels while preserving dynamic values", () => {
    const html = generateInvestorPdfHtml({
      projectName: "Investor Arabic", typology: "Residential", location: "Dubai", tier: "Luxury", style: "Modern", gfaSqm: 1_000,
      execSummary: "", designDirection: { direction: "Modern", content: "Warm stone" }, spaces: [], materials: [],
      materialConstants: [], totalFitoutBudget: 1_000_000, costPerSqm: 1_000, sustainabilityGrade: "B", salePremiumPct: 18, estimatedSalesPremiumAed: 4_500_000,
      designTrends: [{ trendName: "Trend", confidenceLevel: "established", trendCategory: "Category" }],
      spaceEfficiency: { efficiencyScore: 80, criticalCount: 0, advisoryCount: 1, circulationPct: 12, rooms: [{ name: "Living", currentPct: 20, benchmarkPct: 18, severity: "advisory" }] },
      locale: "ar", documentId: "MYR-INV-AR", generatedAt: "2026-07-18T08:00:00.000Z",
    });

    expect(html).toContain("نوع المشروع");
    expect(html).toContain("الأسلوب");
    expect(html).toContain("الشريحة");
    expect(html).toContain("الموقع");
    expect(html).toContain("استناداً إلى اختيار المواد والشريحة في");
    expect(html).toContain("زيادة مقارنة بالتجهيز الداخلي القياسي");
    expect(html).toContain("اتجاهات التصميم في الإمارات");
    expect(html).toContain("تعيينات شرائح MIYAR مُشفّرة مسبقاً");
    expect(html).toContain("دون قيد، بصرف النظر عن توفر أدلة المشروع");
    expect(html).toContain("التوجه");
    expect(html).toContain("المحتوى");
    expect(html).toContain('<span dir="auto" data-report-dynamic>Dubai</span>');
    for (const untranslated of ["Typology", "Style", "Tier", "Location", "Direction", "Content", "uplift vs. standard fit-out", "UAE Design Trends", ">vs "]) {
      expect(html).not.toContain(untranslated);
    }
  });

  it("keeps hostile project, evidence, action, and autonomous Markdown inert", () => {
    const base = {
      projectName: hostile,
      projectId: 7,
      inputs: {} as any,
      scoreResult: {
        dimensions: { sa: 70, ff: 65, mp: 72, ds: 68, er: 60 },
        dimensionWeights: { sa: 0.25, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.15 },
        compositeScore: 67.5, riskScore: 25, rasScore: 72, confidenceScore: 80,
        decisionStatus: "conditional" as const,
        penalties: [{ id: hostile, description: hostile, effect: -2 }],
        riskFlags: [hostile],
        conditionalActions: [{ trigger: hostile, recommendation: hostile, variables: [hostile] }],
        variableContributions: {}, inputSnapshot: {},
      },
      sensitivity: [{ variable: hostile, sensitivity: 1, scoreUp: 68, scoreDown: 66 }],
      evidenceRefs: [{
        title: hostile,
        sourceUrl: "javascript:alert(1)",
        category: hostile,
        reliabilityGrade: "A",
        confidenceStatus: "legacy_unknown" as const,
      }],
      locale: "ar" as const,
      modelVersion: "model-v1",
      benchmarkVersion: "benchmark-v1",
      logicVersion: "logic-v1",
    };

    const validation = generateValidationSummaryHTML(base);
    const autonomous = generateAutonomousBriefHTML({
      ...base,
      autonomousContent: `# Safe\n${hostile}\n[click](javascript:alert(1))\nabc\u202Etxt`,
    });

    for (const html of [validation, autonomous]) {
      expect(html).toContain('<html lang="ar" dir="rtl">');
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain('href="javascript:');
      expect(html).not.toContain("\u202E");
      expect(html.includes("Render-input fingerprint") || html.includes("بصمة مدخلات العرض")).toBe(true);
    }

    expect(validation).toContain("تم التحقق بشروط");
    expect(validation).toContain("تفصيل درجات الأبعاد");
    expect(validation).toContain("ملخص مدخلات المشروع");
    for (const untranslated of [
      "CONDITIONALLY VALIDATED",
      "Dimension Score Breakdown",
      "Project Input Summary",
    ]) {
      expect(validation).not.toContain(untranslated);
    }

    const dynamicLabel = generateValidationSummaryHTML({ ...base, projectName: "Typology" });
    expect(dynamicLabel).toContain('<bdi dir="auto" data-report-dynamic>Typology</bdi>');
  });

  it("renders governed Arabic full-report labels without translating dynamic board content", () => {
    const boardAnnex = buildBoardAnnexData([{
      boardName: "Dynamic Board", linkedItemCount: 1,
      resolvedItems: [{ materialId: 1, name: "Dynamic Stone", category: "stone", tier: "luxury", costLow: 1_000, costHigh: 2_500, costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "critical", supplierName: "Supplier" }],
    }]);
    const html = generateFullReportHTML({
      projectName: "Arabic Report", projectId: 12, inputs: {} as any,
      scoreResult: {
        dimensions: { sa: 70, ff: 65, mp: 72, ds: 68, er: 60 }, dimensionWeights: { sa: 0.25, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.15 },
        compositeScore: 67.5, riskScore: 25, rasScore: 72, confidenceScore: 80, decisionStatus: "conditional", penalties: [], riskFlags: [], conditionalActions: [{ trigger: "Dynamic trigger", recommendation: "Dynamic recommendation", variables: ["Dynamic variable"] }], variableContributions: {}, inputSnapshot: {},
      },
      sensitivity: [{ variable: "Dynamic variable", sensitivity: 1, scoreUp: 68, scoreDown: 66 }],
      roi: { reworkAvoided: 10, procurementSavings: 20, timeValueGain: 30, specEfficiency: 40, positioningPremium: 50, totalValue: 150, fee: 15, netROI: 135, roiMultiple: 2 },
      evidenceRefs: [{ title: "Dynamic evidence", category: "Market", reliabilityGrade: "A", confidenceStatus: "computed", sourceUrl: "https://example.com/evidence" }],
      boardAnnex, locale: "ar", documentId: "MYR-FULL-AR", generatedAt: "2026-07-18T08:00:00.000Z",
    });

    for (const translated of ["أعلى 1 متغيرات مرتبة", "المبلغ (درهم)", "لوحة مكتملة — تم حل العنصر المرتبط.", "تشير الاستشهادات المضمنة", "ملحق لوحة المواد", "تم تحديد 1 إجراء/إجراءات مشروطة:", "المحفز:", "التوصية:", "المتغيرات:", "المرجع", "العنوان", "مصدر الثقة", "الدرجة A = مصدر مؤسسي أولي", "[رابط]"]) {
      expect(html).toContain(translated);
    }
    expect(html).toContain('<bdi dir="auto" data-report-dynamic>Dynamic Board</bdi>');
    for (const untranslated of ["variables ranked by impact on composite score", "Amount (AED)", "the linked item is resolved", "Inline citations", "conditional action(s) identified", "Confidence provenance", "Grade A = Primary institutional source", ">[link]<", ">Ref<", ">Title<"]) {
      expect(html).not.toContain(untranslated);
    }
  });

  it("discloses the unchanged ROI narrative fallback denominator in English and Arabic", () => {
    const base = {
      projectName: "ROI Disclosure", projectId: 13, inputs: {} as any,
      scoreResult: {
        dimensions: { sa: 70, ff: 65, mp: 72, ds: 68, er: 60 }, dimensionWeights: { sa: 0.25, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.15 },
        compositeScore: 67.5, riskScore: 25, rasScore: 72, confidenceScore: 80, decisionStatus: "conditional" as const, penalties: [], riskFlags: [], conditionalActions: [], variableContributions: {}, inputSnapshot: {},
      },
      sensitivity: [], boardAnnex: buildBoardAnnexData([]), roiNarrative: { totalCostAvoided: { mid: 300_000 }, drivers: [] },
      documentId: "MYR-ROI-DISCLOSURE", generatedAt: "2026-07-18T08:00:00.000Z",
    };
    const english = generateFullReportHTML({ ...base, locale: "en" });
    const arabic = generateFullReportHTML({ ...base, locale: "ar" });

    expect(english).toContain("ROI Multiple: 2.0x");
    expect(english).toContain("ungoverned MIYAR fallback denominator of AED 150,000");
    expect(english).toContain("not a market valuation or investment recommendation");
    expect(arabic).toContain("مقام احتياطي غير محكوم من MIYAR قدره 150,000 درهم");
    expect(arabic).toContain("لا يمثل تقييماً سوقياً أو توصية استثمارية");
    expect(arabic).toContain("2.0x");
  });

  it("removes the final Arabic visual-QA denylist without translating dynamic names", () => {
    const report = {
      projectName: "Dynamic Project", projectId: 14, inputs: {} as any,
      scoreResult: { dimensions: { sa: 70, ff: 65, mp: 72, ds: 68, er: 60 }, dimensionWeights: { sa: .25, ff: .2, mp: .2, ds: .2, er: .15 }, compositeScore: 67.5, riskScore: 25, rasScore: 72, confidenceScore: 80, decisionStatus: "conditional" as const, penalties: [], riskFlags: [], conditionalActions: [], variableContributions: {}, inputSnapshot: {} },
      sensitivity: [], boardAnnex: buildBoardAnnexData([]), locale: "ar" as const,
    };
    const brief = generateDesignBriefHTML({ ...report, designBrief: { designNarrative: {}, materialSpecifications: { finishesAndTextures: [] }, boqFramework: { coreAllocations: [] }, detailedBudget: {}, designerInstructions: { phasedDeliverables: {} } } } as any);
    const autonomous = generateAutonomousBriefHTML({ ...report, autonomousContent: "# Dynamic" });
    const scenario = generateScenarioComparisonHTML({ projectName: "Baseline", projectId: 14, baselineScenario: { id: 1, name: "Baseline", scores: { compositeScore: 60 }, roi: null }, comparedScenarios: [{ id: 2, name: "Alternative", scores: { compositeScore: 70 }, roi: null, deltas: { compositeScore: 1 } }], locale: "ar" });
    const portfolio = generatePortfolioReportHTML({ portfolioName: "Dynamic Portfolio", portfolioId: 9, totalProjects: 1, scoredCount: 1, avgComposite: 70, avgRisk: 30, projects: [{ name: "Dynamic Project", tier: "Luxury", style: "Modern", compositeScore: 70, riskScore: 30, decisionStatus: "conditional" }], distributions: [], failurePatterns: [], improvementLevers: [], complianceHeatmap: [], locale: "ar" });

    for (const html of [brief, autonomous, scenario, portfolio]) expect(html).toContain('lang="ar" dir="rtl"');
    for (const untranslated of ["Technical Specification &amp; Execution Workflows", "Design Narrative &amp; Positioning", "Approved Finishes &amp; Textures", "Workflow &amp; Execution Instructions", "AI-Generated Concept &amp; Technical Specification", " points", "TOTAL PROJECTS", "Generated by MIYAR Decision Intelligence", "Portfolio ID", "projects analyzed"]) {
      expect(`${brief}${autonomous}${scenario}${portfolio}`).not.toContain(untranslated);
    }
    expect(brief).toContain("المرحلة 1 — المفهوم والتصميم التخطيطي");
    expect(scenario).toContain("1.0 نقطة");
    expect(portfolio).toContain("إجمالي المشاريع");
    expect(portfolio).toContain("مشروط");
    expect(portfolio).toContain('<bdi dir="auto" data-report-dynamic>Dynamic Project</bdi>');
  });
});
