import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { storagePut } from "../storage";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const originalBucket = process.env.AWS_S3_BUCKET;

afterEach(() => {
  if (originalBucket === undefined) delete process.env.AWS_S3_BUCKET;
  else process.env.AWS_S3_BUCKET = originalBucket;
});

describe("TR-10 stable report storage contract", () => {
  it("keeps migration 0050 additive, nullable, and free of legacy backfill writes", () => {
    const migration = source("../../drizzle/0050_tr10_report_storage_key.sql");
    expect(migration.trim()).toBe("ALTER TABLE `report_instances` ADD `storageKey` text;");
    expect(migration).not.toMatch(/NOT NULL|UPDATE|DELETE|DROP/i);

    const schema = source("../../drizzle/schema.ts");
    expect(schema).toContain('storageKey: text("storageKey")');
  });

  it("marks local data-URL fallback as non-persistent", async () => {
    delete process.env.AWS_S3_BUCKET;
    const result = await storagePut("reports/1/sample.html", "<p>safe</p>", "text/html");
    expect(result).toMatchObject({ key: "reports/1/sample.html", persistent: false });
    expect(result.url).toMatch(/^data:text\/html;base64,/);
  });

  it("keeps storage keys server-only and re-signs after project authorization", () => {
    const router = source("../routers/project.ts");
    const listStart = router.indexOf("listReports: orgProcedure");
    const listBlock = router.slice(listStart, router.indexOf("extractAreas:", listStart));
    expect(listBlock.indexOf("requireProjectForOrg")).toBeLessThan(listBlock.indexOf("storageGet"));
    expect(listBlock).toContain("const { storageKey, ...publicReport } = report");
    expect(listBlock).not.toMatch(/return\s+\{[^}]*storageKey/s);

    const generationStart = router.indexOf("generateReport: orgHeavyMutationProcedure");
    const generationBlock = router.slice(generationStart, listStart);
    expect(generationBlock).toContain("storageKey = result.persistent ? result.key : null");
    expect(generationBlock).toContain("modelVersionId: modelVersion.id");
  });
});
