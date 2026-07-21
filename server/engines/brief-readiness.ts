import {
  ACHIEVED_STATES,
  BRIEF_POLICY_VERSION,
  BRIEF_SECTION_IDS,
  PURPOSE_SECTION_APPLICABILITY,
  type BriefAchievedState,
  type BriefApplicability,
  type BriefContentAuthority,
  type BriefFunctionalRole,
  type BriefInsufficiencyCode,
  type BriefInsufficiencyReason,
  type BriefReadinessComponentResult,
  type BriefReadinessResult,
  type BriefReadinessSectionResult,
  type BriefSectionId,
  type BriefTypologyProfile,
  type IssuePurpose,
} from "@shared/brief-contract";

export interface BriefRequirementFact {
  ruleId: string;
  classified: boolean;
  required: boolean;
  componentId?: string;
  hasContent: boolean;
  hasEvidence: boolean;
  authority?: BriefContentAuthority;
  assumptionImpacts?: ReadonlyArray<
    "coordination" | "decision" | "procurement" | "professional"
  >;
  hasRequiredProfessionalReview?: boolean;
  lineageComplete?: boolean;
}

export interface BriefConditionFact {
  conditionId: string;
  kind: "stale" | "blocked";
  active: boolean;
  componentId?: string;
  dependencyId?: string;
}

export interface BriefFindingFact {
  findingId: string;
  severity: "blocking" | "advisory";
  resolved: boolean;
  componentId?: string;
}

export interface BriefReconciliationFact {
  ruleId: string;
  passed: boolean;
  componentId?: string;
  dependencyId?: string;
}

export interface BriefSectionReadinessFacts {
  sectionId: BriefSectionId;
  applicability: BriefApplicability;
  achievedState: BriefAchievedState;
  revisionId: string | null;
  authorUserId?: number;
  reviewerUserId?: number;
  approverUserId?: number;
  applicabilityProposerUserId?: number;
  applicabilityReviewerUserId?: number;
  applicabilityApproverUserId?: number;
  requirements: ReadonlyArray<BriefRequirementFact>;
  conditions: ReadonlyArray<BriefConditionFact>;
  findings: ReadonlyArray<BriefFindingFact>;
  reconciliations: ReadonlyArray<BriefReconciliationFact>;
  componentCoverage?: ReadonlyArray<{
    componentId: string;
    complete: boolean;
    reconciled: boolean;
  }>;
}

export interface BriefIssueMetadataFacts {
  documentIdentity: boolean;
  disclaimerVersion: boolean;
  confidentiality: boolean;
  distributionPolicyVersion: boolean;
  reproducibilityIdentity: boolean;
}

export interface BriefReadinessFacts {
  briefId: string;
  versionId: string;
  streamRevision: number;
  versionRevision: number;
  purpose: IssuePurpose;
  profile: BriefTypologyProfile;
  componentIds: ReadonlyArray<string>;
  sections: ReadonlyArray<BriefSectionReadinessFacts>;
  issuerUserId?: number;
  activeRoles: ReadonlyArray<{ userId: number; role: BriefFunctionalRole }>;
  issueMetadata: BriefIssueMetadataFacts;
}

const STATE_SCORE: Readonly<Record<BriefAchievedState, number>> = {
  missing: 0,
  drafted: 1,
  evidenced: 2,
  reviewed: 3,
  approved: 4,
  issued: 4,
};

const GATE: Readonly<Record<BriefInsufficiencyCode, number>> = {
  invalid_section_structure: 1,
  unclassified_requirement: 2,
  missing_content: 3,
  missing_evidence: 4,
  prohibited_assumption: 5,
  incomplete_na_approval: 6,
  unresolved_finding: 7,
  active_stale_condition: 8,
  active_blocked_condition: 9,
  failed_reconciliation: 10,
  missing_lineage: 11,
  role_separation_failure: 12,
  missing_issue_metadata: 13,
};

function reason(
  code: BriefInsufficiencyCode,
  message: string,
  nextAction: string,
  extra: Partial<BriefInsufficiencyReason> = {}
): BriefInsufficiencyReason {
  return { code, gate: GATE[code], message, nextAction, ...extra };
}

const sectionOrder = new Map(BRIEF_SECTION_IDS.map((id, index) => [id, index]));
export function compareBriefInsufficiencyReasons(
  a: BriefInsufficiencyReason,
  b: BriefInsufficiencyReason
): number {
  return (
    a.gate - b.gate ||
    (sectionOrder.get(a.sectionId!) ?? BRIEF_SECTION_IDS.length) -
      (sectionOrder.get(b.sectionId!) ?? BRIEF_SECTION_IDS.length) ||
    (a.componentId ?? "").localeCompare(b.componentId ?? "") ||
    (a.ruleId ?? a.dependencyId ?? "").localeCompare(
      b.ruleId ?? b.dependencyId ?? ""
    ) ||
    a.code.localeCompare(b.code)
  );
}

function prohibitedAssumption(
  purpose: IssuePurpose,
  impacts: BriefRequirementFact["assumptionImpacts"]
): boolean {
  if (purpose === "internal_coordination") return false;
  if (purpose === "client_board_approval")
    return Boolean(impacts?.includes("decision"));
  return Boolean(impacts?.includes("procurement"));
}

function actorSeparationFailures(
  section: BriefSectionReadinessFacts,
  issuerUserId?: number
): BriefInsufficiencyReason[] {
  const result: BriefInsufficiencyReason[] = [];
  const extra = { sectionId: section.sectionId };
  if (section.authorUserId && section.authorUserId === section.reviewerUserId)
    result.push(
      reason(
        "role_separation_failure",
        "The section author cannot review the same revision.",
        "Assign an independent reviewer.",
        extra
      )
    );
  if (section.authorUserId && section.authorUserId === section.approverUserId)
    result.push(
      reason(
        "role_separation_failure",
        "The section author cannot approve the same revision.",
        "Assign an independent approver.",
        extra
      )
    );
  if (section.applicability === "not_applicable") {
    const actors = [
      section.applicabilityProposerUserId,
      section.applicabilityReviewerUserId,
      section.applicabilityApproverUserId,
    ];
    if (
      actors.some(value => value === undefined) ||
      new Set(actors).size !== actors.length
    )
      result.push(
        reason(
          "role_separation_failure",
          "The N/A proposal, review, and approval must have independent named actors.",
          "Complete the N/A decision with three independent actors.",
          extra
        )
      );
  }
  if (
    issuerUserId &&
    section.authorUserId === issuerUserId &&
    section.approverUserId === issuerUserId
  )
    result.push(
      reason(
        "role_separation_failure",
        "An issuer-authored section requires another independent approver.",
        "Obtain approval from another assigned approver.",
        extra
      )
    );
  return result;
}

function evaluateSection(
  section: BriefSectionReadinessFacts,
  purpose: IssuePurpose,
  componentIds: readonly string[],
  issuerUserId?: number
): BriefReadinessSectionResult {
  const reasons: BriefInsufficiencyReason[] = [];
  const baseline = PURPOSE_SECTION_APPLICABILITY[purpose][section.sectionId];
  if (baseline === "required" && section.applicability !== "required")
    reasons.push(
      reason(
        "invalid_section_structure",
        `Section ${section.sectionId} is required for ${purpose}.`,
        "Restore the required applicability classification.",
        { sectionId: section.sectionId }
      )
    );
  if (baseline === "conditional" && section.applicability === "conditional")
    reasons.push(
      reason(
        "unclassified_requirement",
        `Conditional section ${section.sectionId} has no approved required/N/A decision.`,
        "Complete the applicability decision.",
        { sectionId: section.sectionId }
      )
    );
  if (section.revisionId === null)
    reasons.push(
      reason(
        "missing_content",
        `Section ${section.sectionId} has no bound content revision.`,
        "Draft and bind section content.",
        { sectionId: section.sectionId }
      )
    );
  if (
    section.applicability !== "not_applicable" &&
    section.requirements.length === 0
  )
    reasons.push(
      reason(
        "unclassified_requirement",
        `Section ${section.sectionId} has no frozen requirement classifications.`,
        "Classify and freeze the applicable section rules.",
        { sectionId: section.sectionId }
      )
    );
  if (
    section.applicability === "not_applicable" &&
    STATE_SCORE[section.achievedState] < STATE_SCORE.approved
  )
    reasons.push(
      reason(
        "incomplete_na_approval",
        `Section ${section.sectionId} has an incomplete N/A approval path.`,
        "Review and independently approve the N/A decision.",
        { sectionId: section.sectionId }
      )
    );

  for (const requirement of section.requirements) {
    const extra = {
      sectionId: section.sectionId,
      componentId: requirement.componentId,
      ruleId: requirement.ruleId,
    };
    if (!requirement.classified)
      reasons.push(
        reason(
          "unclassified_requirement",
          `Rule ${requirement.ruleId} has no frozen approved classification.`,
          "Approve and freeze the rule classification.",
          extra
        )
      );
    if (requirement.required && !requirement.hasContent)
      reasons.push(
        reason(
          "missing_content",
          `Required rule ${requirement.ruleId} has no usable content.`,
          "Supply the required content.",
          extra
        )
      );
    if (requirement.required && !requirement.hasEvidence)
      reasons.push(
        reason(
          "missing_evidence",
          `Required rule ${requirement.ruleId} lacks eligible evidence.`,
          "Link current governed evidence.",
          extra
        )
      );
    if (requirement.authority === "ai_suggestion" && requirement.required)
      reasons.push(
        reason(
          "missing_evidence",
          `AI suggestion ${requirement.ruleId} is not authoritative evidence.`,
          "Have a named human accept it under an eligible authority class.",
          extra
        )
      );
    if (
      requirement.authority === "declared_assumption" &&
      prohibitedAssumption(purpose, requirement.assumptionImpacts)
    )
      reasons.push(
        reason(
          "prohibited_assumption",
          `Assumption ${requirement.ruleId} is prohibited for ${purpose}.`,
          "Resolve the assumption with eligible evidence.",
          extra
        )
      );
    if (requirement.required && requirement.lineageComplete === false)
      reasons.push(
        reason(
          "missing_lineage",
          `Rule ${requirement.ruleId} has incomplete source lineage.`,
          "Bind the exact source and version lineage.",
          extra
        )
      );
    if (requirement.hasRequiredProfessionalReview === false)
      reasons.push(
        reason(
          "missing_evidence",
          `Rule ${requirement.ruleId} requires professional review.`,
          "Obtain the scoped professional sign-off.",
          extra
        )
      );
  }
  for (const finding of section.findings)
    if (finding.severity === "blocking" && !finding.resolved)
      reasons.push(
        reason(
          "unresolved_finding",
          `Blocking finding ${finding.findingId} is unresolved.`,
          "Submit and obtain independent acceptance of a resolution.",
          {
            sectionId: section.sectionId,
            componentId: finding.componentId,
            ruleId: finding.findingId,
          }
        )
      );
  for (const condition of section.conditions)
    if (condition.active)
      reasons.push(
        reason(
          condition.kind === "stale"
            ? "active_stale_condition"
            : "active_blocked_condition",
          `Condition ${condition.conditionId} is active.`,
          "Satisfy and independently accept the recorded resolution requirement.",
          {
            sectionId: section.sectionId,
            componentId: condition.componentId,
            dependencyId: condition.dependencyId ?? condition.conditionId,
          }
        )
      );
  for (const reconciliation of section.reconciliations)
    if (!reconciliation.passed)
      reasons.push(
        reason(
          "failed_reconciliation",
          `Reconciliation ${reconciliation.ruleId} failed.`,
          "Resolve the named version conflict and rerun reconciliation.",
          {
            sectionId: section.sectionId,
            componentId: reconciliation.componentId,
            ruleId: reconciliation.ruleId,
            dependencyId: reconciliation.dependencyId,
          }
        )
      );
  if (componentIds.length > 1 && section.applicability !== "not_applicable") {
    for (const componentId of componentIds) {
      const coverage = section.componentCoverage?.find(
        item => item.componentId === componentId
      );
      if (!coverage?.complete)
        reasons.push(
          reason(
            "missing_content",
            `Section ${section.sectionId} is incomplete for component ${componentId}.`,
            "Complete this section for the named component.",
            { sectionId: section.sectionId, componentId }
          )
        );
      if (!coverage?.reconciled)
        reasons.push(
          reason(
            "failed_reconciliation",
            `Section ${section.sectionId} is not reconciled for component ${componentId}.`,
            "Reconcile shared and component-specific decisions.",
            {
              sectionId: section.sectionId,
              componentId,
              ruleId: "component_reconciliation",
            }
          )
        );
    }
  }

  if (
    section.applicability !== "conditional" &&
    STATE_SCORE[section.achievedState] < STATE_SCORE.approved
  )
    reasons.push(
      reason(
        section.achievedState === "missing"
          ? "missing_content"
          : "missing_evidence",
        `Section ${section.sectionId} has achieved ${section.achievedState}, below approved.`,
        "Complete each remaining maturity gate in order.",
        { sectionId: section.sectionId }
      )
    );
  reasons.push(...actorSeparationFailures(section, issuerUserId));
  reasons.sort(compareBriefInsufficiencyReasons);
  const components = componentIds.map(componentId => {
    const componentReasons = reasons.filter(
      item => item.componentId === undefined || item.componentId === componentId
    );
    return {
      componentId,
      isStale: componentReasons.some(r => r.code === "active_stale_condition"),
      isBlocked: componentReasons.some(
        r => r.code === "active_blocked_condition"
      ),
      canIssue: componentReasons.length === 0,
      reasons: componentReasons,
    };
  });
  return {
    sectionId: section.sectionId,
    applicability: section.applicability,
    achievedState: section.achievedState,
    isStale: reasons.some(item => item.code === "active_stale_condition"),
    isBlocked: reasons.some(item => item.code === "active_blocked_condition"),
    canIssue: reasons.length === 0,
    components,
    reasons,
    nextActions: Array.from(new Set(reasons.map(item => item.nextAction))),
  };
}

export function evaluateBriefReadiness(
  facts: BriefReadinessFacts
): BriefReadinessResult {
  const counts = new Map<BriefSectionId, number>();
  for (const section of facts.sections)
    counts.set(section.sectionId, (counts.get(section.sectionId) ?? 0) + 1);
  const structuralReasons = BRIEF_SECTION_IDS.filter(
    id => counts.get(id) !== 1
  ).map(id =>
    reason(
      "invalid_section_structure",
      `Expected exactly one ${id} section; found ${counts.get(id) ?? 0}.`,
      "Restore exactly one binding for every canonical section.",
      { sectionId: id }
    )
  );
  const byId = new Map(
    facts.sections.map(section => [section.sectionId, section])
  );
  const sections = BRIEF_SECTION_IDS.map(sectionId =>
    byId.has(sectionId)
      ? evaluateSection(
          byId.get(sectionId)!,
          facts.purpose,
          facts.componentIds,
          facts.issuerUserId
        )
      : ({
          sectionId,
          applicability:
            PURPOSE_SECTION_APPLICABILITY[facts.purpose][sectionId],
          achievedState: "missing",
          isStale: false,
          isBlocked: false,
          canIssue: false,
          components: [],
          reasons: structuralReasons.filter(r => r.sectionId === sectionId),
          nextActions: structuralReasons
            .filter(r => r.sectionId === sectionId)
            .map(r => r.nextAction),
        } satisfies BriefReadinessSectionResult)
  );
  const globalReasons: BriefInsufficiencyReason[] = structuralReasons.filter(
    item => (counts.get(item.sectionId!) ?? 0) > 1
  );
  if (facts.profile === "mixed_use" && facts.componentIds.length < 2)
    globalReasons.push(
      reason(
        "invalid_section_structure",
        "Mixed-use briefs require at least two explicit components.",
        "Define every included mixed-use component."
      )
    );
  if (
    new Set(facts.componentIds).size !== facts.componentIds.length ||
    facts.componentIds.some(id => !id.trim())
  )
    globalReasons.push(
      reason(
        "invalid_section_structure",
        "Component identifiers must be non-empty and unique.",
        "Correct the component register."
      )
    );
  if (
    facts.issuerUserId === undefined ||
    !facts.activeRoles.some(
      role => role.userId === facts.issuerUserId && role.role === "issuer"
    ) ||
    !facts.activeRoles.some(
      role => role.userId === facts.issuerUserId && role.role === "approver"
    )
  )
    globalReasons.push(
      reason(
        "role_separation_failure",
        "The issuer must hold active Issuer and Approver assignments.",
        "Assign an eligible named issuer as both Issuer and Approver."
      )
    );
  for (const [key, present] of Object.entries(facts.issueMetadata))
    if (!present)
      globalReasons.push(
        reason(
          "missing_issue_metadata",
          `Issue metadata ${key} is missing.`,
          `Provide ${key} before issue.`,
          { ruleId: key }
        )
      );
  const reasons = [
    ...globalReasons,
    ...sections.flatMap(section => section.reasons),
  ].sort(compareBriefInsufficiencyReasons);
  const components: BriefReadinessComponentResult[] = facts.componentIds.map(
    componentId => {
      const componentReasons = reasons.filter(
        item =>
          item.componentId === undefined || item.componentId === componentId
      );
      return {
        componentId,
        isStale: componentReasons.some(
          r => r.code === "active_stale_condition"
        ),
        isBlocked: componentReasons.some(
          r => r.code === "active_blocked_condition"
        ),
        canIssue: componentReasons.length === 0,
        reasons: componentReasons,
      };
    }
  );
  const progress = sections.reduce(
    (sum, section) =>
      sum + STATE_SCORE[section.achievedState] / STATE_SCORE.approved,
    0
  );
  return {
    policyVersion: BRIEF_POLICY_VERSION,
    briefId: facts.briefId,
    versionId: facts.versionId,
    streamRevision: facts.streamRevision,
    versionRevision: facts.versionRevision,
    purpose: facts.purpose,
    profile: facts.profile,
    componentIds: [...facts.componentIds],
    canIssue: reasons.length === 0,
    isStale: reasons.some(item => item.code === "active_stale_condition"),
    isBlocked: reasons.some(item => item.code === "active_blocked_condition"),
    displayProgress: Math.round((progress / BRIEF_SECTION_IDS.length) * 100),
    sections,
    components,
    reasons,
    nextActions: Array.from(new Set(reasons.map(item => item.nextAction))),
  };
}
