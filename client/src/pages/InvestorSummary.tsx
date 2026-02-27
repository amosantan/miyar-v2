import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Building2, Palette, Package, DollarSign, TrendingUp,
    Leaf, Wrench, ArrowLeft, Download, ChevronRight, Sparkles,
    AlertCircle, Loader2, Target, BarChart3, Globe, ExternalLink, Share2, FileText, Check,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function formatAed(amount: number) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M AED`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K AED`;
    return `${amount.toLocaleString()} AED`;
}

function GradeChip({ grade }: { grade: string }) {
    const colors: Record<string, string> = {
        A: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        B: "bg-green-500/15 text-green-400 border-green-500/30",
        C: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        D: "bg-orange-500/15 text-orange-400 border-orange-500/30",
        E: "bg-red-500/15 text-red-400 border-red-500/30",
    };
    return (
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full border text-lg font-bold ${colors[grade] ?? colors["C"]}`}>
            {grade}
        </span>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function InvestorSummaryContent() {
    const params = useParams<{ id: string }>();
    const projectId = Number(params.id);
    const [, navigate] = useLocation();
    const { toast } = useToast();
    const [shareCopied, setShareCopied] = useState(false);
    const exportInvestorPdfMut = trpc.design.exportInvestorPdf.useMutation({
        onSuccess: ({ html, projectName }) => {
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, "_blank");
            if (!win) toast({ title: "Allow popups to open the PDF preview" });
        },
        onError: (e) => toast({ title: "PDF export failed", description: e.message, variant: "destructive" }),
    });
    const createShareLinkMut = trpc.design.createShareLink.useMutation({
        onSuccess: ({ shareUrl }) => {
            const full = window.location.origin + shareUrl;
            navigator.clipboard.writeText(full).catch(() => {});
            setShareCopied(true);
            toast({ title: "Share link copied!", description: `Valid for 7 days · ${full}` });
            setTimeout(() => setShareCopied(false), 3000);
        },
        onError: (e) => toast({ title: "Could not create share link", description: e.message, variant: "destructive" }),
    });

    const { data: project } = trpc.project.get.useQuery({ id: projectId });
    const { data: brief } = trpc.designAdvisor.getDesignBrief.useQuery({ projectId }, { enabled: !!projectId });
    const { data: recs, isLoading: recsLoading } = trpc.designAdvisor.getRecommendations.useQuery({ projectId }, { enabled: !!projectId });
    const { data: materialConstants } = trpc.design.getMaterialConstants.useQuery();
    // Phase 4: Market Grounding
    const { data: designTrends } = trpc.design.getDesignTrends.useQuery(
        { projectId, limit: 12 },
        { enabled: !!projectId },
    );
    const { data: competitorContext } = trpc.design.getCompetitorContext.useQuery(
        { limit: 6 },
        {},
    );

    const hasData = !!brief?.briefData || (recs && recs.length > 0);

    // Derived numbers
    const totalFitoutBudget = recs?.reduce((s: number, r: any) => s + Number(r.budgetAllocation || 0), 0) ?? 0;
    const gfa = Number(project?.ctx03Gfa ?? 0);
    const costPerSqm = gfa > 0 && totalFitoutBudget > 0 ? Math.round(totalFitoutBudget / gfa) : 0;

    // Extract design identity from brief
    const briefData = brief?.briefData as any;
    const execSummary = briefData?.executiveSummary as string | undefined;
    const designDir = briefData?.designDirection as Record<string, any> | undefined;

    // Unique material types from space recs
    const allMaterials = (recs ?? []).flatMap((r: { roomName: string; materialPackage?: any[] }) =>
        (r.materialPackage || []).map((m: { productName: string; brand: string; priceRangeAed: string }) => ({
            name: m.productName,
            brand: m.brand,
            price: m.priceRangeAed,
            room: r.roomName,
        }))
    );

    // Material constant lookup by keyword
    const constMap = new Map((materialConstants ?? []).map((c: any) => [c.materialType, c]));

    // Budget by space
    const spaceData = (recs ?? []).map((r: { roomName: string; budgetAllocation?: number | string; sqm?: number | string }) => ({
        name: r.roomName,
        budget: Number(r.budgetAllocation || 0),
        sqm: Number(r.sqm || 0),
        pct: totalFitoutBudget > 0 ? (Number(r.budgetAllocation || 0) / totalFitoutBudget) * 100 : 0,
    })).sort((a: { budget: number }, b: { budget: number }) => b.budget - a.budget);

    // Sustainability from material constants — derive from tier
    const tier = project?.mkt01Tier ?? "Upper-mid";
    const TIER_CARBON: Record<string, { grade: string; label: string }> = {
        "Entry": { grade: "B", label: "Standard" },
        "Mid": { grade: "B", label: "Standard" },
        "Upper-mid": { grade: "C", label: "Moderate" },
        "Luxury": { grade: "D", label: "High-end finishes impact" },
        "Ultra-luxury": { grade: "D", label: "Premium materials intensity" },
    };
    const sustainability = TIER_CARBON[tier] ?? { grade: "C", label: "Moderate" };

    // Sales premium estimate
    const TIER_PREMIUM_PCT: Record<string, number> = { "Entry": 0, "Mid": 3, "Upper-mid": 8, "Luxury": 18, "Ultra-luxury": 30 };
    const salePremiumPct = TIER_PREMIUM_PCT[tier] ?? 8;
    const estimatedSalesPremiumAed = gfa > 0 ? Math.round(gfa * 25000 * salePremiumPct / 100) : 0;

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => navigate(`/projects/${projectId}`)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
                    >
                        <ArrowLeft className="h-3 w-3" /> Back to Project
                    </button>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Investor Summary
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {project?.name ?? "Project"} · {tier} Market Tier
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        onClick={() => navigate(`/projects/${projectId}/design-advisor`)}>
                        <Sparkles className="h-3.5 w-3.5" /> AI Advisor
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        onClick={() => navigate(`/projects/${projectId}/brief`)}>
                        <Download className="h-3.5 w-3.5" /> Export DOCX
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        disabled={exportInvestorPdfMut.isPending}
                        onClick={() => exportInvestorPdfMut.mutate({ projectId: Number(projectId) })}>
                        <FileText className="h-3.5 w-3.5" /> {exportInvestorPdfMut.isPending ? "Generating…" : "Export PDF"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        disabled={createShareLinkMut.isPending}
                        onClick={() => createShareLinkMut.mutate({ projectId: Number(projectId) })}>
                        {shareCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                        {shareCopied ? "Copied!" : createShareLinkMut.isPending ? "Creating…" : "Share Link"}
                    </Button>
                </div>
            </div>

            {/* If nothing is generated yet */}
            {!hasData && !recsLoading && (
                <Card>
                    <CardContent className="py-16 text-center space-y-3">
                        <AlertCircle className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <h3 className="text-base font-semibold text-foreground">No design data yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Generate design recommendations from the AI Advisor first, then this view will auto-populate.
                        </p>
                        <Button size="sm" onClick={() => navigate(`/projects/${projectId}/design-advisor`)}>
                            Go to AI Advisor
                        </Button>
                    </CardContent>
                </Card>
            )}

            {recsLoading && (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            )}

            {hasData && (
                <>
                    {/* ── Section A: Design Identity ─────────────────────────────── */}
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5" /> A · Design Identity
                        </h2>
                        <Card>
                            <CardContent className="pt-5 pb-4 space-y-4">
                                {/* Top KPIs */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: "Typology", value: project?.ctx01Typology ?? "—" },
                                        { label: "Style", value: project?.des01Style ?? "—" },
                                        { label: "Market Tier", value: tier },
                                        { label: "Location", value: project?.ctx04Location ?? "—" },
                                    ].map(item => (
                                        <div key={item.label} className="space-y-0.5">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                                            <p className="text-sm font-semibold text-foreground">{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {execSummary && (
                                    <>
                                        <Separator />
                                        <p className="text-sm text-muted-foreground leading-relaxed">{execSummary}</p>
                                    </>
                                )}

                                {designDir && Object.keys(designDir).length > 0 && (
                                    <>
                                        <Separator />
                                        <div className="grid md:grid-cols-2 gap-2">
                                            {Object.entries(designDir).slice(0, 6).map(([key, val]) => (
                                                <div key={key} className="flex gap-2 text-xs">
                                                    <span className="w-28 shrink-0 text-muted-foreground capitalize">
                                                        {key.replace(/([A-Z])/g, " $1")}:
                                                    </span>
                                                    <span className="text-foreground">
                                                        {Array.isArray(val) ? (val as string[]).join(", ") : String(val)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Section B: Material Spec ───────────────────────────────── */}
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" /> B · Material Specification
                        </h2>
                        <Card>
                            <CardContent className="pt-5 pb-4">
                                {allMaterials.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No materials yet — generate AI advisor recommendations first.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {allMaterials.slice(0, 12).map((m: { name: string; brand: string; price?: string; room: string }, i: number) => (
                                            <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-border/30 last:border-0">
                                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="flex-1 text-foreground font-medium">{m.name}</span>
                                                <span className="text-muted-foreground">{m.brand}</span>
                                                <span className="text-xs text-muted-foreground w-24 text-right">{m.room}</span>
                                                {m.price && (
                                                    <Badge variant="outline" className="text-[10px] ml-1">{m.price}</Badge>
                                                )}
                                            </div>
                                        ))}
                                        {allMaterials.length > 12 && (
                                            <p className="text-xs text-muted-foreground pt-1 text-center">
                                                +{allMaterials.length - 12} more — view full list in AI Advisor
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Material Constants Reference */}
                                {(materialConstants ?? []).length > 0 && (
                                    <>
                                        <Separator className="my-4" />
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            UAE Market Reference (AED/m²)
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {(materialConstants ?? []).slice(0, 9).map((c: any) => (
                                                <div key={c.id}
                                                    className="flex items-center justify-between text-xs p-2 rounded-md bg-secondary/40">
                                                    <span className="capitalize text-foreground">{c.materialType}</span>
                                                    <span className="text-muted-foreground font-mono">
                                                        {Number(c.costPerM2).toLocaleString()} AED
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Section C: Budget Synthesis ────────────────────────────── */}
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5" /> C · Budget Synthesis
                        </h2>
                        <div className="grid md:grid-cols-3 gap-3 mb-3">
                            {[
                                { label: "Total Fitout Budget", value: formatAed(totalFitoutBudget), sub: "All spaces combined" },
                                { label: "Cost / sqm", value: costPerSqm > 0 ? `${costPerSqm.toLocaleString()} AED` : "—", sub: `${gfa} sqm GFA` },
                                { label: "Spaces Covered", value: String(recs?.length ?? 0), sub: "AI-specified rooms" },
                            ].map(m => (
                                <Card key={m.label}>
                                    <CardContent className="pt-4 pb-3 text-center">
                                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                                        <p className="text-2xl font-bold text-primary">{m.value}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5 text-primary" /> Budget Allocation by Space
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {spaceData.map((s: { name: string; budget: number; sqm: number; pct: number }) => (
                                        <div key={s.name} className="flex items-center gap-3">
                                            <span className="w-28 text-xs text-muted-foreground truncate">{s.name}</span>
                                            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all"
                                                    style={{ width: `${s.pct}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-foreground w-10 text-right font-mono">{s.pct.toFixed(0)}%</span>
                                            <span className="text-xs text-muted-foreground w-20 text-right">{formatAed(s.budget)}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* RFQ section removed — no direct listRfqLines endpoint yet */}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Section D: ROI Bridge ──────────────────────────────────── */}
                    <div>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" /> D · ROI Bridge
                        </h2>
                        <div className="grid md:grid-cols-2 gap-3">
                            {/* Sustainability */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-1.5">
                                        <Leaf className="h-3.5 w-3.5 text-emerald-400" /> Sustainability
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-center gap-4">
                                    <GradeChip grade={sustainability.grade} />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Grade {sustainability.grade}</p>
                                        <p className="text-xs text-muted-foreground">{sustainability.label}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Maintenance */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-1.5">
                                        <Wrench className="h-3.5 w-3.5 text-amber-400" /> Maintenance Indicator
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">
                                        {tier === "Luxury" || tier === "Ultra-luxury"
                                            ? "Premium materials require specialist maintenance. Budget ~2–3% of fitout cost annually."
                                            : "Standard mid-market maintenance. Budget ~1–1.5% of fitout cost annually."}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Sales Premium */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-1.5">
                                        <Target className="h-3.5 w-3.5 text-blue-400" /> Design Premium Potential
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-primary">+{salePremiumPct}%</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Estimated sales premium for {tier} finishes in this market.<br />
                                        ≈ {formatAed(estimatedSalesPremiumAed)} uplift on a {gfa}sqm unit (at AED 25K/sqm base).
                                    </p>
                                </CardContent>
                            </Card>

                            {/* ROI Summary */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-1.5">
                                        <BarChart3 className="h-3.5 w-3.5 text-violet-400" /> ROI Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {totalFitoutBudget > 0 && estimatedSalesPremiumAed > 0 && (
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Fitout Investment</span>
                                                <span className="text-foreground font-mono">{formatAed(totalFitoutBudget)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Design Premium</span>
                                                <span className="text-emerald-400 font-mono">+{formatAed(estimatedSalesPremiumAed)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between font-semibold">
                                                <span className="text-foreground">Net Uplift</span>
                                                <span className={estimatedSalesPremiumAed > totalFitoutBudget ? "text-emerald-400" : "text-amber-400"}>
                                                    {formatAed(estimatedSalesPremiumAed - totalFitoutBudget)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {(totalFitoutBudget === 0 || estimatedSalesPremiumAed === 0) && (
                                        <p className="text-xs text-muted-foreground">
                                            Generate AI recommendations and ensure GFA is set to compute ROI bridge.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    {/* ── Section E: Market Intelligence (Phase 4) ───────────────── */}
                    {((designTrends && designTrends.length > 0) || (competitorContext && competitorContext.length > 0)) && (
                        <div>
                            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" /> E · Market Intelligence
                            </h2>
                            <div className="grid md:grid-cols-2 gap-3">
                                {/* Design Trends */}
                                {designTrends && designTrends.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center gap-1.5">
                                                <TrendingUp className="h-3.5 w-3.5 text-violet-400" /> UAE Design Trends
                                            </CardTitle>
                                            <CardDescription className="text-[10px]">
                                                Filtered for {project?.des01Style ?? "this"} style · UAE market
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-1.5">
                                            {designTrends.slice(0, 8).map((t: any) => (
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
                                                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                                                                {t.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Badge variant="secondary" className="text-[9px] shrink-0">
                                                        {t.trendCategory}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Market Sources / Competitor Context */}
                                {competitorContext && competitorContext.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center gap-1.5">
                                                <Globe className="h-3.5 w-3.5 text-sky-400" /> Market Data Sources
                                            </CardTitle>
                                            <CardDescription className="text-[10px]">
                                                Active intel sources powering this analysis
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-1.5">
                                            {competitorContext.map((s: any) => (
                                                <div key={s.id} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[9px] w-5 text-center shrink-0 ${s.reliabilityDefault === "A"
                                                                ? "border-emerald-500/40 text-emerald-400"
                                                                : s.reliabilityDefault === "B"
                                                                    ? "border-amber-500/40 text-amber-400"
                                                                    : "border-red-500/30 text-red-400"
                                                            }`}>
                                                        {s.reliabilityDefault}
                                                    </Badge>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                                                        <p className="text-[9px] text-muted-foreground">
                                                            {s.sourceType.replace(/_/g, " ")} · {s.lastRecordCount ?? 0} records
                                                        </p>
                                                    </div>
                                                    {s.url && (
                                                        <a href={s.url} target="_blank" rel="noreferrer"
                                                            className="text-muted-foreground hover:text-foreground transition-colors">
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function InvestorSummary() {
    return (
        <DashboardLayout>
            <InvestorSummaryContent />
        </DashboardLayout>
    );
}
