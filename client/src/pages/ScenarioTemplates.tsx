import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Wand2, Target, ArrowRight, AlertTriangle, Lightbulb } from "lucide-react";
import { useState, useMemo } from "react";

const CONSTRAINT_VARIABLES = [
  { key: "des02MaterialLevel", label: "Material Level", type: "number" },
  { key: "des03Complexity", label: "Design Complexity", type: "number" },
  { key: "fin02Flexibility", label: "Budget Flexibility", type: "number" },
  { key: "fin03ShockTolerance", label: "Shock Tolerance", type: "number" },
  { key: "exe01SupplyChain", label: "Supply Chain Readiness", type: "number" },
  { key: "exe02Contractor", label: "Contractor Capability", type: "number" },
  { key: "str01BrandClarity", label: "Brand Clarity", type: "number" },
  { key: "str02Differentiation", label: "Differentiation", type: "number" },
];

interface ConstraintInput {
  variable: string;
  operator: "eq" | "gte" | "lte";
  value: string;
}

export default function ScenarioTemplates() {
  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [constraints, setConstraints] = useState<ConstraintInput[]>([
    { variable: "des02MaterialLevel", operator: "gte", value: "3" },
  ]);

  const projectId = selectedProjectId ? parseInt(selectedProjectId) : 0;

  const { data: templates } = trpc.project.scenarioTemplates.useQuery(undefined, {
    enabled: projectId > 0,
  });

  const solveMutation = trpc.project.solveConstraints.useMutation({
    onSuccess: () => toast.success("Constraint solver completed"),
    onError: (e) => toast.error(e.message),
  });

  const applyTemplateMutation = trpc.project.applyScenarioTemplate.useMutation({
    onSuccess: () => toast.success("Scenario created from template"),
    onError: (e) => toast.error(e.message),
  });

  const addConstraint = () => {
    setConstraints(prev => [...prev, { variable: "des02MaterialLevel", operator: "gte", value: "3" }]);
  };

  const removeConstraint = (index: number) => {
    setConstraints(prev => prev.filter((_, i) => i !== index));
  };

  const updateConstraint = (index: number, field: keyof ConstraintInput, value: string) => {
    setConstraints(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const runSolver = () => {
    if (!projectId) return;
    solveMutation.mutate({
      projectId,
      constraints: constraints.map(c => ({
        variable: c.variable,
        operator: c.operator,
        value: parseFloat(c.value) || 3,
      })),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Scenario Simulation V2</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built scenario templates, tornado analysis, and constraint solver
          </p>
        </div>

        {/* Project Selector */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Select Project:</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projectsLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    projects?.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {projectId > 0 && (
          <>
            {/* Scenario Templates */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Scenario Templates
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Pre-built scenario templates with one-click application
                </p>
              </CardHeader>
              <CardContent>
                {templates ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map((t) => (
                      <div key={t.key} className="p-4 rounded-lg border border-border/50 bg-muted/10 hover:border-primary/30 transition-all">
                        <h4 className="text-sm font-medium text-foreground mb-1">{t.name}</h4>
                        <p className="text-xs text-muted-foreground mb-3">{t.description}</p>

                        <div className="space-y-1 mb-3">
                          {Object.entries(t.overrides).slice(0, 3).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">{key}</span>
                              <span className="text-foreground font-medium">{String(val)}</span>
                            </div>
                          ))}
                          {Object.keys(t.overrides).length > 3 && (
                            <p className="text-[10px] text-muted-foreground">+{Object.keys(t.overrides).length - 3} more overrides</p>
                          )}
                        </div>

                        <div className="space-y-1 mb-3">
                          {t.tradeoffs.slice(0, 2).map((tr, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-[10px] text-muted-foreground">{tr}</span>
                            </div>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => applyTemplateMutation.mutate({ projectId, templateKey: t.key })}
                          disabled={applyTemplateMutation.isPending}
                        >
                          {applyTemplateMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>Apply Template <ArrowRight className="h-3 w-3 ml-1" /></>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Constraint Solver */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Constraint Solver
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Define constraints and let the solver propose best-fit scenario variants
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {constraints.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={c.variable} onValueChange={(v) => updateConstraint(i, "variable", v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONSTRAINT_VARIABLES.map(cv => (
                          <SelectItem key={cv.key} value={cv.key}>{cv.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={(v) => updateConstraint(i, "operator", v)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gte">&ge;</SelectItem>
                        <SelectItem value="lte">&le;</SelectItem>
                        <SelectItem value="eq">=</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={c.value}
                      onChange={(e) => updateConstraint(i, "value", e.target.value)}
                      className="w-20"
                    />
                    <Button variant="outline" size="sm" onClick={() => removeConstraint(i)} className="text-destructive">
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addConstraint}>
                    + Add Constraint
                  </Button>
                  <Button size="sm" onClick={runSolver} disabled={solveMutation.isPending || constraints.length === 0}>
                    {solveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    Solve
                  </Button>
                </div>

                {/* Solver Results */}
                {solveMutation.data && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-emerald-400" />
                      Solver Results
                    </h4>
                    {solveMutation.data.map((result, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{result.name}</span>
                          <Badge variant={result.constraintsSatisfied === result.constraintsTotal ? "default" : "secondary"}>
                            {result.constraintsSatisfied}/{result.constraintsTotal} constraints met
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{result.description}</p>
                        <p className="text-[10px] text-muted-foreground">Impact: {result.estimatedScoreImpact}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(result.overrides).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
