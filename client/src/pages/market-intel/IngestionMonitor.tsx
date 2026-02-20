import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  Zap,
  Play,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  Globe,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";

export default function IngestionMonitor() {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [detailRunId, setDetailRunId] = useState<string | null>(null);

  const { data: status, refetch: refetchStatus } = trpc.ingestion.getStatus.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.ingestion.getHistory.useQuery({ limit: 20, offset: 0 });
  const { data: sources } = trpc.ingestion.getAvailableSources.useQuery();
  const { data: runDetail } = trpc.ingestion.getRunDetail.useQuery(
    { runId: detailRunId! },
    { enabled: !!detailRunId }
  );

  const runAllMutation = trpc.ingestion.runAll.useMutation({
    onMutate: () => setIsRunning(true),
    onSuccess: (report) => {
      setIsRunning(false);
      toast.success(
        `Ingestion complete: ${report.sourcesSucceeded}/${report.sourcesAttempted} sources, ${report.evidenceCreated} records created`
      );
      refetchStatus();
      refetchHistory();
    },
    onError: (e) => {
      setIsRunning(false);
      toast.error(`Ingestion failed: ${e.message}`);
    },
  });

  const runSourceMutation = trpc.ingestion.runSource.useMutation({
    onMutate: () => setIsRunning(true),
    onSuccess: (report) => {
      setIsRunning(false);
      toast.success(
        `Source ingestion complete: ${report.evidenceCreated} records created`
      );
      refetchStatus();
      refetchHistory();
    },
    onError: (e) => {
      setIsRunning(false);
      toast.error(`Source ingestion failed: ${e.message}`);
    },
  });

  const handleRunAll = () => {
    if (isRunning) return;
    runAllMutation.mutate();
  };

  const handleRunSource = () => {
    if (isRunning || !selectedSource) return;
    runSourceMutation.mutate({ sourceId: selectedSource });
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleString();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "running": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "failed": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const renderSourceBreakdown = (breakdown: unknown) => {
    if (!breakdown || !Array.isArray(breakdown) || breakdown.length === 0) return null;
    const items = breakdown as Array<{ sourceId: string; name: string; status: string; extracted: number; inserted: number; duplicates: number; error?: string }>;
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">Source Breakdown</h3>
        <div className="space-y-2">
          {items.map((src, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded border border-border/30 text-sm"
            >
              <div className="flex items-center gap-2">
                {src.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-medium">{src.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Extracted: {src.extracted}</span>
                <span>Inserted: {src.inserted}</span>
                <span>Duplicates: {src.duplicates}</span>
                {src.error && (
                  <span className="text-red-400 max-w-[200px] truncate" title={src.error}>
                    {src.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderErrorSummary = (errors: unknown) => {
    if (!errors || !Array.isArray(errors) || errors.length === 0) return null;
    const items = errors as Array<{ sourceId: string; sourceName?: string; error: string }>;
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2 text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" />
          Errors
        </h3>
        <div className="space-y-1">
          {items.map((err, i) => (
            <div key={i} className="text-xs text-red-300 p-2 rounded bg-red-500/5 border border-red-500/10">
              <span className="font-medium">{err.sourceName || err.sourceId}:</span> {err.error}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400" />
              Ingestion Monitor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live Market Ingestion Engine — automated evidence collection from {status?.availableSources ?? 12} UAE sources
            </p>
          </div>
          <Button
            onClick={() => { refetchStatus(); refetchHistory(); }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Database className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Runs</p>
                  <p className="text-2xl font-bold">{status?.totalRuns ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Records Ingested</p>
                  <p className="text-2xl font-bold">{status?.totalRecordsIngested ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available Sources</p>
                  <p className="text-2xl font-bold">{status?.availableSources ?? 12}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Clock className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Run</p>
                  <p className="text-sm font-medium">
                    {status?.lastRun ? formatDate(status.lastRun.startedAt) : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Run Controls */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Run Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Run All */}
              <Button
                onClick={handleRunAll}
                disabled={isRunning}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isRunning && runAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Run All Sources Now
              </Button>

              {/* Run Single Source */}
              <div className="flex gap-2 flex-1">
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="flex-1 max-w-xs">
                    <SelectValue placeholder="Select a source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sources?.map((s) => (
                      <SelectItem key={s.sourceId} value={s.sourceId}>
                        {s.sourceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRunSource}
                  disabled={isRunning || !selectedSource}
                  variant="outline"
                >
                  {isRunning && runSourceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Run Source
                </Button>
              </div>
            </div>

            {isRunning && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Ingestion in progress... This may take 30-60 seconds depending on source response times.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Run Summary */}
        {status?.lastRun && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                Last Run Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Run ID</p>
                  <p className="text-sm font-mono">{status.lastRun.runId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusColor(status.lastRun.status)}>
                    {status.lastRun.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sources</p>
                  <p className="text-sm">
                    <span className="text-emerald-400">{status.lastRun.sourcesSucceeded}</span>
                    {" / "}
                    {status.lastRun.totalSources}
                    {status.lastRun.sourcesFailed > 0 && (
                      <span className="text-red-400 ml-1">({status.lastRun.sourcesFailed} failed)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Records Created</p>
                  <p className="text-sm font-bold text-emerald-400">{status.lastRun.recordsInserted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
                  <p className="text-sm">{status.lastRun.duplicatesSkipped}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm">{formatDuration(status.lastRun.durationMs)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingestion History */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                Ingestion History
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {history?.total ?? 0} total runs
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {(!history?.runs || history.runs.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No ingestion runs yet. Click "Run All Sources Now" to start.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Run ID</th>
                      <th className="text-left py-2 px-3 font-medium">Trigger</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-right py-2 px-3 font-medium">Sources</th>
                      <th className="text-right py-2 px-3 font-medium">Records</th>
                      <th className="text-right py-2 px-3 font-medium">Duplicates</th>
                      <th className="text-right py-2 px-3 font-medium">Duration</th>
                      <th className="text-left py-2 px-3 font-medium">Started</th>
                      <th className="text-center py-2 px-3 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.runs.map((run: any) => (
                      <tr key={run.id} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 px-3 font-mono text-xs">{run.runId}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-xs">
                            {run.trigger}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <Badge className={statusColor(run.status)}>
                            {run.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {run.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                            {run.status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            {run.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-emerald-400">{run.sourcesSucceeded}</span>
                          /{run.totalSources}
                          {run.sourcesFailed > 0 && (
                            <span className="text-red-400 ml-1">({run.sourcesFailed}✗)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{run.recordsInserted}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{run.duplicatesSkipped}</td>
                        <td className="py-2 px-3 text-right">{formatDuration(run.durationMs)}</td>
                        <td className="py-2 px-3 text-xs">{formatDate(run.startedAt)}</td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailRunId(run.runId)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Sources */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Registered Source Connectors ({sources?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sources?.map((s) => (
                <div
                  key={s.sourceId}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/20"
                >
                  <div className="p-1.5 rounded bg-blue-500/10">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.sourceName}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{s.sourceId}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Run Detail Dialog */}
        <Dialog open={!!detailRunId} onOpenChange={(open) => !open && setDetailRunId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Run Detail: {runDetail?.runId}
              </DialogTitle>
            </DialogHeader>
            {runDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={statusColor(runDetail.status)}>{runDetail.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trigger</p>
                    <p>{runDetail.trigger}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p>{formatDate(runDetail.startedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p>{formatDate(runDetail.completedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p>{formatDuration(runDetail.durationMs)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Records Extracted</p>
                    <p>{runDetail.recordsExtracted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Records Inserted</p>
                    <p className="font-bold text-emerald-400">{runDetail.recordsInserted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
                    <p>{runDetail.duplicatesSkipped}</p>
                  </div>
                </div>

                {renderSourceBreakdown(runDetail.sourceBreakdown)}
                {renderErrorSummary(runDetail.errorSummary)}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
