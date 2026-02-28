
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { FileCheck, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Minus, History } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function BenchmarkProposals() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showSnapshots, setShowSnapshots] = useState(false);

  const { data: proposals, isLoading, refetch } = trpc.marketIntel.proposals.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  });

  const { data: snapshots } = trpc.marketIntel.snapshots.list.useQuery();

  const approveMutation = trpc.marketIntel.proposals.review.useMutation({
    onSuccess: () => { toast.success("Proposal approved — benchmark snapshot created"); setReviewingId(null); setReviewNotes(""); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.marketIntel.proposals.review.useMutation({
    onSuccess: () => { toast.success("Proposal rejected"); setReviewingId(null); setReviewNotes(""); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const reviewingProposal = (proposals ?? []).find((p: any) => p.id === reviewingId);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Benchmark Proposals</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve benchmark update proposals generated from market evidence
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowSnapshots(true)}>
            <History className="h-4 w-4 mr-2" />Snapshot History
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Proposals */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading proposals...</div>
        ) : (proposals ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No benchmark proposals yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Proposals are generated from evidence records using the benchmark proposal engine
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(proposals ?? []).map((p: any) => (
              <Card key={p.id} className="bg-card/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header Row */}
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{p.benchmarkKey}</h3>
                        <Badge className={`${statusColors[p.status]} text-xs`}>
                          {p.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {p.status === "approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {p.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Confidence: {p.confidenceScore}%
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {p.recommendation}
                        </Badge>
                      </div>

                      {/* Value Comparison */}
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Current</div>
                          <div className="font-mono font-medium">{Number(p.currentTypical).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Proposed P25</div>
                          <div className="font-mono">{Number(p.proposedP25).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Proposed P50</div>
                          <div className="font-mono font-medium text-primary">{Number(p.proposedP50).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Proposed P75</div>
                          <div className="font-mono">{Number(p.proposedP75).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Delta</div>
                          <div className={`font-mono font-medium flex items-center gap-1 ${Number(p.deltaPct) > 0 ? "text-emerald-400" : Number(p.deltaPct) < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {Number(p.deltaPct) > 0 ? <TrendingUp className="h-3 w-3" /> : Number(p.deltaPct) < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {Number(p.deltaPct) > 0 ? "+" : ""}{Number(p.deltaPct).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Evidence Stats */}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Evidence: {p.evidenceCount} records</span>
                        <span>·</span>
                        <span>Source Diversity: {p.sourceDiversity}</span>
                        {p.reliabilityDist && (
                          <>
                            <span>·</span>
                            <span>Reliability: {typeof p.reliabilityDist === "string" ? p.reliabilityDist : JSON.stringify(p.reliabilityDist)}</span>
                          </>
                        )}
                      </div>

                      {/* Impact Notes */}
                      {p.impactNotes && (
                        <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">{p.impactNotes}</p>
                      )}

                      {/* Rejection Reason */}
                      {p.rejectionReason && (
                        <p className="text-xs text-amber-400 border-l-2 border-amber-500/30 pl-3">
                          Auto-rejection: {p.rejectionReason}
                        </p>
                      )}

                      {/* Reviewer Notes */}
                      {p.reviewerNotes && (
                        <p className="text-xs text-muted-foreground italic">
                          Reviewer: {p.reviewerNotes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {p.status === "pending" && (
                      <div className="shrink-0">
                        <Button size="sm" onClick={() => { setReviewingId(p.id); setReviewNotes(""); }}>
                          Review
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={reviewingId !== null} onOpenChange={(open) => { if (!open) setReviewingId(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Proposal: {reviewingProposal?.benchmarkKey}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {reviewingProposal && (
                <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-mono">{Number(reviewingProposal.currentTypical).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proposed P50</span>
                    <span className="font-mono text-primary">{Number(reviewingProposal.proposedP50).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delta</span>
                    <span className="font-mono">{Number(reviewingProposal.deltaPct) > 0 ? "+" : ""}{Number(reviewingProposal.deltaPct).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span>{reviewingProposal.confidenceScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recommendation</span>
                    <Badge variant="outline" className="text-xs">{reviewingProposal.recommendation}</Badge>
                  </div>
                </div>
              )}
              <div>
                <Label>Review Notes</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide rationale for your decision..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  variant="default"
                  onClick={() => {
                    if (!reviewingId) return;
                    approveMutation.mutate({ id: reviewingId, status: "approved", reviewerNotes: reviewNotes });
                  }}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={() => {
                    if (!reviewingId) return;
                    rejectMutation.mutate({ id: reviewingId, status: "rejected", reviewerNotes: reviewNotes });
                  }}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Snapshots Dialog */}
        <Dialog open={showSnapshots} onOpenChange={setShowSnapshots}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Benchmark Snapshots</DialogTitle>
            </DialogHeader>
            {(snapshots ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No snapshots yet. Snapshots are created when proposals are approved.</p>
            ) : (
              <div className="space-y-3">
                {(snapshots ?? []).map((snap: any) => (
                  <Card key={snap.id} className="bg-muted/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-medium">v{snap.versionId}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(snap.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created by: {snap.createdBy ?? "System"}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
