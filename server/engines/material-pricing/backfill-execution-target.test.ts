import { describe, expect, it } from "vitest";

import { inspectDatabaseTarget } from "../../_core/database-safety";
import {
  EV02_MIGRATION_SHA256,
  EV02_PRODUCTION_DATABASE_TARGET,
  EV02_PRODUCTION_TARGET,
  normalizeEv02ConnectionUrlForInspection,
  resolveEv02BackfillExecutionTarget,
} from "./backfill-execution-target";

const productionInput = {
  connectionTarget: inspectDatabaseTarget(
    "mysql://root@127.0.0.1:3317/miyar-v2"
  ),
  productionTarget: EV02_PRODUCTION_TARGET,
  expectedMigrationSha256: EV02_MIGRATION_SHA256,
  approvalRef: "user-approved:2026-07-28:ev02-0061-backfill",
  databaseApproval: `migrate@${EV02_PRODUCTION_DATABASE_TARGET}`,
  wrapperAttestation: "a".repeat(64),
  environmentAttestation: "a".repeat(64),
};

describe("EV-02 backfill execution target", () => {
  it("normalizes PlanetScale's mysql2 proxy URL only for safety inspection", () => {
    expect(
      normalizeEv02ConnectionUrlForInspection(
        "mysql2://root@127.0.0.1:3306/miyar-v2"
      )
    ).toBe("mysql://root@127.0.0.1:3306/miyar-v2");
    expect(
      normalizeEv02ConnectionUrlForInspection(
        "mysql://root@127.0.0.1:3306/miyar-v2"
      )
    ).toBe("mysql://root@127.0.0.1:3306/miyar-v2");
  });

  it("retains the disposable-loopback default", () => {
    expect(
      resolveEv02BackfillExecutionTarget({
        connectionTarget: inspectDatabaseTarget(
          "mysql://root@127.0.0.1:3317/miyar_auth_test_ev02"
        ),
      })
    ).toMatchObject({
      production: false,
      manifestTarget: "127.0.0.1:3317/miyar_auth_test_ev02",
    });
  });

  it("accepts only the exact approved PlanetScale proxy binding", () => {
    expect(resolveEv02BackfillExecutionTarget(productionInput)).toEqual({
      production: true,
      manifestTarget: EV02_PRODUCTION_DATABASE_TARGET,
      safetyDatabaseUrl: `mysql://${EV02_PRODUCTION_DATABASE_TARGET}`,
      databaseApproval: `migrate@${EV02_PRODUCTION_DATABASE_TARGET}`,
    });
  });

  it.each([
    [
      "wrong logical target",
      { productionTarget: "amr-saleh-hotmail/miyar-v2/preview" },
    ],
    ["wrong migration", { expectedMigrationSha256: "0".repeat(64) }],
    ["missing approval reference", { approvalRef: undefined }],
    ["missing database approval", { databaseApproval: undefined }],
    ["missing wrapper attestation", { wrapperAttestation: undefined }],
    ["mismatched wrapper attestation", { wrapperAttestation: "b".repeat(64) }],
    [
      "direct remote connection",
      {
        connectionTarget: inspectDatabaseTarget(
          "mysql://user:secret@aws.connect.psdb.cloud:3306/miyar-v2"
        ),
      },
    ],
    [
      "wrong proxy database",
      {
        connectionTarget: inspectDatabaseTarget(
          "mysql://root@127.0.0.1:3317/another-db"
        ),
      },
    ],
  ])("refuses %s", (_label, override) => {
    expect(() =>
      resolveEv02BackfillExecutionTarget({
        ...productionInput,
        ...override,
      })
    ).toThrow();
  });
});
