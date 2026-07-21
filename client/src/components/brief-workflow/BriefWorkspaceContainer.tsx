import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BriefWorkspace, type BriefWorkflowAction } from "./BriefWorkspace";
import type { BriefReadinessView, BriefStreamView, BriefVersionView } from "./types";

const briefApi = (trpc as any).brief;
const key = () => crypto.randomUUID();

export function BriefWorkspaceContainer({ projectId, currentUserId, isAdmin }: { projectId: number; currentUserId?: number; isAdmin?: boolean }) {
  const utils = trpc.useUtils() as any;
  const [selectedBriefId, setSelectedBriefId] = useState<string>();
  const streamsQuery = briefApi.listStreams.useQuery({ projectId, limit: 50 });
  const streams = useMemo<BriefStreamView[]>(() => (streamsQuery.data?.items ?? streamsQuery.data ?? []), [streamsQuery.data]);
  const activeBriefId = selectedBriefId ?? (streams[0]?.briefId ?? streams[0]?.id)?.toString();
  const activeStream = streams.find(stream => String((stream as any).briefId ?? stream.id) === activeBriefId) as any;
  const versionId = activeStream?.currentVersionId ?? activeStream?.latestVersionId;
  const ref = { projectId, briefId: activeBriefId ?? "", versionId: versionId ?? "" };
  const versionQuery = briefApi.getVersion.useQuery(ref, { enabled: Boolean(activeBriefId && versionId) });
  const readinessQuery = briefApi.getReadiness.useQuery(ref, { enabled: Boolean(activeBriefId && versionId) });
  const assignmentsQuery = briefApi.getAssignments.useQuery({ projectId, briefId: activeBriefId ?? "", limit: 100 }, { enabled: Boolean(activeBriefId) });
  const issuesQuery = briefApi.getIssueLedger.useQuery({ projectId, briefId: activeBriefId ?? "", limit: 100 }, { enabled: Boolean(activeBriefId) });
  const revision = Number(readinessQuery.data?.revision ?? readinessQuery.data?.streamRevision ?? activeStream?.revision ?? 0);

  const invalidate = async () => {
    await Promise.all([
      utils.brief.listStreams.invalidate(),
      activeBriefId && versionId ? utils.brief.getVersion.invalidate(ref) : Promise.resolve(),
      activeBriefId && versionId ? utils.brief.getReadiness.invalidate(ref) : Promise.resolve(),
    ]);
  };
  const mutationOptions = (success: string) => ({ onSuccess: async () => { toast.success(success); await invalidate(); }, onError: (error: Error) => toast.error(error.message) });
  const createStream = briefApi.createStream.useMutation(mutationOptions("Governed brief created"));
  const reviseSection = briefApi.reviseSection.useMutation(mutationOptions("Section revision created"));
  const submitEvidence = briefApi.submitEvidence.useMutation(mutationOptions("Evidence submitted"));
  const acceptReview = briefApi.acceptReview.useMutation(mutationOptions("Review accepted"));
  const approveSection = briefApi.approveSection.useMutation(mutationOptions("Section approved"));
  const issue = briefApi.issue.useMutation(mutationOptions("Brief issued"));
  const assignRole = briefApi.assignRole.useMutation(mutationOptions("Role assigned"));
  const revokeRole = briefApi.revokeRole.useMutation(mutationOptions("Role revoked"));
  const recordFinding = briefApi.recordFinding.useMutation(mutationOptions("Finding recorded"));
  const submitFindingResolution = briefApi.submitFindingResolution.useMutation(mutationOptions("Finding resolution submitted"));
  const decideApplicability = briefApi.decideApplicability.useMutation(mutationOptions("Applicability decision recorded"));
  const raiseCondition = briefApi.raiseCondition.useMutation(mutationOptions("Condition raised"));
  const submitConditionResolution = briefApi.submitConditionResolution.useMutation(mutationOptions("Condition resolution submitted"));
  const createVersion = briefApi.createVersion.useMutation(mutationOptions("Successor version created"));

  const sectionAction = (action: BriefWorkflowAction, sectionId: string, detail: string, targetId?: string, dependencyIds: string[] = [], ownerUserId?: number) => {
    if (!activeBriefId || !versionId) return;
    const binding = (versionQuery.data?.sections ?? []).find((section: any) => section.sectionId === sectionId);
    const meta = { ...ref, expectedRevision: revision, idempotencyKey: key() };
    if (action === "revise") reviseSection.mutate({ ...meta, sectionId, contentSchemaVersion: "BR-03-v1", content: { narrative: detail }, origin: "user", dependencies: [] });
    else if (!binding?.revisionId) toast.error("Draft this section before advancing its workflow.");
    else if (action === "evidence") submitEvidence.mutate({ ...meta, sectionId, revisionId: binding.revisionId, dependencyIds, rationale: detail });
    else if (action === "finding") ownerUserId ? recordFinding.mutate({ ...meta, sectionId, revisionId: binding.revisionId, severity: "blocking", ownerUserId, statement: detail }) : toast.error("Owner user ID is required.");
    else if (action === "resolve_finding") targetId ? submitFindingResolution.mutate({ ...meta, findingId: targetId, resolutionRevisionId: binding.revisionId, evidence: { rationale: detail, dependencyIds } }) : toast.error("Finding ID is required.");
    else if (action === "condition") ownerUserId ? raiseCondition.mutate({ ...meta, sectionId, kind: "blocked", gate: "approval_issue", reasonCode: "user_recorded", explanation: detail, ownerUserId, resolutionRequirement: detail }) : toast.error("Owner user ID is required.");
    else if (action === "resolve_condition") targetId ? submitConditionResolution.mutate({ ...meta, conditionId: targetId, evidence: { rationale: detail, dependencyIds } }) : toast.error("Condition ID is required.");
    else if (action === "propose_na") decideApplicability.mutate({ ...meta, sectionId, action: "propose", rationale: detail, evidence: { dependencyIds } });
    else if (action === "review_na") targetId ? decideApplicability.mutate({ ...meta, sectionId, action: "accept_review", proposalEventId: targetId, rationale: detail, evidence: { dependencyIds } }) : toast.error("Proposal event ID is required.");
    else if (action === "approve_na") targetId ? decideApplicability.mutate({ ...meta, sectionId, action: "approve", proposalEventId: targetId, rationale: detail, evidence: { dependencyIds } }) : toast.error("Reviewed event ID is required.");
    else if (action === "review") acceptReview.mutate({ ...meta, sectionId, revisionId: binding.revisionId, rationale: detail });
    else if (action === "approve") approveSection.mutate({ ...meta, sectionId, revisionId: binding.revisionId, limitations: [], rationale: detail });
  };

  const version: BriefVersionView | undefined = versionQuery.data ? { ...(versionQuery.data.summary ?? {}), ...(versionQuery.data.version ?? {}), sections: versionQuery.data.sections } : undefined;
  const roleEvents = assignmentsQuery.data?.items ?? [];
  const activeRoles = roleEvents.filter((event: any) => event.action === "granted" && !roleEvents.some((later: any) => later.action === "revoked" && String(later.targetGrantEventId) === String(event.id)) && Number(event.subjectUserId) === currentUserId).map((event: any) => event.role);
  const canWrite = activeRoles.some((role: string) => ["author", "section_owner", "reviewer", "approver"].includes(role));
  const nonPreflightReasons = (readinessQuery.data?.reasons ?? []).filter((reason: any) => reason.code !== "missing_issue_metadata" && reason.code !== "role_separation_failure");
  return <BriefWorkspace
    streams={streams.map((stream: any) => ({ ...stream, id: stream.briefId ?? stream.id }))}
    selectedStreamId={activeBriefId}
    version={version}
    readiness={readinessQuery.data as BriefReadinessView | undefined}
    issues={issuesQuery.data?.items ?? []}
    isLoading={streamsQuery.isLoading || (Boolean(activeBriefId) && (versionQuery.isLoading || readinessQuery.isLoading))}
    error={(streamsQuery.error ?? versionQuery.error ?? readinessQuery.error)?.message}
    isCreating={createStream.isPending}
    isIssuing={issue.isPending}
    onSelectStream={id => setSelectedBriefId(String(id))}
    onCreateStream={() => currentUserId ? createStream.mutate({ projectId, scope: { type: "project" }, purpose: "internal_coordination", typologyProfileVersion: "BR-01-v1", componentIds: [], initialAssignments: [{ userId: currentUserId, role: "author" }, { userId: currentUserId, role: "section_owner" }], idempotencyKey: key() }) : toast.error("A signed-in user is required.")}
    onCreateVersion={activeRoles.some((role: string) => role === "author" || role === "section_owner") ? () => createVersion.mutate({ ...ref, expectedRevision: revision, idempotencyKey: key(), predecessorVersionId: versionId, carryForwardSections: (versionQuery.data?.sections ?? []).filter((section: any) => section.revisionId).map((section: any) => section.sectionId) }) : undefined}
    onIssue={() => issue.mutate({ ...ref, expectedRevision: revision, idempotencyKey: key(), disclaimerVersion: "BR-01-v1", confidentiality: "organization", distributionPolicyVersion: "BR-01-v1" })}
    onRetry={() => { streamsQuery.refetch(); versionQuery.refetch(); readinessQuery.refetch(); }}
    canAttemptIssue={Boolean(readinessQuery.data && nonPreflightReasons.length === 0)}
    onSectionAction={canWrite ? sectionAction : undefined}
    onAssignRole={isAdmin ? (userId, role) => assignRole.mutate({ projectId, briefId: activeBriefId, expectedRevision: revision, idempotencyKey: key(), userId, role, reason: "Assigned from project brief workspace" }) : undefined}
    onRevokeRole={isAdmin ? grantEventId => revokeRole.mutate({ projectId, briefId: activeBriefId, expectedRevision: revision, idempotencyKey: key(), grantEventId, reason: "Revoked from project brief workspace" }) : undefined}
  />;
}
