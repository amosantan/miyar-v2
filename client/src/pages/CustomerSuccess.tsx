import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
    Loader2, HeartPulse, Zap, Layers, Star, TrendingUp,
    CheckCircle, AlertTriangle, Clock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

function tierColor(tier: string) {
    switch (tier) {
        case "Thriving": return "text-emerald-400";
        case "Healthy": return "text-blue-400";
        case "At Risk": return "text-amber-400";
        case "Churning": return "text-red-400";
        default: return "text-muted-foreground";
    }
}

function tierBg(tier: string) {
    switch (tier) {
        case "Thriving": return "bg-emerald-500/10 border-emerald-500/30";
        case "Healthy": return "bg-blue-500/10 border-blue-500/30";
        case "At Risk": return "bg-amber-500/10 border-amber-500/30";
        case "Churning": return "bg-red-500/10 border-red-500/30";
        default: return "bg-muted border-border";
    }
}

function scoreArc(score: number) {
    // SVG arc for the gauge (0-100 mapped to 0-270 degrees)
    const angle = (score / 100) * 270;
    const rad = (angle - 135) * (Math.PI / 180);
    const r = 80;
    const cx = 100, cy = 100;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const largeArc = angle > 180 ? 1 : 0;
    // Start at -135 degrees
    const startRad = -135 * (Math.PI / 180);
    const sx = cx + r * Math.cos(startRad);
    const sy = cy + r * Math.sin(startRad);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;
}

function actionLabel(action: string): string {
    const map: Record<string, string> = {
        "project.create": "Created project",
        "project.update": "Updated project",
        "project.evaluate": "Evaluated project",
        "project.report": "Generated report",
        "scenario.create": "Created scenario",
        "bias.scan": "Ran bias scan",
        "portfolio.create": "Created portfolio",
        "simulation.run": "Ran simulation",
    };
    return map[action] || action.replace(/\./g, " → ");
}

function timeAgo(date: string | Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ─── Dimension Card ─────────────────────────────────────────────────────────

function DimensionCard({ icon: Icon, label, score, factors, color }: {
    icon: any; label: string; score: number; factors: string[]; color: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${color}`} />
                        <span className="text-sm font-medium">{label}</span>
                    </div>
                    <Badge variant="outline" className={`text-xs font-semibold ${score >= 65 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400"}`}>
                        {score}/100
                    </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mb-3">
                    <div
                        className={`h-2 rounded-full transition-all ${score >= 65 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${score}%` }}
                    />
                </div>
                <div className="space-y-1">
                    {factors.map((f, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground">{f}</p>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Content ───────────────────────────────────────────────────────────

function CustomerSuccessContent() {
    const { data: health, refetch } = trpc.customerSuccess.getHealth.useQuery();
    const { data: activityFeed } = trpc.customerSuccess.getActivityFeed.useQuery();
    const calcMut = trpc.customerSuccess.calculateHealth.useMutation({
        onSuccess: () => { toast.success("Health score updated"); refetch(); },
        onError: (e) => toast.error(e.message),
    });

    // Use mutated result or stored result
    const result = calcMut.data || (health ? {
        compositeScore: health.compositeScore,
        tier: health.healthTier as string,
        engagement: { score: health.engagementScore, factors: [] as string[] },
        adoption: { score: health.adoptionScore, factors: [] as string[] },
        quality: { score: health.qualityScore, factors: [] as string[] },
        velocity: { score: health.velocityScore, factors: [] as string[] },
        recommendations: (health.recommendations as string[]) || [],
    } : null);

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <HeartPulse className="h-6 w-6 text-rose-400" />
                        Customer Success
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Platform health score · engagement · adoption tracking
                    </p>
                </div>
                <Button
                    className="gap-2"
                    onClick={() => calcMut.mutate()}
                    disabled={calcMut.isPending}
                >
                    {calcMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <HeartPulse className="h-4 w-4" />
                    )}
                    Calculate Health
                </Button>
            </div>

            {result ? (
                <>
                    {/* Health Gauge + Tier */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <Card className="md:col-span-1">
                            <CardContent className="p-6 flex flex-col items-center">
                                <svg width="200" height="200" viewBox="0 0 200 200">
                                    {/* Background arc */}
                                    <path
                                        d={scoreArc(100)}
                                        fill="none"
                                        stroke="hsl(var(--muted))"
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                    />
                                    {/* Score arc */}
                                    <path
                                        d={scoreArc(result.compositeScore)}
                                        fill="none"
                                        stroke={result.compositeScore >= 85 ? "#10b981" : result.compositeScore >= 65 ? "#3b82f6" : result.compositeScore >= 40 ? "#f59e0b" : "#ef4444"}
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                    />
                                    <text x="100" y="92" textAnchor="middle" className="text-4xl font-bold" fill="currentColor">
                                        {result.compositeScore}
                                    </text>
                                    <text x="100" y="115" textAnchor="middle" className="text-sm" fill="hsl(var(--muted-foreground))">
                                        / 100
                                    </text>
                                </svg>
                                <Badge className={`mt-2 text-sm px-3 py-1 ${tierBg(result.tier)}`}>
                                    <span className={tierColor(result.tier)}>{result.tier}</span>
                                </Badge>
                            </CardContent>
                        </Card>

                        {/* Recommendations */}
                        <Card className="md:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Star className="h-4 w-4 text-amber-400" />
                                    Recommendations
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {result.recommendations.map((rec: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                                            <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                            <p className="text-sm">{rec}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 4 Dimension Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DimensionCard
                            icon={Zap}
                            label="Engagement"
                            score={result.engagement.score}
                            factors={result.engagement.factors}
                            color="text-yellow-400"
                        />
                        <DimensionCard
                            icon={Layers}
                            label="Adoption"
                            score={result.adoption.score}
                            factors={result.adoption.factors}
                            color="text-violet-400"
                        />
                        <DimensionCard
                            icon={Star}
                            label="Quality"
                            score={result.quality.score}
                            factors={result.quality.factors}
                            color="text-emerald-400"
                        />
                        <DimensionCard
                            icon={TrendingUp}
                            label="Velocity"
                            score={result.velocity.score}
                            factors={result.velocity.factors}
                            color="text-blue-400"
                        />
                    </div>
                </>
            ) : (
                <Card>
                    <CardContent className="py-16 text-center">
                        <HeartPulse className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No health score yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Click "Calculate Health" to analyse your platform engagement
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Activity Feed */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activityFeed && activityFeed.length > 0 ? (
                        <div className="space-y-2">
                            {activityFeed.slice(0, 15).map((entry: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-primary/60" />
                                        <span className="text-sm">{actionLabel(entry.action)}</span>
                                        {entry.entityType && (
                                            <Badge variant="outline" className="text-[10px]">{entry.entityType}</Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function CustomerSuccess() {
    return (
        <DashboardLayout>
            <CustomerSuccessContent />
        </DashboardLayout>
    );
}
