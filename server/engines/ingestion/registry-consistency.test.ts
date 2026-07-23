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
