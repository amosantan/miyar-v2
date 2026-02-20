/**
 * MIYAR V3-10 — Analytics Intelligence Dashboard
 *
 * 4 panels:
 *   1. Market Trends — category cards with direction/magnitude
 *   2. Market Position Map — tier visualization with budget input
 *   3. Competitor Landscape — HHI, developer shares, concentration
 *   4. Insight Feed — filterable by type/severity, with acknowledge/dismiss
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  Info,
  Target,
  Users,
  Lightbulb,
  RefreshCw,
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import CostForecastingPanel from "@/components/CostForecastingPanel";

// ─── Market Trends Panel ─────────────────────────────────────────

function MarketTrendsPanel() {
  const { data, isLoading } = trpc.analytics.getTrends.useQuery({
    limit: 20,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            Market Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const trends = data?.trends || [];

  // Group by category
  const categories = useMemo(() => {
    const catMap = new Map<string, (typeof trends)>();
    for (const t of trends) {
      const cat = t.category || "other";
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(t);
    }
    return Array.from(catMap.entries());
  }, [trends]);

  const directionIcon = (dir: string | null) => {
    if (dir === "rising") return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (dir === "falling") return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const directionColor = (dir: string | null) => {
    if (dir === "rising") return "text-red-500";
    if (dir === "falling") return "text-green-500";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-500" />
          Market Trends
        </CardTitle>
        <CardDescription>
          {trends.length} trend snapshots across {categories.length} categories
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No trend data available</p>
            <p className="text-sm mt-1">Run an ingestion cycle to generate trend snapshots</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(([category, catTrends]) => (
              <Card key={category} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold capitalize">
                      {category.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {catTrends.length} metrics
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {catTrends.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[60%]">
                          {t.metric}
                        </span>
                        <div className="flex items-center gap-2">
                          {directionIcon(t.direction)}
                          <span className={directionColor(t.direction)}>
                            {t.percentChange
                              ? `${parseFloat(String(t.percentChange)) > 0 ? "+" : ""}${parseFloat(String(t.percentChange)).toFixed(1)}%`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {catTrends.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{catTrends.length - 3} more metrics
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Market Position Panel ───────────────────────────────────────

function MarketPositionPanel() {
  const [targetValue, setTargetValue] = useState("650");

  const parsedValue = parseFloat(targetValue);
  const isValid = !isNaN(parsedValue) && parsedValue > 0;

  const { data, isLoading } = trpc.analytics.getMarketPosition.useQuery(
    {
      targetValue: parsedValue,
      category: "fitout_rate",
      geography: "UAE",
    },
    { enabled: isValid }
  );

  const position = data?.position;

  const tierColor = (tier: string) => {
    switch (tier) {
      case "economy": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "mid_market": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "premium": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "luxury": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-500" />
          Market Position Map
        </CardTitle>
        <CardDescription>
          Enter a fitout rate to see market positioning
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-6">
          <Input
            type="number"
            placeholder="AED/sqm"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="w-40"
          />
          <span className="text-sm text-muted-foreground">AED/sqm fitout rate</span>
        </div>

        {!isValid ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Enter a valid fitout rate to see positioning</p>
          </div>
        ) : isLoading ? (
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
        ) : position ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className={`text-sm px-3 py-1 ${tierColor(position.tier)}`}>
                {position.tier.replace(/_/g, " ").toUpperCase()}
              </Badge>
              <span className="text-lg font-semibold">
                P{Math.round(position.percentile)}
              </span>
            </div>

            {/* Percentile bar */}
            <div className="relative h-8 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-emerald-500 via-amber-500 to-purple-500 opacity-20"
                style={{ width: "100%" }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full"
                style={{ left: `${Math.min(98, Math.max(2, position.percentile))}%` }}
              />
              {/* Tier labels */}
              <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-medium text-muted-foreground">
                <span>Economy</span>
                <span>Mid</span>
                <span>Premium</span>
                <span>Luxury</span>
              </div>
            </div>

            {/* Percentile details */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold">{position.percentiles.p25}</div>
                <div className="text-muted-foreground">P25</div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold">{position.percentiles.p50}</div>
                <div className="text-muted-foreground">P50</div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold">{position.percentiles.p75}</div>
                <div className="text-muted-foreground">P75</div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold">{position.percentiles.p90}</div>
                <div className="text-muted-foreground">P90</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Competitive Index</span>
              <span className="font-semibold">{position.competitiveIndex.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data Points</span>
              <span className="font-semibold">{position.dataPointCount}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No market position data available</p>
            <p className="text-xs mt-1">Ensure evidence records exist for fitout rates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Competitor Landscape Panel ──────────────────────────────────

function CompetitorLandscapePanel() {
  const { data, isLoading } = trpc.analytics.getCompetitorLandscape.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Competitor Landscape
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const landscape = data?.landscape;

  if (!landscape || landscape.totalProjects === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Competitor Landscape
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No competitor data available</p>
            <p className="text-sm mt-1">Add competitor projects to see landscape analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const concentrationColor = (c: string) => {
    if (c === "fragmented") return "text-green-500";
    if (c === "moderate") return "text-amber-500";
    return "text-red-500";
  };

  const threatBadge = (level: string) => {
    if (level === "high") return <Badge variant="destructive" className="text-xs">High</Badge>;
    if (level === "medium") return <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-500">Medium</Badge>;
    return <Badge variant="outline" className="text-xs">Low</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Competitor Landscape
        </CardTitle>
        <CardDescription>
          {landscape.totalProjects} projects from {landscape.totalDevelopers} developers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* HHI Summary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <div className="text-sm text-muted-foreground">Market Concentration (HHI)</div>
            <div className={`text-lg font-bold ${concentrationColor(landscape.concentration)}`}>
              {landscape.concentrationLabel}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold">{landscape.hhi.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">HHI Index</div>
          </div>
        </div>

        {/* Top Developers */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Top Developers</h4>
          <div className="space-y-2">
            {landscape.topDevelopers.map((dev: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded border border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                  <span className="text-sm font-medium">{dev.developerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">
                    {(dev.marketShareByUnits * 100).toFixed(1)}%
                  </span>
                  {threatBadge(dev.threatLevel)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Narrative */}
        {landscape.narrative && (
          <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground italic">
            {landscape.narrative}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Insight Feed Panel ──────────────────────────────────────────

function InsightFeedPanel() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const { data, isLoading, refetch } = trpc.analytics.getProjectInsights.useQuery({
    insightType: typeFilter !== "all" ? typeFilter : undefined,
    severity: severityFilter !== "all" ? severityFilter : undefined,
    status: "active",
    limit: 50,
  });

  const generateMutation = trpc.analytics.generateProjectInsights.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.generated} new insights created`);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateStatusMutation = trpc.analytics.updateInsightStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const severityIcon = (severity: string) => {
    if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (severity === "warning") return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  const severityBorder = (severity: string) => {
    if (severity === "critical") return "border-l-red-500";
    if (severity === "warning") return "border-l-amber-500";
    return "border-l-blue-500";
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cost_pressure: "Cost Pressure",
      market_opportunity: "Market Opportunity",
      competitor_alert: "Competitor Alert",
      trend_signal: "Trend Signal",
      positioning_gap: "Positioning Gap",
    };
    return labels[type] || type;
  };

  const insights = data?.insights || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Insight Feed
            </CardTitle>
            <CardDescription>
              {insights.length} active insights
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate({ enrichWithLLM: true })}
            disabled={generateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            Generate Insights
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="cost_pressure">Cost Pressure</SelectItem>
              <SelectItem value="market_opportunity">Market Opportunity</SelectItem>
              <SelectItem value="competitor_alert">Competitor Alert</SelectItem>
              <SelectItem value="trend_signal">Trend Signal</SelectItem>
              <SelectItem value="positioning_gap">Positioning Gap</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No active insights</p>
            <p className="text-sm mt-1">
              Click "Generate Insights" or run an ingestion cycle to produce insights
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight: any) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border border-l-4 ${severityBorder(insight.severity)} bg-card`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {severityIcon(insight.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{insight.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {typeLabel(insight.insightType)}
                        </Badge>
                      </div>
                      {insight.body && (
                        <p className="text-sm text-muted-foreground mb-2">{insight.body}</p>
                      )}
                      {insight.actionableRecommendation && (
                        <div className="text-sm p-2 rounded bg-muted/50">
                          <span className="font-medium text-foreground">Recommendation: </span>
                          {insight.actionableRecommendation}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Confidence: {insight.confidenceScore ? (parseFloat(String(insight.confidenceScore)) * 100).toFixed(0) + "%" : "—"}</span>
                        <span>•</span>
                        <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Acknowledge"
                      onClick={() => updateStatusMutation.mutate({
                        insightId: insight.id,
                        status: "acknowledged",
                      })}
                    >
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Dismiss"
                      onClick={() => updateStatusMutation.mutate({
                        insightId: insight.id,
                        status: "dismissed",
                      })}
                    >
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────

export default function AnalyticsDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics Intelligence</h1>
        <p className="text-muted-foreground">
          Market trends, competitive positioning, and actionable insights
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends">
            <Activity className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Users className="h-4 w-4 mr-2" />
            Competitors
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Lightbulb className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="cost-forecast">
            <BarChart3 className="h-4 w-4 mr-2" />
            Cost Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MarketTrendsPanel />
            <MarketPositionPanel />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompetitorLandscapePanel />
            <InsightFeedPanel />
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <MarketTrendsPanel />
        </TabsContent>

        <TabsContent value="competitors">
          <CompetitorLandscapePanel />
        </TabsContent>

        <TabsContent value="insights">
          <InsightFeedPanel />
        </TabsContent>

        <TabsContent value="cost-forecast">
          <CostForecastingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
