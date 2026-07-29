/**
 * BriefEditor.tsx — Phase 3: Brief → Numbers
 *
 * Interactive design spec editor that recalculates carbon and maintenance
 * indicators from material_constants. Cost requires governed pricing.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DataFreshnessBanner from "@/components/DataFreshnessBanner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
    ArrowLeft, Leaf, Wrench, TrendingUp,
    RefreshCw, Loader2, ChevronRight, BarChart3, Building2,
} from "lucide-react";
// RICS NRM element mapping
const RICS_CODES: Record<string, { code: string; element: string }> = {
    stone: { code: "3A", element: "Natural Stone Finishes" },
    glass: { code: "2G", element: "Windows, Screens & Glazing" },
    steel: { code: "3E", element: "Metalwork & Balustrades" },
    aluminum: { code: "3E", element: "Metalwork & Balustrades" },
    concrete: { code: "2A", element: "Frame — In Situ Concrete" },
    ceramic: { code: "3A", element: "Ceramic/Porcelain Tile" },
    wood: { code: "3A", element: "Timber/Engineered Wood" },
    paint: { code: "3B", element: "Paint & Decorative Coatings" },
    insulation: { code: "2F", element: "Insulation" },
};

// Available material types from material_constants seed
const MATERIAL_TYPES = [
    "stone", "glass", "steel", "aluminum", "concrete",
    "ceramic", "wood", "paint", "insulation",
];

// Default area allocations as fraction of GFA
const DEFAULT_ALLOCATIONS: Record<string, number> = {
    stone: 0.20,
    glass: 0.10,
    steel: 0.05,
    aluminum: 0.05,
    concrete: 0.25,
    ceramic: 0.15,
    wood: 0.10,
    paint: 0.08,
    insulation: 0.02,
};

// Tier-to-active-materials mapping (which types are relevant for each tier)
const TIER_ACTIVE: Record<string, string[]> = {
    "Mid": ["concrete", "ceramic", "paint", "insulation"],
    "Upper-mid": ["concrete", "stone", "paint", "glass", "ceramic"],
    "Luxury": ["stone", "glass", "steel", "wood", "ceramic"],
    "Ultra-luxury": ["stone", "glass", "steel", "aluminum", "wood"],
};

const GRADE_COLORS: Record<string, string> = {
    A: "text-emerald-400", B: "text-teal-400", C: "text-amber-400",
    D: "text-orange-400", E: "text-red-400",
};
const GRADE_BG: Record<string, string> = {
    A: "bg-emerald-500/20", B: "bg-teal-500/20", C: "bg-amber-500/20",
    D: "bg-orange-500/20", E: "bg-red-500/20",
};

// ─── Material Allocation Slider Row ──────────────────────────────────────────

function MaterialRow({
    type, gfa, pct, enabled,
    onToggle, onPctChange,
    constData,
}: {
    type: string;
    gfa: number;
    pct: number;
    enabled: boolean;
    onToggle: () => void;
    onPctChange: (v: number) => void;
    constData?: { carbonIntensity: string | number; maintenanceFactor: string | number };
}) {
    const areaM2 = Math.round(gfa * pct);

    return (
        <div className={`rounded-lg border p-3 transition-all ${enabled ? "border-primary/30 bg-primary/5" : "border-border/30 opacity-50"}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggle}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${enabled ? "bg-primary border-primary" : "border-muted-foreground"}`}
                    >
                        {enabled && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </button>
                    <span className="text-sm font-medium text-foreground capitalize">{type}</span>
                    {constData && (
                        <Badge variant="outline" className="text-[10px]">
                            {Number(constData.carbonIntensity).toLocaleString()} kg CO₂/m²
                        </Badge>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">{areaM2} m²</p>
                </div>
            </div>
            {enabled && (
                <div className="flex items-center gap-2">
                    <Slider
                        min={1} max={40} step={1}
                        value={[Math.round(pct * 100)]}
                        onValueChange={([v]) => onPctChange(v / 100)}
                        className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(pct * 100)}%</span>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function BriefEditorContent() {
    const params = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const projectId = Number(params.id);

    // Fetch project + material constants + benchmark overlay (Phase 4)
    const { data: project } = trpc.project.get.useQuery({ id: projectId });
    const { data: materialConstants } = trpc.design.getMaterialConstants.useQuery();
    const { data: benchmark } = trpc.design.getBenchmarkForProject.useQuery(
        { projectId },
        { enabled: !!projectId },
    );

    // Build a lookup map for material constants
    const constMap = useMemo(
        () => new Map((materialConstants ?? []).map((c: any) => [c.materialType, c])),
        [materialConstants],
    );

    const gfa = project?.ctx03Gfa ? Number(project.ctx03Gfa) : 500;
    const tier = project?.mkt01Tier ?? "Upper-mid";

    // Initial active set from project tier
    const [activeTypes, setActiveTypes] = useState<Set<string>>(
        () => new Set(TIER_ACTIVE[tier] ?? TIER_ACTIVE["Upper-mid"]),
    );
    const [allocations, setAllocations] = useState<Record<string, number>>(
        () => ({ ...DEFAULT_ALLOCATIONS }),
    );

    // Build the spec payload for calculateSpec
    const specPayload = useMemo(() =>
        MATERIAL_TYPES
            .filter(t => activeTypes.has(t))
            .map(t => ({ materialType: t, areaM2: Math.round(gfa * (allocations[t] ?? 0.1)) }))
            .filter(s => s.areaM2 > 0),
        [activeTypes, allocations, gfa],
    );

    // Call calculateSpec mutation whenever payload changes (it's a mutation, not a query)
    const calcMutation = trpc.design.calculateSpec.useMutation();
    const calcResult = calcMutation.data;
    const isCalcFetching = calcMutation.isPending;

    useEffect(() => {
        if (specPayload.length > 0) {
            calcMutation.mutate({ items: specPayload });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(specPayload)]);

    const handleToggle = useCallback((type: string) => {
        setActiveTypes(prev => {
            const next = new Set(prev);
            next.has(type) ? next.delete(type) : next.add(type);
            return next;
        });
    }, []);

    const handlePctChange = useCallback((type: string, v: number) => {
        setAllocations(prev => ({ ...prev, [type]: v }));
    }, []);

    // Normalize so allocations sum to 1 (advisory, not enforced)
    const totalPct = MATERIAL_TYPES
        .filter(t => activeTypes.has(t))
        .reduce((s, t) => s + (allocations[t] ?? 0), 0);

    const grade = calcResult?.sustainabilityGrade ?? "—";
    const gradeColor = GRADE_COLORS[grade] ?? "text-muted-foreground";
    const gradeBg = GRADE_BG[grade] ?? "bg-secondary";

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${projectId}`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Brief Editor <span className="text-sm font-normal text-muted-foreground">— Spec &amp; Sustainability</span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {project?.name} · {tier} · {gfa.toLocaleString()} m² GFA
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                        onClick={() => setLocation(`/projects/${projectId}/investor-summary`)}
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        Investor View
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
                {/* ── Left: Material Sliders ───────────────────────────────────────── */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-primary" />
                                Material Allocation
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Toggle material types and adjust area allocation (% of {gfa.toLocaleString()} m² GFA).
                                Carbon and maintenance indicators recalculate from sustainability constants.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {MATERIAL_TYPES.map(type => (
                                <MaterialRow
                                    key={type}
                                    type={type}
                                    gfa={gfa}
                                    pct={allocations[type] ?? 0}
                                    enabled={activeTypes.has(type)}
                                    onToggle={() => handleToggle(type)}
                                    onPctChange={(v) => handlePctChange(type, v)}
                                    constData={constMap.get(type) as any}
                                />
                            ))}
                            {totalPct > 1.02 && (
                                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                    ⚠ Allocations sum to {Math.round(totalPct * 100)}% — consider reducing some to stay within GFA.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Right: Project Cost Panel ────────────────────────────────────── */}
                <div className="space-y-4 sticky top-4">
                    {/* Primary Metrics */}
                    <Card className="relative overflow-hidden">
                        {isCalcFetching && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-xl">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                        )}
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Leaf className="h-4 w-4 text-primary" />
                                Sustainability Profile
                                {isCalcFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Pricing availability */}
                            <div className="text-center py-3 rounded-lg bg-primary/10 border border-primary/20">
                                <p className="text-xs text-muted-foreground mb-1">Fitout Cost</p>
                                <p className="text-lg font-semibold text-primary">Unavailable</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Governed pricing is required for an authoritative estimate.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Indicative sustainability proxy */}
                                <div className={`text-center p-3 rounded-lg border ${gradeBg} border-border/30`}>
                                    <Leaf className={`h-4 w-4 mx-auto mb-1 ${gradeColor}`} />
                                    <p className="text-[10px] text-muted-foreground">Sustainability</p>
                                    <p className={`text-xl font-bold ${gradeColor}`}>{grade}</p>
                                </div>
                                {/* Maintenance */}
                                <div className="text-center p-3 rounded-lg bg-secondary/50 border border-border/30">
                                    <Wrench className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                    <p className="text-[10px] text-muted-foreground">Maintenance</p>
                                    <p className="text-xl font-bold text-foreground">
                                        {calcResult ? calcResult.avgMaintenanceFactor?.toFixed(1) ?? "—" : "—"}
                                        <span className="text-xs text-muted-foreground">/5</span>
                                    </p>
                                </div>
                            </div>

                            {/* Carbon */}
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
                                <span className="text-xs text-muted-foreground">Carbon Footprint</span>
                                <span className="text-sm font-mono text-foreground">
                                    {calcResult?.totalCarbonKg != null ? `${calcResult.totalCarbonKg.toLocaleString()} kg CO₂` : "—"}
                                </span>
                            </div>

                            <Separator />

                            {/* Per-type breakdown */}
                            {calcResult?.breakdown && calcResult.breakdown.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Breakdown
                                    </p>
                                    {calcResult.breakdown.map((b: any) => (
                                        <div key={b.materialType} className="flex items-center gap-2 text-xs">
                                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <span className="flex-1 text-muted-foreground capitalize">
                                                {b.materialType}
                                                {RICS_CODES[b.materialType] && (
                                                    <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1 font-mono">
                                                        NRM {RICS_CODES[b.materialType].code}
                                                    </Badge>
                                                )}
                                            </span>
                                            <span className="text-foreground font-mono">
                                                {b.carbonKg != null ? `${b.carbonKg.toLocaleString()} kg CO₂` : "Unavailable"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sustainability context */}
                    {calcResult && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                                    Specification Context
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Market Tier</span>
                                    <Badge variant="outline" className="text-[10px]">{tier}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sustainability coverage</span>
                                    <span className="font-mono">{calcResult.coveragePct}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Carbon Grade</span>
                                    <span className={`font-bold ${gradeColor}`}>{grade}</span>
                                </div>
                                <Separator className="my-1" />
                                <p className="text-[10px] text-muted-foreground italic">
                                    Cost and ROI require governed pricing inputs; sustainability remains available here.
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 text-xs"
                                    onClick={() => setLocation(`/projects/${projectId}/investor-summary`)}
                                >
                                    <BarChart3 className="h-3 w-3" />
                                    See Full Investor View
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Sustainability Constants Reference */}
                    {materialConstants && materialConstants.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                                    Sustainability Constants
                                    <DataFreshnessBanner className="mt-3" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {(materialConstants as any[]).map((c: any) => (
                                        <div key={c.materialType} className="flex items-center gap-2 text-[11px]">
                                            <span className="flex-1 capitalize text-muted-foreground">{c.materialType}</span>
                                            <span className="font-mono text-foreground">
                                                maintenance {Number(c.maintenanceFactor).toFixed(1)}/5
                                            </span>
                                            <span className="text-muted-foreground/60">
                                                {Number(c.carbonIntensity).toFixed(0)} kg/m²
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Phase 4: Benchmark Overlay */}
                    {benchmark && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs flex items-center gap-1.5">
                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                    <span className="text-muted-foreground uppercase tracking-wider">Governed Pricing Context</span>
                                </CardTitle>
                                <p className="text-[10px] text-muted-foreground">
                                    {benchmark.typology} · {benchmark.location} · {benchmark.marketTier}
                                    {benchmark.dataYear ? ` · ${benchmark.dataYear}` : ""}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-1.5">
                                {(["Low", "Mid", "High"] as const).map((label) => {
                                    const key = `costPerSqm${label}` as "costPerSqmLow" | "costPerSqmMid" | "costPerSqmHigh";
                                    const val = benchmark[key] as number | null;
                                    return (
                                        <div key={label} className="flex justify-between text-[11px]">
                                            <span className="text-muted-foreground">{label} estimate</span>
                                            <span className="font-mono text-foreground">
                                                {val != null ? `AED ${val.toLocaleString()}/m²` : "—"}
                                            </span>
                                        </div>
                                    );
                                })}
                                <p className="mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                                    Project cost is unavailable until governed pricing resolves the selected specification.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function BriefEditor() {
    return (
        <>
            <BriefEditorContent />
        </>
    );
}
