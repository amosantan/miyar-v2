import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { RegulatorySourceRegistration } from "@shared/regulatory-sources";
import type { RegulatorySourceAssertionEnvelope } from "@shared/typology-pack-v2";
import { getDb } from "../db";
import {
  regulatoryClauseCandidates,
  regulatorySourceAssertions,
  regulatorySourceCaptures,
  regulatorySourceRelations,
  regulatorySources,
  regulatorySourceVersions,
} from "../../drizzle/schema";
import type { RegulatoryTemporalRelation, RegulatoryVersionState } from "../engines/regulatory-source-resolution";

export class RegulatorySourceStoreError extends Error {
  constructor(public readonly code: "UNAVAILABLE" | "NOT_FOUND" | "CONFLICT" | "DENIED", message: string) {
    super(message);
  }
}

async function database() {
  const db = await getDb();
  if (!db) throw new RegulatorySourceStoreError("UNAVAILABLE", "Regulatory source database unavailable");
  return db;
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};

export async function listRegulatorySources() {
  const db = await database();
  return db.select().from(regulatorySources).orderBy(asc(regulatorySources.sourceKey));
}

export async function registerRegulatorySource(registration: RegulatorySourceRegistration) {
  const db = await database();
  return db.transaction(async tx => {
    const existing = (await tx.select().from(regulatorySources).where(eq(regulatorySources.sourceKey, registration.sourceKey)).limit(1).for("update"))[0];
    const values = {
      sourceKey: registration.sourceKey,
      issuingAuthority: registration.issuingAuthority,
      documentIdentity: registration.title,
      jurisdiction: registration.jurisdiction,
      languages: [...registration.languages],
      canonicalUrl: registration.canonicalUrl,
      approvedHosts: [...registration.approvedHosts],
      retentionPolicy: registration.retentionPolicy,
      licensingStatus: registration.licensingStatus,
      coverageStatus: registration.coverageStatus,
    } as const;
    if (existing) {
      const identityMatches = existing.issuingAuthority === values.issuingAuthority && existing.documentIdentity === values.documentIdentity && existing.jurisdiction === values.jurisdiction && existing.canonicalUrl === values.canonicalUrl;
      if (!identityMatches) throw new RegulatorySourceStoreError("CONFLICT", "Registered regulatory source identity cannot be changed in place");
      return existing;
    }
    const inserted = await tx.insert(regulatorySources).values(values);
    return (await tx.select().from(regulatorySources).where(eq(regulatorySources.id, Number(inserted[0].insertId))).limit(1))[0];
  });
}

export type RegulatoryCaptureInput = {
  sourceKey: string;
  versionKey: string;
  edition?: string;
  publicationDate?: Date;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  contentFingerprint: string;
  parserVersion: string;
  requestedUrl: string;
  finalUrl?: string;
  retrievedAt: Date;
  httpStatus?: number;
  mimeType?: string;
  byteLength?: number;
  etag?: string;
  lastModified?: string;
  storageReference?: string;
  fetchResult: "captured" | "unchanged" | "changed_candidate" | "disappeared_candidate" | "denied" | "failed";
  failureCode?: string;
  clauseCandidates?: Array<{
    clauseKey: string;
    locator: string;
    pageLocator?: string;
    candidateSummary: string;
    extractionMethod: "deterministic" | "ai_extracted_candidate" | "human_transcription";
  }>;
};

export async function recordRegulatoryCapture(input: RegulatoryCaptureInput) {
  const db = await database();
  return db.transaction(async tx => {
    const source = (await tx.select().from(regulatorySources).where(eq(regulatorySources.sourceKey, input.sourceKey)).limit(1).for("update"))[0];
    if (!source) throw new RegulatorySourceStoreError("NOT_FOUND", "Regulatory source is not registered");
    if (input.storageReference && source.retentionPolicy !== "artifact_permitted") {
      throw new RegulatorySourceStoreError("DENIED", "Raw artifact retention is not permitted for this source");
    }

    // Capture order is part of regulatory state. An older response arriving
    // after a newer one must never create a candidate or stale an asserted
    // version. Reject it before any write so callers can quarantine/retry it.
    const latestCapture = (await tx.select({ retrievedAt: regulatorySourceCaptures.retrievedAt })
      .from(regulatorySourceCaptures)
      .where(eq(regulatorySourceCaptures.sourceId, source.id))
      .orderBy(desc(regulatorySourceCaptures.retrievedAt), desc(regulatorySourceCaptures.id))
      .limit(1)
      .for("update"))[0];
    if (latestCapture && input.retrievedAt.getTime() <= latestCapture.retrievedAt.getTime()) {
      throw new RegulatorySourceStoreError("CONFLICT", "Non-monotonic regulatory capture rejected; quarantine it outside the authoritative ledger");
    }

    let version = (await tx.select().from(regulatorySourceVersions).where(and(
      eq(regulatorySourceVersions.sourceId, source.id),
      eq(regulatorySourceVersions.contentFingerprint, input.contentFingerprint),
    )).limit(1).for("update"))[0];

    if (!version && (input.fetchResult === "captured" || input.fetchResult === "changed_candidate")) {
      const inserted = await tx.insert(regulatorySourceVersions).values({
        sourceId: source.id,
        versionKey: input.versionKey,
        edition: input.edition,
        publicationDate: input.publicationDate,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        contentFingerprint: input.contentFingerprint,
        parserVersion: input.parserVersion,
        status: "candidate",
      });
      version = (await tx.select().from(regulatorySourceVersions).where(eq(regulatorySourceVersions.id, Number(inserted[0].insertId))).limit(1))[0];
    }

    // A byte change or disappearance is never interpreted as repeal. It does,
    // however, prevent new-use resolution until the new candidate is reviewed.
    if (input.fetchResult === "changed_candidate" || input.fetchResult === "disappeared_candidate") {
      await tx.update(regulatorySourceVersions).set({ status: "stale" }).where(and(
        eq(regulatorySourceVersions.sourceId, source.id),
        eq(regulatorySourceVersions.status, "asserted"),
      ));
    }

    const capture = await tx.insert(regulatorySourceCaptures).values({
      sourceId: source.id,
      sourceVersionId: version?.id,
      requestedUrl: input.requestedUrl,
      finalUrl: input.finalUrl,
      retrievedAt: input.retrievedAt,
      httpStatus: input.httpStatus,
      mimeType: input.mimeType,
      byteLength: input.byteLength,
      artifactFingerprint: input.contentFingerprint,
      etag: input.etag,
      lastModified: input.lastModified,
      parserVersion: input.parserVersion,
      storageReference: input.storageReference,
      fetchResult: input.fetchResult,
      failureCode: input.failureCode,
    });

    if (version && input.clauseCandidates?.length) {
      for (const clause of input.clauseCandidates) {
        const candidateFingerprint = createHash("sha256").update(canonical({ sourceVersionFingerprint: version.contentFingerprint, ...clause }), "utf8").digest("hex");
        await tx.insert(regulatoryClauseCandidates).values({ sourceVersionId: version.id, ...clause, candidateFingerprint });
      }
    }
    return { captureId: Number(capture[0].insertId), sourceVersionId: version?.id ?? null };
  });
}

export async function createRegulatorySourceRelation(input: {
  sourceVersionId: number;
  targetSourceVersionId: number;
  relationType: "amends" | "supersedes" | "suspends" | "revokes" | "clarifies";
  clauseScope: readonly string[];
  effectiveFrom?: Date;
  effectiveTo?: Date;
}) {
  if (input.sourceVersionId === input.targetSourceVersionId) throw new RegulatorySourceStoreError("CONFLICT", "A source version cannot relate to itself");
  const db = await database();
  const relationFingerprint = createHash("sha256").update(canonical({
    ...input,
    clauseScope: [...input.clauseScope].sort(),
    effectiveFrom: input.effectiveFrom?.toISOString(),
    effectiveTo: input.effectiveTo?.toISOString(),
  }), "utf8").digest("hex");
  const result = await db.insert(regulatorySourceRelations).values({ ...input, clauseScope: [...input.clauseScope].sort(), relationFingerprint });
  return { id: Number(result[0].insertId), relationFingerprint };
}

export async function createRegulatorySourceAssertion(input: {
  sourceVersionId: number;
  assertionType: "document_identity" | "authenticity" | "temporal_status" | "jurisdiction" | "permitted_use";
  decision: "accepted" | "rejected" | "withdrawn";
  assertedByUserId: number;
  reason: string;
  validFrom: Date;
  validTo?: Date;
},
// The write-time clock used to snapshot `version.status` (see below). Kept as
// a second parameter so it never enters `input` — which is spread into both
// the assertion fingerprint and the row insert. Production passes nothing and
// gets wall-clock time; tests inject a fixed instant so the derived snapshot
// does not depend on the day the suite happens to run.
options: { now?: Date } = {}) {
  const db = await database();
  return db.transaction(async tx => {
    const version = (await tx.select().from(regulatorySourceVersions).where(eq(regulatorySourceVersions.id, input.sourceVersionId)).limit(1).for("update"))[0];
    if (!version) throw new RegulatorySourceStoreError("NOT_FOUND", "Regulatory source version not found");
    const assertionFingerprint = createHash("sha256").update(canonical({ ...input, validFrom: input.validFrom.toISOString(), validTo: input.validTo?.toISOString() }), "utf8").digest("hex");
    const result = await tx.insert(regulatorySourceAssertions).values({ ...input, assertionFingerprint });
    const assertions = await tx.select().from(regulatorySourceAssertions).where(eq(regulatorySourceAssertions.sourceVersionId, input.sourceVersionId)).orderBy(asc(regulatorySourceAssertions.id));
    const latest = new Map(assertions.map(assertion => [assertion.assertionType, assertion]));
    const required = ["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"] as const;
    // A coarse write-time snapshot only. The authoritative currency check is in
    // loadRegulatoryResolutionState, which recomputes `requiredAssertionsCurrent`
    // at the requested `basisAt`, so this row never needs a background rewrite.
    const now = options.now ?? new Date();
    const complete = required.every(type => {
      //DEBUG
      const assertion = latest.get(type);
      return assertion?.decision === "accepted" && assertion.validFrom <= now && (!assertion.validTo || assertion.validTo > now);
    });
    await tx.update(regulatorySourceVersions).set({
      status: complete ? "asserted" : version.status === "asserted" ? "stale" : version.status,
    }).where(eq(regulatorySourceVersions.id, input.sourceVersionId));
    return { id: Number(result[0].insertId), assertionFingerprint, versionStatus: complete ? "asserted" as const : version.status === "asserted" ? "stale" as const : version.status };
  });
}

export async function listRegulatorySourceVersions(sourceKey: string) {
  const db = await database();
  return db.select({ source: regulatorySources, version: regulatorySourceVersions })
    .from(regulatorySources)
    .innerJoin(regulatorySourceVersions, eq(regulatorySourceVersions.sourceId, regulatorySources.id))
    .where(eq(regulatorySources.sourceKey, sourceKey))
    .orderBy(desc(regulatorySourceVersions.createdAt));
}

const REQUIRED_ASSERTION_TYPES = ["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"] as const;

export type RegulatoryResolutionState = {
  versions: RegulatoryVersionState[];
  relations: RegulatoryTemporalRelation[];
  assertions: RegulatorySourceAssertionEnvelope[];
};

const asIso = (value: Date | null): string | undefined => value?.toISOString();

/**
 * Loads the complete database-backed state needed by resolveRegulatoryReference.
 * Assertion currency is derived for the requested instant, so an assertion that
 * expires after it was accepted fails closed without requiring a background job
 * to rewrite the version row.
 */
export async function loadRegulatoryResolutionState(input: {
  sourceKey: string;
  basisAt: Date;
}): Promise<RegulatoryResolutionState> {
  if (!Number.isFinite(input.basisAt.getTime())) throw new RegulatorySourceStoreError("CONFLICT", "Resolution basis date is invalid");
  const db = await database();
  const source = (await db.select().from(regulatorySources).where(eq(regulatorySources.sourceKey, input.sourceKey)).limit(1))[0];
  if (!source) throw new RegulatorySourceStoreError("NOT_FOUND", "Regulatory source is not registered");

  const primaryVersions = await db.select().from(regulatorySourceVersions).where(eq(regulatorySourceVersions.sourceId, source.id));
  const primaryIds = primaryVersions.map(version => version.id);
  if (primaryIds.length === 0) return { versions: [], relations: [], assertions: [] };

  const relationRows = await db.select().from(regulatorySourceRelations).where(or(
    inArray(regulatorySourceRelations.sourceVersionId, primaryIds),
    inArray(regulatorySourceRelations.targetSourceVersionId, primaryIds),
  ));
  const relatedIds = Array.from(new Set([...primaryIds, ...relationRows.flatMap(relation => [relation.sourceVersionId, relation.targetSourceVersionId])]));
  const versionRows = await db.select().from(regulatorySourceVersions).where(inArray(regulatorySourceVersions.id, relatedIds));
  const sourceIds = Array.from(new Set(versionRows.map(version => version.sourceId)));
  const versionIds = versionRows.map(version => version.id);
  const [sourceRows, captureRows, assertionRows] = await Promise.all([
    db.select({ id: regulatorySources.id, sourceKey: regulatorySources.sourceKey }).from(regulatorySources).where(inArray(regulatorySources.id, sourceIds)),
    db.select().from(regulatorySourceCaptures).where(inArray(regulatorySourceCaptures.sourceId, sourceIds)).orderBy(desc(regulatorySourceCaptures.retrievedAt), desc(regulatorySourceCaptures.id)),
    db.select().from(regulatorySourceAssertions).where(inArray(regulatorySourceAssertions.sourceVersionId, versionIds)).orderBy(asc(regulatorySourceAssertions.id)),
  ]);

  const latestCaptureBySource = new Map<number, (typeof captureRows)[number]>();
  for (const capture of captureRows) if (!latestCaptureBySource.has(capture.sourceId)) latestCaptureBySource.set(capture.sourceId, capture);
  const at = input.basisAt.getTime();
  const sourceKeys = new Map(sourceRows.map(row => [row.id, row.sourceKey]));
  const currentAssertionByVersionAndType = new Map<string, (typeof assertionRows)[number]>();
  for (const assertion of assertionRows) {
    if (assertion.validFrom.getTime() <= at) currentAssertionByVersionAndType.set(`${assertion.sourceVersionId}:${assertion.assertionType}`, assertion);
  }
  const versions: RegulatoryVersionState[] = versionRows.map(version => {
    const requiredAssertionsCurrent = REQUIRED_ASSERTION_TYPES.every(type => {
      const assertion = currentAssertionByVersionAndType.get(`${version.id}:${type}`);
      return assertion?.decision === "accepted" && (!assertion.validTo || assertion.validTo.getTime() > at);
    });
    return {
      versionKey: version.versionKey,
      contentFingerprint: version.contentFingerprint,
      effectiveFrom: asIso(version.effectiveFrom),
      effectiveTo: asIso(version.effectiveTo),
      status: version.status,
      requiredAssertionsCurrent,
      latestCaptureResult: latestCaptureBySource.get(version.sourceId)?.fetchResult,
    };
  });
  const versionsById = new Map(versionRows.map(version => [version.id, version]));
  const assertions: RegulatorySourceAssertionEnvelope[] = Array.from(currentAssertionByVersionAndType.values()).flatMap(assertion => {
    const version = versionsById.get(assertion.sourceVersionId);
    const sourceKey = version ? sourceKeys.get(version.sourceId) : undefined;
    if (!version || !sourceKey || assertion.decision !== "accepted" || (assertion.validTo && assertion.validTo.getTime() <= at)) return [];
    return [{
      sourceKey,
      sourceVersionFingerprint: version.contentFingerprint,
      assertionType: assertion.assertionType,
      decision: "accepted" as const,
      assertedBy: `platform-user:${assertion.assertedByUserId}`,
      validFrom: assertion.validFrom.toISOString(),
      validTo: asIso(assertion.validTo),
    }];
  });
  const fingerprints = new Map(versionRows.map(version => [version.id, version.contentFingerprint]));
  const relations: RegulatoryTemporalRelation[] = relationRows.flatMap(relation => {
    const sourceVersionFingerprint = fingerprints.get(relation.sourceVersionId);
    const targetVersionFingerprint = fingerprints.get(relation.targetSourceVersionId);
    if (!sourceVersionFingerprint || !targetVersionFingerprint) return [];
    return [{
      sourceVersionFingerprint,
      targetVersionFingerprint,
      relationType: relation.relationType,
      clauseScope: relation.clauseScope as string[],
      effectiveFrom: asIso(relation.effectiveFrom),
      effectiveTo: asIso(relation.effectiveTo),
    }];
  });
  return { versions, relations, assertions };
}
