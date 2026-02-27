import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ClipboardList, Loader2, Download, ChevronDown, Shield, Database,
  Sparkles, AlertTriangle, Settings, Eye,
} from "lucide-react";
import { useState, useMemo } from "react";

// ─── Action Icon & Color Mapping ────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: typeof ClipboardList; color: string; label: string }> = {
  "benchmark.create": { icon: Database, color: "text-emerald-400 bg-emerald-500/10", label: "Benchmark Created" },
  "benchmark.delete": { icon: Database, color: "text-red-400 bg-red-500/10", label: "Benchmark Deleted" },
  "benchmark.csv_import": { icon: Database, color: "text-blue-400 bg-blue-500/10", label: "CSV Import" },
  "benchmark.seed": { icon: Sparkles, color: "text-amber-400 bg-amber-500/10", label: "Benchmark Seeded" },
  "benchmark.synthetic_generate": { icon: Sparkles, color: "text-purple-400 bg-purple-500/10", label: "Synthetic Generated" },
  "benchmark_version.create": { icon: Database, color: "text-blue-400 bg-blue-500/10", label: "Version Created" },
  "benchmark_version.publish": { icon: Shield, color: "text-emerald-400 bg-emerald-500/10", label: "Version Published" },
  "benchmark_category.create": { icon: Database, color: "text-cyan-400 bg-cyan-500/10", label: "Category Created" },
  "benchmark_category.update": { icon: Settings, color: "text-amber-400 bg-amber-500/10", label: "Category Updated" },
  "benchmark_category.delete": { icon: Database, color: "text-red-400 bg-red-500/10", label: "Category Deleted" },
  "override.create": { icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10", label: "Override Created" },
  "pricing.sync_materials": { icon: Settings, color: "text-blue-400 bg-blue-500/10", label: "Pricing Synced" },
  "model_version.create": { icon: Settings, color: "text-purple-400 bg-purple-500/10", label: "Model Version Created" },
  "roi_config.create": { icon: Settings, color: "text-cyan-400 bg-cyan-500/10", label: "ROI Config Created" },
  "roi_config.update": { icon: Settings, color: "text-cyan-400 bg-cyan-500/10", label: "ROI Config Updated" },
  "webhook.create": { icon: Settings, color: "text-blue-400 bg-blue-500/10", label: "Webhook Created" },
  "webhook.update": { icon: Settings, color: "text-blue-400 bg-blue-500/10", label: "Webhook Updated" },
  "webhook.delete": { icon: Settings, color: "text-red-400 bg-red-500/10", label: "Webhook Deleted" },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || {
    icon: ClipboardList,
    color: "text-muted-foreground bg-muted",
    label: action,
  };
}

function AuditLogsContent() {
  const { data: logs, isLoading } = trpc.admin.auditLogs.list.useQuery({});
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Derive unique action types and entity types
  const { actionTypes, entityTypes } = useMemo(() => {
    if (!logs) return { actionTypes: [] as string[], entityTypes: [] as string[] };
    const actions = Array.from(new Set(logs.map((l: any) => l.action as string))).sort() as string[];
    const entities = Array.from(new Set(logs.map((l: any) => l.entityType as string).filter((e: string) => !!e))).sort() as string[];
    return { actionTypes: actions, entityTypes: entities };
  }, [logs]);

  // Filtered logs
  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log: any) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (entityFilter !== "all" && log.entityType !== entityFilter) return false;
      return true;
    });
  }, [logs, actionFilter, entityFilter]);

  // CSV export
  const handleExport = () => {
    if (!filtered.length) return;
    const headers = ["Time", "Action", "Entity Type", "Entity ID", "User", "Details"];
    const rows = filtered.map((log: any) => [
      new Date(log.createdAt).toISOString(),
      log.action,
      log.entityType || "",
      log.entityId || "",
      log.user?.email || log.userId || "System",
      log.details ? JSON.stringify(log.details) : "",
    ]);
    const csv = [headers, ...rows].map((r: string[]) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `miyar-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete audit trail of all system actions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter action..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map((a: string) => (
              <SelectItem key={a} value={a}>{getActionConfig(a).label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter entity..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entityTypes.map((e: string) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(actionFilter !== "all" || entityFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setActionFilter("all"); setEntityFilter("all"); }}
          >
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {logs?.length || 0} entries
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No audit logs match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Recent Actions ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {filtered.map((log: any) => {
                const config = getActionConfig(log.action);
                const IconComp = config.icon;
                const isExpanded = expandedId === log.id;
                const hasDetails = log.details && Object.keys(log.details).length > 0;

                return (
                  <div key={log.id}>
                    <div
                      className={`flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 ${hasDetails ? "cursor-pointer hover:bg-secondary/30" : ""
                        } ${isExpanded ? "bg-secondary/20 rounded-b-none" : ""}`}
                      onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.color.split(" ")[1]}`}>
                          <IconComp className={`h-4 w-4 ${config.color.split(" ")[0]}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {config.label}
                            </p>
                            {log.entityId && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                #{log.entityId}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {log.entityType || "system"}
                            {" · "}
                            {log.user?.email || `User ${log.userId || "System"}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                        {hasDetails && (
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </div>
                    {isExpanded && hasDetails && (
                      <div className="border border-t-0 border-border/50 rounded-b-lg p-4 bg-secondary/10">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Eye className="h-3 w-3" />
                          Details
                        </div>
                        <pre className="text-xs text-foreground bg-background/50 rounded p-3 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AuditLogs() {
  return (
    <DashboardLayout>
      <AuditLogsContent />
    </DashboardLayout>
  );
}
