import type {
  GovernedMaterialValueResolution,
  GovernedValueResolutionInput,
  ResolvedGovernedMaterialValue,
} from "../../../shared/material-pricing";
import {
  listGovernedValueCandidates,
  type GovernedValueCandidate,
} from "../../db/material-pricing";
import { sourceLadderPriority } from "./policy";

function retailBand(candidates: GovernedValueCandidate[]) {
  const retail = candidates.filter(
    candidate => candidate.sourceLadderRung === "retail_sanity"
  );
  if (retail.length !== 1) return undefined;
  return {
    p25: retail[0].p25,
    p50: retail[0].p50,
    p75: retail[0].p75,
  };
}

export function resolveGovernedMaterialValueFromCandidates(
  input: GovernedValueResolutionInput,
  candidates: GovernedValueCandidate[]
): GovernedMaterialValueResolution {
  if (!Number.isFinite(input.asOf.getTime())) {
    throw new Error("Resolver requires a valid explicit asOf clock");
  }

  const availableAtClock = candidates.filter(
    candidate => candidate.effectiveAt.getTime() <= input.asOf.getTime()
  );
  const supersededIds = new Set(
    availableAtClock
      .map(candidate => candidate.supersedesId)
      .filter((id): id is number => id !== null)
  );
  const active = availableAtClock.filter(
    candidate => !supersededIds.has(candidate.id)
  );
  const scoped = active.filter(candidate => {
    if (candidate.orgId !== null && candidate.orgId !== input.organizationId) {
      return false;
    }
    if (input.productId === undefined) {
      if (candidate.productId !== null) return false;
    } else if (
      candidate.productId !== null &&
      candidate.productId !== input.productId
    ) {
      return false;
    }
    return true;
  });
  const diagnosticBand = retailBand(
    scoped.filter(candidate => candidate.priceScope === input.priceScope)
  );

  const eligible = scoped.filter(candidate => {
    if (candidate.sourceLadderRung === "retail_sanity") return false;
    if (candidate.sourceLadderRung === "supplier_quote") {
      return (
        input.organizationId !== undefined &&
        candidate.orgId === input.organizationId &&
        candidate.quoteOrgId === input.organizationId &&
        candidate.supplierQuoteId !== null &&
        candidate.quoteReceivedAt !== null &&
        candidate.quoteReceivedAt.getTime() <= input.asOf.getTime() &&
        candidate.quoteValidUntil !== null &&
        candidate.quoteValidUntil.getTime() >= input.asOf.getTime() &&
        (candidate.quoteSupersededAt === null ||
          candidate.quoteSupersededAt.getTime() > input.asOf.getTime()) &&
        candidate.priceScope === input.priceScope
      );
    }
    if (candidate.priceScope === input.priceScope) return true;
    return (
      candidate.sourceLadderRung === "assumption" &&
      candidate.priceScope === null &&
      input.allowLegacyUnknownScope === true
    );
  });

  if (eligible.length === 0) {
    const hasLegacyUnknown = scoped.some(
      candidate =>
        candidate.sourceLadderRung === "assumption" &&
        candidate.priceScope === null
    );
    return {
      status: "insufficient",
      reason:
        diagnosticBand && !hasLegacyUnknown
          ? "only_retail_sanity"
          : hasLegacyUnknown
            ? "legacy_scope_unknown"
            : "no_governed_value",
      retailSanityBand: diagnosticBand,
    };
  }

  const ranked = eligible
    .map(candidate => ({
      candidate,
      ladder: sourceLadderPriority(candidate.sourceLadderRung),
      productSpecific:
        input.productId !== undefined && candidate.productId === input.productId
          ? 0
          : 1,
      orgSpecific:
        input.organizationId !== undefined &&
        candidate.orgId === input.organizationId
          ? 0
          : 1,
      legacyScope: candidate.priceScope === null ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        a.ladder - b.ladder ||
        a.productSpecific - b.productSpecific ||
        a.orgSpecific - b.orgSpecific ||
        a.legacyScope - b.legacyScope
    );

  const best = ranked[0];
  const tied = ranked.filter(
    row =>
      row.ladder === best.ladder &&
      row.productSpecific === best.productSpecific &&
      row.orgSpecific === best.orgSpecific &&
      row.legacyScope === best.legacyScope
  );
  if (tied.length !== 1) {
    return {
      status: "insufficient",
      reason: "ambiguous_governed_value",
      retailSanityBand: diagnosticBand,
    };
  }

  const selected = best.candidate;
  if (selected.sourceLadderRung === "retail_sanity") {
    throw new Error("Retail sanity rows cannot resolve authoritatively");
  }
  const p25 = Number(selected.p25);
  const p50 = Number(selected.p50);
  const p75 = Number(selected.p75);
  const weightedMean = Number(selected.weightedMean);
  if (
    !Number.isFinite(p25) ||
    !Number.isFinite(p50) ||
    !Number.isFinite(p75) ||
    !Number.isFinite(weightedMean) ||
    p25 <= 0 ||
    p50 <= 0 ||
    p75 <= 0 ||
    weightedMean <= 0 ||
    p25 > p50 ||
    p50 > p75
  ) {
    return {
      status: "insufficient",
      reason: "no_governed_value",
      retailSanityBand: diagnosticBand,
    };
  }
  const value: ResolvedGovernedMaterialValue["value"] = {
    benchmarkProposalId: selected.id,
    benchmarkVersionId: selected.benchmarkVersionId,
    benchmarkVersion: selected.benchmarkVersion,
    specificationId: selected.specId,
    productId: selected.productId,
    organizationId: selected.orgId,
    p25: selected.p25,
    p50: selected.p50,
    p75: selected.p75,
    weightedMean: selected.weightedMean,
    currency: "AED",
    unitBasis: selected.unitBasis,
    geography: selected.geography,
    priceScope: selected.priceScope ?? "legacy_unknown",
    sourceKind: selected.sourceKind,
    sourceLadderRung: selected.sourceLadderRung,
    sourceLabel: selected.sourceLabel,
    provenancePolicyVersion: selected.provenancePolicyVersion,
    isLegacyScopeFallback: selected.priceScope === null,
  };
  return {
    status: "resolved",
    value,
    retailSanityBand: diagnosticBand,
  };
}

export async function resolveGovernedMaterialValue(
  input: GovernedValueResolutionInput
): Promise<GovernedMaterialValueResolution> {
  const candidates = await listGovernedValueCandidates({
    specId: input.specId,
    organizationId: input.organizationId,
  });
  return resolveGovernedMaterialValueFromCandidates(input, candidates);
}
