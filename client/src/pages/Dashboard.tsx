
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  FolderKanban,
  PlusCircle,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Clock,
  Database,
  Shield,
  TrendingUp,
  GitBranch,
  Layers,
  LayoutDashboard,
  Activity,
  Search,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import DataFreshnessBanner from "@/components/DataFreshnessBanner";

function statusIcon(status: string) {
  if (status === "evaluated")
    return <BarChart3 className="h-4 w-4 text-miyar-teal" />;
  if (status === "locked")
    return <CheckCircle2 className="h-4 w-4 text-miyar-gold" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function decisionBadge(decision: string | null | undefined) {
  if (!decision) return <span className="text-xs text-muted-foreground italic">Not evaluated</span>;
  const colors: Record<string, string> = {
    validated: "bg-miyar-teal/15 text-miyar-teal border-miyar-teal/30",
    conditional: "bg-miyar-gold/15 text-miyar-gold border-miyar-gold/30",
    not_validated: "bg-miyar-red/15 text-miyar-red border-miyar-red/30",
  };
  const labels: Record<string, string> = {
    validated: "Validated",
    conditional: "Conditional",
    not_validated: "Not Validated",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border ${colors[decision] ?? "bg-muted text-muted-foreground"}`}
    >
      {labels[decision] ?? decision}
    </span>
  );
}

function DashboardContent() {
  const { data: projects, isLoading } = trpc.project.listWithScores.useQuery();
  const [, setLocation] = useLocation();

  // --- Ask MIYAR inline NL query state ---
  const [nlQuery, setNlQuery] = useState("");
  const [nlAnswer, setNlAnswer] = useState<string | null>(null);
  const nlMutation = trpc.autonomous.nlQuery.useMutation({
    onSuccess: (data) => setNlAnswer(data.textOutput),
    onError: (err) => setNlAnswer(`Error: ${err.message}`),
  });

  const handleAskMiyar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    setNlAnswer(null);
    nlMutation.mutate({ query: nlQuery.trim() });
  };
  // --- end NL query state ---

  const seedMutation = trpc.seed.seedProjects.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.seeded} sample project(s)`);
      utils.project.listWithScores.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();

  const evaluated = useMemo(() => projects?.filter((p) => p.status === "evaluated") ?? [], [projects]);
  const drafts = useMemo(() => projects?.filter((p) => p.status === "draft") ?? [], [projects]);
  const validatedCount = useMemo(() => projects?.filter((p) => p.latestScore?.decisionStatus === "validated").length ?? 0, [projects]);
  const conditionalCount = useMemo(() => projects?.filter((p) => p.latestScore?.decisionStatus === "conditional").length ?? 0, [projects]);
  const notValidatedCount = useMemo(() => projects?.filter((p) => p.latestScore?.decisionStatus === "not_validated").length ?? 0, [projects]);

  // V2 Intelligence metrics
  const avgComposite = useMemo(() => {
    if (!evaluated.length) return 0;
    const sum = evaluated.reduce((s, p) => s + (p.latestScore?.compositeScore ?? 0), 0);
    return sum / evaluated.length;
  }, [evaluated]);

  const avgRisk = useMemo(() => {
    if (!evaluated.length) return 0;
    const sum = evaluated.reduce((s, p) => s + (p.latestScore?.rasScore ?? 0), 0);
    return sum / evaluated.length;
  }, [evaluated]);

  const avgConfidence = useMemo(() => {
    if (!evaluated.length) return 0;
    const sum = evaluated.reduce((s, p) => s + (p.latestScore?.confidenceScore ?? 0), 0);
    return sum / evaluated.length;
  }, [evaluated]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Intelligence Dashboard"
        description="MIYAR Decision Intelligence Platform — Portfolio Overview"
        icon={LayoutDashboard}
        actions={
          <Button onClick={() => setLocation("/projects/new")} className="gap-2">
            <PlusCircle className="h-4 w-4" /> New Project
          </Button>
        }
      />

      {/* Data Freshness Strip */}
      <DataFreshnessBanner className="mb-0" />

      {/* Ask MIYAR — Inline NL Query Search Bar */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-miyar-teal/5">
        <CardContent className="pt-5 pb-4 px-5">
          <form onSubmit={handleAskMiyar} className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                placeholder="Ask MIYAR anything... e.g. 'Show projects with risk > 60' or 'What's my highest composite score?'"
                className="pl-10 pr-4 bg-background/80 border-border/50 focus-visible:ring-primary/30"
                disabled={nlMutation.isPending}
              />
            </div>
            <Button type="submit" size="sm" disabled={nlMutation.isPending || !nlQuery.trim()} className="gap-2 shrink-0">
              {nlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Ask
            </Button>
          </form>

          {/* Inline Answer */}
          {(nlAnswer || nlMutation.isPending) && (
            <div className="mt-4 rounded-lg border border-border bg-background/60 p-4 relative">
              {nlAnswer && (
                <button
                  onClick={() => { setNlAnswer(null); setNlQuery(""); }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              {nlMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Querying the intelligence engine...
                </div>
              ) : (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pr-6">
                  {nlAnswer}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Projects", value: projects?.length ?? 0, icon: FolderKanban, color: "text-primary" },
          { label: "Evaluated", value: evaluated.length, icon: BarChart3, color: "text-miyar-teal" },
          { label: "Validated", value: validatedCount, icon: CheckCircle2, color: "text-miyar-teal" },
          { label: "Conditional", value: conditionalCount, icon: AlertTriangle, color: "text-miyar-gold" },
          { label: "Not Validated", value: notValidatedCount, icon: XCircle, color: "text-miyar-red" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{isLoading ? "—" : s.value}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* V2 Intelligence Metrics Row */}
      {evaluated.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-miyar-teal/20">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Composite Score</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{avgComposite.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    across {evaluated.length} evaluated project{evaluated.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-miyar-teal/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-miyar-teal" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-miyar-gold/20">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Risk Score</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{avgRisk.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {avgRisk < 30 ? "Low portfolio risk" : avgRisk < 50 ? "Moderate portfolio risk" : "Elevated portfolio risk"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-miyar-gold/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-miyar-gold" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Confidence</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{avgConfidence.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {avgConfidence >= 70 ? "High data confidence" : avgConfidence >= 50 ? "Moderate data confidence" : "Low data confidence"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions — client workflow */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Create Project", path: "/projects/new", icon: PlusCircle, desc: "Start a new design evaluation" },
          { label: "Scenarios", path: "/scenarios", icon: GitBranch, desc: "What-if analysis & comparisons" },
          { label: "DLD Insights", path: "/market-intel/dld-insights", icon: TrendingUp, desc: "UAE area benchmarks" },
          { label: "Portfolio", path: "/portfolio", icon: Layers, desc: "Cross-project intelligence" },
        ].map((action) => (
          <Card
            key={action.path}
            className="cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setLocation(action.path)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <action.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">{action.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{action.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Projects</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/projects")}
              className="gap-1 text-xs"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : !projects || projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No projects yet. Create your first project or seed sample data.
              </p>
              <div className="flex gap-3 mt-4 justify-center">
                <Button variant="outline" size="sm" onClick={() => setLocation("/projects/new")}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Create Project
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  <Database className="h-4 w-4 mr-2" />
                  {seedMutation.isPending ? "Seeding..." : "Seed Sample Projects"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/projects/${p.id}`)}
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(p.status ?? "draft")}
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.ctx01Typology} · {p.mkt01Tier} · {p.ctx04Location}
                      </p>
                    </div>

                  </div>
                  <div className="flex items-center gap-3">
                    {p.latestScore ? (
                      <>
                        <span className="text-xs font-mono text-muted-foreground">
                          {p.latestScore.compositeScore.toFixed(1)}
                        </span>
                        {decisionBadge(p.latestScore.decisionStatus)}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Draft</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drafts needing attention */}
      {drafts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Drafts Awaiting Evaluation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {drafts.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/projects/${p.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.ctx01Typology} · {p.mkt01Tier}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">
                    Evaluate <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <>
      <DashboardContent />
    </>
  );
}
