/**
 * TR-13 critical-workflow certification fixtures.
 *
 * These are deliberately synthetic, versioned contracts. They describe the
 * records the isolated certification seeder creates; they are not customer data and
 * must not be substituted for numeric scoring or stored-report evidence.
 */
export const TR13_WORKFLOW_FIXTURE_VERSION = "tr13-workflow-fixtures-v2";

/**
 * Canonical governed records for the guarded real-MySQL certification journey.
 *
 * Keep this deliberately boring: values here are the complete synthetic source
 * contract for the records which establish tenant ownership, active versions,
 * governed evidence, material-library price bounds and the numeric reconciliation.
 * The MySQL test both seeds from this object and reads the persisted records back
 * before exercising router behavior.  Do not add parallel SQL-only fixture values.
 */
export const TR13_MYSQL_CRITICAL_FIXTURE = {
  ids: {
    primaryOrg: 13_001,
    foreignOrg: 13_002,
    admin: 13_101,
    member: 13_102,
    viewer: 13_103,
    foreign: 13_201,
    project: 13_301,
    foreignProject: 13_302,
    model: 13_401,
    score: 13_501,
    evidence: 13_601,
    materialCatalog: 13_701,
    materialLibrary: 13_702,
    affordableFloor: 13_703,
    affordableWall: 13_704,
    affordableCeiling: 13_705,
    benchmark: 13_801,
    logic: 13_901,
  },
  organizations: {
    primary: { name: "TR-13 Synthetic Primary", slug: "tr13-synthetic-primary" },
    foreign: { name: "TR-13 Synthetic Foreign", slug: "tr13-synthetic-foreign" },
  },
  users: {
    admin: { name: "TR13 Admin", email: "tr13-admin@example.invalid", org: "primary", membership: "admin" },
    member: { name: "TR13 Member", email: "tr13-member@example.invalid", org: "primary", membership: "member" },
    viewer: { name: "TR13 Viewer", email: "tr13-viewer@example.invalid", org: "primary", membership: "viewer" },
    foreign: { name: "TR13 Foreign", email: "tr13-foreign@example.invalid", org: "foreign", membership: "admin" },
  },
  versions: {
    model: {
      tag: "tr13-synthetic-model-v1",
      dimensionWeights: { sa: 0.25, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.15 },
    },
    benchmark: { tag: "tr13-synthetic-benchmark-v1", date: "2026-01-01" },
    logic: { name: "tr13-synthetic-logic-v1", date: "2026-01-01" },
  },
  benchmark: {
    typology: "Residential", location: "Prime", marketTier: "Upper-mid",
    materialLevel: 3, roomType: "General", low: 300, mid: 400, high: 500, year: 2026,
  },
  project: {
    name: "TR-13 Synthetic Residence", description: "Synthetic only", status: "evaluated",
    typology: "Residential", scale: "Medium", gfa: 100, fitOutArea: 20,
    location: "Prime", horizon: "12-24m", city: "Dubai", marketTier: "Upper-mid",
    budgetCap: 1000, style: "Modern",
    provenance: { ctx01Typology: "explicit", ctx03Gfa: "explicit", fin01BudgetCap: "explicit" },
  },
  foreignProject: { name: "TR-13 Foreign Project", fitOutArea: 100 },
  score: { dimensions: { sa: 80, ff: 70, mp: 75, ds: 78, er: 72 }, composite: 75, risk: 25, ras: 75, confidence: 90 },
  evidence: {
    recordId: "TR13-EVIDENCE-001", category: "floors", itemName: "Synthetic stone evidence",
    unit: "sqm", sourceUrl: "https://example.invalid/tr13-evidence", date: "2026-01-01",
    reliability: "A", confidence: 90, confidentiality: "internal", corpusScope: "organization",
  },
  materials: {
    catalog: { name: "TR-13 Synthetic Stone", category: "stone", tier: "premium", low: 100, high: 150, unit: "AED/sqm", supplier: "Synthetic Supplier" },
    library: [
      { id: "materialLibrary", category: "flooring", tier: "premium", code: "TR13-STONE", name: "TR-13 Synthetic Stone", low: 100, high: 150 },
      { id: "affordableFloor", category: "flooring", tier: "affordable", code: "TR13-FLOOR-C", name: "TR-13 Synthetic Grade C Floor", low: 50, high: 80 },
      { id: "affordableWall", category: "wall_paint", tier: "affordable", code: "TR13-WALL-C", name: "TR-13 Synthetic Grade C Wall", low: 10, high: 15 },
      { id: "affordableCeiling", category: "ceiling", tier: "affordable", code: "TR13-CEILING-C", name: "TR-13 Synthetic Grade C Ceiling", low: 20, high: 30 },
    ],
  },
  rooms: [
    { code: "LVG", name: "Synthetic Living", category: "living", sqm: 10, grade: "B", priority: "high", budgetPct: 0.5, sortOrder: 0 },
    { code: "MBR", name: "Synthetic Bedroom", category: "bedroom", sqm: 10, grade: "A", priority: "high", budgetPct: 0.5, sortOrder: 1 },
  ],
  lockedAllocation: { roomCode: "LVG", element: "floor", material: "materialLibrary", pct: 100, area: 10, low: 100, high: 150, totalLow: 1000, totalHigh: 1500 },
  reconciliation: {
    fitOutAreaM2: 20, roomAreaM2: 20, allocationPct: 100,
    roomCount: 2, allocationCount: 6, lockedAllocationCount: 1, manualRoomCount: 2,
    costAed: { min: 2_494.7, mid: 3_143.38, max: 3_792.05 },
    allocationSurfacesMatchFormula: true,
  },
} as const;

export const TR13_EXPECTED_RECONCILIATION =
  TR13_MYSQL_CRITICAL_FIXTURE.reconciliation;

export type Tr13Role = "developer" | "designer" | "viewer" | "foreign_designer";
export type Tr13WorkflowStage =
  | "login"
  | "organization"
  | "project"
  | "evaluation"
  | "space_programme"
  | "mqi"
  | "structured_brief"
  | "ai_advisor_brief"
  | "stored_report"
  | "public_share"
  | "share_revocation";

export type Tr13BriefContract = {
  api: "design.generateBrief" | "designAdvisor.generateDesignBrief";
  kind: "structured" | "ai-advisor-shareable";
  producer: "deterministic-engine" | "ai-assisted-narrative";
  requiredInputs: readonly string[];
  requiredOutputs: readonly string[];
  certificationBoundary: string;
};

export const TR13_BRIEF_CONTRACTS = {
  structured: {
    api: "design.generateBrief",
    kind: "structured",
    producer: "deterministic-engine",
    requiredInputs: [
      "project inputs",
      "evaluation",
      "space programme",
      "MQI",
      "evidence references",
    ] as const,
    requiredOutputs: [
      "technical specification",
      "RFQ-ready framework",
      "disclaimer",
    ] as const,
    certificationBoundary:
      "Must preserve deterministic source values, provenance labels, technical specification, and disclaimer.",
  },
  aiAdvisor: {
    api: "designAdvisor.generateDesignBrief",
    kind: "ai-advisor-shareable",
    producer: "ai-assisted-narrative",
    requiredInputs: [
      "project inputs",
      "evaluation",
      "governed evidence context",
      "locale",
    ] as const,
    requiredOutputs: ["narrative brief", "disclaimer"] as const,
    certificationBoundary:
      "Narrative assistance cannot become numerical authority or silently replace explicit developer inputs.",
  },
} as const satisfies Record<string, Tr13BriefContract>;

export const TR13_WORKFLOW_FIXTURE = {
  version: TR13_WORKFLOW_FIXTURE_VERSION,
  syntheticOnly: true,
  organization: {
    primary: {
      slug: TR13_MYSQL_CRITICAL_FIXTURE.organizations.primary.slug,
      name: TR13_MYSQL_CRITICAL_FIXTURE.organizations.primary.name,
    },
    foreign: {
      slug: TR13_MYSQL_CRITICAL_FIXTURE.organizations.foreign.slug,
      name: TR13_MYSQL_CRITICAL_FIXTURE.organizations.foreign.name,
    },
  },
  users: {
    developer: {
      role: "developer",
      organization: "primary",
      email: TR13_MYSQL_CRITICAL_FIXTURE.users.admin.email,
    },
    designer: {
      role: "designer",
      organization: "primary",
      email: TR13_MYSQL_CRITICAL_FIXTURE.users.member.email,
    },
    viewer: {
      role: "viewer",
      organization: "primary",
      email: TR13_MYSQL_CRITICAL_FIXTURE.users.viewer.email,
    },
    foreignDesigner: {
      role: "foreign_designer",
      organization: "foreign",
      email: TR13_MYSQL_CRITICAL_FIXTURE.users.foreign.email,
    },
  } as const satisfies Record<
    string,
    { role: Tr13Role; organization: "primary" | "foreign"; email: string }
  >,
  project: {
    name: TR13_MYSQL_CRITICAL_FIXTURE.project.name,
    city: TR13_MYSQL_CRITICAL_FIXTURE.project.city,
    typology: TR13_MYSQL_CRITICAL_FIXTURE.project.typology,
    scope: TR13_MYSQL_CRITICAL_FIXTURE.project.description,
  },
  expectedStages: [
    "login",
    "organization",
    "project",
    "evaluation",
    "space_programme",
    "mqi",
    "structured_brief",
    "ai_advisor_brief",
    "stored_report",
    "public_share",
    "share_revocation",
  ] as const satisfies readonly Tr13WorkflowStage[],
  securityNegatives: [
    "foreign_designer cannot read or mutate the primary organization project",
    "revoked public-share token resolves as concealed not-found",
    "public share remains read-only before and after revocation attempt",
  ] as const,
  briefContracts: TR13_BRIEF_CONTRACTS,
} as const;
