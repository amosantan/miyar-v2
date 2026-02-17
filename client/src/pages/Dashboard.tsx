import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
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
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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

  const seedMutation = trpc.seed.seedProjects.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.seeded} sample project(s)`);
      utils.project.listWithScores.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();

  const evaluated = projects?.filter((p) => p.status === "evaluated") ?? [];
  const drafts = projects?.filter((p) => p.status === "draft") ?? [];
  const validatedCount = projects?.filter((p) => p.latestScore?.decisionStatus === "validated").length ?? 0;
  const conditionalCount = projects?.filter((p) => p.latestScore?.decisionStatus === "conditional").length ?? 0;
  const notValidatedCount = projects?.filter((p) => p.latestScore?.decisionStatus === "not_validated").length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your MIYAR projects and evaluations
          </p>
        </div>
        <Button onClick={() => setLocation("/projects/new")} className="gap-2">
          <PlusCircle className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Projects",
            value: projects?.length ?? 0,
            icon: FolderKanban,
            color: "text-primary",
          },
          { label: "Evaluated", value: evaluated.length, icon: BarChart3, color: "text-miyar-teal" },
          { label: "Validated", value: validatedCount, icon: CheckCircle2, color: "text-miyar-teal" },
          { label: "Conditional", value: conditionalCount, icon: AlertTriangle, color: "text-miyar-gold" },
          { label: "Not Validated", value: notValidatedCount, icon: XCircle, color: "text-miyar-red" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {isLoading ? "—" : s.value}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </div>
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
                <div
                  key={i}
                  className="h-14 rounded-lg bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : !projects || projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No projects yet. Create your first project or seed sample data.
              </p>
              <div className="flex gap-3 mt-4 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/projects/new")}
                >
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
                      <p className="text-sm font-medium text-foreground">
                        {p.name}
                      </p>
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
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
