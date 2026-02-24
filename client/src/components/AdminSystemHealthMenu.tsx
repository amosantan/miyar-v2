import { Activity, Database, Server, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function AdminSystemHealthMenu() {
    const { data: health, isLoading } = trpc.admin.healthCheck.useQuery(undefined, {
        refetchInterval: 30000, // Poll every 30s
    });

    if (isLoading || !health) {
        return (
            <Button variant="ghost" size="icon" className="w-9 h-9 opacity-50">
                <Activity className="h-4 w-4 animate-pulse" />
            </Button>
        );
    }

    const isHealthy = health.status === "healthy";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "w-9 h-9 relative",
                        !isHealthy && "text-destructive hover:text-destructive"
                    )}
                >
                    <Activity className="h-4 w-4" />
                    {!isHealthy && (
                        <span className="absolute top-2 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
                <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                    <span className="text-sm font-semibold">System Status</span>
                    {isHealthy ? (
                        <span className="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Healthy
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Degraded
                        </span>
                    )}
                </div>
                <DropdownMenuSeparator />

                <div className="space-y-1 p-1">
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Database className="h-4 w-4" />
                            <span>Database</span>
                        </div>
                        <span className={health.services.database === "online" ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                            {health.services.database}
                        </span>
                    </div>

                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Server className="h-4 w-4" />
                            <span>LLM Engine</span>
                        </div>
                        <span className={health.services.llm === "online" ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                            {health.services.llm}
                        </span>
                    </div>

                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Scheduler</span>
                        </div>
                        <span className={health.services.scheduler === "online" ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                            {health.services.scheduler}
                        </span>
                    </div>
                </div>

                <DropdownMenuSeparator />

                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded-md mt-1">
                    <div className="flex justify-between mb-1">
                        <span>Memory Usage:</span>
                        <span>{Math.round(health.metrics.memoryUsage)} MB</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Uptime:</span>
                        <span>{Math.floor(health.metrics.uptime / 60)}m</span>
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
