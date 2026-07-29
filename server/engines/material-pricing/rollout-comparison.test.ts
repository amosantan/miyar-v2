import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { governedMaterialLibrarySnapshot } from "../../../tests/fixtures/material-price-snapshots";
import { inspectDatabaseTarget } from "../../_core/database-safety";
import { isGlobalGovernedCandidateScope } from "../../db/material-pricing";
import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
} from "./ev03-identity-backfill";
import {
  EV03_MAX_ROLLOUT_EVIDENCE_DECOMPRESSED_BYTES,
  assertEv03ComparisonConnectionTargetStable,
  assertMaterialPricingCompletionSummaryBindsEvidence,
  assertMaterialPricingEvidenceMatchesLiveEligibleSet,
  assertGovernedSnapshotsMatchApprovedEvidence,
  assertMaterialPricingComparisonEvidence,
  assertMaterialPricingRolloutGate,
  buildMaterialPricingComparisonEvidence,
  compareLegacyAndGovernedMaterialPrices,
  loadMaterialPricingRolloutGate,
  resolveEv03RolloutComparisonExecutionTarget,
  type LegacyPriceRange,
} from "./rollout-comparison";

const GENERATED_AT = new Date("2026-07-29T12:00:00.000Z");

function productionShapeEligibleRows(count = 242): LegacyPriceRange[] {
  return Array.from({ length: count }, (_, index) => {
    const min = 50 + index * 3;
    const max = min + 25 + (index % 11);
    return {
      reference: {
        source: "material_library" as const,
        legacyId: index + 1,
      },
      priceMin: min.toFixed(2),
      priceMax: max.toFixed(2),
    };
  });
}

function equalEvidence(count = 242) {
  const legacyRanges = productionShapeEligibleRows(count);
  return buildMaterialPricingComparisonEvidence({
    legacyRanges,
    snapshots: legacyRanges.map(range =>
      governedMaterialLibrarySnapshot({
        legacyId: range.reference.legacyId,
        priceMin: Number(range.priceMin),
        priceMax: Number(range.priceMax),
      })
    ),
    generatedAt: GENERATED_AT,
  });
}

describe("EV-03 legacy → compare → governed evidence", () => {
  it("uses an unbounded production-shape eligibility query in the disposable script", () => {
    const script = readFileSync(
      new URL("../../../scripts/ev03-rollout-comparison.ts", import.meta.url),
      "utf8"
    );
    expect(script).toContain("bp.legacyMaterialLibraryId=ml.id");
    expect(script).toContain("bp.productId=ml.product_id");
    expect(script).toContain("bp.sourceKind='assumption'");
    expect(script).toContain("bp.sourceLadderRung='assumption'");
    expect(script).toContain("bp.orgId is null");
    expect(script).toContain("bp.priceScope is null");
    expect(script).toContain("bp.keyPolicyVersion='ev02-backfill-v1'");
    expect(script).not.toMatch(/\blimit\s+\d+/i);
    expect(script).not.toMatch(/supplierName|quoteRef|contactRef/);
  });

  it("ships a separately provider-bound production comparison wrapper", () => {
    const wrapper = readFileSync(
      new URL(
        "../../../scripts/ev03-planetscale-rollout-comparison.ts",
        import.meta.url
      ),
      "utf8"
    );
    const inner = readFileSync(
      new URL("../../../scripts/ev03-rollout-comparison.ts", import.meta.url),
      "utf8"
    );
    expect(wrapper).toContain('const ORGANIZATION = "amr-saleh-hotmail"');
    expect(wrapper).toContain('const DATABASE = "miyar-v2"');
    expect(wrapper).toContain('const BRANCH = "main"');
    expect(wrapper).toContain('"auth", "check"');
    expect(wrapper).toContain('"deploy-request"');
    expect(wrapper).toContain('"connect"');
    expect(wrapper).toContain('"reader"');
    expect(wrapper).toContain(
      "databaseApproval !== `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`"
    );
    expect(wrapper).toContain("MIYAR_DATABASE_APPROVAL: databaseApproval");
    expect(wrapper).not.toContain(
      "MIYAR_DATABASE_APPROVAL: `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`"
    );
    expect(wrapper).toContain("randomBytes(32)");
    expect(wrapper).toContain("OPERATION_TIMEOUT_MS");
    expect(wrapper).not.toContain("result.stderr");
    expect(wrapper).toContain('"--provider-attestation"');
    expect(inner).toContain('"--provider-attestation"');
    expect(wrapper).toContain(
      "assertMaterialPricingCompletionSummaryBindsEvidence("
    );
    expect(inner).toContain('flag: "wx", mode: 0o600');
    expect(inner).toContain("assertEv03MigrationSchema(connection)");
    expect(inner).toContain(
      "createGlobalMaterialResolutionEvidenceDataSource(evidenceDatabase)"
    );
    expect(inner).toContain(
      "assertMaterialPricingComparisonEvidence(evidence)"
    );
    const normalizedEnvironmentIndex = inner.indexOf(
      "process.env.DATABASE_URL = inspectionDatabaseUrl"
    );
    const safetyInitializationIndex = inner.indexOf(
      'initializeDatabaseSafety("migrate"'
    );
    expect(normalizedEnvironmentIndex).toBeGreaterThanOrEqual(0);
    expect(safetyInitializationIndex).toBeGreaterThanOrEqual(0);
    expect(normalizedEnvironmentIndex).toBeLessThan(safetyInitializationIndex);
    expect(inner).toContain("bindCurrentComparisonDatabaseTarget()");
    expect(inner).toContain('assertDatabaseAccess("migrate")');
    expect(inner).toContain("uri: databaseUrl!");
    expect(
      inner.indexOf("assertMaterialPricingComparisonEvidence(evidence)")
    ).toBeLessThan(inner.indexOf("writeFileSync(outputPath"));
    expect(wrapper).toContain("linkSync(stagingPath, outputPath)");
    expect(wrapper).toContain("unlinkSync(stagingPath)");
  });

  it("normalizes only the provider scheme and rejects exact tunnel drift", () => {
    const initial = "mysql2://runner:secret@127.0.0.1:3317/miyar-v2?ssl=false";
    expect(
      assertEv03ComparisonConnectionTargetStable({
        initialDatabaseUrl: initial,
        currentDatabaseUrl:
          "mysql://runner:secret@127.0.0.1:3317/miyar-v2?ssl=false",
      })
    ).toBe("mysql://runner:secret@127.0.0.1:3317/miyar-v2?ssl=false");

    for (const currentDatabaseUrl of [
      "mysql://runner:secret@127.0.0.1:3318/miyar-v2?ssl=false",
      "mysql://runner:secret@127.0.0.2:3317/miyar-v2?ssl=false",
      "mysql://other:secret@127.0.0.1:3317/miyar-v2?ssl=false",
      "mysql://runner:changed@127.0.0.1:3317/miyar-v2?ssl=false",
      "mysql://runner:secret@127.0.0.1:3317/other_database?ssl=false",
      "mysql://runner:secret@127.0.0.1:3317/miyar-v2?ssl=true",
      "mysql://runner:secret@127.0.0.1:3317/miyar-v2",
      "mysql://runner:secret@127.0.0.1:3317/miyar-v2?ssl=false&mode=reader",
      "mysql://runner:secret@127.0.0.1:3317/miyar-v2?mode=reader&ssl=false",
      undefined,
    ]) {
      expect(() =>
        assertEv03ComparisonConnectionTargetStable({
          initialDatabaseUrl: initial,
          currentDatabaseUrl,
        })
      ).toThrow("target changed after bootstrap");
    }
  });

  it("removes staged evidence when the provider child exits unsuccessfully", () => {
    const root = mkdtempSync(join(tmpdir(), "miyar-ev03-wrapper-failure-"));
    const bin = join(root, "bin");
    const outputDirectory = join(root, "evidence");
    const outputPath = join(outputDirectory, "comparison.json");
    try {
      const mkdir = spawnSync("mkdir", ["-m", "700", bin, outputDirectory]);
      expect(mkdir.status).toBe(0);
      const pscale = join(bin, "pscale");
      writeFileSync(
        pscale,
        `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "auth") {
  process.stdout.write(JSON.stringify({ authenticated: true, organization: "amr-saleh-hotmail" }));
  process.exit(0);
}
if (args[0] === "deploy-request") {
  process.stdout.write(JSON.stringify({
    into_branch: "main",
    deployment_state: "complete",
    notes: "${EV03_MIGRATION_SHA256}"
  }));
  process.exit(0);
}
if (args[0] === "connect") {
  const command = args[args.indexOf("--execute") + 1] ?? "";
  const match = command.match(/--output ([^ ]+)/);
  if (match) writeFileSync(match[1], "{}", { mode: 0o600 });
  process.exit(9);
}
process.exit(2);
`,
        { mode: 0o700 }
      );
      chmodSync(pscale, 0o700);

      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/ev03-planetscale-rollout-comparison.ts",
          "--deploy-requests",
          "16",
          "--output",
          outputPath,
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          timeout: 30_000,
          env: {
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            HOME: process.env.HOME,
            MIYAR_DATABASE_APPROVAL: `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`,
          },
        }
      );

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        "[ev03-rollout-comparison] PASS"
      );
      expect(existsSync(outputPath)).toBe(false);
      expect(readdirSync(outputDirectory)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires the exact provider-owned comparison tunnel", () => {
    const providerAttestation = "a".repeat(64);
    const approved = {
      connectionTarget: inspectDatabaseTarget(
        "mysql://root@127.0.0.1:3317/miyar-v2"
      ),
      productionTarget: EV03_PRODUCTION_TARGET,
      expectedMigrationSha256: EV03_MIGRATION_SHA256,
      providerAttestation,
      environmentAttestation: providerAttestation,
      databaseApproval: `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`,
    };
    expect(resolveEv03RolloutComparisonExecutionTarget(approved)).toEqual({
      production: true,
      evidenceTarget: EV03_PRODUCTION_DATABASE_TARGET,
      safetyDatabaseUrl: `mysql://${EV03_PRODUCTION_DATABASE_TARGET}`,
      databaseApproval: `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`,
    });
    expect(() =>
      resolveEv03RolloutComparisonExecutionTarget({
        ...approved,
        providerAttestation: undefined,
      })
    ).toThrow("governed PlanetScale wrapper");
    expect(() =>
      resolveEv03RolloutComparisonExecutionTarget({
        ...approved,
        providerAttestation: "b".repeat(64),
      })
    ).toThrow("governed PlanetScale wrapper");
    expect(() =>
      resolveEv03RolloutComparisonExecutionTarget({
        ...approved,
        connectionTarget: inspectDatabaseTarget(
          `mysql://runner:secret@${EV03_PRODUCTION_DATABASE_TARGET}`
        ),
      })
    ).toThrow("wrapper-owned loopback");
    expect(() =>
      resolveEv03RolloutComparisonExecutionTarget({
        ...approved,
        productionTarget: "amr-saleh-hotmail/miyar-v2/preview",
      })
    ).toThrow("must be exactly");
    expect(() =>
      resolveEv03RolloutComparisonExecutionTarget({
        ...approved,
        databaseApproval: undefined,
      })
    ).toThrow("REMOTE_APPROVAL_REQUIRED");
  });

  it("preserves the disposable-loopback comparison default", () => {
    expect(
      resolveEv03RolloutComparisonExecutionTarget({
        connectionTarget: inspectDatabaseTarget(
          "mysql://root@127.0.0.1:3317/miyar_test_ev03_comparison"
        ),
      })
    ).toEqual({
      production: false,
      evidenceTarget: "127.0.0.1:3317/miyar_test_ev03_comparison",
      safetyDatabaseUrl: "mysql://127.0.0.1:3317/miyar_test_ev03_comparison",
    });
  });

  it("keeps production comparison candidates global-only", () => {
    const global = {
      orgId: null,
      supplierQuoteId: null,
      sourceLadderRung: "assumption" as const,
      productId: 10,
      joinedProductId: 10,
      productOrgId: null,
    };
    expect(isGlobalGovernedCandidateScope(global)).toBe(true);
    expect(isGlobalGovernedCandidateScope({ ...global, orgId: 0 })).toBe(false);
    expect(
      isGlobalGovernedCandidateScope({
        ...global,
        sourceLadderRung: "supplier_quote",
        supplierQuoteId: 99,
      })
    ).toBe(false);
    expect(isGlobalGovernedCandidateScope({ ...global, productOrgId: 0 })).toBe(
      false
    );
    expect(
      isGlobalGovernedCandidateScope({ ...global, joinedProductId: null })
    ).toBe(false);

    const dbSource = readFileSync(
      new URL("../../db/material-pricing.ts", import.meta.url),
      "utf8"
    );
    const resolutionSource = readFileSync(
      new URL("./material-resolution.ts", import.meta.url),
      "utf8"
    );
    expect(dbSource).toContain("listGlobalMaterialResolutionIdentities");
    expect(dbSource).toContain(
      "listGlobalGovernedValueCandidatesForSpecifications"
    );
    expect(dbSource).toContain("isNull(benchmarkProposals.orgId)");
    expect(dbSource).toContain("isNull(benchmarkProposals.supplierQuoteId)");
    expect(dbSource).toContain("isNull(products.orgId)");
    expect(resolutionSource).toContain(
      "evidenceDataSource?: GlobalMaterialResolutionEvidenceDataSource"
    );
    expect(resolutionSource).toContain(
      "globalOnly: true,\n    evidenceDataSource,"
    );
  });

  it("covers the complete production-shape eligible set, not representative rows", () => {
    const evidence = equalEvidence();

    expect(evidence).toMatchObject({
      eligibleRowCount: 242,
      comparisonRowCount: 242,
      equalRowCount: 242,
      differentRowCount: 0,
      insufficientRowCount: 0,
    });
    expect(evidence.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.eligibleSetDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.comparisonsDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      assertMaterialPricingComparisonEvidence(evidence)
    ).not.toThrow();
    expect(() =>
      assertMaterialPricingCompletionSummaryBindsEvidence(
        {
          target: EV03_PRODUCTION_DATABASE_TARGET,
          eligibleRowCount: evidence.eligibleRowCount,
          equalRowCount: evidence.equalRowCount,
          differentRowCount: evidence.differentRowCount,
          insufficientRowCount: evidence.insufficientRowCount,
          evidenceDigest: evidence.evidenceDigest,
        },
        evidence
      )
    ).not.toThrow();
    expect(() =>
      assertMaterialPricingCompletionSummaryBindsEvidence(
        {
          target: EV03_PRODUCTION_DATABASE_TARGET,
          eligibleRowCount: evidence.eligibleRowCount,
          equalRowCount: evidence.equalRowCount,
          differentRowCount: evidence.differentRowCount,
          insufficientRowCount: evidence.insufficientRowCount,
          evidenceDigest: "0".repeat(64),
        },
        evidence
      )
    ).toThrow("does not bind");
    expect(JSON.stringify(evidence)).not.toMatch(
      /"(?:organizationId|orgId|supplierQuoteId|quoteRef|contactRef|sourceLabel|supplierName|supplierContact|provenance|description)":/
    );
  });

  it("binds compare/governed evidence to the exact complete live eligible set", () => {
    const ranges = productionShapeEligibleRows(3);
    const evidence = equalEvidence(3);
    expect(() =>
      assertMaterialPricingEvidenceMatchesLiveEligibleSet(evidence, ranges)
    ).not.toThrow();
    expect(() =>
      assertMaterialPricingEvidenceMatchesLiveEligibleSet(evidence, [
        ...ranges,
        {
          reference: { source: "material_library", legacyId: 99 },
          priceMin: "1.00",
          priceMax: "2.00",
        },
      ])
    ).toThrow("complete live eligible set");
    expect(() =>
      assertMaterialPricingEvidenceMatchesLiveEligibleSet(evidence, [
        { ...ranges[0], priceMin: "999.00" },
        ranges[1],
        ranges[2],
      ])
    ).toThrow("complete live eligible set");
  });

  it("binds governed serving to the approved safe identity and value fingerprint", () => {
    const snapshot = governedMaterialLibrarySnapshot({
      legacyId: 1,
      priceMin: 50,
      priceMax: 75,
    });
    const evidence = buildMaterialPricingComparisonEvidence({
      legacyRanges: [
        {
          reference: snapshot.reference,
          priceMin: snapshot.priceMin,
          priceMax: snapshot.priceMax,
        },
      ],
      snapshots: [snapshot],
      generatedAt: GENERATED_AT,
    });
    expect(() =>
      assertGovernedSnapshotsMatchApprovedEvidence(evidence, [snapshot])
    ).not.toThrow();
    for (const changed of [
      { productId: snapshot.productId + 1 },
      { specificationId: snapshot.specificationId + 1 },
      { benchmarkProposalId: snapshot.benchmarkProposalId + 1 },
      { benchmarkVersionId: 999 },
      { resolvedPriceScope: "supply_and_install" as const },
      { unitBasis: "per_piece" as const },
      { resolvedGeography: "dubai" as const },
      { priceMid: "63.00" },
      {
        provenance: {
          ...snapshot.provenance,
          benchmarkVersion: "changed-version",
        },
      },
    ]) {
      expect(() =>
        assertGovernedSnapshotsMatchApprovedEvidence(evidence, [
          { ...snapshot, ...changed },
        ])
      ).toThrow("drifted from approved evidence");
    }
    expect(() =>
      assertGovernedSnapshotsMatchApprovedEvidence(evidence, [
        {
          ...snapshot,
          requestedPriceScope: "supply_and_install",
          resolvedPriceScope: "supply_and_install",
          benchmarkProposalId: snapshot.benchmarkProposalId + 100,
        },
      ])
    ).not.toThrow();
  });

  it("records every missing or different eligible row and blocks governed mode", () => {
    const ranges = productionShapeEligibleRows(3);
    const evidence = buildMaterialPricingComparisonEvidence({
      legacyRanges: ranges,
      snapshots: [
        governedMaterialLibrarySnapshot({
          legacyId: 1,
          priceMin: Number(ranges[0].priceMin) + 1,
          priceMax: Number(ranges[0].priceMax),
        }),
        governedMaterialLibrarySnapshot({
          legacyId: 2,
          priceMin: Number(ranges[1].priceMin),
          priceMax: Number(ranges[1].priceMax),
        }),
      ],
      generatedAt: GENERATED_AT,
    });

    expect(evidence).toMatchObject({
      eligibleRowCount: 3,
      comparisonRowCount: 3,
      equalRowCount: 1,
      differentRowCount: 1,
      insufficientRowCount: 1,
    });
    expect(
      assertMaterialPricingRolloutGate({ mode: "compare", evidence })
    ).toBe("compare");
    expect(() =>
      assertMaterialPricingRolloutGate({
        mode: "governed",
        evidence,
        cutoverApproval: {
          reference: "user-approved:2026-07-29:ev03-governed-cutover",
          approvedEvidenceDigest: evidence.evidenceDigest,
        },
      })
    ).toThrow("equality failed");
  });

  it("requires exact-set snapshots and unique eligible identities", () => {
    const ranges = productionShapeEligibleRows(2);
    expect(() =>
      compareLegacyAndGovernedMaterialPrices({
        legacyRanges: ranges,
        snapshots: [
          governedMaterialLibrarySnapshot({
            legacyId: 3,
            priceMin: 1,
            priceMax: 2,
          }),
        ],
      })
    ).toThrow("ineligible");
    expect(() =>
      compareLegacyAndGovernedMaterialPrices({
        legacyRanges: [ranges[0], ranges[0]],
        snapshots: [],
      })
    ).toThrow("duplicate");
  });

  it("detects summary, content, confidential-field, and SHA-256 tampering", () => {
    const evidence = equalEvidence(2);
    expect(() =>
      assertMaterialPricingComparisonEvidence({
        ...evidence,
        equalRowCount: 1,
      })
    ).toThrow("summary counts");
    expect(() =>
      assertMaterialPricingComparisonEvidence({
        ...evidence,
        comparisons: [
          {
            ...evidence.comparisons[0],
            legacy: {
              ...evidence.comparisons[0].legacy,
              min: "999.00",
            },
          },
          evidence.comparisons[1],
        ],
      })
    ).toThrow("content digest");
    expect(() =>
      assertMaterialPricingComparisonEvidence({
        ...evidence,
        evidenceDigest: "0".repeat(64),
      })
    ).toThrow("SHA-256");
    expect(() =>
      assertMaterialPricingComparisonEvidence({
        ...evidence,
        comparisons: evidence.comparisons.map((row, index) =>
          index === 0
            ? ({ ...row, supplierName: "Confidential" } as typeof row)
            : row
        ),
      })
    ).toThrow("Confidential field");
  });

  it("defaults to legacy and requires approval bound to the exact evidence digest", () => {
    const evidence = equalEvidence(2);
    expect(assertMaterialPricingRolloutGate(undefined)).toBe("legacy");
    expect(
      assertMaterialPricingRolloutGate({ mode: "compare", evidence })
    ).toBe("compare");
    expect(() =>
      assertMaterialPricingRolloutGate({
        mode: "governed",
        evidence,
        cutoverApproval: {
          reference: "ticket-123",
          approvedEvidenceDigest: evidence.evidenceDigest,
        },
      })
    ).toThrow("explicit EV-03 cutover approval");
    expect(() =>
      assertMaterialPricingRolloutGate({
        mode: "governed",
        evidence,
        cutoverApproval: {
          reference: "user-approved:2026-07-29:ev03-governed-cutover",
          approvedEvidenceDigest: "0".repeat(64),
        },
      })
    ).toThrow("does not bind");
    expect(
      assertMaterialPricingRolloutGate({
        mode: "governed",
        evidence,
        cutoverApproval: {
          reference: "user-approved:2026-07-29:ev03-governed-cutover",
          approvedEvidenceDigest: evidence.evidenceDigest,
        },
      })
    ).toBe("governed");
  });

  it("loads the server-owned runtime mode and fails closed on incomplete configuration", () => {
    const evidence = equalEvidence(2);
    expect(loadMaterialPricingRolloutGate({})).toEqual({ mode: "legacy" });
    expect(() =>
      loadMaterialPricingRolloutGate({
        MIYAR_EV03_PRICING_MODE: "compare",
      })
    ).toThrow("exactly one rollout evidence source");
    expect(
      loadMaterialPricingRolloutGate({
        MIYAR_EV03_PRICING_MODE: "compare",
        MIYAR_EV03_ROLLOUT_EVIDENCE_JSON: JSON.stringify(evidence),
      })
    ).toEqual({ mode: "compare", evidence });
    const governed = loadMaterialPricingRolloutGate({
      MIYAR_EV03_PRICING_MODE: "governed",
      MIYAR_EV03_ROLLOUT_EVIDENCE_JSON: JSON.stringify(evidence),
      MIYAR_EV03_GOVERNED_CUTOVER_APPROVAL_REF:
        "user-approved:2026-07-29:ev03-governed-cutover",
      MIYAR_EV03_GOVERNED_EVIDENCE_SHA256: evidence.evidenceDigest,
    });
    expect(assertMaterialPricingRolloutGate(governed)).toBe("governed");
  });

  it("loads bounded gzip+base64 evidence as one exclusive server-owned source", () => {
    const evidence = equalEvidence(2);
    const compressed = gzipSync(JSON.stringify(evidence)).toString("base64");
    expect(
      loadMaterialPricingRolloutGate({
        MIYAR_EV03_PRICING_MODE: "compare",
        MIYAR_EV03_ROLLOUT_EVIDENCE_GZIP_BASE64: compressed,
      })
    ).toEqual({ mode: "compare", evidence });
    expect(() =>
      loadMaterialPricingRolloutGate({
        MIYAR_EV03_PRICING_MODE: "compare",
        MIYAR_EV03_ROLLOUT_EVIDENCE_JSON: JSON.stringify(evidence),
        MIYAR_EV03_ROLLOUT_EVIDENCE_GZIP_BASE64: compressed,
      })
    ).toThrow("exactly one rollout evidence source");
    expect(() =>
      loadMaterialPricingRolloutGate({
        MIYAR_EV03_PRICING_MODE: "compare",
        MIYAR_EV03_ROLLOUT_EVIDENCE_GZIP_BASE64: "not base64",
      })
    ).toThrow("canonical bounded base64");
  });

  it("rejects compressed evidence that expands beyond the bounded limit", () => {
    const oversized = gzipSync(
      Buffer.alloc(EV03_MAX_ROLLOUT_EVIDENCE_DECOMPRESSED_BYTES + 1, 0x20)
    ).toString("base64");
    expect(() =>
      loadMaterialPricingRolloutGate({
        MIYAR_EV03_PRICING_MODE: "compare",
        MIYAR_EV03_ROLLOUT_EVIDENCE_GZIP_BASE64: oversized,
      })
    ).toThrow("decompressed size limit");
  });
});
