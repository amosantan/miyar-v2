import type {
  ClaimHealthAuthorityState,
  ClaimHealthCadenceState,
  ClaimHealthCatalogueId,
  ClaimHealthConfidenceState,
  ClaimHealthFallbackCode,
  ClaimHealthFreshnessState,
  ClaimHealthIncidentState,
  ClaimHealthMatchState,
  ClaimHealthQualityState,
  ClaimHealthReasonCode,
  ClaimHealthSafeProjection,
  CustomerClaimHealthState,
} from "@shared/claim-health";
import {
  SUPPORTED_CLAIM_HEALTH_POLICY_VERSIONS,
  SUPPORTED_CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSIONS,
} from "@shared/claim-health";

export const CLAIM_HEALTH_STATES = [
  "current",
  "current_with_fallback",
  "qualified",
  "aging",
  "stale",
  "incident",
  "insufficient",
  "unknown",
  "legacy",
] as const;
export type ClaimHealthState = CustomerClaimHealthState;
export type ClaimHealthLocale = "en" | "ar";

type ClaimHealthCopy = Readonly<{
  label: string;
  description: string;
  tone: "success" | "warning" | "danger" | "neutral";
}>;

const COPY: Record<
  ClaimHealthLocale,
  Record<ClaimHealthState, ClaimHealthCopy>
> = {
  en: {
    current: {
      label: "Current",
      description: "All required evidence is exact and eligible.",
      tone: "success",
    },
    current_with_fallback: {
      label: "Current with fallback",
      description: "Required evidence is current, with an approved fallback.",
      tone: "warning",
    },
    qualified: {
      label: "Qualified",
      description: "Evidence is available with an explicit qualification.",
      tone: "warning",
    },
    aging: {
      label: "Aging",
      description: "Required evidence is approaching its freshness limit.",
      tone: "warning",
    },
    stale: {
      label: "Stale",
      description:
        "Required evidence is outside its approved freshness window.",
      tone: "danger",
    },
    incident: {
      label: "Active incident",
      description: "A blocking evidence incident is active.",
      tone: "danger",
    },
    insufficient: {
      label: "Insufficient evidence",
      description: "Required evidence is missing, ineligible, or incomplete.",
      tone: "danger",
    },
    unknown: {
      label: "Health unknown",
      description: "MIYAR cannot establish the required health state.",
      tone: "neutral",
    },
    legacy: {
      label: "Legacy health",
      description: "This artifact has no supported EV-04 health snapshot.",
      tone: "neutral",
    },
  },
  ar: {
    current: {
      label: "حالي",
      description: "جميع الأدلة المطلوبة مطابقة ومؤهلة.",
      tone: "success",
    },
    current_with_fallback: {
      label: "حالي مع بديل معتمد",
      description: "الأدلة المطلوبة حالية مع استخدام بديل معتمد.",
      tone: "warning",
    },
    qualified: {
      label: "مقيّد",
      description: "الأدلة متاحة مع قيد معلن.",
      tone: "warning",
    },
    aging: {
      label: "تقترب من التقادم",
      description: "الأدلة المطلوبة تقترب من حدّ الحداثة.",
      tone: "warning",
    },
    stale: {
      label: "قديمة",
      description: "الأدلة المطلوبة خارج نافذة الحداثة المعتمدة.",
      tone: "danger",
    },
    incident: {
      label: "حادثة نشطة",
      description: "توجد حادثة أدلة حاجبة نشطة.",
      tone: "danger",
    },
    insufficient: {
      label: "أدلة غير كافية",
      description: "الأدلة المطلوبة مفقودة أو غير مؤهلة أو غير مكتملة.",
      tone: "danger",
    },
    unknown: {
      label: "الحالة غير معروفة",
      description: "لا يستطيع مِعيار إثبات حالة الصحة المطلوبة.",
      tone: "neutral",
    },
    legacy: {
      label: "حالة قديمة",
      description: "لا تحتوي هذه الوثيقة على لقطة صحة EV-04 مدعومة.",
      tone: "neutral",
    },
  },
};

const REASON_COPY: Record<
  ClaimHealthLocale,
  Record<ClaimHealthReasonCode, string>
> = {
  en: {
    unsupported_policy_version: "Health policy is not supported",
    unsupported_policy_manifest_digest:
      "Health policy identity is not supported",
    unsupported_required_cell_schema_version:
      "Required-cell schema is not supported",
    legacy_artifact_without_snapshot: "Health snapshot is unavailable",
    invalid_evaluation_clock: "Evaluation time is invalid",
    empty_required_set: "No required evidence cells are configured",
    duplicate_cell_id: "Evidence cell configuration is invalid",
    catalogue_mismatch: "Evidence cell configuration is invalid",
    authority_mismatch: "Evidence authority does not match the required cell",
    authority_not_permitted: "Evidence authority is not permitted",
    fallback_not_permitted: "Evidence fallback is not permitted",
    blocking_incident: "A blocking evidence incident is active",
    missing_match: "Required evidence is missing",
    invalid_match: "Required evidence dimensions are invalid",
    ineligible_evidence: "Evidence authority is not eligible",
    raw_observation: "Raw evidence cannot support this claim",
    missing_observation_date: "Observation date is missing",
    invalid_observation_date: "Observation date is invalid",
    future_observation_date: "Observation date is not valid",
    missing_quote_validity: "Quote validity is missing",
    invalid_quote_validity: "Quote validity is invalid",
    future_quote_validity: "Quote validity is not valid",
    expired_quote: "Quote is expired",
    missing_successful_run: "Required source update is missing",
    invalid_successful_run: "Required source update is invalid",
    future_successful_run: "Required source update is not valid",
    missing_provenance: "Evidence provenance is incomplete",
    blocking_quality: "Evidence has a blocking quality issue",
    stale_observation: "Evidence is stale",
    breached_cadence: "Required source update is overdue",
    aging_observation: "Evidence is aging",
    due_cadence: "Required source update is due",
    unconfigured_sla: "Freshness policy is not configured",
    unknown_freshness: "Evidence freshness is unavailable",
    unknown_cadence: "Required source update status is unavailable",
    unknown_quality: "Evidence quality status is unavailable",
    unknown_confidence: "Evidence confidence status is unavailable",
    unknown_incident: "Incident status is unavailable",
    approved_assumption: "Approved assumption",
    approved_synthetic: "Approved synthetic evidence",
    quality_warning: "Evidence has a quality warning",
    advisory_incident: "An advisory evidence incident is active",
    approved_fallback: "Approved dimensional fallback",
  },
  ar: {
    unsupported_policy_version: "سياسة الصحة غير مدعومة",
    unsupported_policy_manifest_digest: "هوية سياسة الصحة غير مدعومة",
    unsupported_required_cell_schema_version:
      "مخطط خلايا الأدلة المطلوبة غير مدعوم",
    legacy_artifact_without_snapshot: "لقطة الصحة غير متاحة",
    invalid_evaluation_clock: "وقت التقييم غير صالح",
    empty_required_set: "لا توجد خلايا أدلة مطلوبة مهيأة",
    duplicate_cell_id: "تهيئة خلية الأدلة غير صالحة",
    catalogue_mismatch: "تهيئة خلية الأدلة غير صالحة",
    authority_mismatch: "جهة الأدلة لا تطابق الخلية المطلوبة",
    authority_not_permitted: "جهة الأدلة غير مسموح بها",
    fallback_not_permitted: "بديل الأدلة غير مسموح به",
    blocking_incident: "توجد حادثة أدلة حاجبة نشطة",
    missing_match: "الأدلة المطلوبة مفقودة",
    invalid_match: "أبعاد الأدلة المطلوبة غير صالحة",
    ineligible_evidence: "جهة الأدلة غير مؤهلة",
    raw_observation: "الأدلة الخام لا تدعم هذا الادعاء",
    missing_observation_date: "تاريخ الرصد مفقود",
    invalid_observation_date: "تاريخ الرصد غير صالح",
    future_observation_date: "تاريخ الرصد غير صالح",
    missing_quote_validity: "صلاحية عرض السعر مفقودة",
    invalid_quote_validity: "صلاحية عرض السعر غير صالحة",
    future_quote_validity: "صلاحية عرض السعر غير صالحة",
    expired_quote: "انتهت صلاحية عرض السعر",
    missing_successful_run: "تحديث المصدر المطلوب مفقود",
    invalid_successful_run: "تحديث المصدر المطلوب غير صالح",
    future_successful_run: "تحديث المصدر المطلوب غير صالح",
    missing_provenance: "مصدر الأدلة غير مكتمل",
    blocking_quality: "توجد مشكلة جودة حاجبة للأدلة",
    stale_observation: "الأدلة قديمة",
    breached_cadence: "تحديث المصدر المطلوب متأخر",
    aging_observation: "الأدلة تقترب من التقادم",
    due_cadence: "تحديث المصدر المطلوب مستحق",
    unconfigured_sla: "سياسة الحداثة غير مهيأة",
    unknown_freshness: "حداثة الأدلة غير متاحة",
    unknown_cadence: "حالة تحديث المصدر المطلوبة غير متاحة",
    unknown_quality: "حالة جودة الأدلة غير متاحة",
    unknown_confidence: "حالة موثوقية الأدلة غير متاحة",
    unknown_incident: "حالة الحادثة غير متاحة",
    approved_assumption: "افتراض معتمد",
    approved_synthetic: "أدلة اصطناعية معتمدة",
    quality_warning: "يوجد تحذير جودة للأدلة",
    advisory_incident: "توجد حادثة أدلة استشارية نشطة",
    approved_fallback: "بديل أبعادي معتمد",
  },
};

const UNKNOWN_REASON: Record<ClaimHealthLocale, string> = {
  en: "Evidence status is unavailable",
  ar: "حالة الأدلة غير متاحة",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isState(value: unknown): value is CustomerClaimHealthState {
  return (
    typeof value === "string" &&
    (CLAIM_HEALTH_STATES as readonly string[]).includes(value)
  );
}
function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function isReasonCode(value: unknown): value is ClaimHealthReasonCode {
  return typeof value === "string" && value in REASON_COPY.en;
}
function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[]
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
const REQUIREMENTS = ["required", "optional"] as const;
const MATCH_STATES = [
  "exact",
  "approved_fallback",
  "missing",
  "invalid",
] as const satisfies readonly ClaimHealthMatchState[];
const AUTHORITY_STATES = [
  "governed_benchmark",
  "approved_assumption",
  "official_observation",
  "current_supplier_quote",
  "approved_synthetic",
  "raw_observation",
  "ineligible",
] as const satisfies readonly ClaimHealthAuthorityState[];
const FRESHNESS_STATES = [
  "current",
  "aging",
  "stale",
  "unknown",
  "not_applicable",
] as const satisfies readonly ClaimHealthFreshnessState[];
const CADENCE_STATES = [
  "on_time",
  "due",
  "breached",
  "unknown",
  "not_applicable",
] as const satisfies readonly ClaimHealthCadenceState[];
const QUALITY_STATES = [
  "pass",
  "warning",
  "blocking",
  "unknown",
] as const satisfies readonly ClaimHealthQualityState[];
const CONFIDENCE_STATES = [
  "known",
  "unknown",
  "not_applicable",
] as const satisfies readonly ClaimHealthConfidenceState[];
const INCIDENT_STATES = [
  "none",
  "advisory",
  "blocking",
  "unknown",
] as const satisfies readonly ClaimHealthIncidentState[];
const FALLBACK_CODES = [
  "emirate_to_uae",
] as const satisfies readonly ClaimHealthFallbackCode[];
const CATALOGUE_IDS = [
  "material-project-v1",
  "project-report-material-v1",
  "report-public-share-v1",
  "dld-indexed-transactions-v1",
  "dld-indexed-rents-v1",
  "dld-indexed-projects-v1",
  "required-source-operations-v1",
] as const satisfies readonly ClaimHealthCatalogueId[];

function hasSupportedIdentity(value: Record<string, unknown>): boolean {
  return (
    isOneOf(value.policyVersion, SUPPORTED_CLAIM_HEALTH_POLICY_VERSIONS) &&
    typeof value.policyManifestDigest === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(value.policyManifestDigest) &&
    isOneOf(
      value.requiredCellSchemaVersion,
      SUPPORTED_CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSIONS
    )
  );
}

export function unknownClaimHealthProjection(): ClaimHealthSafeProjection {
  return {
    claimState: "unknown",
    evaluatedAt: null,
    policyVersion: "unavailable",
    policyManifestDigest: null,
    requiredCellSchemaVersion: "unavailable",
    counts: { required: 0, eligible: 0, exact: 0, fallback: 0, optional: 0 },
    reasonCodes: ["invalid_evaluation_clock"],
    cells: [],
  };
}

/** Reject malformed or pre-EV-04 telemetry output rather than making a customer-facing claim. */
export function normalizeCustomerClaimHealthProjection(
  value: ClaimHealthSafeProjection | unknown
): ClaimHealthSafeProjection {
  if (
    !isRecord(value) ||
    !isState(value.claimState) ||
    !(value.evaluatedAt === null || isIsoDate(value.evaluatedAt)) ||
    !isNonEmptyString(value.policyVersion) ||
    !(
      value.policyManifestDigest === null ||
      isNonEmptyString(value.policyManifestDigest)
    ) ||
    !isNonEmptyString(value.requiredCellSchemaVersion) ||
    !isRecord(value.counts) ||
    !Array.isArray(value.reasonCodes) ||
    !Array.isArray(value.cells)
  )
    return unknownClaimHealthProjection();
  const { required, eligible, exact, fallback, optional } = value.counts;
  if (
    !isCount(required) ||
    !isCount(eligible) ||
    !isCount(exact) ||
    !isCount(fallback) ||
    !isCount(optional) ||
    eligible > required ||
    exact > eligible ||
    fallback > eligible
  )
    return unknownClaimHealthProjection();
  if (
    !value.reasonCodes.every(isReasonCode) ||
    !value.cells.every(
      cell =>
        isRecord(cell) &&
        typeof cell.cellRef === "string" &&
        /^sha256:[a-f0-9]{64}$/.test(cell.cellRef) &&
        isOneOf(cell.catalogueId, CATALOGUE_IDS) &&
        isOneOf(cell.requirement, REQUIREMENTS) &&
        isOneOf(cell.match, MATCH_STATES) &&
        isOneOf(cell.authority, AUTHORITY_STATES) &&
        isOneOf(cell.freshness, FRESHNESS_STATES) &&
        isOneOf(cell.cadence, CADENCE_STATES) &&
        isOneOf(cell.quality, QUALITY_STATES) &&
        isOneOf(cell.confidence, CONFIDENCE_STATES) &&
        isOneOf(cell.incident, INCIDENT_STATES) &&
        (cell.fallbackCode === null ||
          isOneOf(cell.fallbackCode, FALLBACK_CODES)) &&
        (cell.observedThrough === null || isIsoDate(cell.observedThrough)) &&
        Array.isArray(cell.reasonCodes) &&
        cell.reasonCodes.every(isReasonCode)
    )
  )
    return unknownClaimHealthProjection();
  if (
    value.cells.length !== required + optional ||
    value.cells.filter(cell => cell.requirement === "required").length !==
      required ||
    new Set(value.cells.map(cell => cell.cellRef)).size !== value.cells.length
  )
    return unknownClaimHealthProjection();
  if (value.claimState !== "legacy" && !hasSupportedIdentity(value))
    return unknownClaimHealthProjection();
  if (
    value.claimState === "current" &&
    (required === 0 ||
      eligible !== required ||
      exact !== required ||
      fallback !== 0 ||
      value.reasonCodes.length !== 0 ||
      value.cells.some(
        cell =>
          cell.requirement === "required" &&
          (cell.match !== "exact" ||
            cell.freshness !== "current" ||
            !["on_time", "not_applicable"].includes(cell.cadence) ||
            cell.quality !== "pass" ||
            !["known", "not_applicable"].includes(cell.confidence) ||
            cell.incident !== "none" ||
            cell.reasonCodes.length !== 0)
      ))
  )
    return unknownClaimHealthProjection();
  const safeValue = value as unknown as ClaimHealthSafeProjection;
  return {
    claimState: safeValue.claimState,
    evaluatedAt: safeValue.evaluatedAt,
    policyVersion: safeValue.policyVersion,
    policyManifestDigest: safeValue.policyManifestDigest,
    requiredCellSchemaVersion: safeValue.requiredCellSchemaVersion,
    counts: { required, eligible, exact, fallback, optional },
    reasonCodes: [...safeValue.reasonCodes],
    cells: safeValue.cells.map(cell => ({
      cellRef: cell.cellRef,
      catalogueId: cell.catalogueId,
      requirement: cell.requirement,
      match: cell.match,
      authority: cell.authority,
      freshness: cell.freshness,
      cadence: cell.cadence,
      quality: cell.quality,
      confidence: cell.confidence,
      incident: cell.incident,
      fallbackCode: cell.fallbackCode,
      observedThrough: cell.observedThrough,
      reasonCodes: [...cell.reasonCodes],
    })),
  };
}

export function claimHealthCopy(
  state: ClaimHealthState,
  locale: ClaimHealthLocale
): ClaimHealthCopy {
  return COPY[locale][state];
}
/** Server-provided text is intentionally never rendered. */
export function safeClaimHealthReason(
  reasonCode: ClaimHealthReasonCode | string,
  locale: ClaimHealthLocale
): string {
  return (
    REASON_COPY[locale][reasonCode as ClaimHealthReasonCode] ??
    UNKNOWN_REASON[locale]
  );
}
export function formatClaimHealthDate(
  value: string | null,
  locale: ClaimHealthLocale
): string {
  return value
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : locale === "ar"
      ? "غير متاح"
      : "Unavailable";
}

export function claimHealthCellLabel(
  catalogueId: ClaimHealthCatalogueId | string,
  locale: ClaimHealthLocale
): string {
  const labels: Record<
    ClaimHealthLocale,
    Partial<Record<ClaimHealthCatalogueId, string>>
  > = {
    en: {
      "material-project-v1": "Project material allocation",
      "project-report-material-v1": "Report material allocation",
      "report-public-share-v1": "Shared report evidence",
      "dld-indexed-transactions-v1": "Dubai transaction dataset",
      "dld-indexed-rents-v1": "Dubai rent dataset",
      "dld-indexed-projects-v1": "Dubai project dataset",
      "required-source-operations-v1": "Required source operations",
    },
    ar: {
      "material-project-v1": "تخصيص مواد المشروع",
      "project-report-material-v1": "تخصيص مواد التقرير",
      "report-public-share-v1": "أدلة التقرير المشترك",
      "dld-indexed-transactions-v1": "مجموعة بيانات معاملات دبي",
      "dld-indexed-rents-v1": "مجموعة بيانات إيجارات دبي",
      "dld-indexed-projects-v1": "مجموعة بيانات مشاريع دبي",
      "required-source-operations-v1": "عمليات المصدر المطلوبة",
    },
  };
  return (
    labels[locale][catalogueId as ClaimHealthCatalogueId] ??
    (locale === "ar" ? "خلية أدلة مطلوبة" : "Required evidence cell")
  );
}
