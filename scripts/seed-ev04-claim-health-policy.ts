import { initializeDatabaseSafety } from "../server/_core/database-safety";
import { ensureApprovedClaimHealthPolicySeed } from "../server/db/claim-health";

initializeDatabaseSafety("seed", { loadDotenv: true });

try {
  const policy = await ensureApprovedClaimHealthPolicySeed();
  console.log(
    `[ev04-policy-seed] PASS version=${policy.version} digest=${policy.policyDigest}`
  );
  // server/db.ts intentionally retains its shared pool for application
  // runtimes. This one-shot command must terminate so guarded runners cannot
  // wait on that retained pool.
  process.exit(0);
} catch {
  console.error("[ev04-policy-seed] FAIL");
  process.exit(1);
}
