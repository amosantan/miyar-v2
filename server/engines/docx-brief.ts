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

interface DesignBriefData {
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
  version: number;
  projectName?: string;
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({ heading: level, children: [new TextRun({ text, bold: true })] });
}

function bodyText(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
  });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}

function twoColumnTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Parameter", bold: true, color: "ffffff", size: 20 })] })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Value", bold: true, color: "ffffff", size: 20 })] })],
          }),
        ],
      }),
      ...rows.map(
        ([k, v], i) =>
          new TableRow({
            children: [
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: k, size: 20 })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })],
              }),
            ],
          })
      ),
    ],
  });
}

function boqTable(allocations: { category: string; percentage: number; estimatedCostLabel: string; notes: string }[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true, color: "ffffff", size: 20 })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Allocation", bold: true, color: "ffffff", size: 20 })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Estimated Budget", bold: true, color: "ffffff", size: 20 })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Notes", bold: true, color: "ffffff", size: 20 })] })],
          }),
        ],
      }),
      ...allocations.map(
        (alloc, i) =>
          new TableRow({
            children: [
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: alloc.category, size: 20 })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: `${alloc.percentage}%`, size: 20 })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: alloc.estimatedCostLabel, size: 20 })] })],
              }),
              new TableCell({
                shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: alloc.notes, size: 20 })] })],
              }),
            ],
          })
      ),
    ],
  });
}

export async function generateDesignBriefDocx(data: DesignBriefData): Promise<Buffer> {
  const identity = (data.projectIdentity ?? {}) as Record<string, any>;
  const narrative = (data.designNarrative ?? {}) as Record<string, any>;
  const materials = (data.materialSpecifications ?? {}) as Record<string, any>;
  const boq = data.boqFramework ?? { totalEstimatedSqm: null, coreAllocations: [] };
  const budget = (data.detailedBudget ?? {}) as Record<string, any>;
  const instructions = data.designerInstructions ?? { phasedDeliverables: {}, authorityApprovals: [], coordinationRequirements: [], procurementAndLogistics: {} };

  const projectName = String(data.projectName ?? identity.projectName ?? "MIYAR Project");
  const watermark = `MYR-BRIEF-${Date.now().toString(36)}`;

  const sections: (Paragraph | Table)[] = [];

  // ─── Title Page ──────────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3000, after: 400 },
      children: [new TextRun({ text: "MIYAR Design Instruction Brief", size: 56, bold: true, color: "1a3a4a" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: projectName, size: 36, color: "4ecdc4" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Version ${data.version} — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, size: 22, color: "666666" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `Document ID: ${watermark}`, size: 18, color: "999999" })],
    }),
    spacer()
  );

  // ─── Section 1: Project Identity ──────────────────────────────────────────
  sections.push(heading("1. Project Identity"));
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
    ])
  );
  sections.push(spacer());

  // ─── Section 2: Design Narrative ─────────────────────────────────────────
  sections.push(heading("2. Design Narrative"));
  sections.push(bodyText(narrative.positioningStatement ?? "No positioning statement generated."));
  sections.push(labelValue("Primary Style", narrative.primaryStyle ?? "—"));

  if (Array.isArray(narrative.moodKeywords) && narrative.moodKeywords.length > 0) {
    sections.push(labelValue("Mood Keywords", narrative.moodKeywords.join(", ")));
  }
  if (Array.isArray(narrative.colorPalette) && narrative.colorPalette.length > 0) {
    sections.push(labelValue("Color Palette", narrative.colorPalette.join(", ")));
  }

  sections.push(labelValue("Texture Direction", narrative.textureDirection ?? "—"));
  sections.push(labelValue("Lighting Approach", narrative.lightingApproach ?? "—"));
  sections.push(labelValue("Spatial Philosophy", narrative.spatialPhilosophy ?? "—"));
  sections.push(spacer());

  // ─── Section 3: Material Specifications ──────────────────────────────────
  sections.push(heading("3. Material Specifications"));
  sections.push(labelValue("Target Tier Requirement", materials.tierRequirement ?? "—"));
  sections.push(labelValue("Quality Benchmark", materials.qualityBenchmark ?? "—"));
  sections.push(labelValue("Sustainability Mandate", materials.sustainabilityMandate ?? "—"));

  if (Array.isArray(materials.approvedMaterials) && materials.approvedMaterials.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Approved Materials (Primary):", bold: true, size: 22 })] }));
    for (const m of materials.approvedMaterials) {
      sections.push(bulletItem(m));
    }
  }

  if (Array.isArray(materials.finishesAndTextures) && materials.finishesAndTextures.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Approved Finishes & Textures:", bold: true, size: 22 })] }));
    for (const m of materials.finishesAndTextures) {
      sections.push(bulletItem(m));
    }
  }

  if (Array.isArray(materials.prohibitedMaterials) && materials.prohibitedMaterials.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Prohibited Materials (Value Engineering Flags):", bold: true, size: 22, color: "c62828" })] }));
    for (const m of materials.prohibitedMaterials) {
      sections.push(bulletItem(m));
    }
  }
  sections.push(spacer());

  // ─── Section 4: Target BOQ Framework ─────────────────────────────────────
  sections.push(heading("4. Target BOQ Framework"));
  if (boq.totalEstimatedSqm) {
    sections.push(labelValue("Total Estimated Project Area", `${boq.totalEstimatedSqm.toLocaleString()} Sqm`));
  }
  if (Array.isArray(boq.coreAllocations) && boq.coreAllocations.length > 0) {
    sections.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Indicative Budget Allocations per Category:", size: 22 })] }));
    sections.push(boqTable(boq.coreAllocations));
  } else {
    sections.push(bodyText("No BOQ framework generated."));
  }
  sections.push(spacer());

  // ─── Section 5: Detailed Budget Guardrails ───────────────────────────────
  sections.push(heading("5. Detailed Budget Guardrails"));
  sections.push(
    twoColumnTable([
      ["Cost Per Sqm Target", budget.costPerSqmTarget ?? "—"],
      ["Total Budget Cap", budget.totalBudgetCap ?? "—"],
      ["Cost Band", budget.costBand ?? "—"],
      ["Contingency Recommendation", budget.contingencyRecommendation ?? "—"],
      ["Budget Flexibility Level", budget.flexibilityLevel ?? "—"],
    ])
  );
  if (Array.isArray(budget.valueEngineeringMandates) && budget.valueEngineeringMandates.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Value Engineering Directives:", bold: true, size: 22 })] }));
    for (const note of budget.valueEngineeringMandates) {
      sections.push(bulletItem(note));
    }
  }
  sections.push(spacer());

  // ─── Section 6: Workflow & Execution Instructions ────────────────────────
  sections.push(heading("6. Workflow & Execution Instructions"));

  const pLogic = (instructions.procurementAndLogistics ?? {}) as Record<string, any>;
  sections.push(labelValue("Lead Time Window", pLogic.leadTimeWindow ?? "—"));

  if (Array.isArray(pLogic.criticalPathItems) && pLogic.criticalPathItems.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Critical Path Procurement Items:", bold: true, size: 22 })] }));
    for (const item of pLogic.criticalPathItems) {
      sections.push(bulletItem(item));
    }
  }

  if (Array.isArray(pLogic.importDependencies) && pLogic.importDependencies.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Import Logistics Dependencies:", bold: true, size: 22 })] }));
    for (const item of pLogic.importDependencies) {
      sections.push(bulletItem(item));
    }
  }

  if (Array.isArray(instructions.authorityApprovals) && instructions.authorityApprovals.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Local Authority Approvals (Dubai):", bold: true, size: 22 })] }));
    for (const item of instructions.authorityApprovals) {
      sections.push(bulletItem(item));
    }
  }

  if (Array.isArray(instructions.coordinationRequirements) && instructions.coordinationRequirements.length > 0) {
    sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Contractor Coordination Requirements:", bold: true, size: 22 })] }));
    for (const item of instructions.coordinationRequirements) {
      sections.push(bulletItem(item));
    }
  }

  sections.push(spacer());
  sections.push(heading("Phased Deliverables", HeadingLevel.HEADING_2));

  const phases = [
    { label: "Phase 1 — Concept & Schematic", items: instructions.phasedDeliverables?.conceptDesign },
    { label: "Phase 2 — Detailed Design", items: instructions.phasedDeliverables?.schematicDesign },
    { label: "Phase 3 — IFC & Tender", items: instructions.phasedDeliverables?.detailedDesign },
  ];

  for (const phase of phases) {
    if (Array.isArray(phase.items) && phase.items.length > 0) {
      sections.push(new Paragraph({ spacing: { before: 80, after: 60 }, children: [new TextRun({ text: phase.label, bold: true, size: 22 })] }));
      for (const item of phase.items) {
        sections.push(bulletItem(`☐ ${item}`));
      }
    }
  }

  // ─── Disclaimer ─────────────────────────────────────────────────────────
  sections.push(spacer());
  sections.push(heading("Important Disclaimer", HeadingLevel.HEADING_2));
  sections.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "This document is a concept-level interior design instruction brief generated by the MIYAR platform. ",
          size: 20,
          color: "5D4037",
        }),
        new TextRun({
          text: "All material directives, BOQ targets, and workflows are advisory and must be professionally validated. ",
          size: 20,
          color: "5D4037",
        }),
        new TextRun({
          text: "This document does not constitute professional engineering, financial, or legal advice.",
          size: 20,
          color: "5D4037",
        }),
      ],
    })
  );

  // ─── Footer ───────────────────────────────────────────────────────────────
  sections.push(spacer());
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `MIYAR Interior Design Instruction — Document ID: ${watermark}`,
          size: 16,
          color: "999999",
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    creator: "MIYAR Decision Intelligence Platform",
    title: `Design Instruction Brief — ${projectName}`,
    description: `MIYAR Design Brief v${data.version} for ${projectName}`,
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
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `MIYAR Design Instruction — ${projectName}`, size: 16, color: "999999" })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "999999" }),
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
