import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Loader2 } from "lucide-react";

function AuditLogsContent() {
  const { data: logs, isLoading } = trpc.admin.auditLogs.list.useQuery({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete audit trail of all system actions
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No audit logs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Recent Actions ({logs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {log.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.entityType}
                        {log.entityId ? ` #${log.entityId}` : ""} · User:{" "}
                        {log.user?.email || `ID ${log.userId || "System"}`}
                        {log.orgId ? ` (Org #${log.orgId})` : " (Global)"}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
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
