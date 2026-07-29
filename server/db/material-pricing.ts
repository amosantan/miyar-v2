import { and, eq, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";

import {
  benchmarkVersions,
  benchmarkProposals,
  evidenceRecords,
  materialLibrary,
  materialsCatalog,
  paintCoverageProfiles,
  products,
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

export function isGlobalGovernedCandidateScope(candidate: {
  orgId: number | null;
  supplierQuoteId: number | null;
  sourceLadderRung: SourceLadderRung | null;
  productId: number | null;
  joinedProductId: number | null;
  productOrgId: number | null;
}): boolean {
  return (
    candidate.orgId === null &&
    candidate.supplierQuoteId === null &&
    candidate.sourceLadderRung !== "supplier_quote" &&
    (candidate.productId === null ||
      (candidate.joinedProductId === candidate.productId &&
        candidate.productOrgId === null))
  );
}

export type MaterialResolutionIdentityRow = {
  source: "material_library" | "materials_catalog";
  legacyId: number;
  productId: number | null;
  productOrgId: number | null;
  productCanonicalCategory: string | null;
  category: string;
  tier: string;
  unit: string | null;
};

export type MaterialResolutionSpecificationRow = {
  id: number;
  category: string;
  finishLevel: string;
  unitBasis: PriceUnitBasis;
  geography: UaePriceGeography;
};

export type LegacyCompatibilityPriceRow = {
  legacyId: number;
  productId: number;
  specId: number;
  benchmarkProposalId: number;
  benchmarkVersionId: number | null;
  benchmarkVersion: string;
  provenancePolicyVersion: string | null;
  unitBasis: PriceUnitBasis;
  geography: UaePriceGeography;
  priceMin: string;
  priceMax: string;
};

export type ApprovedPaintCoverageProfileRow = {
  id: number;
  productId: number;
  specId: number;
  coverageM2PerLitrePerCoat: string;
  coatCount: number;
  wastePct: string;
  packSizesLitres: readonly string[];
  effectiveAt: Date;
  policyVersion: string;
  sourceDocumentDigest: string;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  supersedesId: number | null;
  lineageValid?: boolean;
};

export async function listApprovedPaintCoverageProfiles(input: {
  productIds: number[];
  asOf: Date;
}): Promise<ApprovedPaintCoverageProfileRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const productIds = Array.from(new Set(input.productIds));
  if (productIds.length === 0) return [];
  const rows = await db
    .select({
      id: paintCoverageProfiles.id,
      productId: paintCoverageProfiles.productId,
      specId: paintCoverageProfiles.specId,
      coverageM2PerLitrePerCoat:
        paintCoverageProfiles.coverageM2PerLitrePerCoat,
      coatCount: paintCoverageProfiles.coatCount,
      wastePct: paintCoverageProfiles.wastePct,
      packSizesLitres: paintCoverageProfiles.packSizesLitres,
      effectiveAt: paintCoverageProfiles.effectiveAt,
      policyVersion: paintCoverageProfiles.policyVersion,
      sourceDocumentDigest: paintCoverageProfiles.sourceDocumentDigest,
      reviewedBy: paintCoverageProfiles.reviewedBy,
      reviewedAt: paintCoverageProfiles.reviewedAt,
      supersedesId: paintCoverageProfiles.supersedesId,
    })
    .from(paintCoverageProfiles)
    .where(
      and(
        inArray(paintCoverageProfiles.productId, productIds),
        eq(paintCoverageProfiles.status, "approved"),
        lte(paintCoverageProfiles.effectiveAt, input.asOf)
      )
    );
  const rowById = new Map(rows.map(row => [row.id, row]));
  const cyclicIds = new Set<number>();
  for (const row of rows) {
    const seen = new Set<number>();
    let cursor: typeof row | undefined = row;
    while (cursor?.supersedesId && rowById.has(cursor.supersedesId)) {
      if (seen.has(cursor.supersedesId)) {
        for (const id of Array.from(seen)) cyclicIds.add(id);
        cyclicIds.add(cursor.supersedesId);
        break;
      }
      seen.add(cursor.id);
      cursor = rowById.get(cursor.supersedesId);
    }
  }
  const supersededIds = new Set(
    rows.map(row => row.supersedesId).filter((id): id is number => id !== null)
  );
  return rows
    .filter(row => cyclicIds.has(row.id) || !supersededIds.has(row.id))
    .map(row => ({
      ...row,
      lineageValid: !cyclicIds.has(row.id),
      packSizesLitres: Array.isArray(row.packSizesLitres)
        ? row.packSizesLitres.map(String)
        : [],
    }));
}

async function listMaterialResolutionIdentitiesWithScope(input: {
  materialLibraryIds?: number[];
  materialCatalogIds?: number[];
  globalOnly: boolean;
}): Promise<MaterialResolutionIdentityRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows: MaterialResolutionIdentityRow[] = [];
  const libraryIds = Array.from(new Set(input.materialLibraryIds ?? []));
  if (libraryIds.length > 0) {
    const libraryRows = await db
      .select({
        legacyId: materialLibrary.id,
        productId: products.id,
        productOrgId: products.orgId,
        productCanonicalCategory: products.canonicalCategory,
        category: materialLibrary.category,
        tier: materialLibrary.tier,
        unit: materialLibrary.unitLabel,
      })
      .from(materialLibrary)
      .leftJoin(
        products,
        input.globalOnly
          ? and(
              eq(products.id, materialLibrary.productId),
              isNull(products.orgId)
            )
          : eq(products.id, materialLibrary.productId)
      )
      .where(inArray(materialLibrary.id, libraryIds));
    rows.push(
      ...libraryRows.map(row => ({
        source: "material_library" as const,
        ...row,
      }))
    );
  }
  const catalogIds = Array.from(new Set(input.materialCatalogIds ?? []));
  if (catalogIds.length > 0) {
    const catalogRows = await db
      .select({
        legacyId: materialsCatalog.id,
        productId: products.id,
        productOrgId: products.orgId,
        productCanonicalCategory: products.canonicalCategory,
        category: materialsCatalog.category,
        tier: materialsCatalog.tier,
        unit: materialsCatalog.costUnit,
      })
      .from(materialsCatalog)
      .leftJoin(
        products,
        input.globalOnly
          ? and(
              eq(products.id, materialsCatalog.productId),
              isNull(products.orgId)
            )
          : eq(products.id, materialsCatalog.productId)
      )
      .where(inArray(materialsCatalog.id, catalogIds));
    rows.push(
      ...catalogRows.map(row => ({
        source: "materials_catalog" as const,
        ...row,
      }))
    );
  }
  return rows;
}

export async function listMaterialResolutionIdentities(input: {
  materialLibraryIds?: number[];
  materialCatalogIds?: number[];
}): Promise<MaterialResolutionIdentityRow[]> {
  return listMaterialResolutionIdentitiesWithScope({
    ...input,
    globalOnly: false,
  });
}

export async function listGlobalMaterialResolutionIdentities(input: {
  materialLibraryIds?: number[];
  materialCatalogIds?: number[];
}): Promise<MaterialResolutionIdentityRow[]> {
  return listMaterialResolutionIdentitiesWithScope({
    ...input,
    globalOnly: true,
  });
}

/**
 * EV-03 compatibility read. A supplied ID set bounds legacy serving; omitting
 * IDs intentionally reads the complete eligible population so compare/governed
 * deployment evidence can be rebound to live state. A legacy range is eligible
 * only when the exact published EV-02 assumption links the legacy row,
 * canonical product, and canonical specification. This helper must never be
 * used as a resolver or as a new pricing authority.
 */
export async function listLegacyCompatibilityPriceRows(
  materialLibraryIds?: readonly number[]
): Promise<LegacyCompatibilityPriceRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const ids =
    materialLibraryIds === undefined
      ? undefined
      : Array.from(new Set(materialLibraryIds));
  if (ids?.length === 0) return [];
  const eligibilityConditions = [
    isNotNull(materialLibrary.priceAedMin),
    isNotNull(materialLibrary.priceAedMax),
    isNotNull(benchmarkProposals.productId),
    eq(benchmarkProposals.sourceKind, "assumption"),
    eq(benchmarkProposals.sourceLadderRung, "assumption"),
    isNull(benchmarkProposals.orgId),
    isNull(benchmarkProposals.priceScope),
    eq(benchmarkProposals.keyPolicyVersion, "ev02-backfill-v1"),
    eq(benchmarkProposals.status, "approved"),
    eq(benchmarkProposals.recommendation, "publish"),
  ];
  if (ids !== undefined) {
    eligibilityConditions.unshift(inArray(materialLibrary.id, ids));
  }
  const rows = await db
    .select({
      legacyId: materialLibrary.id,
      productId: benchmarkProposals.productId,
      specId: benchmarkProposals.specId,
      benchmarkProposalId: benchmarkProposals.id,
      benchmarkVersionId: benchmarkProposals.benchmarkVersionId,
      benchmarkVersionTag: benchmarkVersions.versionTag,
      provenancePolicyVersion: benchmarkProposals.provenancePolicyVersion,
      unitBasis: specifications.unitBasis,
      geography: specifications.geography,
      priceMin: materialLibrary.priceAedMin,
      priceMax: materialLibrary.priceAedMax,
    })
    .from(materialLibrary)
    .innerJoin(
      benchmarkProposals,
      and(
        eq(benchmarkProposals.legacyMaterialLibraryId, materialLibrary.id),
        eq(benchmarkProposals.productId, materialLibrary.productId)
      )
    )
    .innerJoin(specifications, eq(specifications.id, benchmarkProposals.specId))
    .leftJoin(
      benchmarkVersions,
      eq(benchmarkVersions.id, benchmarkProposals.benchmarkVersionId)
    )
    .where(and(...eligibilityConditions));
  const unique = new Map<number, LegacyCompatibilityPriceRow>();
  for (const row of rows) {
    if (
      row.productId === null ||
      row.specId === null ||
      row.priceMin === null ||
      row.priceMax === null
    ) {
      continue;
    }
    const eligible = {
      ...row,
      benchmarkVersion:
        row.benchmarkVersionTag ?? "legacy-unversioned-benchmark",
      productId: row.productId,
      specId: row.specId,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
    };
    delete (eligible as Partial<typeof eligible>).benchmarkVersionTag;
    const existing = unique.get(row.legacyId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(eligible)) {
      throw new Error(
        `Ambiguous EV-02 compatibility link for material_library:${row.legacyId}`
      );
    }
    unique.set(row.legacyId, eligible);
  }
  return Array.from(unique.values());
}

export async function listMaterialResolutionSpecifications(input: {
  categories: string[];
  finishLevels: string[];
  unitBases: PriceUnitBasis[];
  geographies: UaePriceGeography[];
}): Promise<MaterialResolutionSpecificationRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (
    input.categories.length === 0 ||
    input.finishLevels.length === 0 ||
    input.unitBases.length === 0 ||
    input.geographies.length === 0
  ) {
    return [];
  }
  return db
    .select({
      id: specifications.id,
      category: specifications.category,
      finishLevel: specifications.finishLevel,
      unitBasis: specifications.unitBasis,
      geography: specifications.geography,
    })
    .from(specifications)
    .where(
      and(
        inArray(specifications.category, input.categories as any),
        inArray(specifications.finishLevel, input.finishLevels as any),
        inArray(specifications.unitBasis, input.unitBases),
        inArray(specifications.geography, input.geographies)
      )
    );
}

async function listGovernedValueCandidatesForSpecificationsWithScope(input: {
  specIds: number[];
  organizationId?: number;
  globalOnly: boolean;
}): Promise<GovernedValueCandidate[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const specIds = Array.from(new Set(input.specIds));
  if (specIds.length === 0) return [];

  const scopeCondition =
    input.globalOnly || input.organizationId === undefined
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
      benchmarkVersionTag: benchmarkVersions.versionTag,
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
      joinedProductId: products.id,
      productOrgId: products.orgId,
    })
    .from(benchmarkProposals)
    .innerJoin(specifications, eq(specifications.id, benchmarkProposals.specId))
    .leftJoin(products, eq(products.id, benchmarkProposals.productId))
    .leftJoin(
      benchmarkVersions,
      eq(benchmarkVersions.id, benchmarkProposals.benchmarkVersionId)
    )
    .leftJoin(
      supplierQuotes,
      eq(supplierQuotes.id, benchmarkProposals.supplierQuoteId)
    )
    .where(
      and(
        inArray(benchmarkProposals.specId, specIds),
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
        scopeCondition,
        ...(input.globalOnly
          ? [
              isNull(benchmarkProposals.supplierQuoteId),
              ne(benchmarkProposals.sourceLadderRung, "supplier_quote"),
              or(
                isNull(benchmarkProposals.productId),
                and(isNotNull(products.id), isNull(products.orgId))
              ),
            ]
          : [])
      )
    );

  const quoteIds = rows
    .map(row => row.supplierQuoteId)
    .filter((id): id is number => id !== null);
  const quoteSupersededAt = new Map<number, Date>();
  const quoteOrganizations = new Map(
    rows
      .filter(
        (
          row
        ): row is typeof row & {
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
    .filter(row => !input.globalOnly || isGlobalGovernedCandidateScope(row))
    .filter(
      (
        row
      ): row is typeof row & {
        specId: number;
        sourceLadderRung: SourceLadderRung;
      } => row.specId !== null && row.sourceLadderRung !== null
    )
    .map(row => {
      const {
        joinedProductId: _joinedProductId,
        productOrgId: _productOrgId,
        ...candidate
      } = row;
      return {
        ...candidate,
        benchmarkVersion:
          row.benchmarkVersionTag ?? "legacy-unversioned-benchmark",
        benchmarkVersionTag: undefined,
        effectiveAt: row.reviewedAt ?? row.createdAt,
        quoteSupersededAt:
          row.supplierQuoteId === null
            ? null
            : (quoteSupersededAt.get(row.supplierQuoteId) ?? null),
      };
    });
}

export async function listGovernedValueCandidatesForSpecifications(input: {
  specIds: number[];
  organizationId?: number;
}): Promise<GovernedValueCandidate[]> {
  return listGovernedValueCandidatesForSpecificationsWithScope({
    ...input,
    globalOnly: false,
  });
}

export async function listGlobalGovernedValueCandidatesForSpecifications(input: {
  specIds: number[];
}): Promise<GovernedValueCandidate[]> {
  return listGovernedValueCandidatesForSpecificationsWithScope({
    ...input,
    organizationId: undefined,
    globalOnly: true,
  });
}

export async function listGovernedValueCandidates(input: {
  specId: number;
  organizationId?: number;
}): Promise<GovernedValueCandidate[]> {
  const candidates = await listGovernedValueCandidatesForSpecifications({
    specIds: [input.specId],
    organizationId: input.organizationId,
  });
  return candidates.filter(candidate => candidate.specId === input.specId);
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
      throw new Error(
        "Supplier-quote observations require quote and organization"
      );
    }
    const quote = await db
      .select({ orgId: supplierQuotes.orgId })
      .from(supplierQuotes)
      .where(eq(supplierQuotes.id, data.supplierQuoteId))
      .limit(1);
    if (!quote[0] || quote[0].orgId !== data.orgId) {
      throw new Error("Supplier quote is unavailable");
    }
  } else if (
    data.supplierQuoteId !== undefined &&
    data.supplierQuoteId !== null
  ) {
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
      .where(and(eq(evidenceRecords.id, input.predecessorId), orgCondition))
      .limit(1);
    if (!predecessor[0]) throw new Error("Price observation is unavailable");

    const successor = await tx
      .select({ id: evidenceRecords.id })
      .from(evidenceRecords)
      .where(eq(evidenceRecords.supersedesObservationId, input.predecessorId))
      .limit(1);
    if (successor[0])
      throw new Error("Price observation is already superseded");

    const spec = await tx
      .select({ id: specifications.id })
      .from(specifications)
      .where(eq(specifications.id, input.data.specId))
      .limit(1);
    if (!spec[0]) throw new Error("Specification not found");

    if (input.data.observationKind === "supplier_quote") {
      if (!input.data.supplierQuoteId || input.orgId === null) {
        throw new Error(
          "Supplier-quote observations require quote and organization"
        );
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
    throw new Error(
      "Quote corrections must use insertSupersedingSupplierQuote"
    );
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
