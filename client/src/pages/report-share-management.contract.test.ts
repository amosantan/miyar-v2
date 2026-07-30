import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reportsPage = readFileSync(
  new URL("./Reports.tsx", import.meta.url),
  "utf8"
);

describe("report share management UI", () => {
  it("reloads persisted safe share metadata for each administrator-visible report", () => {
    expect(reportsPage).toContain("trpc.reportShare.list.useQuery");
    expect(reportsPage).toContain("{ reportInstanceId }");
    expect(reportsPage).toContain("(shares.data ?? []).map");
    expect(reportsPage).toContain("handleRevoke(share.shareId)");
  });

  it("refreshes the active-share list after create and revoke", () => {
    const invalidations = reportsPage.match(
      /utils\.reportShare\.list\.invalidate\(\{ reportInstanceId \}\)/g
    );
    expect(invalidations).toHaveLength(2);
  });

  it("keeps the plaintext URL in component memory and labels it one-time-only", () => {
    expect(reportsPage).toContain("URL shown once only");
    expect(reportsPage).toContain(
      "the URL will not be shown again after you leave this page"
    );
    expect(reportsPage).not.toContain("localStorage");
    expect(reportsPage).not.toContain("sessionStorage");
    expect(reportsPage).not.toContain("tokenHash");
  });
});
