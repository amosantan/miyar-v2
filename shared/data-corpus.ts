export const CORPUS_SCOPES = [
  "organization",
  "platform_public",
  "legacy_unscoped",
] as const;

export type CorpusScope = (typeof CORPUS_SCOPES)[number];

export const ORGANIZATION_CORPUS_POLICY_VERSION = "org-public-v1";
export const PUBLIC_CORPUS_POLICY_VERSION = "public-v1";
export const LEGACY_CORPUS_POLICY_VERSION = "legacy-v0";

export type CorpusStatus = "ok" | "insufficient_data";

export type CorpusInsufficiencyReason =
  | "no_safe_evidence"
  | "below_minimum_sample"
  | "no_same_organization_comparables"
  | "no_governed_public_data"
  | "no_governed_trend_data"
  | "pooled_learning_disabled";

export interface CorpusMetadata {
  status: CorpusStatus;
  corpusPolicyVersion: string;
  organizationSampleCount: number;
  publicSampleCount: number;
  confidence: "high" | "medium" | "low" | "insufficient";
  insufficiencyReason?: CorpusInsufficiencyReason;
}
