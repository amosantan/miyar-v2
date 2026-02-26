import DashboardLayout from "@/components/DashboardLayout";
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
    Loader2, Leaf, Zap, Droplets, Recycle, Building2,
    TrendingUp, Thermometer,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Cell,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
}

function gradeColor(grade: string) {
    if (grade.startsWith("A")) return "text-emerald-400";
    if (grade.startsWith("B")) return "text-blue-400";
    if (grade.startsWith("C")) return "text-amber-400";
    return "text-red-400";
}

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score, grade, label }: { score: number; grade: string; label: string }) {
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 70 ? "#10b981" : score >= 50 ? "#3b82f6" : score >= 35 ? "#f59e0b" : "#ef4444";

    return (
        <div className="flex flex-col items-center">
            <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle
                    cx="70" cy="70" r="54" fill="none"
                    stroke={color} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 70 70)"
                />
                <text x="70" y="64" textAnchor="middle" className="text-2xl font-bold" fill="currentColor">
                    {score}
                </text>
                <text x="70" y="84" textAnchor="middle" className={`text-lg font-bold ${gradeColor(grade)}`} fill={color}>
                    {grade}
                </text>
            </svg>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
    );
}

// ─── Main Content ───────────────────────────────────────────────────────────

function SustainabilityContent() {
    const { data: projects } = trpc.project.list.useQuery();
    const evaluatedProjects = useMemo(
        () => projects?.filter((p: any) => p.status === "evaluated") ?? [],
        [projects]
    );
    const [selectedId, setSelectedId] = useState<string>("");
    const [floors, setFloors] = useState("5");
    const [specLevel, setSpecLevel] = useState("standard");

    const computeMut = trpc.sustainability.computeTwin.useMutation({
        onSuccess: () => toast.success("Digital twin computed"),
        onError: (e) => toast.error(e.message),
    });

    const result = computeMut.data;

    const carbonData = useMemo(() => {
        if (!result?.carbonBreakdown) return [];
        return (result.carbonBreakdown as any[]).map((item: any) => ({
            material: item.material.charAt(0).toUpperCase() + item.material.slice(1),
            kgCO2e: item.kgCO2e,
            percentage: item.percentage,
        }));
    }, [result]);

    const lifecycleData = useMemo(() => {
        if (!result?.lifecycle) return [];
        return (result.lifecycle as any[])
            .filter((_: any, i: number) => i % 5 === 0 || i === 30)
            .map((pt: any) => ({
                year: `Y${pt.year}`,
                cost: pt.cumulativeCost,
            }));
    }, [result]);

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Leaf className="h-6 w-6 text-emerald-400" />
                        Sustainability & Digital Twin
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Embodied carbon · operational energy · 30-year lifecycle analysis
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
                    <Select value={specLevel} onValueChange={setSpecLevel}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="economy">Economy</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="luxury">Luxury</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        className="gap-2"
                        disabled={!selectedId || computeMut.isPending}
                        onClick={() =>
                            computeMut.mutate({
                                projectId: Number(selectedId),
                                floors: Number(floors),
                                specLevel: specLevel as any,
                            })
                        }
                    >
                        {computeMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Building2 className="h-4 w-4" />
                        )}
                        Compute Twin
                    </Button>
                </div>
            </div>

            {result ? (
                <>
                    {/* Score + Key Metrics */}
                    <div className="grid md:grid-cols-5 gap-4">
                        <Card className="md:col-span-1">
                            <CardContent className="p-4 flex justify-center">
                                <ScoreRing
                                    score={result.sustainabilityScore}
                                    grade={result.sustainabilityGrade}
                                    label="Sustainability"
                                />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Leaf className="h-4 w-4" />
                                    <span className="text-xs">Embodied Carbon</span>
                                </div>
                                <p className="text-lg font-semibold">{fmt(result.totalEmbodiedCarbon)}</p>
                                <p className="text-[10px] text-muted-foreground">kgCO₂e total</p>
                                <p className="text-xs text-muted-foreground mt-1">{result.carbonPerSqm} kgCO₂e/m²</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Zap className="h-4 w-4" />
                                    <span className="text-xs">Operational Energy</span>
                                </div>
                                <p className="text-lg font-semibold">{fmt(result.operationalEnergy)}</p>
                                <p className="text-[10px] text-muted-foreground">kWh/yr total</p>
                                <p className="text-xs text-muted-foreground mt-1">{result.energyPerSqm} kWh/m²/yr</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-xs">30yr Lifecycle</span>
                                </div>
                                <p className="text-lg font-semibold">AED {fmt(result.lifecycleCost30yr)}</p>
                                <p className="text-[10px] text-muted-foreground">{fmt(result.lifecycleCostPerSqm)} AED/m²</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Thermometer className="h-4 w-4" />
                                    <span className="text-xs">Cooling Load</span>
                                </div>
                                <p className="text-lg font-semibold">{fmt(result.coolingLoad)}</p>
                                <p className="text-[10px] text-muted-foreground">kWh/yr</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {Math.round((result.coolingLoad / result.operationalEnergy) * 100)}% of total
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sub-scores */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: "Carbon Efficiency", score: result.carbonEfficiency, icon: Leaf, color: "bg-emerald-500" },
                            { label: "Energy Rating", score: result.energyRating, icon: Zap, color: "bg-amber-500" },
                            { label: "Material Circularity", score: result.materialCircularity, icon: Recycle, color: "bg-blue-500" },
                            { label: "Water Efficiency", score: result.waterEfficiency, icon: Droplets, color: "bg-cyan-500" },
                        ].map((item) => (
                            <Card key={item.label}>
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                        <item.icon className="h-3.5 w-3.5" />
                                        {item.label}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-muted rounded-full h-2">
                                            <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.score}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold w-8 text-right">{item.score}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Carbon Waterfall */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Leaf className="h-4 w-4 text-emerald-400" />
                                    Carbon Breakdown by Material
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={carbonData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 10 }}
                                            tickFormatter={(v: number) => fmt(v)}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="material"
                                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                            width={80}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "hsl(var(--popover))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: 8,
                                                fontSize: 12,
                                            }}
                                            formatter={(value: any, _name: any, props: any) => [
                                                `${fmt(value)} kgCO₂e (${props.payload.percentage}%)`,
                                                "Carbon",
                                            ]}
                                        />
                                        <Bar dataKey="kgCO2e" radius={[0, 4, 4, 0]}>
                                            {carbonData.map((_: any, idx: number) => (
                                                <Cell key={idx} fill={`hsl(${140 + idx * 25}, 60%, ${45 + idx * 5}%)`} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Lifecycle Timeline */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-400" />
                                    30-Year Lifecycle Cost
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={lifecycleData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis
                                            dataKey="year"
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
                                            formatter={(value: any) => [`AED ${fmt(value)}`, "Cumulative"]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="cost"
                                            stroke="hsl(var(--primary))"
                                            fill="hsl(var(--primary) / 0.15)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <p className="text-[10px] text-muted-foreground text-center mt-1">
                                    Includes construction, maintenance, and energy (3% annual escalation)
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recommendations */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Recycle className="h-4 w-4 text-emerald-400" />
                                Sustainability Recommendations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {result.recommendations.map((rec: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                                        <span className="text-sm">{rec}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Leaf className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No digital twin yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Select a project and compute its digital twin to analyse sustainability metrics
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function Sustainability() {
    return (
        <DashboardLayout>
            <SustainabilityContent />
        </DashboardLayout>
    );
}
