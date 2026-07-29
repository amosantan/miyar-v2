import { config as loadDotenvFile } from "dotenv";

export const RUNTIME_PROFILES = ["local", "test", "preview", "production"] as const;
export type RuntimeProfile = (typeof RUNTIME_PROFILES)[number];

export const DATABASE_OPERATIONS = [
  "serve",
  "unit-test",
  "integration-test",
  "seed",
  "reset",
  "migrate",
  "ingest",
] as const;
export type DatabaseOperation = (typeof DATABASE_OPERATIONS)[number];

export type DatabaseTargetClass =
  | "absent"
  | "safe-loopback"
  | "remote-shared"
  | "malformed";

export type DatabaseTarget = {
  class: DatabaseTargetClass;
  host?: string;
  port?: number;
  database?: string;
  canonical?: string;
  error?: string;
};

export type DatabaseReasonCode =
  | "DATABASE_DISABLED"
  | "DATABASE_TARGET_REQUIRED"
  | "SAFE_LOOPBACK_ALLOWED"
  | "UNIT_TEST_DATABASE_FORBIDDEN"
  | "INTEGRATION_TARGET_REQUIRED"
  | "INTEGRATION_TARGET_INVALID"
  | "LOCAL_DATABASE_NAME_INVALID"
  | "REMOTE_APPROVAL_REQUIRED"
  | "REMOTE_APPROVAL_INVALID"
  | "REMOTE_APPROVAL_MISMATCH"
  | "REMOTE_APPROVAL_ALLOWED"
  | "TRUSTED_PRODUCTION_TARGET"
  | "TRUSTED_PREVIEW_TARGET"
  | "PREVIEW_TARGET_BINDING_REQUIRED"
  | "PREVIEW_TARGET_BINDING_MISMATCH"
  | "RUNTIME_PROFILE_INVALID"
  | "RUNTIME_PROFILE_MISMATCH"
  | "DEPLOYMENT_IDENTITY_INVALID"
  | "DATABASE_URL_INVALID";

export type DatabaseDecision = {
  allowed: boolean;
  profile: RuntimeProfile;
  operation: DatabaseOperation;
  trustedDeployment: boolean;
  target: DatabaseTarget;
  reasonCode: DatabaseReasonCode;
};

export type DatabaseSafetyInput = {
  operation: DatabaseOperation;
  databaseUrl?: string;
  runtimeProfile?: string;
  nodeEnv?: string;
  vercel?: string;
  vercelEnv?: string;
  vercelUrl?: string;
  approval?: string;
  deploymentDatabaseTarget?: string;
  providerProxyDatabaseTarget?: string;
};

export type InitializeDatabaseSafetyOptions = Partial<Omit<DatabaseSafetyInput, "operation">> & {
  loadDotenv?: boolean;
  logDecision?: boolean;
};

type RuntimeContext = Omit<DatabaseSafetyInput, "operation"> & {
  activeOperation: DatabaseOperation;
};

const SAFETY_KEYS = [
  "MIYAR_RUNTIME_PROFILE",
  "MIYAR_DATABASE_APPROVAL",
  "MIYAR_DEPLOYMENT_DATABASE_TARGET",
  "NODE_ENV",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
] as const;

const spawnedSafetyEnvironment = Object.fromEntries(
  SAFETY_KEYS.map(key => [key, process.env[key]])
) as Record<(typeof SAFETY_KEYS)[number], string | undefined>;

let runtimeContext: RuntimeContext | null = null;
let decisions = new Map<DatabaseOperation, DatabaseDecision>();

export class DatabaseSafetyError extends Error {
  readonly decision: DatabaseDecision;

  constructor(decision: DatabaseDecision) {
    super(`Database access denied: ${decision.reasonCode}`);
    this.name = "DatabaseSafetyError";
    this.decision = decision;
  }
}

function isRuntimeProfile(value: string | undefined): value is RuntimeProfile {
  return RUNTIME_PROFILES.includes(value as RuntimeProfile);
}

function isDatabaseOperation(value: string): value is DatabaseOperation {
  return DATABASE_OPERATIONS.includes(value as DatabaseOperation);
}

function normalizeHost(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith("[") && lower.endsWith("]")
    ? lower.slice(1, -1)
    : lower;
}

function isLoopbackHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  const parts = host.split(".");
  return parts.length === 4 && parts.every(part => /^\d+$/.test(part)) && Number(parts[0]) === 127;
}

function isUnspecifiedHost(host: string): boolean {
  return host === "0.0.0.0" || host === "::" || host === "*";
}

function canonicalHost(host: string): string {
  return host.includes(":") ? `[${host}]` : host;
}

function parseDatabaseName(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname === "/") return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }
  if (!decoded || decoded.includes("/") || decoded.includes("\\")) return null;
  return /^[A-Za-z0-9_.-]+$/.test(decoded) ? decoded : null;
}

export function inspectDatabaseTarget(databaseUrl: string | undefined): DatabaseTarget {
  if (!databaseUrl?.trim()) return { class: "absent" };

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "mysql:") throw new Error("Only mysql URLs are accepted");
    if (parsed.hash) throw new Error("Fragments are not accepted");
    const host = normalizeHost(parsed.hostname);
    if (!host || isUnspecifiedHost(host)) throw new Error("Host is empty or unspecified");
    const port = parsed.port ? Number(parsed.port) : 3306;
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Port is invalid");
    const database = parseDatabaseName(parsed.pathname);
    if (!database) throw new Error("Database name is missing or ambiguous");
    const canonical = `${canonicalHost(host)}:${port}/${database}`;
    return {
      class: isLoopbackHost(host) ? "safe-loopback" : "remote-shared",
      host,
      port,
      database,
      canonical,
    };
  } catch (error) {
    return {
      class: "malformed",
      error: error instanceof Error ? error.message : "Invalid database URL",
    };
  }
}

function parseTargetBinding(value: string | undefined): string | null {
  if (!value || value.includes("@") || value.includes("?") || value.includes("#")) return null;
  const target = inspectDatabaseTarget(`mysql://${value}`);
  if (target.class !== "remote-shared") return null;
  return target.canonical ?? null;
}

function parseApproval(value: string | undefined): {
  operations: Set<DatabaseOperation>;
  target: string;
} | null {
  if (!value) return null;
  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@")) return null;
  const operationTokens = value.slice(0, separator).split("+");
  if (
    operationTokens.length === 0 ||
    operationTokens.some(token => !isDatabaseOperation(token)) ||
    new Set(operationTokens).size !== operationTokens.length
  ) return null;
  const operations = operationTokens as DatabaseOperation[];
  const expectedOrder = [...operations].sort(
    (a, b) => DATABASE_OPERATIONS.indexOf(a) - DATABASE_OPERATIONS.indexOf(b)
  );
  if (operations.some((operation, index) => operation !== expectedOrder[index])) return null;
  if (operations.includes("unit-test") || operations.includes("integration-test")) return null;
  const target = parseTargetBinding(value.slice(separator + 1));
  return target ? { operations: new Set(operations), target } : null;
}

function deploymentIdentity(input: DatabaseSafetyInput): {
  trusted: boolean;
  profile?: "preview" | "production";
  invalid: boolean;
} {
  const hasAnySignal = Boolean(input.vercel || input.vercelEnv || input.vercelUrl);
  const validEnvironment = input.vercelEnv === "preview" || input.vercelEnv === "production";
  const complete = input.vercel === "1" && validEnvironment && Boolean(input.vercelUrl?.trim());
  return {
    trusted: complete,
    profile: complete ? input.vercelEnv as "preview" | "production" : undefined,
    invalid: hasAnySignal && !complete,
  };
}

function resolveProfile(input: DatabaseSafetyInput): {
  profile: RuntimeProfile;
  trustedDeployment: boolean;
  error?: DatabaseReasonCode;
} {
  const deployment = deploymentIdentity(input);
  if (deployment.invalid) {
    return { profile: "local", trustedDeployment: false, error: "DEPLOYMENT_IDENTITY_INVALID" };
  }
  if (input.runtimeProfile !== undefined && !isRuntimeProfile(input.runtimeProfile)) {
    return { profile: "local", trustedDeployment: false, error: "RUNTIME_PROFILE_INVALID" };
  }
  if (input.nodeEnv === "test") {
    if (input.runtimeProfile && input.runtimeProfile !== "test") {
      return { profile: "test", trustedDeployment: false, error: "RUNTIME_PROFILE_MISMATCH" };
    }
    return { profile: "test", trustedDeployment: false };
  }
  if (deployment.trusted && deployment.profile) {
    if (input.runtimeProfile && input.runtimeProfile !== deployment.profile) {
      return {
        profile: deployment.profile,
        trustedDeployment: true,
        error: "RUNTIME_PROFILE_MISMATCH",
      };
    }
    return { profile: deployment.profile, trustedDeployment: true };
  }
  return {
    profile: isRuntimeProfile(input.runtimeProfile) ? input.runtimeProfile : "local",
    trustedDeployment: false,
  };
}

function decision(
  allowed: boolean,
  profile: RuntimeProfile,
  operation: DatabaseOperation,
  trustedDeployment: boolean,
  target: DatabaseTarget,
  reasonCode: DatabaseReasonCode
): DatabaseDecision {
  return { allowed, profile, operation, trustedDeployment, target, reasonCode };
}

export function evaluateDatabaseAccess(input: DatabaseSafetyInput): DatabaseDecision {
  const resolved = resolveProfile(input);
  const target = inspectDatabaseTarget(input.databaseUrl);
  if (resolved.error) {
    return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, resolved.error);
  }
  if (target.class === "malformed") {
    return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "DATABASE_URL_INVALID");
  }
  if (input.operation === "unit-test") {
    return target.class === "absent"
      ? decision(true, resolved.profile, input.operation, false, target, "DATABASE_DISABLED")
      : decision(false, resolved.profile, input.operation, false, target, "UNIT_TEST_DATABASE_FORBIDDEN");
  }
  if (input.operation === "integration-test") {
    if (target.class === "absent") {
      return decision(false, resolved.profile, input.operation, false, target, "INTEGRATION_TARGET_REQUIRED");
    }
    const safeName = target.database?.startsWith("miyar_test") || target.database?.startsWith("miyar_auth_test");
    return target.class === "safe-loopback" && safeName
      ? decision(true, "test", input.operation, false, target, "SAFE_LOOPBACK_ALLOWED")
      : decision(false, "test", input.operation, false, target, "INTEGRATION_TARGET_INVALID");
  }
  if (target.class === "absent") {
    return input.operation === "serve"
      ? decision(true, resolved.profile, input.operation, resolved.trustedDeployment, target, "DATABASE_DISABLED")
      : decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "DATABASE_TARGET_REQUIRED");
  }
  if (input.providerProxyDatabaseTarget !== undefined) {
    const proxyTarget = inspectDatabaseTarget(`mysql://${input.providerProxyDatabaseTarget}`);
    const approval = parseApproval(input.approval);
    if (
      input.operation !== "migrate" ||
      resolved.profile !== "local" ||
      target.class !== "safe-loopback" ||
      proxyTarget.class !== "remote-shared" ||
      !proxyTarget.canonical ||
      target.database !== proxyTarget.database
    ) {
      return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_INVALID");
    }
    if (!input.approval) {
      return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_REQUIRED");
    }
    if (!approval) {
      return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_INVALID");
    }
    if (approval.target !== proxyTarget.canonical) {
      return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_MISMATCH");
    }
    return approval.operations.has(input.operation)
      ? decision(true, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_ALLOWED")
      : decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_INVALID");
  }
  if (target.class === "safe-loopback") {
    const safeName = resolved.profile === "test"
      ? target.database?.startsWith("miyar_test") || target.database?.startsWith("miyar_auth_test")
      : target.database?.startsWith("miyar_local") || target.database?.startsWith("miyar_dev");
    return safeName
      ? decision(true, resolved.profile, input.operation, resolved.trustedDeployment, target, "SAFE_LOOPBACK_ALLOWED")
      : decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "LOCAL_DATABASE_NAME_INVALID");
  }

  if (
    resolved.profile === "production" &&
    resolved.trustedDeployment &&
    (input.operation === "serve" || input.operation === "ingest")
  ) {
    return decision(true, resolved.profile, input.operation, true, target, "TRUSTED_PRODUCTION_TARGET");
  }
  if (resolved.profile === "preview" && resolved.trustedDeployment) {
    const binding = parseTargetBinding(input.deploymentDatabaseTarget);
    if (!binding) {
      return decision(false, resolved.profile, input.operation, true, target, "PREVIEW_TARGET_BINDING_REQUIRED");
    }
    if (binding !== target.canonical) {
      return decision(false, resolved.profile, input.operation, true, target, "PREVIEW_TARGET_BINDING_MISMATCH");
    }
    if (input.operation === "serve") {
      return decision(true, resolved.profile, input.operation, true, target, "TRUSTED_PREVIEW_TARGET");
    }
  }

  const approval = parseApproval(input.approval);
  if (!input.approval) {
    return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_REQUIRED");
  }
  if (!approval) {
    return decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_INVALID");
  }
  return approval.operations.has(input.operation) && approval.target === target.canonical
    ? decision(true, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_ALLOWED")
    : decision(false, resolved.profile, input.operation, resolved.trustedDeployment, target, "REMOTE_APPROVAL_MISMATCH");
}

function restoreSpawnSafetyControls(): void {
  for (const key of SAFETY_KEYS) {
    const value = spawnedSafetyEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function buildRuntimeContext(
  operation: DatabaseOperation,
  options: InitializeDatabaseSafetyOptions
): RuntimeContext {
  if (options.loadDotenv !== false) loadDotenvFile({ override: false, quiet: true });
  restoreSpawnSafetyControls();
  const context: RuntimeContext = {
    activeOperation: operation,
    databaseUrl: options.databaseUrl ?? process.env.DATABASE_URL,
    runtimeProfile: options.runtimeProfile ?? spawnedSafetyEnvironment.MIYAR_RUNTIME_PROFILE,
    nodeEnv: options.nodeEnv ?? spawnedSafetyEnvironment.NODE_ENV,
    vercel: options.vercel ?? spawnedSafetyEnvironment.VERCEL,
    vercelEnv: options.vercelEnv ?? spawnedSafetyEnvironment.VERCEL_ENV,
    vercelUrl: options.vercelUrl ?? spawnedSafetyEnvironment.VERCEL_URL,
    approval: options.approval ?? spawnedSafetyEnvironment.MIYAR_DATABASE_APPROVAL,
    deploymentDatabaseTarget:
      options.deploymentDatabaseTarget ?? spawnedSafetyEnvironment.MIYAR_DEPLOYMENT_DATABASE_TARGET,
    providerProxyDatabaseTarget: options.providerProxyDatabaseTarget,
  };
  delete process.env.MIYAR_DATABASE_APPROVAL;
  return Object.freeze(context);
}

export function initializeDatabaseSafety(
  operation: DatabaseOperation,
  options: InitializeDatabaseSafetyOptions = {}
): DatabaseDecision {
  if (!runtimeContext) runtimeContext = buildRuntimeContext(operation, options);
  const result = evaluateDatabaseAccess({ ...runtimeContext, operation });
  decisions.set(operation, result);
  if (options.logDecision) logDatabaseDecision(result);
  if (!result.allowed) throw new DatabaseSafetyError(result);
  return result;
}

export function assertDatabaseAccess(operation?: DatabaseOperation): DatabaseDecision {
  const selectedOperation =
    operation ??
    runtimeContext?.activeOperation ??
    (spawnedSafetyEnvironment.NODE_ENV === "test" ? "unit-test" : "serve");
  if (!runtimeContext) return initializeDatabaseSafety(selectedOperation, { loadDotenv: false });
  // Re-read the connection target at the final use site. A library or test may
  // mutate process.env after bootstrap; an earlier decision must never
  // authorize a different target.
  const result = evaluateDatabaseAccess({
    ...runtimeContext,
    databaseUrl: process.env.DATABASE_URL,
    operation: selectedOperation,
  });
  decisions.set(selectedOperation, result);
  if (!result.allowed) throw new DatabaseSafetyError(result);
  return result;
}

export function getDatabaseDecision(operation?: DatabaseOperation): DatabaseDecision | undefined {
  return decisions.get(operation ?? runtimeContext?.activeOperation ?? "serve");
}

/** Passes only the already-validated, operation-scoped approval to a child DB command. */
export function databaseSafetyChildEnvironment(
  operation: DatabaseOperation
): NodeJS.ProcessEnv {
  const result = assertDatabaseAccess(operation);
  const environment = { ...process.env };
  const approval = runtimeContext?.approval;
  if (result.reasonCode === "REMOTE_APPROVAL_ALLOWED" && approval) {
    environment.MIYAR_DATABASE_APPROVAL = approval;
  } else {
    delete environment.MIYAR_DATABASE_APPROVAL;
  }
  return environment;
}

export function shouldStartBackgroundJobsForDecision(
  result: DatabaseDecision,
  explicitEnable: string | undefined
): boolean {
  if (!result.allowed || result.profile === "test" || result.target.class === "absent") return false;
  if (result.profile === "production" && result.trustedDeployment) return true;
  return explicitEnable === "true" && result.operation === "ingest";
}

export function formatDatabaseDecision(result: DatabaseDecision): Record<string, unknown> {
  return {
    profile: result.profile,
    operation: result.operation,
    targetClass: result.target.class,
    host: result.target.host,
    port: result.target.port,
    database: result.target.database,
    trustedDeployment: result.trustedDeployment,
    allowed: result.allowed,
    reasonCode: result.reasonCode,
  };
}

export function logDatabaseDecision(result: DatabaseDecision): void {
  console.info(`[database-safety] ${JSON.stringify(formatDatabaseDecision(result))}`);
}

export function resetDatabaseSafetyForTests(): void {
  runtimeContext = null;
  decisions = new Map();
}
