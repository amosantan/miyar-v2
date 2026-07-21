import {
  DUBAI_REGULATORY_SOURCE_CATALOGUE,
  registerDiscoveredRegulatoryDocument,
  registerReviewedRegulatoryDocument,
  type RegulatoryDiscoveredDocument,
  type RegulatoryDiscoveredDocumentReview,
  type RegulatorySourceRegistration,
} from "@shared/regulatory-sources";
import {
  RegulatoryDocumentFetcher,
  type RegisteredRegulatorySource,
  type RegulatoryDocumentFetcherOptions,
  type RegulatoryFetchReceipt,
} from "./regulatory-document-fetcher";

export type RegulatoryAcquisitionPolicy = {
  sourceKey: string;
  termsApproved: boolean;
  retentionApproved: boolean;
  licensingApproved: boolean;
};

/**
 * Converts a checked-in registration to a fetch policy only after a separate
 * policy review. The catalogue itself intentionally grants no retrieval rights.
 */
export function buildRegisteredRegulatorySource(
  registration: RegulatorySourceRegistration,
  policy: RegulatoryAcquisitionPolicy,
): RegisteredRegulatorySource {
  if (policy.sourceKey !== registration.sourceKey) throw new Error("Acquisition policy source identity mismatch");
  return {
    sourceKey: registration.sourceKey,
    canonicalUrl: registration.canonicalUrl,
    allowedHosts: registration.approvedHosts,
    termsStatus: policy.termsApproved ? "approved" : "pending_review",
    // A policy checkbox cannot override a source record that disallows storage/use.
    retentionStatus: policy.retentionApproved && registration.retentionPolicy === "artifact_permitted" ? "approved" : "pending_review",
    licensingStatus: policy.licensingApproved && registration.licensingStatus === "permitted" ? "permitted" : "pending_review",
  };
}

/**
 * Registers a discovered child only as a host-constrained candidate. The child
 * cannot be fetched unless its own later acquisition policy and licensing state
 * are both approved; inheriting a parent policy is intentionally forbidden.
 */
export function buildDiscoveredRegulatoryDocumentRegistration(
  input: RegulatoryDiscoveredDocument,
): RegulatorySourceRegistration {
  return registerDiscoveredRegulatoryDocument(input);
}

type DubaiFetcherOptions = Omit<RegulatoryDocumentFetcherOptions, "sources">;

/**
 * The only Dubai acquisition construction path. It snapshots the checked-in
 * catalogue plus explicitly registered child artifacts into the fetcher's
 * immutable constructor registry. Missing policies fail closed.
 */
export function createDubaiRegulatoryDocumentFetcher(input: {
  policies: Readonly<Record<string, RegulatoryAcquisitionPolicy | undefined>>;
  discoveredDocuments?: readonly RegulatoryDiscoveredDocument[];
  reviewedDiscoveredDocuments?: readonly Readonly<{ document: RegulatoryDiscoveredDocument; review: RegulatoryDiscoveredDocumentReview }>[];
  options?: DubaiFetcherOptions;
}): RegulatoryDocumentFetcher {
  const discovered = (input.discoveredDocuments ?? []).map(buildDiscoveredRegulatoryDocumentRegistration);
  const reviewed = (input.reviewedDiscoveredDocuments ?? []).map(entry => registerReviewedRegulatoryDocument(entry.document, entry.review));
  const registrations = [...DUBAI_REGULATORY_SOURCE_CATALOGUE, ...discovered, ...reviewed];
  const seen = new Set<string>();
  const sources = registrations.map((registration) => {
    if (seen.has(registration.sourceKey)) throw new Error(`Duplicate regulatory acquisition source key: ${registration.sourceKey}`);
    seen.add(registration.sourceKey);
    const policy = input.policies[registration.sourceKey] ?? {
      sourceKey: registration.sourceKey,
      termsApproved: false,
      retentionApproved: false,
      licensingApproved: false,
    };
    return buildRegisteredRegulatorySource(registration, policy);
  });
  return new RegulatoryDocumentFetcher({ ...input.options, sources });
}

export const DUBAI_REGULATORY_CONNECTOR_REGISTRY = Object.freeze(Object.fromEntries(
  DUBAI_REGULATORY_SOURCE_CATALOGUE.map(source => [source.sourceKey, Object.freeze({
    sourceKey: source.sourceKey,
    authority: source.issuingAuthority,
    canonicalUrl: source.canonicalUrl,
    coverageStatus: source.coverageStatus,
    monitorMode: source.sourceClass.endsWith("index") ? "index" : "document",
  })]),
));

export function classifyRegulatoryCapture(
  current: RegulatoryFetchReceipt,
  previous?: Pick<RegulatoryFetchReceipt, "sha256" | "fetchedAt">,
): "captured" | "unchanged" | "changed_candidate" | "out_of_order" {
  if (!previous) return "captured";
  if (Date.parse(current.fetchedAt) <= Date.parse(previous.fetchedAt)) return "out_of_order";
  return current.sha256 === previous.sha256 ? "unchanged" : "changed_candidate";
}
