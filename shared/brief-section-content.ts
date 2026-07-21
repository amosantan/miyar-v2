import { z } from "zod";
import {
  BRIEF_SECTION_IDS,
  briefContentAuthoritySchema,
  briefSectionIdSchema,
  type BriefSectionId,
} from "./brief-contract";

export const BRIEF_SECTION_CONTENT_SCHEMA_VERSION = "BR-04-v1" as const;
export const SQM_TO_SQFT = "10.7639" as const;
export const AREA_BASES = ["gifa", "nia", "saleable", "fitout"] as const;
export const AREA_UNITS = ["m2", "ft2"] as const;
export const RATE_UNITS = ["aed_per_m2", "aed_per_ft2"] as const;

const text = z.string().trim().min(1).max(4_000);
const shortText = z.string().trim().min(1).max(240);
const decimal = z.string().trim()
  .regex(/^\d{1,15}(?:\.\d{1,8})?$/, "Enter a positive decimal value")
  .refine(value => /[1-9]/.test(value), "Value must be greater than zero");
const optionalTextList = z.array(shortText).max(100).default([]);

export const briefRequirementInputSchema = z.object({
  ruleId: z.string().trim().min(1).max(128),
  requirement: z.enum(["required", "optional"]),
  authority: briefContentAuthoritySchema,
  impacts: z.array(z.enum(["coordination", "decision", "procurement", "professional"])).max(4).default([]),
  componentId: z.string().trim().min(1).max(96).optional(),
  sourceId: z.string().trim().min(1).max(128).optional(),
  sourceVersion: z.string().trim().min(1).max(128).optional(),
  approvedBy: z.number().int().positive().optional(),
}).strict();

export const briefAssumptionSchema = z.object({
  id: z.string().trim().min(1).max(128),
  statement: text,
  impact: z.enum(["coordination", "decision", "procurement", "professional"]),
  status: z.enum(["open", "confirmed", "rejected"]).default("open"),
}).strict();

const commonShape = {
  schemaVersion: z.literal(BRIEF_SECTION_CONTENT_SCHEMA_VERSION),
  summary: text,
  requirements: z.array(briefRequirementInputSchema).min(1).max(200),
  assumptions: z.array(briefAssumptionSchema).max(100).default([]),
};

function section<T extends BriefSectionId, S extends z.ZodRawShape>(sectionId: T, shape: S) {
  return z.object({ ...commonShape, sectionId: z.literal(sectionId), ...shape }).strict();
}

const intent = section("intent", {
  objectives: z.array(text).min(1).max(30),
  successCriteria: optionalTextList,
  targetUsers: optionalTextList,
});

const assetContext = section("asset_context", {
  location: shortText,
  assetType: shortText,
  developmentStage: shortText.optional(),
  constraints: optionalTextList,
});

const spaceProgramme = section("space_programme", {
  spaces: z.array(z.object({
    name: shortText,
    quantity: z.number().int().min(1).max(10_000),
    targetArea: decimal.optional(),
    areaUnit: z.enum(AREA_UNITS).optional(),
    notes: z.string().trim().max(1_000).optional(),
  }).strict()).min(1).max(500),
  adjacencyNotes: z.string().trim().max(4_000).optional(),
});

const designDirection = section("design_direction", {
  concept: text,
  styleKeywords: z.array(shortText).min(1).max(30),
  palette: optionalTextList,
  avoid: optionalTextList,
});

const specificationIntent = section("specification_intent", {
  performanceGoals: z.array(text).min(1).max(100),
  materialPriorities: optionalTextList,
  maintenanceRequirements: optionalTextList,
});

const supply = section("supply", {
  procurementStrategy: text,
  availabilityRequirements: optionalTextList,
  leadTimeConstraints: optionalTextList,
  approvedAlternativesRequired: z.boolean().default(true),
});

const riskCompliance = section("risk_compliance", {
  risks: z.array(z.object({
    title: shortText,
    impact: z.enum(["low", "medium", "high"]),
    mitigation: text,
  }).strict()).min(1).max(100),
  preliminaryChecks: optionalTextList,
  professionalReviewRequired: z.boolean().default(true),
});

const conceptMedia = section("concept_media", {
  moodKeywords: z.array(shortText).min(1).max(30),
  visualObjectives: z.array(text).min(1).max(30),
  negativeConstraints: optionalTextList,
  nonContractual: z.literal(true),
});

const governance = section("governance", {
  decisionOwners: z.array(z.object({ role: shortText, responsibility: text }).strict()).min(1).max(50),
  reviewCadence: shortText,
  approvalNotes: z.string().trim().max(4_000).optional(),
});

type Fraction = { numerator: bigint; denominator: bigint };

function powerOfTen(scale: number) {
  let result = BigInt(1);
  for (let index = 0; index < scale; index += 1) result *= BigInt(10);
  return result;
}

function fraction(value: string): Fraction {
  const [whole, decimalPart = ""] = value.split(".");
  return {
    numerator: BigInt(`${whole}${decimalPart}`),
    denominator: powerOfTen(decimalPart.length),
  };
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}

function fixed(value: bigint, scale: number) {
  const digits = value.toString().padStart(scale + 1, "0");
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function scaled(value: Fraction, scale: number) {
  return roundRatio(value.numerator * powerOfTen(scale), value.denominator);
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return { numerator: left.numerator * right.numerator, denominator: left.denominator * right.denominator };
}

function divide(left: Fraction, right: Fraction): Fraction {
  return { numerator: left.numerator * right.denominator, denominator: left.denominator * right.numerator };
}

const sqmToSqft = fraction(SQM_TO_SQFT);

export function normalizeArea(value: string, unit: "m2" | "ft2") {
  const entered = fraction(decimal.parse(value));
  const squareMetres = unit === "m2" ? entered : divide(entered, sqmToSqft);
  const squareFeet = unit === "ft2" ? entered : multiply(entered, sqmToSqft);
  return {
    squareMetres: fixed(scaled(squareMetres, 4), 4),
    squareFeet: fixed(scaled(squareFeet, 4), 4),
  };
}

export function normalizeRate(value: string, unit: "aed_per_m2" | "aed_per_ft2") {
  const entered = fraction(decimal.parse(value));
  const perSquareMetre = unit === "aed_per_m2" ? entered : multiply(entered, sqmToSqft);
  const perSquareFoot = unit === "aed_per_ft2" ? entered : divide(entered, sqmToSqft);
  return {
    aedPerSquareMetre: fixed(scaled(perSquareMetre, 4), 4),
    aedPerSquareFoot: fixed(scaled(perSquareFoot, 4), 4),
  };
}

const costMetadata = z.object({
  areaSource: shortText,
  areaSourceVersion: shortText,
  costBaseDate: z.string().date(),
  inclusions: optionalTextList,
  exclusions: optionalTextList,
  feesIncluded: z.boolean(),
  vatIncluded: z.boolean(),
  contingencyIncluded: z.boolean(),
  escalationIncluded: z.boolean(),
}).strict();

const totalBudget = z.object({
  mode: z.literal("total_aed"),
  enteredTotalAed: decimal,
  metadata: costMetadata,
}).strict().transform(value => ({
  ...value,
  normalizedTotalAed: fixed(scaled(fraction(value.enteredTotalAed), 2), 2),
}));

const unitRateBudget = z.object({
  mode: z.literal("unit_rate"),
  enteredRate: decimal,
  rateUnit: z.enum(RATE_UNITS),
  areaBasis: z.enum(AREA_BASES),
  enteredArea: decimal,
  areaUnit: z.enum(AREA_UNITS),
  metadata: costMetadata,
}).strict().transform(value => {
  const normalizedArea = normalizeArea(value.enteredArea, value.areaUnit);
  const normalizedRate = normalizeRate(value.enteredRate, value.rateUnit);
  const total = multiply(fraction(normalizedArea.squareMetres), fraction(normalizedRate.aedPerSquareMetre));
  return {
    ...value,
    normalizedArea,
    normalizedRate,
    normalizedTotalAed: fixed(scaled(total, 2), 2),
  };
});

const legacyBudget = z.object({
  mode: z.literal("legacy_basis_unspecified"),
  originalValue: z.union([decimal, text]),
  note: text,
}).strict();

export const budgetContractInputSchema = z.discriminatedUnion("mode", [
  totalBudget,
  unitRateBudget,
  legacyBudget,
]);

const costQuantities = section("cost_quantities", {
  budget: budgetContractInputSchema,
  costCategories: z.array(z.object({ category: shortText, allowanceAed: decimal.optional(), note: z.string().trim().max(1_000).optional() }).strict()).max(100).default([]),
});

export const briefSectionContentV1InputSchema = z.discriminatedUnion("sectionId", [
  intent,
  assetContext,
  spaceProgramme,
  designDirection,
  specificationIntent,
  costQuantities,
  supply,
  riskCompliance,
  conceptMedia,
  governance,
]);

export type BriefSectionContentV1Input = z.input<typeof briefSectionContentV1InputSchema>;
export type BriefSectionContentV1 = z.output<typeof briefSectionContentV1InputSchema>;

function withoutSubmittedNormalization(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const content = value as Record<string, unknown>;
  if (content.sectionId !== "cost_quantities" || !content.budget || typeof content.budget !== "object") return value;
  const budget = { ...(content.budget as Record<string, unknown>) };
  delete budget.normalizedArea;
  delete budget.normalizedRate;
  delete budget.normalizedTotalAed;
  return { ...content, budget };
}

export function parseBriefSectionContentV1(sectionId: BriefSectionId, value: unknown) {
  const content = briefSectionContentV1InputSchema.parse(withoutSubmittedNormalization(value));
  if (content.sectionId !== sectionId) {
    throw new z.ZodError([{ code: "custom", path: ["sectionId"], message: `Content is for ${content.sectionId}, not ${sectionId}`, input: value }]);
  }
  return content;
}

export function readBriefSectionContent(sectionId: BriefSectionId, schemaVersion: string, value: unknown) {
  if (schemaVersion !== BRIEF_SECTION_CONTENT_SCHEMA_VERSION) {
    return { kind: "legacy" as const, schemaVersion, content: value };
  }
  const parsed = briefSectionContentV1InputSchema.safeParse(withoutSubmittedNormalization(value));
  if (!parsed.success || parsed.data.sectionId !== sectionId) {
    return { kind: "invalid" as const, schemaVersion, content: value, issues: parsed.success ? ["Section mismatch"] : parsed.error.issues.map(issue => issue.message) };
  }
  return { kind: "structured" as const, schemaVersion, content: parsed.data };
}

export const briefSectionContentInputBySection = Object.fromEntries(
  BRIEF_SECTION_IDS.map(sectionId => [sectionId, briefSectionContentV1InputSchema])
) as Record<BriefSectionId, typeof briefSectionContentV1InputSchema>;

export { briefSectionIdSchema };
