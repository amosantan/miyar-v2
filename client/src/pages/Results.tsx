import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function ResultsContent() {
  const { data: projects, isLoading: loadingProjects } =
    trpc.project.list.useQuery();
  const evaluatedProjects = useMemo(
    () => projects?.filter((p) => p.status === "evaluated") ?? [],
    [projects]
  );
  const [selectedId, setSelectedId] = useState<string>("");

  const projectId = selectedId ? Number(selectedId) : evaluatedProjects[0]?.id;

  const { data: scores } = trpc.project.getScores.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: sensitivity } = trpc.project.sensitivity.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
  );
  const { data: roi } = trpc.project.roi.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const latestScore = scores?.[0];

  const radarData = latestScore
    ? [
        { dimension: "Strategic Alignment", value: Number(latestScore.saScore) },
        { dimension: "Financial Feasibility", value: Number(latestScore.ffScore) },
        { dimension: "Market Positioning", value: Number(latestScore.mpScore) },
        { dimension: "Differentiation", value: Number(latestScore.dsScore) },
        { dimension: "Execution Risk", value: Number(latestScore.erScore) },
      ]
    : [];

  const sensitivityData = (sensitivity ?? []).slice(0, 10).map((s) => ({
    variable: s.variable.replace(/([A-Z])/g, " $1").replace(/^\w/, (c: string) => c.toUpperCase()).substring(0, 20),
    sensitivity: s.sensitivity,
    scoreUp: s.scoreUp,
    scoreDown: s.scoreDown,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Results & Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed scoring breakdown and sensitivity analysis
          </p>
        </div>
        {evaluatedProjects.length > 0 && (
          <Select
            value={selectedId || String(evaluatedProjects[0]?.id ?? "")}
            onValueChange={setSelectedId}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {evaluatedProjects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!projectId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              No evaluated projects. Evaluate a project first to see results.
            </p>
          </CardContent>
        </Card>
      ) : !latestScore ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Dimension Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="oklch(0.28 0.02 260)" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: "oklch(0.60 0.02 260)", fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "oklch(0.60 0.02 260)", fontSize: 10 }}
                  />
                  <Radar
                    dataKey="value"
                    stroke="oklch(0.65 0.12 195)"
                    fill="oklch(0.65 0.12 195)"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sensitivity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Sensitivity Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sensitivityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sensitivityData} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.28 0.02 260)"
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "oklch(0.60 0.02 260)", fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="variable"
                      width={120}
                      tick={{ fill: "oklch(0.60 0.02 260)", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.19 0.03 260)",
                        border: "1px solid oklch(0.28 0.02 260)",
                        borderRadius: "8px",
                        color: "oklch(0.93 0.01 260)",
                      }}
                    />
                    <Bar
                      dataKey="sensitivity"
                      fill="oklch(0.65 0.12 195)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sensitivity data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* ROI */}
          {roi && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">ROI Estimation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    {
                      label: "Total Cost Avoided",
                      value: `AED ${roi.totalCostAvoided.mid.toLocaleString()}`,
                      sub: `${roi.totalHoursSaved.mid} hours saved`,
                    },
                    {
                      label: "Budget Accuracy",
                      value: `±${roi.budgetAccuracyGain.toPct}%`,
                      sub: `from ±${roi.budgetAccuracyGain.fromPct}%`,
                    },
                    {
                      label: "Decision Confidence",
                      value: `${roi.decisionConfidenceIndex}%`,
                      sub: "Confidence index",
                    },
                    {
                      label: "Top Driver",
                      value: roi.drivers[0]?.name ?? "N/A",
                      sub: roi.drivers[0] ? `AED ${roi.drivers[0].costAvoided.mid.toLocaleString()}` : "",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {item.label}
                      </p>
                      <p className="text-xl font-bold text-foreground mt-1">
                        {item.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.sub}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function Results() {
  return (
    <DashboardLayout>
      <ResultsContent />
    </DashboardLayout>
  );
}
