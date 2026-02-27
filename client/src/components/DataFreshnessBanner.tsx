/**
 * DataFreshnessBanner — Phase A.4: Data Freshness Indicators
 *
 * A compact, inline banner showing how current the market data is.
 * Collapses into a single line showing overall status + expandable detail.
 *
 * Usage:
 *   <DataFreshnessBanner />               // default: compact strip
 *   <DataFreshnessBanner expanded />       // show per-source detail
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Globe,
    Loader2,
    RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
    expanded?: boolean;
    className?: string;
}

type HealthLevel = "healthy" | "aging" | "degraded";
type FreshnessLevel = "fresh" | "aging" | "stale" | "unknown";

const HEALTH_CONFIG: Record<HealthLevel, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    healthy: { label: "Data Fresh", color: "text-emerald-400", icon: CheckCircle2 },
    aging: { label: "Data Aging", color: "text-amber-400", icon: AlertTriangle },
    degraded: { label: "Data Stale", color: "text-red-400", icon: XCircle },
};

const FRESHNESS_DOT: Record<FreshnessLevel, string> = {
    fresh: "bg-emerald-400",
    aging: "bg-amber-400",
    stale: "bg-red-400",
    unknown: "bg-muted-foreground/40",
};

const FRESHNESS_LABEL: Record<FreshnessLevel, string> = {
    fresh: "Fresh",
    aging: "Aging",
    stale: "Stale",
    unknown: "No data",
};

function formatRelative(date: string | Date | null): string {
    if (!date) return "Never";
    const d = new Date(date);
    const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DataFreshnessBanner({ expanded: defaultExpanded = false, className = "" }: Props) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    const { data, isLoading } = trpc.design.getDataFreshness.useQuery(undefined, {
        staleTime: 5 * 60 * 1000, // cache for 5 min
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return (
            <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking data freshness…</span>
            </div>
        );
    }

    if (!data) return null;

    const health = (data.overallHealth as HealthLevel) ?? "degraded";
    const conf = HEALTH_CONFIG[health];
    const HealthIcon = conf.icon;

    return (
        <div className={`rounded-lg border border-border/50 bg-secondary/20 ${className}`}>
            {/* Compact strip */}
            <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/40 transition-colors rounded-lg"
            >
                <HealthIcon className={`h-3.5 w-3.5 ${conf.color} shrink-0`} />
                <span className={`font-medium ${conf.color}`}>{conf.label}</span>
                <span className="text-muted-foreground">·</span>

                {/* Mini dots summary */}
                <div className="flex items-center gap-1">
                    {data.freshCount > 0 && (
                        <span className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-muted-foreground">{data.freshCount}</span>
                        </span>
                    )}
                    {data.agingCount > 0 && (
                        <span className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span className="text-muted-foreground">{data.agingCount}</span>
                        </span>
                    )}
                    {data.staleCount > 0 && (
                        <span className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span className="text-muted-foreground">{data.staleCount}</span>
                        </span>
                    )}
                </div>

                <span className="text-muted-foreground ml-auto">
                    {data.totalSources} source{data.totalSources !== 1 ? "s" : ""}
                </span>

                {/* Latest run info */}
                {data.latestRun && (
                    <>
                        <span className="text-muted-foreground">·</span>
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                            Last run {formatRelative(data.latestRun.startedAt)}
                        </span>
                    </>
                )}

                {expanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-border/30">
                    {/* Latest run summary */}
                    {data.latestRun && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2 pb-1">
                            <RefreshCw className="h-3 w-3" />
                            <span>
                                Run {data.latestRun.runId?.slice(0, 8)}… —
                                {" "}{data.latestRun.sourcesSucceeded}/{data.latestRun.totalSources} sources OK,
                                {" "}{data.latestRun.recordsExtracted} records extracted
                            </span>
                            <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${data.latestRun.status === "completed" ? "text-emerald-400 border-emerald-500/30"
                                        : data.latestRun.status === "failed" ? "text-red-400 border-red-500/30"
                                            : "text-amber-400 border-amber-500/30"
                                    }`}
                            >
                                {data.latestRun.status}
                            </Badge>
                        </div>
                    )}

                    {/* Per-source rows */}
                    {(data.sources ?? []).map((s: any) => {
                        const freshness = (s.freshness as FreshnessLevel) ?? "unknown";
                        return (
                            <div key={s.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/20 last:border-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${FRESHNESS_DOT[freshness]}`} />
                                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-foreground truncate flex-1">{s.name}</span>
                                <span className="text-muted-foreground text-[10px]">
                                    {s.sourceType?.replace(/_/g, " ")}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1 py-0 ${s.reliabilityGrade === "A" ? "text-emerald-400 border-emerald-500/30"
                                            : s.reliabilityGrade === "B" ? "text-amber-400 border-amber-500/30"
                                                : "text-red-400 border-red-500/30"
                                        }`}
                                >
                                    {s.reliabilityGrade}
                                </Badge>
                                <span className={`text-[10px] w-12 text-right ${freshness === "fresh" ? "text-emerald-400"
                                        : freshness === "aging" ? "text-amber-400"
                                            : freshness === "stale" ? "text-red-400"
                                                : "text-muted-foreground"
                                    }`}>
                                    {s.daysSince !== null ? `${s.daysSince}d` : "—"}
                                </span>
                            </div>
                        );
                    })}

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-[9px] text-muted-foreground/50 pt-1">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ≤7d</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 8–30d</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> &gt;30d</span>
                        <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> MIYAR Data Authority Engine</span>
                    </div>
                </div>
            )}
        </div>
    );
}
