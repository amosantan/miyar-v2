import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import {
  GitCompare,
  PlusCircle,
  Trash2,
  Crown,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const OVERRIDE_VARS = [
  { key: "des02MaterialLevel", label: "Material Level" },
  { key: "des03Complexity", label: "Design Complexity" },
  { key: "fin01BudgetCap", label: "Budget Cap (AED/sqft)", type: "numeric" },
  { key: "exe02Contractor", label: "Contractor Capability" },
  { key: "str01BrandClarity", label: "Brand Clarity" },
  { key: "mkt02Competitor", label: "Competitor Intensity" },
  { key: "des04Experience", label: "Experience Intensity" },
  { key: "exe01SupplyChain", label: "Supply Chain" },
];

function ScenariosContent() {
  const { data: projects } = trpc.project.list.useQuery();
  const evaluatedProjects = useMemo(
    () => projects?.filter((p) => p.status === "evaluated") ?? [],
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

  const createScenario = trpc.scenario.create.useMutation();
  const deleteScenario = trpc.scenario.delete.useMutation();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  async function handleCreate() {
    if (!projectId || !newName.trim()) return;
    try {
      await createScenario.mutateAsync({
        projectId,
        name: newName,
        description: newDesc,
        variableOverrides: overrides,
      });
      utils.scenario.list.invalidate({ projectId });
      utils.scenario.compare.invalidate({ projectId });
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
      setOverrides({});
      toast.success("Scenario created");
    } catch (e: any) {
      toast.error(e.message || "Failed to create scenario");
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Scenario Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run what-if scenarios and compare outcomes
          </p>
        </div>
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
                {evaluatedProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!projectId}>
                <PlusCircle className="h-4 w-4" /> New Scenario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Scenario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Scenario Name</Label>
                  <Input
                    placeholder="e.g., Premium Material Upgrade"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Brief description..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Variable Overrides
                  </Label>
                  {OVERRIDE_VARS.map((v) => (
                    <div key={v.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {v.label}
                        </span>
                        {overrides[v.key] !== undefined && (
                          <span className="text-primary text-xs font-medium">
                            {overrides[v.key]}
                          </span>
                        )}
                      </div>
                      {v.type === "numeric" ? (
                        <Input
                          type="number"
                          placeholder="Leave empty for no change"
                          value={overrides[v.key] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              setOverrides((o) => ({
                                ...o,
                                [v.key]: Number(val),
                              }));
                            } else {
                              setOverrides((o) => {
                                const { [v.key]: _, ...rest } = o;
                                return rest;
                              });
                            }
                          }}
                        />
                      ) : (
                        <Slider
                          min={1}
                          max={5}
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
                  disabled={!newName.trim() || createScenario.isPending}
                  className="w-full"
                >
                  {createScenario.isPending ? "Creating..." : "Create Scenario"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!projectId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <GitCompare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select an evaluated project to manage scenarios.
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
            <GitCompare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No scenarios yet. Create scenarios to compare different variable
              configurations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Scenario List */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarioList.map((s, i) => {
              const compResult = comparison?.[i];
              return (
                <Card
                  key={s.id}
                  className={`${compResult?.isDominant ? "border-miyar-teal" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {compResult?.isDominant && (
                          <Crown className="h-4 w-4 text-miyar-gold" />
                        )}
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
                      <p className="text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {compResult ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              RAS Score
                            </p>
                            <p className="text-lg font-bold text-primary">
                              {compResult.rasScore.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Stability
                            </p>
                            <p className="text-lg font-bold text-foreground">
                              {compResult.stabilityScore.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Decision:{" "}
                          <span
                            className={`font-medium ${
                              compResult.scoreResult.decisionStatus ===
                              "validated"
                                ? "text-miyar-teal"
                                : compResult.scoreResult.decisionStatus ===
                                  "conditional"
                                ? "text-miyar-gold"
                                : "text-miyar-red"
                            }`}
                          >
                            {compResult.scoreResult.decisionStatus}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Comparison pending...
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scenarios() {
  return (
    <DashboardLayout>
      <ScenariosContent />
    </DashboardLayout>
  );
}
