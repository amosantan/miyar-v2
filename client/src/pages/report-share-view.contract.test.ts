import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("report-backed share UI contract", () => {
  it("keeps the report route separate from the legacy brief share", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).toContain(
      '<Route path="/report-share/:token" component={ReportShareView} />'
    );
    expect(app).toContain(
      '<Route path="/share/:token" component={ShareView} />'
    );
  });

  it("renders only minimal report identity and the frozen projection", () => {
    const page = readFileSync(
      new URL("./ReportShareView.tsx", import.meta.url),
      "utf8"
    );
    expect(page).toContain("report.reportType");
    expect(page).toContain("report.generatedAt");
    expect(page).toContain("share.data.expiresAt");
    expect(page).toContain("frozenProjection={claimHealth}");
    expect(page).not.toContain("ReportRenderer");
    expect(page).not.toContain("dangerouslySetInnerHTML");
    expect(page).not.toContain("fileUrl");
    expect(page).not.toContain("storageKey");
  });

  it("suppresses live health queries when a frozen projection is injected", () => {
    const banner = readFileSync(
      new URL("../components/DataFreshnessBanner.tsx", import.meta.url),
      "utf8"
    );
    expect(banner).toContain(
      "enabled: frozenProjection === undefined && projectId === undefined"
    );
    expect(banner).toContain(
      "enabled: frozenProjection === undefined && projectId !== undefined"
    );
  });

  it("installs and restores a noindex robots directive", () => {
    const page = readFileSync(
      new URL("./ReportShareView.tsx", import.meta.url),
      "utf8"
    );
    expect(page).toContain("installPublicShareRobotsMeta");
    expect(page).toContain(
      "useEffect(() => installPublicShareRobotsMeta(), [])"
    );
  });
});
