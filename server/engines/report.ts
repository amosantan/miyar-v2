/**
 * MIYAR Report Generation Engine
 * Generates structured report data for different report types.
 * Actual PDF rendering is done client-side or via LLM narrative generation.
 */
import type { ScoreResult, ProjectInputs, SensitivityEntry, ROIResult, ReportType } from "../../shared/miyar-types";

export interface ReportData {
  reportType: ReportType;
  generatedAt: string;
  projectName: string;
  projectId: number;
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  type: "summary" | "scores" | "radar" | "sensitivity" | "risk" | "recommendations" | "roi" | "narrative";
  data: any;
}

export function generateValidationSummary(
  projectName: string,
  projectId: number,
  inputs: ProjectInputs,
  scoreResult: ScoreResult,
  sensitivity: SensitivityEntry[]
): ReportData {
  return {
    reportType: "validation_summary",
    generatedAt: new Date().toISOString(),
    projectName,
    projectId,
    sections: [
      {
        title: "Executive Summary",
        type: "summary",
        data: {
          compositeScore: scoreResult.compositeScore,
          rasScore: scoreResult.rasScore,
          decisionStatus: scoreResult.decisionStatus,
          confidenceScore: scoreResult.confidenceScore,
          riskFlags: scoreResult.riskFlags,
          statusLabel: scoreResult.decisionStatus === "validated"
            ? "Direction Validated"
            : scoreResult.decisionStatus === "conditional"
            ? "Conditionally Validated"
            : "Not Validated",
        },
      },
      {
        title: "Dimension Scores",
        type: "scores",
        data: {
          dimensions: scoreResult.dimensions,
          weights: scoreResult.dimensionWeights,
        },
      },
      {
        title: "Radar Profile",
        type: "radar",
        data: scoreResult.dimensions,
      },
      {
        title: "Risk Assessment",
        type: "risk",
        data: {
          riskScore: scoreResult.riskScore,
          penalties: scoreResult.penalties,
          riskFlags: scoreResult.riskFlags,
        },
      },
      {
        title: "Sensitivity Analysis",
        type: "sensitivity",
        data: sensitivity.slice(0, 8),
      },
      {
        title: "Conditional Actions",
        type: "recommendations",
        data: scoreResult.conditionalActions,
      },
    ],
  };
}

export function generateDesignBrief(
  projectName: string,
  projectId: number,
  inputs: ProjectInputs,
  scoreResult: ScoreResult,
  sensitivity: SensitivityEntry[]
): ReportData {
  const report = generateValidationSummary(projectName, projectId, inputs, scoreResult, sensitivity);
  report.reportType = "design_brief";

  // Add design-specific sections
  report.sections.push({
    title: "Design Direction Parameters",
    type: "summary",
    data: {
      style: inputs.des01Style,
      materialLevel: inputs.des02MaterialLevel,
      complexity: inputs.des03Complexity,
      experienceIntensity: inputs.des04Experience,
      sustainability: inputs.des05Sustainability,
      targetMarket: inputs.mkt01Tier,
      location: inputs.ctx04Location,
    },
  });

  report.sections.push({
    title: "Variable Contributions",
    type: "scores",
    data: scoreResult.variableContributions,
  });

  return report;
}

export function generateFullReport(
  projectName: string,
  projectId: number,
  inputs: ProjectInputs,
  scoreResult: ScoreResult,
  sensitivity: SensitivityEntry[],
  roi: ROIResult
): ReportData {
  const report = generateDesignBrief(projectName, projectId, inputs, scoreResult, sensitivity);
  report.reportType = "full_report";

  report.sections.push({
    title: "ROI Analysis",
    type: "roi",
    data: roi,
  });

  return report;
}
