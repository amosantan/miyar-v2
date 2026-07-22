import { describe, expect, it } from "vitest";
import { DUBAI_REGULATORY_SOURCE_CATALOGUE } from "@shared/regulatory-sources";
import {
  buildDiscoveredRegulatoryDocumentRegistration,
  buildRegisteredRegulatorySource,
  classifyRegulatoryCapture,
  createDubaiRegulatoryDocumentFetcher,
  DUBAI_REGULATORY_CONNECTOR_REGISTRY,
  permitsRawArtifactStorage,
} from "./dubai-regulatory-connectors";

describe("Dubai regulatory connector registry", () => {
  it("registers every catalogue source but grants no implicit fetch authority", () => {
    expect(Object.keys(DUBAI_REGULATORY_CONNECTOR_REGISTRY)).toHaveLength(DUBAI_REGULATORY_SOURCE_CATALOGUE.length);
    const source = DUBAI_REGULATORY_SOURCE_CATALOGUE[0];
    expect(buildRegisteredRegulatorySource(source, { sourceKey: source.sourceKey, termsApproved: false, retentionApproved: false, licensingApproved: false })).toMatchObject({ termsStatus: "pending_review", retentionStatus: "pending_review", licensingStatus: "pending_review" });
  });

  it("does not let an acquisition policy bypass catalogue retention or licensing states", () => {
    const approveEverything = (sourceKey: string) => ({ sourceKey, termsApproved: true, retentionApproved: true, licensingApproved: true });

    // An out-of-scope authority is fail-closed in the catalogue itself, so an
    // acquisition policy that approves everything must not unlock it.
    const undecided = DUBAI_REGULATORY_SOURCE_CATALOGUE.find(source => source.coverageStatus === "unsupported")!;
    expect(buildRegisteredRegulatorySource(undecided, approveEverything(undecided.sourceKey)))
      .toMatchObject({ termsStatus: "approved", retentionStatus: "pending_review", licensingStatus: "pending_review" });

    // An explicit prohibition likewise survives a fully-approving policy.
    const prohibited = { ...undecided, retentionPolicy: "prohibited" as const, licensingStatus: "prohibited" as const };
    expect(buildRegisteredRegulatorySource(prohibited, approveEverything(prohibited.sourceKey)))
      .toMatchObject({ retentionStatus: "pending_review", licensingStatus: "pending_review" });

    // A decided source still requires its own policy approval; the catalogue
    // record alone grants nothing.
    const decided = DUBAI_REGULATORY_SOURCE_CATALOGUE.find(source => source.licensingStatus === "permitted")!;
    expect(buildRegisteredRegulatorySource(decided, { sourceKey: decided.sourceKey, termsApproved: false, retentionApproved: false, licensingApproved: false }))
      .toMatchObject({ termsStatus: "pending_review", retentionStatus: "pending_review", licensingStatus: "pending_review" });
  });

  it("separates permission to retrieve from permission to keep the raw artifact", () => {
    const base = DUBAI_REGULATORY_SOURCE_CATALOGUE[0];
    const fullPolicy = { sourceKey: base.sourceKey, termsApproved: true, retentionApproved: true, licensingApproved: true };
    const withRetention = (retentionPolicy: typeof base.retentionPolicy) =>
      buildRegisteredRegulatorySource({ ...base, retentionPolicy, licensingStatus: "permitted" }, fullPolicy);

    // metadata_only is lawfully readable without MIYAR holding a complete copy.
    expect(withRetention("metadata_only")).toMatchObject({ retentionStatus: "approved", licensingStatus: "permitted" });
    expect(permitsRawArtifactStorage({ ...base, retentionPolicy: "metadata_only" })).toBe(false);

    // artifact_permitted additionally allows persisting the bytes.
    expect(withRetention("artifact_permitted")).toMatchObject({ retentionStatus: "approved" });
    expect(permitsRawArtifactStorage({ ...base, retentionPolicy: "artifact_permitted" })).toBe(true);

    // Neither retrieval nor storage without a recorded decision.
    for (const retentionPolicy of ["prohibited", "pending_review"] as const) {
      expect(withRetention(retentionPolicy)).toMatchObject({ retentionStatus: "pending_review" });
      expect(permitsRawArtifactStorage({ ...base, retentionPolicy })).toBe(false);
    }
  });

  it("registers exact discovered artifacts under their official parent host and keeps them fail-closed", async () => {
    const child = buildDiscoveredRegulatoryDocumentRegistration({
      parentSourceKey: "dm.dubai-building-code",
      sourceKey: "dm.dubai-building-code.dbc-2021-pdf",
      title: "Dubai Building Code 2021 PDF",
      canonicalUrl: "https://www.dm.gov.ae/documents/dbc-2021.pdf",
    });
    // A child inherits its parent's host allowlist exactly — no more, no less —
    // and gains no use rights from having been discovered.
    const parent = DUBAI_REGULATORY_SOURCE_CATALOGUE.find(s => s.sourceKey === "dm.dubai-building-code")!;
    expect(child).toMatchObject({
      sourceKey: "dm.dubai-building-code.dbc-2021-pdf",
      approvedHosts: parent.approvedHosts,
      retentionPolicy: "pending_review",
      licensingStatus: "pending_review",
    });
    expect(child.approvedHosts).toContain("dmpmedia.dm.gov.ae");
    expect(() => buildDiscoveredRegulatoryDocumentRegistration({
      parentSourceKey: "dm.dubai-building-code",
      sourceKey: "dm.dubai-building-code.untrusted",
      title: "Untrusted PDF",
      canonicalUrl: "https://evil.example/dbc.pdf",
    })).toThrow(/not approved/);

    const fetcher = createDubaiRegulatoryDocumentFetcher({ policies: {}, discoveredDocuments: [{
      parentSourceKey: "dm.dubai-building-code",
      sourceKey: "dm.dubai-building-code.dbc-2021-pdf",
      title: "Dubai Building Code 2021 PDF",
      canonicalUrl: "https://www.dm.gov.ae/documents/dbc-2021.pdf",
    }] });
    await expect(fetcher.fetch(child.sourceKey)).rejects.toMatchObject({ code: "TERMS_NOT_APPROVED" });
  });

  it("fetches an exact child artifact only after its own reviewed envelope and acquisition policy", async () => {
    const document = {
      parentSourceKey: "dm.dubai-building-code",
      sourceKey: "dm.dubai-building-code.reviewed-2021-pdf",
      title: "Reviewed Dubai Building Code 2021 PDF",
      canonicalUrl: "https://www.dm.gov.ae/documents/reviewed-dbc-2021.pdf",
    } as const;
    const fetcher = createDubaiRegulatoryDocumentFetcher({
      policies: {
        [document.sourceKey]: { sourceKey: document.sourceKey, termsApproved: true, retentionApproved: true, licensingApproved: true },
      },
      reviewedDiscoveredDocuments: [{
        document,
        review: {
          sourceKey: document.sourceKey,
          canonicalUrl: document.canonicalUrl,
          retentionPolicy: "artifact_permitted",
          licensingStatus: "permitted",
          reviewedBy: "platform-source-policy-reviewer",
          reviewedAt: "2026-07-21T00:00:00.000Z",
        },
      }],
      options: {
        resolver: async () => [{ address: "93.184.216.34", family: 4 }],
        minRequestIntervalMs: 0,
        transport: { request: async ({ url }) => ({
          statusCode: 200,
          headers: { "content-type": url.pathname === "/robots.txt" ? "text/plain" : "application/pdf" },
          body: (async function* () { yield Buffer.from(url.pathname === "/robots.txt" ? "User-agent: *\nAllow: /" : "exact official bytes"); })(),
        }) },
      },
    });

    await expect(fetcher.fetch(document.sourceKey)).resolves.toMatchObject({
      receipt: { sourceKey: document.sourceKey, finalUrl: document.canonicalUrl, transport: "direct_official_https" },
    });
  });

  it("turns byte changes into review candidates and rejects out-of-order freshness", () => {
    const prior = { sha256: "a".repeat(64), fetchedAt: "2026-01-02T00:00:00.000Z" };
    const receipt = { ...prior, sourceKey: "dm.test", requestedUrl: "https://dm.gov.ae/a", finalUrl: "https://dm.gov.ae/a", statusCode: 200, mimeType: "application/pdf", byteLength: 1, etag: undefined, lastModified: undefined, parserVersion: "v1", redirectCount: 0, transport: "direct_official_https" as const };
    expect(classifyRegulatoryCapture({ ...receipt, fetchedAt: "2026-01-03T00:00:00.000Z" }, prior)).toBe("unchanged");
    expect(classifyRegulatoryCapture({ ...receipt, fetchedAt: "2026-01-03T00:00:00.000Z", sha256: "b".repeat(64) }, prior)).toBe("changed_candidate");
    expect(classifyRegulatoryCapture({ ...receipt, fetchedAt: "2026-01-01T00:00:00.000Z" }, prior)).toBe("out_of_order");
  });
});
