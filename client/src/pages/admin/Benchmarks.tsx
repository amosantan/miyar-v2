import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Database, Loader2 } from "lucide-react";

function BenchmarksContent() {
  const { data: benchmarks, isLoading } = trpc.admin.benchmarks.list.useQuery({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Benchmarks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reference data used for scoring normalization and comparison
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !benchmarks || benchmarks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Database className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No benchmark data available.</p>
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
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                      Avg Cost
                    </th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                      Avg Score
                    </th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                      Sample Size
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b: any) => (
                    <tr
                      key={b.id}
                      className="border-b border-border/50 hover:bg-secondary/30"
                    >
                      <td className="py-2 px-3 text-foreground">{b.region}</td>
                      <td className="py-2 px-3 text-foreground">{b.typology}</td>
                      <td className="py-2 px-3 text-foreground">{b.tier}</td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {b.avgCostPerSqft ? Number(b.avgCostPerSqft).toFixed(0) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {b.avgScore ? Number(b.avgScore).toFixed(1) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {b.sampleSize ?? "—"}
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
