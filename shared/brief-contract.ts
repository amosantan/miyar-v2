import { z } from "zod";

export const BRIEF_POLICY_VERSION = "BR-03-readiness-v1" as const;

export const BRIEF_SECTION_IDS = [
  "intent",
  "asset_context",
  "space_programme",
  "design_direction",
  "specification_intent",
  "cost_quantities",
  "supply",
  "risk_compliance",
  "concept_media",
  "governance",
] as const;
export type BriefSectionId = (typeof BRIEF_SECTION_IDS)[number];

export const ISSUE_PURPOSES = [
  "internal_coordination",
  "client_board_approval",
  "tender_rfq",
] as const;
export type IssuePurpose = (typeof ISSUE_PURPOSES)[number];

export const BRIEF_TYPOLOGY_PROFILES = [
  "apartment",
  "villa",
  "office",
  "hospitality",
  "retail",
  "mixed_use",
] as const;
export type BriefTypologyProfile = (typeof BRIEF_TYPOLOGY_PROFILES)[number];

export const APPLICABILITY_VALUES = [
  "required",
  "conditional",
  "not_applicable",
] as const;
export type BriefApplicability = (typeof APPLICABILITY_VALUES)[number];

export const ACHIEVED_STATES = [
  "missing",
  "drafted",
  "evidenced",
  "reviewed",
  "approved",
  "issued",
] as const;
export type BriefAchievedState = (typeof ACHIEVED_STATES)[number];

export const CONTENT_AUTHORITIES = [
  "explicit_user_input",
  "deterministic_calculation",
  "governed_evidence",
  "declared_assumption",
  "professional_signoff",
  "ai_suggestion",
] as const;
export type BriefContentAuthority = (typeof CONTENT_AUTHORITIES)[number];

export const FUNCTIONAL_ROLES = [
  "author",
  "section_owner",
  "reviewer",
  "approver",
  "issuer",
  "viewer",
] as const;
export type BriefFunctionalRole = (typeof FUNCTIONAL_ROLES)[number];

export const CONDITION_KINDS = ["stale", "blocked"] as const;
export type BriefConditionKind = (typeof CONDITION_KINDS)[number];
export const CONDITION_GATES = ["evidence_content", "approval_issue"] as const;
export type BriefConditionGate = (typeof CONDITION_GATES)[number];

export const ISSUE_STATUSES = ["active", "superseded", "withdrawn"] as const;
export type BriefIssueStatus = (typeof ISSUE_STATUSES)[number];

export const DEPENDENCY_TYPES = [
  "project_input",
  "scenario",
  "geometry",
  "space_programme",
  "evidence",
  "calculation",
  "benchmark",
  "material",
  "supplier_offer",
  "board",
  "visual",
  "generation",
] as const;
export type BriefDependencyType = (typeof DEPENDENCY_TYPES)[number];

export const WORKFLOW_EVENT_TYPES = [
  "stream_created",
  "version_created",
  "section_revised",
  "role_assigned",
  "role_revoked",
  "finding_opened",
  "finding_resolution_submitted",
  "finding_resolution_accepted",
  "evidence_submitted",
  "applicability_proposed",
  "applicability_reviewed",
  "applicability_approved",
  "review_accepted",
  "section_approved",
  "approval_withdrawn",
  "condition_raised",
  "condition_resolution_submitted",
  "condition_resolution_accepted",
  "issue_created",
  "issue_superseded",
  "issue_withdrawal_requested",
  "issue_withdrawal_approved",
] as const;
export type BriefWorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

export const BRIEF_INSUFFICIENCY_CODES = [
  "invalid_section_structure",
  "unclassified_requirement",
  "missing_content",
  "missing_evidence",
  "prohibited_assumption",
  "incomplete_na_approval",
  "unresolved_finding",
  "active_stale_condition",
  "active_blocked_condition",
  "failed_reconciliation",
  "missing_lineage",
  "role_separation_failure",
  "missing_issue_metadata",
] as const;
export type BriefInsufficiencyCode = (typeof BRIEF_INSUFFICIENCY_CODES)[number];

export const briefSectionIdSchema = z.enum(BRIEF_SECTION_IDS);
export const issuePurposeSchema = z.enum(ISSUE_PURPOSES);
export const briefTypologyProfileSchema = z.enum(BRIEF_TYPOLOGY_PROFILES);
export const briefApplicabilitySchema = z.enum(APPLICABILITY_VALUES);
export const briefAchievedStateSchema = z.enum(ACHIEVED_STATES);
export const briefContentAuthoritySchema = z.enum(CONTENT_AUTHORITIES);
export const briefFunctionalRoleSchema = z.enum(FUNCTIONAL_ROLES);
export const briefConditionKindSchema = z.enum(CONDITION_KINDS);
export const briefConditionGateSchema = z.enum(CONDITION_GATES);
export const briefIssueStatusSchema = z.enum(ISSUE_STATUSES);
export const briefDependencyTypeSchema = z.enum(DEPENDENCY_TYPES);
export const briefWorkflowEventTypeSchema = z.enum(WORKFLOW_EVENT_TYPES);
export const briefInsufficiencyCodeSchema = z.enum(BRIEF_INSUFFICIENCY_CODES);

export const briefReadinessRefSchema = z.object({
  projectId: z.number().int().positive(),
  briefId: z.string().trim().min(1).max(128),
  versionId: z.string().trim().min(1).max(128),
});
export type BriefReadinessRef = z.infer<typeof briefReadinessRefSchema>;

export interface BriefInsufficiencyReason {
  code: BriefInsufficiencyCode;
  gate: number;
  message: string;
  nextAction: string;
  sectionId?: BriefSectionId;
  componentId?: string;
  ruleId?: string;
  dependencyId?: string;
}

export interface BriefReadinessComponentResult {
  componentId: string;
  isStale: boolean;
  isBlocked: boolean;
  canIssue: boolean;
  reasons: ReadonlyArray<BriefInsufficiencyReason>;
}

export interface BriefReadinessSectionResult {
  sectionId: BriefSectionId;
  applicability: BriefApplicability;
  achievedState: BriefAchievedState;
  isStale: boolean;
  isBlocked: boolean;
  canIssue: boolean;
  components: ReadonlyArray<BriefReadinessComponentResult>;
  reasons: ReadonlyArray<BriefInsufficiencyReason>;
  nextActions: ReadonlyArray<string>;
}

export interface BriefReadinessResult {
  policyVersion: typeof BRIEF_POLICY_VERSION;
  briefId: string;
  versionId: string;
  streamRevision: number;
  versionRevision: number;
  purpose: IssuePurpose;
  profile: BriefTypologyProfile;
  componentIds: ReadonlyArray<string>;
  canIssue: boolean;
  isStale: boolean;
  isBlocked: boolean;
  displayProgress: number;
  sections: ReadonlyArray<BriefReadinessSectionResult>;
  components: ReadonlyArray<BriefReadinessComponentResult>;
  reasons: ReadonlyArray<BriefInsufficiencyReason>;
  nextActions: ReadonlyArray<string>;
}

export const PURPOSE_SECTION_APPLICABILITY: Readonly<
  Record<
    IssuePurpose,
    Readonly<Record<BriefSectionId, "required" | "conditional">>
  >
> = {
  internal_coordination: {
    intent: "required",
    asset_context: "required",
    space_programme: "required",
    design_direction: "required",
    specification_intent: "conditional",
    cost_quantities: "conditional",
    supply: "conditional",
    risk_compliance: "required",
    concept_media: "conditional",
    governance: "required",
  },
  client_board_approval: {
    intent: "required",
    asset_context: "required",
    space_programme: "required",
    design_direction: "required",
    specification_intent: "required",
    cost_quantities: "required",
    supply: "conditional",
    risk_compliance: "required",
    concept_media: "conditional",
    governance: "required",
  },
  tender_rfq: {
    intent: "required",
    asset_context: "required",
    space_programme: "required",
    design_direction: "required",
    specification_intent: "required",
    cost_quantities: "required",
    supply: "required",
    risk_compliance: "required",
    concept_media: "conditional",
    governance: "required",
  },
};
