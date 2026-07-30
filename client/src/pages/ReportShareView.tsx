import { AlertTriangle, FileText, Loader2, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "wouter";

import DataFreshnessBanner from "@/components/DataFreshnessBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { installPublicShareRobotsMeta } from "@/lib/public-share-metadata";
import { trpc } from "@/lib/trpc";

const REPORT_TYPE_COPY: Record<string, { en: string; ar: string }> = {
  validation_summary: { en: "Validation summary", ar: "ملخص التحقق" },
  design_brief: { en: "Design brief", ar: "موجز التصميم" },
  full_report: { en: "Full report", ar: "التقرير الكامل" },
  autonomous_design_brief: {
    en: "Autonomous design brief",
    ar: "موجز التصميم الآلي",
  },
};

export default function ReportShareView() {
  const { token } = useParams<{ token: string }>();
  const { locale, setLocale, dir } = useTranslation();
  const share = trpc.reportShare.resolve.useQuery(
    { token: token ?? "" },
    { retry: false, refetchOnWindowFocus: false }
  );
  const reportLocale = share.data?.report.locale;
  useEffect(() => {
    if (reportLocale) setLocale(reportLocale);
  }, [reportLocale, setLocale]);
  useEffect(() => installPublicShareRobotsMeta(), []);

  if (share.isLoading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-background"
        dir={dir}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {locale === "ar"
            ? "جارٍ التحقق من رابط التقرير…"
            : "Verifying report link…"}
        </div>
      </main>
    );
  }

  if (share.isError || !share.data) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-background p-4"
        dir={dir}
      >
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-3 py-10 text-center">
            <AlertTriangle
              className="mx-auto h-8 w-8 text-amber-500"
              aria-hidden="true"
            />
            <h1 className="text-lg font-semibold">
              {locale === "ar"
                ? "رابط التقرير غير متاح"
                : "Report link unavailable"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "قد يكون الرابط منتهي الصلاحية أو ملغى أو غير صالح."
                : "The link may be expired, revoked, or invalid."}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { report, claimHealth } = share.data;
  const typeCopy = REPORT_TYPE_COPY[report.reportType]?.[locale];

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8" dir={dir}>
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-semibold">MIYAR</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            {locale === "ar" ? "English" : "العربية"}
          </Button>
        </header>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <CardTitle>
              {typeCopy ?? (locale === "ar" ? "تقرير مِعيار" : "MIYAR report")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">
                  {locale === "ar" ? "نوع التقرير" : "Report type"}
                </dt>
                <dd className="font-medium">{typeCopy ?? report.reportType}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {locale === "ar" ? "تاريخ الإنشاء" : "Generated"}
                </dt>
                <dd className="font-medium">
                  {new Intl.DateTimeFormat(
                    locale === "ar" ? "ar-AE" : "en-AE",
                    { dateStyle: "medium", timeStyle: "short" }
                  ).format(new Date(report.generatedAt))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {locale === "ar" ? "صالح حتى" : "Valid until"}
                </dt>
                <dd className="font-medium">
                  {new Intl.DateTimeFormat(
                    locale === "ar" ? "ar-AE" : "en-AE",
                    { dateStyle: "medium", timeStyle: "short" }
                  ).format(new Date(share.data.expiresAt))}
                </dd>
              </div>
            </dl>

            <DataFreshnessBanner
              frozenProjection={claimHealth}
              expanded
              className="mb-0"
            />

            <p className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs text-muted-foreground">
              {locale === "ar"
                ? "هذه معاينة عامة للقراءة فقط تعرض هوية التقرير ولقطة صحة الأدلة المجمدة وقت إنشائه. لا يعرض الرابط بيانات المشروع أو محتوى التقرير الخاص."
                : "This read-only public view shows only report identity and the evidence-health snapshot frozen when it was created. Project data and private report content are not exposed."}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
