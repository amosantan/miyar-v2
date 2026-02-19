/**
 * MIYAR Design Brief DOCX Generator
 * Generates a structured Word document from the 7-section design brief data.
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
  projectIdentity: any;
  positioningStatement: string;
  styleMood: any;
  materialGuidance: any;
  budgetGuardrails: any;
  procurementConstraints: any;
  deliverablesChecklist: any;
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

export async function generateDesignBriefDocx(data: DesignBriefData): Promise<Buffer> {
  const identity = data.projectIdentity ?? {};
  const styleMood = data.styleMood ?? {};
  const materialGuidance = data.materialGuidance ?? {};
  const budgetGuardrails = data.budgetGuardrails ?? {};
  const procurement = data.procurementConstraints ?? {};
  const deliverables = data.deliverablesChecklist ?? {};

  const projectName = data.projectName ?? identity.projectName ?? "MIYAR Project";
  const watermark = `MYR-BRIEF-${Date.now().toString(36)}`;

  const sections: (Paragraph | Table)[] = [];

  // ─── Title Page ──────────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3000, after: 400 },
      children: [new TextRun({ text: "MIYAR Design Brief", size: 56, bold: true, color: "1a3a4a" })],
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
      ["GFA", identity.gfa ? `${Number(identity.gfa).toLocaleString()} sqft` : "—"],
      ["Location", identity.location ?? "—"],
      ["Delivery Horizon", identity.horizon ?? "—"],
      ["Market Tier", identity.marketTier ?? "—"],
      ["Design Style", identity.style ?? "—"],
    ])
  );
  sections.push(spacer());

  // ─── Section 2: Positioning Statement ─────────────────────────────────────
  sections.push(heading("2. Positioning Statement"));
  sections.push(bodyText(data.positioningStatement ?? "No positioning statement generated."));
  sections.push(spacer());

  // ─── Section 3: Style & Mood Direction ────────────────────────────────────
  sections.push(heading("3. Style & Mood Direction"));
  sections.push(labelValue("Primary Style", styleMood.primaryStyle ?? "—"));
  if (styleMood.moodKeywords?.length) {
    sections.push(labelValue("Mood Keywords", styleMood.moodKeywords.join(", ")));
  }
  if (styleMood.colorPalette?.length) {
    sections.push(labelValue("Color Palette", styleMood.colorPalette.join(", ")));
  }
  sections.push(labelValue("Texture Direction", styleMood.textureDirection ?? "—"));
  sections.push(labelValue("Lighting Approach", styleMood.lightingApproach ?? "—"));
  sections.push(labelValue("Spatial Philosophy", styleMood.spatialPhilosophy ?? "—"));
  sections.push(spacer());

  // ─── Section 4: Material Guidance ─────────────────────────────────────────
  sections.push(heading("4. Material Guidance"));
  sections.push(labelValue("Tier Recommendation", materialGuidance.tierRecommendation ?? "—"));
  sections.push(labelValue("Quality Benchmark", materialGuidance.qualityBenchmark ?? "—"));
  if (materialGuidance.primaryMaterials?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Primary Materials:", bold: true, size: 22 })] }));
    for (const m of materialGuidance.primaryMaterials) {
      sections.push(bulletItem(m));
    }
  }
  if (materialGuidance.accentMaterials?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Accent Materials:", bold: true, size: 22 })] }));
    for (const m of materialGuidance.accentMaterials) {
      sections.push(bulletItem(m));
    }
  }
  if (materialGuidance.avoidMaterials?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Materials to Avoid:", bold: true, size: 22, color: "c62828" })] }));
    for (const m of materialGuidance.avoidMaterials) {
      sections.push(bulletItem(m));
    }
  }
  sections.push(labelValue("Sustainability Notes", materialGuidance.sustainabilityNotes ?? "—"));
  sections.push(spacer());

  // ─── Section 5: Budget Guardrails ─────────────────────────────────────────
  sections.push(heading("5. Budget Guardrails"));
  sections.push(
    twoColumnTable([
      ["Cost Target", budgetGuardrails.costPerSqftTarget ?? "—"],
      ["Cost Band", budgetGuardrails.costBand ?? "—"],
      ["Contingency", budgetGuardrails.contingencyRecommendation ?? "—"],
      ["Flexibility Level", budgetGuardrails.flexibilityLevel ?? "—"],
    ])
  );
  if (budgetGuardrails.valueEngineeringNotes?.length) {
    sections.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Value Engineering Notes:", bold: true, size: 22 })] }));
    for (const note of budgetGuardrails.valueEngineeringNotes) {
      sections.push(bulletItem(note));
    }
  }
  sections.push(spacer());

  // ─── Section 6: Procurement Constraints ───────────────────────────────────
  sections.push(heading("6. Procurement Constraints"));
  sections.push(labelValue("Lead Time Window", procurement.leadTimeWindow ?? "—"));
  if (procurement.criticalPathItems?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Critical Path Items:", bold: true, size: 22 })] }));
    for (const item of procurement.criticalPathItems) {
      sections.push(bulletItem(item));
    }
  }
  if (procurement.importDependencies?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Import Dependencies:", bold: true, size: 22 })] }));
    for (const dep of procurement.importDependencies) {
      sections.push(bulletItem(dep));
    }
  }
  if (procurement.riskMitigations?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Risk Mitigations:", bold: true, size: 22 })] }));
    for (const m of procurement.riskMitigations) {
      sections.push(bulletItem(m));
    }
  }
  sections.push(spacer());

  // ─── Section 7: Deliverables Checklist ────────────────────────────────────
  sections.push(heading("7. Deliverables Checklist"));
  const phases = [
    { label: "Phase 1 — Concept", items: deliverables.phase1 },
    { label: "Phase 2 — Development", items: deliverables.phase2 },
    { label: "Phase 3 — Execution", items: deliverables.phase3 },
  ];
  for (const phase of phases) {
    sections.push(heading(phase.label, HeadingLevel.HEADING_2));
    if (phase.items?.length) {
      for (const item of phase.items) {
        sections.push(bulletItem(`☐ ${item}`));
      }
    }
  }
  if (deliverables.qualityGates?.length) {
    sections.push(heading("Quality Gates", HeadingLevel.HEADING_2));
    for (let i = 0; i < deliverables.qualityGates.length; i++) {
      sections.push(bulletItem(`Gate ${i + 1}: ${deliverables.qualityGates[i]}`));
    }
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  sections.push(spacer());
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `MIYAR Decision Intelligence Platform — Document ID: ${watermark}`,
          size: 16,
          color: "999999",
          italics: true,
        }),
      ],
    })
  );
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "This document is auto-generated and watermarked. Scores are advisory and do not constitute professional design or financial advice.",
          size: 14,
          color: "999999",
        }),
      ],
    })
  );

  const doc = new Document({
    creator: "MIYAR Decision Intelligence Platform",
    title: `Design Brief — ${projectName}`,
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
                children: [new TextRun({ text: `MIYAR Design Brief — ${projectName}`, size: 16, color: "999999" })],
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
