/**
 * MIYAR Design Brief DOCX Generator
 * Generates a structured Word document from the 6-section design brief data.
 */
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import type { ReportLocale } from "../../shared/report-locale";
import { formatReportDate, reportCopy } from "./report-catalog";
import {
  createRenderFingerprintPayload,
  createReportRenderContext,
  type ReportRenderContext,
} from "./report-render-context";

export interface DesignBriefData {
  projectIdentity: Record<string, unknown>;
  designNarrative: Record<string, unknown>;
  materialSpecifications: Record<string, unknown>;
  boqFramework: {
    totalEstimatedSqm: number | null;
    coreAllocations: {
      category: string;
      percentage: number;
      estimatedCostLabel: string;
      notes: string;
    }[];
  };
  detailedBudget: Record<string, unknown>;
  designerInstructions: {
    phasedDeliverables: Record<string, string[]>;
    authorityApprovals: string[];
    coordinationRequirements: string[];
    procurementAndLogistics: Record<string, unknown>;
  };
  spaceAllocation?: {
    efficiencyScore: number;
    totalArea: number;
    roomCount: number;
    circulationPct: number;
    rooms: { name: string; area: number; pctOfTotal: number; finishGrade: string }[];
    recommendations: { roomType: string; severity: string; advice: string }[];
  };
  version: number;
  projectName?: string;
  locale?: ReportLocale;
  modelVersion?: string;
  benchmarkVersion?: string;
  logicVersion?: string;
  renderContext?: ReportRenderContext;
}

export interface DesignBriefRenderContextOverrides {
  documentId?: string;
  generatedAt?: Date | string;
  artifactVersion?: string;
  rendererVersion?: string;
  modelVersion?: string | null;
  benchmarkVersion?: string | null;
  logicVersion?: string | null;
}

const DOCX_AR_COPY: Record<string, string> = {
  "MIYAR Design Instruction Brief": "موجز تعليمات التصميم من MIYAR",
  "Project Identity": "هوية المشروع",
  "Design Narrative": "السرد التصميمي",
  "Material Specifications": "مواصفات المواد",
  "Target BOQ Framework": "إطار جدول الكميات المستهدف",
  "Detailed Budget Guardrails": "ضوابط الميزانية التفصيلية",
  "Space Allocation Analysis": "تحليل توزيع المساحات",
  "Workflow & Execution Instructions": "تعليمات سير العمل والتنفيذ",
  "Phased Deliverables": "المخرجات المرحلية",
  "Project Name": "اسم المشروع", Typology: "نوع المشروع", Scale: "الحجم", GFA: "المساحة الإجمالية",
  Location: "الموقع", "Delivery Horizon": "أفق التسليم", "Market Tier": "الشريحة السوقية", "Design Style": "أسلوب التصميم",
  "Primary Style": "الأسلوب الأساسي", "Mood Keywords": "كلمات الأجواء", "Color Palette": "لوحة الألوان",
  "Texture Direction": "توجه الملمس", "Lighting Approach": "نهج الإضاءة", "Spatial Philosophy": "الفلسفة المكانية",
  "Target Tier Requirement": "متطلب الشريحة المستهدفة", "Quality Benchmark": "معيار الجودة", "Sustainability Mandate": "متطلب الاستدامة",
  "Total Estimated Project Area": "إجمالي مساحة المشروع التقديرية", "Cost Per Sqm Target": "التكلفة المستهدفة لكل م²",
  "Total Budget Cap": "الحد الأعلى للميزانية", "Cost Band": "نطاق التكلفة", "Contingency Recommendation": "توصية الاحتياطي",
  "Budget Flexibility Level": "مستوى مرونة الميزانية", "Lead Time Window": "نافذة المهلة الزمنية",
  Parameter: "المعيار", Value: "القيمة", Category: "الفئة", Allocation: "التخصيص", "Estimated Budget": "الميزانية التقديرية", Notes: "ملاحظات",
  "Overall Efficiency Score": "درجة الكفاءة الإجمالية", "Total Analysed Area": "إجمالي المساحة المحللة", "Room Count": "عدد الغرف",
  "Circulation Percentage": "نسبة الحركة", "No positioning statement generated.": "لم يتم إنشاء بيان للتموضع.",
  "No BOQ framework generated.": "لم يتم إنشاء إطار لجدول الكميات.",
  "Approved Materials (Primary):": "المواد المعتمدة (الأساسية):", "Approved Finishes & Textures:": "التشطيبات والملامس المعتمدة:",
  "Prohibited Materials (Value Engineering Flags):": "المواد المحظورة (تنبيهات هندسة القيمة):",
  "Indicative Budget Allocations per Category:": "توزيعات الميزانية الاسترشادية حسب الفئة:", "Value Engineering Directives:": "توجيهات هندسة القيمة:",
  "Document ID": "معرّف المستند", "Page": "الصفحة", Version: "الإصدار", "MIYAR Interior Design Instruction": "تعليمات التصميم الداخلي من MIYAR",
  "Room Breakdown:": "تفصيل الغرف:", "MIYAR Ratio Guidance:": "إرشادات النسب من MIYAR:",
  Room: "الغرفة", "Area (sqft)": "المساحة (قدم²)", "% of Total": "% من الإجمالي", Grade: "الدرجة",
  "Critical Path Procurement Items:": "عناصر الشراء على المسار الحرج:", "Import Logistics Dependencies:": "اعتماديات لوجستيات الاستيراد:",
  "Local Authority Approvals (Dubai):": "اعتمادات الجهات المحلية (دبي):", "Contractor Coordination Requirements:": "متطلبات التنسيق مع المقاول:",
  "Phase 1 — Concept & Schematic": "المرحلة 1 — المفهوم والتصميم التخطيطي", "Phase 2 — Detailed Design": "المرحلة 2 — التصميم التفصيلي",
  "Phase 3 — IFC & Tender": "المرحلة 3 — مخططات التنفيذ والمناقصة",
};

function docxFixed(text: string, rtl: boolean): string {
  if (!rtl) return text;
  const numbered = /^(\d+\.\s+)(.+)$/.exec(text);
  if (numbered) return `${numbered[1]}${DOCX_AR_COPY[numbered[2]] ?? numbered[2]}`;
  return DOCX_AR_COPY[text] ?? text;
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1, rtl = false): Paragraph {
  return new Paragraph({ heading: level, bidirectional: rtl, children: [new TextRun({ text: docxFixed(text, rtl), bold: true, rightToLeft: rtl })] });
}

function bodyText(text: string, rtl = false): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    spacing: { after: 120 },
    children: [new TextRun({ text: docxFixed(text, rtl), size: 22, rightToLeft: rtl })],
  });
}

function bulletItem(text: string, rtl = false): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, rightToLeft: rtl })],
  });
}

function labelValue(label: string, value: string, rtl = false): Paragraph {
  return new Paragraph({
    bidirectional: rtl,
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${docxFixed(label, rtl)}: `, bold: true, size: 22, rightToLeft: rtl }),
      new TextRun({ text: value, size: 22, rightToLeft: rtl }),
    ],
  });
}

function spacer(rtl = false): Paragraph {
  return new Paragraph({ bidirectional: rtl, spacing: { after: 200 }, children: [] });
}

function twoColumnTable(rows: [string, string][], rtl = false): Table {
  return new Table({
    visuallyRightToLeft: rtl,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Parameter", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Value", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })],
          }),
        ],
      }),
      ...rows.map(
        ([k, v], i) =>
          new TableRow({
            children: [
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed(k, rtl), size: 20, rightToLeft: rtl })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: v, size: 20, rightToLeft: rtl })] })],
              }),
            ],
          })
      ),
    ],
  });
}

function boqTable(allocations: { category: string; percentage: number; estimatedCostLabel: string; notes: string }[], rtl = false): Table {
  return new Table({
    visuallyRightToLeft: rtl,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Category", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Allocation", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Estimated Budget", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Notes", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })],
          }),
        ],
      }),
      ...allocations.map(
        (alloc, i) =>
          new TableRow({
            children: [
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: alloc.category, size: 20, rightToLeft: rtl })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: `${alloc.percentage}%`, size: 20, rightToLeft: rtl })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: alloc.estimatedCostLabel, size: 20, rightToLeft: rtl })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: alloc.notes, size: 20, rightToLeft: rtl })] })],
              }),
            ],
          })
      ),
    ],
  });
}

/** Builds the DOCX context from the exact fields written into the document. */
export function createDesignBriefDocxRenderContext(
  data: DesignBriefData,
  overrides: DesignBriefRenderContextOverrides = {},
): ReportRenderContext {
  const locale = data.locale ?? "en";
  const identity = data.projectIdentity ?? {};
  const narrative = data.designNarrative ?? {};
  const materials = data.materialSpecifications ?? {};
  const boq = data.boqFramework ?? { totalEstimatedSqm: null, coreAllocations: [] };
  const budget = data.detailedBudget ?? {};
  const instructions = data.designerInstructions ?? { phasedDeliverables: {}, authorityApprovals: [], coordinationRequirements: [], procurementAndLogistics: {} };
  const labels = {
    artifactVersion: overrides.artifactVersion ?? "tr10-report-artifact-v1",
    rendererVersion: overrides.rendererVersion ?? "docx-brief-v2",
    modelVersion: overrides.modelVersion ?? data.modelVersion ?? null,
    benchmarkVersion: overrides.benchmarkVersion ?? data.benchmarkVersion ?? null,
    logicVersion: overrides.logicVersion ?? data.logicVersion ?? null,
  };
  const pick = (value: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
  return createReportRenderContext({
    documentId: overrides.documentId,
    generatedAt: overrides.generatedAt,
    locale,
    ...labels,
    fingerprintInput: createRenderFingerprintPayload("design_brief_docx", locale, labels, {
      version: data.version,
      projectName: data.projectName ?? identity.projectName ?? "MIYAR Project",
      projectIdentity: pick(identity, ["projectName", "typology", "scale", "gfa", "location", "horizon", "marketTier", "style"]),
      designNarrative: pick(narrative, ["positioningStatement", "primaryStyle", "moodKeywords", "colorPalette", "textureDirection", "lightingApproach", "spatialPhilosophy"]),
      materialSpecifications: pick(materials, ["tierRequirement", "qualityBenchmark", "sustainabilityMandate", "approvedMaterials", "finishesAndTextures", "prohibitedMaterials"]),
      boqFramework: { totalEstimatedSqm: boq.totalEstimatedSqm, coreAllocations: boq.coreAllocations },
      detailedBudget: pick(budget, ["costPerSqmTarget", "totalBudgetCap", "costBand", "contingencyRecommendation", "flexibilityLevel", "valueEngineeringMandates"]),
      designerInstructions: {
        phasedDeliverables: instructions.phasedDeliverables,
        authorityApprovals: instructions.authorityApprovals,
        coordinationRequirements: instructions.coordinationRequirements,
        procurementAndLogistics: pick(instructions.procurementAndLogistics ?? {}, ["leadTimeWindow", "criticalPathItems", "importDependencies"]),
      },
      spaceAllocation: data.spaceAllocation ? {
        efficiencyScore: data.spaceAllocation.efficiencyScore,
        totalArea: data.spaceAllocation.totalArea,
        roomCount: data.spaceAllocation.roomCount,
        circulationPct: data.spaceAllocation.circulationPct,
        rooms: data.spaceAllocation.rooms,
        recommendations: data.spaceAllocation.recommendations,
      } : null,
    }),
  });
}

export async function generateDesignBriefDocx(data: DesignBriefData): Promise<Buffer> {
  const locale = data.locale ?? "en";
  const rtl = locale === "ar";
  const identity = (data.projectIdentity ?? {}) as Record<string, any>;
  const narrative = (data.designNarrative ?? {}) as Record<string, any>;
  const materials = (data.materialSpecifications ?? {}) as Record<string, any>;
  const boq = data.boqFramework ?? { totalEstimatedSqm: null, coreAllocations: [] };
  const budget = (data.detailedBudget ?? {}) as Record<string, any>;
  const instructions = data.designerInstructions ?? { phasedDeliverables: {}, authorityApprovals: [], coordinationRequirements: [], procurementAndLogistics: {} };

  const projectName = String(data.projectName ?? identity.projectName ?? "MIYAR Project");
  const context = data.renderContext ?? createDesignBriefDocxRenderContext(data);
  const watermark = context.documentId;

  const sections: (Paragraph | Table)[] = [];

  // ─── Title Page ──────────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: rtl,
      spacing: { before: 3000, after: 400 },
      children: [new TextRun({ text: docxFixed("MIYAR Design Instruction Brief", rtl), size: 56, bold: true, color: "1a3a4a", rightToLeft: rtl })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: rtl,
      spacing: { after: 200 },
      children: [new TextRun({ text: projectName, size: 36, color: "4ecdc4" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: rtl,
      spacing: { after: 200 },
      children: [new TextRun({ text: `${docxFixed("Version", rtl)} ${data.version} — ${formatReportDate(context.generatedAt, locale)}`, size: 22, color: "666666", rightToLeft: rtl })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: rtl,
      spacing: { after: 400 },
      children: [new TextRun({ text: `${docxFixed("Document ID", rtl)}: ${watermark}`, size: 18, color: "999999", rightToLeft: rtl })],
    }),
    spacer(rtl)
  );

  // ─── Section 1: Project Identity ──────────────────────────────────────────
  sections.push(heading("1. Project Identity", HeadingLevel.HEADING_1, rtl));
  sections.push(
    twoColumnTable([
      ["Project Name", identity.projectName ?? "—"],
      ["Typology", identity.typology ?? "—"],
      ["Scale", identity.scale ?? "—"],
      ["GFA", identity.gfa ? `${Number(identity.gfa).toLocaleString()} sqm` : "—"],
      ["Location", identity.location ?? "—"],
      ["Delivery Horizon", identity.horizon ?? "—"],
      ["Market Tier", identity.marketTier ?? "—"],
      ["Design Style", identity.style ?? "—"],
    ], rtl)
  );
  sections.push(spacer(rtl));
  sections.push(
    labelValue(reportCopy(locale, "documentId"), context.documentId, rtl),
    labelValue(reportCopy(locale, "generatedAt"), context.generatedAt, rtl),
    labelValue(reportCopy(locale, "artifactVersion"), context.artifactVersion, rtl),
    labelValue(reportCopy(locale, "rendererVersion"), context.rendererVersion, rtl),
    labelValue(reportCopy(locale, "modelVersion"), context.modelVersion ?? reportCopy(locale, "notAvailable"), rtl),
    labelValue(reportCopy(locale, "benchmarkVersion"), context.benchmarkVersion ?? reportCopy(locale, "notAvailable"), rtl),
    labelValue(reportCopy(locale, "logicVersion"), context.logicVersion ?? reportCopy(locale, "notAvailable"), rtl),
    labelValue(reportCopy(locale, "renderInputFingerprint"), context.renderInputFingerprint, rtl),
    bodyText(reportCopy(locale, "renderInputFingerprintHelp"), rtl),
    spacer(rtl),
  );

  // ─── Section 2: Design Narrative ─────────────────────────────────────────
  sections.push(heading("2. Design Narrative", HeadingLevel.HEADING_1, rtl));
  sections.push(bodyText(narrative.positioningStatement ?? "No positioning statement generated.", rtl));
  sections.push(labelValue("Primary Style", narrative.primaryStyle ?? "—", rtl));

  if (Array.isArray(narrative.moodKeywords) && narrative.moodKeywords.length > 0) {
    sections.push(labelValue("Mood Keywords", narrative.moodKeywords.join(", "), rtl));
  }
  if (Array.isArray(narrative.colorPalette) && narrative.colorPalette.length > 0) {
    sections.push(labelValue("Color Palette", narrative.colorPalette.join(", "), rtl));
  }

  sections.push(labelValue("Texture Direction", narrative.textureDirection ?? "—", rtl));
  sections.push(labelValue("Lighting Approach", narrative.lightingApproach ?? "—", rtl));
  sections.push(labelValue("Spatial Philosophy", narrative.spatialPhilosophy ?? "—", rtl));
  sections.push(spacer(rtl));

  // ─── Section 3: Material Specifications ──────────────────────────────────
  sections.push(heading("3. Material Specifications", HeadingLevel.HEADING_1, rtl));
  sections.push(labelValue("Target Tier Requirement", materials.tierRequirement ?? "—", rtl));
  sections.push(labelValue("Quality Benchmark", materials.qualityBenchmark ?? "—", rtl));
  sections.push(labelValue("Sustainability Mandate", materials.sustainabilityMandate ?? "—", rtl));

  if (Array.isArray(materials.approvedMaterials) && materials.approvedMaterials.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Approved Materials (Primary):", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const m of materials.approvedMaterials) {
      sections.push(bulletItem(m, rtl));
    }
  }

  if (Array.isArray(materials.finishesAndTextures) && materials.finishesAndTextures.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Approved Finishes & Textures:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const m of materials.finishesAndTextures) {
      sections.push(bulletItem(m, rtl));
    }
  }

  if (Array.isArray(materials.prohibitedMaterials) && materials.prohibitedMaterials.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Prohibited Materials (Value Engineering Flags):", rtl), bold: true, size: 22, color: "c62828", rightToLeft: rtl })] }));
    for (const m of materials.prohibitedMaterials) {
      sections.push(bulletItem(m, rtl));
    }
  }
  sections.push(spacer(rtl));

  // ─── Section 4: Target BOQ Framework ─────────────────────────────────────
  sections.push(heading("4. Target BOQ Framework", HeadingLevel.HEADING_1, rtl));
  if (boq.totalEstimatedSqm) {
    sections.push(labelValue("Total Estimated Project Area", `${boq.totalEstimatedSqm.toLocaleString()} Sqm`, rtl));
  }
  if (Array.isArray(boq.coreAllocations) && boq.coreAllocations.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { after: 120 }, children: [new TextRun({ text: docxFixed("Indicative Budget Allocations per Category:", rtl), size: 22, rightToLeft: rtl })] }));
    sections.push(boqTable(boq.coreAllocations, rtl));
  } else {
    sections.push(bodyText("No BOQ framework generated.", rtl));
  }
  sections.push(spacer(rtl));

  // ─── Section 5: Detailed Budget Guardrails ───────────────────────────────
  sections.push(heading("5. Detailed Budget Guardrails", HeadingLevel.HEADING_1, rtl));
  sections.push(
    twoColumnTable([
      ["Cost Per Sqm Target", budget.costPerSqmTarget ?? "—"],
      ["Total Budget Cap", budget.totalBudgetCap ?? "—"],
      ["Cost Band", budget.costBand ?? "—"],
      ["Contingency Recommendation", budget.contingencyRecommendation ?? "—"],
      ["Budget Flexibility Level", budget.flexibilityLevel ?? "—"],
    ], rtl)
  );
  if (Array.isArray(budget.valueEngineeringMandates) && budget.valueEngineeringMandates.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: docxFixed("Value Engineering Directives:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const note of budget.valueEngineeringMandates) {
      sections.push(bulletItem(note, rtl));
    }
  }
  sections.push(spacer(rtl));

  // ─── Section 7: Space Allocation Analysis (Phase 9) ──────────────────────
  if (data.spaceAllocation) {
    const space = data.spaceAllocation;
    sections.push(heading("7. Space Allocation Analysis", HeadingLevel.HEADING_1, rtl));
    sections.push(
      twoColumnTable([
        ["Overall Efficiency Score", `${space.efficiencyScore}/100`],
        ["Total Analysed Area", `${space.totalArea?.toLocaleString()} sqft`],
        ["Room Count", String(space.roomCount)],
        ["Circulation Percentage", `${space.circulationPct?.toFixed(1)}%`],
      ], rtl)
    );

    if (space.rooms && space.rooms.length > 0) {
      sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: docxFixed("Room Breakdown:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
      const roomTable = new Table({
        visuallyRightToLeft: rtl,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "1a3a4a" }, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Room", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "1a3a4a" }, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Area (sqft)", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })] }),
              new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "1a3a4a" }, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("% of Total", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "1a3a4a" }, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: docxFixed("Grade", rtl), bold: true, color: "ffffff", size: 20, rightToLeft: rtl })] })] }),
            ],
          }),
          ...space.rooms.map((room, i) => new TableRow({
            children: [
              new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: room.name, size: 20, rightToLeft: rtl })] })] }),
              new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: String(Math.round(room.area)), size: 20, rightToLeft: rtl })] })] }),
              new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: `${room.pctOfTotal?.toFixed(1)}%`, size: 20, rightToLeft: rtl })] })] }),
              new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined, children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: room.finishGrade || "—", size: 20, rightToLeft: rtl })] })] }),
            ],
          })),
        ],
      });
      sections.push(roomTable);
    }

    if (space.recommendations && space.recommendations.length > 0) {
      sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: docxFixed("MIYAR Ratio Guidance:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
      for (const rec of space.recommendations) {
        sections.push(bulletItem(`[${rec.severity?.toUpperCase()}] ${rec.advice}`, rtl));
      }
    }
    sections.push(spacer(rtl));
  }

  // ─── Section 6: Workflow & Execution Instructions ────────────────────────
  sections.push(heading("6. Workflow & Execution Instructions", HeadingLevel.HEADING_1, rtl));

  const pLogic = (instructions.procurementAndLogistics ?? {}) as Record<string, any>;
  sections.push(labelValue("Lead Time Window", pLogic.leadTimeWindow ?? "—", rtl));

  if (Array.isArray(pLogic.criticalPathItems) && pLogic.criticalPathItems.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Critical Path Procurement Items:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const item of pLogic.criticalPathItems) {
      sections.push(bulletItem(item, rtl));
    }
  }

  if (Array.isArray(pLogic.importDependencies) && pLogic.importDependencies.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Import Logistics Dependencies:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const item of pLogic.importDependencies) {
      sections.push(bulletItem(item, rtl));
    }
  }

  if (Array.isArray(instructions.authorityApprovals) && instructions.authorityApprovals.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Local Authority Approvals (Dubai):", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const item of instructions.authorityApprovals) {
      sections.push(bulletItem(item, rtl));
    }
  }

  if (Array.isArray(instructions.coordinationRequirements) && instructions.coordinationRequirements.length > 0) {
    sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: docxFixed("Contractor Coordination Requirements:", rtl), bold: true, size: 22, rightToLeft: rtl })] }));
    for (const item of instructions.coordinationRequirements) {
      sections.push(bulletItem(item, rtl));
    }
  }

  sections.push(spacer(rtl));
  sections.push(heading("Phased Deliverables", HeadingLevel.HEADING_2, rtl));

  const phases = [
    { label: "Phase 1 — Concept & Schematic", items: instructions.phasedDeliverables?.conceptDesign },
    { label: "Phase 2 — Detailed Design", items: instructions.phasedDeliverables?.schematicDesign },
    { label: "Phase 3 — IFC & Tender", items: instructions.phasedDeliverables?.detailedDesign },
  ];

  for (const phase of phases) {
    if (Array.isArray(phase.items) && phase.items.length > 0) {
      sections.push(new Paragraph({ bidirectional: rtl, spacing: { before: 80, after: 60 }, children: [new TextRun({ text: docxFixed(phase.label, rtl), bold: true, size: 22, rightToLeft: rtl })] }));
      for (const item of phase.items) {
        sections.push(bulletItem(`☐ ${item}`, rtl));
      }
    }
  }

  // ─── Disclaimer ─────────────────────────────────────────────────────────
  sections.push(spacer(rtl));
  sections.push(heading(reportCopy(locale, "importantDisclaimer"), HeadingLevel.HEADING_2, rtl));
  sections.push(
    new Paragraph({
      bidirectional: rtl,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: reportCopy(locale, "disclaimer"),
          size: 20,
          color: "5D4037",
        }),
      ],
    })
  );

  const doc = new Document({
    creator: "MIYAR Decision Intelligence Platform",
    title: `Design Instruction Brief — ${projectName}`,
    description: `MIYAR Design Brief v${data.version} for ${projectName}`,
    styles: {
      default: {
        document: {
          run: {
            rightToLeft: rtl,
            font: rtl ? { ascii: "Noto Sans Arabic", hAnsi: "Noto Sans Arabic", cs: "Noto Sans Arabic" } : "Aptos",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: rtl ? AlignmentType.RIGHT : AlignmentType.RIGHT,
                bidirectional: rtl,
                children: [new TextRun({ text: `${docxFixed("MIYAR Interior Design Instruction", rtl)} — ${projectName}`, size: 16, color: "999999", rightToLeft: rtl })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: rtl,
                children: [
                  new TextRun({ text: `${docxFixed("Page", rtl)} `, size: 16, color: "999999", rightToLeft: rtl }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
                  new TextRun({ text: ` — ${watermark}`, size: 16, color: "999999" }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
