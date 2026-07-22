import { describe, expect, it } from "vitest";
import {
  DUBAI_REGULATORY_SOURCE_CATALOGUE,
  registerDiscoveredRegulatoryDocument,
  regulatorySourceRegistrationSchema,
} from "@shared/regulatory-sources";

describe("Dubai regulatory source catalogue", () => {
  it("contains only valid, unique, official HTTPS registrations", () => {
    expect(DUBAI_REGULATORY_SOURCE_CATALOGUE.length).toBeGreaterThanOrEqual(17);
    expect(new Set(DUBAI_REGULATORY_SOURCE_CATALOGUE.map(source => source.sourceKey)).size).toBe(DUBAI_REGULATORY_SOURCE_CATALOGUE.length);
    for (const source of DUBAI_REGULATORY_SOURCE_CATALOGUE) {
      expect(regulatorySourceRegistrationSchema.parse(source)).toEqual(source);
      const url = new URL(source.canonicalUrl);
      expect(url.protocol).toBe("https:");
      expect(source.approvedHosts).toContain(url.hostname);
    }
  });

  it("records the source-policy decision without ever permitting raw artifact retention", () => {
    for (const source of DUBAI_REGULATORY_SOURCE_CATALOGUE) {
      // The decision permits retrieval and analysis, never holding a complete
      // copy of an authority's document. No source may reach artifact_permitted
      // without a further, separately recorded decision.
      expect(source.retentionPolicy).not.toBe("artifact_permitted");
      if (source.coverageStatus === "unsupported") {
        // Out-of-scope authorities stay fail-closed regardless of the decision.
        expect(source.retentionPolicy).toBe("pending_review");
        expect(source.licensingStatus).toBe("pending_review");
      } else {
        expect(source.retentionPolicy).toBe("metadata_only");
        expect(source.licensingStatus).toBe("permitted");
      }
    }
    const decided = DUBAI_REGULATORY_SOURCE_CATALOGUE.filter(source => source.licensingStatus === "permitted");
    expect(decided).toHaveLength(25);
  });

  it("records special authorities as unsupported fail-closed scopes", () => {
    const overlays = DUBAI_REGULATORY_SOURCE_CATALOGUE.filter(source => source.sourceClass === "authority_overlay");
    expect(overlays.map(source => source.issuingAuthority).sort()).toEqual([
      "difc", "dubai_development_authority", "dubai_south", "trakhees_pcfc",
    ]);
    expect(overlays.every(source => source.coverageStatus === "unsupported")).toBe(true);
  });

  it("keeps operational food guidance separate from layout requirements", () => {
    const food = DUBAI_REGULATORY_SOURCE_CATALOGUE.filter(source => source.sourceKey.startsWith("dm.food-"));
    expect(new Set(food.map(source => source.sourceClass))).toEqual(new Set(["food_layout", "food_operations"]));
    expect(food.find(source => source.sourceKey === "dm.food-establishment-layout")?.sourceClass).toBe("food_layout");
    expect(food.find(source => source.sourceKey === "dm.food-operations")?.sourceClass).toBe("food_operations");
  });

  it("only derives a child registration from an exact parent-namespaced official artifact", () => {
    const child = registerDiscoveredRegulatoryDocument({
      parentSourceKey: "dcd.fire-life-safety-code",
      sourceKey: "dcd.fire-life-safety-code.2018-pdf",
      title: "UAE Fire and Life Safety Code 2018 PDF",
      canonicalUrl: "https://www.dcd.gov.ae/documents/fire-life-safety-2018.pdf",
    });
    expect(child.approvedHosts).toEqual(["www.dcd.gov.ae", "dcd.gov.ae"]);
    expect(child.retentionPolicy).toBe("pending_review");
    expect(child.licensingStatus).toBe("pending_review");
    expect(() => registerDiscoveredRegulatoryDocument({
      parentSourceKey: "dcd.fire-life-safety-code",
      sourceKey: "dcd.other-source",
      title: "Bad namespace",
      canonicalUrl: "https://www.dcd.gov.ae/documents/fire-life-safety-2018.pdf",
    })).toThrow(/namespaced/);
    expect(() => registerDiscoveredRegulatoryDocument({
      parentSourceKey: "dcd.fire-life-safety-code",
      sourceKey: "dcd.fire-life-safety-code.evil",
      title: "Unapproved host",
      canonicalUrl: "https://example.org/document.pdf",
    })).toThrow(/not approved/);
  });
});
