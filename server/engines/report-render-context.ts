import { createHash, randomUUID } from "node:crypto";
import { isReportLocale, type ReportLocale } from "../../shared/report-locale";

export type { ReportLocale } from "../../shared/report-locale";

export type ReportFingerprintValue =
  | null
  | boolean
  | number
  | string
  | readonly ReportFingerprintValue[]
  | { readonly [key: string]: ReportFingerprintValue };

/**
 * Convert normal renderer input into the finite JSON-like contract accepted by
 * the canonical fingerprint. Undefined object fields are omitted; undefined
 * array entries become null, matching JSON's structural semantics without
 * silently accepting NaN or Infinity.
 */
export function toReportFingerprintValue(value: unknown): ReportFingerprintValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Render fingerprint inputs must be finite numbers");
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError("Render fingerprint dates must be valid");
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(item => item === undefined ? null : toReportFingerprintValue(item));
  }
  if (typeof value === "object") {
    const output: Record<string, ReportFingerprintValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined && typeof item !== "function" && typeof item !== "symbol") {
        output[key] = toReportFingerprintValue(item);
      }
    }
    return output;
  }
  throw new TypeError(`Unsupported render fingerprint input type: ${typeof value}`);
}

export interface ReportRenderContextInput {
  /** A per-artifact identifier. Inject in tests or when a caller owns identity. */
  documentId?: string;
  /** A UTC instant. Inject in tests or when a caller owns issuance time. */
  generatedAt?: Date | string;
  locale?: ReportLocale;
  artifactVersion: string;
  rendererVersion: string;
  modelVersion?: string | null;
  benchmarkVersion?: string | null;
  logicVersion?: string | null;
  /** Canonical render inputs only; fingerprint is artifact-embedded debug data. */
  fingerprintInput: ReportFingerprintValue;
}

export interface ReportRenderContext {
  documentId: string;
  generatedAt: string;
  locale: ReportLocale;
  artifactVersion: string;
  rendererVersion: string;
  modelVersion: string | null;
  benchmarkVersion: string | null;
  logicVersion: string | null;
  /** Not an issued snapshot, evidence-chain hash, or persistence/API contract. */
  renderInputFingerprint: string;
}

/**
 * The labels below are visible in every certified artifact. Keeping them in
 * the canonical payload prevents a label change from being mistaken for the
 * same rendered report inputs.
 */
export interface RenderFingerprintLabels {
  artifactVersion: string;
  rendererVersion: string;
  modelVersion?: string | null;
  benchmarkVersion?: string | null;
  logicVersion?: string | null;
}

export function createRenderFingerprintPayload(
  reportType: string,
  locale: ReportLocale,
  labels: RenderFingerprintLabels,
  rendered: unknown,
): ReportFingerprintValue {
  return toReportFingerprintValue({
    reportType,
    locale,
    labels: {
      artifactVersion: labels.artifactVersion.trim(),
      rendererVersion: labels.rendererVersion.trim(),
      modelVersion: normalizeVersion(labels.modelVersion),
      benchmarkVersion: normalizeVersion(labels.benchmarkVersion),
      logicVersion: normalizeVersion(labels.logicVersion),
    },
    rendered,
  });
}

function canonicalize(value: ReportFingerprintValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Render fingerprint inputs must be finite numbers");
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const record = value as { readonly [key: string]: ReportFingerprintValue };
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

/** SHA-256 over a stable JSON-like representation with sorted object keys. */
export function createRenderInputFingerprint(input: ReportFingerprintValue): string {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}

function normalizeVersion(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim().length === 0) return null;
  return value.trim();
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  const date = value === undefined ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("generatedAt must be a valid date");
  return date.toISOString();
}

/**
 * Create metadata for exactly one render. The fingerprint is purposely kept in
 * this internal context so callers embed it in the artifact rather than expose
 * or persist it as an issuance/snapshot API.
 */
export function createReportRenderContext(input: ReportRenderContextInput): ReportRenderContext {
  if (!isReportLocale(input.locale ?? "en")) throw new TypeError("locale must be en or ar");
  if (input.artifactVersion.trim().length === 0) throw new TypeError("artifactVersion is required");
  if (input.rendererVersion.trim().length === 0) throw new TypeError("rendererVersion is required");

  const documentId = input.documentId?.trim() || `MYR-${randomUUID()}`;
  return {
    documentId,
    generatedAt: normalizeGeneratedAt(input.generatedAt),
    locale: input.locale ?? "en",
    artifactVersion: input.artifactVersion.trim(),
    rendererVersion: input.rendererVersion.trim(),
    modelVersion: normalizeVersion(input.modelVersion),
    benchmarkVersion: normalizeVersion(input.benchmarkVersion),
    logicVersion: normalizeVersion(input.logicVersion),
    renderInputFingerprint: createRenderInputFingerprint(input.fingerprintInput),
  };
}
