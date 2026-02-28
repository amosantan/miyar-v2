
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ScrollText, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

const RUN_TYPES = [
  "manual_entry", "price_extraction", "benchmark_proposal",
  "competitor_extraction", "source_seed", "tag_operation",
] as const;

export default function IntelAuditLog() {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: logs, isLoading } = trpc.marketIntel.auditLog.list.useQuery({
    runType: typeFilter !== "all" ? typeFilter : undefined,
    limit: 100,
  });

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete audit trail of all market intelligence operations
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Run Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {RUN_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
        ) : (logs ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No audit entries yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(logs ?? []).map((log: any) => (
              <Card key={log.id} className="bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.runType.replace(/_/g, " ")}
                        </Badge>
                        {log.errors ? (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />Errors
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Success
                          </Badge>
                        )}
                        {log.sourcesProcessed > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {log.sourcesProcessed} sources · {log.recordsExtracted} records
                          </span>
                        )}
                      </div>
                      {log.inputSummary && (
                        <p className="text-xs text-muted-foreground">
                          Input: {typeof log.inputSummary === "string" ? log.inputSummary : JSON.stringify(log.inputSummary)}
                        </p>
                      )}
                      {log.outputSummary && (
                        <p className="text-xs text-muted-foreground">
                          Output: {typeof log.outputSummary === "string" ? log.outputSummary : JSON.stringify(log.outputSummary)}
                        </p>
                      )}
                      {log.errors && (
                        <p className="text-xs text-red-400">{typeof log.errors === "string" ? log.errors : JSON.stringify(log.errors)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.startedAt).toLocaleString()}
                      </div>
                      {log.actor && (
                        <div className="text-xs text-muted-foreground mt-0.5">by {log.actor}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
