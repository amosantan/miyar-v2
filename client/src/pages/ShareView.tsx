/**
 * ShareView.tsx — Phase 5: Public Share Page
 *
 * Publicly accessible (no login required) investor brief view,
 * rendered from a token stored in the ai_design_briefs table.
 * Route: /share/:token
 */
import { useParams } from "wouter";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Building2, DollarSign, Leaf, TrendingUp, BarChart3,
    AlertCircle, Loader2, ChevronRight, Globe, Lock, Shield, LayoutGrid,
} from "lucide-react";
import type { ReportLocale } from "@shared/report-locale";

const SHARE_COPY = {
    en: {
        loading: "Loading shared brief…", unavailable: "Link unavailable",
        unavailableHelp: "This share link is invalid or has expired.", sharedBrief: "Shared Brief",
        expires: "Expires", readOnly: "Read-only", totalFitout: "Total Fitout",
        allSpaces: "All spaces", costPerSqm: "Cost / m²", blended: "Blended average",
        designPremium: "Design Premium", salesEstimate: "Estimated sales uplift",
        designIdentity: "Design Identity", budgetSynthesis: "Budget Synthesis",
        budgetBySpace: "Budget Allocation by Space", marketBenchmark: "Market Benchmark",
        spacePlanning: "Space Planning Intelligence", roiBridge: "ROI Bridge",
        sustainability: "Sustainability Grade", roiSummary: "ROI Summary",
        fitoutInvestment: "Fitout Investment", netUplift: "Net Uplift",
        marketIntelligence: "Market Intelligence", uaeTrends: "UAE Design Trends",
        assumptions: "Assumptions", evidence: "Evidence", disclaimer: "Important disclaimer",
        briefVersion: "Brief version", powered: "Powered by MIYAR Decision Intelligence · Read-only shared view",
        english: "English", arabic: "العربية",
    },
    ar: {
        loading: "جارٍ تحميل الموجز المشترك…", unavailable: "الرابط غير متاح",
        unavailableHelp: "رابط المشاركة هذا غير صالح أو انتهت صلاحيته.", sharedBrief: "موجز مشترك",
        expires: "تنتهي الصلاحية", readOnly: "للعرض فقط", totalFitout: "إجمالي التجهيز الداخلي",
        allSpaces: "جميع المساحات", costPerSqm: "التكلفة / م²", blended: "المتوسط المدمج",
        designPremium: "العلاوة التصميمية", salesEstimate: "الزيادة التقديرية في المبيعات",
        designIdentity: "هوية التصميم", budgetSynthesis: "ملخص الميزانية",
        budgetBySpace: "توزيع الميزانية حسب المساحة", marketBenchmark: "المعيار المرجعي للسوق",
        spacePlanning: "ذكاء تخطيط المساحات", roiBridge: "جسر العائد على الاستثمار",
        sustainability: "درجة الاستدامة", roiSummary: "ملخص العائد على الاستثمار",
        fitoutInvestment: "استثمار التجهيز الداخلي", netUplift: "صافي الزيادة",
        marketIntelligence: "ذكاء السوق", uaeTrends: "اتجاهات التصميم في الإمارات",
        assumptions: "الافتراضات", evidence: "الأدلة", disclaimer: "إخلاء مسؤولية مهم",
        briefVersion: "إصدار الموجز", powered: "بدعم من MIYAR لذكاء القرار · عرض مشترك للقراءة فقط",
        english: "English", arabic: "العربية",
    },
} as const;

function fmtAed(n: number, locale: ReportLocale): string {
    const digits = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", { maximumFractionDigits: 2 });
    if (n >= 1_000_000) return `${digits.format(n / 1_000_000)}M AED`;
    if (n >= 1_000) return `${digits.format(n / 1_000)}K AED`;
    return `${digits.format(n)} AED`;
}

function gradeColor(g: string) {
    return { A: "text-emerald-400", B: "text-green-400", C: "text-amber-400", D: "text-orange-400", E: "text-red-400" }[g] ?? "text-muted-foreground";
}

export default function ShareView() {
    const params = useParams<{ token: string }>();
    const token = params.token ?? "";
    const localeParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("locale");
    const locale: ReportLocale = localeParam === "ar" ? "ar" : "en";
    const copy = SHARE_COPY[locale];
    const direction = locale === "ar" ? "rtl" : "ltr";

    useEffect(() => {
        const root = document.documentElement;
        const previousLang = root.lang;
        const previousDirection = root.dir;
        const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
        const previous = existing?.content;
        const meta = existing ?? document.createElement("meta");
        if (!existing) {
            meta.name = "robots";
            document.head.appendChild(meta);
        }
        meta.content = "noindex, nofollow, noarchive";
        root.lang = locale;
        root.dir = direction;
        return () => {
            root.lang = previousLang;
            root.dir = previousDirection;
            if (existing && previous !== undefined) {
                existing.content = previous;
            } else {
                meta.remove();
            }
        };
    }, [direction, locale]);

    const { data, isLoading, error } = trpc.design.resolveShareLink.useQuery(
        { token, locale },
        { enabled: !!token, retry: false },
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center" lang={locale} dir={direction}>
                <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">{copy.loading}</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center" lang={locale} dir={direction}>
                <div className="text-center space-y-3 max-w-sm">
                    <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                    <h2 className="text-lg font-semibold">{copy.unavailable}</h2>
                    <p className="text-sm text-muted-foreground">
                        {error ? copy.unavailableHelp : copy.unavailableHelp}
                    </p>
                </div>
            </div>
        );
    }

    const tier = data.tier ?? "Upper-mid";
    const TIER_CARBON: Record<string, { grade: string }> = {
        "Entry": { grade: "B" }, "Mid": { grade: "B" },
        "Upper-mid": { grade: "C" }, "Luxury": { grade: "D" }, "Ultra-luxury": { grade: "D" },
    };
    const sustainabilityGrade = TIER_CARBON[tier]?.grade ?? "C";
    const totalFitoutBudget = data.totalFitoutBudget ?? 0;
    const estimatedSalesPremiumAed = data.estimatedSalesPremiumAed ?? 0;

    return (
        <div className="min-h-screen bg-background" lang={locale} dir={direction}>
            {/* Viewport + PWA meta */}
            {typeof document !== "undefined" && (() => {
                // Ensure viewport meta exists
                if (!document.querySelector('meta[name="viewport"]')) {
                    const meta = document.createElement("meta");
                    meta.name = "viewport";
                    meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
                    document.head.appendChild(meta);
                }
                return null;
            })()}

            {/* Header bar */}
            <div className="border-b border-border/40 bg-card/60 backdrop-blur sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm text-foreground">MIYAR</span>
                        <span className="text-muted-foreground/60 text-xs hidden sm:inline">· {copy.sharedBrief}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        {data.expiresAt ? (
                            <span>{copy.expires} {new Date(data.expiresAt).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE")}</span>
                        ) : (
                            <span>{copy.readOnly}</span>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 text-xs">
                    <a className={locale === "en" ? "font-semibold text-primary" : "text-muted-foreground"} href={`?locale=en`}>{copy.english}</a>
                    <span aria-hidden="true">·</span>
                    <a className={locale === "ar" ? "font-semibold text-primary" : "text-muted-foreground"} href={`?locale=ar`}>{copy.arabic}</a>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
                {/* Hero */}
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">{data.projectName}</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {data.typology} · {tier} · {data.location} · {data.gfaSqm.toLocaleString()} sqm GFA · {data.style}
                    </p>
                    {/* Sustainability cert badge (from new fields) */}
                    {((data as any).city || (data as any).sustainCertTarget) && (
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                                <Shield className="h-2.5 w-2.5 mr-1" />
                                {(data as any).city === "Abu Dhabi" ? "Estidama" : "Al Sa'fat"}
                                {" "}{(data as any).sustainCertTarget || "Silver"}
                            </Badge>
                        </div>
                    )}
                </div>


                {/* KPI strip — stacks on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {[
                        { label: copy.totalFitout, value: fmtAed(totalFitoutBudget, locale), sub: copy.allSpaces },
                        { label: copy.costPerSqm, value: `${(data.costPerSqm ?? 0).toLocaleString(locale === "ar" ? "ar-AE" : "en-AE")} AED`, sub: copy.blended },
                        { label: copy.designPremium, value: `+${data.salePremiumPct ?? 0}%`, sub: copy.salesEstimate },
                    ].map(k => (
                        <Card key={k.label}>
                            <CardContent className="pt-3 pb-2.5 sm:pt-4 sm:pb-3 flex sm:flex-col items-center sm:items-stretch gap-2 sm:gap-0 sm:text-center">
                                <p className="text-[10px] text-muted-foreground sm:mb-1 shrink-0 w-20 sm:w-auto">{k.label}</p>
                                <p className="text-lg sm:text-xl font-bold text-primary">{k.value}</p>
                                <p className="text-[10px] text-muted-foreground sm:mt-0.5 hidden sm:block">{k.sub}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Design Identity */}
                {(data.execSummary || Object.keys(data.designDirection ?? {}).length > 0) && (
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" /> A · {copy.designIdentity}
                        </h2>
                        <Card>
                            <CardContent className="pt-4 pb-3 space-y-3">
                                {data.execSummary && (
                                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{data.execSummary}</p>
                                )}
                                {Object.keys(data.designDirection ?? {}).length > 0 && (
                                    <>
                                        <Separator />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {Object.entries(data.designDirection ?? {}).slice(0, 6).map(([k, v]) => (
                                                <div key={k} className="flex gap-2 text-xs">
                                                    <span className="w-28 shrink-0 text-muted-foreground capitalize">
                                                        {k.replace(/([A-Z])/g, " $1")}:
                                                    </span>
                                                    <span className="text-foreground">
                                                        {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Budget */}
                {data.spaces && data.spaces.length > 0 && (
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5" /> B · {copy.budgetSynthesis}
                        </h2>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5 text-primary" /> {copy.budgetBySpace}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {data.spaces.sort((a: { budgetAed: number }, b: { budgetAed: number }) => b.budgetAed - a.budgetAed).map((s: { name: string; budgetAed: number; pct: number }) => (
                                    <div key={s.name} className="flex items-center gap-3">
                                        <span className="w-28 text-xs text-muted-foreground truncate">{s.name}</span>
                                        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                                                style={{ width: `${s.pct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-foreground w-10 text-right font-mono">{s.pct.toFixed(0)}%</span>
                                        <span className="text-xs text-muted-foreground w-20 text-right">{fmtAed(s.budgetAed, locale)}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Benchmark */}
                        {data.benchmark && (
                            <Card className="mt-3">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs flex items-center gap-1.5">
                                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                                        <span className="text-muted-foreground uppercase tracking-wider">{copy.marketBenchmark}</span>
                                    </CardTitle>
                                    <p className="text-[10px] text-muted-foreground">
                                        {data.benchmark.typology} · {data.benchmark.location} · {data.benchmark.marketTier}
                                        {data.benchmark.dataYear ? ` · ${data.benchmark.dataYear}` : ""}
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-1.5">
                                    {(["Low", "Mid", "High"] as const).map((label) => {
                                        const key = `costPerSqm${label}` as "costPerSqmLow" | "costPerSqmMid" | "costPerSqmHigh";
                                        const val = data.benchmark![key] as number | null;
                                        return (
                                            <div key={label} className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">{label} estimate</span>
                                                <span className="font-mono text-foreground">
                                                    {val != null ? `AED ${val.toLocaleString()}/m²` : "—"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* Space Planning Intelligence (Phase 9) */}
                {(data as any).spaceEfficiency && (
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <LayoutGrid className="h-3.5 w-3.5" /> B½ · {copy.spacePlanning}
                        </h2>
                        <Card>
                            <CardContent className="pt-4 pb-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                    {[
                                        { label: "Efficiency", value: `${(data as any).spaceEfficiency.efficiencyScore}/100`, color: (data as any).spaceEfficiency.efficiencyScore >= 75 ? "text-emerald-400" : (data as any).spaceEfficiency.efficiencyScore >= 50 ? "text-amber-400" : "text-red-400" },
                                        { label: "Critical Issues", value: String((data as any).spaceEfficiency.criticalCount), color: (data as any).spaceEfficiency.criticalCount > 0 ? "text-red-400" : "text-emerald-400" },
                                        { label: "Advisory", value: String((data as any).spaceEfficiency.advisoryCount), color: "text-amber-400" },
                                        { label: "Circulation", value: `${((data as any).spaceEfficiency.circulationPct ?? 0).toFixed(1)}%`, color: "text-muted-foreground" },
                                    ].map(k => (
                                        <div key={k.label} className="text-center">
                                            <p className="text-[10px] text-muted-foreground">{k.label}</p>
                                            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {((data as any).spaceEfficiency.recommendations ?? []).length > 0 && (
                                    <>
                                        <Separator className="mb-3" />
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">DLD-Backed Recommendations</p>
                                        <div className="space-y-1">
                                            {((data as any).spaceEfficiency.recommendations ?? []).slice(0, 4).map((rec: any, i: number) => (
                                                <div key={i} className="flex gap-2 items-start text-xs">
                                                    <Badge variant={rec.severity === "critical" ? "destructive" : "outline"} className="text-[9px] shrink-0 mt-px">
                                                        {rec.severity}
                                                    </Badge>
                                                    <span className="text-muted-foreground">{rec.action || rec.advice || rec.roomName}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ROI Bridge */}
                <div>
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> C · {copy.roiBridge}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <Leaf className="h-3.5 w-3.5 text-emerald-400" /> {copy.sustainability}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className={`text-4xl font-black ${gradeColor(sustainabilityGrade)}`}>{sustainabilityGrade}</p>
                                <p className="text-xs text-muted-foreground mt-1">{tier} market tier</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="text-sm">{copy.roiSummary}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{copy.fitoutInvestment}</span>
                                    <span className="font-mono text-foreground">{fmtAed(totalFitoutBudget, locale)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{copy.designPremium}</span>
                                    <span className="font-mono text-emerald-400">+{fmtAed(estimatedSalesPremiumAed, locale)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold">
                                    <span>{copy.netUplift}</span>
                                    <span className={estimatedSalesPremiumAed > totalFitoutBudget ? "text-emerald-400" : "text-amber-400"}>
                                        {fmtAed(estimatedSalesPremiumAed - totalFitoutBudget, locale)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Market Intelligence */}
                {(data.designTrends ?? []).length > 0 && (
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5" /> D · {copy.marketIntelligence}
                        </h2>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-violet-400" /> {copy.uaeTrends}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5">
                                {(data.designTrends ?? []).slice(0, 8).map((t: Record<string, any>) => (
                                    <div key={t.id} className="flex items-start gap-2 py-1 border-b border-border/20 last:border-0">
                                        <Badge
                                            variant="outline"
                                            className={`text-[9px] shrink-0 mt-px ${t.confidenceLevel === "established"
                                                ? "border-emerald-500/40 text-emerald-400"
                                                : t.confidenceLevel === "emerging"
                                                    ? "border-violet-500/40 text-violet-400"
                                                    : "border-red-500/30 text-red-400"
                                                }`}>
                                            {t.confidenceLevel}
                                        </Badge>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-foreground truncate">{t.trendName}</p>
                                            {t.description && (
                                                <p className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</p>
                                            )}
                                        </div>
                                        <Badge variant="secondary" className="text-[9px] shrink-0">{t.trendCategory}</Badge>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{copy.assumptions}</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-xs text-muted-foreground">
                            {data.assumptions.map((assumption: string) => <p key={assumption}>{assumption}</p>)}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{copy.evidence}</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-xs text-muted-foreground">
                            {data.evidence.length > 0 ? data.evidence.map((item: { label: string; value: string }) => (
                                <p key={`${item.label}:${item.value}`}><strong>{item.label}:</strong> {item.value}</p>
                            )) : <p>—</p>}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{copy.disclaimer}</CardTitle></CardHeader>
                    <CardContent className="text-xs text-muted-foreground leading-relaxed">{data.disclaimer}</CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center pt-4 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground">
                        <ChevronRight className="h-3 w-3 inline mr-0.5" />
                        {copy.powered}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">{copy.briefVersion}: {data.briefVersion}</p>
                    {(data as any).documentId && (
                        <p className="text-[9px] text-muted-foreground/50 mt-1 font-mono">
                            Doc ID: {(data as any).documentId}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
