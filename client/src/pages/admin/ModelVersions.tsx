
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Settings, Loader2, CheckCircle2, Clock } from "lucide-react";

function ModelVersionsContent() {
  const { data: versions, isLoading } = trpc.admin.modelVersions.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Model Versions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scoring model configurations and version history
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !versions || versions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Settings className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No model versions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {versions.map((v: any) => (
            <Card
              key={v.id}
              className={v.isActive ? "border-primary" : ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {v.isActive && (
                      <CheckCircle2 className="h-4 w-4 text-miyar-teal" />
                    )}
                    {v.versionTag}
                  </CardTitle>
                  {v.isActive ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-miyar-teal/15 text-miyar-teal border border-miyar-teal/30">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      Inactive
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Dimension Weights
                    </p>
                    <pre className="text-xs text-foreground mt-1 bg-secondary/30 rounded p-2 overflow-x-auto">
                      {JSON.stringify(v.dimensionWeights, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-foreground mt-1">
                      {v.notes || "No notes"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <div className="flex items-center gap-1 text-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(v.createdAt).toLocaleDateString()}
                    </div>
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

export default function ModelVersions() {
  return (
    <>
      <ModelVersionsContent />
    </>
  );
}
