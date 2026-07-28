import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import {
  benchmarkProposals,
  evidenceRecords,
  specifications,
  supplierQuotes,
} from "../../drizzle/schema";
import type {
  PriceScope,
  SourceLadderRung,
  UaePriceGeography,
  PriceUnitBasis,
} from "../../shared/material-pricing";
import { getDb } from "../db";

export type GovernedValueCandidate = {
  id: number;
  specId: number;
  productId: number | null;
  orgId: number | null;
  priceScope: PriceScope | null;
  sourceKind: "observed" | "assumption";
  sourceLadderRung: SourceLadderRung;
  benchmarkVersionId: number | null;
  benchmarkVersion: string;
  effectiveAt: Date;
  supplierQuoteId: number | null;
  supersedesId: number | null;
  p25: string;
  p50: string;
  p75: string;
  weightedMean: string;
  sourceLabel: string | null;
  provenancePolicyVersion: string | null;
  unitBasis: PriceUnitBasis;
  geography: UaePriceGeography;
  quoteValidUntil: Date | null;
  quoteReceivedAt: Date | null;
  quoteOrgId: number | null;
  quoteSupersededAt: Date | null;
};

export async function listGovernedValueCandidates(input: {
  specId: number;
  organizationId?: number;
}): Promise<GovernedValueCandidate[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const scopeCondition =
    input.organizationId === undefined
      ? isNull(benchmarkProposals.orgId)
      : or(
          isNull(benchmarkProposals.orgId),
          eq(benchmarkProposals.orgId, input.organizationId)
        );

  const rows = await db
    .select({
      id: benchmarkProposals.id,
      specId: benchmarkProposals.specId,
      productId: benchmarkProposals.productId,
      orgId: benchmarkProposals.orgId,
      priceScope: benchmarkProposals.priceScope,
      sourceKind: benchmarkProposals.sourceKind,
      sourceLadderRung: benchmarkProposals.sourceLadderRung,
      benchmarkVersionId: benchmarkProposals.benchmarkVersionId,
      benchmarkVersion: benchmarkProposals.keyPolicyVersion,
      createdAt: benchmarkProposals.createdAt,
      reviewedAt: benchmarkProposals.reviewedAt,
      supplierQuoteId: benchmarkProposals.supplierQuoteId,
      supersedesId: benchmarkProposals.supersedesId,
      p25: benchmarkProposals.proposedP25,
      p50: benchmarkProposals.proposedP50,
      p75: benchmarkProposals.proposedP75,
      weightedMean: benchmarkProposals.weightedMean,
      sourceLabel: benchmarkProposals.sourceLabel,
      provenancePolicyVersion: benchmarkProposals.provenancePolicyVersion,
      unitBasis: specifications.unitBasis,
      geography: specifications.geography,
      quoteValidUntil: supplierQuotes.validUntil,
      quoteReceivedAt: supplierQuotes.receivedAt,
      quoteOrgId: supplierQuotes.orgId,
    })
    .from(benchmarkProposals)
    .innerJoin(specifications, eq(specifications.id, benchmarkProposals.specId))
    .leftJoin(supplierQuotes, eq(supplierQuotes.id, benchmarkProposals.supplierQuoteId))
    .where(
      and(
        eq(benchmarkProposals.specId, input.specId),
        eq(benchmarkProposals.status, "approved"),
        eq(benchmarkProposals.recommendation, "publish"),
        or(
          and(
            isNotNull(benchmarkProposals.reviewedBy),
            isNotNull(benchmarkProposals.reviewedAt)
          ),
          and(
            eq(benchmarkProposals.sourceKind, "assumption"),
            eq(benchmarkProposals.sourceLadderRung, "assumption"),
            isNotNull(benchmarkProposals.legacyMaterialLibraryId),
            eq(benchmarkProposals.keyPolicyVersion, "ev02-backfill-v1")
          )
        ),
        scopeCondition
      )
    );

  const quoteIds = rows
    .map(row => row.supplierQuoteId)
    .filter((id): id is number => id !== null);
  const quoteSupersededAt = new Map<number, Date>();
  const quoteOrganizations = new Map(
    rows
      .filter(
        (row): row is typeof row & {
          supplierQuoteId: number;
          quoteOrgId: number;
        } => row.supplierQuoteId !== null && row.quoteOrgId !== null
      )
      .map(row => [row.supplierQuoteId, row.quoteOrgId])
  );
  if (quoteIds.length > 0) {
    const successors = await db
      .select({
        supersedesId: supplierQuotes.supersedesId,
        orgId: supplierQuotes.orgId,
        receivedAt: supplierQuotes.receivedAt,
      })
      .from(supplierQuotes)
      .where(inArray(supplierQuotes.supersedesId, quoteIds));
    for (const successor of successors) {
      if (
        successor.supersedesId !== null &&
        quoteOrganizations.get(successor.supersedesId) === successor.orgId
      ) {
        quoteSupersededAt.set(successor.supersedesId, successor.receivedAt);
      }
    }
  }

  return rows
    .filter(
      (
        row
      ): row is typeof row & {
        specId: number;
        sourceLadderRung: SourceLadderRung;
      } => row.specId !== null && row.sourceLadderRung !== null
    )
    .map(row => ({
      ...row,
      effectiveAt: row.reviewedAt ?? row.createdAt,
      quoteSupersededAt:
        row.supplierQuoteId === null
          ? null
          : quoteSupersededAt.get(row.supplierQuoteId) ?? null,
    }));
}

export async function insertPriceObservation(
  data: typeof evidenceRecords.$inferInsert & {
    specId: number;
    priceScope: PriceScope;
    observationKind:
      | "market_listing"
      | "official_statistic"
      | "consultancy_benchmark"
      | "supplier_quote"
      | "manual";
  }
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (
    data.supersedesObservationId !== undefined &&
    data.supersedesObservationId !== null
  ) {
    throw new Error("Corrections must use insertSupersedingPriceObservation");
  }

  const spec = await db
    .select({ id: specifications.id })
    .from(specifications)
    .where(eq(specifications.id, data.specId))
    .limit(1);
  if (!spec[0]) throw new Error("Specification not found");

  if (data.observationKind === "supplier_quote") {
    if (!data.supplierQuoteId || !data.orgId) {
      throw new Error("Supplier-quote observations require quote and organization");
    }
    const quote = await db
      .select({ orgId: supplierQuotes.orgId })
      .from(supplierQuotes)
      .where(eq(supplierQuotes.id, data.supplierQuoteId))
      .limit(1);
    if (!quote[0] || quote[0].orgId !== data.orgId) {
      throw new Error("Supplier quote is unavailable");
    }
  } else if (data.supplierQuoteId !== undefined && data.supplierQuoteId !== null) {
    throw new Error("Only supplier-quote observations may reference a quote");
  }

  const result = await db.insert(evidenceRecords).values(data);
  return { id: Number(result[0].insertId) };
}

export async function insertSupersedingPriceObservation(input: {
  predecessorId: number;
  orgId: number | null;
  data: Omit<
    Parameters<typeof insertPriceObservation>[0],
    "orgId" | "supersedesObservationId"
  >;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async tx => {
    const orgCondition =
      input.orgId === null
        ? isNull(evidenceRecords.orgId)
        : eq(evidenceRecords.orgId, input.orgId);
    const predecessor = await tx
      .select({ id: evidenceRecords.id })
      .from(evidenceRecords)
      .where(
        and(eq(evidenceRecords.id, input.predecessorId), orgCondition)
      )
      .limit(1);
    if (!predecessor[0]) throw new Error("Price observation is unavailable");

    const successor = await tx
      .select({ id: evidenceRecords.id })
      .from(evidenceRecords)
      .where(
        eq(evidenceRecords.supersedesObservationId, input.predecessorId)
      )
      .limit(1);
    if (successor[0]) throw new Error("Price observation is already superseded");

    const spec = await tx
      .select({ id: specifications.id })
      .from(specifications)
      .where(eq(specifications.id, input.data.specId))
      .limit(1);
    if (!spec[0]) throw new Error("Specification not found");

    if (input.data.observationKind === "supplier_quote") {
      if (!input.data.supplierQuoteId || input.orgId === null) {
        throw new Error("Supplier-quote observations require quote and organization");
      }
      const quote = await tx
        .select({ orgId: supplierQuotes.orgId })
        .from(supplierQuotes)
        .where(eq(supplierQuotes.id, input.data.supplierQuoteId))
        .limit(1);
      if (!quote[0] || quote[0].orgId !== input.orgId) {
        throw new Error("Supplier quote is unavailable");
      }
    }

    const result = await tx.insert(evidenceRecords).values({
      ...input.data,
      orgId: input.orgId,
      supersedesObservationId: input.predecessorId,
    });
    return { id: Number(result[0].insertId) };
  });
}

export async function insertSupplierQuote(
  data: Omit<typeof supplierQuotes.$inferInsert, "supersedesId">
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (
    "supersedesId" in data &&
    (data as { supersedesId?: number | null }).supersedesId != null
  ) {
    throw new Error("Quote corrections must use insertSupersedingSupplierQuote");
  }
  const result = await db.insert(supplierQuotes).values(data);
  return { id: Number(result[0].insertId) };
}

export async function insertSupersedingSupplierQuote(input: {
  predecessorId: number;
  orgId: number;
  data: Omit<typeof supplierQuotes.$inferInsert, "orgId" | "supersedesId">;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async tx => {
    const predecessor = await tx
      .select({ id: supplierQuotes.id })
      .from(supplierQuotes)
      .where(
        and(
          eq(supplierQuotes.id, input.predecessorId),
          eq(supplierQuotes.orgId, input.orgId)
        )
      )
      .limit(1);
    if (!predecessor[0]) throw new Error("Supplier quote is unavailable");

    const successor = await tx
      .select({ id: supplierQuotes.id })
      .from(supplierQuotes)
      .where(eq(supplierQuotes.supersedesId, input.predecessorId))
      .limit(1);
    if (successor[0]) throw new Error("Supplier quote is already superseded");

    const result = await tx.insert(supplierQuotes).values({
      ...input.data,
      orgId: input.orgId,
      supersedesId: input.predecessorId,
    });
    return { id: Number(result[0].insertId) };
  });
}
