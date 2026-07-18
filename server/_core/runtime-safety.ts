import {
  type DatabaseDecision,
  shouldStartBackgroundJobsForDecision,
} from "./database-safety";

/** Background jobs use the same trusted profile and database decision as connections. */
export function shouldStartBackgroundJobs(
  databaseDecision: DatabaseDecision,
  explicitEnable: string | undefined
): boolean {
  return shouldStartBackgroundJobsForDecision(databaseDecision, explicitEnable);
}

/** Cron endpoints fail closed when no shared secret is configured. */
export function isCronAuthorized(
  authorizationHeader: string | undefined,
  cronSecret: string | undefined
): boolean {
  return Boolean(cronSecret) && authorizationHeader === `Bearer ${cronSecret}`;
}
