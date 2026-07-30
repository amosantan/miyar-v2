import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  EXPECTED_EV02R_UNRESOLVED_ROWS,
  EV02R_APPROVED_REJECTION_IDS,
  applyEv02rRejectionApproval,
  assertEv02rInventory,
  buildEv02rDecisionPacket,
  canonicalizeEv02rJson,
  createEv02rSourceRowFingerprint,
  type Ev02rInventoryRow,
} from "./unresolved-remediation";

function makeRow(
  legacyRowId: number,
  unresolvedReason: "unknown_unit_basis" | "incomplete_price_range"
): Ev02rInventoryRow {
  const legacyRow = {
    id: legacyRowId,
    category: "hardware",
    productName: `Legacy product ${legacyRowId}`,
    unitLabel: unresolvedReason === "unknown_unit_basis" ? "unknown" : "sqm",
    priceAedMin:
      unresolvedReason === "incomplete_price_range" ? "100" : "100",
    priceAedMax:
      unresolvedReason === "incomplete_price_range" ? null : "200",
  } as const;
  return {
    legacyRowId,
    unresolvedReason,
    legacyRow,
    sourceRowFingerprint: createEv02rSourceRowFingerprint(legacyRow),
    currentProductLink: {
      productId: legacyRowId + 1_000,
      identityKey: `legacy:${legacyRowId}`,
    },
    legacyProvenance: {
      sourceLabel: "MIYAR legacy assumption",
      sourceUrl: null,
      provenancePolicyVersion: "legacy-v0",
    },
    usageImpact: {
      downstreamConsumers: ["report", "mqi", "rfq"],
      governedFinancialImpact:
        "Excluded from governed aggregation until explicitly resolved.",
      currentEligibility: "insufficient",
    },
    proposedResolution: null,
    decision: "needs_evidence",
    decisionReason: "No authoritative supplier or manufacturer evidence.",
  };
}

function makeInventory(): Ev02rInventoryRow[] {
  return EXPECTED_EV02R_UNRESOLVED_ROWS.map(row =>
    makeRow(row.legacyRowId, row.reason)
  );
}

function approve(row: Ev02rInventoryRow): Ev02rInventoryRow {
  const base = { ...row } as Record<string, unknown>;
  delete base.decisionReason;
  return {
    ...base,
    proposedResolution: {
      productIdentity: `product:${row.legacyRowId}`,
      specificationIdentity: `specification:${row.legacyRowId}`,
      unitBasis: "per_piece",
      priceScope: "supply_only",
      geography: "uae",
      effectiveDate: "2026-07-30",
    },
    decision: "approve",
    evidence: [
      {
        sourceType: "manufacturer",
        authoritativeUrl: `https://manufacturer.example/products/${row.legacyRowId}`,
        documentSha256: "a".repeat(64),
        capturedAt: "2026-07-30T10:00:00.000Z",
        effectiveDate: "2026-07-30",
      },
    ],
    approver: "Material Pricing Owner",
    approvalReference: `EV-02R-${row.legacyRowId}`,
    governedPriceRange:
      row.unresolvedReason === "incomplete_price_range"
        ? { currency: "AED" as const, min: "120", max: "240" }
        : { currency: "AED" as const, min: "100", max: "200" },
  } as Ev02rInventoryRow;
}

describe("EV-02R unresolved-remediation packet", () => {
  it("records exactly the approved 24 rejections and leaves 19 needs_evidence", () => {
    const built = applyEv02rRejectionApproval(makeInventory(), {
      approver: "Amro Saleh",
      approvalReference: "user-approved:2026-07-30:ev02r-24-rejections",
    });

    expect(EV02R_APPROVED_REJECTION_IDS).toHaveLength(24);
    expect(built.packet.summary).toMatchObject({
      approved: 0,
      rejected: 24,
      needsEvidence: 19,
    });
    expect(
      built.packet.inventory
        .filter(row => row.decision === "reject")
        .map(row => row.legacyRowId)
    ).toEqual([...EV02R_APPROVED_REJECTION_IDS]);
    expect(
      built.packet.inventory
        .filter(row => row.decision === "needs_evidence")
        .every(row => !("approver" in row) && row.proposedResolution === null)
    ).toBe(true);
    expect(
      built.packet.inventory.every(
        row =>
          !("governedPriceRange" in row) &&
          !("governedWrite" in row)
      )
    ).toBe(true);
  });

  it("fails closed when rejection approval identity is absent", () => {
    expect(() =>
      applyEv02rRejectionApproval(makeInventory(), {
        approver: "",
        approvalReference: "approval",
      })
    ).toThrow("approver");
    expect(() =>
      applyEv02rRejectionApproval(makeInventory(), {
        approver: "Amro Saleh",
        approvalReference: "",
      })
    ).toThrow("approval reference");
  });

  it("freezes the exact 43-row inventory and 37/6 reason split", () => {
    expect(EXPECTED_EV02R_UNRESOLVED_ROWS).toHaveLength(43);
    expect(
      EXPECTED_EV02R_UNRESOLVED_ROWS.filter(
        row => row.reason === "unknown_unit_basis"
      )
    ).toHaveLength(37);
    expect(
      EXPECTED_EV02R_UNRESOLVED_ROWS.filter(
        row => row.reason === "incomplete_price_range"
      )
    ).toHaveLength(6);
    expect(() => assertEv02rInventory(makeInventory())).not.toThrow();
  });

  it("emits stable canonical JSON and a matching SHA-256 digest", () => {
    const first = buildEv02rDecisionPacket(makeInventory());
    const second = buildEv02rDecisionPacket(makeInventory().reverse());

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).toBe(
      createHash("sha256").update(first.canonicalJson, "utf8").digest("hex")
    );
    expect(JSON.parse(first.canonicalJson)).toEqual(first.packet);
    expect(canonicalizeEv02rJson({ z: 1, a: { d: 2, b: 1 } })).toBe(
      '{"a":{"b":1,"d":2},"z":1}'
    );
  });

  it("fails closed on missing, extra, duplicate, and reason-drifted IDs", () => {
    const inventory = makeInventory();
    expect(() => assertEv02rInventory(inventory.slice(1))).toThrow(
      "exactly 43"
    );
    expect(() =>
      assertEv02rInventory([
        ...inventory.slice(0, -1),
        makeRow(999, "unknown_unit_basis"),
      ])
    ).toThrow("unexpected row");
    expect(() =>
      assertEv02rInventory([...inventory.slice(0, -1), inventory[0]])
    ).toThrow("duplicate");
    expect(() =>
      assertEv02rInventory([
        {
          ...inventory[0],
          unresolvedReason: "incomplete_price_range",
        },
        ...inventory.slice(1),
      ])
    ).toThrow("unexpected row");
  });

  it("fails closed when the source row or its identity drifts", () => {
    const inventory = makeInventory();
    const changed = {
      ...inventory[0],
      legacyRow: { ...inventory[0].legacyRow, productName: "Changed" },
    };
    expect(() =>
      assertEv02rInventory([changed, ...inventory.slice(1)])
    ).toThrow("fingerprint mismatch");

    const mismatchedId = {
      ...inventory[0],
      legacyRow: { ...inventory[0].legacyRow, id: 999 },
    };
    mismatchedId.sourceRowFingerprint = createEv02rSourceRowFingerprint(
      mismatchedId.legacyRow
    );
    expect(() =>
      assertEv02rInventory([mismatchedId, ...inventory.slice(1)])
    ).toThrow("identity mismatch");
  });

  it("accepts complete authoritative approvals and counts decisions", () => {
    const inventory = makeInventory();
    inventory[0] = approve(inventory[0]);
    const incompleteIndex = inventory.findIndex(
      row => row.unresolvedReason === "incomplete_price_range"
    );
    inventory[incompleteIndex] = approve(inventory[incompleteIndex]);
    inventory[1] = {
      ...inventory[1],
      decision: "reject",
      decisionReason: "Legacy product identity cannot be substantiated.",
      approver: "Material Pricing Owner",
      approvalReference: "EV-02R-REJECT-37",
    };

    const built = buildEv02rDecisionPacket(inventory);
    expect(built.packet.summary).toMatchObject({
      approved: 2,
      rejected: 1,
      needsEvidence: 40,
    });
  });

  it("rejects approval without an explicit resolution, evidence, or approval", () => {
    const inventory = makeInventory();
    const approved = approve(inventory[0]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    for (const mutation of [
      { ...approved, proposedResolution: null },
      { ...approved, evidence: [] },
      { ...approved, approver: " " },
      { ...approved, approvalReference: "" },
    ]) {
      expect(() =>
        buildEv02rDecisionPacket([mutation, ...inventory.slice(1)])
      ).toThrow();
    }
  });

  it("rejects non-authoritative, insecure, undigested, or undated evidence", () => {
    const inventory = makeInventory();
    const approved = approve(inventory[0]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    const evidence = approved.evidence[0];
    for (const hostileEvidence of [
      { ...evidence, sourceType: "marketplace" },
      { ...evidence, authoritativeUrl: "http://manufacturer.example/item" },
      { ...evidence, documentSha256: "not-a-digest" },
      { ...evidence, capturedAt: "yesterday" },
      { ...evidence, capturedAt: "2026-02-31" },
      { ...evidence, effectiveDate: "2026-13-99" },
    ]) {
      expect(() =>
        buildEv02rDecisionPacket([
          { ...approved, evidence: [hostileEvidence] } as Ev02rInventoryRow,
          ...inventory.slice(1),
        ])
      ).toThrow();
    }
  });

  it("accepts an official statistic as authoritative governed evidence", () => {
    const inventory = makeInventory();
    const approved = approve(inventory[0]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    approved.evidence = [
      {
        ...approved.evidence[0],
        sourceType: "official_statistic",
        authoritativeUrl: "https://data.example.gov/statistics/materials",
      },
    ];
    expect(() =>
      buildEv02rDecisionPacket([approved, ...inventory.slice(1)])
    ).not.toThrow();
  });

  it("requires explicit product, specification, unit, scope, geography, and effective date", () => {
    const inventory = makeInventory();
    const approved = approve(inventory[0]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    for (const patch of [
      { productIdentity: "" },
      { specificationIdentity: "" },
      { unitBasis: "" },
      { unitBasis: "per_guess" },
      { priceScope: "" },
      { priceScope: "unknown_scope" },
      { geography: "" },
      { geography: "worldwide" },
      { effectiveDate: "" },
      { effectiveDate: "2026-02-31" },
    ]) {
      expect(() =>
        buildEv02rDecisionPacket([
          {
            ...approved,
            proposedResolution: {
              ...approved.proposedResolution!,
              ...patch,
            },
          } as Ev02rInventoryRow,
          ...inventory.slice(1),
        ])
      ).toThrow();
    }
  });

  it("never repairs an incomplete range without two new AED bounds", () => {
    const inventory = makeInventory();
    const index = inventory.findIndex(
      row => row.unresolvedReason === "incomplete_price_range"
    );
    const approved = approve(inventory[index]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    const rest = inventory.filter((_, rowIndex) => rowIndex !== index);

    expect(() =>
      buildEv02rDecisionPacket([
        { ...approved, governedPriceRange: undefined },
        ...rest,
      ])
    ).toThrow("complete governed range");
    expect(() =>
      buildEv02rDecisionPacket([
        {
          ...approved,
          governedPriceRange: { currency: "USD", min: "120", max: "240" },
        } as Ev02rInventoryRow,
        ...rest,
      ])
    ).toThrow("currency must be AED");
    expect(() =>
      buildEv02rDecisionPacket([
        {
          ...approved,
          governedPriceRange: { currency: "AED", min: "300", max: "200" },
        },
        ...rest,
      ])
    ).toThrow("minimum exceeds");
  });

  it("requires a complete governed AED range for unknown-unit approvals", () => {
    const inventory = makeInventory();
    const approved = approve(inventory[0]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    expect(() =>
      buildEv02rDecisionPacket([
        { ...approved, governedPriceRange: undefined } as unknown as Ev02rInventoryRow,
        ...inventory.slice(1),
      ])
    ).toThrow("complete governed range");
  });

  it("rejects copied legacy bounds instead of inferring the missing bound", () => {
    const inventory = makeInventory();
    const index = inventory.findIndex(
      row => row.unresolvedReason === "incomplete_price_range"
    );
    const approved = approve(inventory[index]) as Extract<
      Ev02rInventoryRow,
      { decision: "approve" }
    >;
    expect(() =>
      buildEv02rDecisionPacket([
        {
          ...approved,
          governedPriceRange: { currency: "AED", min: "80", max: "100" },
        },
        ...inventory.filter((_, rowIndex) => rowIndex !== index),
      ])
    ).toThrow();
  });

  it("forbids governed writes or approvals on reject/needs_evidence decisions", () => {
    const inventory = makeInventory();
    for (const decision of ["reject", "needs_evidence"] as const) {
      const hostile = {
        ...inventory[0],
        decision,
        decisionReason: "Not approved.",
        governedPriceRange: { currency: "AED", min: "1", max: "2" },
        approver: "Someone",
        approvalReference: "fake",
      } as unknown as Ev02rInventoryRow;
      expect(() =>
        buildEv02rDecisionPacket([hostile, ...inventory.slice(1)])
      ).toThrow("must not carry");
    }
  });

  it("rejects a human rejection without reviewer identity and reference", () => {
    const inventory = makeInventory();
    const rejected = {
      ...inventory[0],
      decision: "reject",
      decisionReason: "This is not a material price.",
      approver: "",
      approvalReference: "",
    } as Ev02rInventoryRow;
    expect(() =>
      buildEv02rDecisionPacket([rejected, ...inventory.slice(1)])
    ).toThrow("rejecting approver");
  });

  it("rejects non-finite canonical JSON numbers", () => {
    expect(() => canonicalizeEv02rJson({ value: Number.NaN })).toThrow(
      "non-finite"
    );
  });
});
