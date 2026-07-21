import { type TypologyPackV2Candidate, validateTypologyPackV2Candidate } from "@shared/typology-pack-v2";
import { fingerprintTypologyPackV2Content } from "../../typology-pack-v2";

/**
 * These are deliberately source-discovery candidates, not rules. They contain
 * no numeric programme, room, adjacency, or compliance claim until an exact
 * captured source version and named professional review are available.
 */
const author = "miyar-br06-candidate-preparation";
const base = (input: Omit<Extract<TypologyPackV2Candidate, { kind: "atomic" }>, "schemaVersion" | "engineVersion" | "authoredBy" | "sections" | "rooms" | "adjacencies" | "responsibilities" | "requirements" | "risks" | "candidateNotes">): TypologyPackV2Candidate => validateTypologyPackV2Candidate({
  schemaVersion: "typology-pack/v2",
  engineVersion: "constraint-engine/v2",
  authoredBy: author,
  sections: [], rooms: [], adjacencies: [], responsibilities: [], requirements: [], risks: [],
  candidateNotes: ["Candidate only. No project rule may resolve until exact source captures and four named professional approvals are bound in a platform release envelope."],
  ...input,
});

const commonBuildingSources = [
  "dm.dubai-building-code", "dm.dbc-calculation-schedules", "dm.building-regulation-amendments",
  "dm.building-planning-circulars", "dcd.fire-life-safety-code", "dcd.active-annexures-index",
  "dm.universal-design-code", "dm.accessibility-guide", "dm.al-safat",
] as const;

const atomicCandidates = [
  base({ kind: "atomic", packId: "dubai-apartment", version: "0.0.1", family: "apartment", title: "Dubai apartment candidate", candidateSourceKeys: [...commonBuildingSources], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-villa", version: "0.0.1", family: "villa", title: "Dubai villa candidate", candidateSourceKeys: [...commonBuildingSources, "dm.universal-design-villa-guidance"], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-residential-building", version: "0.0.1", family: "residential_building", title: "Dubai residential building candidate", candidateSourceKeys: [...commonBuildingSources], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-office", version: "0.0.1", family: "office", title: "Dubai office candidate", candidateSourceKeys: [...commonBuildingSources, "dcd.drawing-submission-requirements"], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-hotel", version: "0.0.1", family: "hospitality", variant: "hotel", title: "Dubai hotel candidate", candidateSourceKeys: [...commonBuildingSources, "dlp.hotel-establishment-decree-17-2013", "dlp.hotel-classification-resolution-1-2018", "det.hotel-classification-current"], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_department_economy_tourism", "dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-serviced-apartment", version: "0.0.1", family: "hospitality", variant: "serviced_apartment", title: "Dubai serviced-apartment candidate", candidateSourceKeys: [...commonBuildingSources, "dlp.holiday-home-decree-41-2013", "dlp.holiday-home-resolution-1-2020", "det.hotel-classification-current"], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_department_economy_tourism", "dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-food-beverage", version: "0.0.1", family: "food_beverage", title: "Dubai food and beverage candidate", candidateSourceKeys: [...commonBuildingSources, "dm.food-code", "dm.food-activity-requirements", "dm.food-establishment-layout", "dm.food-kitchen-guidance", "dm.food-operations"], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
  base({ kind: "atomic", packId: "dubai-retail", version: "0.0.1", family: "retail", title: "Dubai retail candidate", candidateSourceKeys: [...commonBuildingSources], applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] } }),
] as const;

for (const candidate of atomicCandidates) {
  if (candidate.family === "hospitality") {
    candidate.candidateNotes.push("Blocked: an exact current DET hotel/hotel-apartment classification document has not been captured from an authorized official source.");
  }
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export const DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES = Object.freeze(atomicCandidates.map(deepFreeze));

const byId = new Map(DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES.map(pack => [pack.packId, pack]));
const component = (packId: "dubai-apartment" | "dubai-retail") => {
  const pack = byId.get(packId)!;
  return { packId: pack.packId, version: pack.version, contentFingerprint: fingerprintTypologyPackV2Content(pack), family: pack.family } as const;
};

export const DUBAI_MIXED_USE_TYPOLOGY_PACK_V2_CANDIDATE: TypologyPackV2Candidate = validateTypologyPackV2Candidate({
  schemaVersion: "typology-pack/v2", engineVersion: "constraint-engine/v2", kind: "mixed_use",
  packId: "dubai-mixed-use", version: "0.0.1", family: "mixed_use", title: "Dubai mixed-use candidate", authoredBy: author,
  applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality", "dubai_civil_defence"], permitBasis: "permit_date", projectConditions: [] },
  sections: [], rooms: [], adjacencies: [], responsibilities: [], requirements: [], risks: [],
  components: [component("dubai-apartment"), component("dubai-retail")],
  candidateSourceKeys: [...commonBuildingSources],
  candidateNotes: ["Candidate composition pins exact component fingerprints. A component without a platform release blocks the composition."],
});

/** Eight product-facing families; hospitality has two immutable product variants. */
export const DUBAI_TYPOLOGY_PACK_V2_CANDIDATES = Object.freeze([
  ...DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES,
  DUBAI_MIXED_USE_TYPOLOGY_PACK_V2_CANDIDATE,
]);
