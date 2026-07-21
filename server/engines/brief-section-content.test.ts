import { describe, expect, it } from "vitest";
import {
  BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
  normalizeArea,
  normalizeRate,
  parseBriefSectionContentV1,
  readBriefSectionContent,
} from "@shared/brief-section-content";

const common = {
  schemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
  summary: "A governed project intent.",
  requirements: [{
    ruleId: "intent.summary",
    requirement: "required" as const,
    authority: "explicit_user_input" as const,
    impacts: ["coordination" as const],
  }],
  assumptions: [],
};

describe("BR-04 section content", () => {
  const fixtures = {
    intent: { objectives: ["Objective"], successCriteria: [], targetUsers: [] },
    asset_context: { location: "Dubai", assetType: "Apartment", constraints: [] },
    space_programme: { spaces: [{ name: "Living room", quantity: 1 }] },
    design_direction: { concept: "Quiet luxury", styleKeywords: ["Warm"], palette: [], avoid: [] },
    specification_intent: { performanceGoals: ["Durable"], materialPriorities: [], maintenanceRequirements: [] },
    cost_quantities: { budget: { mode: "legacy_basis_unspecified", originalValue: "1000", note: "Unit not recorded" }, costCategories: [] },
    supply: { procurementStrategy: "UAE-first", availabilityRequirements: [], leadTimeConstraints: [], approvedAlternativesRequired: true },
    risk_compliance: { risks: [{ title: "Approval", impact: "medium", mitigation: "Qualified review" }], preliminaryChecks: [], professionalReviewRequired: true },
    concept_media: { moodKeywords: ["Calm"], visualObjectives: ["Show material hierarchy"], negativeConstraints: [], nonContractual: true },
    governance: { decisionOwners: [{ role: "Design lead", responsibility: "Review" }], reviewCadence: "Weekly" },
  } as const;

  it.each(Object.keys(fixtures) as Array<keyof typeof fixtures>)("validates the %s editor contract", sectionId => {
    const value = parseBriefSectionContentV1(sectionId, { ...common, sectionId, ...fixtures[sectionId] });
    expect(value.sectionId).toBe(sectionId);
    expect(value.schemaVersion).toBe(BRIEF_SECTION_CONTENT_SCHEMA_VERSION);
  });

  it("validates content against its selected section", () => {
    expect(parseBriefSectionContentV1("intent", {
      ...common,
      sectionId: "intent",
      objectives: ["Improve resident experience"],
      successCriteria: [],
      targetUsers: ["Residents"],
    }).sectionId).toBe("intent");
    expect(() => parseBriefSectionContentV1("asset_context", {
      ...common,
      sectionId: "intent",
      objectives: ["Improve resident experience"],
    })).toThrow(/not asset_context/);
  });

  it("normalizes area and rates deterministically in both directions", () => {
    expect(normalizeArea("100", "m2")).toEqual({ squareMetres: "100.0000", squareFeet: "1076.3900" });
    expect(normalizeArea("1076.39", "ft2").squareMetres).toBe("100.0000");
    expect(normalizeRate("100", "aed_per_ft2")).toEqual({ aedPerSquareMetre: "1076.3900", aedPerSquareFoot: "100.0000" });
    expect(normalizeRate("1076.39", "aed_per_m2").aedPerSquareFoot).toBe("100.0000");
  });

  it("derives total AED only from a complete named unit-rate basis", () => {
    const content = parseBriefSectionContentV1("cost_quantities", {
      ...common,
      sectionId: "cost_quantities",
      budget: {
        mode: "unit_rate",
        enteredRate: "250.125",
        rateUnit: "aed_per_ft2",
        areaBasis: "fitout",
        enteredArea: "1076.39",
        areaUnit: "ft2",
        metadata: {
          areaSource: "Approved space programme",
          areaSourceVersion: "v3",
          costBaseDate: "2026-07-21",
          inclusions: ["Hard finishes"],
          exclusions: ["Loose furniture"],
          feesIncluded: false,
          vatIncluded: false,
          contingencyIncluded: true,
          escalationIncluded: false,
        },
      },
      costCategories: [],
    });
    expect(content.budget).toMatchObject({
      normalizedArea: { squareMetres: "100.0000" },
      normalizedRate: { aedPerSquareMetre: "2692.3205" },
      normalizedTotalAed: "269232.05",
    });
    expect(parseBriefSectionContentV1("cost_quantities", content)).toEqual(content);
  });

  it("rejects incomplete unit-rate inputs and preserves ambiguous legacy values without deriving affordability", () => {
    expect(() => parseBriefSectionContentV1("cost_quantities", {
      ...common,
      sectionId: "cost_quantities",
      budget: { mode: "unit_rate", enteredRate: "100", rateUnit: "aed_per_m2" },
    })).toThrow();
    const legacy = parseBriefSectionContentV1("cost_quantities", {
      ...common,
      sectionId: "cost_quantities",
      budget: { mode: "legacy_basis_unspecified", originalValue: "1500", note: "Imported field had no unit." },
    });
    expect(legacy.budget).toEqual({ mode: "legacy_basis_unspecified", originalValue: "1500", note: "Imported field had no unit." });
    expect(legacy.budget).not.toHaveProperty("normalizedTotalAed");
    expect(() => parseBriefSectionContentV1("cost_quantities", {
      ...common,
      sectionId: "cost_quantities",
      budget: { mode: "total_aed", enteredTotalAed: "0", metadata: {} },
    })).toThrow();
  });

  it("uses one half-up rounding rule for AED totals", () => {
    const content = parseBriefSectionContentV1("cost_quantities", {
      ...common,
      sectionId: "cost_quantities",
      budget: {
        mode: "total_aed",
        enteredTotalAed: "1.005",
        metadata: {
          areaSource: "Client budget",
          areaSourceVersion: "v1",
          costBaseDate: "2026-07-21",
          inclusions: [], exclusions: [], feesIncluded: false, vatIncluded: false,
          contingencyIncluded: false, escalationIncluded: false,
        },
      },
      costCategories: [],
    });
    expect(content.budget.normalizedTotalAed).toBe("1.01");
  });

  it("keeps old JSON readable but never promotes it", () => {
    expect(readBriefSectionContent("intent", "BR-03-v1", { narrative: "Legacy" })).toEqual({
      kind: "legacy",
      schemaVersion: "BR-03-v1",
      content: { narrative: "Legacy" },
    });
  });
});
