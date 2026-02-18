import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Shield, Send, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const APPROVAL_STATES = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700" },
  { value: "review", label: "In Review", color: "bg-yellow-100 text-yellow-700" },
  { value: "approved_rfq", label: "Approved for RFQ", color: "bg-green-100 text-green-700" },
  { value: "approved_marketing", label: "Approved for Marketing", color: "bg-blue-100 text-blue-700" },
];

export default function Collaboration() {
  const [, params] = useRoute("/projects/:id/collaboration");
  const projectId = Number(params?.id);
  const { user } = useAuth();

  const [newComment, setNewComment] = useState("");
  const [commentEntity, setCommentEntity] = useState<string>("general");
  const [approvalRationale, setApprovalRationale] = useState("");

  const project = trpc.project.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const comments = trpc.design.listComments.useQuery({ projectId }, { enabled: !!projectId });

  const addCommentMutation = trpc.design.addComment.useMutation({
    onSuccess: () => {
      toast.success("Comment added");
      comments.refetch();
      setNewComment("");
    },
  });

  const updateApprovalMutation = trpc.design.updateApprovalState.useMutation({
    onSuccess: () => {
      toast.success("Approval state updated");
      project.refetch();
    },
    onError: (err) => toast.error("Failed", { description: err.message }),
  });

  const currentApproval = APPROVAL_STATES.find(s => s.value === (project.data?.approvalState || "draft"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Collaboration & Approvals</h2>
          <p className="text-muted-foreground">Comments, decision rationale, and approval gates</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Approval Gate */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Approval Gate</CardTitle>
              <CardDescription>Current project approval status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                <Badge className={currentApproval?.color}>{currentApproval?.label || "Draft"}</Badge>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium mb-1 block">Change Approval State</label>
                <Select
                  value={project.data?.approvalState || "draft"}
                  onValueChange={(v) => {
                    updateApprovalMutation.mutate({
                      projectId,
                      approvalState: v as any,
                      rationale: approvalRationale || undefined,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APPROVAL_STATES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Decision Rationale</label>
                <Textarea
                  placeholder="Document the reasoning for this approval decision..."
                  value={approvalRationale}
                  onChange={e => setApprovalRationale(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Approval Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {APPROVAL_STATES.map((state, i) => {
                  const isCurrent = state.value === (project.data?.approvalState || "draft");
                  const isPast = APPROVAL_STATES.findIndex(s => s.value === (project.data?.approvalState || "draft")) > i;
                  return (
                    <div key={state.value} className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full shrink-0 ${isCurrent ? "bg-primary ring-2 ring-primary/30" : isPast ? "bg-primary/50" : "bg-muted"}`} />
                      <span className={`text-sm ${isCurrent ? "font-medium" : isPast ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                        {state.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comments */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Comments</CardTitle>
              <CardDescription>Discussion and decision rationale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New comment form */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex gap-3">
                  <Select value={commentEntity} onValueChange={setCommentEntity}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="design_brief">Design Brief</SelectItem>
                      <SelectItem value="material_board">Material Board</SelectItem>
                      <SelectItem value="visual">Visual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Add a comment or decision rationale..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => addCommentMutation.mutate({
                    projectId,
                    entityType: commentEntity as any,
                    content: newComment,
                  })}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                >
                  <Send className="mr-2 h-3 w-3" /> Post Comment
                </Button>
              </div>

              <Separator />

              {/* Comment list */}
              {!comments.data?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Start the discussion.</p>
              ) : (
                <div className="space-y-3">
                  {comments.data.map(comment => (
                    <div key={comment.id} className="flex gap-3 p-3 rounded-lg border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">User #{comment.userId}</span>
                          <Badge variant="outline" className="text-xs">{comment.entityType}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
