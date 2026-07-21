import type { BriefSectionContentV1, BriefSectionContentV1Input } from "@shared/brief-section-content";
import type { BriefSectionId } from "@shared/brief-contract";

export type BriefReasonView = {
  code: string;
  message?: string;
  nextAction?: string;
  sectionId?: BriefSectionId;
  componentId?: string;
};

export type BriefStudioSection = {
  id: string;
  sectionId: BriefSectionId;
  revisionId: string | null;
  achievedState: string;
  applicability: string;
  content: unknown;
  contentSchemaVersion?: string;
  contentState?:
    | { kind: "structured"; schemaVersion: string; content: BriefSectionContentV1 }
    | { kind: "legacy"; schemaVersion: string; content: unknown }
    | { kind: "invalid"; schemaVersion: string; content: unknown; issues: string[] };
  authorUserId?: number | null;
  owner?: { subjectUserId: number; role: string } | null;
  assignments: Array<{ id: number; subjectUserId: number; role: string; sectionId?: string | null }>;
  assumptions: Array<{ id: string; statement: string; impact: string; status: string }>;
  evidence: Array<{ id: number; relevance: string; recordVersion: string; observedAt: string }>;
  dependencies: Array<Record<string, unknown>>;
  findings: Array<{ id: number; statement: string; severity: string; ownerUserId: number }>;
  conditions: Array<{ id: number; kind: string; stage: string; explanation: string; ownerUserId: number }>;
  applicabilityChoices: Array<{ id: number; stage: "proposed" | "reviewed"; actorUserId: number; createdAt: string }>;
  permittedActions: string[];
  nextAction?: string | null;
  readiness?: {
    achievedState: string;
    isStale: boolean;
    isBlocked: boolean;
    reasons: BriefReasonView[];
    nextActions: string[];
  };
};

export type BriefReadinessView = {
  canIssue: boolean;
  displayProgress: number;
  isStale: boolean;
  isBlocked: boolean;
  policyVersion: string;
  reasons: BriefReasonView[];
  sections: Array<{ sectionId: BriefSectionId; achievedState: string; isStale: boolean; isBlocked: boolean }>;
};

export type BriefStreamView = {
  id: number | string;
  briefId?: number | string;
  purpose?: string;
  currentVersionId?: number | string;
  latestVersionId?: number | string;
  revision?: number;
};

export type BriefStudioView = {
  identity: { projectId: number; briefId: string; versionId: string; streamRevision: number; versionRevision: number };
  summary: BriefStreamView;
  version: { id: string; versionNumber?: number; purpose?: string; status?: string };
  readiness: BriefReadinessView;
  sections: BriefStudioSection[];
  assignments: Array<{ id: number; subjectUserId: number; role: string; sectionId?: string | null }>;
  assumptions: Array<{ id: string; sectionId: BriefSectionId; statement: string; impact: string; status: string }>;
  findings: BriefStudioSection["findings"];
  conditions: BriefStudioSection["conditions"];
  dependencies: Array<Record<string, unknown>>;
  issues: Array<{ id: number; issueId: string; issueNumber: number; status: string }>;
  history: Array<Record<string, unknown>>;
  inbox: Array<Record<string, unknown>>;
  choices: {
    members: Array<{ id: number; label: string; organizationRole: string }>;
    evidence: Array<{ id: number; label: string; recordId: string; category: string; reliabilityGrade: string; observedAt: string; scope: string }>;
  };
  permittedActions: { createVersion: boolean; issue: boolean; administerRoles: boolean };
};

export type SaveBriefSection = (sectionId: BriefSectionId, content: BriefSectionContentV1Input, evidenceIds: number[]) => void;
