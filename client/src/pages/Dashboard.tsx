import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Clock3, FolderKanban, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatAiOperationError, withReference } from "@/lib/ai-operation-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/PageSkeleton";
import DataFreshnessBanner from "@/components/DataFreshnessBanner";

export default function Dashboard() {
  const { data: projects, isLoading } = trpc.project.listWithScores.useQuery();
  const [, setLocation] = useLocation();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const ask = trpc.autonomous.nlQuery.useMutation({ onSuccess: data => setAnswer(data.textOutput), onError: error => setAnswer(withReference(formatAiOperationError(error, "I could not process that request. Please try again."))) });

  const evaluated = useMemo(() => projects?.filter(project => project.latestScore) ?? [], [projects]);
  const attention = useMemo(() => projects?.filter(project => !project.latestScore || project.latestScore.decisionStatus !== "validated") ?? [], [projects]);
  const average = evaluated.length ? evaluated.reduce((sum, project) => sum + (project.latestScore?.compositeScore ?? 0), 0) / evaluated.length : null;

  if (isLoading) return <PageSkeleton showTable />;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-primary">Portfolio overview</p><h1 className="mt-1 font-serif text-4xl tracking-tight">Good decisions start here.</h1><p className="mt-2 text-sm text-muted-foreground">Focus on the projects and assumptions that need your attention next.</p></div>
        <Button onClick={() => setLocation("/projects/new")} className="gap-2"><Plus className="h-4 w-4" /> New Project</Button>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-lg">Needs attention</CardTitle><p className="mt-1 text-sm text-muted-foreground">Drafts, conditions and unresolved decisions</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{attention.length}</span></CardHeader>
          <CardContent>
            {attention.length === 0 ? <Empty icon={CheckCircle2} title="Nothing urgent" copy="All evaluated projects are currently validated." /> : <div className="divide-y divide-border">{attention.slice(0, 6).map(project => <button key={project.id} onClick={() => setLocation(`/projects/${project.id}`)} className="flex w-full items-center justify-between gap-4 py-3 text-left first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3">{project.latestScore ? <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--accent-warm)]" /> : <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="truncate text-sm font-medium">{project.name}</p><p className="truncate text-xs text-muted-foreground">{project.latestScore ? `${formatDecision(project.latestScore.decisionStatus)} · review conditions` : "Complete inputs and run first evaluation"}</p></div></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-lg">Portfolio summary</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3"><Metric label="Projects" value={projects?.length ?? 0} /><Metric label="Evaluated" value={evaluated.length} /><Metric label="Average score" value={average === null ? "—" : average.toFixed(1)} /></CardContent></Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-lg">Active projects</CardTitle><p className="mt-1 text-sm text-muted-foreground">Current status and next action</p></div><Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Button></CardHeader>
          <CardContent>
            {!projects?.length ? <Empty icon={FolderKanban} title="Create your first project" copy="Start with six project details and complete the readiness checklist next." action={<Button size="sm" onClick={() => setLocation("/projects/new")}>Start a project</Button>} /> : <div className="grid gap-3 md:grid-cols-2">{projects.slice(0, 6).map(project => <button key={project.id} onClick={() => setLocation(`/projects/${project.id}`)} className="rounded-xl border border-border p-4 text-left transition-colors hover:border-primary"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{project.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{project.ctx01Typology} · {project.ctx04Location}</p></div><ProjectStatus project={project} /></div><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>{project.latestScore ? `Score ${project.latestScore.compositeScore.toFixed(1)}` : "Readiness required"}</span><span>{new Date(project.updatedAt).toLocaleDateString()}</span></div></button>)}</div>}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card><CardHeader><CardTitle className="text-lg">Market context</CardTitle></CardHeader><CardContent className="space-y-4"><DataFreshnessBanner className="mb-0" /><Button variant="outline" className="w-full" onClick={() => setLocation("/market-intel/dld-insights")}>Open UAE market evidence</Button></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Ask about this portfolio</h2></div><form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); if (question.trim()) { setAnswer(null); ask.mutate({ query: question.trim() }); } }}><Input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Which projects need review?" /><Button size="icon" disabled={!question.trim() || ask.isPending} aria-label="Ask MIYAR">{ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></form>{answer && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{answer}</p>}</CardContent></Card>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-secondary/70 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>; }
function Empty({ icon: Icon, title, copy, action }: { icon: typeof FolderKanban; title: string; copy: string; action?: React.ReactNode }) { return <div className="py-8 text-center"><Icon className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{copy}</p>{action && <div className="mt-4">{action}</div>}</div>; }
function formatDecision(value: string | null | undefined) { return value ? value.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase()) : "Not evaluated"; }
function ProjectStatus({ project }: { project: any }) { const validated = project.latestScore?.decisionStatus === "validated"; return <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${validated ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"}`}>{project.latestScore ? formatDecision(project.latestScore.decisionStatus) : "Draft"}</span>; }
