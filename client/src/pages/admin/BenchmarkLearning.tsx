import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lightbulb, RefreshCw, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { useState } from "react";

export default function BenchmarkLearning() {
  const suggestions = trpc.intelligence.benchmarkLearning.listSuggestions.useQuery();
  const allOutcomes = trpc.intelligence.outcomes.listAll.useQuery();
  const utils = trpc.useUtils();

  const generateMut = trpc.intelligence.benchmarkLearning.generateSuggestions.useMutation({
    onSuccess: (data) => {
      if ("message" in data) {
        toast.info(data.message as string);
      } else {
        toast.success("Learning report generated with suggestions");
      }
      utils.intelligence.benchmarkLearning.listSuggestions.invalidate();
    },
    onError: () => toast.error("Failed to generate suggestions"),
  });

  const reviewMut = trpc.intelligence.benchmarkLearning.reviewSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion reviewed");
      utils.intelligence.benchmarkLearning.listSuggestions.invalidate();
    },
  });

  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const suggestionList = suggestions.data ?? [];
  const outcomeCount = allOutcomes.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-amber-500" /> Benchmark Learning
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze captured outcomes to suggest benchmark adjustments
          </p>
        </div>
        <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${generateMut.isPending ? "animate-spin" : ""}`} />
          {generateMut.isPending ? "Analyzing..." : "Generate Suggestions"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{outcomeCount}</p>
            <p className="text-sm text-muted-foreground">Total Outcomes Captured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{suggestionList.filter((s) => s.status === "pending").length}</p>
            <p className="text-sm text-muted-foreground">Pending Suggestions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{suggestionList.filter((s) => s.status === "accepted").length}</p>
            <p className="text-sm text-muted-foreground">Accepted Suggestions</p>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Benchmark Adjustment Suggestions</CardTitle>
          <CardDescription>Review and accept/reject system-generated benchmark adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          {suggestionList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No suggestions yet. Capture project outcomes first, then click "Generate Suggestions" to analyze.
            </p>
          ) : (
            <div className="space-y-4">
              {suggestionList.map((s) => {
                const changes = (s.suggestedChanges as Array<{ metric?: string; suggestion?: string; currentValue?: unknown; suggestedValue?: unknown }>) ?? [];
                return (
                  <div key={s.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            s.status === "accepted" ? "default" : s.status === "rejected" ? "destructive" : "outline"
                          }
                        >
                          {s.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Confidence: {s.confidence ? parseFloat(s.confidence).toFixed(2) : "N/A"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      Based on: {s.basedOnOutcomesQuery}
                    </p>

                    {changes.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead>Suggestion</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {changes.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{c.metric ?? "General"}</TableCell>
                              <TableCell className="text-sm">{c.suggestion ?? JSON.stringify(c)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {s.status === "pending" && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          placeholder="Reviewer notes..."
                          value={reviewNotes[s.id] ?? ""}
                          onChange={(e) => setReviewNotes({ ...reviewNotes, [s.id]: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              reviewMut.mutate({
                                id: s.id,
                                status: "accepted",
                                reviewerNotes: reviewNotes[s.id] || undefined,
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              reviewMut.mutate({
                                id: s.id,
                                status: "rejected",
                                reviewerNotes: reviewNotes[s.id] || undefined,
                              })
                            }
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {s.reviewerNotes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        Reviewer: {s.reviewerNotes}
                      </p>
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
