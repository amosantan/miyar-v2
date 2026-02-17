import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  XCircle,
  BarChart3,
  Layers,
} from "lucide-react";
import { useMemo } from "react";

const EXPECTED_TYPOLOGIES = ["Residential", "Mixed-use", "Hospitality", "Office"];
const EXPECTED_TIERS = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];
const EXPECTED_LOCATIONS = ["Prime", "Secondary", "Emerging"];
const EXPECTED_MATERIAL_LEVELS = [1, 2, 3, 4, 5];

interface BenchmarkRow {
  id: number;
  typology: string;
  location: string;
  marketTier: string;
  materialLevel: number;
  roomType: string | null;
  costPerSqftLow: string | null;
  costPerSqftMid: string | null;
  costPerSqftHigh: string | null;
  avgSellingPrice: string | null;
  absorptionRate: string | null;
  competitiveDensity: number | null;
  differentiationIndex: string | null;
  complexityMultiplier: string | null;
  timelineRiskMultiplier: string | null;
  sourceType: string | null;
  sourceNote: string | null;
  dataYear: number | null;
  region: string | null;
}

function analyzeHealth(benchmarks: BenchmarkRow[]) {
  const total = benchmarks.length;

  // Coverage analysis
  const coverageMap: Record<string, Set<string>> = {};
  const typologyCounts: Record<string, number> = {};
  const tierCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};
  const materialCounts: Record<number, number> = {};
  const sourceTypeCounts: Record<string, number> = {};

  for (const b of benchmarks) {
    const key = `${b.typology}|${b.marketTier}|${b.location}`;
    if (!coverageMap[key]) coverageMap[key] = new Set();
    coverageMap[key].add(String(b.materialLevel));

    typologyCounts[b.typology] = (typologyCounts[b.typology] || 0) + 1;
    tierCounts[b.marketTier] = (tierCounts[b.marketTier] || 0) + 1;
    locationCounts[b.location] = (locationCounts[b.location] || 0) + 1;
    materialCounts[b.materialLevel] = (materialCounts[b.materialLevel] || 0) + 1;
    const st = b.sourceType || "unknown";
    sourceTypeCounts[st] = (sourceTypeCounts[st] || 0) + 1;
  }

  // Missing combinations
  const missingCombinations: string[] = [];
  const totalExpected = EXPECTED_TYPOLOGIES.length * EXPECTED_TIERS.length * EXPECTED_LOCATIONS.length;
  let coveredCombinations = 0;
  for (const typ of EXPECTED_TYPOLOGIES) {
    for (const tier of EXPECTED_TIERS) {
      for (const loc of EXPECTED_LOCATIONS) {
        const key = `${typ}|${tier}|${loc}`;
        if (coverageMap[key] && coverageMap[key].size > 0) {
          coveredCombinations++;
        } else {
          missingCombinations.push(`${typ} / ${tier} / ${loc}`);
        }
      }
    }
  }
  const coveragePercent = Math.round((coveredCombinations / totalExpected) * 100);

  // Missing values analysis
  const missingFields: { field: string; count: number; percent: number }[] = [];
  const fields = [
    { key: "costPerSqftLow", label: "Cost/sqft Low" },
    { key: "costPerSqftMid", label: "Cost/sqft Mid" },
    { key: "costPerSqftHigh", label: "Cost/sqft High" },
    { key: "avgSellingPrice", label: "Avg Selling Price" },
    { key: "absorptionRate", label: "Absorption Rate" },
    { key: "differentiationIndex", label: "Differentiation Index" },
    { key: "complexityMultiplier", label: "Complexity Multiplier" },
    { key: "timelineRiskMultiplier", label: "Timeline Risk Multiplier" },
  ];
  for (const f of fields) {
    const missing = benchmarks.filter(
      (b) => (b as any)[f.key] === null || (b as any)[f.key] === undefined
    ).length;
    if (missing > 0) {
      missingFields.push({
        field: f.label,
        count: missing,
        percent: Math.round((missing / total) * 100),
      });
    }
  }

  // Outlier detection (cost values outside 2x IQR)
  const outliers: { id: number; field: string; value: number; reason: string }[] = [];
  const costMids = benchmarks
    .map((b) => ({ id: b.id, val: Number(b.costPerSqftMid) }))
    .filter((x) => !isNaN(x.val) && x.val > 0);

  if (costMids.length > 4) {
    const sorted = [...costMids].sort((a, b) => a.val - b.val);
    const q1 = sorted[Math.floor(sorted.length * 0.25)].val;
    const q3 = sorted[Math.floor(sorted.length * 0.75)].val;
    const iqr = q3 - q1;
    const lower = q1 - 2 * iqr;
    const upper = q3 + 2 * iqr;
    for (const cm of costMids) {
      if (cm.val < lower || cm.val > upper) {
        outliers.push({
          id: cm.id,
          field: "costPerSqftMid",
          value: cm.val,
          reason: cm.val < lower ? `Below Q1-2×IQR (${lower.toFixed(0)})` : `Above Q3+2×IQR (${upper.toFixed(0)})`,
        });
      }
    }
  }

  // Overall health score
  const completenessScore = total > 0 ? Math.min(100, (total / 48) * 100) : 0;
  const fieldCompleteness = total > 0 ? ((total * fields.length - missingFields.reduce((s, f) => s + f.count, 0)) / (total * fields.length)) * 100 : 0;
  const outlierPenalty = outliers.length > 0 ? Math.min(20, outliers.length * 5) : 0;
  const healthScore = Math.round(
    0.35 * coveragePercent +
    0.30 * completenessScore +
    0.25 * fieldCompleteness -
    0.10 * outlierPenalty
  );

  return {
    total,
    coveragePercent,
    coveredCombinations,
    totalExpected,
    missingCombinations,
    missingFields,
    outliers,
    typologyCounts,
    tierCounts,
    locationCounts,
    materialCounts,
    sourceTypeCounts,
    healthScore: Math.max(0, Math.min(100, healthScore)),
  };
}

function HealthBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Healthy ({score}%)</Badge>;
  if (score >= 50) return <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30"><AlertTriangle className="h-3 w-3 mr-1" /> Needs Attention ({score}%)</Badge>;
  return <Badge className="bg-red-600/20 text-red-400 border-red-600/30"><XCircle className="h-3 w-3 mr-1" /> Critical ({score}%)</Badge>;
}

export default function BenchmarkHealth() {
  const { data: benchmarks, isLoading } = trpc.admin.benchmarks.list.useQuery({});

  const health = useMemo(() => {
    if (!benchmarks || benchmarks.length === 0) return null;
    return analyzeHealth(benchmarks as unknown as BenchmarkRow[]);
  }, [benchmarks]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Benchmark Health Check</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Coverage analysis, missing values, outlier detection, and data quality metrics
            </p>
          </div>
          {health && <HealthBadge score={health.healthScore} />}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {health && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{health.total}</p>
                      <p className="text-xs text-muted-foreground">Total Records</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-miyar-teal" />
                    <div>
                      <p className="text-2xl font-bold">{health.coveragePercent}%</p>
                      <p className="text-xs text-muted-foreground">Combination Coverage</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-miyar-amber" />
                    <div>
                      <p className="text-2xl font-bold">{health.missingFields.length}</p>
                      <p className="text-xs text-muted-foreground">Fields with Gaps</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-miyar-red" />
                    <div>
                      <p className="text-2xl font-bold">{health.outliers.length}</p>
                      <p className="text-xs text-muted-foreground">Outliers Detected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coverage by Dimension */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Coverage by Dimension</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Typology</span>
                    <span>{Object.keys(health.typologyCounts).length}/{EXPECTED_TYPOLOGIES.length}</span>
                  </div>
                  <Progress value={(Object.keys(health.typologyCounts).length / EXPECTED_TYPOLOGIES.length) * 100} className="h-2" />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {EXPECTED_TYPOLOGIES.map((t) => (
                      <Badge key={t} variant={health.typologyCounts[t] ? "default" : "outline"} className="text-xs">
                        {t}: {health.typologyCounts[t] || 0}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Market Tier</span>
                    <span>{Object.keys(health.tierCounts).length}/{EXPECTED_TIERS.length}</span>
                  </div>
                  <Progress value={(Object.keys(health.tierCounts).length / EXPECTED_TIERS.length) * 100} className="h-2" />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {EXPECTED_TIERS.map((t) => (
                      <Badge key={t} variant={health.tierCounts[t] ? "default" : "outline"} className="text-xs">
                        {t}: {health.tierCounts[t] || 0}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Location</span>
                    <span>{Object.keys(health.locationCounts).length}/{EXPECTED_LOCATIONS.length}</span>
                  </div>
                  <Progress value={(Object.keys(health.locationCounts).length / EXPECTED_LOCATIONS.length) * 100} className="h-2" />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {EXPECTED_LOCATIONS.map((l) => (
                      <Badge key={l} variant={health.locationCounts[l] ? "default" : "outline"} className="text-xs">
                        {l}: {health.locationCounts[l] || 0}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Material Level</span>
                    <span>{Object.keys(health.materialCounts).length}/{EXPECTED_MATERIAL_LEVELS.length}</span>
                  </div>
                  <Progress value={(Object.keys(health.materialCounts).length / EXPECTED_MATERIAL_LEVELS.length) * 100} className="h-2" />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {EXPECTED_MATERIAL_LEVELS.map((m) => (
                      <Badge key={m} variant={health.materialCounts[m] ? "default" : "outline"} className="text-xs">
                        L{m}: {health.materialCounts[m] || 0}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Source Distribution */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Data Source Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-wrap">
                  {Object.entries(health.sourceTypeCounts).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${
                        type === "synthetic" ? "bg-miyar-amber" :
                        type === "client_provided" ? "bg-miyar-teal" :
                        type === "curated" ? "bg-miyar-emerald" : "bg-muted"
                      }`} />
                      <span className="text-sm capitalize">{type}: <strong>{count}</strong></span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Missing Values */}
            {health.missingFields.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-miyar-amber" />
                    Missing Values
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {health.missingFields.map((f) => (
                      <div key={f.field} className="flex items-center justify-between">
                        <span className="text-sm">{f.field}</span>
                        <div className="flex items-center gap-3">
                          <Progress value={100 - f.percent} className="h-2 w-32" />
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {f.count} missing ({f.percent}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outliers */}
            {health.outliers.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-miyar-red" />
                    Outliers Detected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {health.outliers.map((o, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-secondary/50">
                        <span>Record #{o.id} — {o.field}: <strong>{o.value}</strong></span>
                        <Badge variant="outline" className="text-xs text-miyar-red border-miyar-red/30">{o.reason}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Missing Combinations */}
            {health.missingCombinations.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">
                    Missing Combinations ({health.missingCombinations.length} of {health.totalExpected})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {health.missingCombinations.slice(0, 24).map((c) => (
                      <div key={c} className="text-xs text-muted-foreground p-2 rounded bg-secondary/30 border border-border">
                        {c}
                      </div>
                    ))}
                    {health.missingCombinations.length > 24 && (
                      <div className="text-xs text-muted-foreground p-2">
                        ...and {health.missingCombinations.length - 24} more
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!isLoading && (!benchmarks || benchmarks.length === 0) && (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Benchmark Data</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Seed benchmark data from the admin panel to enable health checks.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
