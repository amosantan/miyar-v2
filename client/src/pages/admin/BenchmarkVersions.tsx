import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Plus, CheckCircle2, GitBranch, ArrowRightLeft } from "lucide-react";
import { useState } from "react";

export default function BenchmarkVersions() {
  const { data: versions, isLoading } = trpc.admin.benchmarkVersions.list.useQuery();
  const { data: activeVersion } = trpc.admin.benchmarkVersions.active.useQuery();
  const [newTag, setNewTag] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [diffOld, setDiffOld] = useState<number | null>(null);
  const [diffNew, setDiffNew] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const createMutation = trpc.admin.benchmarkVersions.create.useMutation({
    onSuccess: () => {
      toast.success("Version created");
      utils.admin.benchmarkVersions.list.invalidate();
      setNewTag("");
      setNewDesc("");
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = trpc.admin.benchmarkVersions.publish.useMutation({
    onSuccess: () => {
      toast.success("Version published as active");
      utils.admin.benchmarkVersions.list.invalidate();
      utils.admin.benchmarkVersions.active.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: diffData } = trpc.admin.benchmarkVersions.diff.useQuery(
    { oldVersionId: diffOld!, newVersionId: diffNew! },
    { enabled: diffOld != null && diffNew != null }
  );

  const { data: impactData } = trpc.admin.benchmarkVersions.impactPreview.useQuery(
    { versionId: diffNew! },
    { enabled: diffNew != null }
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Benchmark Versions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage benchmark dataset versions. Active version: <Badge variant="default">{activeVersion?.versionTag || "—"}</Badge>
          </p>
        </div>

        {/* Create New Version */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Version Tag</label>
                <Input
                  placeholder="e.g. v2.1-Q1-2026"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <Input
                  placeholder="Optional description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <Button
                onClick={() => createMutation.mutate({ versionTag: newTag, description: newDesc })}
                disabled={!newTag || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Version List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              All Versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !versions || versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No versions found.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-3">
                      {v.status === "published" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {v.versionTag}
                          {v.status === "published" && <Badge variant="default" className="ml-2 text-[10px]">Active</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.description || "No description"} • Created {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (activeVersion) {
                            setDiffOld(activeVersion.id);
                            setDiffNew(v.id);
                          }
                        }}
                        disabled={v.status === "published" || !activeVersion}
                      >
                        <ArrowRightLeft className="h-3 w-3 mr-1" />
                        Diff
                      </Button>
                      {v.status !== "published" && (
                        <Button
                          size="sm"
                          onClick={() => publishMutation.mutate({ id: v.id })}
                          disabled={publishMutation.isPending}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diff Results */}
        {diffData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Benchmark Diff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                  <p className="text-2xl font-bold text-emerald-400">{diffData.added}</p>
                  <p className="text-xs text-muted-foreground">Added</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-500/10">
                  <p className="text-2xl font-bold text-amber-400">{diffData.changed}</p>
                  <p className="text-xs text-muted-foreground">Changed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-400">{diffData.removed}</p>
                  <p className="text-xs text-muted-foreground">Removed</p>
                </div>
              </div>

              {impactData && impactData.affectedProjects.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm font-medium text-amber-400">
                    Impact Preview: {impactData.affectedProjects.length} of {impactData.totalProjects} projects may be affected
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Change ratio: {((impactData.changeRatio || 0) * 100).toFixed(1)}% of benchmarks modified
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
