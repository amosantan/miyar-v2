import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
    Bell,
    AlertTriangle,
    AlertCircle,
    Info,
    CheckCircle2,
    ShieldCheck,
    Filter
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function Alerts() {
    const [statusFilter, setStatusFilter] = useState<string>("active");
    const [severityFilter, setSeverityFilter] = useState<string>("all");

    const queryParams: any = {};
    if (statusFilter !== "all") queryParams.status = statusFilter;
    if (severityFilter !== "all") queryParams.severity = severityFilter;

    const { data: alerts = [], isLoading, refetch } = trpc.autonomous.getAlerts.useQuery(queryParams);

    const acknowledgeMutation = trpc.autonomous.acknowledgeAlert.useMutation({
        onSuccess: () => {
            toast.success("Alert acknowledged");
            refetch();
        },
    });

    const resolveMutation = trpc.autonomous.resolveAlert.useMutation({
        onSuccess: () => {
            toast.success("Alert resolved");
            refetch();
        },
    });

    const getIconForSeverity = (severity: string) => {
        switch (severity) {
            case "critical":
                return <AlertTriangle className="h-5 w-5 text-destructive" />;
            case "high":
                return <AlertTriangle className="h-5 w-5 text-orange-500" />;
            case "medium":
                return <AlertCircle className="h-5 w-5 text-amber-500" />;
            case "info":
                return <Info className="h-5 w-5 text-blue-500" />;
            default:
                return <Info className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case "active": return "destructive";
            case "acknowledged": return "secondary";
            case "resolved": return "outline";
            default: return "default";
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Notification Centre</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage and review autonomous system alerts.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-card border rounded-md p-1">
                        <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Select value={severityFilter} onValueChange={setSeverityFilter}>
                            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0">
                                <SelectValue placeholder="Severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                ) : alerts.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <div className="h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center mb-4">
                            <Bell className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-xl mb-2">No alerts found</CardTitle>
                        <CardDescription>
                            There are no alerts matching your current filter criteria.
                        </CardDescription>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {alerts.map((alert: any) => (
                            <Card key={alert.id} className="overflow-hidden transition-all hover:shadow-md">
                                <div className={`h-1 w-full ${alert.severity === 'critical' ? 'bg-destructive' :
                                    alert.severity === 'high' ? 'bg-orange-500' :
                                        alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                                    }`} />
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 bg-accent/50 p-2 rounded-full">
                                                {getIconForSeverity(alert.severity)}
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg leading-tight mb-1">
                                                    {alert.title}
                                                </CardTitle>
                                                <CardDescription className="flex items-center gap-2 mt-2">
                                                    <Badge variant={getStatusBadgeVariant(alert.status)}>
                                                        {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                                                    </Badge>
                                                    <span className="text-xs">
                                                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                                    </span>
                                                </CardDescription>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {alert.status === "active" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => acknowledgeMutation.mutate({ id: alert.id })}
                                                    disabled={acknowledgeMutation.isPending}
                                                >
                                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                                    Acknowledge
                                                </Button>
                                            )}
                                            {(alert.status === "active" || alert.status === "acknowledged") && (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => resolveMutation.mutate({ id: alert.id })}
                                                    disabled={resolveMutation.isPending}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Resolve
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-foreground/90 whitespace-pre-wrap ml-12">
                                        {alert.message}
                                    </p>

                                    {alert.affectedProjectIds && Array.isArray(alert.affectedProjectIds) && alert.affectedProjectIds.length > 0 && (
                                        <div className="mt-4 ml-12 flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-muted-foreground mr-1">AFFECTED PROJECTS:</span>
                                            {alert.affectedProjectIds.map((pid: number) => (
                                                <Badge key={pid} variant="outline" className="text-xs">
                                                    Project #{pid}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                                        <div className="mt-4 ml-12 bg-accent/30 rounded p-3 text-xs font-mono text-muted-foreground overflow-auto">
                                            {JSON.stringify(alert.metadata, null, 2)}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
