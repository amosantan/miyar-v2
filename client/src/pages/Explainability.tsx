import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  FileJson,
  Shield,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export default function Explainability() {
  const [, params] = useRoute("/projects/:id/explainability");
  const projectId = Number(params?.id);

  const explainability = trpc.intelligence.explainability.generate.useQuery({ projectId }, { enabled: !!projectId });
  const auditPackMut = trpc.intelligence.explainability.auditPack.useMutation({
    onSuccess: (data) => {
      if ("url" in data && data.url) {
        window.open(data.url, "_blank");
        toast.success("Audit pack generated and uploaded");
      }
    },
    onError: () => toast.error("Failed to generate audit pack"),
  });

  const data = explainability.data;

  if (explainability.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No explainability data available. Evaluate the project first.</p>
        </CardContent>
      </Card>
    );
  }

  const directionIcon = (d: string) => {
    if (d === "positive") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (d === "negative") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-purple-500" /> Explainability Report
          </h1>
          <p className="text-muted-foreground mt-1">
            Per-output drivers explaining why each score was assigned
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => auditPackMut.mutate({ projectId })}
          disabled={auditPackMut.isPending}
        >
          <FileJson className="h-4 w-4 mr-2" />
          {auditPackMut.isPending ? "Generating..." : "Export Audit Pack"}
        </Button>
      </div>

      {/* Decision Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Decision Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{data.compositeScore.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Composite Score</p>
            </div>
            <div className="text-center">
              <Badge
                variant={
                  data.decisionStatus === "Validated"
                    ? "default"
                    : data.decisionStatus === "Conditional"
                    ? "secondary"
                    : "destructive"
                }
                className="text-lg px-4 py-1"
              >
                {data.decisionStatus}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">Decision Status</p>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              <p>Benchmark: {data.benchmarkVersionUsed}</p>
              <p>Logic: {data.logicVersionUsed}</p>
              <p className="text-xs mt-1">{new Date(data.generatedAt).toLocaleString()}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{data.decisionRationale}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="dimensions">
        <TabsList>
          <TabsTrigger value="dimensions">Dimension Breakdown</TabsTrigger>
          <TabsTrigger value="drivers">Top Drivers</TabsTrigger>
          <TabsTrigger value="risks">Top Risks</TabsTrigger>
          <TabsTrigger value="confidence">Confidence</TabsTrigger>
        </TabsList>

        <TabsContent value="dimensions" className="space-y-4">
          {data.dimensions.map((dim) => (
            <Card key={dim.dimension}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{dim.label}</CardTitle>
                    <CardDescription>{dim.summary}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{dim.score.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Weight: {(dim.weight * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={dim.score} className="mb-4" />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variable</TableHead>
                      <TableHead className="text-center">Raw Value</TableHead>
                      <TableHead className="text-center">Normalized</TableHead>
                      <TableHead className="text-center">Contribution</TableHead>
                      <TableHead className="text-center">Direction</TableHead>
                      <TableHead>Explanation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dim.drivers.map((driver) => {
                      const rawVal = driver.value;
                      const numVal = typeof rawVal === "number" ? rawVal : (typeof rawVal === "string" ? parseFloat(rawVal) || 0 : 0);
                      const normalized = numVal ? ((numVal / 5) * 100).toFixed(0) : "—";
                      return (
                        <TableRow key={driver.variable}>
                          <TableCell className="font-medium">{driver.label}</TableCell>
                          <TableCell className="text-center font-mono">
                            {rawVal !== undefined && rawVal !== null ? String(rawVal) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center font-mono">{normalized}%</TableCell>
                          <TableCell className="text-center font-mono">
                            {driver.contribution !== undefined ? driver.contribution.toFixed(2) : "0.00"}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {directionIcon(driver.direction)}
                              <span className="text-xs capitalize">{driver.direction}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-sm">{driver.explanation}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="drivers">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" /> Top Positive Drivers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topDrivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No strong positive drivers identified</p>
              ) : (
                <div className="space-y-3">
                  {data.topDrivers.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">{d.label}</p>
                        <p className="text-sm text-muted-foreground">{d.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Top Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No significant risk factors identified</p>
              ) : (
                <div className="space-y-3">
                  {data.topRisks.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <TrendingDown className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-medium">{d.label}</p>
                        <p className="text-sm text-muted-foreground">{d.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confidence">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" /> Confidence Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{data.confidenceExplanation}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
