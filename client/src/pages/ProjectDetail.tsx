import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Zap,
  BarChart3,
  GitCompare,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function DecisionBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; label: string; cls: string }> = {
    validated: {
      icon: CheckCircle2,
      label: "Direction Validated",
      cls: "bg-miyar-teal/15 text-miyar-teal border-miyar-teal/30",
    },
    conditional: {
      icon: AlertTriangle,
      label: "Conditionally Validated",
      cls: "bg-miyar-gold/15 text-miyar-gold border-miyar-gold/30",
    },
    not_validated: {
      icon: XCircle,
      label: "Not Validated",
      cls: "bg-miyar-red/15 text-miyar-red border-miyar-red/30",
    },
  };
  const c = config[status] ?? config.conditional;
  const Icon = c.icon;
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${c.cls}`}
    >
      <Icon className="h-4 w-4" />
      {c.label}
    </div>
  );
}

function ProjectDetailContent() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const [, setLocation] = useLocation();

  const { data: project, isLoading } = trpc.project.get.useQuery({ id: projectId });
  const { data: scores } = trpc.project.getScores.useQuery({ projectId });
  const evaluateMutation = trpc.project.evaluate.useMutation();
  const utils = trpc.useUtils();

  const latestScore = scores?.[0];

  async function handleEvaluate() {
    try {
      await evaluateMutation.mutateAsync({ id: projectId });
      utils.project.get.invalidate({ id: projectId });
      utils.project.getScores.invalidate({ projectId });
      toast.success("Evaluation complete");
    } catch (e: any) {
      toast.error(e.message || "Evaluation failed");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Project not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setLocation("/projects")}
        >
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {project.ctx01Typology} · {project.mkt01Tier} ·{" "}
              {project.ctx04Location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleEvaluate}
            disabled={evaluateMutation.isPending}
            className="gap-2"
          >
            {evaluateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {evaluateMutation.isPending ? "Evaluating..." : "Evaluate"}
          </Button>
          {latestScore && (
            <>
              <Button
                variant="outline"
                onClick={() => setLocation(`/scenarios?project=${projectId}`)}
                className="gap-2"
              >
                <GitCompare className="h-4 w-4" /> Scenarios
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation(`/reports?project=${projectId}`)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" /> Report
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scores */}
      {latestScore ? (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Decision */}
          <Card className="md:col-span-3">
            <CardContent className="py-6 px-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <DecisionBadge status={latestScore.decisionStatus ?? "conditional"} />
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">
                        {Number(latestScore.compositeScore).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Composite
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">
                        {Number(latestScore.rasScore).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        RAS Score
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-miyar-gold">
                        {Number(latestScore.confidenceScore).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Confidence
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Risk Score:{" "}
                    <span className="text-foreground font-medium">
                      {Number(latestScore.riskScore).toFixed(1)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Evaluated:{" "}
                    {new Date(latestScore.computedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimension Scores */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Dimension Scores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreBar
                label="Strategic Alignment (SA)"
                value={Number(latestScore.saScore)}
                color="bg-miyar-teal"
              />
              <ScoreBar
                label="Financial Feasibility (FF)"
                value={Number(latestScore.ffScore)}
                color="bg-miyar-gold"
              />
              <ScoreBar
                label="Market Positioning (MP)"
                value={Number(latestScore.mpScore)}
                color="bg-miyar-emerald"
              />
              <ScoreBar
                label="Differentiation Strength (DS)"
                value={Number(latestScore.dsScore)}
                color="bg-primary"
              />
              <ScoreBar
                label="Execution Risk (ER)"
                value={Number(latestScore.erScore)}
                color="bg-miyar-amber"
              />
            </CardContent>
          </Card>

          {/* Risk Flags & Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Risk & Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Risk Flags */}
              {(latestScore.riskFlags as string[] | null)?.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Risk Flags
                  </p>
                  {(latestScore.riskFlags as string[]).map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-2 text-sm text-miyar-red"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {f}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No risk flags</p>
              )}

              {/* Penalties */}
              {(latestScore.penalties as any[] | null)?.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Penalties
                  </p>
                  {(latestScore.penalties as any[]).map((p: any) => (
                    <div
                      key={p.id}
                      className="text-xs p-2 rounded bg-destructive/10 text-destructive"
                    >
                      <span className="font-medium">{p.id}</span>: {p.description} ({p.effect})
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Conditional Actions */}
              {(latestScore.conditionalActions as any[] | null)?.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recommended Actions
                  </p>
                  {(latestScore.conditionalActions as any[]).map(
                    (a: any, i: number) => (
                      <div
                        key={i}
                        className="text-xs p-2 rounded bg-miyar-gold/10 text-miyar-gold"
                      >
                        {a.recommendation}
                      </div>
                    )
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              This project has not been evaluated yet. Click Evaluate to run the
              scoring engine.
            </p>
            <Button
              onClick={handleEvaluate}
              disabled={evaluateMutation.isPending}
              className="gap-2"
            >
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
              ["GFA", project.ctx03Gfa ? `${Number(project.ctx03Gfa).toLocaleString()} sqft` : "—"],
              ["Location", project.ctx04Location],
              ["Horizon", project.ctx05Horizon],
              ["Market Tier", project.mkt01Tier],
              ["Style", project.des01Style],
              ["Budget Cap", project.fin01BudgetCap ? `${Number(project.fin01BudgetCap)} AED/sqft` : "—"],
              ["Brand Clarity", `${project.str01BrandClarity}/5`],
              ["Differentiation", `${project.str02Differentiation}/5`],
              ["Material Level", `${project.des02MaterialLevel}/5`],
              ["Complexity", `${project.des03Complexity}/5`],
              ["Contractor", `${project.exe02Contractor}/5`],
              ["Supply Chain", `${project.exe01SupplyChain}/5`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-foreground font-medium">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
