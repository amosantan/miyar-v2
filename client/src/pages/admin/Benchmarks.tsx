import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Database, Loader2, Sparkles, Layers, Beaker } from "lucide-react";
import { useState } from "react";

interface BenchmarkRow {
  id: number;
  region: string;
  typology: string;
  location: string;
  marketTier: string;
  materialLevel: number;
  roomType: string | null;
  costPerSqftLow: string | null;
  costPerSqftMid: string | null;
  costPerSqftHigh: string | null;
  absorptionRate: string | null;
  sourceType: string | null;
  sourceNote: string | null;
  dataYear: number | null;
}

function SourceBadge({ type }: { type: string | null }) {
  const config: Record<string, { label: string; className: string }> = {
    curated: {
      label: "Curated",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    synthetic: {
      label: "Synthetic",
      className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    client_provided: {
      label: "Client",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
  };

  const c = config[type || "synthetic"] || config.synthetic;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}
    >
      {c.label}
    </span>
  );
}

function BenchmarksContent() {
  const { data: benchmarks, isLoading, refetch } = trpc.admin.benchmarks.list.useQuery({});
  const [seeding, setSeeding] = useState(false);
  const [gapFilling, setGapFilling] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const seedMutation = trpc.admin.seedBenchmarks.useMutation({
    onSuccess: (result) => {
      setLastResult(`Seeded: ${result.created} created, ${result.skipped} skipped`);
      setSeeding(false);
      refetch();
    },
    onError: (err) => {
      setLastResult(`Seed error: ${err.message}`);
      setSeeding(false);
    },
  });

  const gapFillMutation = trpc.admin.generateSyntheticBenchmarks.useMutation({
    onSuccess: (result) => {
      setLastResult(`Gap-fill: ${result.generated} generated from ${result.gapsBefore} gaps`);
      setGapFilling(false);
      refetch();
    },
    onError: (err) => {
      setLastResult(`Gap-fill error: ${err.message}`);
      setGapFilling(false);
    },
  });

  const handleSeed = () => {
    setSeeding(true);
    setLastResult(null);
    seedMutation.mutate();
  };

  const handleGapFill = () => {
    setGapFilling(true);
    setLastResult(null);
    gapFillMutation.mutate();
  };

  // Count by source type
  const counts = (benchmarks || []).reduce(
    (acc: Record<string, number>, b: BenchmarkRow) => {
      const t = b.sourceType || "synthetic";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Benchmarks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reference data used for scoring normalization and comparison
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Layers className="h-4 w-4 mr-2" />
            )}
            Seed Benchmarks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGapFill}
            disabled={gapFilling}
          >
            {gapFilling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Beaker className="h-4 w-4 mr-2" />
            )}
            Fill Gaps
          </Button>
        </div>
      </div>

      {/* Result toast */}
      {lastResult && (
        <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          {lastResult}
        </div>
      )}

      {/* Source type summary */}
      {benchmarks && benchmarks.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total: <strong className="text-foreground">{benchmarks.length}</strong></span>
          {Object.entries(counts).map(([type, count]) => (
            <span key={type} className="flex items-center gap-1.5">
              <SourceBadge type={type} />
              <span>{count}</span>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !benchmarks || benchmarks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Database className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No benchmark data available.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Click "Seed Benchmarks" to generate curated data, then "Fill Gaps" for coverage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Benchmark Records ({benchmarks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Region
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Typology
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Tier
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Room
                    </th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                      Cost/sqft (Mid)
                    </th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                      Level
                    </th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b: BenchmarkRow) => (
                    <tr
                      key={b.id}
                      className="border-b border-border/50 hover:bg-secondary/30"
                      title={b.sourceNote || undefined}
                    >
                      <td className="py-2 px-3 text-foreground">{b.region}</td>
                      <td className="py-2 px-3 text-foreground">{b.typology}</td>
                      <td className="py-2 px-3 text-foreground">{b.marketTier || "—"}</td>
                      <td className="py-2 px-3 text-foreground text-xs">{b.roomType || "General"}</td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {b.costPerSqftMid ? `AED ${Number(b.costPerSqftMid).toFixed(0)}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {b.materialLevel ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <SourceBadge type={b.sourceType} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Benchmarks() {
  return (
    <DashboardLayout>
      <BenchmarksContent />
    </DashboardLayout>
  );
}
