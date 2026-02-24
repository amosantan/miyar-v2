import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle,
    Brain,
    ChevronDown,
    ChevronUp,
    X,
    Info,
    Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const BIAS_ICONS: Record<string, string> = {
    optimism_bias: "☀️",
    anchoring_bias: "⚓",
    confirmation_bias: "🔍",
    overconfidence: "🎯",
    scope_creep: "📐",
    sunk_cost: "💸",
    clustering_illusion: "🎲",
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

interface BiasAlertsProps {
    projectId: number;
}

export default function BiasAlerts({ projectId }: BiasAlertsProps) {
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    const { data: alerts, isLoading, refetch } = trpc.bias.getActiveAlerts.useQuery(
        { projectId },
        { enabled: !!projectId }
    );

    const dismissMutation = trpc.bias.dismiss.useMutation({
        onSuccess: () => {
            refetch();
            toast.success("Bias alert dismissed");
        },
    });

    if (isLoading || !alerts || alerts.length === 0) return null;

    const criticalCount = alerts.filter((a: any) => a.severity === "critical" || a.severity === "high").length;

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Cognitive Bias Analysis</h3>
                <Badge variant="outline" className="text-[10px] ml-auto">
                    {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
                </Badge>
                {criticalCount > 0 && (
                    <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/40">
                        {criticalCount} urgent
                    </Badge>
                )}
            </div>

            {/* Alert Cards */}
            {alerts.map((alert: any) => {
                const isExpanded = expanded[alert.id];
                return (
                    <div
                        key={alert.id}
                        className={`rounded-lg border p-3 transition-all ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium}`}
                    >
                        {/* Alert Header */}
                        <div className="flex items-start gap-2">
                            <span className="text-lg leading-none mt-0.5" role="img">
                                {BIAS_ICONS[alert.biasType] || "⚠️"}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{alert.title}</span>
                                    <Badge variant="outline" className={`text-[10px] ${SEVERITY_BADGE[alert.severity]}`}>
                                        {alert.severity}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                        {alert.confidence}% confidence
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {alert.description}
                                </p>
                            </div>
                        </div>

                        {/* Expand / Collapse */}
                        <div className="flex items-center gap-1 mt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => setExpanded(prev => ({ ...prev, [alert.id]: !isExpanded }))}
                            >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {isExpanded ? "Less" : "Details"}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground ml-auto"
                                onClick={() => dismissMutation.mutate({ alertId: alert.id })}
                                disabled={dismissMutation.isPending}
                            >
                                <X className="h-3 w-3" />
                                Dismiss
                            </Button>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                                {/* Intervention */}
                                <div className="flex gap-2 p-2 rounded bg-primary/5 border border-primary/20">
                                    <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-medium text-primary">Recommended Action</p>
                                        <p className="text-xs text-foreground mt-0.5">{alert.intervention}</p>
                                    </div>
                                </div>

                                {/* Evidence Points */}
                                {alert.evidencePoints && (alert.evidencePoints as any[]).length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                            Evidence
                                        </p>
                                        <div className="space-y-1">
                                            {(alert.evidencePoints as any[]).map((ep: any, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-xs p-1.5 rounded bg-secondary/10">
                                                    <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="font-medium text-foreground">{ep.label}: </span>
                                                        <span className="text-muted-foreground">{ep.value}</span>
                                                        {ep.deviation && (
                                                            <span className="text-amber-400 ml-1">— {ep.deviation}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Math Explanation */}
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
    );
}
