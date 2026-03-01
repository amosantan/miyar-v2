
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import {
  GitCompare, PlusCircle, Trash2, Crown, Loader2, ArrowRight,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle,
  Beaker, BarChart3, Lightbulb, Shield, DollarSign, Zap, Trophy,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend,
} from "recharts";

// ─── Constants ──────────────────────────────────────────────────────────────

const SCENARIO_VARS = [
  { key: "des02MaterialLevel", label: "Material Tier", min: 1, max: 5, type: "slider" as const },
  { key: "des03Complexity", label: "Design Complexity", min: 1, max: 5, type: "slider" as const },
  { key: "str01BrandClarity", label: "Brand Positioning", min: 1, max: 5, type: "slider" as const },
  { key: "str02Differentiation", label: "Differentiation Strategy", min: 1, max: 5, type: "slider" as const },
  { key: "fin01BudgetCap", label: "Budget Band (AED/sqft)", min: 100, max: 1500, type: "numeric" as const },
  { key: "fin02Flexibility", label: "Financial Flexibility", min: 1, max: 5, type: "slider" as const },
  { key: "des04Experience", label: "Experience Intensity", min: 1, max: 5, type: "slider" as const },
  { key: "exe02Contractor", label: "Contractor Capability", min: 1, max: 5, type: "slider" as const },
];

const DIMENSION_LABELS: Record<string, string> = {
  sa: "Strategic Alignment",
  ff: "Financial Feasibility",
  mp: "Market Positioning",
  ds: "Differentiation Strength",
  er: "Execution Risk",
};

const SCENARIO_COLORS = ["#4ecdc4", "#f0c674", "#e07a5f", "#7c8cf0"];

function scoreColor(score: number): string {
  if (score >= 75) return "text-miyar-emerald";
  if (score >= 60) return "text-miyar-gold";
  return "text-miyar-red";
}

function statusIcon(status: string) {
  if (status === "validated") return <CheckCircle2 className="h-3.5 w-3.5 text-miyar-emerald" />;
  if (status === "conditional") return <AlertTriangle className="h-3.5 w-3.5 text-miyar-gold" />;
  return <XCircle className="h-3.5 w-3.5 text-miyar-red" />;
}

// ─── Trade-off Narrative Generator ──────────────────────────────────────────

function generateTradeOffNarrative(
  comparison: any[],
  dominantIdx: number
): string {
  if (!comparison || comparison.length === 0) return "";

  const dominant = comparison[dominantIdx];
  const others = comparison.filter((_: any, i: number) => i !== dominantIdx);

  let narrative = `**${dominant.name}** emerges as the recommended scenario with a Risk-Adjusted Score of ${dominant.rasScore.toFixed(1)}.`;

  if (others.length > 0) {
    const tradeoffs: string[] = [];
    for (const other of others) {
      const dims = ["sa", "ff", "mp", "ds", "er"] as const;
      const betterDims: string[] = [];
      const worseDims: string[] = [];

      for (const d of dims) {
        const diff = other.scoreResult.dimensions[d] - dominant.scoreResult.dimensions[d];
        if (diff > 3) betterDims.push(DIMENSION_LABELS[d]);
        if (diff < -3) worseDims.push(DIMENSION_LABELS[d]);
      }

      if (betterDims.length > 0 || worseDims.length > 0) {
        let t = ` Compared to **${other.name}** (RAS: ${other.rasScore.toFixed(1)})`;
        if (betterDims.length > 0) t += `, which scores higher in ${betterDims.join(", ")}`;
        if (worseDims.length > 0) t += `, but lower in ${worseDims.join(", ")}`;
        t += ".";
        tradeoffs.push(t);
      }
    }
    if (tradeoffs.length > 0) narrative += tradeoffs.join("");
  }

  // Add decision guidance
  if (dominant.scoreResult.decisionStatus === "validated") {
    narrative += ` This scenario achieves a **Validated** status, indicating strong alignment across all dimensions.`;
  } else if (dominant.scoreResult.decisionStatus === "conditional") {
    narrative += ` This scenario is **Conditionally Validated** — review the flagged risk areas before proceeding.`;
  } else {
    narrative += ` Caution: even the best scenario is **Not Validated** — consider revisiting project fundamentals.`;
  }

  return narrative;
}

// ─── Scenario Builder Dialog ────────────────────────────────────────────────

function ScenarioBuilderDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const createScenario = trpc.scenario.create.useMutation();
  const utils = trpc.useUtils();

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      // Only send overrides that were actually changed
      const cleanOverrides: Record<string, number> = {};
      for (const [k, v] of Object.entries(overrides)) {
        if (v !== undefined && v !== null) cleanOverrides[k] = v;
      }
      await createScenario.mutateAsync({
        projectId,
        name,
        description: desc,
        variableOverrides: cleanOverrides,
      });
      utils.scenario.list.invalidate({ projectId });
      utils.scenario.compare.invalidate({ projectId });
      onOpenChange(false);
      setName("");
      setDesc("");
      setOverrides({});
      toast.success("Scenario created and simulated");
    } catch (e: any) {
      toast.error(e.message || "Failed to create scenario");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Create Scenario
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Scenario Name</Label>
            <Input
              placeholder="e.g., Premium Material Upgrade"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="What changes does this scenario explore?"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Variable Adjustments</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only adjust variables you want to change. Others inherit from baseline.
              </p>
            </div>
            {SCENARIO_VARS.map((v) => (
              <div key={v.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{v.label}</span>
                  <div className="flex items-center gap-2">
                    {overrides[v.key] !== undefined && (
                      <button
                        onClick={() => {
                          setOverrides((o) => {
                            const { [v.key]: _, ...rest } = o;
                            return rest;
                          });
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Reset
                      </button>
                    )}
                    <span className="text-xs font-medium text-primary w-10 text-right">
                      {overrides[v.key] !== undefined ? overrides[v.key] : "—"}
                    </span>
                  </div>
                </div>
                {v.type === "numeric" ? (
                  <Input
                    type="number"
                    placeholder="Leave empty for baseline value"
                    value={overrides[v.key] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setOverrides((o) => ({ ...o, [v.key]: Number(val) }));
                      } else {
                        setOverrides((o) => {
                          const { [v.key]: _, ...rest } = o;
                          return rest;
                        });
                      }
                    }}
                    className="h-8"
                  />
                ) : (
                  <Slider
                    min={v.min}
                    max={v.max}
                    step={1}
                    value={[overrides[v.key] ?? 3]}
                    onValueChange={([val]) =>
                      setOverrides((o) => ({ ...o, [v.key]: val }))
                    }
                  />
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createScenario.isPending}
            className="w-full"
          >
            {createScenario.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Beaker className="h-4 w-4 mr-2" />
            )}
            Simulate Scenario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Comparison Table ───────────────────────────────────────────────────────

function ComparisonTable({ comparison }: { comparison: any[] }) {
  const dims = ["sa", "ff", "mp", "ds", "er"] as const;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Dimension Comparison Matrix
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Dimension</th>
              {comparison.map((s, i) => (
                <th key={i} className="text-center py-2 px-3 font-medium" style={{ color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}>
                  <div className="flex items-center justify-center gap-1.5">
                    {s.isDominant && <Crown className="h-3 w-3 text-miyar-gold" />}
                    {s.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dims.map((d) => {
              const scores = comparison.map((s) => s.scoreResult.dimensions[d]);
              const maxScore = Math.max(...scores);
              return (
                <tr key={d} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 text-muted-foreground">{DIMENSION_LABELS[d]}</td>
                  {comparison.map((s, i) => {
                    const val = s.scoreResult.dimensions[d];
                    const isMax = val === maxScore && scores.filter((v: number) => v === maxScore).length === 1;
                    return (
                      <td key={i} className="text-center py-2.5 px-3">
                        <span className={`font-bold ${isMax ? scoreColor(val) : "text-foreground"}`}>
                          {val.toFixed(1)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-b border-border">
              <td className="py-2.5 pr-4 font-medium text-foreground">Composite</td>
              {comparison.map((s, i) => (
                <td key={i} className="text-center py-2.5 px-3">
                  <span className={`font-bold text-lg ${scoreColor(s.scoreResult.compositeScore)}`}>
                    {s.scoreResult.compositeScore.toFixed(1)}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <td className="py-2.5 pr-4 font-medium text-foreground">RAS Score</td>
              {comparison.map((s, i) => (
                <td key={i} className="text-center py-2.5 px-3">
                  <span className={`font-bold text-lg ${scoreColor(s.rasScore)}`}>
                    {s.rasScore.toFixed(1)}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <td className="py-2.5 pr-4 font-medium text-foreground">Risk Score</td>
              {comparison.map((s, i) => (
                <td key={i} className="text-center py-2.5 px-3">
                  <span className={`font-bold ${s.scoreResult.riskScore <= 45 ? "text-miyar-emerald" : s.scoreResult.riskScore <= 60 ? "text-miyar-gold" : "text-miyar-red"}`}>
                    {s.scoreResult.riskScore.toFixed(1)}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-medium text-foreground">Decision</td>
              {comparison.map((s, i) => (
                <td key={i} className="text-center py-2.5 px-3">
                  <div className="flex items-center justify-center gap-1.5">
                    {statusIcon(s.scoreResult.decisionStatus)}
                    <span className="text-xs capitalize">{s.scoreResult.decisionStatus.replace("_", " ")}</span>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Overlay Radar ──────────────────────────────────────────────────────────

function OverlayRadar({ comparison }: { comparison: any[] }) {
  const dims = ["sa", "ff", "mp", "ds", "er"] as const;
  const data = dims.map((d) => {
    const entry: any = { dimension: DIMENSION_LABELS[d] };
    comparison.forEach((s, i) => {
      entry[s.name] = s.scoreResult.dimensions[d];
    });
    return entry;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dimension Overlay</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 9 }} />
            {comparison.map((s, i) => (
              <Radar
                key={s.name}
                name={s.name}
                dataKey={s.name}
                stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── D5: Stress Test Panel ──────────────────────────────────────────────────

const STRESS_CONDITIONS = [
  { key: "cost_surge", label: "Cost Surge", icon: TrendingUp, desc: "+20% material inflation" },
  { key: "demand_collapse", label: "Demand Collapse", icon: TrendingDown, desc: "-50% sales velocity" },
  { key: "market_shift", label: "Market Shift", icon: AlertTriangle, desc: "Design trend obsolescence" },
  { key: "data_disruption", label: "Data Disruption", icon: Zap, desc: "Benchmark source loss" },
] as const;

function resColor(score: number) {
  if (score >= 70) return "text-miyar-emerald";
  if (score >= 50) return "text-miyar-gold";
  return "text-miyar-red";
}

function StressTestPanel({ scenarios, projectId }: { scenarios: any[]; projectId: number }) {
  const stressMut = trpc.scenario.stressTest.useMutation();
  const [results, setResults] = useState<Record<number, Record<string, any>>>({});

  async function runTest(scenarioId: number, condition: string, tier: string) {
    try {
      const r = await stressMut.mutateAsync({
        scenarioId,
        stressCondition: condition as any,
        baselineBudgetAed: 5_000_000,
        tier,
      });
      setResults((prev) => ({
        ...prev,
        [scenarioId]: { ...(prev[scenarioId] || {}), [condition]: r },
      }));
    } catch (e: any) {
      toast.error(e.message || "Stress test failed");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Stress Testing
        </CardTitle>
        <p className="text-xs text-muted-foreground">Simulate macro-economic shocks on each scenario</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Condition</th>
              {scenarios.map((s, i) => (
                <th key={i} className="text-center py-2 px-3 font-medium" style={{ color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRESS_CONDITIONS.map((cond) => (
              <tr key={cond.key} className="border-b border-border/50">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <cond.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <span className="text-foreground">{cond.label}</span>
                      <p className="text-[10px] text-muted-foreground">{cond.desc}</p>
                    </div>
                  </div>
                </td>
                {scenarios.map((s, i) => {
                  const r = results[s.id]?.[cond.key];
                  return (
                    <td key={i} className="text-center py-2.5 px-3">
                      {r ? (
                        <div>
                          <span className={`font-bold ${resColor(r.resilienceScore)}`}>
                            {r.resilienceScore}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {r.failurePoints.length > 0
                              ? r.failurePoints.join(", ")
                              : "No failures"}
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={stressMut.isPending}
                          onClick={() => runTest(s.id, cond.key, "Luxury")}
                        >
                          {stressMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
                        </Button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── D7: Economic / ROI Panel ───────────────────────────────────────────────

function EconomicPanel({ scenarios, projectId }: { scenarios: any[]; projectId: number }) {
  const roiMut = trpc.scenario.calculateRoi.useMutation();
  const { data: rankings } = trpc.scenario.rank.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  const [roiResults, setRoiResults] = useState<Record<number, any>>({});

  async function calcRoi(scenarioId: number) {
    try {
      const r = await roiMut.mutateAsync({
        projectId,
        scenarioId,
        tier: "Luxury",
        scale: "Medium",
        totalBudgetAed: 5_000_000,
        totalDevelopmentValue: 20_000_000,
        complexityScore: 60,
        serviceFeeAed: 75_000,
      });
      setRoiResults((prev) => ({ ...prev, [scenarioId]: r }));
    } catch (e: any) {
      toast.error(e.message || "ROI calculation failed");
    }
  }

  const fmt = (v: number) => `AED ${Math.round(v).toLocaleString()}`;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* ROI Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-miyar-emerald" />
            Economic Value Model
          </CardTitle>
          <p className="text-xs text-muted-foreground">Cost avoidance + programme acceleration per scenario</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {scenarios.map((s, i) => {
            const r = roiResults[s.id];
            return (
              <div key={s.id} className="border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                    {s.name}
                  </span>
                  {!r && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => calcRoi(s.id)} disabled={roiMut.isPending}>
                      {roiMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                      Calculate
                    </Button>
                  )}
                </div>
                {r && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background/50 rounded p-2">
                      <p className="text-muted-foreground">Rework Avoided</p>
                      <p className="font-bold text-miyar-emerald">{fmt(r.reworkCostAvoided)}</p>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <p className="text-muted-foreground">Acceleration</p>
                      <p className="font-bold text-primary">{fmt(r.programmeAccelerationValue)}</p>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <p className="text-muted-foreground">Total Value</p>
                      <p className="font-bold">{fmt(r.totalValueCreated)}</p>
                    </div>
                    <div className="bg-background/50 rounded p-2">
                      <p className="text-muted-foreground">Net ROI</p>
                      <p className={`font-bold ${r.netRoiPercent > 100 ? "text-miyar-emerald" : "text-miyar-gold"}`}>
                        {r.netRoiPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-miyar-gold" />
            Strategic Ranking
          </CardTitle>
          <p className="text-xs text-muted-foreground">50% ROI + 30% Resilience + 20% Inverse Risk</p>
        </CardHeader>
        <CardContent>
          {rankings && rankings.length > 0 ? (
            <div className="space-y-2">
              {(rankings as any[]).map((r: any, i: number) => (
                <div key={r.scenarioId} className={`flex items-center justify-between border border-border/50 rounded-lg p-3 ${i === 0 ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${i === 0 ? "text-miyar-gold" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                        <span>ROI: {r.netRoiPercent.toFixed(0)}%</span>
                        <span>Resilience: {r.avgResilienceScore}</span>
                        <span>Risk: {r.compositeRiskScore}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${i === 0 ? "text-miyar-emerald" : "text-foreground"}`}>
                      {r.strategicRankScore}
                    </p>
                    <p className="text-[10px] text-muted-foreground">rank score</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Run stress tests and ROI calculations to generate rankings
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Content ───────────────────────────────────────────────────────────

function ScenariosContent() {
  const { data: projects } = trpc.project.list.useQuery();
  const evaluatedProjects = useMemo(
    () => projects?.filter((p: any) => p.status === "evaluated") ?? [],
    [projects]
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const projectId = selectedId ? Number(selectedId) : evaluatedProjects[0]?.id;

  const { data: scenarioList, isLoading } = trpc.scenario.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: comparison } = trpc.scenario.compare.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && (scenarioList?.length ?? 0) > 0 }
  );

  const deleteScenario = trpc.scenario.delete.useMutation();
  const utils = trpc.useUtils();

  const [builderOpen, setBuilderOpen] = useState(false);

  async function handleDelete(id: number) {
    if (!projectId) return;
    try {
      await deleteScenario.mutateAsync({ id });
      utils.scenario.list.invalidate({ projectId });
      utils.scenario.compare.invalidate({ projectId });
      toast.success("Scenario deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }

  const dominantIdx = useMemo(() => {
    if (!comparison) return 0;
    return comparison.findIndex((c) => c.isDominant);
  }, [comparison]);

  const tradeOffNarrative = useMemo(() => {
    if (!comparison || comparison.length === 0) return "";
    return generateTradeOffNarrative(comparison, dominantIdx >= 0 ? dominantIdx : 0);
  }, [comparison, dominantIdx]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <PageHeader
        title="Decision Lab"
        description="Create scenarios, compare outcomes, and identify the optimal direction"
        icon={Beaker}
        breadcrumbs={[{ label: "Analysis" }, { label: "Scenarios" }]}
        actions={
          <div className="flex items-center gap-3">
            {evaluatedProjects.length > 0 && (
              <Select
                value={selectedId || String(evaluatedProjects[0]?.id ?? "")}
                onValueChange={setSelectedId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {evaluatedProjects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button className="gap-2" disabled={!projectId} onClick={() => setBuilderOpen(true)}>
              <PlusCircle className="h-4 w-4" /> New Scenario
            </Button>
          </div>
        }
      />

      {projectId && (
        <ScenarioBuilderDialog
          projectId={projectId}
          open={builderOpen}
          onOpenChange={setBuilderOpen}
        />
      )}

      {!projectId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Beaker className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Evaluate a project first, then create scenarios to compare different directions.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !scenarioList || scenarioList.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Beaker className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No scenarios yet.</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create 2-3 scenarios to compare different material tiers, complexity levels, budget bands, and differentiation strategies.
            </p>
            <Button onClick={() => setBuilderOpen(true)} className="gap-2">
              <PlusCircle className="h-4 w-4" /> Create First Scenario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Scenario Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scenarioList.map((s: any, i: number) => {
              const compResult = comparison?.[i];
              return (
                <Card
                  key={s.id}
                  className={`transition-all ${compResult?.isDominant ? "border-primary ring-1 ring-primary/20" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}
                        />
                        {compResult?.isDominant && <Crown className="h-3.5 w-3.5 text-miyar-gold" />}
                        {s.name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    )}
                    {compResult?.isDominant && (
                      <Badge className="bg-miyar-gold/20 text-miyar-gold border-miyar-gold/30 w-fit text-[10px]">
                        Recommended
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {compResult ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">RAS</p>
                            <p className={`text-lg font-bold ${scoreColor(compResult.rasScore)}`}>
                              {compResult.rasScore.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Risk</p>
                            <p className={`text-lg font-bold ${compResult.scoreResult.riskScore <= 45 ? "text-miyar-emerald" : "text-miyar-gold"}`}>
                              {compResult.scoreResult.riskScore.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Stability</p>
                            <p className="text-lg font-bold text-foreground">
                              {compResult.stabilityScore.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {statusIcon(compResult.scoreResult.decisionStatus)}
                          <span className="capitalize text-muted-foreground">
                            {compResult.scoreResult.decisionStatus.replace("_", " ")}
                          </span>
                        </div>
                        {s.variableOverrides && Object.keys(s.variableOverrides as any).length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {Object.entries(s.variableOverrides as Record<string, any>).slice(0, 4).map(([k, v]) => {
                              const varDef = SCENARIO_VARS.find((sv) => sv.key === k);
                              return (
                                <Badge key={k} variant="outline" className="text-[10px]">
                                  {varDef?.label.split(" ")[0] || k}: {String(v)}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Simulating...
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Comparison Table */}
          {comparison && comparison.length > 0 && (
            <>
              <ComparisonTable comparison={comparison} />
              <OverlayRadar comparison={comparison} />

              {/* D5: Stress Tests */}
              <StressTestPanel scenarios={scenarioList} projectId={projectId!} />

              {/* D7: Economic Model */}
              <EconomicPanel scenarios={scenarioList} projectId={projectId!} />

              {/* Trade-off Narrative */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-miyar-gold" />
                    Recommendation & Trade-off Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {tradeOffNarrative.split("**").map((part, i) =>
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Scenarios() {
  return (
    <>
      <ScenariosContent />
    </>
  );
}
