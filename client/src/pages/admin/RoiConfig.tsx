import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, DollarSign, Settings, Save } from "lucide-react";
import { useState, useEffect } from "react";

const COEFFICIENT_LABELS: Record<string, { label: string; description: string; unit: string }> = {
  hourlyRate: { label: "Hourly Rate", description: "Professional hourly rate for time-value calculations", unit: "AED" },
  reworkCostPct: { label: "Rework Cost %", description: "Percentage of budget at risk from rework", unit: "%" },
  tenderIterationCost: { label: "Tender Iteration Cost", description: "Cost per tender round", unit: "AED" },
  designCycleCost: { label: "Design Cycle Cost", description: "Cost per design iteration cycle", unit: "AED" },
  budgetVarianceMultiplier: { label: "Budget Variance Multiplier", description: "Base budget variance band", unit: "x" },
  timeAccelerationWeeks: { label: "Time Acceleration (weeks)", description: "Maximum weeks of timeline acceleration", unit: "weeks" },
  conservativeMultiplier: { label: "Conservative Multiplier", description: "Multiplier for conservative scenario", unit: "x" },
  aggressiveMultiplier: { label: "Aggressive Multiplier", description: "Multiplier for aggressive scenario", unit: "x" },
};

export default function RoiConfig() {
  const { data: configs, isLoading } = trpc.admin.roiConfigs.list.useQuery();
  const { data: activeConfig } = trpc.admin.roiConfigs.active.useQuery();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const updateMutation = trpc.admin.roiConfigs.update.useMutation({
    onSuccess: () => {
      toast.success("ROI configuration updated");
      utils.admin.roiConfigs.list.invalidate();
      utils.admin.roiConfigs.active.invalidate();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const startEdit = (config: any) => {
    setEditingId(config.id);
    setEditValues({
      hourlyRate: String(config.hourlyRate),
      reworkCostPct: String(config.reworkCostPct),
      tenderIterationCost: String(config.tenderIterationCost),
      designCycleCost: String(config.designCycleCost),
      budgetVarianceMultiplier: String(config.budgetVarianceMultiplier),
      timeAccelerationWeeks: String(config.timeAccelerationWeeks ?? 6),
      conservativeMultiplier: String(config.conservativeMultiplier),
      aggressiveMultiplier: String(config.aggressiveMultiplier),
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const updates: Record<string, number> = {};
    for (const [key, val] of Object.entries(editValues)) {
      const num = parseFloat(val);
      if (!isNaN(num)) updates[key] = num;
    }
    updateMutation.mutate({ id: editingId, ...updates });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ROI Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the coefficients used by the ROI Narrative Engine
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !configs || configs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No ROI configurations found.
            </CardContent>
          </Card>
        ) : (
          configs.map((config) => (
            <Card key={config.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    {config.name}
                    {config.isActive && <Badge variant="default" className="text-[10px]">Active</Badge>}
                  </CardTitle>
                  {editingId === config.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(config)}>
                      <Settings className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(COEFFICIENT_LABELS).map(([key, meta]) => (
                    <div key={key} className="p-3 rounded-lg bg-muted/20 border border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-1">{meta.label}</p>
                      {editingId === config.id ? (
                        <Input
                          type="number"
                          step="any"
                          value={editValues[key] || ""}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">
                          {Number((config as any)[key]).toLocaleString()} <span className="text-xs text-muted-foreground">{meta.unit}</span>
                        </p>
                      )}
                      <p className="text-[9px] text-muted-foreground/60 mt-1">{meta.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
