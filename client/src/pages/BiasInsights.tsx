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
    Brain, Loader2, AlertTriangle, Shield, ChevronDown, ChevronUp,
    X, Info, Scan, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ResponsiveContainer,
} from "recharts";

// ─── Constants ──────────────────────────────────────────────────────────────

const BIAS_ICONS: Record<string, string> = {
    optimism_bias: "☀️",
    anchoring_bias: "⚓",
    confirmation_bias: "🔍",
    overconfidence: "🎯",
    scope_creep: "📐",
    sunk_cost: "💸",
    clustering_illusion: "🎲",
};

const BIAS_LABELS: Record<string, string> = {
    optimism_bias: "Optimism",
    anchoring_bias: "Anchoring",
    confirmation_bias: "Confirmation",
    overconfidence: "Overconfidence",
    scope_creep: "Scope Creep",
    sunk_cost: "Sunk Cost",
    clustering_illusion: "Clustering",
};

const SEVERITY_STYLES: Record<string, string> = {
    critical: "border-red-500/40 bg-red-500/5",
    high: "border-orange-500/40 bg-orange-500/5",
    medium: "border-amber-500/40 bg-amber-500/5",
    low: "border-blue-500/40 bg-blue-500/5",
};

const SEVERITY_BADGE: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/40",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/40",
};

const TREND_ICON: Record<string, any> = {
    increasing: TrendingUp,
    stable: Minus,
    decreasing: TrendingDown,
};

const TREND_COLOR: Record<string, string> = {
    increasing: "text-red-400",
    stable: "text-muted-foreground",
    decreasing: "text-emerald-400",
};

// ─── Content ────────────────────────────────────────────────────────────────

function BiasInsightsContent() {
    const { data: projects } = trpc.project.list.useQuery();
    const evaluatedProjects = useMemo(
        () => projects?.filter((p: any) => p.status === "evaluated") ?? [],
        [projects]
    );
    const [selectedId, setSelectedId] = useState<string>("");

    // Profile radar
    const { data: profile } = trpc.bias.getProfile.useQuery();

    // All alerts across projects
    const { data: allAlerts, refetch: refetchAlerts } = trpc.bias.getAllActiveAlerts.useQuery();

    // Scan mutation
    const scanMut = trpc.bias.scan.useMutation({
        onSuccess: (result) => {
            refetchAlerts();
            if (result.detected > 0) {
                toast.warning(`Detected ${result.detected} cognitive bias(es)`);
            } else {
                toast.success("No cognitive biases detected");
            }
        },
        onError: (e) => toast.error(e.message),
    });

    // Dismiss
    const dismissMut = trpc.bias.dismiss.useMutation({
        onSuccess: () => {
            refetchAlerts();
            toast.success("Alert dismissed");
        },
    });

    // Build radar data
    const radarData = useMemo(() => {
        const biasTypes = [
            "optimism_bias", "anchoring_bias", "confirmation_bias",
            "overconfidence", "scope_creep", "sunk_cost", "clustering_illusion",
        ];
        return biasTypes.map((bt) => {
            const entry = (profile as any[])?.find((p: any) => p.biasType === bt);
            return {
                bias: BIAS_LABELS[bt] || bt,
                count: entry?.occurrenceCount || 0,
                severity: Number(entry?.avgSeverity || 0),
            };
        });
    }, [profile]);

    const totalBiases = radarData.reduce((s, r) => s + r.count, 0);
    const maxBias = radarData.reduce((max, r) => r.count > max.count ? r : max, radarData[0]);

    // Expanded alerts
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    // Group alerts by severity
    const criticalAlerts = allAlerts?.filter((a: any) => a.severity === "critical" || a.severity === "high") ?? [];
    const otherAlerts = allAlerts?.filter((a: any) => a.severity === "medium" || a.severity === "low") ?? [];

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Brain className="h-6 w-6 text-amber-400" />
                        Cognitive Bias Insights
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        7 bias detectors monitoring your evaluation patterns
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {evaluatedProjects.length > 0 && (
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select project to scan" />
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
                    <Button
                        className="gap-2"
                        disabled={!selectedId || scanMut.isPending}
                        onClick={() => scanMut.mutate({ projectId: Number(selectedId) })}
                    >
                        {scanMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Scan className="h-4 w-4" />
                        )}
                        Scan for Biases
                    </Button>
                </div>
            </div>

            {/* Top Row: Radar + Profile Summary */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Radar Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Brain className="h-4 w-4 text-amber-400" />
                            Bias Fingerprint
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Historical frequency of each bias type across all projects
                        </p>
                    </CardHeader>
                    <CardContent>
                        {totalBiases > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="hsl(var(--border))" />
                                    <PolarAngleAxis
                                        dataKey="bias"
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                    />
                                    <PolarRadiusAxis tick={{ fontSize: 9 }} />
                                    <Radar
                                        name="Occurrences"
                                        dataKey="count"
                                        stroke="hsl(var(--primary))"
                                        fill="hsl(var(--primary))"
                                        fillOpacity={0.3}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="py-16 text-center">
                                <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">No bias history yet</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Evaluate projects or run scans to build your bias fingerprint
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Profile Summary */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            Bias Profile
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {totalBiases} total detections • Most frequent: {maxBias?.bias || "N/A"}
                        </p>
                    </CardHeader>
                    <CardContent>
                        {profile && (profile as any[]).length > 0 ? (
                            <div className="space-y-2">
                                {(profile as any[])
                                    .sort((a: any, b: any) => (b.occurrenceCount || 0) - (a.occurrenceCount || 0))
                                    .map((entry: any) => {
                                        const TrendIcon = TREND_ICON[entry.trend] || Minus;
                                        return (
                                            <div key={entry.biasType} className="flex items-center justify-between border border-border/50 rounded-lg p-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">{BIAS_ICONS[entry.biasType] || "⚠️"}</span>
                                                    <div>
                                                        <p className="text-sm font-medium">{BIAS_LABELS[entry.biasType] || entry.biasType}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {entry.occurrenceCount} detection{entry.occurrenceCount !== 1 ? "s" : ""} •
                                                            Avg severity: {Number(entry.avgSeverity).toFixed(1)}/4
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TrendIcon className={`h-4 w-4 ${TREND_COLOR[entry.trend] || ""}`} />
                                                    <Badge variant="outline" className="text-[10px]">{entry.trend}</Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">Clean slate — no biases profiled</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Active Alerts */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            Active Alerts Across Projects
                        </CardTitle>
                        <div className="flex gap-2">
                            {criticalAlerts.length > 0 && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
                                    {criticalAlerts.length} urgent
                                </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                                {allAlerts?.length || 0} total
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {allAlerts && allAlerts.length > 0 ? (
                        <div className="space-y-2">
                            {allAlerts.map((alert: any) => {
                                const isExp = expanded[alert.id];
                                return (
                                    <div
                                        key={alert.id}
                                        className={`rounded-lg border p-3 transition-all ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="text-lg leading-none mt-0.5">{BIAS_ICONS[alert.biasType] || "⚠️"}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium">{alert.title}</span>
                                                    <Badge variant="outline" className={`text-[10px] ${SEVERITY_BADGE[alert.severity]}`}>
                                                        {alert.severity}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">{alert.confidence}%</span>
                                                    <Badge variant="outline" className="text-[10px] ml-auto">
                                                        {alert.projectName}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 mt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs gap-1 text-muted-foreground"
                                                onClick={() => setExpanded((prev) => ({ ...prev, [alert.id]: !isExp }))}
                                            >
                                                {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                {isExp ? "Less" : "Details"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs gap-1 text-muted-foreground ml-auto"
                                                onClick={() => dismissMut.mutate({ alertId: alert.id })}
                                                disabled={dismissMut.isPending}
                                            >
                                                <X className="h-3 w-3" /> Dismiss
                                            </Button>
                                        </div>

                                        {isExp && (
                                            <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                                                <div className="flex gap-2 p-2 rounded bg-primary/5 border border-primary/20">
                                                    <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-medium text-primary">Recommended Action</p>
                                                        <p className="text-xs text-foreground mt-0.5">{alert.intervention}</p>
                                                    </div>
                                                </div>
                                                {alert.evidencePoints && (alert.evidencePoints as any[]).length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Evidence</p>
                                                        <div className="space-y-1">
                                                            {(alert.evidencePoints as any[]).map((ep: any, i: number) => (
                                                                <div key={i} className="flex items-start gap-2 text-xs p-1.5 rounded bg-secondary/10">
                                                                    <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                    <div>
                                                                        <span className="font-medium">{ep.label}: </span>
                                                                        <span className="text-muted-foreground">{ep.value}</span>
                                                                        {ep.deviation && <span className="text-amber-400 ml-1">— {ep.deviation}</span>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {alert.mathExplanation && (
                                                    <div className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed p-2 bg-secondary/5 rounded">
                                                        📐 {alert.mathExplanation}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No active bias alerts</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Select a project and scan for cognitive biases
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function BiasInsights() {
    return (
        <DashboardLayout>
            <BiasInsightsContent />
        </DashboardLayout>
    );
}
