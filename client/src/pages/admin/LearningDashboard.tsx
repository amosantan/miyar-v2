import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, CheckCircle, BrainCircuit } from "lucide-react";
import { useState } from "react";

export default function LearningDashboard() {
    const ledger = trpc.learning.getAccuracyLedger.useQuery();
    const history = trpc.learning.getAccuracyHistory.useQuery({ limit: 10 });
    const pendingBenchmarks = trpc.learning.getPendingBenchmarkSuggestions.useQuery();
    const pendingLogic = trpc.learning.getPendingLogicProposals.useQuery();

    const utils = trpc.useUtils();

    const reviewMut = trpc.intelligence.benchmarkLearning.reviewSuggestion.useMutation({
        onSuccess: () => {
            toast.success("Benchmark suggestion reviewed");
            utils.learning.getPendingBenchmarkSuggestions.invalidate();
        },
        onError: () => toast.error("Failed to review suggestion")
    });

    const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

    const lData = ledger.data;
    const hData = history.data ?? [];
    const pBenchmarks = pendingBenchmarks.data ?? [];
    const pLogic = pendingLogic.data ?? [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-indigo-500" /> Learning Intelligence
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        V5 Predictive Engine Platform Accuracy & Automated Learning Proposals
                    </p>
                </div>
            </div>

            {/* Accuracy Ledger Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6 relative">
                        <TrendingUp className="h-6 w-6 text-indigo-500 absolute top-6 right-6 opacity-20" />
                        <p className="text-sm font-medium text-muted-foreground mb-1">Overall Platform Accuracy</p>
                        <p className="text-3xl font-bold">{lData ? Number(lData.overallPlatformAccuracy).toFixed(1) : "0.0"}%</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs font-normal">
                                {lData?.totalComparisons ?? 0} total evaluations
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Cost Prediction (MAE)</p>
                        <p className="text-3xl font-bold">{lData ? Number(lData.costMaePct).toFixed(1) : "0.0"}%</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant={lData?.costTrend === "improving" ? "default" : "secondary"} className="text-xs font-normal">
                                {lData?.costTrend?.replace("_", " ") ?? "Unknown"}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Score Accuracy</p>
                        <p className="text-3xl font-bold">{lData ? Number(lData.scoreAccuracyRate).toFixed(1) : "0.0"}%</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant={lData?.scoreTrend === "improving" ? "default" : "secondary"} className="text-xs font-normal">
                                {lData?.scoreTrend?.replace("_", " ") ?? "Unknown"}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Risk Predict Hit Rate</p>
                        <p className="text-3xl font-bold">{lData ? Number(lData.riskAccuracyRate).toFixed(1) : "0.0"}%</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant={lData?.riskTrend === "improving" ? "default" : "secondary"} className="text-xs font-normal">
                                {lData?.riskTrend?.replace("_", " ") ?? "Unknown"}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logic Registry Proposals */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BrainCircuit className="h-4 w-4" /> Pending Logic Array Adjustments
                        </CardTitle>
                        <CardDescription>Weight sensitivity engine proposals based on false positive/negative drifts (V5-04)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pLogic.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
                                No active logic drift detected. Predictive dimensions are stable.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {pLogic.map((l) => (
                                    <div key={l.id} className="border p-4 rounded-lg bg-background shadow-sm hover:shadow transition-all">
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="font-medium text-sm text-amber-600">{l.changeSummary}</p>
                                            <Badge variant="outline">{new Date(l.createdAt).toLocaleDateString()}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{l.rationale}</p>
                                        <div className="mt-4 pt-3 border-t flex items-center justify-between">
                                            <span className="text-xs font-medium bg-muted px-2 py-1 rounded">Target Version ID: v{l.logicVersionId}</span>
                                            <Button size="sm" variant="secondary" className="h-7 text-xs">Review in Registry</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Benchmark Proposals */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" /> Pending Benchmark Calibrations
                        </CardTitle>
                        <CardDescription>Outcome-driven suggestions for base rate alignments (V5-03)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pBenchmarks.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
                                Awaiting more outcome data to propose benchmark category alignments.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {pBenchmarks.map((b) => (
                                    <div key={b.id} className="border p-4 rounded-lg bg-background shadow-sm hover:shadow transition-all">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline">{b.confidence} confidence</Badge>
                                            <span className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</span>
                                        </div>

                                        <div className="space-y-1 mb-3">
                                            <p className="text-xs font-medium">Signal: {b.basedOnOutcomesQuery}</p>
                                            <ul className="text-xs text-muted-foreground bg-muted/30 p-2 rounded list-disc pl-4 mt-1">
                                                {((b.suggestedChanges as any[]) || []).map((change, idx) => (
                                                    <li key={idx}>
                                                        <span className="font-semibold">{change.metric}:</span> {change.suggestion}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => reviewMut.mutate({ id: b.id, status: "accepted" })}>Accept</Button>
                                            <Button size="sm" variant="outline" onClick={() => reviewMut.mutate({ id: b.id, status: "rejected" })}>Reject</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Accuracy Ledger History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Accuracy Timeline Ledger</CardTitle>
                    <CardDescription>Snapshot history of platform predictive power over time.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Snapshot Date</TableHead>
                                <TableHead>Evaluations</TableHead>
                                <TableHead>Cost Margin (MAE)</TableHead>
                                <TableHead>Score Hit Rate</TableHead>
                                <TableHead>Risk Hit Rate</TableHead>
                                <TableHead className="text-right">Platform Grade</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hData.map((h) => (
                                <TableRow key={h.id}>
                                    <TableCell className="font-medium">{new Date(h.snapshotDate).toLocaleDateString()}</TableCell>
                                    <TableCell>{h.totalComparisons}</TableCell>
                                    <TableCell>
                                        {Number(h.costMaePct).toFixed(2)}%
                                        <span className="text-[10px] ml-2 text-muted-foreground">({h.costTrend.replace("_", "")})</span>
                                    </TableCell>
                                    <TableCell>{Number(h.scoreAccuracyRate).toFixed(1)}%</TableCell>
                                    <TableCell>{Number(h.riskAccuracyRate).toFixed(1)}%</TableCell>
                                    <TableCell className="text-right font-bold text-indigo-500">
                                        {Number(h.overallPlatformAccuracy).toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                            ))}
                            {hData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                        No accuracy snapshots available yet. The scheduler has not completed its first run.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
