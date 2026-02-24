import { generateReportHTML } from "./server/engines/pdf-report";

const mockScoreResult = {
    compositeScore: 85, riskScore: 20, rasScore: 65, confidenceScore: 90,
    dimensions: { sa: 85, ff: 80, mp: 90, ds: 85, er: 82 },
    dimensionWeights: { sa: 0.2, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.2 },
    decisionStatus: "validated" as any, penalties: [], riskFlags: [],
    conditionalActions: [], variableContributions: {}, inputSnapshot: {}
};

const mockInputs = {
    ctx01Typology: "Hotel", ctx02Scale: "Mid-scale", ctx03Gfa: 50000,
    ctx04Location: "Dubai", ctx05Horizon: "12-24m",
    str01BrandClarity: parseInt("4", 10), str02Differentiation: parseInt("4", 10), str03BuyerMaturity: parseInt("4", 10),
    mkt01Tier: "Upper-mid", mkt02Competitor: parseInt("4", 10), mkt03Trend: parseInt("4", 10),
    fin01BudgetCap: 400, fin02Flexibility: parseInt("4", 10), fin03ShockTolerance: parseInt("4", 10), fin04SalesPremium: parseInt("4", 10),
    des01Style: "Modern", des02MaterialLevel: parseInt("4", 10), des03Complexity: parseInt("4", 10), des04Experience: parseInt("4", 10), des05Sustainability: parseInt("4", 10),
    exe01SupplyChain: parseInt("4", 10), exe02Contractor: parseInt("4", 10), exe03Approvals: parseInt("4", 10), exe04QaMaturity: parseInt("4", 10),
};

const mockRoi = {
    totalValueCreated: 150000,
    roiMultiple: 12.5,
    components: [
        { name: "Procurement Savings", description: "Savings from verified materials", value: 50000 },
        { name: "Time-Value Gain", description: "Accelerated market entry", value: 100000 }
    ]
};

const mockFiveLens = {
    overallScore: 82,
    overallVerdict: "B+",
    weakestLens: "Market Fit",
    lenses: [
        { lensName: "Market Fit", score: 75, rationale: "Good overall fit.", evidence: ["Strong growth trend in region", "High demand"], gaps: [] },
        { lensName: "Cost Discipline", score: 85, rationale: "Efficient.", evidence: [{ label: "Material Sourcing", value: "Verified local" }], gaps: [] }
    ]
};

const mockEvidenceRefs = [
    { title: "Market Survey Q3", category: "Market", reliabilityGrade: "A", captureDate: new Date().toISOString() },
    { title: "Cost Benchmark 2025", category: "Financial", reliabilityGrade: "A", captureDate: new Date().toISOString() }
];

const html = generateReportHTML("full_report", {
    projectName: "Test Verification Project",
    projectId: 999,
    inputs: mockInputs,
    scoreResult: mockScoreResult,
    sensitivity: [],
    roi: mockRoi as any,
    roiNarrative: mockRoi,
    fiveLens: mockFiveLens as any,
    benchmarkVersion: "v1.0",
    logicVersion: "v1.0",
    evidenceRefs: mockEvidenceRefs
});

import * as fs from "fs";
fs.writeFileSync("test-report-out.html", html);
console.log("HTML written to test-report-out.html");
