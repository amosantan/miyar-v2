/**
 * Deterministic evidence-confidence policy.
 *
 * This module is deliberately pure: callers must supply the evaluation clock.
 * It must not read the wall clock, database, environment, or provider output.
 */

export const CONFIDENCE_CHAIN_POLICY_VERSION = "evidence-confidence-chain-v1" as const;
export const CONNECTOR_CONFIDENCE_POLICY_VERSION = "ingestion-confidence-v1" as const;
export const STATIC_SOURCE_GRADE_POLICY_VERSION = "source-grade-v1" as const;
export const REGISTRY_SOURCE_GRADE_POLICY_VERSION = "source-registry-grade-v1" as const;
export const QUALITY_CONFIDENCE_POLICY_VERSION = "evidence-quality-confidence-v1" as const;

export type ReliabilityGrade = "A" | "B" | "C";
export type PublicationDatePrecision = "date" | "datetime" | "unknown";
export type PublicationDateStatus = "missing" | "valid" | "invalid" | "future";
export type ConfidenceRejectionCode =
  | "invalid_evaluation_clock"
  | "invalid_publication_date"
  | "future_publication_date";

export interface PublicationDateMetadata {
  raw: string | null;
  parsedAt: Date | null;
  precision: PublicationDatePrecision;
  status: PublicationDateStatus;
}

export interface GradePolicyMetadata {
  grade: ReliabilityGrade;
  policyVersion:
    | typeof STATIC_SOURCE_GRADE_POLICY_VERSION
    | typeof REGISTRY_SOURCE_GRADE_POLICY_VERSION;
  source: "static_source_registry" | "source_registry";
  sourceId: string;
}

export interface InitialConfidenceStage {
  policyVersion: typeof CONNECTOR_CONFIDENCE_POLICY_VERSION;
  grade: ReliabilityGrade;
  baseScore: number;
  ageDays: number | null;
  dateAdjustment: number;
  unclampedScore: number;
  floor: number;
  cap: number;
  score: number;
}

export interface AcceptedConfidenceEvaluation {
  accepted: true;
  chainPolicyVersion: typeof CONFIDENCE_CHAIN_POLICY_VERSION;
  evaluatedAt: Date;
  publicationDate: PublicationDateMetadata;
  initial: InitialConfidenceStage;
}

export interface RejectedConfidenceEvaluation {
  accepted: false;
  chainPolicyVersion: typeof CONFIDENCE_CHAIN_POLICY_VERSION;
  evaluatedAt: Date | null;
  publicationDate: PublicationDateMetadata;
  rejectionCode: ConfidenceRejectionCode;
}

export type ConfidenceEvaluation =
  | AcceptedConfidenceEvaluation
  | RejectedConfidenceEvaluation;

export interface QualityConfidenceStage {
  policyVersion: typeof QUALITY_CONFIDENCE_POLICY_VERSION;
  status: "valid" | "outlier_flagged" | "missing_value";
  flags: string[];
  inputScore: number;
  multiplier: number;
  floor: number | null;
  score: number;
}

const BASE_CONFIDENCE: Record<ReliabilityGrade, number> = {
  A: 0.85,
  B: 0.7,
  C: 0.55,
};
const RECENCY_BONUS = 0.1;
const STALENESS_PENALTY = -0.15;
const CONFIDENCE_CAP = 1;
const CONFIDENCE_FLOOR = 0.2;
const MILLIS_PER_DAY = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function normalizeScore(value: number): number {
  return Number(value.toFixed(12));
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function parseDateOnly(raw: string): Date | null {
  const [yearText, monthText, dayText] = raw.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isValidCalendarDate(year, month, day)) return null;
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

function utcDayOrdinal(value: Date): number {
  return Math.floor(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) /
      MILLIS_PER_DAY
  );
}

/**
 * Classify a publication-date candidate without silently converting malformed
 * or future data into the approved missing-date case.
 */
export function classifyPublicationDate(
  input: Date | string | null | undefined,
  evaluatedAt: Date
): PublicationDateMetadata {
  if (input === null || input === undefined || input === "") {
    return { raw: null, parsedAt: null, precision: "unknown", status: "missing" };
  }

  const raw =
    input instanceof Date
      ? isValidDate(input)
        ? input.toISOString()
        : String(input)
      : String(input).trim();
  const datetimeMatch = typeof input === "string" ? raw.match(ISO_DATETIME_PATTERN) : null;
  const precision: PublicationDatePrecision =
    typeof input !== "string"
      ? "datetime"
      : DATE_ONLY_PATTERN.test(raw)
        ? "date"
        : datetimeMatch
          ? "datetime"
          : "unknown";
  const hasInvalidDatetimeCalendarDate =
    datetimeMatch !== null &&
    !isValidCalendarDate(
      Number(datetimeMatch[1]),
      Number(datetimeMatch[2]),
      Number(datetimeMatch[3])
    );
  const parsedAt =
    precision === "date"
      ? parseDateOnly(raw)
      : precision === "unknown" || hasInvalidDatetimeCalendarDate
        ? null
        : input instanceof Date
          ? new Date(input.getTime())
          : new Date(raw);

  if (!parsedAt || !isValidDate(parsedAt)) {
    return { raw, parsedAt: null, precision, status: "invalid" };
  }

  if (!isValidDate(evaluatedAt)) {
    return { raw, parsedAt, precision, status: "valid" };
  }

  const isFuture =
    precision === "date"
      ? utcDayOrdinal(parsedAt) > utcDayOrdinal(evaluatedAt)
      : parsedAt.getTime() > evaluatedAt.getTime();

  return {
    raw,
    parsedAt,
    precision,
    status: isFuture ? "future" : "valid",
  };
}

export function evaluateConnectorConfidence(input: {
  grade: ReliabilityGrade;
  publicationDate?: Date | string | null;
  evaluatedAt: Date;
}): ConfidenceEvaluation {
  const evaluatedAt = isValidDate(input.evaluatedAt)
    ? new Date(input.evaluatedAt.getTime())
    : null;
  const publicationDate = classifyPublicationDate(
    input.publicationDate,
    input.evaluatedAt
  );

  if (!evaluatedAt) {
    return {
      accepted: false,
      chainPolicyVersion: CONFIDENCE_CHAIN_POLICY_VERSION,
      evaluatedAt: null,
      publicationDate,
      rejectionCode: "invalid_evaluation_clock",
    };
  }
  if (publicationDate.status === "invalid") {
    return {
      accepted: false,
      chainPolicyVersion: CONFIDENCE_CHAIN_POLICY_VERSION,
      evaluatedAt,
      publicationDate,
      rejectionCode: "invalid_publication_date",
    };
  }
  if (publicationDate.status === "future") {
    return {
      accepted: false,
      chainPolicyVersion: CONFIDENCE_CHAIN_POLICY_VERSION,
      evaluatedAt,
      publicationDate,
      rejectionCode: "future_publication_date",
    };
  }

  const baseScore = BASE_CONFIDENCE[input.grade];
  let ageDays: number | null = null;
  let dateAdjustment = STALENESS_PENALTY;

  if (publicationDate.status === "valid" && publicationDate.parsedAt) {
    ageDays =
      publicationDate.precision === "date"
        ? utcDayOrdinal(evaluatedAt) - utcDayOrdinal(publicationDate.parsedAt)
        : Math.floor(
            (evaluatedAt.getTime() - publicationDate.parsedAt.getTime()) /
              MILLIS_PER_DAY
          );
    dateAdjustment =
      ageDays <= 90
        ? RECENCY_BONUS
        : ageDays > 365
          ? STALENESS_PENALTY
          : 0;
  }

  const unclampedScore = normalizeScore(baseScore + dateAdjustment);
  const score = normalizeScore(
    Math.min(CONFIDENCE_CAP, Math.max(CONFIDENCE_FLOOR, unclampedScore))
  );

  return {
    accepted: true,
    chainPolicyVersion: CONFIDENCE_CHAIN_POLICY_VERSION,
    evaluatedAt,
    publicationDate,
    initial: {
      policyVersion: CONNECTOR_CONFIDENCE_POLICY_VERSION,
      grade: input.grade,
      baseScore,
      ageDays,
      dateAdjustment,
      unclampedScore,
      floor: CONFIDENCE_FLOOR,
      cap: CONFIDENCE_CAP,
      score,
    },
  };
}

/** Build the auditable quality stage from a deterministic quality result. */
export function buildQualityConfidenceStage(input: {
  status: QualityConfidenceStage["status"];
  flags: string[];
  inputScore: number;
  multiplier?: number;
  floor?: number | null;
}): QualityConfidenceStage {
  const multiplier = input.multiplier ?? 1;
  const floor = input.floor ?? null;
  const multiplied = normalizeScore(input.inputScore * multiplier);
  return {
    policyVersion: QUALITY_CONFIDENCE_POLICY_VERSION,
    status: input.status,
    flags: [...input.flags],
    inputScore: input.inputScore,
    multiplier,
    floor,
    score: normalizeScore(floor === null ? multiplied : Math.max(multiplied, floor)),
  };
}

export class ConfidencePolicyError extends Error {
  constructor(
    readonly rejection: RejectedConfidenceEvaluation
  ) {
    super(`Confidence evaluation rejected: ${rejection.rejectionCode}`);
    this.name = "ConfidencePolicyError";
  }
}

/**
 * Compatibility helper for callers that still need only the initial number.
 * New persistence code should retain the complete evaluation instead.
 */
export function computeConfidenceScore(
  grade: ReliabilityGrade,
  publicationDate: Date | string | undefined,
  evaluatedAt: Date
): number {
  const result = evaluateConnectorConfidence({ grade, publicationDate, evaluatedAt });
  if (!result.accepted) throw new ConfidencePolicyError(result);
  return result.initial.score;
}
