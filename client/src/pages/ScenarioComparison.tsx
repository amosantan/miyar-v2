import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { GitCompare, ArrowUpDown, TrendingUp, TrendingDown, Minus, FileText, Download } from "lucide-react";

export default function ScenarioComparison() {
  const [, params] = useRoute("/projects/:id/scenario-compare");
  const projectId = Number(params?.id);

  const [baselineId, setBaselineId] = useState<number | null>(null);
  const [comparedIds, setComparedIds] = useState<number[]>([]);
  const [decisionNote, setDecisionNote] = useState("");

  const scenarios = trpc.scenario.list.useQuery({ projectId }, { enabled: !!projectId });
  const comparisons = trpc.intelligence.scenarios.listComparisons.useQuery({ projectId }, { enabled: !!projectId });
  const utils = trpc.useUtils();

  const compareMut = trpc.intelligence.scenarios.compare.useMutation({
    onSuccess: () => {
      toast.success("Comparison generated");
      utils.intelligence.scenarios.listComparisons.invalidate();
      setComparedIds([]);
      setDecisionNote("");
    },
    onError: () => toast.error("Failed to generate comparison"),
  });

  const exportPDFMut = trpc.intelligence.scenarios.exportComparisonPDF.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Comparison Pack exported successfully");
      } else {
        toast.error("Export succeeded but no URL returned");
      }
    },
    onError: () => toast.error("Failed to export Comparison Pack"),
  });

  const scenarioList = scenarios.data ?? [];
  const comparisonList = comparisons.data ?? [];

  const toggleCompared = (id: number) => {
    if (id === baselineId) return;
    setComparedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deltaColor = (val: number) => {
    if (val > 2) return "text-green-500";
    if (val < -2) return "text-red-500";
    return "text-muted-foreground";
  };

  const deltaIcon = (val: number) => {
    if (val > 2) return <TrendingUp className="h-3 w-3" />;
    if (val < -2) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompare className="h-6 w-6 text-indigo-500" /> Scenario Comparison
        </h1>
        <p className="text-muted-foreground mt-1">
          Compare scenarios side-by-side with delta analysis
        </p>
      </div>

      {/* Create Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New Comparison</CardTitle>
          <CardDescription>Select a baseline and comparison scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          {scenarioList.length < 2 ? (
            <p className="text-sm text-muted-foreground">Need at least 2 scenarios to compare. Create scenarios in the Decision Lab first.</p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baseline</TableHead>
                    <TableHead>Compare</TableHead>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarioList.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <input
                          type="radio"
                          name="baseline"
                          checked={baselineId === s.id}
                          onChange={() => {
                            setBaselineId(s.id);
                            setComparedIds((prev) => prev.filter((x) => x !== s.id));
                          }}
                          className="accent-blue-500"
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={comparedIds.includes(s.id)}
                          onCheckedChange={() => toggleCompared(s.id)}
                          disabled={baselineId === s.id}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.isTemplate ? "Template" : "Custom"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Textarea
                placeholder="Decision note (optional) — why this comparison matters..."
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
              />

              <Button
                onClick={() => {
                  if (!baselineId || comparedIds.length === 0) {
                    toast.error("Select a baseline and at least one comparison scenario");
                    return;
                  }
                  compareMut.mutate({
                    projectId,
                    baselineScenarioId: baselineId,
                    comparedScenarioIds: comparedIds,
                    decisionNote: decisionNote || undefined,
                  });
                }}
                disabled={!baselineId || comparedIds.length === 0 || compareMut.isPending}
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {compareMut.isPending ? "Comparing..." : "Generate Comparison"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Comparison History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No comparisons yet</p>
          ) : (
            <div className="space-y-4">
              {comparisonList.map((comp) => {
                const result = comp.comparisonResult as {
                  baseline?: { scores?: Record<string, number> };
                  compared?: Array<{ scenarioId: number; deltas?: Record<string, number> }>;
                } | null;

                return (
                  <div key={comp.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-sm">
                          Baseline: Scenario #{comp.baselineScenarioId} vs{" "}
                          {(comp.comparedScenarioIds as number[])?.length ?? 0} scenario(s)
                        </p>
                        {comp.decisionNote && (
                          <p className="text-sm text-muted-foreground mt-1">{comp.decisionNote}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportPDFMut.mutate({ comparisonId: comp.id })}
                          disabled={exportPDFMut.isPending}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {exportPDFMut.isPending ? "Exporting..." : "Export Pack"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comp.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {result?.compared && result.compared.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Scenario</TableHead>
                            <TableHead>SA Δ</TableHead>
                            <TableHead>FF Δ</TableHead>
                            <TableHead>MP Δ</TableHead>
                            <TableHead>DS Δ</TableHead>
                            <TableHead>ER Δ</TableHead>
                            <TableHead>Composite Δ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.compared.map((c) => (
                            <TableRow key={c.scenarioId}>
                              <TableCell className="font-medium">#{c.scenarioId}</TableCell>
                              {["saScore", "ffScore", "mpScore", "dsScore", "erScore", "compositeScore"].map((f) => {
                                const val = c.deltas?.[f] ?? 0;
                                return (
                                  <TableCell key={f} className={deltaColor(val)}>
                                    <span className="flex items-center gap-1">
                                      {deltaIcon(val)}
                                      {val > 0 ? "+" : ""}{val.toFixed(1)}
                                    </span>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
