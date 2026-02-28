
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
    Loader2, Dices, TrendingUp, AlertTriangle, Target, DollarSign,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, ReferenceLine, Cell,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
}

// ─── Main Content ───────────────────────────────────────────────────────────

function SimulationsContent() {
    const { data: projects } = trpc.project.list.useQuery();
    const evaluatedProjects = useMemo(
        () => projects?.filter((p: any) => p.status === "evaluated") ?? [],
        [projects]
    );
    const [selectedId, setSelectedId] = useState<string>("");
    const [iterations, setIterations] = useState("10000");
    const [horizon, setHorizon] = useState("18");

    // Run simulation
    const runMut = trpc.scenario.runMonteCarlo.useMutation({
        onSuccess: () => {
            toast.success("Simulation complete");
            refetchSims();
        },
        onError: (e) => toast.error(e.message),
    });

    // Past simulations
    const { data: simulations, refetch: refetchSims } = trpc.scenario.getSimulations.useQuery(
        { projectId: Number(selectedId) },
        { enabled: !!selectedId }
    );

    // Latest result for display
    const latest = useMemo(() => {
        if (runMut.data) return runMut.data;
        if (simulations && simulations.length > 0) {
            const s = simulations[0] as any;
            return {
                percentiles: { p5: Number(s.p5), p10: Number(s.p10), p25: Number(s.p25), p50: Number(s.p50), p75: Number(s.p75), p90: Number(s.p90), p95: Number(s.p95) },
                mean: Number(s.mean),
                stdDev: Number(s.stdDev),
                var95: Number(s.var95),
                budgetExceedProbability: s.budgetExceedProbability != null ? Number(s.budgetExceedProbability) : null,
                iterations: s.iterations,
                histogram: s.histogram || [],
                timeSeries: s.timeSeriesData || [],
                minOutcome: Number(s.p5) * 0.9,
                maxOutcome: Number(s.p95) * 1.1,
            };
        }
        return null;
    }, [runMut.data, simulations]);

    const histogramData = useMemo(() => {
        if (!latest?.histogram) return [];
        return (latest.histogram as any[]).map((b: any) => ({
            range: `${fmt(b.rangeMin)}–${fmt(b.rangeMax)}`,
            count: b.count,
            percentage: b.percentage,
            rangeMin: b.rangeMin,
            rangeMax: b.rangeMax,
            isMedian: b.rangeMin <= latest.percentiles.p50 && latest.percentiles.p50 <= b.rangeMax,
        }));
    }, [latest]);

    const tsData = useMemo(() => {
        if (!latest?.timeSeries) return [];
        return (latest.timeSeries as any[]).map((pt: any) => ({
            month: `M${pt.month}`,
            p10: pt.p10,
            p50: pt.p50,
            p90: pt.p90,
        }));
    }, [latest]);

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Dices className="h-6 w-6 text-violet-400" />
                        Monte Carlo Simulations
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Probabilistic cost analysis · 10,000 randomized iterations
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {evaluatedProjects.length > 0 && (
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                                {evaluatedProjects.map((p: any) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={horizon} onValueChange={setHorizon}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6">6 months</SelectItem>
                            <SelectItem value="12">12 months</SelectItem>
                            <SelectItem value="18">18 months</SelectItem>
                            <SelectItem value="24">24 months</SelectItem>
                            <SelectItem value="36">36 months</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        className="gap-2"
                        disabled={!selectedId || runMut.isPending}
                        onClick={() =>
                            runMut.mutate({
                                projectId: Number(selectedId),
                                iterations: Number(iterations),
                                horizonMonths: Number(horizon),
                            })
                        }
                    >
                        {runMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Dices className="h-4 w-4" />
                        )}
                        Run Simulation
                    </Button>
                </div>
            </div>

            {latest ? (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Target className="h-4 w-4" />
                                    <span className="text-xs">P50 (Median)</span>
                                </div>
                                <p className="text-xl font-semibold">AED {fmt(latest.percentiles.p50)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-xs">90% CI Range</span>
                                </div>
                                <p className="text-xl font-semibold">
                                    {fmt(latest.percentiles.p5)} – {fmt(latest.percentiles.p95)}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">AED P5-P95</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="text-xs">VaR @ 95%</span>
                                </div>
                                <p className="text-xl font-semibold">AED {fmt(latest.var95)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Value at Risk</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-xs">Budget Exceed</span>
                                </div>
                                <p className="text-xl font-semibold">
                                    {latest.budgetExceedProbability != null
                                        ? `${latest.budgetExceedProbability}%`
                                        : "N/A"}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">P(over budget)</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Histogram */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Dices className="h-4 w-4 text-violet-400" />
                                    Cost Distribution
                                    <Badge variant="outline" className="text-[10px] ml-auto">
                                        {latest.iterations?.toLocaleString()} iterations
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={histogramData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis
                                            dataKey="range"
                                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "hsl(var(--popover))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: 8,
                                                fontSize: 12,
                                            }}
                                            formatter={(value: any, _name: any, props: any) => [
                                                `${value} (${props.payload.percentage}%)`,
                                                "Iterations",
                                            ]}
                                        />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            {histogramData.map((entry: any, idx: number) => (
                                                <Cell
                                                    key={idx}
                                                    fill={entry.isMedian ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <p className="text-[10px] text-muted-foreground text-center mt-1">
                                    Highlighted bar contains P50 median · σ = AED {fmt(latest.stdDev)}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Time-Series */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                                    Cost Projection Timeline
                                    <Badge variant="outline" className="text-[10px] ml-auto">
                                        P10 / P50 / P90 bands
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={tsData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10 }}
                                            tickFormatter={(v: number) => fmt(v)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "hsl(var(--popover))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: 8,
                                                fontSize: 12,
                                            }}
                                            formatter={(value: any) => [`AED ${fmt(value)}`, ""]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="p90"
                                            stackId="band"
                                            stroke="none"
                                            fill="hsl(var(--destructive) / 0.15)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="p50"
                                            stackId="mid"
                                            stroke="hsl(var(--primary))"
                                            fill="hsl(var(--primary) / 0.2)"
                                            strokeWidth={2}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="p10"
                                            stackId="low"
                                            stroke="none"
                                            fill="hsl(var(--chart-3) / 0.15)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div className="flex justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-1 rounded bg-emerald-400 inline-block" /> P10 (optimistic)
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-1 rounded bg-primary inline-block" /> P50 (median)
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-1 rounded bg-red-400 inline-block" /> P90 (pessimistic)
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Percentile Table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Full Percentile Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-7 gap-2">
                                {(["p5", "p10", "p25", "p50", "p75", "p90", "p95"] as const).map((key) => (
                                    <div key={key} className={`text-center p-3 rounded-lg border ${key === "p50" ? "border-primary/40 bg-primary/5" : "border-border/50"}`}>
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">{key.toUpperCase()}</p>
                                        <p className="text-sm font-semibold mt-1">AED {fmt(latest.percentiles[key])}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Dices className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No simulations yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Select a project and run a Monte Carlo simulation to see cost probability distributions
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function Simulations() {
    return (
        <>
            <SimulationsContent />
        </>
    );
}
