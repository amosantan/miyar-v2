import { createHash } from "node:crypto";

import type {
  PriceScope,
  PriceUnitBasis,
  UaePriceGeography,
} from "../../../shared/material-pricing";
import {
  PRICE_UNIT_BASES,
  UAE_PRICE_GEOGRAPHIES,
} from "../../../shared/material-pricing";

export const EV02R_PACKET_VERSION = "ev02r-decision-packet-v1" as const;

export type Ev02rUnresolvedReason =
  | "unknown_unit_basis"
  | "incomplete_price_range";

export const EXPECTED_EV02R_UNRESOLVED_ROWS = [
  { legacyRowId: 36, reason: "unknown_unit_basis" },
  { legacyRowId: 37, reason: "unknown_unit_basis" },
  { legacyRowId: 38, reason: "unknown_unit_basis" },
  { legacyRowId: 106, reason: "unknown_unit_basis" },
  { legacyRowId: 107, reason: "unknown_unit_basis" },
  { legacyRowId: 108, reason: "unknown_unit_basis" },
  { legacyRowId: 109, reason: "unknown_unit_basis" },
  { legacyRowId: 110, reason: "unknown_unit_basis" },
  { legacyRowId: 111, reason: "unknown_unit_basis" },
  { legacyRowId: 129, reason: "incomplete_price_range" },
  { legacyRowId: 161, reason: "incomplete_price_range" },
  { legacyRowId: 162, reason: "incomplete_price_range" },
  { legacyRowId: 173, reason: "incomplete_price_range" },
  { legacyRowId: 174, reason: "incomplete_price_range" },
  { legacyRowId: 175, reason: "incomplete_price_range" },
  { legacyRowId: 226, reason: "unknown_unit_basis" },
  { legacyRowId: 227, reason: "unknown_unit_basis" },
  { legacyRowId: 229, reason: "unknown_unit_basis" },
  { legacyRowId: 230, reason: "unknown_unit_basis" },
  { legacyRowId: 231, reason: "unknown_unit_basis" },
  { legacyRowId: 232, reason: "unknown_unit_basis" },
  { legacyRowId: 233, reason: "unknown_unit_basis" },
  { legacyRowId: 234, reason: "unknown_unit_basis" },
  { legacyRowId: 235, reason: "unknown_unit_basis" },
  { legacyRowId: 236, reason: "unknown_unit_basis" },
  { legacyRowId: 237, reason: "unknown_unit_basis" },
  { legacyRowId: 238, reason: "unknown_unit_basis" },
  { legacyRowId: 239, reason: "unknown_unit_basis" },
  { legacyRowId: 240, reason: "unknown_unit_basis" },
  { legacyRowId: 241, reason: "unknown_unit_basis" },
  { legacyRowId: 246, reason: "unknown_unit_basis" },
  { legacyRowId: 247, reason: "unknown_unit_basis" },
  { legacyRowId: 248, reason: "unknown_unit_basis" },
  { legacyRowId: 249, reason: "unknown_unit_basis" },
  { legacyRowId: 254, reason: "unknown_unit_basis" },
  { legacyRowId: 255, reason: "unknown_unit_basis" },
  { legacyRowId: 256, reason: "unknown_unit_basis" },
  { legacyRowId: 257, reason: "unknown_unit_basis" },
  { legacyRowId: 261, reason: "unknown_unit_basis" },
  { legacyRowId: 262, reason: "unknown_unit_basis" },
  { legacyRowId: 263, reason: "unknown_unit_basis" },
  { legacyRowId: 264, reason: "unknown_unit_basis" },
  { legacyRowId: 265, reason: "unknown_unit_basis" },
] as const satisfies readonly {
  legacyRowId: number;
  reason: Ev02rUnresolvedReason;
}[];

export const EV02R_APPROVED_REJECTION_IDS = [
  36, 37, 38, 106, 107, 108, 109, 110, 111, 226, 227, 229, 230, 231, 232,
  233, 234, 235, 236, 237, 238, 239, 240, 241,
] as const;

export type Ev02rJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly Ev02rJsonValue[]
  | { readonly [key: string]: Ev02rJsonValue };

export type Ev02rLegacyRow = {
  readonly id: number;
  readonly [key: string]: Ev02rJsonValue;
};

export type Ev02rEvidenceReference = {
  sourceType: "supplier" | "manufacturer" | "official_statistic";
  authoritativeUrl: string;
  documentSha256: string;
  capturedAt: string;
  effectiveDate: string;
};

export type Ev02rProposedResolution = {
  productIdentity: string;
  specificationIdentity: string;
  unitBasis: PriceUnitBasis;
  priceScope: PriceScope;
  geography: UaePriceGeography;
  effectiveDate: string;
};

export type Ev02rGovernedPriceRange = {
  currency: "AED";
  min: string;
  max: string;
};

type Ev02rInventoryBase = {
  legacyRowId: number;
  unresolvedReason: Ev02rUnresolvedReason;
  legacyRow: Ev02rLegacyRow;
  sourceRowFingerprint: string;
  currentProductLink: {
    productId: number;
    identityKey: string;
  };
  legacyProvenance: {
    sourceLabel: string;
    sourceUrl: string | null;
    provenancePolicyVersion: string;
  };
  usageImpact: {
    downstreamConsumers: readonly string[];
    governedFinancialImpact: string;
    currentEligibility: "insufficient";
    legacyUsageSnapshot?: {
      allocationCount: number;
      allocationProjectCount: number;
      lockedAllocationCount: number;
      storedLegacyAllocationTotalMin: string | null;
      storedLegacyAllocationTotalMax: string | null;
      finishScheduleCount: number;
      finishScheduleProjectCount: number;
      rfqLineCount: number;
      issuedRfqLineCount: number;
      storedLegacyRfqTotalMin: string | null;
      storedLegacyRfqTotalMax: string | null;
      boardLinkCount: number;
    };
  };
  proposedResolution: Ev02rProposedResolution | null;
};

export type Ev02rInventoryRow = Ev02rInventoryBase &
  (
    | {
        decision: "approve";
        evidence: readonly Ev02rEvidenceReference[];
        approver: string;
        approvalReference: string;
        governedPriceRange: Ev02rGovernedPriceRange;
      }
    | {
        decision: "reject";
        decisionReason: string;
        approver: string;
        approvalReference: string;
      }
    | {
        decision: "needs_evidence";
        decisionReason: string;
      }
  );

export type Ev02rDecisionPacket = {
  version: typeof EV02R_PACKET_VERSION;
  inventory: readonly Ev02rInventoryRow[];
  summary: {
    total: 43;
    unknownUnitBasis: 37;
    incompletePriceRange: 6;
    approved: number;
    rejected: number;
    needsEvidence: number;
  };
};

export type BuiltEv02rDecisionPacket = {
  packet: Ev02rDecisionPacket;
  canonicalJson: string;
  sha256: string;
};

export type Ev02rRejectionApproval = {
  approver: string;
  approvalReference: string;
};

function fail(message: string): never {
  throw new Error(`EV-02R decision packet rejected: ${message}`);
}

/** RFC-8785-like canonical JSON for the JSON subset used by the packet. */
export function canonicalizeEv02rJson(value: Ev02rJsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("canonical JSON contains a non-finite number");
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeEv02rJson).join(",")}]`;
  }
  if (typeof value !== "object") {
    fail("canonical JSON contains a non-JSON value");
  }
  const record = value as { readonly [key: string]: Ev02rJsonValue };
  return `{${Object.keys(record)
    .sort()
    .map(key => {
      if (record[key] === undefined) {
        fail(`canonical JSON property ${key} is undefined`);
      }
      return `${JSON.stringify(key)}:${canonicalizeEv02rJson(record[key])}`;
    })
    .join(",")}}`;
}

export function sha256Ev02rCanonicalJson(value: Ev02rJsonValue): string {
  return createHash("sha256")
    .update(canonicalizeEv02rJson(value), "utf8")
    .digest("hex");
}

export function createEv02rSourceRowFingerprint(
  legacyRow: Ev02rLegacyRow
): string {
  return sha256Ev02rCanonicalJson(legacyRow);
}

function expectedKey(row: {
  legacyRowId: number;
  reason?: Ev02rUnresolvedReason;
  unresolvedReason?: Ev02rUnresolvedReason;
}): string {
  return `${row.legacyRowId}:${row.reason ?? row.unresolvedReason}`;
}

/**
 * Proves that an inventory is the exact frozen EV-02 production unresolved set.
 * Duplicate, missing, extra, reason-drifted, or source-row-drifted entries fail.
 */
export function assertEv02rInventory(
  inventory: readonly Ev02rInventoryRow[]
): void {
  if (inventory.length !== EXPECTED_EV02R_UNRESOLVED_ROWS.length) {
    fail(
      `expected exactly 43 inventory rows, received ${inventory.length}`
    );
  }

  const expected = new Set(EXPECTED_EV02R_UNRESOLVED_ROWS.map(expectedKey));
  const seenIds = new Set<number>();
  for (const row of inventory) {
    if (!Number.isSafeInteger(row.legacyRowId) || row.legacyRowId <= 0) {
      fail(`invalid legacy row ID ${String(row.legacyRowId)}`);
    }
    if (seenIds.has(row.legacyRowId)) {
      fail(`duplicate legacy row ID ${row.legacyRowId}`);
    }
    seenIds.add(row.legacyRowId);
    if (!expected.has(expectedKey(row))) {
      fail(
        `unexpected row or unresolved reason ${row.legacyRowId}:${row.unresolvedReason}`
      );
    }
    if (row.legacyRow.id !== row.legacyRowId) {
      fail(`legacy row identity mismatch for ${row.legacyRowId}`);
    }
    const actualFingerprint = createEv02rSourceRowFingerprint(row.legacyRow);
    if (
      !/^[a-f0-9]{64}$/.test(row.sourceRowFingerprint) ||
      row.sourceRowFingerprint !== actualFingerprint
    ) {
      fail(`source-row fingerprint mismatch for ${row.legacyRowId}`);
    }
  }

  for (const row of EXPECTED_EV02R_UNRESOLVED_ROWS) {
    if (!seenIds.has(row.legacyRowId)) {
      fail(`missing legacy row ID ${row.legacyRowId}`);
    }
  }
}

/**
 * Applies only the owner's approved 24-row non-material rejection set.
 * It never promotes a governed value; every other row remains needs_evidence.
 */
export function applyEv02rRejectionApproval(
  inventory: readonly Ev02rInventoryRow[],
  approval: Ev02rRejectionApproval
): BuiltEv02rDecisionPacket {
  assertEv02rInventory(inventory);
  const approver = requireText(approval.approver, "approver", 0);
  const approvalReference = requireText(
    approval.approvalReference,
    "approval reference",
    0
  );
  const rejectedIds = new Set<number>(EV02R_APPROVED_REJECTION_IDS);
  const decisions = inventory.map(row => {
    const base = { ...row } as Record<string, unknown>;
    delete base.approver;
    delete base.approvalReference;
    delete base.evidence;
    delete base.governedPriceRange;
    delete base.governedWrite;
    delete base.decisionReason;

    if (rejectedIds.has(row.legacyRowId)) {
      return {
        ...base,
        proposedResolution: null,
        decision: "reject",
        decisionReason:
          "Authorized rejection: the source row is a non-material metric and is ineligible for material pricing.",
        approver,
        approvalReference,
      } as Ev02rInventoryRow;
    }

    return {
      ...base,
      proposedResolution: null,
      decision: "needs_evidence",
      decisionReason:
        "No governed mapping is approved; authoritative evidence and any required contract decision remain outstanding.",
    } as Ev02rInventoryRow;
  });

  return buildEv02rDecisionPacket(decisions);
}

function requireText(value: unknown, label: string, rowId: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} is required for row ${rowId}`);
  }
  return value.trim();
}

function requireDate(value: string, label: string, rowId: number): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    fail(`${label} must be an ISO date for row ${rowId}`);
  }
}

function requireCapturedAt(value: string, rowId: number): void {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    requireDate(value, "evidence capturedAt", rowId);
    return;
  }
  const parsed = new Date(value);
  const normalizedInput = value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString() !== normalizedInput
  ) {
    fail(`evidence capturedAt must be an ISO date or UTC timestamp for row ${rowId}`);
  }
}

function requireAuthoritativeUrl(value: string, rowId: number): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`authoritative evidence URL is invalid for row ${rowId}`);
  }
  if (url!.protocol !== "https:" || !url!.hostname) {
    fail(`authoritative evidence URL must use HTTPS for row ${rowId}`);
  }
}

function parsePositiveDecimal(
  value: string,
  label: string,
  rowId: number
): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    fail(`${label} must be a non-negative decimal for row ${rowId}`);
  }
  const [whole, fraction = ""] = value.split(".");
  const scaled = `${whole}${fraction.padEnd(6, "0")}`;
  return BigInt(scaled);
}

function validateCommonInventory(row: Ev02rInventoryRow): void {
  requireText(
    row.currentProductLink.identityKey,
    "current product identity",
    row.legacyRowId
  );
  if (
    !Number.isSafeInteger(row.currentProductLink.productId) ||
    row.currentProductLink.productId <= 0
  ) {
    fail(`current product ID is invalid for row ${row.legacyRowId}`);
  }
  requireText(
    row.legacyProvenance.sourceLabel,
    "legacy provenance source label",
    row.legacyRowId
  );
  requireText(
    row.legacyProvenance.provenancePolicyVersion,
    "legacy provenance policy version",
    row.legacyRowId
  );
  requireText(
    row.usageImpact.governedFinancialImpact,
    "governed financial impact",
    row.legacyRowId
  );
  if (row.usageImpact.currentEligibility !== "insufficient") {
    fail(`current eligibility must remain insufficient for row ${row.legacyRowId}`);
  }
  if (
    row.usageImpact.downstreamConsumers.length === 0 ||
    row.usageImpact.downstreamConsumers.some(
      consumer => typeof consumer !== "string" || consumer.trim().length === 0
    )
  ) {
    fail(`usage impact consumers are required for row ${row.legacyRowId}`);
  }
}

function validateApproval(row: Ev02rInventoryRow & { decision: "approve" }): void {
  const resolution = row.proposedResolution;
  if (!resolution) {
    fail(`approved row ${row.legacyRowId} has no proposed resolution`);
  }
  requireText(
    resolution.productIdentity,
    "proposed product identity",
    row.legacyRowId
  );
  requireText(
    resolution.specificationIdentity,
    "proposed specification identity",
    row.legacyRowId
  );
  if (!PRICE_UNIT_BASES.includes(resolution.unitBasis)) {
    fail(`unit basis is invalid for row ${row.legacyRowId}`);
  }
  if (
    resolution.priceScope !== "supply_only" &&
    resolution.priceScope !== "supply_and_install"
  ) {
    fail(`price scope is invalid for row ${row.legacyRowId}`);
  }
  if (!UAE_PRICE_GEOGRAPHIES.includes(resolution.geography)) {
    fail(`geography is invalid for row ${row.legacyRowId}`);
  }
  requireDate(resolution.effectiveDate, "effective date", row.legacyRowId);
  requireText(row.approver, "approver", row.legacyRowId);
  requireText(
    row.approvalReference,
    "approval reference",
    row.legacyRowId
  );
  if (row.evidence.length === 0) {
    fail(`authoritative evidence is required for row ${row.legacyRowId}`);
  }
  for (const evidence of row.evidence) {
    if (
      evidence.sourceType !== "supplier" &&
      evidence.sourceType !== "manufacturer" &&
      evidence.sourceType !== "official_statistic"
    ) {
      fail(`evidence is not an approved authority for row ${row.legacyRowId}`);
    }
    requireAuthoritativeUrl(evidence.authoritativeUrl, row.legacyRowId);
    if (!/^[a-f0-9]{64}$/.test(evidence.documentSha256)) {
      fail(`evidence document digest is invalid for row ${row.legacyRowId}`);
    }
    requireCapturedAt(evidence.capturedAt, row.legacyRowId);
    requireDate(evidence.effectiveDate, "evidence effective date", row.legacyRowId);
  }

  if (!row.governedPriceRange) {
    fail(`approved row ${row.legacyRowId} requires a complete governed range`);
  }
  if (row.governedPriceRange.currency !== "AED") {
    fail(`governed range currency must be AED for row ${row.legacyRowId}`);
  }
  const min = parsePositiveDecimal(
    row.governedPriceRange.min,
    "governed minimum",
    row.legacyRowId
  );
  const max = parsePositiveDecimal(
    row.governedPriceRange.max,
    "governed maximum",
    row.legacyRowId
  );
  if (min > max) {
    fail(`governed minimum exceeds maximum for row ${row.legacyRowId}`);
  }
  if (row.unresolvedReason === "incomplete_price_range") {
    const legacyMin = row.legacyRow.priceAedMin;
    const legacyMax = row.legacyRow.priceAedMax;
    if (
      (typeof legacyMin === "string" &&
        row.governedPriceRange.max === legacyMin) ||
      (typeof legacyMin === "number" &&
        row.governedPriceRange.max === String(legacyMin)) ||
      (typeof legacyMax === "string" &&
        row.governedPriceRange.min === legacyMax) ||
      (typeof legacyMax === "number" &&
        row.governedPriceRange.min === String(legacyMax))
    ) {
      fail(`missing range bound appears copied from the legacy bound for row ${row.legacyRowId}`);
    }
  }
}

function validateDecision(row: Ev02rInventoryRow): void {
  validateCommonInventory(row);
  if (row.decision === "approve") {
    if ("decisionReason" in (row as unknown as Record<string, unknown>)) {
      fail(`approved row ${row.legacyRowId} must not carry a rejection reason`);
    }
    validateApproval(row);
    return;
  }
  requireText(row.decisionReason, "decision reason", row.legacyRowId);
  const untrusted = row as unknown as Record<string, unknown>;
  if (row.decision === "reject") {
    requireText(row.approver, "rejecting approver", row.legacyRowId);
    requireText(
      row.approvalReference,
      "rejection approval reference",
      row.legacyRowId
    );
    if ("governedPriceRange" in untrusted || "governedWrite" in untrusted) {
      fail(`rejected row ${row.legacyRowId} must not carry a governed write`);
    }
    return;
  }
  if (
    "governedPriceRange" in untrusted ||
    "governedWrite" in untrusted ||
    "approvalReference" in untrusted ||
    "approver" in untrusted
  ) {
    fail(`${row.decision} row ${row.legacyRowId} must not carry a governed write or approval`);
  }
}

function normalizeRow(row: Ev02rInventoryRow): Ev02rInventoryRow {
  const common = {
    ...row,
    usageImpact: {
      ...row.usageImpact,
      downstreamConsumers: [...row.usageImpact.downstreamConsumers].sort(),
    },
  };
  if (row.decision !== "approve") return common;
  return {
    ...common,
    decision: "approve",
    evidence: [...row.evidence].sort((left, right) =>
      `${left.authoritativeUrl}:${left.documentSha256}`.localeCompare(
        `${right.authoritativeUrl}:${right.documentSha256}`
      )
    ),
    approver: row.approver,
    approvalReference: row.approvalReference,
    governedPriceRange: row.governedPriceRange,
  };
}

export function buildEv02rDecisionPacket(
  inventory: readonly Ev02rInventoryRow[]
): BuiltEv02rDecisionPacket {
  assertEv02rInventory(inventory);
  inventory.forEach(validateDecision);

  const normalized = inventory
    .map(normalizeRow)
    .sort((left, right) => left.legacyRowId - right.legacyRowId);
  const draft: Ev02rDecisionPacket = {
    version: EV02R_PACKET_VERSION,
    inventory: normalized,
    summary: {
      total: 43,
      unknownUnitBasis: 37,
      incompletePriceRange: 6,
      approved: normalized.filter(row => row.decision === "approve").length,
      rejected: normalized.filter(row => row.decision === "reject").length,
      needsEvidence: normalized.filter(
        row => row.decision === "needs_evidence"
      ).length,
    },
  };
  const canonicalJson = canonicalizeEv02rJson(
    draft as unknown as Ev02rJsonValue
  );
  // Detach the returned packet from every caller-owned object after validation.
  const packet = JSON.parse(canonicalJson) as Ev02rDecisionPacket;
  return {
    packet,
    canonicalJson,
    sha256: createHash("sha256").update(canonicalJson, "utf8").digest("hex"),
  };
}
