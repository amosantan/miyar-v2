import {
  CLAIM_HEALTH_POLICY_VERSION,
  CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
  type ClaimHealthCatalogueId,
  type ClaimHealthDomain,
  type ClaimHealthEligibilityState,
  type ClaimHealthEvaluationInput,
  type ClaimHealthIncidentState,
  type ClaimHealthRequiredCellInput,
} from "../../../shared/claim-health";
import {
  CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
  evaluateMarketObservationFreshness,
} from "./claim-health";

export type DldIndexedDataset = "transactions" | "rents" | "projects";

export const DLD_INDEXED_SOURCE_IDENTITIES: Readonly<
  Record<DldIndexedDataset, string>
> = Object.freeze({
  transactions: "dld-indexed:transactions",
  rents: "dld-indexed:rents",
  projects: "dld-indexed:projects",
});

export interface DldIndexedDatasetHealthInput {
  count: number;
  observedThrough: Date | string | null;
  /** Governed platform-source eligibility supplied by the loader. */
  sourceEligibility?: ClaimHealthEligibilityState;
  /** Effective incident projection supplied by the incident store. */
  incident?: ClaimHealthIncidentState;
}

export interface BuildDldMarketClaimHealthInput {
  evaluatedAt: Date;
  transactions: DldIndexedDatasetHealthInput;
  rents: DldIndexedDatasetHealthInput;
  projects: DldIndexedDatasetHealthInput;
}

const DLD_DATASET_CONTRACT: Readonly<
  Record<
    DldIndexedDataset,
    { catalogueId: ClaimHealthCatalogueId; domain: ClaimHealthDomain }
  >
> = Object.freeze({
  transactions: {
    catalogueId: "dld-indexed-transactions-v1",
    domain: "market_transaction",
  },
  rents: {
    catalogueId: "dld-indexed-rents-v1",
    domain: "market_rent",
  },
  projects: {
    catalogueId: "dld-indexed-projects-v1",
    domain: "project_pipeline",
  },
});

function dldCell(
  dataset: DldIndexedDataset,
  input: DldIndexedDatasetHealthInput,
  evaluatedAt: Date
): ClaimHealthRequiredCellInput {
  const contract = DLD_DATASET_CONTRACT[dataset];
  const countValid = Number.isSafeInteger(input.count) && input.count >= 0;
  const hasRows = countValid && input.count > 0;
  const sourceEligible = input.sourceEligibility === "eligible";
  const observation =
    hasRows && input.observedThrough === null
      ? {
          freshness: "not_applicable" as const,
          observationDateStatus: "not_applicable" as const,
          observedThrough: null,
        }
      : evaluateMarketObservationFreshness({
          observedAt: input.observedThrough,
          evaluatedAt,
          slaConfigured: false,
        });

  return {
    cellId: `dld-indexed-${dataset}`,
    catalogueId: contract.catalogueId,
    requirement: "required",
    key: {
      consumer: "market_evidence",
      domain: contract.domain,
      category: "not_applicable",
      geography: "dubai",
      finishTier: "not_applicable",
      unitBasis: "not_applicable",
      priceScope: "not_applicable",
      requiredAuthorityClass: "official_observation",
    },
    match: !countValid ? "invalid" : hasRows ? "exact" : "missing",
    authority: "official_observation",
    eligibility: hasRows && sourceEligible ? "eligible" : "ineligible",
    freshness: observation.freshness,
    cadence: "not_applicable",
    quality: hasRows && sourceEligible ? "pass" : "blocking",
    confidence: "not_applicable",
    incident: input.incident ?? "unknown",
    observationDateStatus: observation.observationDateStatus,
    quoteValidity: "not_applicable",
    successfulRun: "not_applicable",
    // EV-05 must approve source/dataset-specific publication SLAs.
    slaConfigured: false,
    provenanceIdentityKnown: true,
    fallbackCode: null,
    observedThrough: observation.observedThrough,
  };
}

/**
 * Build exactly the three approved DLD indexed-subset cells. Dataset counts do
 * not claim completeness; they only prove whether the indexed subset is empty.
 */
export function buildDldMarketClaimHealthEvaluationInput(
  input: BuildDldMarketClaimHealthInput
): ClaimHealthEvaluationInput {
  return {
    policyVersion: CLAIM_HEALTH_POLICY_VERSION,
    policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    requiredCellSchemaVersion: CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    artifactSnapshot: "not_applicable",
    cells: (["transactions", "rents", "projects"] as const).map(dataset =>
      dldCell(dataset, input[dataset], input.evaluatedAt)
    ),
  };
}

/**
 * v1 intentionally has no approved required sources. The empty denominator is
 * therefore Insufficient for a global operations-health claim.
 */
export function buildRequiredSourceOperationsClaimHealthEvaluationInput(
  evaluatedAt: Date
): ClaimHealthEvaluationInput {
  return {
    policyVersion: CLAIM_HEALTH_POLICY_VERSION,
    policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    requiredCellSchemaVersion: CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
    evaluatedAt,
    artifactSnapshot: "not_applicable",
    cells: [],
  };
}
