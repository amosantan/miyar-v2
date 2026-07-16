/** Background workers remain enabled in production, but local development must opt in. */
export function shouldStartBackgroundJobs(
  nodeEnv: string | undefined,
  explicitEnable: string | undefined
): boolean {
  return nodeEnv === "production" || explicitEnable === "true";
}

/** Cron endpoints fail closed when no shared secret is configured. */
export function isCronAuthorized(
  authorizationHeader: string | undefined,
  cronSecret: string | undefined
): boolean {
  return Boolean(cronSecret) && authorizationHeader === `Bearer ${cronSecret}`;
}
