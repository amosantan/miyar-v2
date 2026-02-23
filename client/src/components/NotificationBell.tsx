import { Bell, AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NotificationBell() {
    const [, setLocation] = useLocation();

    const { data: alerts = [], isLoading } = trpc.autonomous.getAlerts.useQuery(
        { status: "active" },
        { refetchInterval: 60000 } // poll every 60s
    );

    const activeAlerts = alerts;

    const hasCritical = activeAlerts.some((a: any) => a.severity === "critical");
    const hasHigh = activeAlerts.some((a: any) => a.severity === "high");
    const criticalOrHighCount = activeAlerts.filter(
        (a: any) => a.severity === "critical" || a.severity === "high"
    ).length;

    const getIconForSeverity = (severity: string) => {
        switch (severity) {
            case "critical":
                return <AlertTriangle className="h-4 w-4 text-destructive" />;
            case "high":
                return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case "medium":
                return <AlertCircle className="h-4 w-4 text-amber-500" />;
            case "info":
                return <Info className="h-4 w-4 text-blue-500" />;
            default:
                return <Info className="h-4 w-4 text-muted-foreground" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 border border-border">
                    <Bell className="h-4 w-4 text-foreground" />
                    {criticalOrHighCount > 0 && (
                        <span
                            className={cn(
                                "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                                hasCritical ? "bg-destructive" : "bg-orange-500"
                            )}
                        >
                            {criticalOrHighCount > 99 ? "99+" : criticalOrHighCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0">
                <DropdownMenuLabel className="p-3 font-semibold flex items-center justify-between">
                    <span>Notifications</span>
                    <Badge variant="secondary">{activeAlerts.length} Active</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <ScrollArea className="max-h-[350px]">
                    {activeAlerts.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                            <Bell className="h-8 w-8 text-muted/30" />
                            <p>You have no active alerts.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {activeAlerts.slice(0, 10).map((alert: any) => (
                                <DropdownMenuItem
                                    key={alert.id}
                                    className="flex flex-col items-start gap-1 p-3 cursor-pointer focus:bg-accent rounded-none border-b border-border/50 last:border-0"
                                    onClick={() => setLocation("/alerts")}
                                >
                                    <div className="flex items-start gap-3 w-full">
                                        <div className="mt-0.5 shrink-0">
                                            {getIconForSeverity(alert.severity)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-none mb-1 line-clamp-2">
                                                {alert.title}
                                            </p>
                                            {alert.affectedProjectIds &&
                                                Array.isArray(alert.affectedProjectIds) &&
                                                alert.affectedProjectIds.length === 1 && (
                                                    <p className="text-xs text-muted-foreground mb-1">
                                                        Project #{alert.affectedProjectIds[0]}
                                                    </p>
                                                )}
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <DropdownMenuSeparator className="m-0" />
                <div className="p-2">
                    <Button
                        variant="ghost"
                        className="w-full justify-center text-xs text-primary"
                        onClick={() => setLocation("/alerts")}
                    >
                        View all alerts
                        <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
