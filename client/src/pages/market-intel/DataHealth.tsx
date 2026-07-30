import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HeartPulse,
  Info,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/lib/i18n";
import {
  claimHealthCopy,
  claimHealthCellLabel,
  formatClaimHealthDate,
  normalizeCustomerClaimHealthProjection,
  safeClaimHealthReason,
  type ClaimHealthState,
} from "@/components/claim-health-view-model";

const STATE_STYLE: Record<
  ClaimHealthState,
  { badge: string; Icon: typeof CheckCircle2 }
> = {
  current: {
    badge: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  current_with_fallback: {
    badge: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  qualified: {
    badge: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  aging: {
    badge: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    Icon: Clock,
  },
  stale: {
    badge: "border-red-500/40 text-red-700 dark:text-red-400",
    Icon: XCircle,
  },
  incident: {
    badge: "border-red-500/40 text-red-700 dark:text-red-400",
    Icon: XCircle,
  },
  insufficient: {
    badge: "border-red-500/40 text-red-700 dark:text-red-400",
    Icon: AlertTriangle,
  },
  unknown: { badge: "border-border text-muted-foreground", Icon: Info },
  legacy: { badge: "border-border text-muted-foreground", Icon: Info },
};

export default function DataHealth() {
  const { locale } = useTranslation();
  const query = trpc.marketIntel.dataHealth.useQuery();

  if (query.isLoading) {
    return (
      <div
        className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8"
        aria-busy="true"
        aria-label={
          locale === "ar" ? "جارٍ تحميل صحة الأدلة" : "Loading evidence health"
        }
      >
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <Card>
          <CardContent className="flex items-center gap-3 p-6" role="status">
            <Info
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "حالة صحة الأدلة غير متاحة حالياً. لم يتم عرض أي تفاصيل تشغيلية."
                : "Evidence health is currently unavailable. No operational details are shown."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const health = normalizeCustomerClaimHealthProjection(query.data);
  const copy = claimHealthCopy(health.claimState, locale);
  const style = STATE_STYLE[health.claimState];
  const StateIcon = style.Icon;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <HeartPulse
            className="h-7 w-7 text-primary sm:h-8 sm:w-8"
            aria-hidden="true"
          />
          {locale === "ar" ? "صحة الأدلة" : "Evidence health"}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {locale === "ar"
            ? "حالة قابلة للتدقيق لتغطية الأدلة المطلوبة. لا تعرض هذه الصفحة تشغيل المصادر أو أخطاء الاتصال."
            : "An auditable view of required evidence coverage. This page does not expose source operations or connector errors."}
        </p>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={
          locale === "ar" ? "ملخص صحة الأدلة" : "Evidence health summary"
        }
      >
        <Metric
          title={locale === "ar" ? "الحالة" : "Claim state"}
          value={copy.label}
          icon={<StateIcon className="h-4 w-4" aria-hidden="true" />}
          badgeClass={style.badge}
        />
        <Metric
          title={
            locale === "ar"
              ? "تغطية مطلوبة مؤهلة"
              : "Eligible required coverage"
          }
          value={`${health.counts.eligible}/${health.counts.required}`}
          description={
            locale === "ar"
              ? "الخلايا المطلوبة المؤهلة"
              : "eligible required cells"
          }
        />
        <Metric
          title={locale === "ar" ? "مطابقات دقيقة" : "Exact matches"}
          value={String(health.counts.exact)}
          description={
            locale === "ar"
              ? "دون بديل أبعادي"
              : "without a dimensional fallback"
          }
        />
        <Metric
          title={locale === "ar" ? "بدائل معتمدة" : "Approved fallbacks"}
          value={String(health.counts.fallback)}
          description={
            locale === "ar"
              ? "تبقى ظاهرة في الحالة"
              : "remain visible in the claim"
          }
        />
      </section>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {locale === "ar" ? "تفاصيل التقييم" : "Evaluation details"}
            </CardTitle>
            <Badge variant="outline" className={`w-fit ${style.badge}`}>
              <StateIcon className="me-1 h-3 w-3" aria-hidden="true" />
              {copy.label}
            </Badge>
          </div>
          <p className="text-sm font-normal text-muted-foreground">
            {copy.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">
                {locale === "ar" ? "وقت التقييم" : "Evaluated at"}
              </dt>
              <dd className="mt-1 font-medium">
                {formatClaimHealthDate(health.evaluatedAt, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {locale === "ar" ? "إصدار السياسة" : "Policy version"}
              </dt>
              <dd className="mt-1 break-all font-medium">
                {health.policyVersion ??
                  (locale === "ar" ? "غير متاح" : "Unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {locale === "ar"
                  ? "إصدار خلايا التغطية"
                  : "Required-cell schema"}
              </dt>
              <dd className="mt-1 break-all font-medium">
                {health.requiredCellSchemaVersion ??
                  (locale === "ar" ? "غير متاح" : "Unavailable")}
              </dd>
            </div>
          </dl>
          {health.claimState === "incident" && (
            <div
              className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm"
              role="status"
            >
              <strong>
                {locale === "ar"
                  ? "حادثة أدلة نشطة"
                  : "Active evidence incident"}
              </strong>
              <span className="ms-1 text-muted-foreground">
                {locale === "ar"
                  ? "تمنع هذه الحادثة حالة «حالي»."
                  : "This incident prevents a Current claim."}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold">
              {locale === "ar"
                ? "خلايا الأدلة المطلوبة"
                : "Required evidence cells"}
            </h2>
            {health.cells.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                {locale === "ar"
                  ? "لا توجد خلايا أدلة مطلوبة في هذا التقييم."
                  : "No required evidence cells were returned for this evaluation."}
              </p>
            ) : (
              <ul
                className="mt-3 divide-y rounded-md border"
                aria-label={
                  locale === "ar"
                    ? "نتائج خلايا الأدلة"
                    : "Evidence cell results"
                }
              >
                {health.cells.map(cell => (
                  <li
                    key={cell.cellRef}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {claimHealthCellLabel(cell.catalogueId, locale)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {safeClaimHealthReason(
                          cell.reasonCodes[0] ?? "unknown_incident",
                          locale
                        )}
                      </p>
                      {cell.observedThrough && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {locale === "ar"
                            ? "تم الرصد حتى"
                            : "Observed through"}
                          :{" "}
                          {formatClaimHealthDate(cell.observedThrough, locale)}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`w-fit shrink-0 ${cell.match === "exact" ? STATE_STYLE.current.badge : cell.match === "approved_fallback" ? STATE_STYLE.current_with_fallback.badge : STATE_STYLE.insufficient.badge}`}
                    >
                      {cell.match === "exact"
                        ? locale === "ar"
                          ? "مطابق"
                          : "Exact"
                        : cell.match === "approved_fallback"
                          ? locale === "ar"
                            ? "بديل معتمد"
                            : "Approved fallback"
                          : locale === "ar"
                            ? "غير مكتمل"
                            : "Incomplete"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({
  title,
  value,
  description,
  icon,
  badgeClass,
}: {
  title: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  badgeClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {badgeClass ? (
          <Badge variant="outline" className={badgeClass}>
            {value}
          </Badge>
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
