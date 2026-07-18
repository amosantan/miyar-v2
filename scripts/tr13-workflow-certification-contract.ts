export const TR13_DATABASE_PREFIX = "miyar_test_tr13_";
export const TR13_PLAYWRIGHT_PORT = 34_313;

type Environment = NodeJS.ProcessEnv;

function has(environment: Environment, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(environment, key);
}

function isLoopback(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

export function assertTr13WorkflowEnvironment(
  environment: Environment = process.env
): string {
  if (has(environment, "DATABASE_URL")) {
    throw new Error(
      "Refusing DATABASE_URL; certify:workflow accepts TEST_DATABASE_URL only"
    );
  }
  for (const key of [
    "E2E_BASE_URL",
    "PLAYWRIGHT_BASE_URL",
    "PORT",
    "PLAYWRIGHT_WORKERS",
    "VITEST_MAX_WORKERS",
    "VITEST_MIN_WORKERS",
  ]) {
    if (has(environment, key))
      throw new Error(
        `Refusing ambient ${key}; the TR-13 harness owns its port and base URL`
      );
  }
  if (has(environment, "ENABLE_BACKGROUND_JOBS")) {
    throw new Error(
      "Refusing ambient ENABLE_BACKGROUND_JOBS; the TR-13 harness disables workers explicitly"
    );
  }
  if (has(environment, "JWT_SECRET")) {
    throw new Error(
      "Refusing ambient JWT_SECRET; the TR-13 harness owns its synthetic session secret"
    );
  }

  const value = environment.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required");
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid MySQL URL");
  }
  const database = decodeURIComponent(target.pathname.slice(1));
  if (target.protocol !== "mysql:" || !isLoopback(target.hostname)) {
    throw new Error("TEST_DATABASE_URL must target a loopback MySQL database");
  }
  if (!database.startsWith(TR13_DATABASE_PREFIX)) {
    throw new Error(
      `TEST_DATABASE_URL database must begin with ${TR13_DATABASE_PREFIX}`
    );
  }
  return value;
}

export function tr13ChildEnvironment(
  databaseUrl: string,
  environment: Environment = process.env
): Environment {
  const child = { ...environment };
  for (const key of [
    "TEST_DATABASE_URL",
    "E2E_BASE_URL",
    "PLAYWRIGHT_BASE_URL",
    "PORT",
    "ENABLE_BACKGROUND_JOBS",
    "MIYAR_DATABASE_APPROVAL",
    "JWT_SECRET",
    "MIYAR_DEPLOYMENT_DATABASE_TARGET",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
  ])
    delete child[key];
  return {
    ...child,
    DATABASE_URL: databaseUrl,
    DATABASE_SSL_DISABLED: "1",
    NODE_ENV: "test",
    MIYAR_RUNTIME_PROFILE: "test",
    ENABLE_BACKGROUND_JOBS: "false",
    JWT_SECRET: "tr13-synthetic-session-secret-0123456789",
  };
}
