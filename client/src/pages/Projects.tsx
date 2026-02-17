import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  PlusCircle,
  FolderKanban,
  BarChart3,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function ProjectsContent() {
  const { data: projects, isLoading } = trpc.project.list.useQuery();
  const deleteProject = trpc.project.delete.useMutation();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProject.mutateAsync({ id });
      utils.project.list.invalidate();
      toast.success("Project deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All your MIYAR validation projects
          </p>
        </div>
        <Button onClick={() => setLocation("/projects/new")} className="gap-2">
          <PlusCircle className="h-4 w-4" /> New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No projects yet. Create your first project to begin.
            </p>
            <Button onClick={() => setLocation("/projects/new")} className="gap-2">
              <PlusCircle className="h-4 w-4" /> Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/projects/${p.id}`)}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {p.status === "evaluated" ? (
                        <BarChart3 className="h-5 w-5 text-primary" />
                      ) : (
                        <FolderKanban className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.ctx01Typology} · {p.mkt01Tier} · {p.ctx04Location} ·{" "}
                        {p.des01Style}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.status === "evaluated" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-miyar-teal/15 text-miyar-teal border border-miyar-teal/30">
                        Evaluated
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        Draft
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id, p.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  return (
    <DashboardLayout>
      <ProjectsContent />
    </DashboardLayout>
  );
}
