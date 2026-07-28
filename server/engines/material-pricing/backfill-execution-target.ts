import {
  evaluateDatabaseAccess,
  type DatabaseTarget,
} from "../../_core/database-safety";

export const EV02_PRODUCTION_TARGET =
  "amr-saleh-hotmail/miyar-v2/main" as const;
export const EV02_PRODUCTION_DATABASE_TARGET =
  "aws.connect.psdb.cloud:3306/miyar-v2" as const;
export const EV02_MIGRATION_SHA256 =
  "06ce9d537ed5593252234ed44271a5f50ff202b8f67adc3c20ab3fb1ba1691aa" as const;

type ExecutionTargetInput = {
  connectionTarget: DatabaseTarget;
  productionTarget?: string;
  expectedMigrationSha256?: string;
  approvalRef?: string;
  databaseApproval?: string;
  wrapperAttestation?: string;
  environmentAttestation?: string;
  rollback?: boolean;
  writeQuiesced?: boolean;
};

export type Ev02BackfillExecutionTarget = {
  production: boolean;
  manifestTarget: string;
  safetyDatabaseUrl: string;
  databaseApproval?: string;
};

export function normalizeEv02ConnectionUrlForInspection(
  databaseUrl: string | undefined
): string | undefined {
  if (!databaseUrl?.startsWith("mysql2://")) return databaseUrl;
  return `mysql://${databaseUrl.slice("mysql2://".length)}`;
}

function requireApprovalRef(value: string | undefined): string {
  if (
    !value ||
    !/^user-approved:\d{4}-\d{2}-\d{2}:ev02-0061-backfill$/.test(value)
  ) {
    throw new Error(
      "Production EV-02 requires --approval-ref user-approved:YYYY-MM-DD:ev02-0061-backfill"
    );
  }
  return value;
}

export function resolveEv02BackfillExecutionTarget(
  input: ExecutionTargetInput
): Ev02BackfillExecutionTarget {
  const target = input.connectionTarget;
  if (!input.productionTarget) {
    if (target.class !== "safe-loopback" || !target.canonical) {
      throw new Error(
        "EV-02 backfill accepts only a disposable loopback MySQL target"
      );
    }
    if (
      !target.database ||
      !/^(miyar_auth_test|miyar_test_)/.test(target.database)
    ) {
      throw new Error(
        "EV-02 backfill target must use a disposable miyar_auth_test* or miyar_test_* database"
      );
    }
    return {
      production: false,
      manifestTarget: target.canonical,
      safetyDatabaseUrl: `mysql://${target.canonical}`,
    };
  }

  if (input.productionTarget !== EV02_PRODUCTION_TARGET) {
    throw new Error(
      `Production EV-02 target must be exactly ${EV02_PRODUCTION_TARGET}`
    );
  }
  if (input.expectedMigrationSha256 !== EV02_MIGRATION_SHA256) {
    throw new Error("Production EV-02 migration digest mismatch");
  }
  requireApprovalRef(input.approvalRef);
  if (input.rollback && !input.writeQuiesced) {
    throw new Error(
      "Production EV-02 rollback requires an explicitly verified write-quiescent maintenance window"
    );
  }
  if (
    !input.wrapperAttestation ||
    !/^[a-f0-9]{64}$/.test(input.wrapperAttestation) ||
    input.wrapperAttestation !== input.environmentAttestation
  ) {
    throw new Error(
      "Production EV-02 must be launched by the governed PlanetScale wrapper"
    );
  }
  if (
    target.class !== "safe-loopback" ||
    target.database !== "miyar-v2" ||
    !target.canonical
  ) {
    throw new Error(
      "Production EV-02 must connect through the loopback PlanetScale proxy for miyar-v2"
    );
  }

  const safetyDatabaseUrl = `mysql://${EV02_PRODUCTION_DATABASE_TARGET}`;
  const decision = evaluateDatabaseAccess({
    operation: "migrate",
    databaseUrl: safetyDatabaseUrl,
    runtimeProfile: "local",
    nodeEnv: "production",
    approval: input.databaseApproval,
  });
  if (!decision.allowed || decision.reasonCode !== "REMOTE_APPROVAL_ALLOWED") {
    throw new Error(
      `Production EV-02 database approval rejected: ${decision.reasonCode}`
    );
  }

  return {
    production: true,
    manifestTarget: EV02_PRODUCTION_DATABASE_TARGET,
    safetyDatabaseUrl,
    databaseApproval: input.databaseApproval,
  };
}
