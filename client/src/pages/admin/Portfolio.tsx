
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, AlertTriangle, Target, Lightbulb, Sparkles } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Streamdown } from "streamdown";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function PortfolioInsightsAI() {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, error } = trpc.autonomous.portfolioInsights.useQuery(undefined, {
    enabled,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-500">
            <Sparkles className="h-4 w-4" />
            Autonomous Portfolio Intelligence
          </div>
          {!enabled && !data && (
            <Button size="sm" variant="outline" className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10" onClick={() => setEnabled(true)}>
              Generate Executive Briefing
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-3 text-sm text-blue-500/70 p-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Synthesizing macro-trends & systemic risks across portfolio...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-500 p-4 bg-red-500/10 rounded-md">
            Failed to generate insights: {error.message}
          </div>
        )}
        {data?.markdown && (
          <div className="prose prose-sm prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground">
            <Streamdown>{data.markdown}</Streamdown>
          </div>
        )}
        {!enabled && !data && !isLoading && !error && (
          <p className="text-sm text-muted-foreground">
            Activate the AI Engine to analyze cross-project patterns, score distributions, and improvement levers for executive directives.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Portfolio() {
  const { data, isLoading } = trpc.admin.portfolio.overview.useQuery();

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!data || data.scoredProjects === 0) {
    return (
      <>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">Cross-project analytics and pattern detection</p>
          </div>
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No scored projects yet. Evaluate projects first to see portfolio analytics.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.scoredProjects} scored projects out of {data.totalProjects} total
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-foreground">{data.totalProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Scored</p>
              <p className="text-3xl font-bold text-primary">{data.scoredProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Failure Patterns</p>
              <p className="text-3xl font-bold text-amber-400">{data.failurePatterns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Improvement Levers</p>
              <p className="text-3xl font-bold text-emerald-400">{data.improvementLevers.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Intelligence Block */}
        <PortfolioInsightsAI />

        {/* Distributions */}
        <div className="grid md:grid-cols-2 gap-4">
          {data.distributions.map((dist) => (
            <Card key={dist.dimension}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {dist.dimension} Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dist.buckets.filter(b => b.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="count" name="Projects" radius={[4, 4, 0, 0]}>
                      {dist.buckets.filter(b => b.count > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                    <Bar dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]} fill="#6366f1" opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Compliance Heatmap */}
        {data.complianceHeatmap.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Compliance Heatmap (Tier × Dimension)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left p-2 font-medium text-muted-foreground">Tier</th>
                      {["SA", "FF", "MP", "DS", "ER"].map(d => (
                        <th key={d} className="text-center p-2 font-medium text-muted-foreground">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(data.complianceHeatmap.map(c => c.row))).map(tier => (
                      <tr key={tier} className="border-t border-border/50">
                        <td className="p-2 font-medium text-foreground">{tier}</td>
                        {["SA", "FF", "MP", "DS", "ER"].map(dim => {
                          const cell = data.complianceHeatmap.find(c => c.row === tier && c.col === dim);
                          if (!cell) return <td key={dim} className="p-2 text-center text-muted-foreground">—</td>;
                          return (
                            <td key={dim} className="p-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cell.status === "compliant" ? "bg-emerald-500/20 text-emerald-400" :
                                cell.status === "warning" ? "bg-amber-500/20 text-amber-400" :
                                  "bg-red-500/20 text-red-400"
                                }`}>
                                {cell.score.toFixed(1)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failure Patterns */}
        {data.failurePatterns.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Detected Failure Patterns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.failurePatterns.map((pattern, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{pattern.pattern}</span>
                    <Badge variant={pattern.severity === "high" ? "destructive" : "secondary"}>
                      {pattern.severity} • {pattern.frequency} project{pattern.frequency > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{pattern.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Improvement Levers */}
        {data.improvementLevers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-emerald-400" />
                Top Improvement Levers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.improvementLevers.slice(0, 5).map((lever) => (
                  <div key={lever.rank} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                    <span className="text-xs font-bold text-primary w-6 text-center">#{lever.rank}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{lever.lever}</p>
                      <p className="text-xs text-muted-foreground truncate">{lever.description}</p>
                    </div>
                    <Badge variant={lever.estimatedImpact === "High" ? "default" : "secondary"}>
                      {lever.estimatedImpact}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Scored Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left p-2 font-medium text-muted-foreground">Project</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Tier</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Risk</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Cost Band</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Rework Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.id} className="border-t border-border/50">
                      <td className="p-2 font-medium text-foreground">{p.name}</td>
                      <td className="p-2 text-center text-muted-foreground">{p.tier}</td>
                      <td className="p-2 text-center">
                        <span className={p.compositeScore >= 70 ? "text-emerald-400" : p.compositeScore >= 50 ? "text-amber-400" : "text-red-400"}>
                          {p.compositeScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-2 text-center text-muted-foreground">{p.riskScore.toFixed(1)}</td>
                      <td className="p-2 text-center">
                        <Badge variant={p.status === "validated" ? "default" : p.status === "conditional" ? "secondary" : "destructive"} className="text-[10px]">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-center text-muted-foreground">{p.costBand || "—"}</td>
                      <td className="p-2 text-center">
                        {p.reworkRisk != null ? (
                          <span className={Number(p.reworkRisk) > 0.5 ? "text-red-400" : "text-emerald-400"}>
                            {(Number(p.reworkRisk) * 100).toFixed(0)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
