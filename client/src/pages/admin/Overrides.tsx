import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

function OverridesContent() {
  const { data: projects } = trpc.project.list.useQuery();
  const [selectedId, setSelectedId] = useState<string>("");
  const projectId = selectedId
    ? Number(selectedId)
    : projects?.[0]?.id;

  const { data: overrides, isLoading } = trpc.admin.overrides.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overrides</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Human override records for scoring adjustments
          </p>
        </div>
        {projects && projects.length > 0 && (
          <Select
            value={selectedId || String(projects[0]?.id ?? "")}
            onValueChange={setSelectedId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
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
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select a project to view override records.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !overrides || overrides.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              No override records for this project.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {overrides.map((o: any) => (
            <Card key={o.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-miyar-gold/15 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-miyar-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {o.overrideType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Authority Level: {o.authorityLevel} · By User #{o.userId}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="text-foreground font-mono text-xs mt-1">
                      {JSON.stringify(o.originalValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Override</p>
                    <p className="text-primary font-mono text-xs mt-1">
                      {JSON.stringify(o.overrideValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Justification
                    </p>
                    <p className="text-foreground text-xs mt-1">
                      {o.justification}
                    </p>
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

export default function Overrides() {
  return (
    <DashboardLayout>
      <OverridesContent />
    </DashboardLayout>
  );
}
