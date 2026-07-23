/**
 * EV-00 (audit F12): the connector registry, SOURCE_URLS, and the seed list
 * must stay reconciled — every static connector resolves a seed row by slug,
 * slugs are unique, and pruned dead sources cannot silently return.
 */
import { describe, expect, it } from "vitest";
import { ALL_CONNECTORS, SOURCE_URLS } from "./connectors/index";
import { UAE_SOURCES } from "./seeds/uae-sources";

const PRUNED_SOURCE_IDS = ["dera-interiors", "gems-building-materials"] as const;

describe("EV-00 registry consistency", () => {
  it("every connector id has a SOURCE_URLS entry", () => {
    for (const connectorId of Object.keys(ALL_CONNECTORS)) {
      expect(SOURCE_URLS[connectorId], `SOURCE_URLS missing ${connectorId}`).toBeTruthy();
    }
  });

  it("every connector id has a seed row with a matching slug", () => {
    const seedSlugs = new Set(UAE_SOURCES.map(source => source.slug));
    for (const connectorId of Object.keys(ALL_CONNECTORS)) {
      // gems-building-materials keeps a deactivated seed row for history but
      // has no connector; the reverse (connector without seed) is a defect.
      expect(seedSlugs.has(connectorId), `seed row missing for ${connectorId}`).toBe(true);
    }
  });

  it("seed slugs are unique and kebab-case", () => {
    const slugs = UAE_SOURCES.map(source => source.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("connector instances agree with their registered URL and id", () => {
    for (const [connectorId, factory] of Object.entries(ALL_CONNECTORS)) {
      const connector = factory();
      expect(connector.sourceId).toBe(connectorId);
      expect(connector.sourceUrl).toBe(SOURCE_URLS[connectorId]);
    }
  });

  it("pruned dead sources stay pruned from connectors and URLs", () => {
    for (const prunedId of PRUNED_SOURCE_IDS) {
      expect(ALL_CONNECTORS[prunedId]).toBeUndefined();
      expect(SOURCE_URLS[prunedId]).toBeUndefined();
    }
  });

  it("dead-domain seed rows are deactivated with a dated note, never deleted", () => {
    for (const slug of ["gems-building-materials", "pan-marble-dubai"]) {
      const seed = UAE_SOURCES.find(source => source.slug === slug);
      expect(seed, `seed row ${slug} must remain for history`).toBeDefined();
      expect(seed!.isActive).toBe(false);
      expect(seed!.notes).toContain("2026-07-23");
    }
  });

  it("registers the Graniti connector at grade B with the seeded URL", () => {
    const graniti = ALL_CONNECTORS["graniti-uae"]?.();
    expect(graniti).toBeDefined();
    expect(graniti!.sourceUrl).toBe("https://www.granitiuae.com/");
    const seed = UAE_SOURCES.find(source => source.slug === "graniti-uae");
    expect(seed?.url).toBe("https://www.granitiuae.com/");
    expect(seed?.reliabilityDefault).toBe("B");
  });

  it("hafele points at the UAE storefront in both registries", () => {
    expect(SOURCE_URLS["hafele-uae"]).toBe("https://www.hafele.ae/en/");
    expect(UAE_SOURCES.find(source => source.slug === "hafele-uae")?.url).toBe(
      "https://www.hafele.ae/en/",
    );
  });
});

/**
 * EV-01b — repairs and additions from the 2026-07-23 source verification.
 */
describe("EV-01b registry state", () => {
  function seed(slug: string) {
    const row = UAE_SOURCES.find(source => source.slug === slug);
    expect(row, `seed row ${slug} must exist`).toBeDefined();
    return row!;
  }

  it("seeds no source as terms-approved", () => {
    // Robots permission is a technical signal, not a commercial licence. Only
    // a human may record acceptance, so a seed must never write "approved".
    for (const source of UAE_SOURCES) {
      expect(source.termsDecision ?? "pending").not.toBe("approved");
    }
  });

  it("keeps every newly added source inactive until a terms decision exists", () => {
    const added = [
      "tile-king",
      "the-hardware-stop",
      "homesmiths-ae",
      "danube-home-tiles",
      "fepy-sanitary",
      "ace-uae-paints",
      "stonehaven-cost-index",
      "turner-townsend-uae-mi",
    ];
    for (const slug of added) {
      const row = seed(slug);
      expect(row.isActive, `${slug} must be seeded inactive`).toBe(false);
      expect(row.termsDecision).toBe("pending");
      expect(row.notes).toContain("2026-07-23");
    }
  });

  it("classes every consumer storefront as retail at reliability C", () => {
    for (const slug of [
      "tile-king",
      "the-hardware-stop",
      "homesmiths-ae",
      "danube-home-tiles",
      "fepy-sanitary",
      "ace-uae-paints",
      "rak-ceramics-uae",
    ]) {
      const row = seed(slug);
      expect(row.priceClass, `${slug} price class`).toBe("retail_listed");
      expect(row.reliabilityDefault, `${slug} grade`).toBe("C");
    }
  });

  it("routes a platform source through json_api and a named platform together", () => {
    for (const slug of ["tile-king", "the-hardware-stop", "homesmiths-ae", "rak-ceramics-uae"]) {
      const row = seed(slug);
      expect(row.scrapeMethod).toBe("json_api");
      expect(row.platform).toBeDefined();
      expect(["shopify", "woocommerce", "magento"]).toContain(row.platform);
    }
  });

  it("repoints RAK Ceramics to the shop subdomain in both registries", () => {
    const shopUrl = "https://onlineshop.rakceramics.com/ae_en/tiles.html";
    expect(seed("rak-ceramics-uae").url).toBe(shopUrl);
    expect(SOURCE_URLS["rak-ceramics-uae"]).toBe(shopUrl);
  });

  it("deactivates hafele rather than repairing a URL that 404s", () => {
    expect(seed("hafele-uae").isActive).toBe(false);
  });

  it("records the Dubai Pulse outage as an expired certificate, not a migration", () => {
    // The wrong diagnosis matters: repointing to `data.dubai` would target a
    // host that does not resolve, and "relax TLS verification" would be the
    // other tempting wrong fix.
    for (const slug of ["dubai-pulse-materials", "dld-transactions"]) {
      const row = seed(slug);
      expect(row.isActive).toBe(false);
      expect(row.notes).toMatch(/certificate/i);
      expect(row.url).toContain("dubaipulse.gov.ae");
    }

    expect(seed("dubai-pulse-materials").notes).toMatch(/EXPIRED/i);
    expect(seed("dubai-pulse-materials").notes).toMatch(/data\.dubai/);
  });

  it("classes the consultancy cost sources as benchmarks, not retail", () => {
    for (const slug of ["stonehaven-cost-index", "turner-townsend-uae-mi"]) {
      const row = seed(slug);
      expect(row.priceClass).toBe("consultancy_benchmark");
      expect(row.reliabilityDefault).toBe("B");
    }
  });
});
