import { useId, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/lib/i18n";
import {
  claimHealthCopy,
  claimHealthCellLabel,
  formatClaimHealthDate,
  normalizeCustomerClaimHealthProjection,
  safeClaimHealthReason,
  type ClaimHealthState,
} from "./claim-health-view-model";
import type { ClaimHealthSafeProjection } from "@shared/claim-health";

interface Props {
  expanded?: boolean;
  className?: string;
  /** A project-scoped health claim. Omit for the fixed public-market evidence view. */
  projectId?: number;
  /** A verified artifact-bound projection. Suppresses all live health queries. */
  frozenProjection?: ClaimHealthSafeProjection | unknown;
}

const STATE_STYLE: Record<
  ClaimHealthState,
  { text: string; border: string; Icon: typeof CheckCircle2 }
> = {
  current: {
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    Icon: CheckCircle2,
  },
  current_with_fallback: {
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    Icon: AlertTriangle,
  },
  qualified: {
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    Icon: AlertTriangle,
  },
  aging: {
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    Icon: Clock,
  },
  stale: {
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
    Icon: XCircle,
  },
  incident: {
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
    Icon: XCircle,
  },
  insufficient: {
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
    Icon: AlertTriangle,
  },
  unknown: {
    text: "text-muted-foreground",
    border: "border-border/50",
    Icon: Info,
  },
  legacy: {
    text: "text-muted-foreground",
    border: "border-border/50",
    Icon: Info,
  },
};

export default function DataFreshnessBanner({
  expanded: defaultExpanded = false,
  className = "",
  projectId,
  frozenProjection,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detailId = useId();
  const { locale } = useTranslation();
  const queryOptions = {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  };
  const marketQuery = trpc.design.getDataFreshness.useQuery(undefined, {
    ...queryOptions,
    enabled: frozenProjection === undefined && projectId === undefined,
  });
  const projectQuery = trpc.design.getProjectDataFreshness.useQuery(
    { projectId: projectId ?? 0 },
    {
      ...queryOptions,
      enabled: frozenProjection === undefined && projectId !== undefined,
    }
  );
  const query = projectId === undefined ? marketQuery : projectQuery;

  if (frozenProjection === undefined && query.isLoading) {
    return (
      <div
        className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        <span>
          {locale === "ar"
            ? "جارٍ التحقق من صحة الأدلة…"
            : "Checking evidence health…"}
        </span>
      </div>
    );
  }

  if (frozenProjection === undefined && query.isError) {
    return (
      <div
        className={`rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground ${className}`}
        role="status"
      >
        {locale === "ar"
          ? "حالة صحة الأدلة غير متاحة حالياً."
          : "Evidence health is currently unavailable."}
      </div>
    );
  }

  const health = normalizeCustomerClaimHealthProjection(
    frozenProjection === undefined ? query.data : frozenProjection
  );
  const copy = claimHealthCopy(health.claimState, locale);
  const style = STATE_STYLE[health.claimState];
  const HealthIcon = style.Icon;

  return (
    <section
      className={`rounded-lg border bg-secondary/20 ${style.border} ${className}`}
      aria-label={locale === "ar" ? "صحة الأدلة" : "Evidence health"}
    >
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-start text-xs transition-colors hover:bg-secondary/40"
      >
        <HealthIcon
          className={`h-3.5 w-3.5 shrink-0 ${style.text}`}
          aria-hidden="true"
        />
        <span className={`font-medium ${style.text}`}>{copy.label}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {health.counts.eligible}/{health.counts.required}{" "}
          {locale === "ar" ? "خلية مطلوبة مؤهلة" : "eligible required cells"}
        </span>
        {health.counts.fallback > 0 && (
          <span className="text-muted-foreground">
            · {health.counts.fallback} {locale === "ar" ? "بديل" : "fallback"}
          </span>
        )}
        <span className="ms-auto flex items-center gap-1 text-muted-foreground">
          <span className="hidden sm:inline">
            {formatClaimHealthDate(health.evaluatedAt, locale)}
          </span>
          {expanded ? (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          )}
        </span>
      </button>

      {expanded && (
        <div
          id={detailId}
          className="space-y-3 border-t border-border/30 px-3 pb-3 pt-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs text-muted-foreground">{copy.description}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
            <div>
              <dt>{locale === "ar" ? "مطابقة دقيقة" : "Exact"}</dt>
              <dd className="font-medium text-foreground">
                {health.counts.exact}
              </dd>
            </div>
            <div>
              <dt>{locale === "ar" ? "بدائل" : "Fallbacks"}</dt>
              <dd className="font-medium text-foreground">
                {health.counts.fallback}
              </dd>
            </div>
            <div>
              <dt>{locale === "ar" ? "السياسة" : "Policy"}</dt>
              <dd className="truncate font-medium text-foreground">
                {health.policyVersion ??
                  (locale === "ar" ? "غير متاح" : "Unavailable")}
              </dd>
            </div>
            <div>
              <dt>{locale === "ar" ? "تم التقييم" : "Evaluated"}</dt>
              <dd className="font-medium text-foreground">
                {formatClaimHealthDate(health.evaluatedAt, locale)}
              </dd>
            </div>
          </dl>
          {health.cells.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {locale === "ar"
                ? "لا توجد خلايا أدلة مطلوبة في هذا التقييم."
                : "No required evidence cells were returned for this evaluation."}
            </p>
          ) : (
            <ul
              className="space-y-1"
              aria-label={
                locale === "ar" ? "نتائج خلايا الأدلة" : "Evidence cell results"
              }
            >
              {health.cells.slice(0, 6).map(cell => (
                <li
                  key={cell.cellRef}
                  className="flex flex-col gap-0.5 border-b border-border/20 py-1 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="truncate text-[11px] font-medium">
                    {claimHealthCellLabel(cell.catalogueId, locale)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {safeClaimHealthReason(
                      cell.reasonCodes[0] ?? "unknown_incident",
                      locale
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
