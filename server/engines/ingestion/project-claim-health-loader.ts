import type { MaterialAllocation } from "../../../drizzle/schema";
import type { MaterialPriceSnapshot } from "../../../shared/material-calculations";
import type { UaePriceGeography } from "../../../shared/material-pricing";
import type {
  ClaimHealthGovernedSourceEligibilityFacts,
  ClaimHealthIncidentState,
} from "../../../shared/claim-health";
import { CLAIM_HEALTH_V1_POLICY_MANIFEST } from "../../../shared/claim-health";
import { getMaterialAllocations } from "../../db";
import {
  getEffectiveClaimIncidentStates,
  listClaimHealthBenchmarkFacts,
  type OrganizationMemberContext,
} from "../../db/claim-health";
import { resolveMaterialPriceSnapshots } from "../material-pricing/material-resolution";
import {
  buildProjectClaimHealthEvaluationInput,
  type GovernedProjectMaterialEvidenceFact,
  type ProjectClaimHealthConsumer,
  type ProjectMaterialClaimHealthFact,
} from "./project-claim-health";
import {
  createClaimHealthValueDigest,
  evaluateClaimHealth,
  evaluateGovernedSourceEligibility,
} from "./claim-health";

type BenchmarkFact = Awaited<
  ReturnType<typeof listClaimHealthBenchmarkFacts>
>[number];

export interface LoadProjectClaimHealthInput {
  projectId: number;
  organizationId: number;
  userId: number;
  requestedGeography: UaePriceGeography;
  evaluatedAt: Date;
  consumer: ProjectClaimHealthConsumer;
  allocations?: readonly MaterialAllocation[];
  sourceEligibilityByBenchmarkProposalId?: ReadonlyMap<
    number,
    GovernedSourceEligibilityFacts
  >;
  incidentStateByBenchmarkProposalId?: ReadonlyMap<
    number,
    ClaimHealthIncidentState
  >;
  incidentAuthorityRevisionByBenchmarkProposalId?: ReadonlyMap<number, string>;
}

export type GovernedSourceEligibilityFacts =
  ClaimHealthGovernedSourceEligibilityFacts;

export interface ProjectClaimHealthAuthorityBindingEntry {
  allocationId: number;
  materialLibraryId: number | null;
  resolvedUnitBasis: string | null;
  resolutionState: "resolved" | "insufficient" | "missing";
  materialResolutionPolicyVersion: string | null;
  benchmarkProposalId: number | null;
  benchmarkVersionId: number | null;
  benchmarkVersion: string | null;
  specificationId: number | null;
  productId: number | null;
  supplierQuoteId: number | null;
  provenancePolicyVersion: string | null;
  sourceLadderRung: string | null;
  governedSourceIdentity: string | null;
  sourceRegistryId: number | null;
  sourceSlug: string | null;
  sourcePolicyVersion: string | null;
  sourceRevision: string | null;
  sourceEligibilityDigest: `sha256:${string}`;
  incidentState: ClaimHealthIncidentState;
  incidentAuthorityRevisionDigest: `sha256:${string}`;
}

export interface ProjectClaimHealthAuthorityBinding {
  version: "ev04-authority-binding-v1";
  organizationId: number;
  projectId: number;
  evaluationClock: string;
  entries: readonly ProjectClaimHealthAuthorityBindingEntry[];
  digest: `sha256:${string}`;
}

export interface ClaimHealthGovernedSourceRevisionInput {
  sourceRegistryId: number;
  sourceSlug: string;
  termsDecision: "pending" | "approved" | "rejected";
  sourceActive: boolean;
  sourceWhitelisted: boolean;
  sourcePolicyVersion: string;
  updatedAt: Date | string;
}

export function createClaimHealthGovernedSourceRevision(
  input: ClaimHealthGovernedSourceRevisionInput
): `sha256:${string}` {
  if (
    !Number.isInteger(input.sourceRegistryId) ||
    input.sourceRegistryId <= 0
  ) {
    throw new TypeError("Governed source revision requires a registry ID");
  }
  if (!input.sourceSlug.trim() || !input.sourcePolicyVersion.trim()) {
    throw new TypeError(
      "Governed source revision requires slug and policy version"
    );
  }
  const updatedAt =
    input.updatedAt instanceof Date
      ? input.updatedAt
      : new Date(input.updatedAt);
  if (!Number.isFinite(updatedAt.getTime())) {
    throw new TypeError(
      "Governed source revision requires a valid update clock"
    );
  }
  return createClaimHealthValueDigest({
    sourceRegistryId: input.sourceRegistryId,
    sourceSlug: input.sourceSlug,
    termsDecision: input.termsDecision,
    sourceActive: input.sourceActive,
    sourceWhitelisted: input.sourceWhitelisted,
    sourcePolicyVersion: input.sourcePolicyVersion,
    updatedAt: updatedAt.toISOString(),
  });
}

function validReference(allocation: MaterialAllocation) {
  return Number.isInteger(allocation.materialLibraryId) &&
    Number(allocation.materialLibraryId) > 0
    ? {
        source: "material_library" as const,
        legacyId: Number(allocation.materialLibraryId),
      }
    : null;
}

function factIsEligible(
  fact: BenchmarkFact,
  snapshot: Extract<MaterialPriceSnapshot, { state: "resolved" }>,
  organizationId: number,
  sourceEligibility: GovernedSourceEligibilityFacts | undefined
): boolean {
  if (fact.sourceLadderRung === null) return false;
  const quoteFacts = {
    organizationScoped: fact.proposalScope === "organization",
    notSuperseded: fact.supplierQuote?.supersededByQuoteId === null,
  };
  const quoteEligible =
    fact.supplierQuote === null ||
    CLAIM_HEALTH_V1_POLICY_MANIFEST.eligibilityRules.quote.requiredFacts.every(
      key => quoteFacts[key]
    );
  const proposalFacts = {
    proposalIdentityMatches: fact.id === snapshot.benchmarkProposalId,
    specificationIdentityMatches: fact.specId === snapshot.specificationId,
    humanApprovalComplete: fact.humanApprovalComplete,
    notSuperseded: fact.supersededByApprovedProposalId === null,
    priceScopeMatches: fact.priceScope === snapshot.resolvedPriceScope,
    sourceLadderMatches:
      fact.sourceLadderRung === snapshot.provenance.sourceLadderRung,
    provenancePolicyMatches:
      fact.provenancePolicyVersion ===
      snapshot.provenance.provenancePolicyVersion,
    benchmarkVersionMatches:
      fact.benchmarkVersion === snapshot.provenance.benchmarkVersion,
    tenantOrPlatformPublicScopeEligible:
      (fact.proposalScope === "platform_public" ||
        fact.proposalScope === "organization") &&
      organizationId > 0,
  };
  const baseEligible =
    CLAIM_HEALTH_V1_POLICY_MANIFEST.eligibilityRules.governedProposalRequiredFacts.every(
      key => proposalFacts[key]
    ) && quoteEligible;
  if (!baseEligible) return false;
  const identityClass =
    CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules.sourceLadderIdentityClass[
      fact.sourceLadderRung
    ];
  if (
    identityClass === "governed_assumption_identity" ||
    identityClass === "same_organization_quote_identity"
  ) {
    return true;
  }
  if (identityClass !== "registry_backed") return false;
  return evaluateGovernedSourceEligibility(sourceEligibility) === "eligible";
}

export function resolveProjectClaimHealthIncidentSourceIdentity(
  fact: Pick<
    BenchmarkFact,
    | "sourceLadderRung"
    | "provenancePolicyVersion"
    | "benchmarkVersion"
    | "supplierQuote"
  >,
  sourceEligibility: GovernedSourceEligibilityFacts | undefined
): string | null {
  if (
    fact.sourceLadderRung === "assumption" &&
    fact.provenancePolicyVersion?.trim() &&
    fact.benchmarkVersion?.trim()
  ) {
    const prefix =
      CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules.governedIdentity
        .approvedAssumption.prefix;
    return `${prefix}:${fact.provenancePolicyVersion}:${fact.benchmarkVersion}`;
  }
  if (fact.sourceLadderRung === "supplier_quote" && fact.supplierQuote?.id) {
    const prefix =
      CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules.governedIdentity
        .supplierQuote.prefix;
    return `${prefix}:${fact.supplierQuote.id}`;
  }
  // Official, consultancy, and market observations need an exact governed
  // registry identity. A display sourceLabel is never used as identity.
  return sourceEligibility?.governedSourceIdentity?.trim() || null;
}

export function buildProjectClaimHealthAuthorityBinding(input: {
  organizationId: number;
  projectId: number;
  evaluationClock: Date;
  allocations: readonly MaterialAllocation[];
  snapshotsByAllocationId: ReadonlyMap<number, MaterialPriceSnapshot>;
  benchmarkFacts: readonly BenchmarkFact[];
  sourceEligibilityByBenchmarkProposalId?: ReadonlyMap<
    number,
    GovernedSourceEligibilityFacts
  >;
  incidentStateByBenchmarkProposalId?: ReadonlyMap<
    number,
    ClaimHealthIncidentState
  >;
  incidentAuthorityRevisionByBenchmarkProposalId?: ReadonlyMap<number, string>;
}): ProjectClaimHealthAuthorityBinding {
  if (!Number.isFinite(input.evaluationClock.getTime())) {
    throw new TypeError("Authority binding requires a valid evaluation clock");
  }
  const facts = new Map(input.benchmarkFacts.map(fact => [fact.id, fact]));
  const entries = [...input.allocations]
    .sort((left, right) => left.id - right.id)
    .map<ProjectClaimHealthAuthorityBindingEntry>(allocation => {
      const snapshot = input.snapshotsByAllocationId.get(allocation.id) ?? null;
      const resolved = snapshot?.state === "resolved" ? snapshot : null;
      const fact = resolved
        ? facts.get(resolved.benchmarkProposalId)
        : undefined;
      const sourceEligibility = fact
        ? input.sourceEligibilityByBenchmarkProposalId?.get(fact.id)
        : undefined;
      const incidentState = fact
        ? (input.incidentStateByBenchmarkProposalId?.get(fact.id) ?? "unknown")
        : "unknown";
      const governedSourceIdentity = fact
        ? resolveProjectClaimHealthIncidentSourceIdentity(
            fact,
            sourceEligibility
          )
        : null;
      const suppliedIncidentRevision = fact
        ? input.incidentAuthorityRevisionByBenchmarkProposalId?.get(fact.id)
        : undefined;
      const incidentAuthorityRevisionDigest =
        suppliedIncidentRevision &&
        /^sha256:[0-9a-f]{64}$/.test(suppliedIncidentRevision)
          ? (suppliedIncidentRevision as `sha256:${string}`)
          : createClaimHealthValueDigest({
              evaluationClock: input.evaluationClock,
              governedSourceIdentity,
              incidentState,
            });
      return {
        allocationId: allocation.id,
        materialLibraryId:
          allocation.materialLibraryId === null
            ? null
            : Number(allocation.materialLibraryId),
        resolvedUnitBasis: allocation.resolvedUnitBasis,
        resolutionState: snapshot === null ? "missing" : snapshot.state,
        materialResolutionPolicyVersion: snapshot?.policyVersion ?? null,
        benchmarkProposalId: resolved?.benchmarkProposalId ?? null,
        benchmarkVersionId: resolved?.benchmarkVersionId ?? null,
        benchmarkVersion: resolved?.provenance.benchmarkVersion ?? null,
        specificationId: resolved?.specificationId ?? null,
        productId: resolved?.productId ?? null,
        supplierQuoteId: fact?.supplierQuote?.id ?? null,
        provenancePolicyVersion:
          resolved?.provenance.provenancePolicyVersion ?? null,
        sourceLadderRung: resolved?.provenance.sourceLadderRung ?? null,
        governedSourceIdentity,
        sourceRegistryId: sourceEligibility?.governedSourceRegistryId ?? null,
        sourceSlug: sourceEligibility?.governedSourceSlug ?? null,
        sourcePolicyVersion:
          sourceEligibility?.governedSourcePolicyVersion ?? null,
        sourceRevision: sourceEligibility?.governedSourceRevision ?? null,
        sourceEligibilityDigest: createClaimHealthValueDigest(
          sourceEligibility ?? null
        ),
        incidentState,
        incidentAuthorityRevisionDigest,
      };
    });
  const unsigned = {
    version: "ev04-authority-binding-v1" as const,
    organizationId: input.organizationId,
    projectId: input.projectId,
    evaluationClock: input.evaluationClock.toISOString(),
    entries,
  };
  return {
    ...unsigned,
    digest: createClaimHealthValueDigest(unsigned),
  };
}

async function loadEffectiveIncidentStates(
  input: LoadProjectClaimHealthInput,
  facts: readonly BenchmarkFact[],
  context: OrganizationMemberContext
): Promise<{
  states: ReadonlyMap<number, ClaimHealthIncidentState>;
  revisions: ReadonlyMap<number, string>;
}> {
  if (input.incidentStateByBenchmarkProposalId) {
    return {
      states: input.incidentStateByBenchmarkProposalId,
      revisions:
        input.incidentAuthorityRevisionByBenchmarkProposalId ?? new Map(),
    };
  }
  const pairs = await Promise.all(
    facts.map(async fact => {
      const sourceIdentity = resolveProjectClaimHealthIncidentSourceIdentity(
        fact,
        input.sourceEligibilityByBenchmarkProposalId?.get(fact.id)
      );
      if (!sourceIdentity) {
        return {
          benchmarkProposalId: fact.id,
          state: "unknown" as const,
          revision: undefined,
        };
      }
      const states = await getEffectiveClaimIncidentStates(
        {
          evaluationClock: input.evaluatedAt,
          organizationId: input.organizationId,
          projectId: input.projectId,
          supplierQuoteId:
            fact.sourceLadderRung === "supplier_quote"
              ? (fact.supplierQuote?.id ?? null)
              : null,
          sourceIdentities: [sourceIdentity],
        },
        context
      );
      const row = states[0] as
        | ((typeof states)[number] & {
            authorityRevisionDigest?: string;
          })
        | undefined;
      const aggregate =
        row?.aggregate === "none" ||
        row?.aggregate === "advisory" ||
        row?.aggregate === "blocking"
          ? row.aggregate
          : "unknown";
      return {
        benchmarkProposalId: fact.id,
        state: aggregate as ClaimHealthIncidentState,
        revision: row?.authorityRevisionDigest,
      };
    })
  );
  return {
    states: new Map(pairs.map(pair => [pair.benchmarkProposalId, pair.state])),
    revisions: new Map(
      pairs.flatMap(pair =>
        pair.revision
          ? [[pair.benchmarkProposalId, pair.revision] as const]
          : []
      )
    ),
  };
}

function evidenceFact(
  fact: BenchmarkFact | undefined,
  snapshot: MaterialPriceSnapshot | null,
  organizationId: number,
  sourceEligibility: GovernedSourceEligibilityFacts | undefined,
  incident: ClaimHealthIncidentState | undefined
): GovernedProjectMaterialEvidenceFact | null {
  if (
    !fact ||
    snapshot?.state !== "resolved" ||
    !fact.sourceLadderRung ||
    fact.sourceLadderRung === "retail_sanity"
  ) {
    return null;
  }
  const specification = fact.specification;
  if (
    !specification?.category ||
    !specification.finishLevel ||
    !specification.unitBasis
  ) {
    return null;
  }
  const eligible = factIsEligible(
    fact,
    snapshot,
    organizationId,
    sourceEligibility
  );
  const identityMayUseGovernedProposal =
    fact.sourceLadderRung === "assumption" ||
    fact.sourceLadderRung === "supplier_quote";
  return {
    sourceClass: fact.sourceLadderRung,
    eligibility: eligible ? "eligible" : "ineligible",
    sourceIdentityKnown:
      eligible &&
      Boolean(fact.provenancePolicyVersion?.trim()) &&
      Boolean(fact.benchmarkVersion?.trim()) &&
      (identityMayUseGovernedProposal ||
        sourceEligibility?.governedSourceIdentityKnown === true),
    observationAt: fact.observationAt,
    quoteValidUntil: fact.supplierQuote?.validUntil ?? null,
    slaConfigured:
      fact.sourceLadderRung !== "official_statistic" &&
      fact.sourceLadderRung !== "consultancy_benchmark",
    quality: eligible ? "pass" : "blocking",
    confidence: fact.priceConfidence ? "known" : "unknown",
    incident: incident ?? "unknown",
    resolvedCategory: specification.category,
    resolvedFinishTier: specification.finishLevel,
  };
}

export function buildProjectMaterialClaimHealthFacts(input: {
  projectId: number;
  organizationId: number;
  requestedGeography: UaePriceGeography;
  allocations: readonly MaterialAllocation[];
  snapshotsByAllocationId: ReadonlyMap<number, MaterialPriceSnapshot>;
  benchmarkFacts: readonly BenchmarkFact[];
  sourceEligibilityByBenchmarkProposalId?: ReadonlyMap<
    number,
    GovernedSourceEligibilityFacts
  >;
  incidentStateByBenchmarkProposalId?: ReadonlyMap<
    number,
    ClaimHealthIncidentState
  >;
}): ProjectMaterialClaimHealthFact[] {
  const benchmarkFacts = new Map(
    input.benchmarkFacts.map(fact => [fact.id, fact])
  );
  return input.allocations.map(allocation => {
    const reference = validReference(allocation);
    const snapshot = input.snapshotsByAllocationId.get(allocation.id) ?? null;
    const fact =
      snapshot?.state === "resolved"
        ? benchmarkFacts.get(snapshot.benchmarkProposalId)
        : undefined;
    return {
      allocation: {
        allocationKey: `${input.projectId}:${allocation.id}`,
        requirement: "required",
        reference: reference ?? {
          source: "material_library",
          legacyId: 0,
        },
        category: fact?.specification?.category ?? null,
        finishTier: fact?.specification?.finishLevel ?? null,
        unitBasis: allocation.resolvedUnitBasis,
        priceScope: "supply_only",
        requestedGeography: input.requestedGeography,
      },
      snapshot,
      evidence: evidenceFact(
        fact,
        snapshot,
        input.organizationId,
        fact
          ? input.sourceEligibilityByBenchmarkProposalId?.get(fact.id)
          : undefined,
        fact
          ? input.incidentStateByBenchmarkProposalId?.get(fact.id)
          : undefined
      ),
    };
  });
}

export async function loadProjectClaimHealth(
  input: LoadProjectClaimHealthInput
) {
  const allocations = input.allocations
    ? [...input.allocations]
    : await getMaterialAllocations(input.projectId, input.organizationId);
  const resolvable = allocations
    .map(allocation => ({ allocation, reference: validReference(allocation) }))
    .filter(
      (
        row
      ): row is {
        allocation: MaterialAllocation;
        reference: { source: "material_library"; legacyId: number };
      } => row.reference !== null
    );
  const uniqueReferences = Array.from(
    new Map(
      resolvable.map(row => [
        `${row.reference.source}:${row.reference.legacyId}`,
        row.reference,
      ])
    ).values()
  );
  const snapshots =
    uniqueReferences.length === 0
      ? []
      : await resolveMaterialPriceSnapshots({
          references: uniqueReferences,
          organizationId: input.organizationId,
          requestedGeography: input.requestedGeography,
          priceScope: "supply_only",
          asOf: input.evaluatedAt,
          allowLegacyUnknownScope: true,
        });
  const snapshotsByReference = new Map(
    uniqueReferences.map((reference, index) => [
      `${reference.source}:${reference.legacyId}`,
      snapshots[index],
    ])
  );
  const snapshotsByAllocationId = new Map<number, MaterialPriceSnapshot>(
    resolvable.map(row => [
      row.allocation.id,
      snapshotsByReference.get(
        `${row.reference.source}:${row.reference.legacyId}`
      )!,
    ])
  );
  const proposalIds = snapshots
    .filter(
      (
        snapshot
      ): snapshot is Extract<MaterialPriceSnapshot, { state: "resolved" }> =>
        snapshot.state === "resolved"
    )
    .map(snapshot => snapshot.benchmarkProposalId);
  const context: OrganizationMemberContext = {
    kind: "organization_member",
    organizationId: input.organizationId,
    userId: input.userId,
    sessionIdentity: "claim-health-evaluation",
  };
  const benchmarkFacts = await listClaimHealthBenchmarkFacts(
    {
      projectId: input.projectId,
      benchmarkProposalIds: proposalIds,
      evaluationClock: input.evaluatedAt,
    },
    context
  );
  const incidentAuthority = await loadEffectiveIncidentStates(
    input,
    benchmarkFacts,
    context
  );
  const materials = buildProjectMaterialClaimHealthFacts({
    projectId: input.projectId,
    organizationId: input.organizationId,
    requestedGeography: input.requestedGeography,
    allocations,
    snapshotsByAllocationId,
    benchmarkFacts,
    sourceEligibilityByBenchmarkProposalId:
      input.sourceEligibilityByBenchmarkProposalId,
    incidentStateByBenchmarkProposalId: incidentAuthority.states,
  });
  const evaluationInput = buildProjectClaimHealthEvaluationInput({
    consumer: input.consumer,
    evaluatedAt: input.evaluatedAt,
    materials,
  });
  const authorityBinding = buildProjectClaimHealthAuthorityBinding({
    organizationId: input.organizationId,
    projectId: input.projectId,
    evaluationClock: input.evaluatedAt,
    allocations,
    snapshotsByAllocationId,
    benchmarkFacts,
    sourceEligibilityByBenchmarkProposalId:
      input.sourceEligibilityByBenchmarkProposalId,
    incidentStateByBenchmarkProposalId: incidentAuthority.states,
    incidentAuthorityRevisionByBenchmarkProposalId: incidentAuthority.revisions,
  });
  return {
    evaluationInput,
    evaluation: evaluateClaimHealth(evaluationInput),
    authorityBinding,
  };
}
