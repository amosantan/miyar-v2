# Issued Design Brief Architecture

- Contract ID: `BR-02-v1`
- Status: Approved
- Product dependency: approved `BR-01-v1`
- Decision record: [ADR-0008](../decisions/ADR-0008-issued-design-brief-versioning-architecture.md)
- Scope: future persistence, API, compatibility, migration, and recovery design only

## 1. Boundary and invariants

This contract specifies the future canonical architecture. BR-02 does not edit runtime types, routers, schema, migrations, or data.

The following invariants are mandatory:

1. Every canonical row has non-null `organizationId` and `projectId`; no global or null-owned brief record exists.
2. A stream is unique by organization, project, scope, and purpose. Scope is `project` or a scenario belonging to the same project.
3. All ten `BriefSectionId` containers exist in every version.
4. Section content revisions are immutable. Bindings carry purpose/version governance and cannot be treated as content.
5. `stale` and `blocked` are overlays; they never erase achieved maturity.
6. Authentication and organization role do not grant functional brief authority.
7. AI actors may author proposals only; they cannot review, approve, decide applicability, issue, supersede, or withdraw.
8. An issue locks exact references atomically. Later source changes do not mutate it.
9. Legacy artifacts are never retrospectively approved, issued, or synchronized by inference.
10. Numerical authority remains deterministic TypeScript with exact inputs and engine/benchmark versions.

## 2. Stable types

```ts
type BriefSectionId =
  | "intent"
  | "asset_context"
  | "space_programme"
  | "design_direction"
  | "specification_intent"
  | "cost_quantities"
  | "supply"
  | "risk_compliance"
  | "concept_media"
  | "governance";

type IssuePurpose =
  | "internal_coordination"
  | "client_board_approval"
  | "tender_rfq";
type BriefScope =
  | { type: "project" }
  | { type: "scenario"; scenarioId: number };
type Applicability = "required" | "conditional" | "not_applicable";
type AchievedState =
  | "missing"
  | "drafted"
  | "evidenced"
  | "reviewed"
  | "approved"
  | "issued";
type FunctionalRole =
  | "author"
  | "section_owner"
  | "reviewer"
  | "approver"
  | "issuer"
  | "viewer";
type ConditionKind = "stale" | "blocked";
type ConditionGate = "evidence_content" | "approval_issue";
type IssueStatus = "active" | "superseded" | "withdrawn";
type ContentOrigin = "user" | "deterministic" | "ai_proposal" | "legacy_import";
type DependencyType =
  | "project_input"
  | "scenario"
  | "geometry"
  | "space_programme"
  | "evidence"
  | "calculation"
  | "benchmark"
  | "material"
  | "supplier_offer"
  | "board"
  | "visual"
  | "generation";
type WorkflowEventType =
  | "stream_created"
  | "version_created"
  | "section_revised"
  | "role_assigned"
  | "role_revoked"
  | "finding_opened"
  | "finding_resolution_submitted"
  | "finding_resolution_accepted"
  | "evidence_submitted"
  | "applicability_proposed"
  | "applicability_reviewed"
  | "applicability_approved"
  | "review_accepted"
  | "section_approved"
  | "approval_withdrawn"
  | "condition_raised"
  | "condition_resolution_submitted"
  | "condition_resolution_accepted"
  | "issue_created"
  | "issue_superseded"
  | "issue_withdrawal_requested"
  | "issue_withdrawal_approved";

type DependencyRef =
  | {
      type: "calculation";
      calculationId: string;
      engineId: string;
      engineVersion: string;
      inputFingerprint: string;
      resultFingerprint: string;
    }
  | {
      type: "generation";
      generationId: string;
      providerId: string;
      modelId: string;
      modelVersion: string;
      promptId: string;
      promptVersion: string;
      schemaVersion: string;
      evaluationVersion?: string;
      inputFingerprint: string;
      outputFingerprint: string;
    }
  | {
      type: Exclude<DependencyType, "calculation" | "generation">;
      recordId: string;
      recordVersion: string;
      fingerprint: string;
    };
```

Canonical brief, version, revision, binding, operation, and issue identifiers are opaque positive integers internally and branded strings at the API boundary. Existing project and scenario API IDs remain positive numbers and are always resolved through the organization boundary.

## 3. Proposed relational model

Names are normative design names; implementation may use the repository's established casing while preserving semantics.

| Table                        | Purpose                                          | Required keys and constraints                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brief_streams`              | Stable aggregate for one scope and purpose       | non-null org/project/scope key; scope type; nullable scenario only for project scope; purpose; typology profile; optimistic revision; unique `(org, project, scopeKey, purpose)`; scenario ownership checked transactionally                 |
| `brief_versions`             | Ordered working versions                         | non-null org/project/stream; positive version number; predecessor; origin; `working` or `locked`; requirement-profile version; component scope; unique scoped number; expected stream revision                                               |
| `brief_section_revisions`    | Immutable reusable section payload               | non-null org/project and project/scenario scope; section ID; canonical payload; origin/author; content schema version; content and lineage-inclusive revision fingerprints/time; no stream/purpose ownership; insert-only                    |
| `brief_version_sections`     | Purpose-specific version/section binding         | non-null org/project/stream/version; revision nullable only while state is `missing`; section ID; applicability; achieved-state projection; frozen classifications and typology/component scope; unique scoped section; exactly ten bindings |
| `brief_role_events`          | Functional-authority grant/revoke ledger         | non-null org/project/stream; optional version/section scope; subject, role, `granted` or `revoked`, target grant, actor/reason/time; active authority is derived and subject must remain an active member                                    |
| `brief_findings`             | Immutable opened review findings                 | non-null scoped version/section/revision; reviewer; severity; owner; reason and opened time                                                                                                                                                  |
| `brief_finding_resolutions`  | Immutable staged finding-resolution ledger       | non-null scoped finding/revision; submitted/accepted/rejected stage; submitter or independent Reviewer; evidence; target submission and time; finding state is derived                                                                       |
| `brief_applicability_events` | Immutable N/A workflow ledger                    | non-null scoped binding/classification; proposal/review/approval/withdrawal event; rationale/inputs; actor/time; later stages reference proposal and enforce separation                                                                      |
| `brief_approvals`            | Immutable section approval/withdrawal ledger     | non-null scoped binding/revision; approver; approved/withdrawn decision; target approval on withdrawal; purpose, rationale, limitations and time; active approval is derived                                                                 |
| `brief_dependencies`         | Typed content and calculation/generation lineage | non-null scoped binding/revision; closed `DependencyRef` payload with explicit engine/model/prompt identities where applicable; authority, observation time and relevance; insert-only and no unversioned authoritative dependency           |
| `brief_condition_events`     | Immutable stale/blocked workflow ledger          | non-null scoped binding; raised/resolution-submitted/resolution-accepted event; kind/reason; target event; dependency, owner, evidence, actor/time; independent acceptance resolves the condition                                            |
| `brief_operations`           | Mutation idempotency/result ledger               | non-null org/project/actor/operation/key and stream when known; canonical request hash; status/result entity; unique actor operation key                                                                                                     |
| `brief_events`               | Append-only workflow audit ledger                | non-null org/project/stream/version; optional section/issue/operation; actor; closed event type; payload schema version; ordinal unique within operation; insert-only                                                                        |
| `brief_issues`               | Immutable issue identity                         | non-null org/project/stream/version/operation; positive issue number; issuer/time/purpose; metadata references; unique scoped issue number; status is derived from events                                                                    |
| `brief_issue_sections`       | Exact locked section references                  | non-null scoped issue/binding/revision; section; applicability/state, requirement-profile version, classification fingerprint, and component scope at issue; unique issue section; exactly ten rows                                          |
| `brief_issue_approvals`      | Exact issue approval references                  | non-null scoped issue/section/approval event; unique and insert-only                                                                                                                                                                         |
| `brief_issue_applicability`  | Exact issued N/A references                      | non-null scoped issue/section/applicability approval event; only for N/A; insert-only                                                                                                                                                        |
| `brief_issue_dependencies`   | Exact issued lineage references                  | non-null scoped issue/section/dependency and validated fingerprint/version; unique and insert-only                                                                                                                                           |
| `brief_legacy_links`         | Idempotent bridge to old records                 | non-null org/project/stream; source type/id; optional imported version/revision; disposition/rejection; unique scoped source identity                                                                                                        |

### 3.1 Tenant and relationship enforcement

Every primary table exposes a scoped unique key beginning with `(organizationId, projectId)`. Child relations carry the same scope. Where MySQL/PlanetScale foreign-key support or migration policy cannot enforce composite references, the final database helper must lock and revalidate the complete chain in one transaction before insert/update. Router-only checks are insufficient.

`scopeType=project` requires `scenarioId=null`; `scopeType=scenario` requires a non-null scenario owned by the same organization and project. Every stream and reusable revision stores a non-null application-computed `scopeKey`: exactly `project` for project scope or `scenario:<positive scenarioId>` for scenario scope. The service validates `scopeType`, `scenarioId`, and `scopeKey` in the final transaction. The unique key is exactly `(organizationId, projectId, scopeKey, issuePurpose)` for streams and `(organizationId, projectId, scopeKey, sectionId, revisionFingerprint)` for deduplicated revisions. `revisionFingerprint` canonically hashes content, origin/provenance, and the complete sorted dependency identities/fingerprints, so changed lineage creates a new revision even when visible content is identical. This avoids nullable-unique and generated-column differences across MySQL/PlanetScale. Reusable revisions use the organization/project/scope/section boundary, so an exact revision can be deliberately bound into more than one purpose stream.

### 3.2 Immutability

- Section revision payloads and source fingerprints are insert-only.
- Issue rows, issue-section/approval/applicability/dependency references, and issue events are insert-only. Any cached issue status is explicitly non-authoritative and derived from supersede/withdraw events.
- Corrections create new revisions/versions/issues.
- Database helpers expose no generic update/delete operation for immutable records.
- Later implementation adds contract tests and database privileges/predicates where supported; history is never cascade-deleted by an ordinary tenant workflow.

### 3.3 Frozen classifications and components

Each version stores the exact product/typology profile version. Each binding stores resolved requirement and impact classifications, source authority, field/rule IDs, component scope, and applicability. Mixed-use versions include a frozen component register; readiness is evaluated per included component and shared decision reconciliation. Missing or unapproved classification fails closed.

## 4. Workflow operations

Content, review, approval, and issue mutations require protected organization context, an authorized stream resolved from the organization/project boundary, an active functional assignment, `expectedRevision`, and an idempotency key. Missing and cross-organization resources return the same concealed result. `createStream`, `assignRole`, and `revokeRole` are governance exceptions: they require current organization-admin membership revalidated in the final transaction, but admin status alone grants no content, review, approval, or issue authority.

| Command                           | Required authority                                                                           | Atomic behavior                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brief.createStream`              | current organization admin                                                                   | validate scope/purpose/membership; create stream, v1, ten null-revision missing bindings, explicit initial role grants, operation and events atomically |
| `brief.createVersion`             | Author or Section Owner                                                                      | lock stream; compare expected revision; copy bindings by explicit carry-forward rules; append event                                                     |
| `brief.reviseSection`             | assigned Author/Section Owner for section                                                    | insert immutable revision; replace binding only in working version; reset/carry state deterministically; append event                                   |
| `brief.submitEvidence`            | assigned Section Owner, distinct from AI                                                     | validate exact drafted revision, authority labels and typed dependencies; advance to evidenced and append event                                         |
| `brief.assignRole` / `revokeRole` | governance-authorized organization admin; cannot grant through ordinary content mutation     | validate membership/scope and role eligibility; append assignment history/event                                                                         |
| `brief.recordFinding`             | independent Reviewer                                                                         | bind exact revision; open finding and blocker; append event                                                                                             |
| `brief.submitFindingResolution`   | assigned finding owner                                                                       | submit evidence against exact finding/revision; does not resolve it                                                                                     |
| `brief.acceptFindingResolution`   | independent Reviewer who did not submit resolution                                           | accept/reject exact resolution submission; only acceptance resolves finding blocker                                                                     |
| `brief.decideApplicability`       | proposer, independent Reviewer, independent Approver                                         | conditional-only three-actor path; bind exact classification/revision; append events                                                                    |
| `brief.raiseCondition`            | assigned Section Owner, Reviewer, Approver, or typed system actor                            | append stale/blocked condition with deterministic evidence/content or approval/issue gate against exact binding/dependency                              |
| `brief.submitConditionResolution` | assigned condition owner                                                                     | submit resolution evidence; condition remains active                                                                                                    |
| `brief.acceptConditionResolution` | independent Reviewer for evidence/content gate; independent Approver for approval/issue gate | accept/reject exact submission according to stored gate; only acceptance resolves condition and never advances maturity                                 |
| `brief.acceptReview`              | independent Reviewer                                                                         | exact evidenced revision, no unresolved finding; advance binding to reviewed; append event                                                              |
| `brief.approveSection`            | independent Approver                                                                         | exact reviewed revision, no active condition, self-approval denied; append approval and transition                                                      |
| `brief.withdrawApproval`          | assigned Approver                                                                            | append withdrawal; create/carry successor working binding at reviewed; prior event remains                                                              |
| `brief.markDependencyChanged`     | system actor with typed source authority                                                     | locate affected non-issued work, append stale condition and successor work; never mutate issue                                                          |
| `brief.issue`                     | assigned Issuer who is also Approver                                                         | organization-locked validation and issue transaction described below                                                                                    |
| `brief.supersedeIssue`            | Issuer plus valid successor issue                                                            | append relation/status/event; old issue remains readable                                                                                                |
| `brief.requestIssueWithdrawal`    | assigned Issuer                                                                              | append withdrawal request with reason/distribution impact; issue remains active                                                                         |
| `brief.approveIssueWithdrawal`    | independent assigned Approver                                                                | approve exact request event and append withdrawn status/event atomically; never delete or reactivate                                                    |

AI/system actors may create proposed revisions and dependency events only. They cannot receive Reviewer, Approver, or Issuer assignments.

### 4.1 Atomic issue transaction

1. Lock the stream and exact working version; reject stale `expectedRevision`.
2. Resolve organization/project/scope again and validate scenario ownership.
3. Verify exactly ten unique bindings and the frozen purpose/profile/component matrix.
4. Verify every applicable or approved-N/A binding is approved on its exact content revision.
5. Verify no active stale/blocked condition, unresolved finding, prohibited assumption, missing evidence, or unclassified requirement.
6. Verify role assignments and all separation-of-duty predicates, including issuer-authored sections.
7. Verify deterministic reconciliations and required lineage identities are present; BR-03 later supplies the deterministic readiness result consumed here.
8. Validate issue identity metadata, disclaimer, confidentiality, distribution policy, and relevant expiry policy.
9. Allocate the next scoped issue number under the stream lock.
10. Insert `brief_issues`, ten `brief_issue_sections` with frozen classification fingerprints, exact approval/applicability/dependency reference rows, issued transitions, and ordered issue events linked to the same operation.
11. Mark the working version locked and commit. Any failure rolls back all steps.

`brief_operations` stores a canonical request hash before mutation completion. Repeating an identical key and request hash returns the recorded result. Reusing the key with different input is a conflict. One operation may own many ordered workflow events. A competing request with an old expected revision is a conflict and creates nothing.

## 5. Query/API contracts

The future canonical tRPC module uses the operation names below. BR-02 does not register them at runtime; implementation must preserve these request/response semantics or supersede this contract before changing them.

```ts
type CanonicalId = string;
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
type BriefRef = { briefId: CanonicalId; projectId: number };
type VersionRef = BriefRef & { versionId: CanonicalId };
type MutationMeta = { idempotencyKey: string; expectedRevision: number };
type MutationResult<T> = {
  operationId: CanonicalId;
  revision: number;
  value: T;
};
type PageInput = { cursor?: CanonicalId; limit?: number };
type Page<T> = { items: ReadonlyArray<T>; nextCursor: CanonicalId | null };

type BriefSummary = BriefRef & {
  scope: BriefScope;
  purpose: IssuePurpose;
  typologyProfileVersion: string;
  currentVersionId: string | null;
  latestIssueId: string | null;
  revision: number;
};

type SectionBindingDto = {
  sectionId: BriefSectionId;
  revisionId: string | null;
  applicability: Applicability;
  achievedState: AchievedState;
  classifications: ReadonlyArray<RequirementClassification>;
  activeConditions: ReadonlyArray<ReadinessCondition>;
};

type RequirementClassification = {
  ruleId: string;
  requirement: "required" | "conditional" | "optional";
  impacts: ReadonlyArray<
    "coordination" | "decision" | "procurement" | "professional"
  >;
  sourceId: string;
  sourceVersion: string;
  componentId?: string;
  approvedBy: number;
  approvedAt: string;
};

type ReadinessCondition = {
  conditionId: string;
  kind: ConditionKind;
  gate: ConditionGate;
  reasonCode: string;
  explanation: string;
  dependencyId?: string;
  ownerUserId: number;
  raisedAt: string;
  resolutionRequirement: string;
};

type AssignmentDto = {
  grantEventId: CanonicalId;
  userId: number;
  role: FunctionalRole;
  versionId?: CanonicalId;
  sectionId?: BriefSectionId;
  active: boolean;
};
type FindingDto = {
  findingId: CanonicalId;
  versionId: CanonicalId;
  sectionId: BriefSectionId;
  revisionId: CanonicalId;
  severity: "blocking" | "advisory";
  ownerUserId: number;
  statement: string;
  resolved: boolean;
};
type IssueDto = {
  issueId: CanonicalId;
  briefId: CanonicalId;
  versionId: CanonicalId;
  issueNumber: number;
  purpose: IssuePurpose;
  status: IssueStatus;
  issuedAt: string;
};
type EventDto = {
  eventId: CanonicalId;
  type: WorkflowEventType;
  actorUserId?: number;
  occurredAt: string;
  versionId: CanonicalId;
  sectionId?: BriefSectionId;
};

interface BriefCommandContracts {
  "brief.createStream": {
    input: {
      projectId: number;
      scope: BriefScope;
      purpose: IssuePurpose;
      typologyProfileVersion: string;
      componentIds: string[];
      initialAssignments: Array<{
        userId: number;
        role: FunctionalRole;
        sectionId?: BriefSectionId;
      }>;
      idempotencyKey: string;
    };
    output: MutationResult<BriefSummary>;
  };
  "brief.createVersion": {
    input: VersionRef &
      MutationMeta & {
        predecessorVersionId: CanonicalId;
        carryForwardSections: BriefSectionId[];
      };
    output: MutationResult<{ versionId: CanonicalId; versionNumber: number }>;
  };
  "brief.reviseSection": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        contentSchemaVersion: string;
        content: JsonValue;
        origin: ContentOrigin;
        dependencies: DependencyRef[];
      };
    output: MutationResult<SectionBindingDto>;
  };
  "brief.submitEvidence": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        revisionId: CanonicalId;
        dependencyIds: CanonicalId[];
        rationale: string;
      };
    output: MutationResult<SectionBindingDto>;
  };
  "brief.assignRole": {
    input: BriefRef &
      MutationMeta & {
        userId: number;
        role: FunctionalRole;
        versionId?: CanonicalId;
        sectionId?: BriefSectionId;
        reason: string;
      };
    output: MutationResult<AssignmentDto>;
  };
  "brief.revokeRole": {
    input: BriefRef &
      MutationMeta & { grantEventId: CanonicalId; reason: string };
    output: MutationResult<AssignmentDto>;
  };
  "brief.recordFinding": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        revisionId: CanonicalId;
        severity: "blocking" | "advisory";
        ownerUserId: number;
        statement: string;
      };
    output: MutationResult<FindingDto>;
  };
  "brief.submitFindingResolution": {
    input: VersionRef &
      MutationMeta & {
        findingId: CanonicalId;
        resolutionRevisionId: CanonicalId;
        evidence: JsonValue;
      };
    output: MutationResult<FindingDto>;
  };
  "brief.acceptFindingResolution": {
    input: VersionRef &
      MutationMeta & {
        findingId: CanonicalId;
        resolutionSubmissionEventId: CanonicalId;
        outcome: "accepted" | "rejected";
        rationale: string;
      };
    output: MutationResult<FindingDto>;
  };
  "brief.decideApplicability": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        action: "propose" | "accept_review" | "approve" | "withdraw";
        proposalEventId?: CanonicalId;
        rationale: string;
        evidence: JsonValue;
      };
    output: MutationResult<SectionBindingDto>;
  };
  "brief.raiseCondition": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        kind: ConditionKind;
        gate: ConditionGate;
        reasonCode: string;
        explanation: string;
        ownerUserId: number;
        dependencyId?: CanonicalId;
        resolutionRequirement: string;
      };
    output: MutationResult<ReadinessCondition>;
  };
  "brief.submitConditionResolution": {
    input: VersionRef &
      MutationMeta & { conditionId: CanonicalId; evidence: JsonValue };
    output: MutationResult<ReadinessCondition>;
  };
  "brief.acceptConditionResolution": {
    input: VersionRef &
      MutationMeta & {
        conditionId: CanonicalId;
        resolutionSubmissionEventId: CanonicalId;
        outcome: "accepted" | "rejected";
        rationale: string;
      };
    output: MutationResult<ReadinessCondition>;
  };
  "brief.acceptReview": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        revisionId: CanonicalId;
        rationale: string;
      };
    output: MutationResult<SectionBindingDto>;
  };
  "brief.approveSection": {
    input: VersionRef &
      MutationMeta & {
        sectionId: BriefSectionId;
        revisionId: CanonicalId;
        limitations: string[];
        rationale: string;
      };
    output: MutationResult<SectionBindingDto>;
  };
  "brief.withdrawApproval": {
    input: VersionRef &
      MutationMeta & { approvalEventId: CanonicalId; reason: string };
    output: MutationResult<SectionBindingDto>;
  };
  "brief.issue": {
    input: VersionRef &
      MutationMeta & {
        disclaimerVersion: string;
        confidentiality: "organization" | "named_recipients";
        distributionPolicyVersion: string;
        expiresAt?: string;
      };
    output: MutationResult<IssueDto>;
  };
  "brief.supersedeIssue": {
    input: BriefRef &
      MutationMeta & {
        priorIssueId: CanonicalId;
        successorIssueId: CanonicalId;
        reason: string;
      };
    output: MutationResult<IssueDto>;
  };
  "brief.requestIssueWithdrawal": {
    input: BriefRef &
      MutationMeta & {
        issueId: CanonicalId;
        reason: string;
        distributionImpact: string;
      };
    output: MutationResult<IssueDto>;
  };
  "brief.approveIssueWithdrawal": {
    input: BriefRef &
      MutationMeta & {
        issueId: CanonicalId;
        withdrawalRequestEventId: CanonicalId;
        rationale: string;
      };
    output: MutationResult<IssueDto>;
  };
}

interface BriefQueryContracts {
  "brief.getStream": { input: BriefRef; output: BriefSummary };
  "brief.listStreams": {
    input: {
      projectId: number;
      scope?: BriefScope;
      purpose?: IssuePurpose;
    } & PageInput;
    output: Page<BriefSummary>;
  };
  "brief.getVersion": {
    input: VersionRef;
    output: { summary: BriefSummary; sections: SectionBindingDto[] };
  };
  "brief.getSectionHistory": {
    input: BriefRef & { sectionId: BriefSectionId } & PageInput;
    output: Page<{
      revisionId: CanonicalId;
      origin: ContentOrigin;
      fingerprint: string;
      createdAt: string;
    }>;
  };
  "brief.getAssignments": {
    input: BriefRef & PageInput;
    output: Page<AssignmentDto>;
  };
  "brief.getFindings": {
    input: VersionRef & { sectionId?: BriefSectionId } & PageInput;
    output: Page<FindingDto>;
  };
  "brief.getDependencyStatus": {
    input: VersionRef & { sectionId?: BriefSectionId };
    output: Array<{
      dependency: DependencyRef;
      activeConditions: ReadinessCondition[];
    }>;
  };
  "brief.getWorkflowHistory": {
    input: BriefRef & PageInput;
    output: Page<EventDto>;
  };
  "brief.getIssueLedger": {
    input: BriefRef & PageInput;
    output: Page<IssueDto>;
  };
}
```

Commands are `brief.createStream`, `brief.createVersion`, `brief.reviseSection`, `brief.submitEvidence`, `brief.assignRole`, `brief.revokeRole`, `brief.recordFinding`, `brief.submitFindingResolution`, `brief.acceptFindingResolution`, `brief.decideApplicability`, `brief.raiseCondition`, `brief.submitConditionResolution`, `brief.acceptConditionResolution`, `brief.acceptReview`, `brief.approveSection`, `brief.withdrawApproval`, `brief.issue`, `brief.supersedeIssue`, `brief.requestIssueWithdrawal`, and `brief.approveIssueWithdrawal`. Dependency-change processing is an internal service command, not a tenant-callable endpoint.

Queries are `brief.getStream`, `brief.listStreams`, `brief.getVersion`, `brief.getSectionHistory`, `brief.getAssignments`, `brief.getFindings`, `brief.getDependencyStatus`, `brief.getWorkflowHistory`, and `brief.getIssueLedger`. They return stored facts and insufficiency reasons, not a client-computed authoritative readiness percentage. Public issue resolution is deliberately absent until BR-07.

Validation uses closed enums, bounded strings/JSON payloads, positive IDs, ISO timestamps at boundaries, and schema-versioned payloads. APIs never accept caller-supplied organization identity. Every write produces an audit event in the same transaction; best-effort audit is not sufficient for approval or issue authority.

## 6. Current consumer disposition and cutover

| Current path                                | Current authority/use                                      | BR-02 disposition                                              | Later cutover owner / risk                              |
| ------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `design_briefs` and `design.generateBrief`  | Six structured JSON fields; RFQ and DOCX source            | legacy project/scenario draft provenance only                  | BR-03/04; mapping loss and duplicate version numbers    |
| `ai_design_briefs` and advisor generation   | AI narrative; current investor/share source                | legacy AI proposal provenance only                             | BR-08/07; AI must never inherit approval                |
| autonomous brief Markdown                   | transient AI narrative/report input                        | legacy presentation/proposal; no canonical issue mapping       | BR-08; free-form schema loss                            |
| `design.generateRfqFromBrief`               | consumes structured brief by ID                            | remains legacy until tender issue adapter is certified         | EV-06/BR-07; procurement must not read unissued work    |
| `design.exportBriefDocx`                    | renders current structured JSON                            | remains legacy-labelled export                                 | BR-07; file identity and live drift                     |
| `project.generateReport` and stored reports | rebuild from current project/evaluation data               | derived legacy presentation; no issue status                   | BR-07; format reconciliation/live recomputation         |
| investor HTML/PDF                           | joins latest AI brief with live recommendations/benchmarks | derived legacy presentation                                    | BR-07; current data can change output                   |
| public AI brief share                       | token on latest AI brief, live joins                       | legacy read-only share; never canonical issued share           | BR-07; expiry/revocation and immutable resolution       |
| boards, visuals, assets and asset links     | concept media/evidence associations                        | typed future dependencies; no automatic approval               | SC-02/BR-07; polymorphic ownership and version identity |
| evidence references/records                 | evidence graph and target links                            | typed dependency candidates after authority/version validation | EV phase; pooled/tenant source authority                |
| project approval state                      | whole-project RFQ/marketing signal                         | adjacent legacy signal only                                    | BR-03/04; cannot authorize section/issue                |
| project evaluation readiness                | input confirmation for scoring                             | separate prerequisite signal                                   | BR-03; must not equal brief readiness                   |
| project workspace                           | orchestration of live project capabilities                 | compatibility reader until canonical UI cutover                | BR-04; mixed legacy/canonical display                   |

Cutover order is fixed:

1. Expand schema and deploy code with all canonical flags off.
2. Enable canonical creation/writes for explicitly selected new projects; write canonical tables only.
3. Run read-only inventory, dry-run import, then approved idempotent legacy import.
4. Enable a canonical read adapter per organization and named consumer only after its contract tests pass. Every adapter request must declare the exact `(organization, project, scopeKey, issuePurpose, consumerKey)` identity. It selects only that canonical stream. If absent, it executes that consumer's unchanged legacy query; it never treats a stream for another scenario or purpose as presence and never aggregates canonical and legacy rows.
5. Cut over readiness/workspace, then controlled downstream consumers. RFQ, renders, reports, and public share cannot become canonical before their owning gates.
6. Stop legacy writes only after usage telemetry, rollback window, and all supported consumer evidence pass.
7. Contract/remove legacy paths in a separate approved migration; BR-02 authorizes no deletion.

Existing legacy APIs that accept only `projectId`—including structured brief list/latest, RFQ/DOCX, report generation, investor export, and public share—remain legacy-only because they cannot identify scope and purpose safely. Their later owners must add an explicit canonical adapter input or a separately versioned endpoint before cutover. Creating a project-scope internal-coordination stream therefore suppresses nothing for a scenario stream, board/tender purpose, or any unconverted legacy consumer.

There is never a mode where one user action writes both legacy and canonical records. Once an exact consumer identity is canonical-enabled and its exact stream exists, that adapter does not merge or ingest later legacy content silently. A missing exact stream falls back without creating one; an existing but incomplete canonical stream returns canonical insufficiency rather than hiding it with legacy data.

## 7. Migration, backfill, and recovery design

### 7.1 Expand

- Add canonical tables, scoped indexes, and provider-supported constraints without modifying legacy tables.
- Add optional bridge identifiers only where compatibility requires them; tenant/project columns in canonical tables are never nullable.
- Deploy inert helpers/adapters with feature flags off and verify old application reads/writes unchanged.

### 7.2 Inventory and dry run

The future importer reads legacy records in stable primary-key order and emits counts plus record-level classifications without writing:

- valid project brief;
- valid same-project scenario brief;
- missing/null-owned project or invalid scenario ownership;
- duplicate/non-monotonic legacy version;
- malformed/incomplete JSON;
- AI brief with/without matching structured brief;
- report/share/RFQ references requiring later consumer disposition.

No classifier guesses organization, scenario, purpose, approval, issue, or missing content. Rejected rows remain readable through legacy paths and receive a reason report without mutation.

### 7.3 Idempotent import

- Import eligible `design_briefs` into a project/scenario stream for `internal_coordination` only as `origin=legacy_import` working versions.
- Partition by verified organization, project, and normalized project/scenario scope. Sort each partition by legacy `version`, `createdAt`, then primary key; allocate new canonical version numbers sequentially from 1. Preserve the original number/time/ID as provenance and flag duplicate or non-monotonic numbers without allowing them to collide.
- Apply this conservative six-field mapping: `projectIdentity` supplies separate candidate `intent` and `asset_context` revisions with original JSON paths; `designNarrative` supplies `design_direction`; `materialSpecifications` supplies `specification_intent` and only explicit supplier/source fields may supply `supply`; `boqFramework` plus `detailedBudget` supply `cost_quantities`; an explicit `detailedBudget.spaceAllocation` may supply `space_programme`; `designerInstructions` supplies a draft `governance` candidate. `risk_compliance` and `concept_media` remain missing unless independently typed legacy records are mapped later. No field is invented or promoted across these boundaries.
- Create all ten bindings. A missing binding has null revision and state `missing`; mapped content is at most `drafted` with explicit import limitations.
- Import AI brief content only as `ai_proposal` revisions/dependencies when a deterministic mapping is valid; otherwise record a legacy link without content promotion.
- Preserve legacy `createdBy` only as content provenance. Create no active role assignment and no finding acceptance, applicability approval, section approval, issue, supersede, or withdrawal event. A current organization admin assigns future roles explicitly after import.
- Use `brief_legacy_links` uniqueness and payload fingerprints so a second run creates zero duplicates. A changed legacy row is reported as drift and never overwrites the first import.

### 7.4 Integrity and provider verification

The later implementation must prove on disposable MySQL 8 and the approved PlanetScale compatibility target:

- every canonical row resolves to one existing same-org project;
- scenario scopes resolve to the same project;
- stream and version numbers are unique under concurrency;
- every complete version and issue has exactly ten distinct sections;
- child scope matches parent scope;
- immutable references cannot be updated by supported helpers;
- import is idempotent and rejected rows are unchanged;
- old and new application versions operate through the planned mixed-version window;
- no table scan, unsupported DDL, or destructive statement entered the expand migration.

### 7.5 Rollback and restore

- Before canonical issues exist, disable write/read gates and roll back application code; additive tables remain.
- After imports, disable canonical reads/writes and retain tables for diagnosis; legacy sources remain unchanged and authoritative for legacy consumers.
- After canonical issues exist, never delete or reverse their history. Repair forward or restore the affected canonical tables to a verified recovery point, then reconcile append-only events.
- A bad import is corrected by a versioned forward repair from preserved legacy source and import ledger, not by editing issued data.
- Shared migration, backfill, feature enablement, restore, and legacy contraction each require separate named approval and recovery evidence.

## 8. Contract walkthroughs

1. **Concurrent revision:** two authors use revision 7; one commits revision 8, the other receives conflict and creates no row.
2. **Idempotent issue retry:** a network retry with identical key returns the original issue; changed input with that key conflicts.
3. **Atomic issue failure:** failure after number allocation rolls back issue, references, transitions, and event; the next success has no phantom issue.
4. **Cross-tenant concealment:** an org-B version/section ID supplied by org A resolves like a missing resource and produces no audit payload leak.
5. **Scenario mismatch:** a scenario owned by another project cannot create a stream or legacy mapping even inside the same organization.
6. **Self-approval denial:** an author cannot review or approve their section; an issuer-authored section needs another assigned approver.
7. **Conditional N/A:** proposer, reviewer, and approver are independent; required content cannot become N/A; the approved decision is bound and issued as the section content.
8. **Stale dependency:** a benchmark fingerprint change adds stale successor work and insufficiency reasons; the prior issue and its locked reference remain byte-for-byte unchanged.
9. **Legacy import:** incomplete structured JSON becomes explicit draft/missing bindings, never approved/issued; a second import is a no-op.
10. **Legacy drift:** a changed old row after import is reported and cannot overwrite canonical work.
11. **Supersession:** a valid successor issue labels the prior issue superseded without changing its content or distribution history.
12. **Withdrawal:** Issuer plus independent Approver append reason and distribution impact; the issue remains authorized-history readable and cannot be silently reactivated.

## 9. Ownership boundaries

- `BR-02`: this persistence, API, compatibility, migration, event, and issue-reference architecture.
- `BR-03`: deterministic readiness engine and exact insufficiency evaluation.
- `BR-04`: author/review/approval/issue workspace and role journeys.
- `BR-05`/`BR-06`: versioned rule packs and professional typology classifications.
- `BR-07`: canonical snapshot DTO, fingerprints/hashes, render reconciliation, artifacts, and issued sharing.
- `BR-08`: AI schema/prompt/model/evaluation promotion authority.
- `EV`/`SC-02`: governed evidence/procurement and controlled concept-media records.

No later step may weaken tenant scope, separation of duties, immutability, explicit-input preservation, deterministic numerical authority, or non-retrospective legacy treatment without a superseding approved ADR.
