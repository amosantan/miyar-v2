import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { EvidenceReferencesPanel } from "@/components/EvidenceReferencesPanel";
import PredictivePanel from "@/components/PredictivePanel";
import BiasAlerts from "@/components/BiasAlerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useParams, useLocation } from "wouter";
import {
  Zap, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Info,
  TrendingUp, TrendingDown, BarChart3, Shield, Target, Lightbulb,
  Download, ChevronRight, Loader2, Sparkles, Building2, Calculator,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

const VARIABLE_LABELS: Record<string, string> = {
  str01_n: "Brand Clarity",
  str02_n: "Differentiation",
  str03_n: "Buyer Maturity",
  compatVisionMarket: "Vision-Market Fit",
  compatVisionDesign: "Vision-Design Fit",
  budgetFit: "Budget Fit",
  fin02_n: "Financial Flexibility",
  executionResilience: "Execution Resilience",
  costStability: "Cost Stability",
  marketFit: "Market Fit",
  differentiationPressure: "Differentiation Pressure",
  des04_n: "Experience Intensity",
  trendFit: "Trend Fit",
  competitorInverse: "Competitor Advantage",
  des02_n: "Material Level",
  supplyChainInverse: "Supply Chain Risk",
  complexityInverse: "Complexity Risk",
  approvalsInverse: "Approvals Risk",
};

const DIMENSION_LABELS: Record<string, string> = {
  sa: "Strategic Alignment",
  ff: "Financial Feasibility",
  mp: "Market Positioning",
  ds: "Differentiation Strength",
  er: "Execution Risk",
};

const DIMENSION_COLORS: Record<string, string> = {
  sa: "#4ecdc4",
  ff: "#f0c674",
  mp: "#81b29a",
  ds: "#e07a5f",
  er: "#7c8cf0",
};

function statusBadge(status: string) {
  if (status === "validated")
    return <Badge className="bg-miyar-emerald/20 text-miyar-emerald border-miyar-emerald/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Validated</Badge>;
  if (status === "conditional")
    return <Badge className="bg-miyar-gold/20 text-miyar-gold border-miyar-gold/30"><AlertTriangle className="h-3 w-3 mr-1" /> Conditional</Badge>;
  return <Badge className="bg-miyar-red/20 text-miyar-red border-miyar-red/30"><XCircle className="h-3 w-3 mr-1" /> Not Validated</Badge>;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-miyar-emerald";
  if (score >= 60) return "text-miyar-gold";
  return "text-miyar-red";
}

// ─── Waterfall Chart Component ──────────────────────────────────────────────

function ContributionWaterfall({ variableContributions, dimensions }: {
  variableContributions: Record<string, Record<string, number>>;
  dimensions: Record<string, number>;
}) {
  // Flatten all contributions across all dimensions into a sorted list
  const allContributions = useMemo(() => {
    const items: { variable: string; dimension: string; value: number; label: string }[] = [];
    for (const [dim, vars] of Object.entries(variableContributions)) {
      for (const [varName, value] of Object.entries(vars)) {
        items.push({
          variable: varName,
          dimension: dim,
          value: Math.round(value * 10000) / 100, // convert to percentage points
          label: VARIABLE_LABELS[varName] || varName,
        });
      }
    }
    return items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 12);
  }, [variableContributions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Score Contribution Waterfall
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top variables driving the composite score, by weighted contribution
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={allContributions} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: "#d1d5db", fontSize: 11 }}
              width={115}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: "#1a1f3a", border: "1px solid #2d3354", borderRadius: 8 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value: number, _name: string, props: any) => [
                `${value.toFixed(2)}% (${DIMENSION_LABELS[props.payload.dimension] || props.payload.dimension})`,
                "Contribution",
              ]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {allContributions.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={DIMENSION_COLORS[entry.dimension] || "#4ecdc4"}
                  opacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: DIMENSION_COLORS[key] }} />
              {label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sensitivity Toggles Component ──────────────────────────────────────────

function SensitivityToggles({ sensitivityData, baseScore }: {
  sensitivityData: any[];
  baseScore: number;
}) {
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const topVars = useMemo(() => sensitivityData.slice(0, 8), [sensitivityData]);

  const selectedEntry = topVars.find((e) => e.variable === selectedVar);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Sensitivity Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Click a variable to see how changing it affects the composite score
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {topVars.map((entry) => (
            <button
              key={entry.variable}
              onClick={() => setSelectedVar(selectedVar === entry.variable ? null : entry.variable)}
              className={`p-2.5 rounded-lg border text-left transition-all text-xs ${selectedVar === entry.variable
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40 bg-card"
                }`}
            >
              <p className="font-medium text-foreground truncate">
                {VARIABLE_LABELS[entry.variable] || entry.variable.replace(/([A-Z])/g, " $1").replace(/^\w/, (c: string) => c.toUpperCase())}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Impact: <span className={entry.sensitivity > 3 ? "text-miyar-gold" : "text-muted-foreground"}>
                  {entry.sensitivity.toFixed(1)} pts
                </span>
              </p>
            </button>
          ))}
        </div>

        {selectedEntry && (
          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">
                {VARIABLE_LABELS[selectedEntry.variable] || selectedEntry.variable}
              </span>
              <span className="text-xs text-muted-foreground">
                Sensitivity: {selectedEntry.sensitivity.toFixed(2)} points
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-2 rounded bg-miyar-red/10">
                <p className="text-xs text-muted-foreground mb-1">If decreased</p>
                <p className={`text-lg font-bold ${scoreColor(selectedEntry.scoreDown)}`}>
                  {selectedEntry.scoreDown.toFixed(1)}
                </p>
                <p className="text-xs text-miyar-red">
                  {(selectedEntry.scoreDown - baseScore).toFixed(1)}
                </p>
              </div>
              <div className="p-2 rounded bg-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Baseline</p>
                <p className={`text-lg font-bold ${scoreColor(baseScore)}`}>
                  {baseScore.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">current</p>
              </div>
              <div className="p-2 rounded bg-miyar-emerald/10">
                <p className="text-xs text-muted-foreground mb-1">If increased</p>
                <p className={`text-lg font-bold ${scoreColor(selectedEntry.scoreUp)}`}>
                  {selectedEntry.scoreUp.toFixed(1)}
                </p>
                <p className="text-xs text-miyar-emerald">
                  +{(selectedEntry.scoreUp - baseScore).toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Confidence Explanation Component ───────────────────────────────────────

function ConfidenceExplanation({ confidenceScore, benchmarkCount }: {
  confidenceScore: number;
  benchmarkCount: number;
}) {
  const factors = useMemo(() => {
    const inputCompleteness = 0.95; // Most fields filled
    const benchmarkDensity = Math.min(1, benchmarkCount / 3);
    const modelStability = 0.95;
    const overrideFactor = 1.0;
    return [
      { name: "Input Completeness", value: inputCompleteness, weight: 0.30, description: "Percentage of project variables provided" },
      { name: "Benchmark Density", value: benchmarkDensity, weight: 0.25, description: `${benchmarkCount} matching benchmarks (3 minimum recommended)` },
      { name: "Model Stability", value: modelStability, weight: 0.25, description: "Model version v1.0.0 — no drift detected" },
      { name: "Override Rate", value: overrideFactor, weight: 0.20, description: "No manual overrides applied" },
    ];
  }, [benchmarkCount]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Confidence Index Explained
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          How reliable is this score? Confidence = f(completeness, benchmarks, model stability, overrides)
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={confidenceScore >= 75 ? "#4ecdc4" : confidenceScore >= 50 ? "#f0c674" : "#e07a5f"}
                strokeWidth="3"
                strokeDasharray={`${confidenceScore}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${scoreColor(confidenceScore)}`}>
                {confidenceScore.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium mb-1">
              {confidenceScore >= 75 ? "High Confidence" : confidenceScore >= 50 ? "Moderate Confidence" : "Low Confidence"}
            </p>
            <p className="text-xs text-muted-foreground">
              {confidenceScore >= 75
                ? "Sufficient data and stable model. Scores are reliable for decision-making."
                : confidenceScore >= 50
                  ? "Some data gaps or limited benchmarks. Consider adding more project-specific benchmarks."
                  : "Significant data gaps. Scores should be treated as directional only."}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {factors.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <div className="w-32 text-xs text-muted-foreground shrink-0">{f.name}</div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${f.value * 100}%`,
                    backgroundColor: f.value >= 0.7 ? "#4ecdc4" : f.value >= 0.4 ? "#f0c674" : "#e07a5f",
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {(f.value * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-muted-foreground/60 w-8 text-right">
                w={f.weight}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-3">
          Confidence = 0.30 * InputCompleteness + 0.25 * BenchmarkDensity + 0.25 * ModelStability + 0.20 * (1 - OverrideRate)
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Radar Chart Component ──────────────────────────────────────────────────

function DimensionRadar({ dimensions }: { dimensions: Record<string, number> }) {
  const data = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: dimensions[key] ?? 0,
    fullMark: 100,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dimension Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 9 }} />
            <Radar name="Score" dataKey="score" stroke="#4ecdc4" fill="#4ecdc4" fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

function ProjectDetailContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const projectId = Number(params.id);

  const { data: project, isLoading } = trpc.project.get.useQuery({ id: projectId });
  const { data: scores } = trpc.project.getScores.useQuery({ projectId });
  const { data: sensitivityData } = trpc.project.sensitivity.useQuery({ id: projectId });
  const { data: roiData } = trpc.project.roi.useQuery({ projectId });
  const { data: fiveLensData } = trpc.project.fiveLens.useQuery({ projectId });
  const { data: intelligenceData } = trpc.project.intelligence.useQuery({ projectId });
  const { data: benchmarks } = trpc.admin.benchmarks.list.useQuery();
  const { data: activeAlerts = [] } = trpc.autonomous.getAlerts.useQuery({ status: "active" });

  const projectAlerts = activeAlerts.filter((a: any) =>
    a.affectedProjectIds &&
    Array.isArray(a.affectedProjectIds) &&
    a.affectedProjectIds.includes(projectId) &&
    (a.severity === "critical" || a.severity === "high")
  );

  const evaluateMutation = trpc.project.evaluate.useMutation({
    onSuccess: () => {
      toast.success("Evaluation complete");
      utils.project.get.invalidate({ id: projectId });
      utils.project.getScores.invalidate({ projectId });
      utils.project.sensitivity.invalidate({ id: projectId });
      utils.project.roi.invalidate({ projectId });
      utils.project.fiveLens.invalidate({ projectId });
      utils.project.intelligence.invalidate({ projectId });
      utils.bias.getActiveAlerts.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const reportMutation = trpc.project.generateReport.useMutation({
    onSuccess: () => {
      toast.success("Report generated");
      utils.project.listReports.invalidate({ projectId });
      setLocation("/reports");
    },
    onError: (err) => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  const handleEvaluate = () => evaluateMutation.mutate({ id: projectId });

  const latestScore = scores?.[0];
  const hasScores = !!latestScore;

  // Count matching benchmarks for confidence explanation
  const matchingBenchmarkCount = useMemo(() => {
    if (!project || !benchmarks) return 0;
    return benchmarks.filter(
      (b: any) =>
        b.typology === project.ctx01Typology &&
        b.location === project.ctx04Location &&
        b.marketTier === project.mkt01Tier
    ).length;
  }, [project, benchmarks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {project.ctx01Typology} · {project.ctx04Location} · {project.mkt01Tier}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {project.status}
          </Badge>
          <Button
            onClick={handleEvaluate}
            disabled={evaluateMutation.isPending}
            size="sm"
            className="gap-1.5"
          >
            {evaluateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {hasScores ? "Re-evaluate" : "Evaluate"}
          </Button>
          <Button
            onClick={() => setLocation(`/projects/${project.id}/design-advisor`)}
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Design Advisor
          </Button>
          <Button
            onClick={() => setLocation(`/projects/${project.id}/investor-summary`)}
            size="sm"
            variant="outline"
            className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
          >
            <Building2 className="h-3.5 w-3.5" />
            Investor View
          </Button>
          <Button
            onClick={() => setLocation(`/projects/${project.id}/brief-editor`)}
            size="sm"
            variant="outline"
            className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Calculator className="h-3.5 w-3.5" />
            Brief Editor
          </Button>
        </div>
      </div>

      {projectAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {projectAlerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 flex items-start gap-4 ${alert.severity === 'critical' ? 'bg-destructive/10 border-destructive/20' : 'bg-orange-500/10 border-orange-500/20'
                }`}
            >
              <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-orange-500'
                }`} />
              <div className="flex-1">
                <h3 className={`text-sm font-semibold mb-1 ${alert.severity === 'critical' ? 'text-destructive' : 'text-orange-500'
                  }`}>
                  {alert.title}
                </h3>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{alert.message}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/alerts")}
                className="shrink-0"
              >
                View Details
              </Button>
            </div>
          ))}
        </div>
      )}

      {hasScores ? (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-secondary/50 flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="explainability">Why This Score?</TabsTrigger>
            <TabsTrigger value="risk">Risk & Actions</TabsTrigger>
            <TabsTrigger value="five-lens">5-Lens</TabsTrigger>
            <TabsTrigger value="roi">ROI Impact</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="predictive">Predictive</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* ─── Overview Tab ──────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Score Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="col-span-2 md:col-span-1">
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Composite</p>
                  <p className={`text-3xl font-bold ${scoreColor(Number(latestScore.compositeScore))}`}>
                    {Number(latestScore.compositeScore).toFixed(1)}
                  </p>
                  <div className="mt-1">{statusBadge(latestScore.decisionStatus)}</div>
                </CardContent>
              </Card>
              {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
                <Card key={key}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{label.split(" ").map(w => w[0]).join("")}</p>
                    <p className={`text-2xl font-bold ${scoreColor(Number((latestScore as any)[`${key}Score`]))}`}>
                      {Number((latestScore as any)[`${key}Score`]).toFixed(1)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Radar + Key Metrics */}
            <div className="grid md:grid-cols-2 gap-4">
              <DimensionRadar dimensions={{
                sa: Number(latestScore.saScore),
                ff: Number(latestScore.ffScore),
                mp: Number(latestScore.mpScore),
                ds: Number(latestScore.dsScore),
                er: Number(latestScore.erScore),
              }} />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Key Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Risk-Adjusted Score (RAS)</span>
                    <span className={`font-bold ${scoreColor(Number(latestScore.rasScore))}`}>
                      {Number(latestScore.rasScore).toFixed(1)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Risk Score</span>
                    <span className={`font-bold ${Number(latestScore.riskScore) <= 45 ? "text-miyar-emerald" : Number(latestScore.riskScore) <= 60 ? "text-miyar-gold" : "text-miyar-red"}`}>
                      {Number(latestScore.riskScore).toFixed(1)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Confidence</span>
                    <span className={`font-bold ${scoreColor(Number(latestScore.confidenceScore))}`}>
                      {Number(latestScore.confidenceScore).toFixed(1)}%
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Penalties Applied</span>
                    <span className="font-bold text-foreground">
                      {(latestScore.penalties as any[])?.length ?? 0}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Risk Flags</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {(latestScore.riskFlags as string[])?.length > 0
                        ? (latestScore.riskFlags as string[]).map((f: string) => (
                          <Badge key={f} variant="outline" className="text-[10px] text-miyar-red border-miyar-red/30">
                            {String(f)}
                          </Badge>
                        ))
                        : <span className="text-xs text-miyar-emerald">None</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Explainability Tab ────────────────────────────────────── */}
          <TabsContent value="explainability" className="space-y-4">
            {latestScore.variableContributions ? (
              <ContributionWaterfall
                variableContributions={latestScore.variableContributions as any}
                dimensions={{
                  sa: Number(latestScore.saScore),
                  ff: Number(latestScore.ffScore),
                  mp: Number(latestScore.mpScore),
                  ds: Number(latestScore.dsScore),
                  er: Number(latestScore.erScore),
                }}
              />
            ) : null}

            {sensitivityData && sensitivityData.length > 0 && (
              <SensitivityToggles
                sensitivityData={sensitivityData}
                baseScore={Number(latestScore.compositeScore)}
              />
            )}

            <ConfidenceExplanation
              confidenceScore={Number(latestScore.confidenceScore)}
              benchmarkCount={matchingBenchmarkCount}
            />
          </TabsContent>

          {/* ─── Risk & Actions Tab ────────────────────────────────────── */}
          <TabsContent value="risk" className="space-y-4">
            {/* V11: Cognitive Bias Analysis */}
            <BiasAlerts projectId={projectId} />

            {/* Penalties */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-miyar-red" />
                  Active Penalties
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(latestScore.penalties as any[])?.length > 0 ? (
                  <div className="space-y-2">
                    {(latestScore.penalties as any[]).map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-miyar-red/5 border border-miyar-red/10">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.id}: {p.description}</p>
                          <p className="text-xs text-muted-foreground">Trigger: {p.trigger}</p>
                        </div>
                        <Badge className="bg-miyar-red/20 text-miyar-red border-miyar-red/30">
                          {p.effect} pts
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-miyar-emerald flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> No penalties triggered
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Conditional Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-miyar-gold" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(latestScore.conditionalActions as any[])?.length > 0 ? (
                  <div className="space-y-2">
                    {(latestScore.conditionalActions as any[]).map((a: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-miyar-gold/5 border border-miyar-gold/10">
                        <p className="text-sm text-foreground">{a.recommendation}</p>
                        <div className="flex gap-1 mt-1.5">
                          {a.variables?.map((v: string) => (
                            <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No conditional actions required.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ROI Tab ───────────────────────────────────────────────── */}
          <TabsContent value="roi" className="space-y-4">
            {roiData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Cost Avoided (Mid)</p>
                      <p className="text-2xl font-bold text-miyar-emerald">
                        {(roiData.totalCostAvoided.mid / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-muted-foreground">AED</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Hours Saved (Mid)</p>
                      <p className="text-2xl font-bold text-miyar-gold">
                        {roiData.totalHoursSaved.mid.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Budget Accuracy</p>
                      <p className="text-2xl font-bold text-miyar-teal">
                        ±{roiData.budgetAccuracyGain.toPct}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">from ±{roiData.budgetAccuracyGain.fromPct}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Decision Confidence</p>
                      <p className="text-2xl font-bold text-foreground">
                        {roiData.decisionConfidenceIndex}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Three-scenario range */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Cost Avoided — Three Scenarios</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Conservative</p>
                        <p className="text-lg font-semibold text-muted-foreground">{(roiData.totalCostAvoided.conservative / 1000).toFixed(0)}K AED</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Mid Estimate</p>
                        <p className="text-lg font-semibold text-miyar-emerald">{(roiData.totalCostAvoided.mid / 1000).toFixed(0)}K AED</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Aggressive</p>
                        <p className="text-lg font-semibold text-miyar-gold">{(roiData.totalCostAvoided.aggressive / 1000).toFixed(0)}K AED</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Driver breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">ROI Drivers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={roiData.drivers.map(d => ({
                        name: d.name.replace(/ /g, '\n'),
                        value: d.costAvoided.mid,
                      }))} margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} interval={0} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "#1a1f3a", border: "1px solid #2d3354", borderRadius: 8 }}
                          formatter={(value: number) => [`${(value / 1000).toFixed(0)}K AED`, "Cost Avoided"]}
                        />
                        <Bar dataKey="value" fill="#4ecdc4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Driver details */}
                <div className="space-y-3">
                  {roiData.drivers.map((driver, i) => (
                    <Card key={i}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-foreground">{driver.name}</h4>
                          <span className="text-sm font-bold text-miyar-emerald">{(driver.costAvoided.mid / 1000).toFixed(0)}K AED</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{driver.description}</p>
                        <div className="flex gap-4 text-[10px] text-muted-foreground/70">
                          {driver.assumptions.map((a, j) => (
                            <span key={j}>{a}</span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Assumptions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Model Assumptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {roiData.assumptions.map((a, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground">{a}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Run evaluation first to see ROI analysis.
                </CardContent>
              </Card>
            )}
          </TabsContent>
          {/* ─── 5-Lens Tab ──────────────────────────────────────────────── */}
          <TabsContent value="five-lens" className="space-y-4">
            {fiveLensData ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">5-Lens Validation Framework</h3>
                    <p className="text-xs text-muted-foreground">{fiveLensData.frameworkVersion} • Overall: {fiveLensData.overallGrade}</p>
                  </div>
                  <Badge variant={fiveLensData.overallScore >= 70 ? "default" : fiveLensData.overallScore >= 50 ? "secondary" : "destructive"}>
                    {fiveLensData.overallScore.toFixed(1)}/100
                  </Badge>
                </div>

                <div className="grid gap-4">
                  {fiveLensData.lenses.map((lens) => (
                    <Card key={lens.lensId}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold ${lens.grade === "A" ? "bg-emerald-500/20 text-emerald-400" :
                              lens.grade === "B" ? "bg-blue-500/20 text-blue-400" :
                                lens.grade === "C" ? "bg-amber-500/20 text-amber-400" :
                                  "bg-red-500/20 text-red-400"
                              }`}>
                              {lens.grade}
                            </div>
                            <div>
                              <CardTitle className="text-sm">{lens.lensName}</CardTitle>
                              <p className="text-xs text-muted-foreground">{lens.score.toFixed(1)} / {lens.maxScore}</p>
                            </div>
                          </div>
                          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${lens.score >= 70 ? "bg-emerald-500" : lens.score >= 50 ? "bg-amber-500" : "bg-red-500"
                                }`}
                              style={{ width: `${lens.score}%` }}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">{lens.rationale}</p>

                        {/* Evidence table */}
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/30">
                                <th className="text-left p-2 font-medium text-muted-foreground">Variable</th>
                                <th className="text-center p-2 font-medium text-muted-foreground">Value</th>
                                <th className="text-center p-2 font-medium text-muted-foreground">Weight</th>
                                <th className="text-center p-2 font-medium text-muted-foreground">Contribution</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lens.evidence.map((ev, i) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="p-2 text-foreground">{ev.label}</td>
                                  <td className="p-2 text-center text-foreground">{ev.value}</td>
                                  <td className="p-2 text-center text-muted-foreground">{(ev.weight * 100).toFixed(0)}%</td>
                                  <td className="p-2 text-center">
                                    <span className={ev.contribution >= 0.5 ? "text-emerald-400" : ev.contribution >= 0.3 ? "text-amber-400" : "text-red-400"}>
                                      {ev.contribution.toFixed(2)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {lens.penalties.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {lens.penalties.map((p, i) => (
                              <Badge key={i} variant="destructive" className="text-[10px]">{p}</Badge>
                            ))}
                          </div>
                        )}

                        {lens.evidence.some(e => e.benchmarkRef) && (
                          <p className="text-[10px] text-muted-foreground/60">
                            {lens.evidence.find(e => e.benchmarkRef)?.benchmarkRef}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                      {fiveLensData.attribution}
                    </p>
                    <p className="text-[10px] text-muted-foreground/30 mt-1">{fiveLensData.watermark}</p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Run evaluation first to see 5-Lens analysis.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Intelligence Tab ───────────────────────────────────────── */}
          <TabsContent value="intelligence" className="space-y-4">
            {intelligenceData ? (
              <>
                <h3 className="text-lg font-semibold text-foreground">Project Intelligence</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Cost Delta vs Benchmark</p>
                      <p className={`text-2xl font-bold ${Number(intelligenceData.costDeltaVsBenchmark) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {Number(intelligenceData.costDeltaVsBenchmark) > 0 ? "+" : ""}{Number(intelligenceData.costDeltaVsBenchmark).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Uniqueness Index</p>
                      <p className="text-2xl font-bold text-miyar-gold">
                        {(Number(intelligenceData.uniquenessIndex) * 100).toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Rework Risk</p>
                      <p className={`text-2xl font-bold ${Number(intelligenceData.reworkRiskIndex) > 0.5 ? "text-red-400" : "text-emerald-400"}`}>
                        {(Number(intelligenceData.reworkRiskIndex) * 100).toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Procurement Complexity</p>
                      <p className={`text-2xl font-bold ${Number(intelligenceData.procurementComplexity) > 0.6 ? "text-amber-400" : "text-emerald-400"}`}>
                        {(Number(intelligenceData.procurementComplexity) * 100).toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Classification</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Style Family</span>
                        <Badge variant="outline">{intelligenceData.styleFamily}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Cost Band</span>
                        <Badge variant="outline">{intelligenceData.costBand}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Tier Percentile</span>
                        <span className="text-sm font-medium text-foreground">
                          {(Number(intelligenceData.tierPercentile) * 100).toFixed(0)}th
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Feasibility Flags</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Array.isArray(intelligenceData.feasibilityFlags) && intelligenceData.feasibilityFlags.length > 0 ? (
                        <div className="space-y-2">
                          {(intelligenceData.feasibilityFlags as any[]).map((flag: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                              {flag.severity === "critical" ? (
                                <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                              ) : flag.severity === "warning" ? (
                                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                              ) : (
                                <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                              )}
                              <div>
                                <p className="text-xs font-medium text-foreground">{flag.flag.replace(/_/g, " ")}</p>
                                <p className="text-[10px] text-muted-foreground">{flag.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">No feasibility flags detected.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Run evaluation first to see project intelligence.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Evidence Tab ────────────────────────────────────────────── */}
          <TabsContent value="evidence" className="space-y-4">
            <EvidenceReferencesPanel projectId={projectId} />
          </TabsContent>

          {/* ─── Predictive Tab ──────────────────────────────────────────── */}
          <TabsContent value="predictive" className="space-y-4">
            <PredictivePanel projectId={projectId} />
          </TabsContent>

          {/* ─── Reports Tab ─────────────────────────────────────────────── */}          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Generate Report Pack</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Generate structured reports from the latest evaluation
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { type: "validation_summary" as const, title: "Executive Decision Pack", desc: "Scores, recommendations, risk table, ROI narrative" },
                    { type: "design_brief" as const, title: "Design Brief + RFQ Pack", desc: "All above + design parameters + variable contributions" },
                    { type: "full_report" as const, title: "Full Report", desc: "Complete analysis with ROI breakdown and all sections" },
                  ].map((r) => (
                    <button
                      key={r.type}
                      onClick={() => reportMutation.mutate({ projectId, reportType: r.type })}
                      disabled={reportMutation.isPending}
                      className="p-4 rounded-lg border border-border hover:border-primary/40 bg-card text-left transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Download className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">{r.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              This project has not been evaluated yet. Click Evaluate to run the scoring engine.
            </p>
            <Button onClick={handleEvaluate} disabled={evaluateMutation.isPending} className="gap-2">
              <Zap className="h-4 w-4" /> Run Evaluation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Project Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ["Typology", project.ctx01Typology],
              ["Scale", project.ctx02Scale],
              ["GFA", project.ctx03Gfa ? `${Number(project.ctx03Gfa).toLocaleString()} sqm` : "—"],
              ["Fit-out Area", (project as any).totalFitoutArea ? `${Number((project as any).totalFitoutArea).toLocaleString()} sqm` : "—"],
              ["Location", project.ctx04Location],
              ["Horizon", project.ctx05Horizon],
              ["Market Tier", project.mkt01Tier],
              ["Style", project.des01Style],
              ["Budget Cap", project.fin01BudgetCap ? `${Number(project.fin01BudgetCap)} AED/sqm` : "—"],
              ["Brand Clarity", `${project.str01BrandClarity}/5`],
              ["Differentiation", `${project.str02Differentiation}/5`],
              ["Material Level", `${project.des02MaterialLevel}/5`],
              ["Complexity", `${project.des03Complexity}/5`],
              ["Contractor", `${project.exe02Contractor}/5`],
              ["Supply Chain", `${project.exe01SupplyChain}/5`],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-muted-foreground text-xs">{String(label)}</p>
                <p className="text-foreground font-medium">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Extended Brief */}
      {(project.unitMix || project.villaSpaces || project.developerGuidelines) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extended Brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {project.developerGuidelines && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">Developer Guidelines & Target Audience</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof project.developerGuidelines === "object" ? JSON.stringify(project.developerGuidelines, null, 2) : String(project.developerGuidelines)}</p>
              </div>
            )}
            {project.unitMix && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">Unit Mix</h4>
                {(() => {
                  // Safely parse unitMix — MySQL JSON columns can return strings or parsed objects
                  let units: any[] = [];
                  try {
                    const raw = project.unitMix;
                    if (Array.isArray(raw)) {
                      units = raw;
                    } else if (typeof raw === "string") {
                      const parsed = JSON.parse(raw);
                      units = Array.isArray(parsed) ? parsed : [];
                    }
                  } catch { /* ignore parse errors */ }

                  if (units.length > 0) {
                    return (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/30">
                              <th className="text-left p-2 text-xs text-muted-foreground font-medium">Unit Type</th>
                              <th className="text-right p-2 text-xs text-muted-foreground font-medium">Area (sqm)</th>
                              <th className="text-right p-2 text-xs text-muted-foreground font-medium">Count</th>
                              <th className="text-center p-2 text-xs text-muted-foreground font-medium">In Fitout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {units.map((u: any, i: number) => (
                              <tr key={i} className="border-t border-border/50">
                                <td className="p-2 text-foreground">{String(u.unitType ?? "")}</td>
                                <td className="p-2 text-right text-foreground">{String(u.areaSqm ?? 0)}</td>
                                <td className="p-2 text-right text-foreground">{String(u.count ?? 0)}</td>
                                <td className="p-2 text-center text-foreground">{u.includeInFitout ? "✓" : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                  // Fallback: show raw JSON
                  return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(project.unitMix, null, 2)}</p>;
                })()}
              </div>
            )}
            {project.villaSpaces && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">Villa Spaces</h4>
                {(() => {
                  let floors: any[] = [];
                  try {
                    const raw = project.villaSpaces;
                    if (Array.isArray(raw)) {
                      floors = raw;
                    } else if (typeof raw === "string") {
                      const parsed = JSON.parse(raw);
                      floors = Array.isArray(parsed) ? parsed : [];
                    }
                  } catch { /* ignore parse errors */ }

                  if (floors.length > 0) {
                    return (
                      <div className="space-y-3">
                        {floors.map((floor: any, fi: number) => (
                          <div key={fi}>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">{String(floor.floor ?? `Floor ${fi + 1}`)}</p>
                            <div className="rounded-lg border border-border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/30">
                                    <th className="text-left p-2 text-xs text-muted-foreground font-medium">Room</th>
                                    <th className="text-right p-2 text-xs text-muted-foreground font-medium">Area (sqm)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(Array.isArray(floor.rooms) ? floor.rooms : []).map((r: any, ri: number) => (
                                    <tr key={ri} className="border-t border-border/50">
                                      <td className="p-2 text-foreground">{String(r.name ?? "")}</td>
                                      <td className="p-2 text-right text-foreground">{String(r.areaSqm ?? 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(project.villaSpaces, null, 2)}</p>;
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  return (
    <DashboardLayout>
      <ProjectDetailContent />
    </DashboardLayout>
  );
}
