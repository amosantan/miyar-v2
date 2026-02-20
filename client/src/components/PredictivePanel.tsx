/**
 * Predictive Intelligence Panel (V4-12)
 *
 * Shows on the Project Detail page:
 * - Cost Range Forecast card with range bar
 * - Outcome Prediction card with gauge
 * - Cost-Over-Time Projection chart (3 lines, 4 data points)
 * - Empty state for insufficient data
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  Target, BarChart3, Activity, Loader2,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface PredictivePanelProps {
  projectId: number;
}

const confidenceBadge = (level: string) => {
  switch (level) {
    case "high": return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">High Confidence</Badge>;
    case "medium": return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Medium Confidence</Badge>;
    case "low": return <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">Low Confidence</Badge>;
    default: return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Insufficient Data</Badge>;
  }
};

const trendIcon = (direction: string) => {
  switch (direction) {
    case "rising": return <TrendingUp className="w-4 h-4 text-red-400" />;
    case "falling": return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    case "stable": return <Minus className="w-4 h-4 text-blue-400" />;
    default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
  }
};

function CostRangeCard({ projectId }: { projectId: number }) {
  const { data, isLoading } = trpc.predictive.getCostRange.useQuery({ projectId });

  if (isLoading) return <CardSkeleton title="Cost Range Forecast" />;
  if (!data || data.confidence === "insufficient") {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Cost Range Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Insufficient evidence data for cost prediction.</p>
            <p className="text-xs mt-1">Add at least 3 evidence records to enable predictions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const range = data.p95 - data.p15;
  const p50Pos = range > 0 ? ((data.p50 - data.p15) / range) * 100 : 50;
  const p85Pos = range > 0 ? ((data.p85 - data.p15) / range) * 100 : 75;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Cost Range Forecast
          {confidenceBadge(data.confidence)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Range bar visualization */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>P15: {data.p15.toLocaleString()} {data.currency}/{data.unit}</span>
            <span>P95: {data.p95.toLocaleString()} {data.currency}/{data.unit}</span>
          </div>
          <div className="relative h-8 rounded-full bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-red-500/20 overflow-hidden">
            {/* P50 marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-blue-400"
              style={{ left: `${p50Pos}%` }}
            />
            <div
              className="absolute -top-5 text-[10px] font-medium text-blue-400 whitespace-nowrap"
              style={{ left: `${p50Pos}%`, transform: "translateX(-50%)" }}
            >
              P50: {data.p50.toLocaleString()}
            </div>
            {/* P85 marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-amber-400"
              style={{ left: `${p85Pos}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-emerald-400">Budget-friendly</span>
            <span className="text-red-400">Premium</span>
          </div>
        </div>

        {/* Trend adjustment */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          {trendIcon(data.trendDirection)}
          <span className="text-sm">
            Trend: {data.trendDirection === "insufficient_data" ? "No trend data" :
              `${data.trendDirection} (${data.trendAdjustment > 0 ? "+" : ""}${data.trendAdjustment}%)`}
          </span>
        </div>

        {/* Adjusted values if trend exists */}
        {data.trendAdjustment !== 0 && data.adjustedP50 && (
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-muted/20">
              <p className="text-muted-foreground">Adj P15</p>
              <p className="font-medium">{data.adjustedP15?.toLocaleString()}</p>
            </div>
            <div className="p-2 rounded bg-muted/20">
              <p className="text-muted-foreground">Adj P50</p>
              <p className="font-medium text-blue-400">{data.adjustedP50?.toLocaleString()}</p>
            </div>
            <div className="p-2 rounded bg-muted/20">
              <p className="text-muted-foreground">Adj P85</p>
              <p className="font-medium">{data.adjustedP85?.toLocaleString()}</p>
            </div>
            <div className="p-2 rounded bg-muted/20">
              <p className="text-muted-foreground">Adj P95</p>
              <p className="font-medium">{data.adjustedP95?.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Data quality */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{data.dataPointCount} data points</span>
          <span>{data.gradeACount} Grade A sources</span>
          {data.fallbackUsed && (
            <Badge variant="outline" className="text-[10px]">UAE-wide fallback</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OutcomePredictionCard({ projectId }: { projectId: number }) {
  const { data, isLoading } = trpc.predictive.getOutcomePrediction.useQuery({ projectId });

  if (isLoading) return <CardSkeleton title="Outcome Prediction" />;
  if (!data || data.confidenceLevel === "insufficient") {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            Outcome Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Insufficient data for outcome prediction.</p>
            <p className="text-xs mt-1">Evaluate the project first to generate predictions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const likelihood = data.successLikelihood;
  const gaugeColor = likelihood >= 60 ? "text-emerald-400" : likelihood >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          Outcome Prediction
          {confidenceBadge(data.confidenceLevel)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge visualization */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="currentColor"
                className={gaugeColor}
                strokeWidth="8"
                strokeDasharray={`${(likelihood / 100) * 251.2} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${gaugeColor}`}>{likelihood}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">Success Likelihood</p>
            <p className="text-xs text-muted-foreground">{data.predictionBasis}</p>
            <div className="flex gap-3 text-xs mt-2">
              <span className="text-emerald-400">{data.validatedRate}% validated</span>
              <span className="text-amber-400">{data.conditionalRate}% conditional</span>
              <span className="text-red-400">{data.notValidatedRate}% not validated</span>
            </div>
          </div>
        </div>

        {/* Risk and Success Factors */}
        <div className="grid grid-cols-2 gap-3">
          {data.keySuccessFactors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-emerald-400">Key Success Factors</p>
              {data.keySuccessFactors.slice(0, 3).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                  <span className="truncate">{f.variable}</span>
                  <span className="text-emerald-400 ml-auto">+{f.contribution.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {data.keyRiskFactors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-400">Key Risk Factors</p>
              {data.keyRiskFactors.slice(0, 3).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <span className="truncate">{f.variable}</span>
                  <span className="text-red-400 ml-auto">{f.contribution.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CostProjectionChart({ projectId }: { projectId: number }) {
  const { data, isLoading } = trpc.predictive.getScenarioProjection.useQuery({ projectId });

  if (isLoading) return <CardSkeleton title="Cost-Over-Time Projection" />;
  if (!data || data.baseCostPerSqm === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Cost-Over-Time Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No budget data available for projection.</p>
            <p className="text-xs mt-1">Set a budget cap and GFA in project settings.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build chart data from the three scenarios
  const chartData = data.midScenario.map((mid: any, i: number) => ({
    month: `M${mid.month}`,
    low: data.lowScenario[i]?.costPerSqm || 0,
    mid: mid.costPerSqm,
    high: data.highScenario[i]?.costPerSqm || 0,
  }));

  // Add base point at month 0
  chartData.unshift({
    month: "Now",
    low: data.baseCostPerSqm * 0.9,
    mid: data.baseCostPerSqm,
    high: data.baseCostPerSqm * 1.15,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Cost-Over-Time Projection
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            {data.annualizedTrend !== 0 ? `${data.annualizedTrend > 0 ? "+" : ""}${data.annualizedTrend}% annual trend` : "No trend data"}
            {" · "}Market: {data.marketFactor === 1.05 ? "Tight" : data.marketFactor === 0.95 ? "Soft" : "Balanced"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value.toLocaleString()} ${data.currency}/sqm`, ""]}
              />
              <Legend />
              <Line type="monotone" dataKey="high" stroke="#f87171" name="High (P85)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="mid" stroke="#60a5fa" name="Mid (P50)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="low" stroke="#34d399" name="Low (P15)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left py-1.5 px-2">Milestone</th>
                <th className="text-right py-1.5 px-2">Cost/sqm</th>
                <th className="text-right py-1.5 px-2">Total Cost</th>
                <th className="text-right py-1.5 px-2">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 px-2 font-medium">Current</td>
                <td className="py-1.5 px-2 text-right">{data.baseCostPerSqm.toLocaleString()}</td>
                <td className="py-1.5 px-2 text-right">{data.baseTotalCost.toLocaleString()}</td>
                <td className="py-1.5 px-2 text-right">—</td>
              </tr>
              {data.midScenario.map((p: any) => (
                <tr key={p.month} className="border-b border-border/30">
                  <td className="py-1.5 px-2">Month {p.month}</td>
                  <td className="py-1.5 px-2 text-right">{p.costPerSqm.toLocaleString()}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalCost.toLocaleString()}</td>
                  <td className={`py-1.5 px-2 text-right ${p.cumulativeChange > 0 ? "text-red-400" : p.cumulativeChange < 0 ? "text-emerald-400" : ""}`}>
                    {p.cumulativeChange > 0 ? "+" : ""}{p.cumulativeChange}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PredictivePanel({ projectId }: PredictivePanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CostRangeCard projectId={projectId} />
        <OutcomePredictionCard projectId={projectId} />
      </div>
      <CostProjectionChart projectId={projectId} />
    </div>
  );
}
