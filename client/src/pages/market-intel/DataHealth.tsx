
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { Activity, ShieldAlert, HeartPulse, Clock, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DataHealth() {
    const { data: stats, isLoading } = trpc.marketIntel.dataHealth.useQuery();

    return (
        <>
            <div className="p-8 max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <HeartPulse className="h-8 w-8 text-primary" />
                        Data Freshness Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Monitor the staleness, source health, and recent data anomalies across all pipelines.
                    </p>
                </div>

                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : stats ? (
                    <>
                        {/* Source Health Overview */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.sourceHealth.total}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Active Pipelines</CardTitle>
                                    <HeartPulse className="h-4 w-4 text-emerald-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.sourceHealth.active}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Failing Sources</CardTitle>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-amber-500">{stats.sourceHealth.failing}</div>
                                    {stats.sourceHealth.failing > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Disabled Sources</CardTitle>
                                    <ShieldAlert className="h-4 w-4 text-destructive" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-destructive">{stats.sourceHealth.disabled}</div>
                                    {stats.sourceHealth.disabled > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">&ge; 5 consecutive failures</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Coverage Gaps & Staleness Alerts */}
                            <Card className="md:col-span-2 border-amber-500/30">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                                        Coverage Gaps &amp; Staleness Alerts
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {stats.coverageGaps.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">All tracked categories have sufficient, fresh data.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {stats.coverageGaps.map((gap: any) => (
                                                <div key={gap.category} className="flex items-center justify-between p-4 border rounded-lg bg-amber-500/5">
                                                    <div>
                                                        <p className="font-medium">{gap.category}</p>
                                                        <div className="flex gap-4 mt-1">
                                                            <span className="text-xs text-muted-foreground">Records: {gap.count}</span>
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> Avg Age: {gap.avgAgeDays} days
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500">
                                                        Action Required
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Category Freshness */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Category Freshness</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {Object.entries(stats.categoryStats).slice(0, 10).map(([cat, stat]: [string, any]) => (
                                            <div key={cat} className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium">{cat}</p>
                                                    <p className="text-xs text-muted-foreground">{stat.count} records</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium">{Math.round(stat.avgAgeDays)} days avg age</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Latest: {stat.latestCapture ? formatDistanceToNow(new Date(stat.latestCapture), { addSuffix: true }) : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Price Change Feed */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Price Anomalies</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {stats.recentPriceChanges.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No recent price anomalies detected.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {stats.recentPriceChanges.map((event: any) => (
                                                <div key={event.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                                                    <div>
                                                        <p className="text-sm font-medium truncate max-w-[200px]" title={event.itemName}>{event.itemName}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            {event.severity === 'significant' ? <AlertTriangle className="h-3 w-3 text-destructive" /> : null}
                                                            {event.severity} severity
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`flex items-center justify-end gap-1 text-sm font-medium ${event.changeDirection === 'increased' ? 'text-destructive' : 'text-emerald-500'}`}>
                                                            {event.changeDirection === 'increased' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                            {Math.abs(parseFloat(event.changePct)).toFixed(1)}%
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {event.detectedAt ? formatDistanceToNow(new Date(event.detectedAt), { addSuffix: true }) : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>
        </>
    );
}
