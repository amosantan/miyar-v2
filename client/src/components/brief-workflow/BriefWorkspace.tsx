import { useEffect, useMemo, useState } from "react";
import type { BriefSectionContentV1Input } from "@shared/brief-section-content";
import type { BriefSectionId } from "@shared/brief-contract";
import { AlertTriangle, CheckCircle2, FileCheck2, Inbox, Loader2, LockKeyhole, Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { BriefSectionEditor } from "./BriefSectionEditor";
import type { BriefStreamView, BriefStudioSection, BriefStudioView } from "./types";

export type BriefWorkflowAction =
  | "submit_evidence" | "record_finding" | "submit_finding_resolution"
  | "raise_condition" | "submit_condition_resolution" | "propose_not_applicable"
  | "review_not_applicable" | "approve_not_applicable" | "accept_review" | "approve_section";

type Props = {
  streams: BriefStreamView[];
  selectedStreamId?: string;
  studio?: BriefStudioView;
  selectedSectionId?: BriefSectionId;
  isLoading?: boolean;
  error?: string;
  conflict?: string;
  isCreating?: boolean;
  isSaving?: boolean;
  isIssuing?: boolean;
  onSelectStream: (id: string) => void;
  onSelectSection: (id: BriefSectionId) => void;
  onCreateStream?: () => void;
  onCreateVersion?: () => void;
  onIssue: () => void;
  onRetry: () => void;
  onSaveSection: (sectionId: BriefSectionId, content: BriefSectionContentV1Input, evidenceIds: number[]) => void;
  onWorkflowAction: (action: BriefWorkflowAction, section: BriefStudioSection, detail: string, targetId?: number, ownerUserId?: number) => void;
  onAssignRole?: (userId: number, role: string, sectionId?: BriefSectionId) => void;
  onRevokeRole?: (grantEventId: number) => void;
};

const label = (value?: string) => value ? value.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase()) : "Missing";

export function BriefWorkspace(props: Props) {
  const { t, dir } = useTranslation();
  if (props.isLoading) return <Card aria-busy="true"><CardContent className="flex min-h-64 items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading design brief studio…</span></CardContent></Card>;
  if (props.error) return <Card role="alert"><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><AlertTriangle /><h2 className="font-semibold">The studio is unavailable</h2><p className="max-w-lg text-sm text-muted-foreground">{props.error}</p><Button onClick={props.onRetry}><RefreshCw className="me-2 h-4 w-4" />Try again</Button></CardContent></Card>;
  if (!props.streams.length) return <Card><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><FileCheck2 /><h2 className="text-lg font-semibold">Start the governed design brief</h2><p className="max-w-lg text-sm text-muted-foreground">Create one versioned source of truth for intent, spaces, materials, budget, evidence, media and approvals.</p>{props.onCreateStream ? <Button onClick={props.onCreateStream} disabled={props.isCreating}><Plus className="me-2 h-4 w-4" />Create governed brief</Button> : <p className="text-sm text-muted-foreground">An organization administrator can create the first governed brief.</p>}</CardContent></Card>;
  if (!props.studio) return null;
  const selected = props.studio.sections.find(section => section.sectionId === props.selectedSectionId) ?? props.studio.sections[0];
  const progress = Math.max(0, Math.min(100, props.studio.readiness.displayProgress));
  return <div className="space-y-4" dir={dir}>
    <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">{t("brief.title", "Design brief studio")}</h2><p className="text-sm text-muted-foreground">One canonical version · server-governed actions · AED and m² authority</p></div><label className="text-sm">Brief stream<select className="ms-2 h-10 rounded-md border bg-background px-3" value={props.selectedStreamId ?? ""} onChange={event => props.onSelectStream(event.target.value)}>{props.streams.map(stream => <option key={String(stream.id)} value={String(stream.id)}>Brief {stream.id} · {label(stream.purpose)}</option>)}</select></label></header>
    <Alert className="border-amber-500/50 bg-amber-500/10" role="status"><LockKeyhole className="h-4 w-4" /><AlertTitle>WORKING DRAFT — NOT ISSUED</AlertTitle><AlertDescription>This studio edits live working content. Previewing or saving does not create a report, export, share token, public artifact, or issued brief.</AlertDescription></Alert>
    {props.conflict && <Alert variant="destructive" role="alert"><AlertTriangle className="h-4 w-4" /><AlertTitle>Your draft was preserved</AlertTitle><AlertDescription className="space-y-2"><p>{props.conflict}</p><Button size="sm" variant="outline" onClick={props.onRetry}>Reload latest version</Button></AlertDescription></Alert>}
    <Tabs defaultValue="edit" className="space-y-4"><TabsList><TabsTrigger value="edit">{t("brief.sections", "Guided sections")}</TabsTrigger><TabsTrigger value="preview">{t("brief.preview", "Working preview")}</TabsTrigger></TabsList>
      <TabsContent value="edit"><div className="grid min-w-0 gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <nav aria-label="Brief sections" className="space-y-2">{props.studio.sections.map((section, index) => <button key={section.sectionId} type="button" onClick={() => props.onSelectSection(section.sectionId)} aria-current={selected.sectionId === section.sectionId ? "step" : undefined} className={`flex w-full items-center justify-between rounded-lg border p-3 text-start transition ${selected.sectionId === section.sectionId ? "border-primary bg-primary/5" : "bg-card hover:bg-muted"}`}><span><span className="me-2 text-xs text-muted-foreground">{index + 1}</span>{label(section.sectionId)}</span><span className="flex gap-1">{section.readiness?.isStale && <Badge variant="outline">Stale</Badge>}{section.readiness?.isBlocked && <Badge variant="destructive">Blocked</Badge>}<Badge variant="secondary">{label(section.achievedState)}</Badge></span></button>)}</nav>
        <main className="min-w-0"><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle>{label(selected.sectionId)}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{selected.nextAction ?? "Complete the guided fields and save a new immutable revision."}</p></div><div className="flex gap-2"><Badge>{label(selected.applicability)}</Badge><Badge variant="secondary">{label(selected.achievedState)}</Badge></div></div></CardHeader><CardContent className="space-y-6"><BriefSectionEditor section={selected} identity={props.studio.identity} evidenceChoices={props.studio.choices.evidence} isSaving={props.isSaving} onSave={(content, evidenceIds) => props.onSaveSection(selected.sectionId, content, evidenceIds)} /><WorkflowActions section={selected} members={props.studio.choices.members} onAction={props.onWorkflowAction} /></CardContent></Card></main>
        <StudioRail studio={props.studio} progress={progress} onIssue={props.onIssue} isIssuing={props.isIssuing} onCreateVersion={props.onCreateVersion} onAssignRole={props.onAssignRole} onRevokeRole={props.onRevokeRole} />
      </div></TabsContent>
      <TabsContent value="preview"><WorkingPreview studio={props.studio} /></TabsContent>
    </Tabs>
  </div>;
}

function WorkflowActions({ section, members, onAction }: { section: BriefStudioSection; members: BriefStudioView["choices"]["members"]; onAction: Props["onWorkflowAction"] }) {
  const actions = section.permittedActions.filter(action => action !== "revise") as BriefWorkflowAction[];
  const [detail, setDetail] = useState("");
  const [owner, setOwner] = useState("");
  const [target, setTarget] = useState("");
  const targets = useMemo(() => [
    ...section.findings.map(item => ({ id: item.id, label: `Finding: ${item.statement}` })),
    ...section.conditions.filter(item => item.stage === "raised").map(item => ({ id: item.id, label: `${label(item.kind)}: ${item.explanation}` })),
    ...section.applicabilityChoices.map(item => ({ id: item.id, label: `${label(item.stage)} not-applicable decision` })),
  ], [section.applicabilityChoices, section.conditions, section.findings]);
  if (!actions.length) return <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>No action assigned to you</AlertTitle><AlertDescription>The server will show review, approval, evidence, or resolution actions when your functional role and the section state permit them.</AlertDescription></Alert>;
  return <section className="space-y-3 border-t pt-5" aria-labelledby="section-actions"><h3 id="section-actions" className="font-semibold">Your permitted actions</h3><div className="space-y-2"><Label htmlFor="action-rationale">Rationale</Label><Textarea id="action-rationale" value={detail} onChange={event => setDetail(event.target.value)} /></div>
    {actions.some(action => action === "record_finding" || action === "raise_condition") && <div className="space-y-2"><Label htmlFor="action-owner">Responsible member</Label><select id="action-owner" className="h-10 w-full rounded-md border bg-background px-3" value={owner} onChange={event => setOwner(event.target.value)}><option value="">Select a member</option>{members.map(member => <option key={member.id} value={member.id}>{member.label} · {member.organizationRole}</option>)}</select></div>}
    {actions.some(action => action.includes("resolution") || action.includes("not_applicable")) && targets.length > 0 && <div className="space-y-2"><Label htmlFor="action-target">Open item</Label><select id="action-target" className="h-10 w-full rounded-md border bg-background px-3" value={target} onChange={event => setTarget(event.target.value)}><option value="">Select an open item</option>{targets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>}
    <div className="flex flex-wrap gap-2">{actions.map(action => <Button key={action} type="button" size="sm" variant="outline" disabled={!detail.trim()} onClick={() => onAction(action, section, detail, Number(target) || undefined, Number(owner) || undefined)}>{label(action)}</Button>)}</div>
  </section>;
}

function StudioRail({ studio, progress, onIssue, isIssuing, onCreateVersion, onAssignRole, onRevokeRole }: { studio: BriefStudioView; progress: number; onIssue: () => void; isIssuing?: boolean; onCreateVersion?: () => void; onAssignRole?: Props["onAssignRole"]; onRevokeRole?: Props["onRevokeRole"] }) {
  const [member, setMember] = useState("");
  const [role, setRole] = useState("author");
  return <aside className="space-y-4" aria-label="Brief readiness and inbox"><Card><CardHeader><CardTitle>Issue readiness</CardTitle></CardHeader><CardContent className="space-y-3"><Progress value={progress} aria-label={`Brief display progress ${progress}%`} /><p>{progress}% complete</p>{studio.readiness.canIssue ? <Badge><CheckCircle2 className="me-1 h-3 w-3" />Ready</Badge> : <p className="text-sm text-muted-foreground">{studio.readiness.reasons.length} governed gate{studio.readiness.reasons.length === 1 ? "" : "s"} remain.</p>}{studio.permittedActions.issue && <Button className="w-full" disabled={isIssuing} onClick={onIssue}>Issue immutable brief</Button>}{onCreateVersion && <Button className="w-full" variant="outline" onClick={onCreateVersion}>Create successor version</Button>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="h-4 w-4" />Action inbox</CardTitle></CardHeader><CardContent>{studio.inbox.length ? <ul className="space-y-2 text-sm">{studio.inbox.slice(-6).map((event, index) => <li key={String(event.id ?? index)}>{label(String(event.eventType ?? "workflow update"))}</li>)}</ul> : <p className="text-sm text-muted-foreground">No pending workflow updates.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Assumption register</CardTitle></CardHeader><CardContent>{studio.assumptions.length ? <ul className="space-y-2 text-sm">{studio.assumptions.map(item => <li key={`${item.sectionId}-${item.id}`}><Badge variant="outline">{label(item.sectionId)}</Badge><p className="mt-1">{item.statement}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No assumptions declared.</p>}</CardContent></Card>
    {onAssignRole && <Card><CardHeader><CardTitle>Functional roles</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-2"><Label htmlFor="role-member">Member</Label><select id="role-member" className="h-10 w-full rounded-md border bg-background px-3" value={member} onChange={event => setMember(event.target.value)}><option value="">Select member</option>{studio.choices.members.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="role-name">Role</Label><select id="role-name" className="h-10 w-full rounded-md border bg-background px-3" value={role} onChange={event => setRole(event.target.value)}>{["author","section_owner","reviewer","approver","issuer","viewer"].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div><Button disabled={!member} onClick={() => onAssignRole(Number(member), role)}>Assign role</Button><ul className="space-y-2 text-sm">{studio.assignments.map(assignment => <li key={assignment.id} className="flex items-center justify-between gap-2"><span>{studio.choices.members.find(choice => choice.id === assignment.subjectUserId)?.label ?? "Member"} · {label(assignment.role)}</span>{onRevokeRole && <Button size="sm" variant="ghost" onClick={() => onRevokeRole(assignment.id)}>Revoke</Button>}</li>)}</ul></CardContent></Card>}
  </aside>;
}

function WorkingPreview({ studio }: { studio: BriefStudioView }) {
  return <Card><CardHeader><CardTitle>Working preview · Version {studio.version.versionNumber ?? "—"}</CardTitle><p className="text-sm text-muted-foreground">NOT ISSUED · live canonical working data</p></CardHeader><CardContent className="space-y-6">{studio.sections.map(section => <section key={section.sectionId} className="break-words border-b pb-5 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{label(section.sectionId)}</h3><Badge variant="secondary">{label(section.contentState?.kind ?? "missing")}</Badge></div>{section.contentState?.kind === "structured" ? <><p className="mt-2 whitespace-pre-wrap text-sm">{section.contentState.content.summary}</p>{section.assumptions.length > 0 && <div className="mt-3"><h4 className="text-sm font-medium">Assumptions</h4><ul className="list-disc ps-5 text-sm text-muted-foreground">{section.assumptions.map(item => <li key={item.id}>{item.statement} · {label(item.status)}</li>)}</ul></div>}</> : <p className="mt-2 text-sm text-muted-foreground">{section.contentState?.kind === "legacy" ? "Legacy content remains readable in history and has not been promoted." : "No validated structured content yet."}</p>}<p className="mt-2 text-xs text-muted-foreground">{section.evidence.length} evidence record(s) · {section.findings.length} finding(s) · {section.conditions.length} condition(s)</p></section>)}</CardContent></Card>;
}
