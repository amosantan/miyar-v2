/**
 * ConnectorHealth — Phase B.2: Connector Health Dashboard
 *
 * Admin page that surfaces the full health of MIYAR's data ingestion pipeline:
 *   - Overall pipeline status (scheduler state, total runs, records ingested)
 *   - Per-source health grid (success rate, response time, freshness)
 *   - Recent run history timeline
 *   - Ability to trigger manual ingestion per source
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Activity,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Globe,
    Loader2,
    RefreshCw,
    Zap,
    Server,
    ArrowRight,
    BarChart3,
    Database,
    Wifi,
    WifiOff,
    Timer,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatMs(ms: number | null | undefined): string {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(date: string | Date | null | undefined): string {
    if (!date) return "Never";
    const d = new Date(date);
    const mins = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function successRate(s: number, t: number): string {
    if (t === 0) return "—";
    return `${Math.round((s / t) * 100)}%`;
}

function successColor(rate: number): string {
    if (rate >= 80) return "text-emerald-400";
    if (rate >= 50) return "text-amber-400";
    return "text-red-400";
}

// ─── Page ────────────────────────────────────────────────────────────────────
function ConnectorHealthContent() {
    const [expandedSource, setExpandedSource] = useState<string | null>(null);

    // Queries
    const { data: status, isLoading: statusLoading } = trpc.ingestion.getStatus.useQuery();
    const { data: historyData, isLoading: historyLoading } = trpc.ingestion.getHistory.useQuery({ limit: 10 });
    const { data: healthSummary, isLoading: healthLoading } = trpc.ingestion.getHealthSummary.useQuery();
    const { data: availableSources } = trpc.ingestion.getAvailableSources.useQuery();

    // Mutations
    const runAllMut = trpc.ingestion.runAll.useMutation({
        onSuccess: () => toast.success("Ingestion started for all sources"),
        onError: (err) => toast.error(`Ingestion failed: ${err.message}`),
    });
    const runSourceMut = trpc.ingestion.runSource.useMutation({
        onSuccess: () => toast.success("Source ingestion started"),
        onError: (err) => toast.error(`Source ingestion failed: ${err.message}`),
    });

    const utils = trpc.useUtils();

    const refreshAll = () => {
        utils.ingestion.getStatus.invalidate();
        utils.ingestion.getHistory.invalidate();
        utils.ingestion.getHealthSummary.invalidate();
        toast.success("Refreshing data...");
    };

    // Derived data
    const runs = historyData?.runs ?? [];
    const sources = (healthSummary as any)?.sources ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" />
                        Connector Health Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Live health monitoring for MIYAR's data ingestion pipeline
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => runAllMut.mutate()}
                        disabled={runAllMut.isPending}
                        className="gap-1"
                    >
                        {runAllMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        Run All Sources
                    </Button>
                </div>
            </div>

            {/* Pipeline Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {statusLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                        <Card key={i}><CardContent className="pt-5 pb-4"><div className="h-12 animate-pulse bg-muted/50 rounded" /></CardContent></Card>
                    ))
                ) : (
                    <>
                        <Card className={status?.scheduler?.active ? "border-emerald-500/30" : "border-red-500/30"}>
                            <CardContent className="pt-5 pb-4 px-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Scheduler</p>
                                        <p className={`text-lg font-bold mt-0.5 ${status?.scheduler?.active ? "text-emerald-400" : "text-red-400"}`}>
                                            {status?.scheduler?.active ? "Active" : "Stopped"}
                                        </p>
                                    </div>
                                    {status?.scheduler?.active ? <Wifi className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-red-400" />}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-5 pb-4 px-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Runs</p>
                                        <p className="text-lg font-bold text-foreground mt-0.5">{status?.totalRuns ?? 0}</p>
                                    </div>
                                    <Server className="h-5 w-5 text-primary" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-5 pb-4 px-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Records Ingested</p>
                                        <p className="text-lg font-bold text-foreground mt-0.5">{(status?.totalRecordsIngested ?? 0).toLocaleString()}</p>
                                    </div>
                                    <Database className="h-5 w-5 text-primary" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-5 pb-4 px-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sources</p>
                                        <p className="text-lg font-bold text-foreground mt-0.5">{status?.availableSources ?? 0}</p>
                                    </div>
                                    <Globe className="h-5 w-5 text-primary" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-5 pb-4 px-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Run</p>
                                        <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                                            {status?.scheduler?.nextScheduledRun
                                                ? formatRelative(status.scheduler.nextScheduledRun)
                                                : "Not scheduled"}
                                        </p>
                                    </div>
                                    <Clock className="h-5 w-5 text-primary" />
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Source Health Grid */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Source Health Grid
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                            {sources.length} connector{sources.length !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {healthLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-muted/50 rounded-lg" />)}
                        </div>
                    ) : sources.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No connector health data available. Run an ingestion to populate.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {/* Header row */}
                            <div className="grid grid-cols-12 gap-2 text-[10px] text-muted-foreground uppercase tracking-wider px-3 py-1">
                                <span className="col-span-3">Source</span>
                                <span className="col-span-1 text-center">Status</span>
                                <span className="col-span-2 text-center">Success Rate</span>
                                <span className="col-span-1 text-center">Runs</span>
                                <span className="col-span-2 text-center">Avg Response</span>
                                <span className="col-span-2 text-center">Last Run</span>
                                <span className="col-span-1 text-center">Action</span>
                            </div>

                            {sources.map((s: any) => {
                                const rate = s.totalRuns > 0 ? (s.successes / s.totalRuns) * 100 : 0;
                                const isExpanded = expandedSource === s.sourceId;

                                return (
                                    <div key={s.sourceId}>
                                        <div
                                            className={`grid grid-cols-12 gap-2 items-center rounded-lg border px-3 py-2.5 transition-colors cursor-pointer hover:bg-secondary/30 ${isExpanded ? "border-primary/30 bg-secondary/20" : "border-border/50"
                                                }`}
                                            onClick={() => setExpandedSource(isExpanded ? null : s.sourceId)}
                                        >
                                            {/* Source Name */}
                                            <div className="col-span-3 flex items-center gap-2">
                                                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <span className="text-xs font-medium text-foreground truncate">{s.sourceName}</span>
                                            </div>

                                            {/* Status dot */}
                                            <div className="col-span-1 flex justify-center">
                                                {s.latestStatus === "success" ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                                ) : s.latestStatus === "partial" ? (
                                                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                                                ) : s.latestStatus === "failed" ? (
                                                    <XCircle className="h-4 w-4 text-red-400" />
                                                ) : (
                                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                                )}
                                            </div>

                                            {/* Success Rate */}
                                            <div className="col-span-2 text-center">
                                                <span className={`text-xs font-mono font-bold ${successColor(rate)}`}>
                                                    {successRate(s.successes, s.totalRuns)}
                                                </span>
                                            </div>

                                            {/* Total Runs */}
                                            <div className="col-span-1 text-center">
                                                <span className="text-xs text-muted-foreground font-mono">{s.totalRuns}</span>
                                            </div>

                                            {/* Avg Response Time */}
                                            <div className="col-span-2 text-center">
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {formatMs(s.avgResponseTimeMs)}
                                                </span>
                                            </div>

                                            {/* Last Run */}
                                            <div className="col-span-2 text-center">
                                                <span className="text-xs text-muted-foreground">
                                                    {s.lastRunAt ? formatRelative(s.lastRunAt) : "Never"}
                                                </span>
                                            </div>

                                            {/* Action */}
                                            <div className="col-span-1 flex justify-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    disabled={runSourceMut.isPending}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        runSourceMut.mutate({ sourceId: s.sourceId });
                                                    }}
                                                >
                                                    {runSourceMut.isPending ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="h-3 w-3 text-primary" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className="ml-4 mt-1 mb-2 p-3 rounded-lg border border-border/30 bg-secondary/10 space-y-2">
                                                <div className="grid grid-cols-4 gap-3 text-xs">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase">Successes</p>
                                                        <p className="font-mono text-emerald-400">{s.successes}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase">Partials</p>
                                                        <p className="font-mono text-amber-400">{s.partials}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase">Failures</p>
                                                        <p className="font-mono text-red-400">{s.failures}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase">Records</p>
                                                        <p className="font-mono text-foreground">{(s.totalRecordsExtracted ?? 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                {s.lastErrorMessage && (
                                                    <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/10 rounded px-2 py-1.5">
                                                        <span className="font-semibold">Last error:</span> {s.lastErrorMessage}
                                                    </div>
                                                )}
                                                {s.lastErrorType && (
                                                    <Badge variant="outline" className="text-[9px] text-red-400 border-red-500/30">
                                                        {s.lastErrorType}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Runs Timeline */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Timer className="h-5 w-5 text-primary" />
                        Recent Ingestion Runs
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {historyLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse bg-muted/50 rounded-lg" />)}
                        </div>
                    ) : runs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No ingestion runs yet. Click "Run All Sources" to start your first ingestion.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {runs.map((run: any) => (
                                <div
                                    key={run.runId}
                                    className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 hover:bg-secondary/20 transition-colors"
                                >
                                    {/* Status icon */}
                                    {run.status === "completed" ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                    ) : run.status === "failed" ? (
                                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    ) : (
                                        <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                                    )}

                                    {/* Run info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-foreground">{run.runId?.slice(0, 12)}…</span>
                                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${run.trigger === "scheduled" ? "text-primary border-primary/30" : "text-muted-foreground"
                                                }`}>
                                                {run.trigger}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {run.sourcesSucceeded ?? 0}/{run.totalSources ?? 0} sources OK
                                            {" · "}{(run.recordsInserted ?? 0).toLocaleString()} records
                                            {run.durationMs ? ` · ${formatMs(run.durationMs)}` : ""}
                                        </p>
                                    </div>

                                    {/* Time */}
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {formatRelative(run.startedAt ?? run.createdAt)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                <Activity className="h-3 w-3" />
                <span>MIYAR Data Authority Engine · {availableSources?.length ?? 0} registered connectors · Pipeline v3</span>
            </div>
        </div>
    );
}

export default function ConnectorHealth() {
    return (
        <>
            <ConnectorHealthContent />
        </>
    );
}
