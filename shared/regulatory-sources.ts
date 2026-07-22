import { z } from "zod";

export const regulatoryAuthorityScopeSchema = z.enum([
  "dubai_municipality",
  "dubai_civil_defence",
  "dubai_department_economy_tourism",
  "dubai_legislation_portal",
  "dubai_development_authority",
  "trakhees_pcfc",
  "difc",
  "dubai_south",
]);

export const regulatorySourceClassSchema = z.enum([
  "building_code",
  "amendment_index",
  "circular_index",
  "fire_life_safety",
  "accessibility",
  "sustainability",
  "food_layout",
  "food_operations",
  "hospitality_legislation",
  "hospitality_classification",
  "authority_overlay",
]);

export const regulatorySourceRegistrationSchema = z.object({
  sourceKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/),
  title: z.string().min(3).max(255),
  issuingAuthority: regulatoryAuthorityScopeSchema,
  sourceClass: regulatorySourceClassSchema,
  jurisdiction: z.string().min(2).max(128),
  languages: z.array(z.enum(["ar", "en"])).min(1),
  canonicalUrl: z.string().url().refine(value => new URL(value).protocol === "https:", "Official sources must use HTTPS"),
  approvedHosts: z.array(z.string().toLowerCase().regex(/^[a-z0-9.-]+$/)).min(1),
  retentionPolicy: z.enum(["metadata_only", "artifact_permitted", "prohibited", "pending_review"]),
  licensingStatus: z.enum(["permitted", "restricted", "prohibited", "pending_review"]),
  coverageStatus: z.enum(["supported", "candidate", "unsupported"]),
  notes: z.string().max(1_000),
}).strict();

export type RegulatorySourceRegistration = z.infer<typeof regulatorySourceRegistrationSchema>;

/**
 * A discovered link is not itself a source registration. It must be promoted via
 * `registerDiscoveredRegulatoryDocument`, which pins it to an existing official
 * parent and inherits only that parent's exact host allowlist.
 */
export const regulatoryDiscoveredDocumentSchema = z.object({
  parentSourceKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/),
  sourceKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/),
  title: z.string().min(3).max(255),
  canonicalUrl: z.string().url().refine(value => new URL(value).protocol === "https:", "Discovered documents must use HTTPS"),
}).strict().superRefine((value, ctx) => {
  if (!value.sourceKey.startsWith(`${value.parentSourceKey}.`)) {
    ctx.addIssue({ code: "custom", path: ["sourceKey"], message: "Child source key must be namespaced under its parent source" });
  }
  const url = new URL(value.canonicalUrl);
  if (url.pathname === "/" || !url.pathname.split("/").filter(Boolean).length) {
    ctx.addIssue({ code: "custom", path: ["canonicalUrl"], message: "Discovered document must identify an exact artifact path" });
  }
});

export type RegulatoryDiscoveredDocument = z.infer<typeof regulatoryDiscoveredDocumentSchema>;

export const regulatoryDiscoveredDocumentReviewSchema = z.object({
  sourceKey: regulatoryDiscoveredDocumentSchema.shape.sourceKey,
  canonicalUrl: regulatoryDiscoveredDocumentSchema.shape.canonicalUrl,
  retentionPolicy: z.literal("artifact_permitted"),
  licensingStatus: z.literal("permitted"),
  reviewedBy: z.string().min(1).max(128),
  reviewedAt: z.string().datetime(),
}).strict();

export type RegulatoryDiscoveredDocumentReview = z.infer<typeof regulatoryDiscoveredDocumentReviewSchema>;

const candidate = (
  registration: Omit<RegulatorySourceRegistration, "languages" | "retentionPolicy" | "licensingStatus" | "coverageStatus"> &
    Partial<Pick<RegulatorySourceRegistration, "languages" | "retentionPolicy" | "licensingStatus" | "coverageStatus">>,
): RegulatorySourceRegistration => regulatorySourceRegistrationSchema.parse({
  languages: ["ar", "en"],
  retentionPolicy: "pending_review",
  licensingStatus: "pending_review",
  coverageStatus: "candidate",
  ...registration,
});

/**
 * Seed catalogue only. Registration does not establish currency, permitted
 * retention, authenticity, or regulatory meaning. Those require a captured
 * source version plus separate platform assertions.
 */
export const DUBAI_REGULATORY_SOURCE_CATALOGUE = [
  candidate({ sourceKey: "dm.dubai-building-code", title: "Dubai Building Code and calculation schedules", issuingAuthority: "dubai_municipality", sourceClass: "building_code", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/planning-and-construction/dubai-building-code-2/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "DBC 2021 landing page and official schedules; each downloadable document is versioned separately." }),
  candidate({ sourceKey: "dm.dbc-calculation-schedules", title: "Dubai Building Code calculation schedules discovery", issuingAuthority: "dubai_municipality", sourceClass: "building_code", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/planning-and-construction/dubai-building-code-2/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Dedicated monitor target; every discovered schedule requires its own exact document version and fingerprint." }),
  candidate({ sourceKey: "dm.building-regulation-amendments", title: "Buildings Regulation and Permits Agency laws and amendments", issuingAuthority: "dubai_municipality", sourceClass: "amendment_index", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/buildings-regulation-permits-agency/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Monitor for later DBC amendments; an index change is a review candidate, not automatic repeal." }),
  candidate({ sourceKey: "dm.building-planning-circulars", title: "Building and Planning Circulars", issuingAuthority: "dubai_municipality", sourceClass: "circular_index", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/building-planning-circulars-2/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Includes fit-out, use-change, villa, accessibility and Al Sa'fat circular candidates." }),
  candidate({ sourceKey: "dcd.fire-life-safety-code", title: "UAE Fire and Life Safety Code of Practice", issuingAuthority: "dubai_civil_defence", sourceClass: "fire_life_safety", jurisdiction: "Dubai (Dubai Civil Defence)", canonicalUrl: "https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp", approvedHosts: ["www.dcd.gov.ae", "dcd.gov.ae"], notes: "2018 code plus separately fingerprinted active annexures and submission/material/responsibility documents. Observed 2026-07-22: the landing page lists the September 2018 code PDF only." }),
  candidate({ sourceKey: "dcd.active-annexures-index", title: "Dubai Civil Defence active annexures discovery", issuingAuthority: "dubai_civil_defence", sourceClass: "amendment_index", jurisdiction: "Dubai (Dubai Civil Defence)", canonicalUrl: "https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp", approvedHosts: ["www.dcd.gov.ae", "dcd.gov.ae"], notes: "Dedicated index monitor; annexures remain independent versions and never silently replace the code. Observed 2026-07-22: no annexure index was listed on the corrected landing page." }),
  candidate({ sourceKey: "dcd.drawing-submission-requirements", title: "Dubai Civil Defence drawing-submission requirements discovery", issuingAuthority: "dubai_civil_defence", sourceClass: "fire_life_safety", jurisdiction: "Dubai (Dubai Civil Defence)", canonicalUrl: "https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp", approvedHosts: ["www.dcd.gov.ae", "dcd.gov.ae"], notes: "Discovery target only until the exact active official document is captured. Observed 2026-07-22: not listed on the corrected landing page, so the artifact location is unresolved." }),
  candidate({ sourceKey: "dcd.material-requirements", title: "Dubai Civil Defence material requirements discovery", issuingAuthority: "dubai_civil_defence", sourceClass: "fire_life_safety", jurisdiction: "Dubai (Dubai Civil Defence)", canonicalUrl: "https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp", approvedHosts: ["www.dcd.gov.ae", "dcd.gov.ae"], notes: "Discovery target only until the exact active official document is captured. Observed 2026-07-22: not listed on the corrected landing page, so the artifact location is unresolved." }),
  candidate({ sourceKey: "dcd.stakeholder-responsibilities", title: "Dubai Civil Defence stakeholder-responsibility documents discovery", issuingAuthority: "dubai_civil_defence", sourceClass: "fire_life_safety", jurisdiction: "Dubai (Dubai Civil Defence)", canonicalUrl: "https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp", approvedHosts: ["www.dcd.gov.ae", "dcd.gov.ae"], notes: "Discovery target only until the exact active official document is captured. Observed 2026-07-22: not listed on the corrected landing page, so the artifact location is unresolved." }),
  candidate({ sourceKey: "dm.universal-design-code", title: "Dubai Universal Design Code and guidance", issuingAuthority: "dubai_municipality", sourceClass: "accessibility", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/dubai-universal-design-code/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Code, accessibility guide and villa guidance are separate document versions." }),
  candidate({ sourceKey: "dm.accessibility-guide", title: "Dubai accessibility guide discovery", issuingAuthority: "dubai_municipality", sourceClass: "accessibility", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/dubai-universal-design-code/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Dedicated guide target; exact artifact is separately fingerprinted." }),
  candidate({ sourceKey: "dm.universal-design-villa-guidance", title: "Dubai universal-design villa guidance discovery", issuingAuthority: "dubai_municipality", sourceClass: "accessibility", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/dubai-universal-design-code/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Dedicated villa guide target; exact artifact is separately fingerprinted." }),
  candidate({ sourceKey: "dm.al-safat", title: "Al Sa'fat Dubai Green Building System", issuingAuthority: "dubai_municipality", sourceClass: "sustainability", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/green-building-certification/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Monitor current practice material and the official 2020/2023 amendment trail." }),
  candidate({ sourceKey: "dm.al-safat-practice-amendments", title: "Al Sa'fat practice material and amendments discovery", issuingAuthority: "dubai_municipality", sourceClass: "amendment_index", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/green-building-certification/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Dedicated monitor for independently versioned practice material and amendments." }),
  candidate({ sourceKey: "dm.food-establishment-layout", title: "Food Code and food-establishment layout requirements", issuingAuthority: "dubai_municipality", sourceClass: "food_layout", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/food-traders-establishments/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Layout/design approval material only becomes a pack rule after clause-level professional review." }),
  candidate({ sourceKey: "dm.food-code", title: "Dubai Municipality Food Code discovery", issuingAuthority: "dubai_municipality", sourceClass: "food_layout", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/food-traders-establishments/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Dedicated Food Code target; exact edition and clauses require capture and review." }),
  candidate({ sourceKey: "dm.food-activity-requirements", title: "Food requirements by activity discovery", issuingAuthority: "dubai_municipality", sourceClass: "food_layout", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/food-traders-establishments/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Dedicated activity-requirement index target." }),
  candidate({ sourceKey: "dm.food-kitchen-guidance", title: "Kitchen and food-preparation health and safety guidance discovery", issuingAuthority: "dubai_municipality", sourceClass: "food_operations", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/food-traders-establishments/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Operational guidance is separately versioned and cannot automatically create a room-area rule." }),
  candidate({ sourceKey: "dm.food-operations", title: "Food-establishment operational guidance", issuingAuthority: "dubai_municipality", sourceClass: "food_operations", jurisdiction: "Dubai (Dubai Municipality)", canonicalUrl: "https://www.dm.gov.ae/municipality-business/food-traders-establishments/", approvedHosts: ["www.dm.gov.ae", "dm.gov.ae"], notes: "Operational guidance remains distinct and cannot automatically create room-area rules." }),
  candidate({ sourceKey: "dlp.hotel-establishment-decree-17-2013", title: "Hotel Establishment licensing and classification decree", issuingAuthority: "dubai_legislation_portal", sourceClass: "hospitality_legislation", jurisdiction: "Dubai", canonicalUrl: "https://dlp.dubai.gov.ae/Legislation%20Reference/2013/Decree%2017%20of%202013.html", approvedHosts: ["dlp.dubai.gov.ae"], notes: "Decree No. 17 of 2013; currency is resolved through portal relations and assertions." }),
  candidate({ sourceKey: "dlp.hotel-classification-resolution-1-2018", title: "Hotel classification administrative resolution", issuingAuthority: "dubai_legislation_portal", sourceClass: "hospitality_legislation", jurisdiction: "Dubai", canonicalUrl: "https://dlp.dubai.gov.ae/Legislation%20Reference/2018/Administative%20Resolution%20No.%20%281%29%20of%202018.html", approvedHosts: ["dlp.dubai.gov.ae"], notes: "Administrative Resolution No. 1 of 2018." }),
  candidate({ sourceKey: "dlp.holiday-home-decree-41-2013", title: "Holiday Home Decree", issuingAuthority: "dubai_legislation_portal", sourceClass: "hospitality_legislation", jurisdiction: "Dubai", canonicalUrl: "https://dlp.dubai.gov.ae/Legislation%20Reference/2013/Decree%20No.%20%2841%29%20of%202013.html", approvedHosts: ["dlp.dubai.gov.ae"], notes: "Decree No. 41 of 2013." }),
  candidate({ sourceKey: "dlp.holiday-home-resolution-1-2020", title: "Holiday Home implementing bylaw", issuingAuthority: "dubai_legislation_portal", sourceClass: "hospitality_legislation", jurisdiction: "Dubai", canonicalUrl: "https://dlp.dubai.gov.ae/Legislation%20Reference/2020/Administrative%20Resolution%20No.%20%281%29%20of%202020.html", approvedHosts: ["dlp.dubai.gov.ae"], notes: "Administrative Resolution No. 1 of 2020." }),
  candidate({ sourceKey: "dlp.legislative-currency-index", title: "Dubai Legislation Portal legislative currency monitor", issuingAuthority: "dubai_legislation_portal", sourceClass: "amendment_index", jurisdiction: "Dubai", canonicalUrl: "https://dlp.dubai.gov.ae/", approvedHosts: ["dlp.dubai.gov.ae"], notes: "Monitor only; portal appearance or disappearance never establishes repeal without a relation assertion." }),
  candidate({ sourceKey: "det.hotel-classification-current", title: "Current hotel and hotel-apartment classification criteria", issuingAuthority: "dubai_department_economy_tourism", sourceClass: "hospitality_classification", jurisdiction: "Dubai", canonicalUrl: "https://www.dubaitourism.gov.ae/", approvedHosts: ["www.dubaitourism.gov.ae", "dubaitourism.gov.ae"], notes: "Discovery entry only. Hospitality candidates fail closed until an exact, current, authorized DET document is captured and asserted." }),
  candidate({ sourceKey: "dda.authority-overlay", title: "Dubai Development Authority overlay", issuingAuthority: "dubai_development_authority", sourceClass: "authority_overlay", jurisdiction: "Dubai Development Authority", canonicalUrl: "https://dda.gov.ae/", approvedHosts: ["dda.gov.ae", "www.dda.gov.ae"], coverageStatus: "unsupported", notes: "Recorded scope only; projects fail closed until an approved overlay exists." }),
  candidate({ sourceKey: "trakhees-pcfc.authority-overlay", title: "Trakhees/PCFC authority overlay", issuingAuthority: "trakhees_pcfc", sourceClass: "authority_overlay", jurisdiction: "Trakhees/PCFC", canonicalUrl: "https://www.trakhees.ae/", approvedHosts: ["www.trakhees.ae", "trakhees.ae"], coverageStatus: "unsupported", notes: "Recorded scope only; projects fail closed until an approved overlay exists." }),
  candidate({ sourceKey: "difc.authority-overlay", title: "DIFC authority overlay", issuingAuthority: "difc", sourceClass: "authority_overlay", jurisdiction: "DIFC", canonicalUrl: "https://www.difc.com/", approvedHosts: ["www.difc.com", "difc.com"], coverageStatus: "unsupported", notes: "Recorded scope only; projects fail closed until an approved overlay exists." }),
  candidate({ sourceKey: "dubai-south.authority-overlay", title: "Dubai South authority overlay", issuingAuthority: "dubai_south", sourceClass: "authority_overlay", jurisdiction: "Dubai South", canonicalUrl: "https://www.dubaisouth.ae/", approvedHosts: ["www.dubaisouth.ae", "dubaisouth.ae"], coverageStatus: "unsupported", notes: "Recorded scope only; projects fail closed until an approved overlay exists." }),
] as const satisfies readonly RegulatorySourceRegistration[];

export const DUBAI_REGULATORY_SOURCE_BY_KEY: ReadonlyMap<string, RegulatorySourceRegistration> = new Map(
  DUBAI_REGULATORY_SOURCE_CATALOGUE.map(source => [source.sourceKey, source]),
);

/**
 * Creates a candidate registration for a single, exact official child artifact.
 * It does not approve retrieval, retention, licensing, authenticity or meaning;
 * those remain separate platform-governed decisions.
 */
export function registerDiscoveredRegulatoryDocument(input: RegulatoryDiscoveredDocument): RegulatorySourceRegistration {
  const child = regulatoryDiscoveredDocumentSchema.parse(input);
  const parent = DUBAI_REGULATORY_SOURCE_BY_KEY.get(child.parentSourceKey);
  if (!parent) throw new Error(`Unknown regulatory parent source: ${child.parentSourceKey}`);
  if (DUBAI_REGULATORY_SOURCE_BY_KEY.has(child.sourceKey)) throw new Error(`Discovered source key already exists in the catalogue: ${child.sourceKey}`);
  const host = new URL(child.canonicalUrl).hostname.toLowerCase();
  if (!parent.approvedHosts.includes(host)) {
    throw new Error(`Discovered artifact host ${host} is not approved for ${parent.sourceKey}`);
  }
  return regulatorySourceRegistrationSchema.parse({
    ...parent,
    sourceKey: child.sourceKey,
    title: child.title,
    canonicalUrl: child.canonicalUrl,
    // An index/link discovery may identify an artifact but must never grant it use.
    retentionPolicy: "pending_review",
    licensingStatus: "pending_review",
    coverageStatus: "candidate",
    notes: `Child artifact discovered under ${parent.sourceKey}; exact URL is host-constrained and remains pending platform review.`,
  });
}

/** Promotes only an exact discovered URL after a separate named policy review. */
export function registerReviewedRegulatoryDocument(
  input: RegulatoryDiscoveredDocument,
  reviewInput: RegulatoryDiscoveredDocumentReview,
): RegulatorySourceRegistration {
  const candidate = registerDiscoveredRegulatoryDocument(input);
  const review = regulatoryDiscoveredDocumentReviewSchema.parse(reviewInput);
  if (review.sourceKey !== candidate.sourceKey || review.canonicalUrl !== candidate.canonicalUrl) {
    throw new Error("Discovered document review must bind the exact source key and canonical URL");
  }
  return regulatorySourceRegistrationSchema.parse({
    ...candidate,
    retentionPolicy: review.retentionPolicy,
    licensingStatus: review.licensingStatus,
    notes: `Child artifact reviewed by ${review.reviewedBy} at ${review.reviewedAt}; acquisition remains subject to its separate source-key policy.`,
  });
}

export const regulatoryPublicCitationSchema = z.object({
  sourceKey: z.string(),
  title: z.string(),
  issuingAuthority: regulatoryAuthorityScopeSchema,
  jurisdiction: z.string(),
  versionKey: z.string(),
  contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  locator: z.string().min(1),
  canonicalUrl: z.string().url(),
  publicationDate: z.string().date().nullable(),
  effectiveFrom: z.string().date().nullable(),
}).strict();

export type RegulatoryPublicCitation = z.infer<typeof regulatoryPublicCitationSchema>;
