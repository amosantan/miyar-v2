import {
  listApprovedPaintCoverageProfiles,
  listGlobalGovernedValueCandidatesForSpecifications,
  listGlobalMaterialResolutionIdentities,
  listGovernedValueCandidatesForSpecifications,
  listLegacyCompatibilityPriceRows,
  listMaterialResolutionIdentities,
  listMaterialResolutionSpecifications,
  type GovernedValueCandidate,
  type ApprovedPaintCoverageProfileRow,
  type MaterialResolutionIdentityRow,
  type MaterialResolutionSpecificationRow,
  type LegacyCompatibilityPriceRow,
} from "../../db/material-pricing";
import {
  MATERIAL_RESOLUTION_POLICY_VERSION,
  type MaterialIdentityReference,
  type MaterialPriceInsufficiencyReason,
  type MaterialPriceSnapshot,
  type SafeMaterialPriceProvenance,
} from "../../../shared/material-calculations";
import {
  UAE_PRICE_GEOGRAPHIES,
  type GovernedMaterialValueInsufficiency,
  type PriceScope,
  type PriceUnitBasis,
  type SourceLadderRung,
  type UaePriceGeography,
} from "../../../shared/material-pricing";
import {
  materialCatalogCategoryToCanonical,
  materialCatalogTierToFinish,
  materialLibraryCategoryToCanonical,
  materialLibraryTierToFinish,
  normalizeUnitBasis,
  exactDecimalMidpoint,
} from "./policy";
import { resolveGovernedMaterialValueFromCandidates } from "./resolver";
import {
  assertMaterialPricingEvidenceMatchesLiveEligibleSet,
  assertGovernedSnapshotsMatchApprovedEvidence,
  assertMaterialPricingRolloutGate,
  buildMaterialPricingRuntimeComparisonEvidence,
  loadMaterialPricingRolloutGate,
  type MaterialPricingRuntimeComparisonEvidence,
  type MaterialPricingRolloutGate,
} from "./rollout-comparison";

type MappedIdentity = MaterialResolutionIdentityRow & {
  reference: MaterialIdentityReference;
  canonicalCategory: string;
  finishLevel: string | null;
  unitBasis: PriceUnitBasis | null;
};

const SAFE_SOURCE_LABEL: Readonly<Record<SourceLadderRung, string>> = {
  supplier_quote: "Organization supplier quote",
  official_statistic: "Official statistic",
  consultancy_benchmark: "Consultancy-derived benchmark",
  market_observation: "Governed market-observation benchmark",
  retail_sanity: "Retail sanity band",
  assumption: "MIYAR assumption",
};

export function resolveProjectMaterialPriceGeography(
  value: unknown
): UaePriceGeography {
  return typeof value === "string" &&
    (UAE_PRICE_GEOGRAPHIES as readonly string[]).includes(value)
    ? (value as UaePriceGeography)
    : "uae";
}

export function attachPaintCoverageProfiles(
  snapshots: readonly MaterialPriceSnapshot[],
  coverageProfiles: readonly ApprovedPaintCoverageProfileRow[]
): MaterialPriceSnapshot[] {
  return snapshots.map(snapshot => {
    if (snapshot.state !== "resolved" || snapshot.unitBasis !== "per_litre") {
      return snapshot;
    }
    const matches = coverageProfiles.filter(
      profile =>
        profile.productId === snapshot.productId &&
        profile.specId === snapshot.specificationId
    );
    if (matches.length === 0) {
      return { ...snapshot, paintCoverageState: "fallback" as const };
    }
    if (matches.length > 1) {
      return { ...snapshot, paintCoverageState: "invalid" as const };
    }
    const profile = matches[0];
    const coverage = Number(profile.coverageM2PerLitrePerCoat);
    const wastePct = Number(profile.wastePct);
    const packSizes = profile.packSizesLitres.map(Number);
    if (
      profile.lineageValid === false ||
      profile.reviewedBy === null ||
      profile.reviewedBy <= 0 ||
      !(profile.reviewedAt instanceof Date) ||
      !Number.isFinite(profile.reviewedAt.getTime()) ||
      profile.reviewedAt.getTime() >
        new Date(snapshot.resolverAsOf).getTime() ||
      !/^sha256:[a-f0-9]{64}$/i.test(profile.sourceDocumentDigest) ||
      !profile.policyVersion.trim() ||
      !Number.isFinite(coverage) ||
      coverage <= 0 ||
      !Number.isInteger(profile.coatCount) ||
      profile.coatCount <= 0 ||
      !Number.isFinite(wastePct) ||
      wastePct < 0 ||
      packSizes.length === 0 ||
      packSizes.some(size => !Number.isFinite(size) || size <= 0)
    ) {
      return { ...snapshot, paintCoverageState: "invalid" as const };
    }
    return {
      ...snapshot,
      paintCoverageState: "approved" as const,
      paintCoverageProfile: {
        profileId: profile.id,
        policyVersion: profile.policyVersion,
        coverageM2PerLitrePerCoat: profile.coverageM2PerLitrePerCoat,
        coatCount: profile.coatCount,
        wastePct: profile.wastePct,
        effectiveAt: profile.effectiveAt.toISOString(),
        sourceDocumentDigest: profile.sourceDocumentDigest,
        packSizesLitres: profile.packSizesLitres,
      },
    };
  });
}

function mapIdentity(row: MaterialResolutionIdentityRow): MappedIdentity {
  const isLibrary = row.source === "material_library";
  return {
    ...row,
    reference: { source: row.source, legacyId: row.legacyId },
    canonicalCategory: isLibrary
      ? materialLibraryCategoryToCanonical(row.category)
      : materialCatalogCategoryToCanonical(row.category),
    finishLevel: isLibrary
      ? materialLibraryTierToFinish(row.tier)
      : materialCatalogTierToFinish(row.tier),
    unitBasis: normalizeUnitBasis(row.unit),
  };
}

function specificationKey(input: {
  category: string;
  finishLevel: string;
  unitBasis: PriceUnitBasis;
  geography: UaePriceGeography;
}): string {
  return [
    input.category,
    input.finishLevel,
    input.unitBasis,
    input.geography,
  ].join("\u0000");
}

function insufficiency(input: {
  reference: MaterialIdentityReference;
  asOf: Date;
  requestedGeography: UaePriceGeography;
  priceScope: PriceScope;
  reason: MaterialPriceInsufficiencyReason;
  productId?: number;
  specificationId?: number;
}): MaterialPriceSnapshot {
  return {
    state: "insufficient",
    policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
    reference: input.reference,
    resolverAsOf: input.asOf.toISOString(),
    requestedGeography: input.requestedGeography,
    requestedPriceScope: input.priceScope,
    reason: input.reason,
    ...(input.productId === undefined ? {} : { productId: input.productId }),
    ...(input.specificationId === undefined
      ? {}
      : { specificationId: input.specificationId }),
  };
}

function mapResolverReason(
  reason: GovernedMaterialValueInsufficiency["reason"]
): MaterialPriceInsufficiencyReason {
  return reason;
}

function safeProvenance(input: {
  sourceLadderRung: Exclude<SourceLadderRung, "retail_sanity">;
  provenancePolicyVersion: string | null;
  benchmarkVersion: string;
  isLegacyScopeFallback: boolean;
}): SafeMaterialPriceProvenance {
  return {
    sourceLadderRung: input.sourceLadderRung,
    sourceLabel: input.isLegacyScopeFallback
      ? "Legacy scope-unknown assumption"
      : SAFE_SOURCE_LABEL[input.sourceLadderRung],
    provenancePolicyVersion: input.provenancePolicyVersion ?? "legacy_unknown",
    benchmarkVersion: input.benchmarkVersion,
    compatibilityFallback: input.isLegacyScopeFallback,
  };
}

export function resolveMaterialPriceSnapshotsFromRows(input: {
  references: readonly MaterialIdentityReference[];
  identities: readonly MaterialResolutionIdentityRow[];
  specifications: readonly MaterialResolutionSpecificationRow[];
  candidates: readonly GovernedValueCandidate[];
  organizationId: number;
  priceScope: PriceScope;
  requestedGeography: UaePriceGeography;
  asOf: Date;
  allowLegacyUnknownScope: boolean;
}): MaterialPriceSnapshot[] {
  if (!Number.isFinite(input.asOf.getTime())) {
    throw new Error("Material resolution requires a valid explicit asOf clock");
  }
  const identityByReference = new Map(
    input.identities.map(row => [
      `${row.source}:${row.legacyId}`,
      mapIdentity(row),
    ])
  );
  const specificationsByKey = new Map<
    string,
    MaterialResolutionSpecificationRow[]
  >();
  for (const specification of input.specifications) {
    const key = specificationKey(specification);
    const rows = specificationsByKey.get(key) ?? [];
    rows.push(specification);
    specificationsByKey.set(key, rows);
  }
  const candidatesBySpecId = new Map<number, GovernedValueCandidate[]>();
  for (const candidate of input.candidates) {
    const rows = candidatesBySpecId.get(candidate.specId) ?? [];
    rows.push(candidate);
    candidatesBySpecId.set(candidate.specId, rows);
  }

  return input.references.map(reference => {
    const identity = identityByReference.get(
      `${reference.source}:${reference.legacyId}`
    );
    if (!identity || identity.productId === null) {
      return insufficiency({
        reference,
        asOf: input.asOf,
        requestedGeography: input.requestedGeography,
        priceScope: input.priceScope,
        reason: "identity_not_found",
      });
    }
    if (
      identity.productOrgId !== null &&
      identity.productOrgId !== input.organizationId
    ) {
      return insufficiency({
        reference,
        asOf: input.asOf,
        requestedGeography: input.requestedGeography,
        priceScope: input.priceScope,
        reason: "identity_not_found",
      });
    }
    if (identity.productCanonicalCategory !== identity.canonicalCategory) {
      return insufficiency({
        reference,
        asOf: input.asOf,
        requestedGeography: input.requestedGeography,
        priceScope: input.priceScope,
        reason: "identity_not_found",
      });
    }
    if (identity.finishLevel === null) {
      return insufficiency({
        reference,
        productId: identity.productId,
        asOf: input.asOf,
        requestedGeography: input.requestedGeography,
        priceScope: input.priceScope,
        reason: "unknown_finish_level",
      });
    }
    if (identity.unitBasis === null) {
      return insufficiency({
        reference,
        productId: identity.productId,
        asOf: input.asOf,
        requestedGeography: input.requestedGeography,
        priceScope: input.priceScope,
        reason: "unknown_unit_basis",
      });
    }
    const productId = identity.productId;

    const geographies =
      input.requestedGeography === "uae"
        ? (["uae"] as const)
        : ([input.requestedGeography, "uae"] as const);
    let lastReason: MaterialPriceInsufficiencyReason =
      "specification_not_found";
    let lastSpecificationId: number | undefined;
    for (const geography of geographies) {
      const specifications = specificationsByKey.get(
        specificationKey({
          category: identity.canonicalCategory,
          finishLevel: identity.finishLevel,
          unitBasis: identity.unitBasis,
          geography,
        })
      );
      if (!specifications || specifications.length === 0) continue;
      lastSpecificationId =
        specifications.length === 1 ? specifications[0].id : undefined;
      const resolutions = specifications.map(specification => ({
        specification,
        resolution: resolveGovernedMaterialValueFromCandidates(
          {
            specId: specification.id,
            productId,
            organizationId: input.organizationId,
            priceScope: input.priceScope,
            asOf: input.asOf,
            allowLegacyUnknownScope: input.allowLegacyUnknownScope,
          },
          candidatesBySpecId.get(specification.id) ?? []
        ),
      }));
      const ambiguous = resolutions.some(
        row =>
          row.resolution.status === "insufficient" &&
          row.resolution.reason === "ambiguous_governed_value"
      );
      const resolved = resolutions.filter(
        (
          row
        ): row is typeof row & {
          resolution: Extract<
            (typeof row)["resolution"],
            { status: "resolved" }
          >;
        } => row.resolution.status === "resolved"
      );
      if (ambiguous || resolved.length > 1) {
        lastReason = "ambiguous_governed_value";
        break;
      }
      if (resolved.length === 1) {
        const { specification, resolution } = resolved[0];
        return {
          state: "resolved",
          policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
          reference,
          productId,
          specificationId: specification.id,
          benchmarkProposalId: resolution.value.benchmarkProposalId,
          benchmarkVersionId: resolution.value.benchmarkVersionId,
          resolverAsOf: input.asOf.toISOString(),
          requestedGeography: input.requestedGeography,
          resolvedGeography: resolution.value.geography,
          usedUaeFallback:
            input.requestedGeography !== "uae" &&
            resolution.value.geography === "uae",
          requestedPriceScope: input.priceScope,
          resolvedPriceScope: resolution.value.priceScope,
          currency: "AED",
          unitBasis: resolution.value.unitBasis,
          priceMin: resolution.value.p25,
          priceMid: resolution.value.p50,
          priceMax: resolution.value.p75,
          weightedMean: resolution.value.weightedMean,
          provenance: safeProvenance(resolution.value),
        };
      }
      const firstInsufficient = resolutions.find(
        row => row.resolution.status === "insufficient"
      );
      if (firstInsufficient?.resolution.status === "insufficient") {
        lastReason = mapResolverReason(firstInsufficient.resolution.reason);
      }
    }
    return insufficiency({
      reference,
      productId,
      specificationId: lastSpecificationId,
      asOf: input.asOf,
      requestedGeography: input.requestedGeography,
      priceScope: input.priceScope,
      reason: lastReason,
    });
  });
}

type MaterialResolutionRequest = {
  references: readonly MaterialIdentityReference[];
  organizationId: number;
  priceScope: PriceScope;
  requestedGeography: UaePriceGeography;
  asOf: Date;
  allowLegacyUnknownScope?: boolean;
};

export type GlobalMaterialResolutionEvidenceDataSource = {
  listIdentities(input: {
    materialLibraryIds: number[];
    materialCatalogIds: number[];
  }): Promise<MaterialResolutionIdentityRow[]>;
  listSpecifications(input: {
    categories: string[];
    finishLevels: string[];
    unitBases: PriceUnitBasis[];
    geographies: UaePriceGeography[];
  }): Promise<MaterialResolutionSpecificationRow[]>;
  listCandidates(input: {
    specIds: number[];
  }): Promise<GovernedValueCandidate[]>;
  listCoverageProfiles(input: {
    productIds: number[];
    asOf: Date;
  }): Promise<ApprovedPaintCoverageProfileRow[]>;
};

async function resolveGovernedMaterialPriceSnapshots(
  input: MaterialResolutionRequest,
  options: {
    globalOnly: boolean;
    evidenceDataSource?: GlobalMaterialResolutionEvidenceDataSource;
  } = { globalOnly: false }
): Promise<MaterialPriceSnapshot[]> {
  const materialLibraryIds = input.references
    .filter(reference => reference.source === "material_library")
    .map(reference => reference.legacyId);
  const materialCatalogIds = input.references
    .filter(reference => reference.source === "materials_catalog")
    .map(reference => reference.legacyId);
  const identities = await (options.evidenceDataSource
    ? options.evidenceDataSource.listIdentities({
        materialLibraryIds,
        materialCatalogIds,
      })
    : options.globalOnly
      ? listGlobalMaterialResolutionIdentities({
          materialLibraryIds,
          materialCatalogIds,
        })
      : listMaterialResolutionIdentities({
          materialLibraryIds,
          materialCatalogIds,
        }));
  const mapped = identities.map(mapIdentity);
  const geographies = Array.from(
    new Set<UaePriceGeography>([input.requestedGeography, "uae"])
  );
  const specificationInput = {
    categories: Array.from(new Set(mapped.map(row => row.canonicalCategory))),
    finishLevels: Array.from(
      new Set(
        mapped
          .map(row => row.finishLevel)
          .filter((value): value is string => value !== null)
      )
    ),
    unitBases: Array.from(
      new Set(
        mapped
          .map(row => row.unitBasis)
          .filter((value): value is PriceUnitBasis => value !== null)
      )
    ),
    geographies,
  };
  const specifications = await (options.evidenceDataSource
    ? options.evidenceDataSource.listSpecifications(specificationInput)
    : listMaterialResolutionSpecifications(specificationInput));
  const candidates = await (options.evidenceDataSource
    ? options.evidenceDataSource.listCandidates({
        specIds: specifications.map(specification => specification.id),
      })
    : options.globalOnly
      ? listGlobalGovernedValueCandidatesForSpecifications({
          specIds: specifications.map(specification => specification.id),
        })
      : listGovernedValueCandidatesForSpecifications({
          specIds: specifications.map(specification => specification.id),
          organizationId: input.organizationId,
        }));
  const snapshots = resolveMaterialPriceSnapshotsFromRows({
    ...input,
    identities,
    specifications,
    candidates,
    allowLegacyUnknownScope: input.allowLegacyUnknownScope === true,
  });
  const litreSnapshots = snapshots.filter(
    snapshot =>
      snapshot.state === "resolved" && snapshot.unitBasis === "per_litre"
  );
  const coverageInput = {
    productIds: litreSnapshots
      .map(snapshot =>
        snapshot.state === "resolved" ? snapshot.productId : undefined
      )
      .filter((productId): productId is number => productId !== undefined),
    asOf: input.asOf,
  };
  const coverageProfiles = await (options.evidenceDataSource
    ? options.evidenceDataSource.listCoverageProfiles(coverageInput)
    : listApprovedPaintCoverageProfiles(coverageInput));
  return attachPaintCoverageProfiles(snapshots, coverageProfiles);
}

function legacyCompatibilitySnapshots(input: {
  requested: readonly MaterialIdentityReference[];
  governed: readonly MaterialPriceSnapshot[];
  legacyRows: readonly LegacyCompatibilityPriceRow[];
  requestedGeography: UaePriceGeography;
  priceScope: PriceScope;
  asOf: Date;
}): MaterialPriceSnapshot[] {
  const governedByReference = new Map(
    input.governed.map(snapshot => [
      `${snapshot.reference.source}:${snapshot.reference.legacyId}`,
      snapshot,
    ])
  );
  const legacyById = new Map(input.legacyRows.map(row => [row.legacyId, row]));
  return input.requested.map(reference => {
    const governed = governedByReference.get(
      `${reference.source}:${reference.legacyId}`
    );
    const legacy =
      reference.source === "material_library"
        ? legacyById.get(reference.legacyId)
        : undefined;
    // A cross-organization product is deliberately indistinguishable from a
    // missing identity and may never be resurrected by the compatibility path.
    if (
      governed?.state === "insufficient" &&
      governed.reason === "identity_not_found" &&
      governed.productId === undefined
    ) {
      return governed;
    }
    if (!legacy) {
      // Legacy/compare serving applies only to rows in the verified EV-02
      // compatibility baseline. A governed-only identity (including catalog
      // board items) passes through unchanged instead of being downgraded.
      if (governed) return governed;
      return insufficiency({
        reference,
        asOf: input.asOf,
        requestedGeography: input.requestedGeography,
        priceScope: input.priceScope,
        reason: "no_governed_value",
      });
    }
    const midpoint = exactDecimalMidpoint(legacy.priceMin, legacy.priceMax);
    return {
      state: "resolved",
      policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
      reference,
      productId: legacy.productId,
      specificationId: legacy.specId,
      benchmarkProposalId: legacy.benchmarkProposalId,
      benchmarkVersionId: legacy.benchmarkVersionId,
      resolverAsOf: input.asOf.toISOString(),
      requestedGeography: input.requestedGeography,
      resolvedGeography: legacy.geography,
      usedUaeFallback:
        input.requestedGeography !== "uae" && legacy.geography === "uae",
      requestedPriceScope: input.priceScope,
      resolvedPriceScope: "legacy_unknown",
      currency: "AED",
      unitBasis: legacy.unitBasis,
      priceMin: legacy.priceMin,
      priceMid: midpoint,
      priceMax: legacy.priceMax,
      weightedMean: midpoint,
      provenance: {
        sourceLadderRung: "assumption",
        sourceLabel: "Legacy scope-unknown assumption",
        provenancePolicyVersion:
          legacy.provenancePolicyVersion ?? "ev02-backfill-v1",
        benchmarkVersion: legacy.benchmarkVersion,
        compatibilityFallback: true,
      },
      ...(governed?.state === "resolved" && governed.unitBasis === "per_litre"
        ? {
            paintCoverageState: governed.paintCoverageState,
            paintCoverageProfile: governed.paintCoverageProfile,
          }
        : {}),
    };
  });
}

function assertLegacyServingRowsMatchBaseline(input: {
  legacyRows: readonly LegacyCompatibilityPriceRow[];
  gate: Extract<MaterialPricingRolloutGate, { mode: "compare" }>;
}): void {
  const evidenceByReference = new Map(
    input.gate.evidence.comparisons.map(comparison => [
      `${comparison.reference.source}:${comparison.reference.legacyId}`,
      comparison,
    ])
  );
  for (const row of input.legacyRows) {
    const evidence = evidenceByReference.get(
      `material_library:${row.legacyId}`
    );
    if (
      !evidence ||
      evidence.legacy.min !== row.priceMin ||
      evidence.legacy.max !== row.priceMax
    ) {
      throw new Error(
        `EV-03 legacy baseline is stale for material_library:${row.legacyId}`
      );
    }
  }
}

function recordSanitizedRuntimeComparison(
  evidence: MaterialPricingRuntimeComparisonEvidence
): void {
  console.info(`[ev03-material-pricing-compare] ${JSON.stringify(evidence)}`);
}

export function selectMaterialPricingRolloutSnapshots(input: {
  mode: "legacy" | "compare" | "governed";
  gate?: MaterialPricingRolloutGate;
  requested: readonly MaterialIdentityReference[];
  governed: readonly MaterialPriceSnapshot[];
  legacyRows: readonly LegacyCompatibilityPriceRow[];
  requestedGeography: UaePriceGeography;
  priceScope: PriceScope;
  asOf: Date;
  recordComparison?: (
    evidence: MaterialPricingRuntimeComparisonEvidence
  ) => void;
}): MaterialPriceSnapshot[] {
  if (input.mode === "governed") return [...input.governed];
  if (input.mode === "compare") {
    if (input.gate?.mode !== "compare") {
      throw new Error("EV-03 compare mode requires comparison evidence");
    }
    assertLegacyServingRowsMatchBaseline({
      legacyRows: input.legacyRows,
      gate: input.gate,
    });
    const comparison = buildMaterialPricingRuntimeComparisonEvidence({
      baselineEvidence: input.gate.evidence,
      references: input.requested,
      governedSnapshots: input.governed,
      requestedPriceScope: input.priceScope,
      requestedGeography: input.requestedGeography,
      resolverAsOf: input.asOf,
    });
    (input.recordComparison ?? recordSanitizedRuntimeComparison)(comparison);
  }
  return legacyCompatibilitySnapshots(input);
}

/**
 * Evidence-only governed probe. Runtime consumers must use
 * resolveMaterialPriceSnapshots(), which enforces the release mode.
 */
export async function resolveGovernedMaterialPriceSnapshotsForRolloutEvidence(
  input: MaterialResolutionRequest & {
    evidencePurpose: "ev03-full-eligible-comparison";
  },
  evidenceDataSource?: GlobalMaterialResolutionEvidenceDataSource
): Promise<MaterialPriceSnapshot[]> {
  if (input.evidencePurpose !== "ev03-full-eligible-comparison") {
    throw new Error("Invalid EV-03 rollout evidence purpose");
  }
  return resolveGovernedMaterialPriceSnapshots(input, {
    globalOnly: true,
    evidenceDataSource,
  });
}

export async function resolveMaterialPriceSnapshots(
  input: MaterialResolutionRequest & {
    rollout?: MaterialPricingRolloutGate;
    recordComparison?: (
      evidence: MaterialPricingRuntimeComparisonEvidence
    ) => void;
  }
): Promise<MaterialPriceSnapshot[]> {
  // Undefined deliberately serves the exact eligible legacy numbers. Compare
  // computes and verifies governed values but still serves legacy. Governed is
  // reachable only with explicit human approval bound to full golden evidence.
  const effectiveGate = input.rollout ?? loadMaterialPricingRolloutGate();
  const mode = assertMaterialPricingRolloutGate(effectiveGate);
  const liveEligibleRows =
    mode === "legacy" ? undefined : await listLegacyCompatibilityPriceRows();
  if (mode !== "legacy") {
    if (effectiveGate.mode === "legacy") {
      throw new Error("EV-03 rollout gate mode changed during validation");
    }
    assertMaterialPricingEvidenceMatchesLiveEligibleSet(
      effectiveGate.evidence,
      liveEligibleRows!.map(row => ({
        reference: {
          source: "material_library" as const,
          legacyId: row.legacyId,
        },
        priceMin: row.priceMin,
        priceMax: row.priceMax,
      }))
    );
  }
  const governed = await resolveGovernedMaterialPriceSnapshots(input);
  if (mode === "governed") {
    if (effectiveGate.mode !== "governed") {
      throw new Error("EV-03 governed gate changed during validation");
    }
    assertGovernedSnapshotsMatchApprovedEvidence(
      effectiveGate.evidence,
      governed
    );
    return governed;
  }

  const materialLibraryIds = input.references
    .filter(reference => reference.source === "material_library")
    .map(reference => reference.legacyId);
  const legacyRows =
    liveEligibleRows ??
    (await listLegacyCompatibilityPriceRows(materialLibraryIds));
  return selectMaterialPricingRolloutSnapshots({
    mode,
    gate: effectiveGate,
    requested: input.references,
    governed,
    legacyRows,
    requestedGeography: input.requestedGeography,
    priceScope: input.priceScope,
    asOf: input.asOf,
    recordComparison: input.recordComparison,
  });
}
