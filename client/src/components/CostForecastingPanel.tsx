/**
 * Cost Forecasting Panel (V4-13)
 *
 * Shows on the Analytics Dashboard:
 * - UAE-wide cost range table by category
 * - 6-month trend-adjusted outlook
 * - Confidence badges per category
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  BarChart3, Loader2,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  floors: "Flooring",
  walls: "Walls & Cladding",
  ceilings: "Ceilings",
  joinery: "Joinery",
  lighting: "Lighting",
  sanitary: "Sanitary Ware",
  kitchen: "Kitchen",
  hardware: "Hardware",
  ffe: "FF&E",
};

const confidenceBadge = (level: string) => {
  switch (level) {
    case "high": return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">High</Badge>;
    case "medium": return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">Medium</Badge>;
    case "low": return <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">Low</Badge>;
    default: return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Insufficient</Badge>;
  }
};

const trendIcon = (direction: string) => {
  switch (direction) {
    case "rising": return <TrendingUp className="w-3.5 h-3.5 text-red-400" />;
    case "falling": return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
    case "stable": return <Minus className="w-3.5 h-3.5 text-blue-400" />;
    default: return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

export default function CostForecastingPanel() {
  const { data, isLoading } = trpc.predictive.getUaeCostRanges.useQuery();

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Cost Forecasting — UAE Market
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Cost Forecasting — UAE Market
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No evidence data available for cost forecasting.</p>
            <p className="text-xs mt-1">Run market ingestion to populate evidence records.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate categories with data from those without
  const withData = data.filter((r: any) => r.prediction.confidence !== "insufficient");
  const withoutData = data.filter((r: any) => r.prediction.confidence === "insufficient");

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Cost Forecasting — UAE Market
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Evidence-based cost ranges by material category with 6-month trend-adjusted outlook
          </p>
        </CardHeader>
        <CardContent>
          {withData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Category</th>
                    <th className="text-right py-2 px-3 font-medium">P15</th>
                    <th className="text-right py-2 px-3 font-medium">P50</th>
                    <th className="text-right py-2 px-3 font-medium">P85</th>
                    <th className="text-right py-2 px-3 font-medium">P95</th>
                    <th className="text-center py-2 px-3 font-medium">Trend</th>
                    <th className="text-right py-2 px-3 font-medium">6mo Adj P50</th>
                    <th className="text-center py-2 px-3 font-medium">Confidence</th>
                    <th className="text-right py-2 px-3 font-medium">Data Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {withData.map((r: any) => {
                    const p = r.prediction;
                    // Compute 6-month adjusted P50
                    const monthlyRate = p.trendAdjustment !== 0
                      ? Math.pow(1 + (p.trendAdjustment / 100), 1 / 12) - 1
                      : 0;
                    const sixMonthP50 = Math.round(p.p50 * Math.pow(1 + monthlyRate, 6) * 100) / 100;

                    return (
                      <tr key={r.category} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">
                          {CATEGORY_LABELS[r.category] || r.category}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-mono text-xs">
                          {p.p15.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-blue-400 font-mono text-xs font-medium">
                          {p.p50.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-400 font-mono text-xs">
                          {p.p85.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-red-400 font-mono text-xs">
                          {p.p95.toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1">
                            {trendIcon(p.trendDirection)}
                            <span className="text-xs">
                              {p.trendAdjustment !== 0
                                ? `${p.trendAdjustment > 0 ? "+" : ""}${p.trendAdjustment}%`
                                : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                          {sixMonthP50 !== p.p50 ? sixMonthP50.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {confidenceBadge(p.confidence)}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-muted-foreground">
                          {p.dataPointCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No categories have sufficient data for forecasting.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories with insufficient data */}
      {withoutData.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Categories with Insufficient Data ({withoutData.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {withoutData.map((r: any) => (
                <Badge key={r.category} variant="outline" className="text-xs">
                  {CATEGORY_LABELS[r.category] || r.category}
                  <span className="ml-1 text-muted-foreground">({r.prediction.dataPointCount} pts)</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
