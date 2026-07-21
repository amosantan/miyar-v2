import { useMemo, useState } from "react";
import type { BriefSectionContentV1Input } from "@shared/brief-section-content";
import { BRIEF_SECTION_CONTENT_SCHEMA_VERSION } from "@shared/brief-section-content";
import { BRIEF_SECTION_IDS, type BriefSectionId } from "@shared/brief-contract";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BriefWorkspace, type BriefWorkflowAction } from "./BriefWorkspace";
import type { BriefStreamView, BriefStudioSection, BriefStudioView } from "./types";

const briefApi = (trpc as any).brief;
const key = () => crypto.randomUUID();

export function BriefWorkspaceContainer({ projectId, currentUserId }: { projectId: number; currentUserId?: number }) {
  const utils = trpc.useUtils() as any;
  const query = new URLSearchParams(window.location.search);
  const [selectedBriefId, setSelectedBriefId] = useState<string | undefined>(query.get("briefId") ?? undefined);
  const requestedSection = query.get("sectionId") as BriefSectionId | null;
  const [selectedSectionId, setSelectedSectionId] = useState<BriefSectionId>(BRIEF_SECTION_IDS.includes(requestedSection as BriefSectionId) ? requestedSection as BriefSectionId : "intent");
  const [conflict, setConflict] = useState<string>();
  const streamsQuery = briefApi.listStreams.useQuery({ projectId, limit: 50 });
  const streams = useMemo<BriefStreamView[]>(() => (streamsQuery.data?.items ?? streamsQuery.data ?? []), [streamsQuery.data]);
  const activeBriefId = selectedBriefId ?? (streams[0]?.briefId ?? streams[0]?.id)?.toString();
  const activeStream = streams.find(stream => String(stream.briefId ?? stream.id) === activeBriefId);
  const versionId = activeStream?.currentVersionId ?? activeStream?.latestVersionId;
  const ref = { projectId, briefId: activeBriefId ?? "", versionId: String(versionId ?? "") };
  const studioQuery = briefApi.getStudio.useQuery(ref, { enabled: Boolean(activeBriefId && versionId) });
  const studio = studioQuery.data as BriefStudioView | undefined;
  const revision = studio?.identity.streamRevision ?? activeStream?.revision ?? 0;

  const invalidate = async () => {
    await Promise.all([
      utils.brief.listStreams.invalidate(),
      activeBriefId && versionId ? utils.brief.getStudio.invalidate(ref) : Promise.resolve(),
    ]);
  };
  const mutationOptions = (success: string) => ({
    onSuccess: async () => { setConflict(undefined); toast.success(success); await invalidate(); },
    onError: (error: Error) => {
      if (/stale|conflict/i.test(error.message)) setConflict("Another person saved a newer brief state. Reload the latest version, review the differences, then explicitly save your preserved local draft again.");
      else toast.error(error.message);
    },
  });
  const createStream = briefApi.createStream.useMutation(mutationOptions("Governed brief created"));
  const reviseSection = briefApi.reviseSection.useMutation(mutationOptions("Structured section revision saved"));
  const submitEvidence = briefApi.submitEvidence.useMutation(mutationOptions("Evidence submitted"));
  const acceptReview = briefApi.acceptReview.useMutation(mutationOptions("Review accepted"));
  const approveSection = briefApi.approveSection.useMutation(mutationOptions("Section approved"));
  const issue = briefApi.issue.useMutation(mutationOptions("Brief issued"));
  const assignRole = briefApi.assignRole.useMutation(mutationOptions("Role assigned"));
  const revokeRole = briefApi.revokeRole.useMutation(mutationOptions("Role revoked"));
  const recordFinding = briefApi.recordFinding.useMutation(mutationOptions("Finding recorded"));
  const submitFindingResolution = briefApi.submitFindingResolution.useMutation(mutationOptions("Finding resolution submitted"));
  const decideApplicability = briefApi.decideApplicability.useMutation(mutationOptions("Applicability action recorded"));
  const raiseCondition = briefApi.raiseCondition.useMutation(mutationOptions("Condition raised"));
  const submitConditionResolution = briefApi.submitConditionResolution.useMutation(mutationOptions("Condition resolution submitted"));
  const createVersion = briefApi.createVersion.useMutation(mutationOptions("Successor version created"));

  const meta = () => ({ ...ref, expectedRevision: revision, idempotencyKey: key() });
  const saveSection = (sectionId: BriefSectionId, content: BriefSectionContentV1Input, evidenceIds: number[]) => {
    reviseSection.mutate({
      ...meta(),
      sectionId,
      contentSchemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
      content,
      origin: "user",
      evidenceReferences: evidenceIds.map(id => ({ kind: "evidence_record", id, ruleId: `${sectionId}.summary`, relevance: `Evidence selected for ${sectionId}` })),
    });
  };
  const workflowAction = (action: BriefWorkflowAction, section: BriefStudioSection, detail: string, targetId?: number, ownerUserId?: number) => {
    if (!section.revisionId) return toast.error("Save a structured revision before advancing its workflow.");
    const input = { ...meta(), sectionId: section.sectionId, revisionId: section.revisionId };
    if (action === "submit_evidence") submitEvidence.mutate({ ...input, dependencyIds: section.evidence.map(item => String(item.id)), rationale: detail });
    else if (action === "record_finding") ownerUserId ? recordFinding.mutate({ ...input, severity: "blocking", ownerUserId, statement: detail }) : toast.error("Select a responsible member.");
    else if (action === "submit_finding_resolution") targetId ? submitFindingResolution.mutate({ ...meta(), findingId: String(targetId), resolutionRevisionId: section.revisionId, evidence: { rationale: detail } }) : toast.error("Select an open finding.");
    else if (action === "raise_condition") ownerUserId ? raiseCondition.mutate({ ...meta(), sectionId: section.sectionId, kind: "blocked", gate: "approval_issue", reasonCode: "studio_recorded", explanation: detail, ownerUserId, resolutionRequirement: detail }) : toast.error("Select a responsible member.");
    else if (action === "submit_condition_resolution") targetId ? submitConditionResolution.mutate({ ...meta(), conditionId: String(targetId), evidence: { rationale: detail } }) : toast.error("Select an open condition.");
    else if (action === "propose_not_applicable") decideApplicability.mutate({ ...meta(), sectionId: section.sectionId, action: "propose", rationale: detail, evidence: {} });
    else if (action === "review_not_applicable") targetId ? decideApplicability.mutate({ ...meta(), sectionId: section.sectionId, action: "accept_review", proposalEventId: String(targetId), rationale: detail, evidence: {} }) : toast.error("Select the proposal to review.");
    else if (action === "approve_not_applicable") targetId ? decideApplicability.mutate({ ...meta(), sectionId: section.sectionId, action: "approve", proposalEventId: String(targetId), rationale: detail, evidence: {} }) : toast.error("Select the reviewed decision to approve.");
    else if (action === "accept_review") acceptReview.mutate({ ...input, rationale: detail });
    else if (action === "approve_section") approveSection.mutate({ ...input, limitations: [], rationale: detail });
  };
  const selectSection = (sectionId: BriefSectionId) => {
    setSelectedSectionId(sectionId);
    const params = new URLSearchParams(window.location.search);
    params.set("briefId", activeBriefId ?? "");
    params.set("versionId", String(versionId ?? ""));
    params.set("sectionId", sectionId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  };
  const retry = () => { setConflict(undefined); streamsQuery.refetch(); studioQuery.refetch(); };
  return <BriefWorkspace
    streams={streams.map(stream => ({ ...stream, id: stream.briefId ?? stream.id }))}
    selectedStreamId={activeBriefId}
    studio={studio}
    selectedSectionId={selectedSectionId}
    isLoading={streamsQuery.isLoading || (Boolean(activeBriefId) && studioQuery.isLoading)}
    error={(streamsQuery.error ?? studioQuery.error)?.message}
    conflict={conflict}
    isCreating={createStream.isPending}
    isSaving={reviseSection.isPending}
    isIssuing={issue.isPending}
    onSelectStream={id => setSelectedBriefId(id)}
    onSelectSection={selectSection}
    onCreateStream={streamsQuery.data?.canCreate ? () => currentUserId ? createStream.mutate({ projectId, scope: { type: "project" }, purpose: "internal_coordination", typologyProfileVersion: "BR-01-v1", componentIds: [], initialAssignments: [{ userId: currentUserId, role: "author" }, { userId: currentUserId, role: "section_owner" }], idempotencyKey: key() }) : toast.error("A signed-in user is required.") : undefined}
    onCreateVersion={studio?.permittedActions.createVersion ? () => createVersion.mutate({ ...meta(), predecessorVersionId: ref.versionId, carryForwardSections: studio.sections.filter(section => section.revisionId).map(section => section.sectionId) }) : undefined}
    onIssue={() => issue.mutate({ ...meta(), disclaimerVersion: "BR-01-v1", confidentiality: "organization", distributionPolicyVersion: "BR-01-v1" })}
    onRetry={retry}
    onSaveSection={saveSection}
    onWorkflowAction={workflowAction}
    onAssignRole={studio?.permittedActions.administerRoles && activeBriefId ? (userId, role, sectionId) => assignRole.mutate({ projectId, briefId: activeBriefId, expectedRevision: revision, idempotencyKey: key(), userId, role, sectionId, reason: "Assigned from guided brief studio" }) : undefined}
    onRevokeRole={studio?.permittedActions.administerRoles && activeBriefId ? grantEventId => revokeRole.mutate({ projectId, briefId: activeBriefId, expectedRevision: revision, idempotencyKey: key(), grantEventId: String(grantEventId), reason: "Revoked from guided brief studio" }) : undefined}
  />;
}
